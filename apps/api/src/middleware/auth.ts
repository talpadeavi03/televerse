import type { FastifyReply, FastifyRequest } from 'fastify'

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    if (!req.headers.authorization) {
      const queryToken = (req.query as { token?: string })?.token
      if (queryToken) {
        req.headers.authorization = `Bearer ${queryToken}`
      }
    }
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED', statusCode: 401 })
  }
}
