import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDb, folders } from '@televerse/db'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { authenticate } from '../middleware/auth.js'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
})

export const foldersRoutes: FastifyPluginAsync = async (app) => {
  const db = getDb()

  app.get('/', { preHandler: authenticate }, async (req) => {
    const payload = req.user as { sub: string }
    const { parentId } = (req.query ?? {}) as { parentId?: string }
    const rows = await db.select().from(folders)
      .where(and(eq(folders.userId, payload.sub), parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId)))
      .orderBy(desc(folders.createdAt))
    return { data: rows }
  })

  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const payload = req.user as { sub: string }
    const body = createSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT', statusCode: 400 })

    // Enforce max 10 levels deep
    if (body.data.parentId) {
      let depth = 0
      let currentId: string | null = body.data.parentId
      while (currentId && depth < 10) {
        const [parent] = await db.select({ parentId: folders.parentId }).from(folders).where(eq(folders.id, currentId)).limit(1)
        currentId = parent?.parentId ?? null
        depth++
      }
      if (depth >= 10) return reply.status(400).send({ error: 'Maximum folder depth (10) reached', code: 'MAX_DEPTH', statusCode: 400 })
    }

    const [folder] = await db.insert(folders).values({ ...body.data, userId: payload.sub }).returning()
    return reply.status(201).send({ data: folder })
  })

  app.patch('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }
    const body = updateSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT', statusCode: 400 })

    const [folder] = await db.update(folders).set(body.data).where(and(eq(folders.id, id), eq(folders.userId, payload.sub))).returning()
    if (!folder) return reply.status(404).send({ error: 'Folder not found', code: 'NOT_FOUND', statusCode: 404 })
    return { data: folder }
  })

  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }
    await db.delete(folders).where(and(eq(folders.id, id), eq(folders.userId, payload.sub)))
    return reply.status(204).send()
  })
}
