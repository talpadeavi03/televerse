import { Worker, type Job, DelayedError } from 'bullmq'
import { getDb, files } from '@televerse/db'
import { eq } from 'drizzle-orm'
import { TelegramService } from '../services/telegram.js'
import { AIService } from '../services/ai.js'
import { wsManager } from '../services/wsManager.js'
import { getQueueConnectionOpts, getAiTagQueue, QUEUE_NAMES } from './index.js'

// ─── Job payload types ────────────────────────────────────────────────────────
export interface UploadJobData {
  fileId: string         // UUID of the files row (already inserted as 'pending')
  userId: string
  encryptedSession: string
  buffer: number[]       // Buffer serialised to array for JSON transport
  filename: string
  mimeType: string
}

export interface UploadJobResult {
  tgMessageId: string
}

// ─── Flood-wait helper ────────────────────────────────────────────────────────
function parseFloodWait(err: unknown): number | null {
  const msg = (err as any)?.message ?? ''
  const match = msg.match(/FLOOD_WAIT_(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

// ─── Worker processor ─────────────────────────────────────────────────────────
export function createUploadWorker(): Worker {
  const tg = new TelegramService()
  const db = getDb()

  const worker = new Worker<UploadJobData, UploadJobResult>(
    QUEUE_NAMES.UPLOAD,
    async (job: Job<UploadJobData, UploadJobResult>, token?: string) => {
      const { fileId, userId, encryptedSession, buffer, filename, mimeType } = job.data
      const buf = Buffer.from(buffer)

      // ── Mark as uploading ────────────────────────────────────────────────
      await db.update(files)
        .set({ uploadStatus: 'uploading' })
        .where(eq(files.id, fileId))

      wsManager.sendToUser(userId, { type: 'upload:progress', payload: { fileId, stage: 'uploading', percent: 0 }, ts: Date.now() })

      try {
        // ── Upload to Telegram with progress ──────────────────────────────
        const msgId = await tg.uploadFile(encryptedSession, {
          buffer: buf,
          filename,
          mimeType,
          onProgress: (p) => {
            job.updateProgress(p.percentage)
            wsManager.sendToUser(userId, {
              type: 'upload:progress',
              payload: { fileId, stage: 'uploading', percent: p.percentage },
              ts: Date.now(),
            })
          },
        })

        // ── Persist tg_message_id, mark done ─────────────────────────────
        await db.update(files)
          .set({
            tgMessageId: BigInt(msgId),
            uploadStatus: 'done',
          })
          .where(eq(files.id, fileId))

        wsManager.sendToUser(userId, { type: 'upload:complete', payload: { fileId }, ts: Date.now() })

        // ── Enqueue AI tagging as follow-on job ───────────────────────────
        await getAiTagQueue().add('tag', { fileId, userId, filename, mimeType }, {
          jobId: `ai-tag:${fileId}`,
        })

        return { tgMessageId: msgId.toString() }

      } catch (err: unknown) {
        // ── Handle FLOOD_WAIT: delay manually using DelayedError ──────
        const waitSecs = parseFloodWait(err)
        if (waitSecs) {
          console.warn(`[UploadWorker] FLOOD_WAIT_${waitSecs}s for file ${fileId} — will retry after delay`)
          wsManager.sendToUser(userId, { type: 'upload:flood_wait', payload: { fileId, waitSecs }, ts: Date.now() })
          await job.moveToDelayed(Date.now() + waitSecs * 1000 + 1000, token)
          throw new DelayedError()
        }

        // ── Any other error: mark failed, notify client ───────────────────
        await db.update(files)
          .set({ uploadStatus: 'failed' })
          .where(eq(files.id, fileId))

        wsManager.sendToUser(userId, { type: 'upload:error', payload: { fileId, error: (err as Error).message }, ts: Date.now() })
        throw err
      }
    },
    {
      ...getQueueConnectionOpts(),
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 5000,
      },
    },
  )

  worker.on('failed', (job, err) => {
    console.error(`[UploadWorker] Job ${job?.id} permanently failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[UploadWorker] Worker error:', err)
  })

  return worker
}
