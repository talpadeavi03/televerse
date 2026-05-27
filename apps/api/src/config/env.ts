import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  TG_API_ID: z.coerce.number().positive(),
  TG_API_HASH: z.string().min(1),
  SESSION_ENCRYPTION_KEY: z.string().length(64),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  INTERNAL_SECRET: z.string().min(16),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

if (!parsed.data.GROQ_API_KEY && !parsed.data.OPENAI_API_KEY) {
  console.error('❌ Error: Either GROQ_API_KEY or OPENAI_API_KEY must be provided.')
  process.exit(1)
}

export const env = parsed.data
