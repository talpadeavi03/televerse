import { Queue, Worker, QueueEvents } from 'bullmq'
import { env } from '../config/env.js'

// BullMQ bundles its own ioredis — pass connection URL string to avoid
// type conflicts between BullMQ's ioredis and our app's ioredis versions.
export function getQueueConnectionOpts() {
  return { connection: { url: env.REDIS_URL } }
}

// ─── Queue names ─────────────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  UPLOAD: 'televerse-upload',
  AI_TAG: 'televerse-ai-tag',
} as const

// ─── Queue singletons ────────────────────────────────────────────────────────
let _uploadQueue: Queue | null = null
let _aiTagQueue: Queue | null = null

export function getUploadQueue(): Queue {
  if (!_uploadQueue) {
    _uploadQueue = new Queue(QUEUE_NAMES.UPLOAD, {
      ...getQueueConnectionOpts(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    })
    _uploadQueue.on('error', (err) => console.error('[UploadQueue] error:', err))
  }
  return _uploadQueue
}

export function getAiTagQueue(): Queue {
  if (!_aiTagQueue) {
    _aiTagQueue = new Queue(QUEUE_NAMES.AI_TAG, {
      ...getQueueConnectionOpts(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    })
    _aiTagQueue.on('error', (err) => console.error('[AiTagQueue] error:', err))
  }
  return _aiTagQueue
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
export async function closeQueues(): Promise<void> {
  await Promise.allSettled([
    _uploadQueue?.close(),
    _aiTagQueue?.close(),
  ])
}

export { Queue, Worker, QueueEvents }
