'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth'
import type { WSEvent } from '@televerse/types'

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:4000'

type EventHandler = (event: WSEvent) => void

class WSClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<EventHandler>>()
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private token: string | null = null

  connect(token: string) {
    this.token = token
    this.ws = new WebSocket(`${WS_URL}/ws`)

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: 'auth', token }))
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)
    }

    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as WSEvent
        this.handlers.get(event.type)?.forEach((h) => h(event))
        this.handlers.get('*')?.forEach((h) => h(event))
      } catch {}
    }

    this.ws.onclose = () => {
      if (this.pingInterval) clearInterval(this.pingInterval)
      // Reconnect after 3s
      this.reconnectTimeout = setTimeout(() => {
        if (this.token) this.connect(this.token)
      }, 3000)
    }
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval)
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)
    this.ws?.close()
    this.ws = null
    this.token = null
  }

  on(type: string, handler: EventHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }
}

export const wsClient = new WSClient()

export function useWS(type: string, handler: EventHandler) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const off = wsClient.on(type, (e) => handlerRef.current(e))
    return () => {
      off()
    }
  }, [type])
}

export function WSProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore()

  useEffect(() => {
    if (accessToken) {
      wsClient.connect(accessToken)
    }
    return () => wsClient.disconnect()
  }, [accessToken])

  return <>{children}</>
}
