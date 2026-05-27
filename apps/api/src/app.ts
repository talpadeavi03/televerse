import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { authRoutes } from './routes/auth.js'
import { filesRoutes } from './routes/files.js'
import { foldersRoutes } from './routes/folders.js'
import { shareRoutes } from './routes/share.js'
import { aiRoutes } from './routes/ai.js'
import { oauthRoutes } from './routes/oauth.js'
import { storageRoutes } from './routes/storage.js'
import { wsRoutes } from './routes/ws.js'
import { telegramRoutes } from './routes/telegram.js'
import { errorHandler } from './middleware/errorHandler.js'
import { env } from './config/env.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport:
        env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
  })

  // ─── Plugins ────────────────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: { url: env.REDIS_URL },
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    }),
  })

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '15m' },
  })

  await app.register(multipart, {
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB
  })

  await app.register(websocket)

  await app.register(swagger, {
    openapi: {
      info: { title: 'TeleVerse API', version: '1.0.0', description: 'TeleVerse REST API' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  })

  // ─── Error handler ────────────────────────────────────────────────────────
  app.setErrorHandler(errorHandler)

  // ─── Health check ────────────────────────────────────────────────────────
  app.get('/health', { schema: { tags: ['System'] } }, async () => ({
    status: 'ok',
    ts: new Date().toISOString(),
  }))

  // ─── Routes ───────────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/v1/auth' })
  await app.register(telegramRoutes, { prefix: '/v1/telegram' })
  await app.register(filesRoutes, { prefix: '/v1/files' })
  await app.register(foldersRoutes, { prefix: '/v1/folders' })
  await app.register(shareRoutes, { prefix: '/v1/share' })
  await app.register(aiRoutes, { prefix: '/v1/ai' })
  await app.register(oauthRoutes, { prefix: '/v1/oauth' })
  await app.register(storageRoutes, { prefix: '/v1/storage' })
  await app.register(wsRoutes, { prefix: '/ws' })

  return app
}
