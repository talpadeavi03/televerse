import { Redis } from 'ioredis'
import { env } from '../config/env.js'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (_redis) return _redis
  _redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  })
  _redis.on('error', (err) => console.error('Redis error:', err))
  return _redis
}
