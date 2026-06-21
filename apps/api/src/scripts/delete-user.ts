import { getDb, users } from '@televerse/db'
import { eq } from 'drizzle-orm'

async function run() {
  const db = getDb()
  const email = 'talpadeanjana74@gmail.com'
  console.log(`[Startup Script] Deleting user record: ${email}`)
  const res = await db.delete(users).where(eq(users.email, email)).returning()
  console.log('[Startup Script] Deleted users:', res)
  process.exit(0)
}

run().catch((err) => {
  console.error('[Startup Script] Error deleting user:', err)
  process.exit(1)
})
