import type { FastifyPluginAsync } from 'fastify'
import { wsManager } from '../services/wsManager.js'

export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { websocket: true }, (socket, req) => {
    let userId: string | null = null

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; token?: string }

        if (msg.type === 'auth') {
          try {
            const payload = app.jwt.verify(msg.token ?? '') as { sub: string }
            userId = payload.sub
            wsManager.register(userId, socket)
            socket.send(JSON.stringify({ type: 'auth:ok', ts: Date.now() }))
          } catch {
            socket.send(JSON.stringify({ type: 'auth:error', error: 'Invalid token' }))
          }
          return
        }

        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
          return
        }
      } catch {
        // ignore malformed messages
      }
    })

    socket.on('close', () => {
      if (userId) wsManager.unregister(userId, socket)
    })
  })
}
