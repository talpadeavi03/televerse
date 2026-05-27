import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDb, users } from '@televerse/db'
import { eq } from 'drizzle-orm'
import { authenticate } from '../middleware/auth.js'
import { TelegramService } from '../services/telegram.js'

const step1Schema = z.object({ phone: z.string().min(7) })
const step2Schema = z.object({
  sessionId: z.string(),
  phone: z.string(),
  phoneCodeHash: z.string(),
  code: z.string(),
  password: z.string().optional(),
})

export const telegramRoutes: FastifyPluginAsync = async (app) => {
  const db = getDb()
  const tg = new TelegramService()

  // POST /v1/telegram/auth/step1 — send OTP
  app.post('/auth/step1', { preHandler: authenticate }, async (req, reply) => {
    const body = step1Schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT', statusCode: 400 })

    const result = await tg.sendCode(body.data.phone)
    return { data: result }
  })

  // POST /v1/telegram/auth/step2 — verify OTP and save session
  app.post('/auth/step2', { preHandler: authenticate }, async (req, reply) => {
    const body = step2Schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT', statusCode: 400 })

    const payload = req.user as { sub: string }
    const result = await tg.signIn(body.data)
    
    await db.update(users)
      .set({
        telegramPhone: body.data.phone,
        telegramUserId: BigInt(result.telegramUserId),
        telegramSessionEncrypted: result.encryptedSession,
        updatedAt: new Date(),
      })
      .where(eq(users.id, payload.sub))

    return { data: { connected: true, telegramUserId: result.telegramUserId } }
  })

  // DELETE /v1/telegram/auth — disconnect Telegram
  app.delete('/auth', { preHandler: authenticate }, async (req, reply) => {
    const payload = req.user as { sub: string }
    await db.update(users)
      .set({ telegramSessionEncrypted: null, telegramUserId: null, telegramPhone: null, updatedAt: new Date() })
      .where(eq(users.id, payload.sub))
    return reply.status(204).send()
  })

  // GET /v1/telegram/status
  app.get('/status', { preHandler: authenticate }, async (req) => {
    const payload = req.user as { sub: string }
    const [user] = await db.select({ telegramUserId: users.telegramUserId, telegramPhone: users.telegramPhone })
      .from(users).where(eq(users.id, payload.sub)).limit(1)
    return { data: { connected: !!user?.telegramSessionEncrypted, telegramUserId: user?.telegramUserId?.toString() } }
  })
}
