import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ApiError } from '@televerse/types'

export function errorHandler(
  error: Error & { statusCode?: number; code?: string; validation?: unknown[] },
  _req: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500
  const code = error.code ?? 'INTERNAL_ERROR'

  if (statusCode >= 500) {
    console.error('[API Error]', error)
  }

  const body: ApiError = {
    error: statusCode >= 500 ? 'Internal Server Error' : error.message,
    code,
    statusCode,
  }

  reply.status(statusCode).send(body)
}
