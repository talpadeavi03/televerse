# TeleVerse — Master System Design & Architecture Spec

This document serves as the absolute master engineering specification and system design blueprint for **TeleVerse** — the Telegram-powered cloud file manager monorepo. It details all software components, pipelines, third-party MTProto specifications, Nginx gateways, AI orchestration layers, CI/CD delivery networks, security structures, and our historical systems recovery logs.

---

## 1. System Concept & High-Level Architecture

TeleVerse operates as an advanced, custom third-party messaging client utilizing the **Telegram MTProto Client API** via **GramJS** in Node.js. Instead of storing user files on expensive proprietary cloud databases, TeleVerse allows users to log in directly with their own Telegram credentials and uses their personal **Saved Messages** channel as an encrypted, high-performance, unlimited cloud storage drive.

The system is hosted completely for free utilizing a modular Docker stack compiled within **Hugging Face Spaces** (CPU basic environment), integrating a local **Redis 7** instance for token rotation caching, and connecting to an external **PostgreSQL 16** server with **pgvector** enabled.

### High-Level System Flow:
```
                                 [ Nginx Edge Proxy (Port 7860) ]
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 │ (Routes: /v1/*, /ws, /health, /docs)                        │ (Routes: /)
                 ▼                                                             ▼
    [ Fastify API Gateway (Port 4000) ]                        [ Next.js Frontend (Port 3000) ]
        │                 │                                                    │
        │                 ├─────────────(WS / REST)───────────► [ Zustand State / UI Flow ]
        ▼                 ▼
   [ Redis 7 ]      [ Postgres 16 ]
 (Token Cache)    (pgvector Schema)
                          │
                          ▼ (MTProto API / GramJS)
                  [ Telegram Cloud ]
              (User's Saved Messages Chat)
```

---

## 2. Component Architecture & Directory Layout

TeleVerse is structured as a type-safe ESM (ES Module) monorepo managed via **pnpm workspaces**:

```
televerse/ (pnpm monorepo)
├── apps/
│   ├── web/          # Next.js 14 Frontend UI (Standalone Server Mode)
│   └── api/          # Fastify API Gateway (REST, Swagger Docs & WebSockets)
├── packages/
│   ├── db/           # Drizzle ORM Schema mapping & SQL migrations
│   ├── shared/       # Shared TS utilities (AES crypto, chunk buffers, sleep)
│   ├── types/        # Unified TypeScript interface definitions
│   └── sdk/          # JavaScript SDK for third-party developer access
└── infra/
    ├── docker/       # Custom API and Frontend Dockerfiles
    ├── huggingface/  # HF entrypoint.sh boot scripts and Nginx routing configs
    └── migrations/   # SQL migrations journal managed by drizzle-kit
```

### A. Frontend Application (`apps/web`)
* **Framework**: Next.js 14 (App Router) compiled in **standalone server mode** to minimize container RAM usage.
* **Styling**: Vanilla CSS and Tailwind CSS, leveraging custom glassmorphic tokens, deep purple-indigo radial background glows, and responsive grids.
* **State Management**: **Zustand** for lightweight auth session handling, file navigation states, and visual WebVerse graph toggles.
* **Data Fetching**: **React Query** (TanStack Query) for declarative caching, optimistic folder updates, and file list synchronization.
* **Client Bindings**: Binds strictly to `HOSTNAME=0.0.0.0` at port `3000` inside the container.

### B. API Gateway (`apps/api`)
* **Framework**: Fastify compiled with TS and executed natively in production via **`tsx`** to seamlessly resolve internal workspace packages.
* **Documentation**: **`@fastify/swagger`** and **`@fastify/swagger-ui`** auto-generating active interactive endpoints playgrounds at `/docs`.
* **Security & Auth**: Binds JWT validation hooks using `@fastify/jwt` and supports `@fastify/multipart` for high-throughput buffering limits (up to 2GB).
* **Realtime Sync**: Integrated WebSockets via `@fastify/websocket` mounted at `/ws` to send real-time chunk upload progress percentages back to the client UI.
* **Client Bindings**: Binds strictly to `HOST=0.0.0.0` at port `4000` inside the container pod.

