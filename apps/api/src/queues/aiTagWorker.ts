import { Worker, type Job } from 'bullmq'
import { AIService } from '../services/ai.js'
import { getQueueConnectionOpts, QUEUE_NAMES } from './index.js'

export interface AiTagJobData {
  fileId: string
  userId: string
  filename: string
  mimeType: string
}

export function createAiTagWorker(): Worker {
  const ai = new AIService()

  const worker = new Worker<AiTagJobData>(
    QUEUE_NAMES.AI_TAG,
    async (job: Job<AiTagJobData>) => {
      const { fileId, filename, mimeType } = job.data

      try {
        // tagFile handles its own DB update for ai_metadata
        // We pass an empty buffer since we only have filename/mimeType at this point
        await ai.tagFile(fileId, Buffer.alloc(0), mimeType)
      } catch (err) {
        // AI tagging is non-fatal
        console.warn(`[AiTagWorker] Tagging failed for file ${fileId}:`, (err as Error).message)
      }
    },
    {
      ...getQueueConnectionOpts(),
      concurrency: 5,
    },
  )

  worker.on('error', (err) => console.error('[AiTagWorker] error:', err))

  return worker
}
