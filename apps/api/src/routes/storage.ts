import type { FastifyPluginAsync } from 'fastify'
import { getDb, users } from '@televerse/db'
import { eq, sql } from 'drizzle-orm'
import { authenticate } from '../middleware/auth.js'

export const storageRoutes: FastifyPluginAsync = async (app) => {
  const db = getDb()

  // GET /v1/storage/usage
  app.get('/usage', { preHandler: authenticate }, async (req) => {
    const payload = req.user as { sub: string }
    const [user] = await db.select({ storageUsedBytes: users.storageUsedBytes, plan: users.plan })
      .from(users).where(eq(users.id, payload.sub)).limit(1)
    
    const used = Number(user?.storageUsedBytes ?? 0)
    const limit = user?.plan === 'pro' ? Infinity : Infinity // Unlimited via Telegram
    
    return {
      data: {
        usedBytes: used,
        limitBytes: limit,
        usedFormatted: formatBytes(used),
        plan: user?.plan ?? 'free',
      }
    }
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}
