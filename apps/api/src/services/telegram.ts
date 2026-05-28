import { TelegramClient } from 'gramjs'
import { StringSession } from 'gramjs/sessions/index.js'
import { Api } from 'gramjs'
import type { Readable } from 'stream'
import pLimit from 'p-limit'
import { env } from '../config/env.js'
import { encryptAES256GCM, decryptAES256GCM, chunkBuffer, withRetry, sleep } from '@televerse/shared'
import type { UploadProgress } from '@televerse/types'

const CONCURRENCY = 4
const PART_SIZE = 512 * 1024 // 512 KB

interface PendingSession {
  client: TelegramClient
  phoneCodeHash: string
  sessionId: string
}

// Temporary in-memory store for auth sessions (keyed by sessionId)
const pendingSessions = new Map<string, PendingSession>()

export class TelegramService {
  async sendCode(phone: string): Promise<{ phoneCodeHash: string; sessionId: string }> {
    const session = new StringSession('')
    const client = new TelegramClient(session, env.TG_API_ID, env.TG_API_HASH, {
      connectionRetries: 5,
      deviceModel: 'TeleVerse Web Client',
      appVersion: '1.0.0',
      systemVersion: 'Linux',
    })

    await client.connect()
    const result = await client.sendCode({ apiId: env.TG_API_ID, apiHash: env.TG_API_HASH }, phone)

    const sessionId = crypto.randomUUID()
    pendingSessions.set(sessionId, { client, phoneCodeHash: result.phoneCodeHash, sessionId })

    // Clean up after 10 minutes
    setTimeout(() => { pendingSessions.delete(sessionId); client.disconnect().catch(() => {}) }, 10 * 60 * 1000)

    return { phoneCodeHash: result.phoneCodeHash, sessionId }
  }

