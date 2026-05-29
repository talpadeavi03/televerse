import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDb, files, folders, users } from '@televerse/db'
import { eq, and, isNull, ilike, desc, sql } from 'drizzle-orm'
import { authenticate } from '../middleware/auth.js'
import { TelegramService } from '../services/telegram.js'
import { AIService } from '../services/ai.js'
import { sha256 } from '@televerse/shared'
import { wsManager } from '../services/wsManager.js'

const listQuerySchema = z.object({
  folderId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['name', 'size', 'date']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  deleted: z.coerce.boolean().default(false),
  starred: z.coerce.boolean().optional(),
  shared: z.coerce.boolean().optional(),
})

export const filesRoutes: FastifyPluginAsync = async (app) => {
  const db = getDb()
  const tg = new TelegramService()
  const ai = new AIService()

  // GET /v1/files
  app.get('/', { preHandler: authenticate }, async (req) => {
    const payload = req.user as { sub: string }
    const query = listQuerySchema.safeParse(req.query)
    if (!query.success) return { error: 'Invalid query', code: 'INVALID_QUERY', statusCode: 400 }

    const { folderId, search, page, limit, sort, order, deleted, starred, shared } = query.data
    const offset = (page - 1) * limit

    const conditions = [
      eq(files.userId, payload.sub),
      eq(files.isDeleted, deleted),
      ...(starred !== undefined ? [eq(files.isStarred, starred)] : []),
      ...(shared !== undefined ? [eq(files.isShared, shared)] : []),
      ...(starred || shared ? [] : folderId ? [eq(files.folderId, folderId)] : [isNull(files.folderId)]),
      ...(search ? [ilike(files.name, `%${search}%`)] : []),
    ]

    const orderCol = sort === 'name' ? files.name : sort === 'size' ? files.sizeBytes : files.uploadedAt
    const orderFn = order === 'asc' ? orderCol : desc(orderCol)

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(files).where(and(...conditions)).orderBy(orderFn).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(files).where(and(...conditions)),
    ])

    return { data: rows, meta: { total: Number(count), page, limit, hasMore: offset + rows.length < Number(count) } }
  })

  // GET /v1/files/:id
  app.get('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }
    const [file] = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, payload.sub))).limit(1)
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND', statusCode: 404 })
    return { data: file }
  })

  // POST /v1/files/upload
  app.post('/upload', { preHandler: authenticate }, async (req, reply) => {
    const payload = req.user as { sub: string }
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file', code: 'NO_FILE', statusCode: 400 })

    const [user] = await db.select({ telegramSessionEncrypted: users.telegramSessionEncrypted })
      .from(users).where(eq(users.id, payload.sub)).limit(1)
    if (!user?.telegramSessionEncrypted) {
      return reply.status(403).send({ error: 'Telegram account not connected', code: 'TG_NOT_CONNECTED', statusCode: 403 })
    }

    const buffer = await data.toBuffer()
    const hash = sha256(buffer)

    // Dedup check
    const existing = await db.select({ id: files.id, name: files.name })
      .from(files).where(and(eq(files.userId, payload.sub), eq(files.sha256Hash, hash), eq(files.isDeleted, false))).limit(1)
    if (existing.length > 0) {
      return reply.status(409).send({ error: 'Identical file already exists', code: 'DUPLICATE_FILE', statusCode: 409, data: existing[0] })
    }

    const folderId = (data.fields['folderId'] as { value?: string } | undefined)?.value ?? null

    // Upload to Telegram
    const msgId = await tg.uploadFile(user.telegramSessionEncrypted, {
      buffer,
      filename: data.filename,
      mimeType: data.mimetype,
      onProgress: (progress) => wsManager.sendToUser(payload.sub, { type: 'upload:progress', payload: progress, ts: Date.now() }),
    })

    const [file] = await db.insert(files).values({
      userId: payload.sub,
      folderId,
      name: data.filename,
      sizeBytes: BigInt(buffer.length),
      mimeType: data.mimetype,
      sha256Hash: hash,
      tgMessageId: BigInt(msgId),
    }).returning()

    // Update storage usage
    await db.update(users).set({ storageUsedBytes: sql`storage_used_bytes + ${BigInt(buffer.length)}` }).where(eq(users.id, payload.sub))

    // Async AI tagging
    ai.tagFile(file!.id, buffer, data.mimetype).catch(console.error)

    wsManager.sendToUser(payload.sub, { type: 'upload:complete', payload: { fileId: file!.id }, ts: Date.now() })

    return reply.status(201).send({ data: file })
  })

  // DELETE /v1/files/:id
  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }

    const [file] = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, payload.sub))).limit(1)
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND', statusCode: 404 })

    // Soft delete
    await db.update(files).set({ isDeleted: true, deletedAt: new Date() }).where(eq(files.id, id))
    await db.update(users).set({ storageUsedBytes: sql`storage_used_bytes - ${file.sizeBytes}` }).where(eq(users.id, payload.sub))

    return reply.status(204).send()
  })

  // GET /v1/files/:id/download
  app.get('/:id/download', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }

    const [file] = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, payload.sub), eq(files.isDeleted, false))).limit(1)
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND', statusCode: 404 })

    const [user] = await db.select({ telegramSessionEncrypted: users.telegramSessionEncrypted }).from(users).where(eq(users.id, payload.sub)).limit(1)
    if (!user?.telegramSessionEncrypted) return reply.status(403).send({ error: 'Telegram not connected', code: 'TG_NOT_CONNECTED', statusCode: 403 })

    const stream = await tg.downloadFile(user.telegramSessionEncrypted, file.tgMessageId!)

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
    reply.header('Content-Type', file.mimeType ?? 'application/octet-stream')
    reply.header('Content-Length', file.sizeBytes.toString())
    return reply.send(stream)
  })

  // PATCH /v1/files/:id/restore
  app.patch('/:id/restore', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }
    await db.update(files).set({ isDeleted: false, deletedAt: null }).where(and(eq(files.id, id), eq(files.userId, payload.sub)))
    return reply.status(204).send()
  })

  // PATCH /v1/files/:id/move
  app.patch('/:id/move', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }
    const { folderId } = (req.body ?? {}) as { folderId?: string | null }
    await db.update(files).set({ folderId: folderId ?? null }).where(and(eq(files.id, id), eq(files.userId, payload.sub)))
    return reply.status(204).send()
  })

  // PATCH /v1/files/:id/star
  app.patch('/:id/star', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }
    
    const [file] = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, payload.sub))).limit(1)
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND', statusCode: 404 })

    const [updated] = await db.update(files).set({ isStarred: !file.isStarred }).where(eq(files.id, id)).returning()
    return { data: updated }
  })

  // DELETE /v1/files/:id/purge
  app.delete('/:id/purge', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }

    const [file] = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, payload.sub))).limit(1)
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND', statusCode: 404 })

    const [user] = await db.select({ telegramSessionEncrypted: users.telegramSessionEncrypted }).from(users).where(eq(users.id, payload.sub)).limit(1)
    
    if (user?.telegramSessionEncrypted && file.tgMessageId) {
      try {
        await tg.deleteMessage(user.telegramSessionEncrypted, file.tgMessageId)
      } catch (err: any) {
        console.warn(`Failed to delete backing Telegram message for file ${id}:`, err.message)
      }
    }

    // Permanent DB delete
    await db.delete(files).where(eq(files.id, id))
    
    // Subtract storage bytes from user's storage limits
    await db.update(users).set({ storageUsedBytes: sql`GREATEST(0, storage_used_bytes - ${file.sizeBytes})` }).where(eq(users.id, payload.sub))

    return reply.status(204).send()
  })

  // GET /v1/files/associations
  app.get('/associations', { preHandler: authenticate }, async (req) => {
    const payload = req.user as { sub: string }
    
    // 1. Fetch active files (including their tags and metadata)
    const rows = await db.execute(sql`
      SELECT f.id, f.name, f.mime_type, f.size_bytes, f.folder_id,
             am.tags
      FROM files f
      LEFT JOIN ai_metadata am ON am.file_id = f.id
      WHERE f.user_id = ${payload.sub} AND f.is_deleted = false
      LIMIT 100
    `) as unknown as { id: string; name: string; mime_type: string | null; size_bytes: string; folder_id: string | null; tags: string[] | null }[]

    // 2. Fetch folders
    const folderRows = await db.select({ id: folders.id, name: folders.name }).from(folders).where(eq(folders.userId, payload.sub))

    const nodes: any[] = []
    const links: any[] = []
    const tagSet = new Set<string>()

    // Add folder nodes
    for (const folder of folderRows) {
      nodes.push({ id: folder.id, label: folder.name, type: 'folder', color: '#8b5cf6' })
    }

    for (const row of rows) {
      const size = Number(row.size_bytes)
      nodes.push({ id: row.id, label: row.name, type: 'file', mime: row.mime_type, size })

      // Link file to parent folder if present
      if (row.folder_id) {
        links.push({ source: row.id, target: row.folder_id, value: 2 })
      }

      // Add AI tags and links
      if (row.tags && Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          const cleanedTag = tag.trim().toLowerCase()
          if (cleanedTag.length > 0) {
            const tagNodeId = `tag-${cleanedTag}`
            if (!tagSet.has(cleanedTag)) {
              tagSet.add(cleanedTag)
              nodes.push({ id: tagNodeId, label: cleanedTag, type: 'tag', color: '#14b8a6' })
            }
            links.push({ source: row.id, target: tagNodeId, value: 1 })
          }
        }
      }
    }

    return { data: { nodes, links } }
  })
}
