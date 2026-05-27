import type { TeleFile, Folder, ApiResponse, PaginationMeta } from '@televerse/types'

interface TeleVerseConfig {
  accessToken: string
  baseUrl?: string
}

type ListFilesOptions = {
  folderId?: string
  search?: string
  page?: number
  limit?: number
  sort?: 'name' | 'size' | 'date'
  order?: 'asc' | 'desc'
}

class FilesAPI {
  constructor(private client: TeleVerseClient) {}

  async list(opts: ListFilesOptions = {}): Promise<{ data: TeleFile[]; meta: PaginationMeta }> {
    const params = new URLSearchParams(Object.entries(opts).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    return this.client.request(`/v1/files?${params}`)
  }

  async get(id: string): Promise<ApiResponse<TeleFile>> {
    return this.client.request(`/v1/files/${id}`)
  }

  async upload(file: Blob | File, opts: { name?: string; folderId?: string } = {}): Promise<ApiResponse<TeleFile>> {
    const formData = new FormData()
    formData.append('file', file, opts.name ?? (file instanceof File ? file.name : 'file'))
    if (opts.folderId) formData.append('folderId', opts.folderId)
    return this.client.request('/v1/files/upload', 'POST', formData)
  }

  async download(id: string): Promise<Blob> {
    const res = await fetch(`${this.client.baseUrl}/v1/files/${id}/download`, {
      headers: { Authorization: `Bearer ${this.client.token}` },
    })
    if (!res.ok) throw new Error('Download failed')
    return res.blob()
  }

  async delete(id: string): Promise<void> {
    return this.client.request(`/v1/files/${id}`, 'DELETE')
  }

  async move(id: string, folderId: string | null): Promise<void> {
    return this.client.request(`/v1/files/${id}/move`, 'PATCH', { folderId })
  }
}

class FoldersAPI {
  constructor(private client: TeleVerseClient) {}

  async list(parentId?: string): Promise<ApiResponse<Folder[]>> {
    const url = parentId ? `/v1/folders?parentId=${parentId}` : '/v1/folders'
    return this.client.request(url)
  }

  async create(name: string, opts: { parentId?: string; color?: string; icon?: string } = {}): Promise<ApiResponse<Folder>> {
    return this.client.request('/v1/folders', 'POST', { name, ...opts })
  }

  async delete(id: string): Promise<void> {
    return this.client.request(`/v1/folders/${id}`, 'DELETE')
  }
}

class AIAPI {
  constructor(private client: TeleVerseClient) {}

  async summarize(fileId: string): Promise<{ summary: string | null; tags: string[] }> {
    return this.client.request(`/v1/ai/summary/${fileId}`)
  }

  async search(query: string): Promise<{ data: TeleFile[] }> {
    return this.client.request(`/v1/ai/search?q=${encodeURIComponent(query)}`)
  }
}

export class TeleVerseClient {
  readonly baseUrl: string
  readonly token: string
  readonly files: FilesAPI
  readonly folders: FoldersAPI
  readonly ai: AIAPI

  constructor(config: TeleVerseConfig) {
    this.token = config.accessToken
    this.baseUrl = config.baseUrl ?? 'https://api.televerse.app'
    this.files = new FilesAPI(this)
    this.folders = new FoldersAPI(this)
    this.ai = new AIAPI(this)
  }

  async request<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    }

    let fetchBody: BodyInit | undefined
    if (body instanceof FormData) {
      fetchBody = body
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      fetchBody = JSON.stringify(body)
    }

    const res = await fetch(`${this.baseUrl}${path}`, { method, headers, body: fetchBody })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? `Request failed with status ${res.status}`)
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }
}

// Named export alias for ergonomics
export const televerse = TeleVerseClient
