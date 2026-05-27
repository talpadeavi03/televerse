import { describe, it, expect } from 'vitest'
import { encryptAES256GCM, decryptAES256GCM, sha256, generateSecureToken, chunkBuffer } from '../src/index'

const KEY = '0'.repeat(64)

describe('crypto utils', () => {
  it('round-trips AES-256-GCM encryption', () => {
    const plaintext = 'hello world session string'
    const encrypted = encryptAES256GCM(plaintext, KEY)
    expect(encrypted).not.toBe(plaintext)
    expect(decryptAES256GCM(encrypted, KEY)).toBe(plaintext)
  })

  it('sha256 is deterministic', () => {
    expect(sha256('test')).toBe(sha256('test'))
    expect(sha256('a')).not.toBe(sha256('b'))
  })

  it('generateSecureToken returns unique values', () => {
    const t1 = generateSecureToken()
    const t2 = generateSecureToken()
    expect(t1).not.toBe(t2)
    expect(t1.length).toBeGreaterThan(20)
  })
})

describe('chunkBuffer', () => {
  it('splits correctly', () => {
    const buf = Buffer.alloc(1024 * 1024) // 1 MB
    const chunks = chunkBuffer(buf)
    expect(chunks.length).toBe(2) // 512 KB each
    expect(chunks[0]!.length).toBe(512 * 1024)
  })
})
