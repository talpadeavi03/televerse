import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ApiError } from '@televerse/types'

export function errorHandler(
  error: Error & { statusCode?: number; code?: string; validation?: unknown[] },
  _req: FastifyRequest,
  reply: FastifyReply,
): void {
  let statusCode = error.statusCode ?? 500
  let code = error.code ?? 'INTERNAL_ERROR'
  let message = error.message

  // Map database, cache, or external network connection refusal
  if (error.code === 'ECONNREFUSED') {
    statusCode = 503
    code = 'CONNECTION_REFUSED'
    message = 'Connection refused. The database server or external Telegram network service is temporarily offline or busy.'
  } else if (error.message?.includes('AUTH_KEY_UNREGISTERED') || error.message?.includes('SESSION_REVOKED')) {
    statusCode = 401
    code = 'TG_SESSION_EXPIRED'
    message = 'Your Telegram linking session has expired or was revoked. Please reconnect in settings.'
  } else if (error.message?.includes('FLOOD_WAIT')) {
    statusCode = 429
    code = 'TG_FLOOD_WAIT'
    message = 'Telegram rate limit exceeded. Please wait a few moments before retrying.'
  }

  if (statusCode >= 500) {
    console.error('[API Error]', error)
  }

  const body: ApiError = {
    error: statusCode >= 500 && code === 'INTERNAL_ERROR' ? 'Internal Server Error' : message,
    code,
    statusCode,
  }

  reply.status(statusCode).send(body)
}
