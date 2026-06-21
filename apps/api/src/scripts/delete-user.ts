import { getDb, users } from '@televerse/db'
import { inArray } from 'drizzle-orm'

async function run() {
  const db = getDb()
  const emails = ['talpadeanjana74@gmail.com', 'talpadeavi0303@gmail.com']
  console.log(`[Startup Script] Deleting user records: ${emails.join(', ')}`)
  const res = await db.delete(users).where(inArray(users.email, emails)).returning()
  console.log('[Startup Script] Deleted users:', res)
  process.exit(0)
}

run().catch((err) => {
  console.error('[Startup Script] Error deleting user:', err)
  process.exit(1)
})
