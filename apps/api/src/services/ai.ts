import Groq from 'groq-sdk'
import OpenAI from 'openai'
import { getDb, aiMetadata, files } from '@televerse/db'
import { eq, sql } from 'drizzle-orm'
import { env } from '../config/env.js'

const TEXT_EXTRACTABLE = ['text/', 'application/pdf', 'application/json', 'application/xml']

function isTextExtractable(mimeType: string): boolean {
  return TEXT_EXTRACTABLE.some((p) => mimeType.startsWith(p))
}

function extractText(buffer: Buffer, mimeType: string): string {
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return buffer.toString('utf8').slice(0, 16000) // ~4000 tokens
  }
  return ''
}

const FILE_CATEGORY_MAP: Record<string, string[]> = {
  document: ['application/pdf', 'application/msword', 'text/'],
  image: ['image/'],
  video: ['video/'],
  audio: ['audio/'],
  archive: ['application/zip', 'application/gzip', 'application/x-tar'],
  code: ['application/javascript', 'application/typescript', 'text/x-python'],
}

function getFileCategory(mimeType: string): string {
  for (const [cat, prefixes] of Object.entries(FILE_CATEGORY_MAP)) {
    if (prefixes.some((p) => mimeType.startsWith(p))) return cat
  }
  return 'other'
}

export class AIService {
  private client: OpenAI | Groq | null = null
  private modelName: string = ''
  private db = getDb()
  private enabled = false

  constructor() {
    if (env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
      this.modelName = 'gpt-4o-mini'
      this.enabled = true
    } else if (env.GROQ_API_KEY) {
      this.client = new Groq({ apiKey: env.GROQ_API_KEY })
      this.modelName = 'llama-3.3-70b-versatile'
      this.enabled = true
    } else {
      console.warn('⚠️ AIService is disabled because neither OPENAI_API_KEY nor GROQ_API_KEY was provided.')
    }
  }

  async generateSummary(
    fileId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ summary: string | null; tags: string[] }> {
    const tags = [getFileCategory(mimeType)]
    let summary: string | null = null

    if (this.enabled && this.client && isTextExtractable(mimeType)) {
      const text = extractText(buffer, mimeType)
      if (text.length > 50) {
        try {
          const resp = await (this.client.chat.completions as any).create({
            model: this.modelName,
            messages: [
              { role: 'system', content: 'You are a concise file summarizer. Always respond with valid JSON.' },
              {
                role: 'user',
                content: `Analyze this document and respond with JSON: {"summary": "3 sentence summary", "tags": ["tag1", "tag2"]}.\n\nDocument:\n${text}`,
              },
            ],
            max_tokens: 500,
            temperature: 0.3,
          })

          const content = resp.choices[0]?.message?.content ?? ''
          const parsed = JSON.parse(content) as { summary?: string; tags?: string[] }
          summary = parsed.summary ?? null
          if (parsed.tags) tags.push(...parsed.tags.slice(0, 5))
        } catch {
          // AI failure is non-fatal
        }
      }
    }

    await this.db.insert(aiMetadata)
      .values({ fileId, summary, tags: [...new Set(tags)] })
      .onConflictDoUpdate({ target: aiMetadata.fileId, set: { summary, tags: [...new Set(tags)], generatedAt: new Date() } })

    return { summary, tags: [...new Set(tags)] }
  }

  async tagFile(fileId: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.generateSummary(fileId, buffer, mimeType)
  }

  async semanticSearch(userId: string, query: string): Promise<unknown[]> {
    // Text-based search via Postgres full-text search (pgvector optional upgrade)
    const rows = await this.db.execute(sql`
      SELECT f.id, f.name, f.mime_type, f.size_bytes, f.uploaded_at,
             am.summary, am.tags,
             ts_rank(to_tsvector('english', coalesce(f.name, '') || ' ' || coalesce(am.summary, '') || ' ' || coalesce(array_to_string(am.tags, ' '), '')),
                     plainto_tsquery('english', ${query})) as rank
      FROM files f
      LEFT JOIN ai_metadata am ON am.file_id = f.id
      WHERE f.user_id = ${userId}
        AND f.is_deleted = false
        AND to_tsvector('english', coalesce(f.name, '') || ' ' || coalesce(am.summary, '') || ' ' || coalesce(array_to_string(am.tags, ' '), ''))
            @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT 20
    `)
    return rows as unknown[]
  }

  async *chatWithFiles(
    message: string,
    fileRows: { name: string; mimeType: string | null }[],
    summaries: { summary: string | null; tags: string[] | null }[],
  ): AsyncIterable<string> {
    if (!this.enabled || !this.client) {
      yield 'AI feature is disabled. Please configure your OPENAI_API_KEY or GROQ_API_KEY environment variable.'
      return
    }

    const context = fileRows
      .map((f, i) => `File: ${f.name}\nSummary: ${summaries[i]?.summary ?? 'No summary'}\nTags: ${summaries[i]?.tags?.join(', ') ?? 'none'}`)
      .join('\n\n')

    const stream = await (this.client.chat.completions as any).create({
      model: this.modelName,
      stream: true,
      messages: [
        { role: 'system', content: 'You are an AI assistant analyzing files. Answer questions based on the file context provided.' },
        { role: 'user', content: `Files context:\n${context}\n\nQuestion: ${message}` },
      ],
      max_tokens: 1000,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) yield content
    }
  }
}
