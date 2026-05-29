// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  telegramPhone?: string
  telegramUserId?: bigint
  storageUsedBytes: bigint
  plan: 'free' | 'pro'
  createdAt: Date
}

// ─── Folder ───────────────────────────────────────────────────────────────────
export interface Folder {
  id: string
  userId: string
  name: string
  parentId: string | null
  color?: string
  icon?: string
  createdAt: Date
}

// ─── File ─────────────────────────────────────────────────────────────────────
export interface TeleFile {
  id: string
  userId: string
  folderId: string | null
  name: string
  sizeBytes: bigint
  mimeType: string | null
  sha256Hash: string | null
  tgMessageId: bigint | null
  tgMessageIds: bigint[]
  tgAccessHash: bigint | null
  uploadedAt: Date
  isDeleted: boolean
  isShared: boolean
  isStarred: boolean
  version: number
  aiMetadata?: AIMetadata
}

// ─── AI ───────────────────────────────────────────────────────────────────────
export interface AIMetadata {
  id: string
  fileId: string
  summary: string | null
  tags: string[]
  generatedAt: Date
  modelUsed: string
}

// ─── SharedLink ───────────────────────────────────────────────────────────────
export interface SharedLink {
  id: string
  fileId: string
  token: string
  passwordProtected: boolean
  expiresAt: Date | null
  downloadCount: number
  maxDownloads: number | null
  createdAt: Date
}

// ─── OAuth ────────────────────────────────────────────────────────────────────
export type OAuthScope =
  | 'files.read'
  | 'files.write'
  | 'folders.read'
  | 'folders.write'
  | 'ai.read'

export interface OAuthApp {
  id: string
  ownerUserId: string
  name: string
  clientId: string
  redirectUris: string[]
  scopes: OAuthScope[]
  createdAt: Date
}

// ─── API Response wrappers ────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  data: T
  meta?: PaginationMeta
}

export interface ApiError {
  error: string
  code: string
  statusCode: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  hasMore: boolean
  cursor?: string
}

// ─── Upload ───────────────────────────────────────────────────────────────────
export interface UploadProgress {
  fileId: string
  uploadedParts: number
  totalParts: number
  uploadedBytes: number
  totalBytes: number
  percentage: number
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error'
  error?: string
}

// ─── WebSocket events ─────────────────────────────────────────────────────────
export type WSEventType =
  | 'upload:progress'
  | 'upload:complete'
  | 'upload:error'
  | 'file:deleted'
  | 'session:expired'
  | 'ping'
  | 'pong'

export interface WSEvent<T = unknown> {
  type: WSEventType
  payload: T
  ts: number
}

// ─── Telegram auth ────────────────────────────────────────────────────────────
export interface TelegramAuthStep1 {
  phoneCodeHash: string
  sessionId: string
}

export interface TelegramAuthStep2 {
  sessionString: string
  telegramUserId: string
}
