import { describe, it, expect, beforeAll } from 'vitest'
import { buildApp } from '../src/app'
import { verifyPassword } from '../src/routes/auth'
import { getDb, files, users } from '@televerse/db'
import { eq } from 'drizzle-orm'

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

    // Automatically apply DB migrations to the test database
    try {
      const db = getDb()
      const { migrate } = await import('drizzle-orm/postgres-js/migrator')
      const path = await import('path')
      const url = await import('url')
      const currentDir = path.dirname(url.fileURLToPath(import.meta.url))
      await migrate(db, { migrationsFolder: path.resolve(currentDir, '../../../infra/migrations') })
    } catch (err: any) {
      console.warn('⚠️ Test DB migration skipped (possibly no database running or reachable):', err.message)
    }
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
    const salt = '3f9d506927a71a3962b32bb39b2cd81a'
    const password = 'testpassword'
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

describe('Files Operations', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const userId = '11111111-2222-3333-4444-555555555555'
  let token: string
  let testFileId: string

  beforeAll(async () => {
    app = await buildApp()
    token = app.jwt.sign({ sub: userId, email: 'test@example.com' })

    const db = getDb()
    // Make sure test user exists
    await db.insert(users).values({
      id: userId,
      email: 'test@example.com',
      passwordHash: 'salt:hash',
      storageUsedBytes: 0n,
    }).onConflictDoNothing()

    // Insert a test file
    const [file] = await db.insert(files).values({
      userId,
      name: 'test_file.txt',
      sizeBytes: 1024n,
      mimeType: 'text/plain',
      isStarred: false,
      isDeleted: false,
    }).returning()
    testFileId = file.id
  })

  it('toggles isStarred status via PATCH /v1/files/:id/star', async () => {
    // 1. Star it
    const res1 = await app.inject({
      method: 'PATCH',
      url: `/v1/files/${testFileId}/star`,
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res1.statusCode).toBe(200)
    const data1 = JSON.parse(res1.body)
    expect(data1.data.isStarred).toBe(true)

    // 2. Unstar it
    const res2 = await app.inject({
      method: 'PATCH',
      url: `/v1/files/${testFileId}/star`,
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res2.statusCode).toBe(200)
    const data2 = JSON.parse(res2.body)
    expect(data2.data.isStarred).toBe(false)
  })

  it('returns soft-deleted files in GET /v1/files?deleted=true and active files otherwise', async () => {
    const db = getDb()
    // Soft-delete the file
    await db.update(files).set({ isDeleted: true }).where(eq(files.id, testFileId))

    // Query active files (should be empty or exclude testFileId)
    const resActive = await app.inject({
      method: 'GET',
      url: '/v1/files',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(resActive.statusCode).toBe(200)
    const activeFiles = JSON.parse(resActive.body).data
    expect(activeFiles.some((f: any) => f.id === testFileId)).toBe(false)

    // Query soft-deleted files (should include testFileId)
    const resDeleted = await app.inject({
      method: 'GET',
      url: '/v1/files?deleted=true',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(resDeleted.statusCode).toBe(200)
    const deletedFiles = JSON.parse(resDeleted.body).data
    expect(deletedFiles.some((f: any) => f.id === testFileId)).toBe(true)

    // Restore the file for next tests
    await db.update(files).set({ isDeleted: false }).where(eq(files.id, testFileId))
  })

  it('permanently deletes a file via DELETE /v1/files/:id/purge', async () => {
    // 1. Purge the file
    const resPurge = await app.inject({
      method: 'DELETE',
      url: `/v1/files/${testFileId}/purge`,
      headers: { authorization: `Bearer ${token}` }
    })
    expect(resPurge.statusCode).toBe(204)

    // 2. Check if file is gone from DB
    const db = getDb()
    const [file] = await db.select().from(files).where(eq(files.id, testFileId)).limit(1)
    expect(file).toBeUndefined()
  })
})
