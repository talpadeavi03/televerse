# TeleVerse — Phase 2: Design & Implementation Plan

###########imp: when we put multiple files it auto sort and keep in good format condtion so user can retrive files later back easily
also as the memory of user grows the backend does not crash so strong it can take upto 100 TB ############

This document details the engineering specifications for Phase 2 of TeleVerse. It maps the implementation details of core file operations, establishes the compliance boundaries for Telegram MTProto usage, outlines the migration to a modern AI stack, and specifies the architecture for **WebVerse** (the relational file networking graph).

---

## 1. Telegram ToS Compliance & Rate Limiting

To keep user accounts safe and avoid session bans or IP throttling from Telegram, TeleVerse adheres to the **Telegram MTProto Client API terms**. Under these rules, TeleVerse acts as a standard alternative messaging client (similar to Telegram X or Nicegram), meaning users connect *their own accounts* and are subject to their own client rate limits.

### A. Core Legal & Operational Boundaries (Non-Negotiable)
1. **No Bot Abuse**: We do not use bot accounts (`BotFather`) to store data, avoiding the strict Bot API cloud storage bans.
2. **User-Owned Storage**: Files live inside the user's "Saved Messages" chat. If the user revokes TeleVerse's access, they retain all files inside their native Telegram app.
3. **Clear API Registration**: The application must be registered at `my.telegram.org` with its own `api_id` and `api_hash`.
4. **App Branding**: The name "Telegram" is not used in the application title. It is branded as **TeleVerse - Advanced File Manager Client**.

### B. Rate Limiting & Queueing Strategy
Telegram enforces strict **Flood Waits** (e.g. `FLOOD_WAIT_X` where `X` is the cooldown duration in seconds) when too many requests are sent concurrently. We implement three core safety mechanics:

1. **Per-User Transaction Queue**:
   Each active user session is assigned a sequential task queue. Concurrent uploads or directory syncs are serialized rather than executed in massive parallel bursts.
2. **Capped Upload Concurrency**:
   Large files are sliced into **512 KB** parts. We cap concurrent chunk uploads at **4 parallel parts** per file. Between each chunk upload, we inject a random **50ms-200ms jitter delay** to make requests look human-like.
3. **Graceful Flood-Wait Interceptor**:
   All MTProto client invocations are wrapped in a retry handler that catches `FLOOD_WAIT_X` errors, sleeps for exactly `X` seconds, and retries the transaction.

```typescript
// Shared retry helper with Flood Wait handling
export async function withFloodWait<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err.errorMessage && err.errorMessage.startsWith('FLOOD_WAIT_')) {
      const seconds = parseInt(err.errorMessage.split('_').pop() || '5', 10)
      console.warn(`⚠️ Telegram Flood Wait: Sleeping for ${seconds}s...`)
      await sleep((seconds + 1) * 1000) // Sleep wait + 1s safety buffer
      return await withFloodWait(fn)     // Retry recursively
    }
    throw err
  }
}
```

---

## 2. Core File Operations

### A. Authentication & Session Flow
The login flow establishes an encrypted MTProto session without ever storing user passwords:

```
[User UI] ──(Phone Number)──> [Fastify API] ──(client.sendCode)──> [Telegram API]
                                                                        │
[User UI] <──(PhoneCodeHash)─ [Fastify API] <──(OTP Sent to User) ──────┘
    │
    └───(OTP Code + 2FA) ───> [Fastify API] ──(client.signIn)────> [Telegram API]
                                    │                                   │
                               [Encrypt Session] <───(Session String)───┘
                                    │
                               [Save to DB]
```

1. **OTP Dispatch**: User enters phone number ➜ Backend calls `client.sendCode` ➜ Telegram sends an OTP directly to the user's native Telegram app.
2. **Sign-In Verification**: User submits OTP + optional 2FA password ➜ Backend signs in ➜ Extracts the unique GramJS `StringSession` token.
3. **AES-256-GCM Session Storage**: The raw string session is encrypted at rest using the server-side `SESSION_ENCRYPTION_KEY` and saved to `users.telegram_session_encrypted`. It is decrypted only on-the-fly when handling a file request for that user.

### B. Parallel Logical Chunking
To support large files (up to **2 GB** for standard users, and **4 GB** for Premium users):
1. **Slicing**: Buffers are sliced into **512 KB** parts.
2. **Uploading**: 
   - Files `< 10 MB` use `Api.upload.SaveFilePart`.
   - Files `> 10 MB` use `Api.upload.SaveBigFilePart`.
3. **Deduplication**: On upload start, we calculate the file's SHA-256 hash. If it matches an existing file in the database for that user, we prompt the user to skip the upload or link to the existing file reference, saving bandwidth and space.
4. **Finalization**: Once all chunks are successfully uploaded, we invoke `Api.messages.SendMedia` to save it as a unified document in the Saved Messages chat. The database records the generated `tgMessageId` for downloads.

