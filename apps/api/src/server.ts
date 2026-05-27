import { buildApp } from './app.js'
import { env } from './config/env.js'

const app = await buildApp()

try {
  await app.listen({ port: env.PORT, host: env.HOST })
  console.info(`🚀 TeleVerse API running at http://${env.HOST}:${env.PORT}`)
  console.info(`📚 API Docs: http://${env.HOST}:${env.PORT}/docs`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close()
    process.exit(0)
  })
}
