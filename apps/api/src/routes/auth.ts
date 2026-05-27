import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDb, users } from '@televerse/db'
import { sha256, generateSecureToken } from '@televerse/shared'
import { eq } from 'drizzle-orm'
import { env } from '../config/env.js'
import { getRedis } from '../config/redis.js'
import { authenticate } from '../middleware/auth.js'
import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = await scryptAsync(password, salt, 64) as Buffer
  return `${salt}:${hash.toString('hex')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  const derived = await scryptAsync(password, salt!, 64) as Buffer
  const storedBuf = Buffer.from(hash!, 'hex')
  return timingSafeEqual(derived, storedBuf)
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export const authRoutes: FastifyPluginAsync = async (app) => {
  const db = getDb()
  const redis = getRedis()

  // POST /v1/auth/register
  app.post('/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT', statusCode: 400 })

    const { email, password } = body.data
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    if (existing.length > 0) return reply.status(409).send({ error: 'Email already registered', code: 'EMAIL_EXISTS', statusCode: 409 })

    const passwordHash = await hashPassword(password)
    const [user] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id, email: users.email, plan: users.plan, createdAt: users.createdAt })

    const accessToken = app.jwt.sign({ sub: user!.id, email: user!.email })
    const refreshToken = generateSecureToken()
    await redis.set(`refresh:${sha256(refreshToken)}`, user!.id, 'EX', 7 * 24 * 3600)

    return reply.status(201).send({ data: { user, accessToken, refreshToken } })
  })

  // POST /v1/auth/login
  app.post('/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT', statusCode: 400 })

    const { email, password } = body.data
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user || !user.passwordHash) return reply.status(401).send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS', statusCode: 401 })

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS', statusCode: 401 })

    const accessToken = app.jwt.sign({ sub: user.id, email: user.email })
    const refreshToken = generateSecureToken()
    await redis.set(`refresh:${sha256(refreshToken)}`, user.id, 'EX', 7 * 24 * 3600)

    return { data: { accessToken, refreshToken, user: { id: user.id, email: user.email, plan: user.plan } } }
  })

  // POST /v1/auth/refresh
  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = (req.body ?? {}) as { refreshToken?: string }
    if (!refreshToken) return reply.status(400).send({ error: 'Missing refreshToken', code: 'INVALID_INPUT', statusCode: 400 })

    const userId = await redis.get(`refresh:${sha256(refreshToken)}`)
    if (!userId) return reply.status(401).send({ error: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN', statusCode: 401 })

    // Rotate refresh token
    await redis.del(`refresh:${sha256(refreshToken)}`)
    const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
    if (!user) return reply.status(401).send({ error: 'User not found', code: 'USER_NOT_FOUND', statusCode: 401 })

    const accessToken = app.jwt.sign({ sub: user.id, email: user.email })
    const newRefreshToken = generateSecureToken()
    await redis.set(`refresh:${sha256(newRefreshToken)}`, user.id, 'EX', 7 * 24 * 3600)

    return { data: { accessToken, refreshToken: newRefreshToken } }
  })

  // POST /v1/auth/logout
  app.post('/logout', { preHandler: authenticate }, async (req, reply) => {
    const { refreshToken } = (req.body ?? {}) as { refreshToken?: string }
    if (refreshToken) {
      await redis.del(`refresh:${sha256(refreshToken)}`)
    }
    return reply.status(204).send()
  })

  // GET /v1/auth/me
  app.get('/me', { preHandler: authenticate }, async (req) => {
    const payload = req.user as { sub: string }
    const [user] = await db.select({ id: users.id, email: users.email, plan: users.plan, storageUsedBytes: users.storageUsedBytes, createdAt: users.createdAt })
      .from(users).where(eq(users.id, payload.sub)).limit(1)
    return { data: user }
  })
}