### C. Database Layer (`packages/db`)
* **Framework**: Drizzle ORM managing schemas and SQL migrations.
* **Engine**: PostgreSQL 16 requiring three extensions: `uuid-ossp` (random UUID generation), `pgcrypto` (cryptography hashing), and `vector` (pgvector cosine-similarity searches).

#### Master Database Schema Definitions:
```typescript
// packages/db/src/schema.ts

// 1. Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  telegramSessionEncrypted: text('telegram_session_encrypted'), // Encrypted StringSession
  storageUsedBytes: bigint('storage_used_bytes', { mode: 'bigint' }).default(sql`0`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Folders Table (Virtual Foldering System)
export const folders = pgTable('folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  parentId: uuid('parent_id'), // Self-reference for nested folders
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Files Table (Virtual reference to Telegram documents)
export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
  mimeType: text('mime_type').notNull(),
  sha256: text('sha256').notNull(), // Integrity check & Deduplication
  tgMessageId: integer('tg_message_id').notNull(), // ID inside the user's Saved Messages
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. File Connections (WebVerse semantic network)
export const fileConnections = pgTable('file_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sourceFileId: uuid('source_file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  targetFileId: uuid('target_file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  relationType: text('relation_type').notNull(), // e.g., 'receipt_of', 'references', 'depends_on'
  annotation: text('annotation'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. AI Metadata (Semantic Search Vector Store)
export const aiMetadata = pgTable('ai_metadata', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  summary: text('summary').notNull(),
  tags: text('tags').array().notNull(),
  embedding: vector('embedding', { dimensions: 384 }), // pgvector 384d embedding
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Shared Links (Revocable shared access keys)
export const sharedLinks = pgTable('shared_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').unique().notNull(),
  passwordHash: text('password_hash'), // Optional password protection
  downloadLimit: integer('download_limit'),
  downloadCount: integer('download_count').default(0).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### D. Cryptography & Utilities (`packages/shared`)
* **Encryption standard**: **AES-256-GCM** utilized to secure user's GramJS `StringSession` strings at rest.
* **Integrity standard**: Deterministic SHA-256 hashing to verify chunks and check duplicates.
* **Parallel Chunk Slicing**: Slices logical buffers into physical **512 KB** segments.
* **Rate Limits Safety Helpers**: Random sleep jitters and recursive `FLOOD_WAIT` sleep handlers.

---

## 3. The MTProto Storage & Upload Pipeline

The upload pipeline is designed to securely and efficiently stream large files up to **2 GB** (standard Telegram limit) or **4 GB** (Premium Telegram limit) directly to the user's Saved Messages without buffer exhaustion on our Fastify gateway.

### A. Authentication & Session Encryption Flow:
1. **Initiation**: User sends their phone number ➜ Fastify calls GramJS `TelegramClient.sendCode` ➜ Telegram dispatches an OTP directly to the user's official app.
2. **Verification**: User enters the OTP + 2FA password ➜ Fastify verifies credentials using `TelegramClient.signIn` ➜ Extracts the unique session authentication key string (`StringSession`).
3. **At-Rest AES Encryption**: The raw session string is encrypted using Fastify's server-side secure `SESSION_ENCRYPTION_KEY` and recorded to the user's `telegramSessionEncrypted` column in PostgreSQL. It is decrypted ONLY in-memory during an active file action.

### B. Logical File Slicing & Uploading Flowchart:
```
           [ File Stream Upload Request ]
                         │
                         ▼
             [ Compute SHA-256 Hash ]
                         │
                         ▼
        [ Deduplication check in Postgres ]
        ├── Matches: Prompt user to link reference instead (Skip Upload)
        └── Unique: Continue
                         │
                         ▼
         [ Slice file into 512KB chunks ]
                         │
                         ▼
       [ Active Upload Queue (Concurrency = 4) ]
       ├── Part size < 10 MB: Api.upload.SaveFilePart
       └── Part size > 10 MB: Api.upload.SaveBigFilePart
                         │
                         ▼
        [ Inject 50ms - 200ms Jitter Delay ]
                         │
                         ▼
           [ Catch FLOOD_WAIT_X Error? ]
           ├── Yes: Sleep for X + 1 seconds, then retry
           └── No: Continue
                         │
                         ▼
    [ Finalize: Api.messages.SendMedia to Saved Messages ]
                         │
                         ▼
    [ Retrieve tgMessageId and record details in DB ]
