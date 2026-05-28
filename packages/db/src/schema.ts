import {
  pgTable,
  uuid,
  text,
  bigint,
  boolean,
  integer,
  timestamp,
  pgEnum,
  index,
  unique,
  vector,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────
export const planEnum = pgEnum('plan', ['free', 'pro'])
export const oauthScopeEnum = pgEnum('oauth_scope', [
  'files.read',
  'files.write',
  'folders.read',
  'folders.write',
  'ai.read',
])

// ─── Tables ───────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  telegramPhone: text('telegram_phone'),
  telegramUserId: bigint('telegram_user_id', { mode: 'bigint' }),
  telegramSessionEncrypted: text('telegram_session_encrypted'),
  storageUsedBytes: bigint('storage_used_bytes', { mode: 'bigint' }).default(0),
  plan: planEnum('plan').default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    parentId: uuid('parent_id'),
    color: text('color'),
    icon: text('icon'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxFoldersUserId: index('idx_folders_user_id').on(t.userId),
    idxFoldersParentId: index('idx_folders_parent_id').on(t.parentId),
  }),
)

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => folders.id),
    name: text('name').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
    mimeType: text('mime_type'),
    sha256Hash: text('sha256_hash'),
    tgMessageId: bigint('tg_message_id', { mode: 'bigint' }),
    tgAccessHash: bigint('tg_access_hash', { mode: 'bigint' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow(),
    isDeleted: boolean('is_deleted').default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    isShared: boolean('is_shared').default(false),
    version: integer('version').default(1),
  },
  (t) => ({
    idxFilesUserId: index('idx_files_user_id').on(t.userId),
    idxFilesFolderId: index('idx_files_folder_id').on(t.folderId),
    idxFilesHash: index('idx_files_hash').on(t.sha256Hash),
    idxFilesUploadedAt: index('idx_files_uploaded_at').on(t.uploadedAt),
  }),
)

export const aiMetadata = pgTable('ai_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id')
    .notNull()
    .references(() => files.id, { onDelete: 'cascade' })
    .unique(),
  summary: text('summary'),
  tags: text('tags').array(),
  embedding: vector('embedding', { dimensions: 384 }),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
  modelUsed: text('model_used').default('llama-3.3-70b-versatile'),
})

export const sharedLinks = pgTable(
  'shared_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    passwordHash: text('password_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    downloadCount: integer('download_count').default(0).notNull(),
    maxDownloads: integer('max_downloads'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqueSharedLinkToken: unique('unique_shared_link_token').on(t.token),
  }),
)

export const oauthApps = pgTable(
  'oauth_apps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    clientId: text('client_id').notNull(),
    clientSecretHash: text('client_secret_hash').notNull(),
    redirectUris: text('redirect_uris').array(),
    scopes: text('scopes').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqueOauthClientId: unique('unique_oauth_client_id').on(t.clientId),
  }),
)

export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  appId: uuid('app_id')
    .notNull()
    .references(() => oauthApps.id, { onDelete: 'cascade' }),
  accessTokenHash: text('access_token_hash').notNull().unique(),
  refreshTokenHash: text('refresh_token_hash').unique(),
  scopes: text('scopes').array(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const uploadJobs = pgTable('upload_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id'),
  status: text('status').default('pending'),
  totalParts: integer('total_parts'),
  uploadedParts: integer('uploaded_parts').default(0),
  tgFileId: text('tg_file_id'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  folders: many(folders),
  files: many(files),
  oauthApps: many(oauthApps),
  oauthTokens: many(oauthTokens),
}))

export const foldersRelations = relations(folders, ({ one, many }) => ({
  user: one(users, { fields: [folders.userId], references: [users.id] }),
  parent: one(folders, { fields: [folders.parentId], references: [folders.id] }),
  children: many(folders),
  files: many(files),
}))

export const filesRelations = relations(files, ({ one, many }) => ({
  user: one(users, { fields: [files.userId], references: [users.id] }),
  folder: one(folders, { fields: [files.folderId], references: [folders.id] }),
  aiMetadata: one(aiMetadata, { fields: [files.id], references: [aiMetadata.fileId] }),
  sharedLinks: many(sharedLinks),
}))
