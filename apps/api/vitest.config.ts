import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', '../../packages/*/tests/**/*.test.ts'],
    env: {
      DATABASE_URL: 'postgresql://televerse:televerse@localhost:5432/televerse_test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-secret-32-chars-minimum-here',
      SESSION_ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
      TG_API_ID: '12345',
      TG_API_HASH: 'test_hash',
      GROQ_API_KEY: 'test_key',
      INTERNAL_SECRET: 'test-internal-secret-16chars',
      NODE_ENV: 'test'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