  async signIn(params: {
    sessionId: string
    phone: string
    phoneCodeHash: string
    code: string
    password?: string
  }): Promise<{ telegramUserId: string; encryptedSession: string }> {
    const pending = pendingSessions.get(params.sessionId)
    if (!pending) throw Object.assign(new Error('Session expired or not found'), { statusCode: 400 })

    const { client } = pending

    try {
      if (params.password) {
        await (client as any).signInWithPassword(
          { apiId: env.TG_API_ID, apiHash: env.TG_API_HASH },
          { password: async () => params.password! }
        )
      } else {
        await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: params.phone,
            phoneCodeHash: params.phoneCodeHash,
            phoneCode: params.code,
          })
        )
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('SESSION_PASSWORD_NEEDED')) {
        throw Object.assign(new Error('Two-factor authentication required'), { statusCode: 428, code: 'TFA_REQUIRED' })
      }
      if (errMsg.includes('PHONE_CODE_INVALID')) {
        throw Object.assign(new Error('The verification code is invalid'), { statusCode: 400, code: 'PHONE_CODE_INVALID' })
      }
      if (errMsg.includes('PHONE_CODE_EXPIRED')) {
        throw Object.assign(new Error('The verification code has expired'), { statusCode: 400, code: 'PHONE_CODE_EXPIRED' })
      }
      if (errMsg.includes('PASSWORD_HASH_INVALID')) {
        throw Object.assign(new Error('The 2FA password is incorrect'), { statusCode: 400, code: 'PASSWORD_HASH_INVALID' })
      }
      throw err
    }

    const me = await client.getMe()
    const sessionString = client.session.save() as unknown as string
    const encryptedSession = encryptAES256GCM(sessionString, env.SESSION_ENCRYPTION_KEY)

    pendingSessions.delete(params.sessionId)
    await client.disconnect()

    return { telegramUserId: (me as any).id.toString(), encryptedSession }
  }

  private async getClient(encryptedSession: string): Promise<TelegramClient> {
    const sessionString = decryptAES256GCM(encryptedSession, env.SESSION_ENCRYPTION_KEY)
    const session = new StringSession(sessionString)
    const client = new TelegramClient(session, env.TG_API_ID, env.TG_API_HASH, {
      connectionRetries: 5,
      deviceModel: 'TeleVerse Web Client',
      appVersion: '1.0.0',
      systemVersion: 'Linux',
    })
    await client.connect()
    return client
  }

  async uploadFile(
    encryptedSession: string,
    opts: {
      buffer: Buffer
      filename: string
      mimeType: string
      onProgress?: (p: UploadProgress) => void
    },
  ): Promise<number> {
    const client = await this.getClient(encryptedSession)
    const limit = pLimit(CONCURRENCY)

    try {
      const parts = chunkBuffer(opts.buffer)
      const totalParts = parts.length
      const fileId = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
      const isBig = opts.buffer.length > 10 * 1024 * 1024
      let uploadedParts = 0

      await Promise.all(
        parts.map((part, i) =>
          limit(() =>
            withRetry(async () => {
              if (isBig) {
                await client.invoke(new Api.upload.SaveBigFilePart({ fileId: fileId as any, filePart: i, fileTotalParts: totalParts, bytes: part }))
              } else {
                await client.invoke(new Api.upload.SaveFilePart({ fileId: fileId as any, filePart: i, bytes: part }))
              }
              uploadedParts++
              opts.onProgress?.({
                fileId: fileId.toString(),
                uploadedParts,
                totalParts,
                uploadedBytes: uploadedParts * PART_SIZE,
                totalBytes: opts.buffer.length,
                percentage: Math.round((uploadedParts / totalParts) * 100),
                status: uploadedParts < totalParts ? 'uploading' : 'processing',
              })
              // Jitter to avoid flood wait
              await sleep(50 + Math.random() * 150)
            })
          ),
        ),
      )

      const inputFile = isBig
        ? new Api.InputFileBig({ id: fileId as any, parts: totalParts, name: opts.filename })
        : new Api.InputFile({ id: fileId as any, parts: totalParts, name: opts.filename, md5Checksum: '' })

      const result = await client.invoke(new Api.messages.SendMedia({
        peer: new Api.InputPeerSelf(),
        media: new Api.InputMediaUploadedDocument({
          file: inputFile,
          mimeType: opts.mimeType,
          attributes: [new Api.DocumentAttributeFilename({ fileName: opts.filename })],
        }),
        message: opts.filename,
        randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) as any,
      }))

      let msgId: number | undefined;

      if (result) {
        if (typeof (result as any).id === 'number') {
          msgId = (result as any).id;
        } else if ((result as any).updates && Array.isArray((result as any).updates)) {
          for (const u of (result as any).updates) {
            if (u.message && typeof u.message.id === 'number') {
              msgId = u.message.id;
              break;
            }
            if (typeof u.id === 'number') {
              msgId = u.id;
              break;
            }
          }
        }
      }

      if (!msgId) {
        console.warn('⚠️ Could not extract message ID directly from Updates. Falling back to latest messages check.');
        try {
          const messages = await client.getMessages(new Api.InputPeerSelf(), { limit: 1 });
          if (messages && messages.length > 0) {
            msgId = messages[0].id;
          }
        } catch (e: any) {
          console.error('Failed to fetch latest messages fallback:', e.message);
        }
      }

      if (!msgId) throw new Error('Failed to get message ID after upload');

      return msgId;
    } finally {
      await client.disconnect()
    }
  }

  async downloadFile(encryptedSession: string, messageId: bigint): Promise<Readable> {
    const client = await this.getClient(encryptedSession)
    // GramJS streams the file — wrap in a Readable
    const buffer = await client.downloadMedia(
      new Api.InputMessageID({ id: Number(messageId) }) as any,
      {},
    ) as Buffer
    await client.disconnect()

    const { Readable } = await import('stream')
    return Readable.from(buffer)
  }

  async downloadToBuffer(encryptedSession: string, messageId: bigint): Promise<Buffer> {
    const client = await this.getClient(encryptedSession)
    const buffer = await client.downloadMedia(
      new Api.InputMessageID({ id: Number(messageId) }) as any,
      {},
    ) as Buffer
    await client.disconnect()
    return buffer
  }

  async deleteMessage(encryptedSession: string, messageId: bigint): Promise<void> {
    const client = await this.getClient(encryptedSession)
    await client.invoke(new Api.messages.DeleteMessages({ id: [Number(messageId)], revoke: true }))
    await client.disconnect()
  }
}
