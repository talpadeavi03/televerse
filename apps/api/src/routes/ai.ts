import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDb, files, aiMetadata, users } from '@televerse/db'
import { eq, and, sql } from 'drizzle-orm'
import { authenticate } from '../middleware/auth.js'
import { AIService } from '../services/ai.js'
import { TelegramService } from '../services/telegram.js'

const chatSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(5),
  message: z.string().min(1).max(2000),
})

export const aiRoutes: FastifyPluginAsync = async (app) => {
  const db = getDb()
  const ai = new AIService()
  const tg = new TelegramService()

  // GET /v1/ai/summary/:fileId
  app.get('/summary/:fileId', { preHandler: authenticate }, async (req, reply) => {
    const { fileId } = req.params as { fileId: string }
    const payload = req.user as { sub: string }

    const [file] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.userId, payload.sub))).limit(1)
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND', statusCode: 404 })

    const [meta] = await db.select().from(aiMetadata).where(eq(aiMetadata.fileId, fileId)).limit(1)
    if (meta) return { data: { summary: meta.summary, tags: meta.tags, generatedAt: meta.generatedAt } }

    // Generate on demand
    const [user] = await db.select({ telegramSessionEncrypted: users.telegramSessionEncrypted }).from(users).where(eq(users.id, payload.sub)).limit(1)
    if (!user?.telegramSessionEncrypted) return reply.status(403).send({ error: 'Telegram not connected', code: 'TG_NOT_CONNECTED', statusCode: 403 })

    const buffer = await tg.downloadToBuffer(user.telegramSessionEncrypted, file.tgMessageId!)
    const result = await ai.generateSummary(fileId, buffer, file.mimeType ?? '')

    return { data: result }
  })

  // GET /v1/ai/search
  app.get('/search', { preHandler: authenticate }, async (req) => {
    const payload = req.user as { sub: string }
    const { q } = (req.query ?? {}) as { q?: string }
    if (!q) return { data: [] }

    const results = await ai.semanticSearch(payload.sub, q)
    return { data: results }
  })

  // POST /v1/ai/chat
  app.post('/chat', { preHandler: authenticate }, async (req, reply) => {
    const payload = req.user as { sub: string }
    const body = chatSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT', statusCode: 400 })

    const userFiles = await db.select().from(files)
      .where(and(eq(files.userId, payload.sub)))
      .limit(5)

    const fileRows = userFiles.filter((f) => body.data.fileIds.includes(f.id))
    if (fileRows.length === 0) return reply.status(404).send({ error: 'Files not found', code: 'NOT_FOUND', statusCode: 404 })

    const summaries = await db.select({ summary: aiMetadata.summary, tags: aiMetadata.tags })
      .from(aiMetadata).where(sql`file_id = ANY(${body.data.fileIds})`)

    const stream = await ai.chatWithFiles(body.data.message, fileRows, summaries)

    reply.header('Content-Type', 'text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')

    for await (const chunk of stream) {
      reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }
    reply.raw.end()
  })

  // POST /v1/ai/regenerate/:fileId
  app.post('/regenerate/:fileId', { preHandler: authenticate }, async (req, reply) => {
    const { fileId } = req.params as { fileId: string }
    const payload = req.user as { sub: string }

    const [file] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.userId, payload.sub))).limit(1)
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND', statusCode: 404 })

    await db.delete(aiMetadata).where(eq(aiMetadata.fileId, fileId))

    const [user] = await db.select({ telegramSessionEncrypted: users.telegramSessionEncrypted }).from(users).where(eq(users.id, payload.sub)).limit(1)
    if (!user?.telegramSessionEncrypted) return reply.status(403).send({ error: 'Telegram not connected', code: 'TG_NOT_CONNECTED', statusCode: 403 })

    const buffer = await tg.downloadToBuffer(user.telegramSessionEncrypted, file.tgMessageId!)
    const result = await ai.generateSummary(fileId, buffer, file.mimeType ?? '')
    return { data: result }
  })
}
