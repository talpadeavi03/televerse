import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDb, sharedLinks, files, users } from '@televerse/db'
import { eq, and } from 'drizzle-orm'
import { authenticate } from '../middleware/auth.js'
import { generateSecureToken, constantTimeEqual, sha256 } from '@televerse/shared'
import { TelegramService } from '../services/telegram.js'
import { createHash } from 'crypto'

const createLinkSchema = z.object({
  fileId: z.string().uuid(),
  expiresIn: z.enum(['1h', '1d', '7d', 'never']).default('7d'),
  password: z.string().optional(),
  maxDownloads: z.number().int().positive().optional(),
})

function hashPassword(pwd: string): string {
  return createHash('sha256').update(pwd).digest('hex')
}

export const shareRoutes: FastifyPluginAsync = async (app) => {
  const db = getDb()
  const tg = new TelegramService()

  // POST /v1/share — create shared link
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const payload = req.user as { sub: string }
    const body = createLinkSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT', statusCode: 400 })

    const [file] = await db.select().from(files).where(and(eq(files.id, body.data.fileId), eq(files.userId, payload.sub))).limit(1)
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND', statusCode: 404 })

    const expiryMap: Record<string, number | null> = { '1h': 3600, '1d': 86400, '7d': 604800, never: null }
    const expirySeconds = expiryMap[body.data.expiresIn] ?? null
    const expiresAt = expirySeconds ? new Date(Date.now() + expirySeconds * 1000) : null

    const token = generateSecureToken(32)
    const [link] = await db.insert(sharedLinks).values({
      fileId: body.data.fileId,
      token,
      passwordHash: body.data.password ? hashPassword(body.data.password) : null,
      expiresAt,
      maxDownloads: body.data.maxDownloads ?? null,
    }).returning()

    await db.update(files).set({ isShared: true }).where(eq(files.id, body.data.fileId))

    return reply.status(201).send({ data: { ...link, url: `/s/${token}` } })
  })

  // GET /v1/share/:token — resolve shared link
  app.get('/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    // Rate limit: 10 req/min per IP handled by global rate limiter
    const [link] = await db.select().from(sharedLinks).where(eq(sharedLinks.token, token)).limit(1)
    if (!link) return reply.status(404).send({ error: 'Link not found', code: 'NOT_FOUND', statusCode: 404 })

    if (link.expiresAt && new Date() > link.expiresAt) {
      return reply.status(410).send({ error: 'Link expired', code: 'LINK_EXPIRED', statusCode: 410 })
    }
    if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
      return reply.status(410).send({ error: 'Download limit reached', code: 'DOWNLOAD_LIMIT', statusCode: 410 })
    }

    const [file] = await db.select({ id: files.id, name: files.name, sizeBytes: files.sizeBytes, mimeType: files.mimeType })
      .from(files).where(eq(files.id, link.fileId)).limit(1)

    return { data: { file, passwordProtected: !!link.passwordHash } }
  })

  // POST /v1/share/:token/download
  app.post('/:token/download', async (req, reply) => {
    const { token } = req.params as { token: string }
    const { password } = (req.body ?? {}) as { password?: string }

    const [link] = await db.select().from(sharedLinks).where(eq(sharedLinks.token, token)).limit(1)
    if (!link) return reply.status(404).send({ error: 'Link not found', code: 'NOT_FOUND', statusCode: 404 })
    if (link.expiresAt && new Date() > link.expiresAt) return reply.status(410).send({ error: 'Link expired', code: 'LINK_EXPIRED', statusCode: 410 })
    if (link.maxDownloads && link.downloadCount >= link.maxDownloads) return reply.status(410).send({ error: 'Download limit reached', code: 'DOWNLOAD_LIMIT', statusCode: 410 })

    if (link.passwordHash) {
      if (!password || !constantTimeEqual(hashPassword(password), link.passwordHash)) {
        return reply.status(403).send({ error: 'Invalid password', code: 'INVALID_PASSWORD', statusCode: 403 })
      }
    }

    const [file] = await db.select().from(files).where(eq(files.id, link.fileId)).limit(1)
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND', statusCode: 404 })

    const [user] = await db.select({ telegramSessionEncrypted: users.telegramSessionEncrypted })
      .from(users).where(eq(users.id, file.userId)).limit(1)
    if (!user?.telegramSessionEncrypted) return reply.status(503).send({ error: 'File unavailable', code: 'UNAVAILABLE', statusCode: 503 })

    await db.update(sharedLinks).set({ downloadCount: link.downloadCount + 1 }).where(eq(sharedLinks.id, link.id))

    const stream = await tg.downloadFile(user.telegramSessionEncrypted, file.tgMessageId!)
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
    reply.header('Content-Type', file.mimeType ?? 'application/octet-stream')
    return reply.send(stream)
  })

  // DELETE /v1/share/:id
  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.delete(sharedLinks).where(eq(sharedLinks.id, id))
    return reply.status(204).send()
  })
}
