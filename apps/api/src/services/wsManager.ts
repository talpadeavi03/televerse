import type WebSocket from 'ws'
import type { WSEvent } from '@televerse/types'

class WSManager {
  private sockets = new Map<string, Set<WebSocket>>()

  register(userId: string, socket: WebSocket): void {
    if (!this.sockets.has(userId)) this.sockets.set(userId, new Set())
    this.sockets.get(userId)!.add(socket)
  }

  unregister(userId: string, socket: WebSocket): void {
    this.sockets.get(userId)?.delete(socket)
    if (this.sockets.get(userId)?.size === 0) this.sockets.delete(userId)
  }

  sendToUser(userId: string, event: WSEvent): void {
    const sockets = this.sockets.get(userId)
    if (!sockets) return
    const payload = JSON.stringify(event)
    for (const socket of sockets) {
      if (socket.readyState === 1) socket.send(payload)
    }
  }

  broadcast(event: WSEvent): void {
    const payload = JSON.stringify(event)
    for (const sockets of this.sockets.values()) {
      for (const socket of sockets) {
        if (socket.readyState === 1) socket.send(payload)
      }
    }
  }
}

export const wsManager = new WSManager()
