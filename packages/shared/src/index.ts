import { randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto'

// ─── Crypto ───────────────────────────────────────────────────────────────────
export function encryptAES256GCM(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptAES256GCM(ciphertext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex')
}

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function encodeCursor(id: string, date: Date): string {
  return Buffer.from(JSON.stringify({ id, date: date.toISOString() })).toString('base64url')
}

export function decodeCursor(cursor: string): { id: string; date: Date } {
  const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
    id: string
    date: string
  }
  return { id: parsed.id, date: new Date(parsed.date) }
}

// ─── File utils ───────────────────────────────────────────────────────────────
export function formatBytes(bytes: bigint | number): string {
  const n = typeof bytes === 'bigint' ? Number(bytes) : bytes
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

export const MIME_ICONS: Record<string, string> = {
  'image/': '🖼️',
  'video/': '🎬',
  'audio/': '🎵',
  'application/pdf': '📄',
  'application/zip': '📦',
  'text/': '📝',
  'application/json': '{}',
}

export function getMimeIcon(mimeType: string): string {
  for (const [prefix, icon] of Object.entries(MIME_ICONS)) {
    if (mimeType.startsWith(prefix)) return icon
  }
  return '📎'
}

// ─── Rate limit ───────────────────────────────────────────────────────────────
export class RateLimiter {
  private tokens: number
  private lastRefill: number

  constructor(
    private readonly maxTokens: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = maxTokens
    this.lastRefill = Date.now()
  }

  consume(amount = 1): boolean {
    this.refill()
    if (this.tokens < amount) return false
    this.tokens -= amount
    return true
  }

  private refill() {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillPerSecond)
    this.lastRefill = now
  }
}

// ─── Sleep / retry ─────────────────────────────────────────────────────────────
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const delay = baseDelayMs * 2 ** i + Math.random() * 100
      await sleep(delay)
    }
  }
  throw lastError
}

// ─── Chunking ─────────────────────────────────────────────────────────────────
export const CHUNK_SIZE = 512 * 1024 // 512 KB

export function chunkBuffer(buffer: Buffer): Buffer[] {
  const chunks: Buffer[] = []
  for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
    chunks.push(buffer.subarray(offset, offset + CHUNK_SIZE))
  }
  return chunks
}
