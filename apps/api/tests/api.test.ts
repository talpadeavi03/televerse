import { describe, it, expect, beforeAll } from 'vitest'
import { buildApp } from '../src/app'

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
