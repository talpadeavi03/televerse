# televerse — Complete Product & Engineering Documentation
> Version 1.0 | Status: Pre-build planning | Stack: Node.js + GramJS + Cloudflare + Supabase

---

## Table of Contents

1. [What is televerse](#1-what-is-televerse)
2. [Legal Framework — Staying Safe Forever](#2-legal-framework)
3. [Architecture Overview](#3-architecture-overview)
4. [Core Features](#4-core-features)
5. [AI Layer](#5-ai-layer)
6. [Third-Party API (SDK)](#6-third-party-api)
7. [Tech Stack — Every Component](#7-tech-stack)
8. [Authentication Flow](#8-authentication-flow)
9. [File Operations — Upload / Download / Delete](#9-file-operations)
10. [Chunking Strategy](#10-chunking-strategy)
11. [Metadata & Database Schema](#11-database-schema)
12. [Rate Limiting & Throttling Strategy](#12-rate-limiting)
13. [100 Challenges & Mitigations](#13-100-challenges)
14. [Build Order — Phase by Phase](#14-build-order)
15. [Environment Variables](#15-environment-variables)

---

## 1. What is televerse

televerse is a **Telegram-powered file manager** — a full-featured cloud drive interface built on top of the Telegram MTProto API. Think OneDrive or Google Drive, but with Telegram as the storage engine.

Every user's files live in **their own Telegram account** (Saved Messages + private channels). televerse is the client layer — a clean web UI and REST API that talks to Telegram on the user's behalf via MTProto, the same protocol official Telegram apps use.

### What makes it different

| Feature | Google Drive | OneDrive | televerse |
|---|---|---|---|
| Storage | 15 GB free | 5 GB free | Unlimited free |
| Cost to user | Free / paid | Free / paid | Zero forever |
| File size | 5 TB | 250 GB | 2 GB per chunk |
| Third-party API | Yes | Yes | Yes (built-in) |
| AI file intelligence | Limited | Limited | Full (summaries, search, tags) |
| Open source | No | No | Yes |

---

## 2. Legal Framework

### Why this is legal — the key distinction

The Telegram **Bot API ToS** (the one that bans cloud storage) governs bots only — accounts created via BotFather that authenticate with a token. televerse does **not** use bots.

televerse uses the **Telegram MTProto Client API** (core.telegram.org/api/terms), which governs third-party Telegram clients. This is the same API used by:
- Nicegram
- Telegram X
- Plus Messenger
- Nekogram
- Every alternative Telegram client in existence

The MTProto ToS says: *"We welcome all developers to use our API and source code to create Telegram-like messaging applications."*

### The 7 Rules We Follow — Non-Negotiable

These rules keep televerse permanently legal and keep accounts unbanned.

**Rule 1 — We are a messaging client, not a storage service.**
televerse's public-facing description is: *"A Telegram client with advanced file management."* Not: *"Free cloud storage powered by Telegram."* This distinction matters legally and linguistically.

**Rule 2 — Files belong to the user, not to us.**
Every file lives in the user's own Telegram account. We never store files on our servers. Our database holds only metadata (filename, message_id, size). We are a UI layer, not a storage provider.

**Rule 3 — We get our own api_id and api_hash from my.telegram.org.**
Required by MTProto ToS section 2.1. This registers televerse as a legitimate Telegram application.

**Rule 4 — Users must be told they are using the Telegram API.**
Required by MTProto ToS section 2.2. televerse's onboarding, app store descriptions, and settings page all state: *"televerse uses the Telegram API to store and manage your files in your Telegram account."*

**Rule 5 — We do not use the word "Telegram" in our app title.**
MTProto ToS section 2.3. Our name is televerse — not "Telegram Drive" or "Telegram Storage."

**Rule 6 — We respect all rate limits.**
MTProto ToS section 1.4. We never attempt to circumvent Telegram's flood limits. We have a built-in rate limiter and queue system.

**Rule 7 — We do not scrape or aggregate user data.**
MTProto ToS section 4.3 (Bot ToS, extended as good practice). We only access data the user explicitly gives us access to.

### Legal Paper Trail to Keep

- Registration at my.telegram.org with a real app name and description
- Privacy policy clearly stating Telegram is the storage backend
- Terms of service stating this is a Telegram client application
- Never market as "bypass Telegram limits" or "free unlimited storage"

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    televerse Platform                       │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  Web UI          │    │  televerse REST API          │   │
│  │  (Cloudflare     │───▶│  (Cloudflare Worker)         │   │
│  │   Pages)         │    │                              │   │
│  └─────────────────┘    └──────────────┬───────────────┘   │
│                                        │                    │
│  ┌─────────────────────────────────────▼──────────────┐    │
│  │              Core Services Layer                    │    │
│  │                                                     │    │
│  │  ┌───────────┐ ┌──────────┐ ┌─────────────────┐   │    │
│  │  │  MTProto  │ │ Chunker  │ │   AI Engine      │   │    │
│  │  │  Manager  │ │ Service  │ │ (file summaries) │   │    │
│  │  └─────┬─────┘ └────┬─────┘ └────────┬────────┘   │    │
│  │        │            │                │             │    │
│  └────────┼────────────┼────────────────┼─────────────┘    │
│           │            │                │                   │
│  ┌────────▼────────────▼────────────────▼──────────────┐   │
│  │                  Supabase                           │    │
│  │  users | files | chunks | folders | ai_metadata    │    │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │  MTProto (GramJS)
                           ▼
              ┌────────────────────────┐
              │   Telegram Servers     │
              │                        │
              │  User A: Saved Msgs   │
              │  User B: Saved Msgs   │
              │  User C: Saved Msgs   │
              │  (each user's own     │
              │   Telegram account)   │
              └────────────────────────┘
```

### Component Responsibilities

| Component | Technology | Role |
|---|---|---|
| Web UI | Cloudflare Pages + React | File manager interface |
| API Gateway | Cloudflare Worker | Auth, routing, request handling |
| MTProto Manager | Node.js + GramJS (Railway) | Telegram session management |
| Chunker Service | Node.js (Railway) | Split/reassemble files |
| AI Engine | Groq (llama-3.3-70b) | File summaries, search, tagging |
| Database | Supabase Postgres | File metadata, sessions, folders |
| Session Store | Supabase (encrypted) | Telegram session strings per user |
| Third-party API | Cloudflare Worker | OAuth + file access for external apps |

---

## 4. Core Features

### 4.1 File Manager (OneDrive-like UI)

- Drag-and-drop upload
- Folder creation (virtual — implemented via metadata, not Telegram folders)
- File preview (images, video, PDF, text)
- Multi-select, bulk operations
- File sharing via signed links
- File versioning (keep previous uploads tagged in DB)
- Search by filename, type, date, size
- Sort by name / date / size / type
- Storage usage bar (tracks bytes stored across all uploads)

### 4.2 Folder System

Telegram has no native folder structure for Saved Messages. televerse implements virtual folders entirely in Supabase:

```sql
folders: id, user_id, name, parent_id, created_at
files:   id, user_id, folder_id, name, size, tg_message_ids[], ...
```

To the user it looks exactly like a real file system. Under the hood every file is just message(s) in their Saved Messages with metadata in our DB.

### 4.3 File Sharing

- Generate a signed URL: `televerse.app/s/{token}`
- Configurable expiry (1 hour / 1 day / 7 days / never)
- Optional password protection
- Download count tracking
- Revocable at any time

### 4.4 Multi-format Preview

| File type | Preview method |
|---|---|
| Images (jpg/png/webp/gif) | Direct render in browser |
| Video (mp4/webm) | Stream via proxy endpoint |
| PDF | PDF.js inline viewer |
| Text / Markdown / Code | Syntax-highlighted viewer |
| Audio (mp3/wav) | HTML5 audio player |
| Others | Download only |

---

## 5. AI Layer

All AI runs on **Groq** (free tier, llama-3.3-70b-versatile) — zero cost.

### 5.1 File Summary

When a user uploads a text file, PDF, or document:
1. Extract text content (first 4000 tokens)
2. Send to Groq: *"Summarize this document in 3 sentences."*
3. Store summary in `ai_metadata` table
4. Show inline in file manager as a tooltip / expanded view

### 5.2 Folder Summary

When user opens a folder:
- Aggregate filenames + individual summaries
- Generate: *"This folder contains X files including reports on Y and Z..."*
- Cached — regenerates only when folder contents change

### 5.3 Smart Search

Beyond filename search — semantic search across file summaries:
1. On upload, generate embedding (Cloudflare AI `@cf/baai/bge-small-en-v1.5` — free)
2. Store vector in Supabase `pgvector` extension
3. Search query → embed → cosine similarity → ranked results

User types: *"find the tax documents from last year"*
System finds: files named `Q4_2024_accounts.pdf`, `tax_summary.xlsx` etc.

### 5.4 Auto-Tagging

On upload, AI assigns tags automatically:
- File type category (document, image, video, code, archive)
- Content tags (e.g. "finance", "legal", "photo", "report")
- Stored in `files.ai_tags[]` column
- Filterable in UI

### 5.5 AI Chat with Files

User selects file(s) → clicks "Ask AI" → chat interface opens:
- *"What is this contract about?"*
- *"List all dates mentioned in this document"*
- *"Compare these two files"*

Uses Groq streaming for real-time responses.

### 5.6 Duplicate Detection

On upload, compute SHA-256 hash of file. Check against existing hashes in DB per user. If duplicate found → show warning, offer to skip or replace. Prevents wasted Telegram storage.

---

## 6. Third-Party API

televerse ships with a public REST API so any app can integrate televerse storage — like Google Drive's API or OneDrive's API.

### 6.1 OAuth 2.0 Flow

```
Developer registers app → gets client_id + client_secret
User clicks "Connect televerse" in third-party app
→ Redirect to televerse.app/oauth/authorize?client_id=X&scope=files.read
→ User approves
→ Redirect back with authorization code
→ Exchange code for access_token + refresh_token
→ Third-party app uses Bearer token to call televerse API
```

### 6.2 API Endpoints

```
GET    /v1/files                    List files (with pagination)
GET    /v1/files/{id}               Get file metadata
GET    /v1/files/{id}/download      Download file
POST   /v1/files/upload             Upload file
DELETE /v1/files/{id}               Delete file
GET    /v1/folders                  List folders
POST   /v1/folders                  Create folder
GET    /v1/search?q={query}         Search files
GET    /v1/storage/usage            Get storage stats
GET    /v1/files/{id}/summary       Get AI summary of file
```

### 6.3 Scopes

| Scope | Permission |
|---|---|
| `files.read` | List and download files |
| `files.write` | Upload and delete files |
| `folders.read` | List folders |
| `folders.write` | Create/delete folders |
| `ai.read` | Access AI summaries and tags |

### 6.4 SDK (JavaScript)

```javascript
import { televerse } from '@televerse/sdk'

const tv = new televerse({ accessToken: 'your_token' })

// List files
const files = await tv.files.list({ folder: 'documents' })

// Upload
await tv.files.upload({ file: myBlob, name: 'report.pdf', folder: 'work' })

// Download
const blob = await tv.files.download('file_id_here')

// AI summary
const summary = await tv.ai.summarize('file_id_here')
```

---

## 7. Tech Stack

### Full Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind | Fast, familiar, Cloudflare Pages compatible |
| API | Cloudflare Worker (TypeScript) | Free, global edge, zero cold start |
| MTProto Engine | Node.js + GramJS on Railway | GramJS is the best JS MTProto library, Railway free tier |
| Database | Supabase Postgres | Free, powerful, pgvector support |
| Session Store | Supabase (AES-256 encrypted) | Session strings stored encrypted per user |
| AI | Groq (llama-3.3-70b) | Fastest, free tier |
| Embeddings | Cloudflare AI bge-small | Free, no API key needed |
| File streaming | Cloudflare Worker | Proxy downloads without exposing Telegram URLs |
| Auth | Supabase Auth | Free, email + OAuth |
| CI/CD | GitHub Actions | Free |
| Monitoring | Cloudflare Analytics + Supabase logs | Free |

### Why GramJS over Telethon

- Runs in Node.js and browser — compatible with Cloudflare Workers edge
- TypeScript native — type safety throughout
- Actively maintained as of 2025
- Session string support — store user sessions as encrypted strings in DB
- Full MTProto support — upload.saveFilePart, upload.getFile etc.

---

## 8. Authentication Flow

### 8.1 televerse Account Creation

```
User visits televerse.app/signup
→ Enter email + password
→ Supabase Auth creates account
→ Redirect to Telegram connect step
```

### 8.2 Telegram Account Link (one-time, required)

```
User enters their Telegram phone number
→ televerse backend calls: client.sendCode(phone)
→ Telegram sends OTP to user's Telegram app (or SMS)
→ User enters OTP in televerse UI
→ televerse calls: client.signIn(phone, phoneCodeHash, code)
→ Session string generated and stored: AES-256 encrypted in Supabase
→ User never needs to do this again
```

This is exactly the same login flow as any other Telegram client app (Nicegram, Telegram Desktop, etc.). The user is logging into their own Telegram account through televerse's client.

### 8.3 Session Management

- Session strings are stored per user, encrypted with a server-side key
- Decrypted only when a user makes an authenticated API request
- Sessions are valid indefinitely unless user revokes them in Telegram Settings → Active Sessions
- If session expires, user is prompted to re-link their Telegram account
- Multiple device sessions supported (Telegram allows multiple concurrent sessions)

### 8.4 Security Guarantees

- We never see or store the user's Telegram password
- We never see the OTP after it's used
- Session string = a cryptographic token, not a password
- Users can revoke televerse's access at any time from Telegram Settings
- Session strings encrypted at rest with AES-256-GCM
- Encryption key stored separately from data (different env var, different access)

---

## 9. File Operations

### 9.1 Upload Flow

```
User selects file in UI
→ File sent to Cloudflare Worker /upload endpoint
→ Worker authenticates user, retrieves session string from Supabase
→ Worker sends file to MTProto Engine (Railway) via internal API
→ MTProto Engine chunks file into 512KB parts
→ Each part uploaded via upload.saveFilePart (GramJS)
→ After all parts: messages.sendMedia to Saved Messages
→ Telegram returns message_id
→ MTProto Engine sends message_id back to Worker
→ Worker writes file metadata to Supabase:
   { user_id, name, size, mime_type, tg_message_id, folder_id, hash }
→ AI tagging job queued (async)
→ Response: { file_id, name, size, url }
```

### 9.2 Download Flow

```
User clicks download
→ Request hits Cloudflare Worker /download/{file_id}
→ Worker looks up tg_message_id in Supabase
→ Worker sends request to MTProto Engine
→ MTProto Engine calls messages.getMessages to get file reference
→ Calls upload.getFile in 1MB chunks
→ Streams chunks back through Worker to user's browser
→ User sees a standard browser download
```

The Telegram CDN URL is never exposed to the user or browser. Everything proxies through televerse's Worker.

### 9.3 Delete Flow

```
User deletes file
→ Worker finds tg_message_id in Supabase
→ MTProto Engine calls messages.deleteMessages([message_id])
→ Message deleted from user's Telegram Saved Messages
→ File record deleted from Supabase
→ AI metadata deleted
→ Shared links for this file invalidated
```

---

## 10. Chunking Strategy

Telegram MTProto limits individual file parts to **512 KB** each and requires:
- Files < 10 MB: use `upload.saveFilePart`
- Files > 10 MB: use `upload.saveBigFilePart`
- Maximum file size via MTProto: **2 GB** (4 GB with Premium)

### Chunk Process

```
Input: 800 MB video file

Step 1: Split into 512 KB parts → 1,600 parts
Step 2: Upload parts in parallel (4 concurrent) with exponential backoff
Step 3: After all parts: sendMedia → single message in Saved Messages
Step 4: Telegram stores as single unified file
Step 5: Store single message_id in Supabase (not 1,600 part IDs)
```

For files > 2 GB (future):
```
Split into 1.9 GB logical chunks
Upload each chunk as separate message
Store array of message_ids: tg_message_ids = [id1, id2, ...]
On download: fetch each message, stream in sequence, reassemble
```

### Upload Parallelism

```javascript
// Upload 4 parts concurrently, with retry
const CONCURRENCY = 4
const PART_SIZE = 512 * 1024 // 512 KB

async function uploadFile(client, fileBuffer) {
  const parts = chunkBuffer(fileBuffer, PART_SIZE)
  const fileId = BigInt(Math.floor(Math.random() * 2**63))

  await pLimit(CONCURRENCY)(
    parts.map((part, i) => () =>
      retry(() => client.invoke(new Api.upload.SaveBigFilePart({
        fileId, filePart: i, fileTotalParts: parts.length, bytes: part
      })), { retries: 5, backoff: 'exponential' })
    )
  )

  return fileId
}
```

---

## 11. Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  storage_used_bytes BIGINT DEFAULT 0,
  tg_phone TEXT,                          -- hashed, not raw
  tg_session_encrypted TEXT,              -- AES-256-GCM encrypted session string
  tg_user_id BIGINT,                      -- Telegram user ID
  plan TEXT DEFAULT 'free'
);

-- Folders table (virtual, metadata only)
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id),  -- null = root
  created_at TIMESTAMPTZ DEFAULT now(),
  color TEXT,                              -- UI color tag
  icon TEXT                               -- UI icon
);

-- Files table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id),
  name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT,
  sha256_hash TEXT,                        -- for deduplication
  tg_message_id BIGINT,                   -- single message (files < 2GB)
  tg_message_ids BIGINT[],               -- array (files > 2GB, chunked)
  tg_access_hash BIGINT,                  -- needed for file reference refresh
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  version INT DEFAULT 1
);

-- AI metadata table
CREATE TABLE ai_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  summary TEXT,
  tags TEXT[],
  embedding vector(384),                  -- pgvector for semantic search
  generated_at TIMESTAMPTZ DEFAULT now(),
  model_used TEXT DEFAULT 'llama-3.3-70b-versatile'
);

-- Shared links table
CREATE TABLE shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  password_hash TEXT,                     -- optional password protection
  expires_at TIMESTAMPTZ,               -- null = never expires
  download_count INT DEFAULT 0,
  max_downloads INT,                     -- null = unlimited
  created_at TIMESTAMPTZ DEFAULT now()
);

-- OAuth apps table (third-party API)
CREATE TABLE oauth_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT NOT NULL,
  redirect_uris TEXT[],
  scopes TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- OAuth tokens table
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  app_id UUID REFERENCES oauth_apps(id),
  access_token_hash TEXT UNIQUE NOT NULL,
  refresh_token_hash TEXT UNIQUE,
  scopes TEXT[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_files_hash ON files(sha256_hash);
CREATE INDEX idx_ai_embedding ON ai_metadata USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_shared_links_token ON shared_links(token);
```

---

## 12. Rate Limiting

Telegram MTProto enforces flood limits. Violating them = temporary ban of the session.

### Known Limits (as of 2025)

| Operation | Limit |
|---|---|
| Messages sent | ~30/second globally |
| Messages to same chat | 1/second |
| File uploads | ~20 concurrent parts |
| API calls (general) | ~100/second |
| Login attempts | 5 per phone per hour |

### Our Mitigation Strategy

```
1. Per-user request queue — each user's Telegram session has its own queue
2. Exponential backoff on FLOOD_WAIT errors (Telegram tells you exactly how long)
3. Respect the FLOOD_WAIT value from error response — wait exactly that many seconds
4. Upload part concurrency capped at 4 per file
5. No automated bulk operations without user action
6. Health monitor tracks session ban status
```

```javascript
// Flood wait handler
async function withFloodWait(fn) {
  try {
    return await fn()
  } catch (err) {
    if (err.errorMessage === 'FLOOD_WAIT_X') {
      const seconds = parseInt(err.errorMessage.split('_').pop())
      await sleep(seconds * 1000)
      return await fn() // retry once after wait
    }
    throw err
  }
}
```

---

## 13. 100 Challenges & Mitigations

### Legal & ToS (1–15)

| # | Challenge | Mitigation |
|---|---|---|
| 1 | Telegram changes MTProto ToS to explicitly ban file managers | Monitor @BotNews daily. Have fallback storage (Oracle MinIO) ready to swap in. |
| 2 | Telegram detects automated-looking upload patterns | Add human-like delays (100-500ms jitter between operations). Never bulk-upload without user action. |
| 3 | App gets flagged for "non-messaging" usage | Frame all features as messaging-adjacent. Never use "storage" in marketing copy. |
| 4 | User account gets auto-flagged on first MTProto login | Use official Telegram client behavior patterns. Add proper device info to session (device model, app version, OS). |
| 5 | Telegram requires api_id review for production | Register with a real, descriptive app name: "televerse - File Manager for Telegram". Be honest about use case. |
| 6 | ToS update with 10-day compliance window | Subscribe to @BotNews. Set up automated ToS change detection. Have legal response plan ready. |
| 7 | GDPR compliance requirement for EU users | Users' data is in their own Telegram accounts. We hold only metadata. Data deletion = delete from our DB + delete Telegram messages. |
| 8 | User wants to export all data | Build data export: JSON metadata + re-download all files from Telegram. |
| 9 | Copyright infringement via sharing links | DMCA takedown process. Rate-limit public shares. No indexing of shared files by search engines. |
| 10 | Telegram bans our api_id | Have 2-3 registered api_ids ready. Swap in env var. New sessions needed for all users (re-login prompt). |
| 11 | Hosting provider ToS issues | Cloudflare ToS allows this use case. Railway ToS allows this. Nothing in either ToS forbids a Telegram client. |
| 12 | Apple / Google app store review rejection | Web app first. PWA. Skip app stores initially. |
| 13 | Telegram Premium required for >2 GB files | Enforce 2 GB limit per file clearly. Show upgrade prompt with Telegram Premium link. |
| 14 | Multi-jurisdiction data laws | Data lives in Telegram's DCs (EU/US/Singapore). We only hold metadata. Clear privacy policy. |
| 15 | User sues if Telegram deletes their files | ToS explicitly states: televerse is a client, Telegram controls storage. Telegram ToS governs. |

### Technical — MTProto (16–35)

| # | Challenge | Mitigation |
|---|---|---|
| 16 | Session string expires or is revoked by user | Detect `AUTH_KEY_UNREGISTERED` error. Prompt re-login. Never lose file metadata (still in Supabase). |
| 17 | Telegram DC migration (user switches DC) | Store DC ID in session. GramJS handles DC migration automatically. |
| 18 | File reference expiry (access_hash becomes invalid) | Store original message_id. Refresh file reference by fetching message again before download. |
| 19 | Upload interrupted mid-way | Track uploaded parts in DB. Resume from last successful part on retry. |
| 20 | Large file (>2 GB) handling | Logical chunking at application layer. Multiple messages per logical file. |
| 21 | Concurrent uploads from same session causing flood | Per-session upload queue. Max 1 active upload per session at a time. |
| 22 | GramJS version breaking changes | Pin exact GramJS version in package.json. Test upgrades in staging first. |
| 23 | Session string format changes in GramJS | Always serialize/deserialize via GramJS methods, never parse raw. |
| 24 | Telegram server errors (500, 503) | Exponential backoff up to 5 retries. Alert user if persistent. |
| 25 | MTProto connection drops | GramJS handles reconnection automatically. Add connection health check. |
| 26 | Phone number banned from Telegram | User's problem, not ours. Detect and show clear error. |
| 27 | 2FA (Cloud Password) during login | Handle `SESSION_PASSWORD_NEEDED` error. Prompt for 2FA password. |
| 28 | User deletes file from Telegram directly (not via televerse) | Periodic sync job: verify message_ids still exist. Mark missing files as `orphaned` in DB. |
| 29 | Telegram changes file upload API methods | Monitor Telegram API changelog. GramJS updates track these. |
| 30 | Multiple Telegram accounts per user | Support account switching. Each account = separate session string + separate file namespace. |
| 31 | Bot created by user conflicts with session | No bots involved. Separate concern entirely. |
| 32 | MTProto Engine (Railway) goes down mid-upload | Upload state persisted in DB. Resume on reconnect. |
| 33 | Session string stolen from DB | AES-256-GCM encryption at rest. Separate encryption key. Key rotation schedule. |
| 34 | Memory overflow on large file download stream | Pipe streams directly — never buffer entire file in memory. |
| 35 | GramJS not supported on Cloudflare Workers | MTProto Engine runs on Railway (Node.js), not on Workers. Workers are just the API gateway. |

### Technical — Infrastructure (36–55)

| # | Challenge | Mitigation |
|---|---|---|
| 36 | Railway free tier sleeps after inactivity | Add keep-alive ping every 5 minutes from Cloudflare Worker cron. |
| 37 | Supabase free tier pauses after 1 week inactivity | Add daily keep-alive query from Worker cron. |
| 38 | Cloudflare Worker CPU time limit (10ms free / 30ms paid) | MTProto work happens on Railway, not the Worker. Worker just does routing + DB queries. |
| 39 | Cloudflare Worker memory limit | Stream files through, never buffer. |
| 40 | Supabase connection pool exhaustion | Use Supabase connection pooler (pgBouncer). |
| 41 | pgvector extension not available on free Supabase | Check at project creation. Currently available on free tier. Fallback: BM25 text search. |
| 42 | Railway free tier bandwidth limits | Railway gives 100 GB/month free egress. Monitor. If exceeded, proxy downloads through Cloudflare (free egress). |
| 43 | Cloudflare Worker request timeout (30s default) | Large uploads go directly from browser to MTProto Engine (Railway), bypassing the Worker for the actual bytes. Worker just initiates. |
| 44 | CORS issues with third-party API | Proper CORS headers in Worker. Allowlist origins per OAuth app. |
| 45 | Secret key rotation for session encryption | Build key rotation script. Re-encrypt all sessions with new key. Zero-downtime rotation. |
| 46 | Database migration on production | Supabase migration files in `/supabase/migrations`. Never run raw ALTER in prod without migration file. |
| 47 | pgvector index performance on large datasets | Use IVFFlat index with appropriate lists parameter. Rebuild index periodically. |
| 48 | Supabase Row Level Security (RLS) misconfiguration | Enable RLS on all tables. Test every policy with a separate test user. |
| 49 | Worker KV cache stale after file deletion | Short TTL (60s) on cached file metadata. Always verify against DB on download. |
| 50 | Railway Node.js process crashes | PM2 process manager inside Railway. Auto-restart on crash. Health endpoint monitored by Worker cron. |
| 51 | Concurrent AI requests exceeding Groq rate limits | Queue AI jobs. Groq free tier: 30 requests/minute. Use job queue (Redis on Railway or Supabase DB queue). |
| 52 | Groq model deprecated | Abstract model name behind a config constant. Swap in one place. |
| 53 | Cloudflare AI embedding endpoint changes | Abstract embedding call behind a service class. |
| 54 | Cold start latency on first request | Worker has no cold start (always warm). Railway has ~2s cold start — keep-alive ping mitigates. |
| 55 | GitHub Actions secrets exposed | Use GitHub Environments. Never log secrets. Rotate on any suspected exposure. |

### Product & UX (56–70)

| # | Challenge | Mitigation |
|---|---|---|
| 56 | Upload progress not visible for large files | WebSocket or SSE progress events from MTProto Engine → Worker → UI. |
| 57 | File preview for proprietary formats (docx, xlsx) | Convert to PDF preview server-side using LibreOffice on Railway before streaming. |
| 58 | Mobile UX for large uploads | Chunked upload from mobile browser. Resume on connection drop. |
| 59 | Offline file access | PWA with service worker. Cache file metadata offline. Stream download on reconnect. |
| 60 | Keyboard navigation and accessibility | ARIA labels, focus management, keyboard shortcuts (Ctrl+U upload, Del delete, etc.). |
| 61 | Dark mode | CSS variables + `prefers-color-scheme` media query. |
| 62 | Internationalization (i18n) | i18next from day 1. English + Hindi to start. |
| 63 | User uploads malware | Scan filenames/mime types. Don't execute files server-side. Files stay in user's own Telegram — not our CDN. |
| 64 | Storage bar inaccuracy | Recalculate `storage_used_bytes` from DB aggregate on every upload/delete. Reconcile job weekly. |
| 65 | Duplicate file uploaded accidentally | SHA-256 hash check before upload. Show "identical file exists" warning. |
| 66 | Folder depth limit | Enforce max 10 levels deep in UI and API to keep queries fast. |
| 67 | File name collision in same folder | Append ` (1)`, ` (2)` automatically like OneDrive. |
| 68 | User accidentally deletes important file | Soft delete with 30-day recovery window. Mark `is_deleted = true`, actually delete after 30 days. |
| 69 | Search returns too many results | Pagination. Ranked results (semantic + recency + frequency). |
| 70 | AI summary wrong or offensive | Allow user to regenerate or dismiss summary. Flag for review. |

### Security (71–85)

| # | Challenge | Mitigation |
|---|---|---|
| 71 | JWT token stolen | Short expiry (15 min access token). Refresh token rotation. Revocation list in Supabase. |
| 72 | Shared link token guessed by brute force | 256-bit random token. Rate limit shared link endpoint (10 req/min per IP). |
| 73 | SQL injection | Parameterized queries everywhere. Supabase client handles this. |
| 74 | XSS in file preview | Sanitize all filenames displayed in HTML. CSP headers. No `innerHTML`. |
| 75 | SSRF via file URL upload | Validate URLs before fetch. Allowlist only Telegram CDN domains for internal fetches. |
| 76 | Timing attack on password comparison | Use constant-time comparison for shared link passwords. |
| 77 | Insecure Direct Object Reference on file_id | RLS policies ensure users can only access their own files. Validate ownership in Worker too (defense in depth). |
| 78 | Session fixation | Generate new session on login. Invalidate old session. |
| 79 | Clickjacking on OAuth authorize page | `X-Frame-Options: DENY` header. |
| 80 | OAuth CSRF on authorization flow | State parameter (PKCE flow). Validate state before exchanging code. |
| 81 | Refresh token theft | Refresh tokens are one-time-use (rotation). Detect reuse = revoke all tokens for that user+app pair. |
| 82 | Malicious OAuth app | App review process before publishing to directory. |
| 83 | Telegram OTP phishing | Never ask for OTP on our side after initial link. Clear UX: "televerse will never ask for your OTP again." |
| 84 | API key in browser console logs | Log redaction middleware. Never log authorization headers. |
| 85 | Third-party dependency compromise | `npm audit` in CI. Dependabot alerts. Pin exact versions in production. |

### Scaling & Edge Cases (86–100)

| # | Challenge | Mitigation |
|---|---|---|
| 86 | Power user uploads 500 files in one session | Queue all uploads. Process sequentially with flood-wait handling. Show queue progress. |
| 87 | File larger than 2 GB uploaded | Reject with clear error: "Maximum file size is 2 GB. For larger files, consider compressing first." Show recommended tools. |
| 88 | User has millions of files | Pagination everywhere. Cursor-based pagination (not offset). Indexes on user_id + uploaded_at. |
| 89 | Telegram account deleted by user | Detect `USER_DEACTIVATED` error. Mark account as disconnected. Files are gone (they were in user's account). Metadata orphaned in DB — prompt cleanup. |
| 90 | User switches phone number on Telegram | Old session invalidated. Prompt re-link. Files still exist (tied to account, not phone number). |
| 91 | Clock skew between Railway and Telegram servers | GramJS handles this with server time sync. Monitor for `MSG_ID_INVALID` errors. |
| 92 | Supabase free tier 500 MB DB limit hit | File metadata is tiny (~500 bytes per file). 500 MB = ~1 million files. Plenty of headroom. |
| 93 | AI summary generation fails for binary files | Graceful skip — only generate summaries for text-extractable files. Binary files get type-based tag only. |
| 94 | Semantic search returns irrelevant results | Hybrid search: combine vector similarity with BM25 text search. Weight recent files higher. |
| 95 | Multiple users uploading same public file | Deduplication at Telegram level is automatic (content-addressed). Our dedup is per-user only (different users can have "same" file separately). |
| 96 | MTProto Engine horizontal scaling needed | Session affinity: route each user's requests to same Railway instance (sticky sessions via user_id hash). |
| 97 | GramJS memory leak on long-running sessions | Restart MTProto Engine nightly (Railway cron). Sessions reconnect automatically via stored session strings. |
| 98 | Time zone handling in file timestamps | Store all timestamps in UTC in DB. Convert to user's local timezone in UI. |
| 99 | Accessibility audit failure | Run axe-core in CI. Fix all critical violations before launch. |
| 100 | Telegram deprecates MTProto in favor of new protocol | MTProto 2.0 is deeply embedded. Any change would be announced years in advance. Monitor Telegram blog. TDLib (official C++ library) is always an escape hatch. |

---

## 14. Build Order

### Phase 1 — Foundation (Week 1–2)
- [ ] Register app at my.telegram.org → get api_id + api_hash
- [ ] Set up Supabase project + run schema migrations
- [ ] Set up Railway Node.js service (MTProto Engine)
- [ ] Implement GramJS login flow (phone → OTP → session)
- [ ] Store encrypted session string in Supabase
- [ ] Basic file upload (single file, < 10 MB)
- [ ] Basic file download
- [ ] Cloudflare Worker routing to Railway

### Phase 2 — Core File Manager (Week 3–4)
- [ ] Virtual folder system (CRUD)
- [ ] File listing with pagination
- [ ] Upload progress via SSE
- [ ] Chunked upload for large files (up to 2 GB)
- [ ] File delete (DB + Telegram)
- [ ] SHA-256 deduplication
- [ ] Soft delete + 30-day recovery

### Phase 3 — UI (Week 5–6)
- [ ] React file manager UI
- [ ] Drag and drop upload
- [ ] File preview (image, video, PDF, audio)
- [ ] Folder navigation (breadcrumb)
- [ ] Sort + filter
- [ ] Storage usage bar
- [ ] Dark mode

### Phase 4 — AI Features (Week 7–8)
- [ ] Text extraction pipeline
- [ ] Groq summary generation on upload
- [ ] Cloudflare AI embeddings
- [ ] Semantic search
- [ ] Auto-tagging
- [ ] AI chat with file
- [ ] Folder summary

### Phase 5 — Sharing & API (Week 9–10)
- [ ] Shared link generation
- [ ] Password-protected links
- [ ] Link expiry
- [ ] OAuth 2.0 server
- [ ] REST API endpoints
- [ ] JavaScript SDK

### Phase 6 — Hardening (Week 11–12)
- [ ] Rate limit implementation
- [ ] Session encryption key rotation
- [ ] Security audit (all 85 security challenges)
- [ ] Error handling for all Telegram error codes
- [ ] Monitoring + alerting
- [ ] Load testing
- [ ] Privacy policy + ToS pages
- [ ] Accessibility audit

---

## 15. Environment Variables

### Cloudflare Worker
```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MTPROTO_ENGINE_URL=https://your-railway-service.up.railway.app
MTPROTO_ENGINE_SECRET=          # Internal auth between Worker and Engine
SESSION_ENCRYPTION_KEY=         # AES-256 key for session strings (32 bytes hex)
GROQ_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
JWT_SECRET=
```

### Railway (MTProto Engine)
```env
TG_API_ID=                      # From my.telegram.org
TG_API_HASH=                    # From my.telegram.org
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_ENCRYPTION_KEY=         # Same as Worker
INTERNAL_SECRET=                # Matches MTPROTO_ENGINE_SECRET in Worker
PORT=3000
```

### GitHub Actions (CI/CD)
```env
CLOUDFLARE_API_TOKEN=
RAILWAY_TOKEN=
SUPABASE_ACCESS_TOKEN=
```

---

*televerse Documentation v1.0 — Built by Avi*
*Stack: GramJS + Cloudflare + Supabase + Groq + Railway*
*Legal basis: Telegram MTProto Client API ToS (core.telegram.org/api/terms)*