### C. Virtual File System & Sharing
- **Virtual Directory CRUD**: Folders are virtual entities mapped in the `folders` metadata table. Users can create, rename, and drag-and-drop files between directories without moving anything on Telegram's servers.
- **Revocable Signed Sharing**: Generating a share link creates a secure token mapped in `shared_links`. This token supports password protection (bcrypt hashing), a set download count limit, and a configured expiration TTL (`expires_at`).

---

## 3. Modern AI Stack Integration

We are migrating our AI summarization, tagging, and indexing features from Groq to a more robust, high-context AI provider.

### A. Recommended AI Models
While Groq is fast, it suffers from strict rate limits on the free tier and small context sizes. We evaluate two modern, highly effective alternatives:

1. **Gemini 2.5 Flash (Recommended)**:
   - **Speed**: Extremely fast, near-instantaneous responses.
   - **Context Window**: **1.04 Million Tokens**. This allows TeleVerse to feed entire multi-hundred page PDF manuals, source code files, or books directly to the AI for chat and summarization without needing complex RAG chunking.
   - **Cost**: Extremely cost-effective (free tier available, paid tier is exceptionally cheap).
2. **ChatGPT (gpt-4o-mini)**:
   - **Context Window**: 128,000 Tokens.
   - **Ecosystem**: Robust, familiar API.

### B. Modular AI Service Design
We implement a unified, abstract `AIService` interface. This allows us to swap between Gemini, ChatGPT, or Groq seamlessly by simply changing an environment variable (`AI_PROVIDER`).

```typescript
export interface AIServiceProvider {
  summarize(text: string): Promise<string>
  generateTags(text: string): Promise<string[]>
  generateEmbedding(text: string): Promise<number[]>
  chat(text: string, fileContent: string, history: any[]): Promise<string>
}
```

### C. AI Pipelines: Summarization & Semantic Search
- **Summarization**: When a readable document (PDF, Text, Markdown, CSV, JS/TS) is uploaded, we extract the text (up to 100,000 tokens for Gemini). We prompt the AI to generate a concise, 3-sentence summary of the content.
- **Semantic Search**: We generate a vector embedding (`384` dimensions) using a lightweight text embedding model. The embedding is stored in the database's `ai_metadata.embedding` table. Users can run semantic queries (e.g. *"find invoices from my trip last week"*) which resolves using cosine-similarity against `pgvector`.

---

## 4. "WebVerse" — Graph-Based File Networking

**WebVerse** is an advanced feature that allows users to establish *virtual semantic connections* between files, transforming the traditional linear file structure into a multi-dimensional database or knowledge graph.

### A. The Core Concept
Traditional file systems store files in isolated folders. In TeleVerse, a user can establish "Connections" (links) between files. For example:
- Connect `Contract_Draft.pdf` ➜ `Client_Feedback.docx`
- Connect `Expense_Receipt.png` ➜ `Q4_Budget_Review.xlsx`
- Connect `Database_Backup.sql` ➜ `Deployment_Log.txt`

This allows users to map relationships, track dependencies, and navigate related materials seamlessly.

### B. Data Model: Relational Connections
We introduce a new table schema mapping directional or bi-directional connections between files:

```sql
CREATE TABLE file_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  target_file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,           -- e.g. 'references', 'depends_on', 'receipt_of'
  annotation TEXT,                      -- User note describing the link
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_file_connection UNIQUE(source_file_id, target_file_id)
);
```

### C. AI-Powered Smart Relationship Suggestion
TeleVerse will automatically scan the AI summaries, metadata, and tags of newly uploaded files and calculate their cosine-distance:
1. When a new file is uploaded, the system retrieves top-N semantically similar files using `pgvector` similarity search.
2. If the cosine similarity matches above a certain threshold (e.g. `> 0.85`), the system will display a subtle notification:
   - *"Smart Suggestion: This file looks related to `Q4_Accounts.xlsx`. Link them in your WebVerse?"*
3. Users can approve the suggested link with a single click.

### D. Interactive 2D Graph UI
The `/drive/webverse` view displays a beautiful, dynamic, interactive 2D node-link graph:
- **Rendering Stack**: Built using **React Flow** or **D3.js (Force-directed graph)** styled with custom tailwind glassmorphic nodes.
- **Features**:
  - Hovering over a file node displays its AI summary, tags, and size.
  - Double-clicking a node opens the file's preview panel immediately.
  - Dragging a connection line between two nodes manually creates a new relationship link.
  - Filtering nodes by file type or tag highlights relevant sub-graphs.

---
*End of Phase 2 Implementation Plan*