```

---

## 4. Nginx Edge Reverse Gateway Proxy

Hugging Face Spaces expose only port `7860` externally. We deploy **Nginx 1.28** in the entrypoint shell as a high-performance edge reverse proxy routing external requests to our decoupled monorepo ports.

```
                  Hugging Face Space Gateway (HTTPS Port 7860)
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
   [ Path: /v1/* ]            [ Path: /ws ]       [ Paths: /health, /docs ]
    (Fastify API)             (WebSockets)          (Health & API Docs)
           │                          │                          │
           ▼                          ▼                          ▼
  proxy_pass: 4000           proxy_pass: 4000           proxy_pass: 4000
 (127.0.0.1:4000/v1)        (127.0.0.1:4000/ws)        (127.0.0.1:4000/docs)
           │                          │                          │
           └──────────────────────────┼──────────────────────────┘
                                      ▼
                      [ Fastify Gateway Container ]
```
*Fallback Paths (e.g. `/`, `/drive/*`, `/auth/*`) are proxied directly via `proxy_pass http://127.0.0.1:3000` to the Next.js stand-alone frontend container.*

---

## 5. AI Orchestration & Semantic Search

We leverage a modular, provider-swappable AI configuration interface that dynamically connects to Groq, OpenAI, or **Gemini 2.5 Flash** (recommended).

### Why Gemini 2.5 Flash is our Selected Standard:
1. **1 Million+ Token Context Window**: Enables TeleVerse to ingest entire multi-hundred page PDF directories, large log files, or complete spreadsheets in a single API call for chat and indexing.
2. **Unrivaled Processing Speed**: Provides near-instant summaries and tags.
3. **Economic Free Tier**: Eliminates token costs during development.

### AI Integration Pipeline:
```
  [ Upload Document ] ──► [ Extract Plain Text ] ──► [ AIService.summarize() ] ──► [ Generate Summary ]
                                                                                         │
  [ Save pgvector ]   ◄── [ Generate 384d Embedding ] ◄── [ AIService.generateTags() ] ◄─┘
```
* **Semantic Vector Queries**: When a user queries *"find documents about tax invoices"*, we generate a 384-dimensional vector from the query and run a cosine-similarity check on our PostgreSQL `ai_metadata.embedding` table using `pgvector`:
  ```sql
  SELECT file_id, summary, 1 - (embedding <=> :query_embedding) AS similarity
  FROM ai_metadata
  WHERE 1 - (embedding <=> :query_embedding) > 0.82
  ORDER BY similarity DESC LIMIT 10;
  ```

---

## 6. "WebVerse" — Graph-Based File Networking

**WebVerse** replaces the standard linear folder system with an interactive relational database, converting files into connected knowledge nodes.

### Schema Mechanics:
* Virtual relationships (directional or bi-directional) are recorded in the `file_connections` table, mapping `sourceFileId` to `targetFileId` with a `relationType` (e.g. `depends_on`, `receipt_of`, `references`) and custom metadata annotations.
* **AI Smart Link Suggestion**: The system calculates the cosine-similarity of new files against existing documents. If similarity matches `> 0.85`, it prompts the user: *"Suggest linking this contract draft to client_brief.pdf in your WebVerse?"*
* **Visualizer UI**: Renders an interactive 2D node-link graph on the Next.js dashboard using **React Flow** and **D3-force** algorithms. Hovering nodes previews summaries, and dragging connection links creates database relationship entries instantly.

---

## 7. CI/CD Delivery & Automated Pipelines

The codebase integrates an automated deployment loop connecting Git push events directly to our container hosts:

```
  [ Git Push main ] ──► [ GitHub Actions Runs CI ] ──► [ Lint & Type Checks ] ──► [ Vitest Unit Tests ]
                                                                                         │
  [ Force Push HF Space ] ◄── [ Authenticated HF Sync ] ◄── [ Build Assets & standalone ] ◄┘
```
1. **Authentication**: The action uses the repository secret `HF_TOKEN`.
2. **Git Synchronization**:
   ```bash
   git remote add hf https://hf:$HF_TOKEN@huggingface.co/spaces/talpadeavi20/televerse
   git push hf main --force
   ```
3. **Auto-Rebuild**: Hugging Face detects the updated repository, compiles the Docker layers, runs our `entrypoint.sh` setups, and deploys the Nginx reverse-proxied gateway.

---

## 8. Resolved Production Incidents & System Recovery Log

During development, four critical container crashes occurred, which we resolved with exact architectural overrides:

### A. Drizzle-Kit BigInt Serialization Crash
* **Incident**: Running `drizzle-kit generate` crashed with `TypeError: Do not know how to serialize a BigInt` when resolving the default value for `storageUsedBytes`.
* **Root Cause**: Drizzle-kit stringifies schema defaults inside a JSON generator, crashing when it encounters raw JS BigInt primitives (like `BigInt(0)` or `0n`).
* **Fix**: Replaced the default configuration with a Drizzle SQL template literal `default(sql'0')` which compiles to serializable SQL structure and satisfies both the typescript compiler and drizzle-kit.

### B. Node TS Workspace Resolution Failure
* **Incident**: Fastify API gateway crashed on launch with `Unknown file extension ".ts"`.
* **Root Cause**: Node compiled `apps/api` but symlinked workspace dependencies (`@televerse/db`) resolved to raw `/src/index.ts` paths, which Node.js rejects in ESM mode.
* **Fix**: Added `"type": "module"` to all packages, migrated compilation execution in `package.json` to **`tsx`** (TypeScript Execute), and updated the production start hook: `"start": "tsx src/server.ts"`.

### C. Nginx 502 loopback hostname Refusal
* **Incident**: Nginx successfully loaded on port `7860` but returned `502 Bad Gateway` on all incoming requests.
* **Root Cause**: Next.js standalone reads `process.env.HOSTNAME`. Hugging Face dynamically injected the pod container host ID as the environment's `HOSTNAME`, forcing Next.js to bind only to the container's external network IP interface (`10.111...`). Nginx proxy_pass attempts directed at loopback `127.0.0.1` were thus rejected.
* **Fix**: Explicitly set and override `HOSTNAME=0.0.0.0` for Next.js, and `HOST=0.0.0.0` for Fastify inside `entrypoint.sh` before firing the daemons, resolving loopback handshakes.

### D. Corrupted PostgreSQL Cluster Recovery
* **Incident**: Database cluster corrupted on start with missing `pg_notify` files.
* **Fix**: Integrated a proactive recovery shell script checking cluster integrity on boot, wiping corrupted directories automatically, and re-initializing the Postgres database using explicit extension scripts:
  ```bash
  psql -d televerse -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; CREATE EXTENSION IF NOT EXISTS \"pgcrypto\"; CREATE EXTENSION IF NOT EXISTS vector;"
  ```

---

## 9. Security Models

* **Password Security**: Credentials encrypted using standard salt + high-cost `scrypt` hashing.
* **Multi-Tenant Session Isolation**: User's MTProto Telegram sessions are isolated; session decryption is done on-the-fly and completely in-memory utilizing server-side environment keys, preventing token exposures.
* **Session Cache Security**: Access tokens are cached in Redis under TTL (Time To Live) limits and verified dynamically by Fastify JWT middleware.
* **API Secret Protections**: Direct terminal access paths (such as logs or process control for OpenClaw) are protected behind strict `INTERNAL_SECRET` header validation.
