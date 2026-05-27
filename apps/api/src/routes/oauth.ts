import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDb, oauthApps, oauthTokens, users } from '@televerse/db'
import { eq, and } from 'drizzle-orm'
import { generateSecureToken, sha256 } from '@televerse/shared'
import { getRedis } from '../config/redis.js'

const registerAppSchema = z.object({
  name: z.string().min(1).max(100),
  redirectUris: z.array(z.string().url()).min(1).max(5),
  scopes: z.array(z.enum(['files.read', 'files.write', 'folders.read', 'folders.write', 'ai.read'])),
})

const authorizeSchema = z.object({
  clientId: z.string(),
  redirectUri: z.string().url(),
  scope: z.string(),
  state: z.string(),
  responseType: z.literal('code'),
})

export const oauthRoutes: FastifyPluginAsync = async (app) => {
  const db = getDb()
  const redis = getRedis()

  // POST /v1/oauth/apps — register a new OAuth app
  app.post('/apps', async (req, reply) => {
    const body = registerAppSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT', statusCode: 400 })

    const clientId = generateSecureToken(16)
    const clientSecret = generateSecureToken(32)
    const [app_] = await db.insert(oauthApps).values({
      ownerUserId: (req.user as { sub: string }).sub,
      name: body.data.name,
      clientId,
      clientSecretHash: sha256(clientSecret),
      redirectUris: body.data.redirectUris,
      scopes: body.data.scopes,
    }).returning({ id: oauthApps.id, clientId: oauthApps.clientId, name: oauthApps.name })

    return reply.status(201).send({ data: { ...app_, clientSecret } })
  })

  // GET /v1/oauth/authorize — OAuth authorization page
  app.get('/authorize', async (req, reply) => {
    const params = authorizeSchema.safeParse(req.query)
    if (!params.success) return reply.status(400).send({ error: 'Invalid OAuth request', code: 'INVALID_OAUTH', statusCode: 400 })

    const [app_] = await db.select().from(oauthApps).where(eq(oauthApps.clientId, params.data.clientId)).limit(1)
    if (!app_) return reply.status(404).send({ error: 'Unknown client', code: 'UNKNOWN_CLIENT', statusCode: 404 })
    if (!app_.redirectUris?.includes(params.data.redirectUri)) {
      return reply.status(400).send({ error: 'Invalid redirect_uri', code: 'INVALID_REDIRECT', statusCode: 400 })
    }

    // In real app, return an HTML consent page. Here we return the app details for the UI.
    return { data: { app: { name: app_.name, scopes: params.data.scope.split(' ') }, params: params.data } }
  })

  // POST /v1/oauth/authorize — user approves
  app.post('/authorize', async (req, reply) => {
    const { clientId, redirectUri, scope, state, approved } = (req.body ?? {}) as Record<string, string>
    if (approved !== 'true') {
      const url = new URL(redirectUri)
      url.searchParams.set('error', 'access_denied')
      url.searchParams.set('state', state)
      return reply.redirect(url.toString())
    }

    const userId = (req.user as { sub?: string } | undefined)?.sub
    if (!userId) return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED', statusCode: 401 })

    const code = generateSecureToken(16)
    await redis.set(`oauth:code:${code}`, JSON.stringify({ userId, clientId, scope, redirectUri }), 'EX', 600)

    const url = new URL(redirectUri)
    url.searchParams.set('code', code)
    url.searchParams.set('state', state)
    return reply.redirect(url.toString())
  })

  // POST /v1/oauth/token
  app.post('/token', async (req, reply) => {
    const { code, clientId, clientSecret, redirectUri, grantType, refreshToken } = (req.body ?? {}) as Record<string, string>

    const [app_] = await db.select().from(oauthApps).where(eq(oauthApps.clientId, clientId)).limit(1)
    if (!app_ || app_.clientSecretHash !== sha256(clientSecret)) {
      return reply.status(401).send({ error: 'Invalid client credentials', code: 'INVALID_CLIENT', statusCode: 401 })
    }

    if (grantType === 'authorization_code') {
      const raw = await redis.get(`oauth:code:${code}`)
      if (!raw) return reply.status(400).send({ error: 'Invalid or expired code', code: 'INVALID_CODE', statusCode: 400 })
      await redis.del(`oauth:code:${code}`)

      const { userId, scope } = JSON.parse(raw) as { userId: string; scope: string }
      const accessToken = generateSecureToken(32)
      const newRefreshToken = generateSecureToken(32)

      await db.insert(oauthTokens).values({
        userId,
        appId: app_.id,
        accessTokenHash: sha256(accessToken),
        refreshTokenHash: sha256(newRefreshToken),
        scopes: scope.split(' '),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      })

      return { access_token: accessToken, refresh_token: newRefreshToken, token_type: 'Bearer', expires_in: 3600 }
    }

    return reply.status(400).send({ error: 'Unsupported grant_type', code: 'INVALID_GRANT', statusCode: 400 })
  })
}
