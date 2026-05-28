import { describe, it, expect, beforeAll } from 'vitest'
import { buildApp } from '../src/app'
import { verifyPassword } from '../src/routes/auth'

describe('Health check', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://televerse:televerse@localhost:5432/televerse_test'
    process.env['REDIS_URL'] = 'redis://localhost:6379'
    process.env['JWT_SECRET'] = 'test-secret-32-chars-minimum-here'
    process.env['SESSION_ENCRYPTION_KEY'] = '0'.repeat(64)
    process.env['TG_API_ID'] = '12345'
    process.env['TG_API_HASH'] = 'test_hash'
    process.env['GROQ_API_KEY'] = 'test_key'
    process.env['INTERNAL_SECRET'] = 'test-internal-secret-16chars'
    app = await buildApp()
  })

  it('returns 200 on /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' })
  })

  it('returns 401 on protected route without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/files' })
    expect(res.statusCode).toBe(401)
  })
})

describe('verifyPassword robustness', () => {
  const validStoredHash = '3f9d506927a71a3962b32bb39b2cd81a:b0d2d3a3e6f9a76e938bf8c5c7d0d0eb3f9d506927a71a3962b32bb39b2cd81ab0d2d3a3e6f9a76e938bf8c5c7d0d0eb3f9d506927a71a3962b32bb39b2cd81a'

  it('returns true for correct password and valid stored hash', async () => {
    // Generates a proper mock salt:hash representation
    // Let's verify with an actual generated hash:
    // salt: '3f9d506927a71a3962b32bb39b2cd81a'
    // password: 'testpassword'
    // Let's use custom scrypt to verify, or we can just hash it first:
    const salt = '3f9d506927a71a3962b32bb39b2cd81a'
    const password = 'testpassword'
    // To make sure we have a perfectly matching salt:hash, let's create it dynamically in the test:
    const crypto = await import('crypto')
    const derived = crypto.scryptSync(password, salt, 64)
    const stored = `${salt}:${derived.toString('hex')}`

    const isValid = await verifyPassword(password, stored)
    expect(isValid).toBe(true)
  })

  it('returns false for incorrect password', async () => {
    const salt = '3f9d506927a71a3962b32bb39b2cd81a'
    const crypto = await import('crypto')
    const derived = crypto.scryptSync('correct_password', salt, 64)
    const stored = `${salt}:${derived.toString('hex')}`

    const isValid = await verifyPassword('wrong_password', stored)
    expect(isValid).toBe(false)
  })

  it('returns false instead of throwing on malformed hash (no colon)', async () => {
    const isValid = await verifyPassword('password', 'some_random_string_without_colon')
    expect(isValid).toBe(false)
  })

  it('returns false instead of throwing on malformed hash (missing salt or hash)', async () => {
    expect(await verifyPassword('password', ':')).toBe(false)
    expect(await verifyPassword('password', 'salt:')).toBe(false)
    expect(await verifyPassword('password', ':hash')).toBe(false)
  })

  it('returns false instead of throwing on different hash lengths', async () => {
    const isValid = await verifyPassword('password', 'salt:short_hash')
    expect(isValid).toBe(false)
  })

  it('returns false instead of throwing on empty inputs', async () => {
    expect(await verifyPassword('', '')).toBe(false)
    expect(await verifyPassword('password', '')).toBe(false)
  })
})
