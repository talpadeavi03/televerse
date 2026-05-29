import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  const url = process.env['DATABASE_URL']
  if (!url) {
    console.error('❌ DATABASE_URL is not set')
    process.exit(1)
  }

  console.log('⏳ Running database migrations from infra/migrations...')
  
  // Connect to the database with max 1 connection for migrations
  const sql = postgres(url, { max: 1 })
  const db = drizzle(sql)

  // Path to the SQL migrations directory relative to this file
  const migrationsFolder = join(__dirname, '../../../infra/migrations')

  try {
    await migrate(db, { migrationsFolder })
    console.log('✓ Database migrations applied successfully!')
    await sql.end()
    process.exit(0)
  } catch (err: any) {
    console.error('❌ Database migration failed:', err.message)
    await sql.end()
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('❌ Uncaught migration error:', err)
  process.exit(1)
})
