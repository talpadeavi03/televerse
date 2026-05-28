# TeleVerse — Phase 1: Foundation & Incident Report

This document records the engineering baseline of TeleVerse Phase 1, detailing the architecture, the critical runtime incidents encountered, the precise engineering bug fixes implemented, and the automated delivery pipeline connecting GitHub and Hugging Face.

---

## 1. Executive Summary

**TeleVerse** is a Telegram-powered cloud file manager. It operates as a custom third-party messaging client using the **Telegram MTProto Client API** via **GramJS** in Node.js. It allows users to login directly with their own Telegram accounts, storing files securely inside their own "Saved Messages" channel.

Phase 1 established the core repository framework, database schemas, monorepo packaging, and the edge-proxy reverse gateway required to run containerized within Hugging Face Spaces.

---

## 2. Baseline Architecture

The system is configured as a monorepo using **pnpm workspaces**:

```
televerse/ (pnpm monorepo)
├── apps/
│   ├── web/          # Next.js 14 Frontend (standalone server mode)
│   └── api/          # Fastify REST & WebSocket API Gateway
├── packages/
│   ├── db/           # Drizzle ORM PostgreSQL schema definitions
│   ├── shared/       # Shared TS logic (AES-256-GCM crypto, chunking, sleep)
│   ├── types/        # Unified TypeScript interface types
│   └── sdk/          # JavaScript SDK for third-party integrations
└── infra/
    ├── docker/       # Custom Docker configurations
    ├── huggingface/  # Hugging Face deployment scripts and Nginx routing
    └── migrations/   # SQL diffs managed by drizzle-kit
```

### Infrastructure Context:
- **Database**: PostgreSQL 16 with `uuid-ossp`, `pgcrypto`, and `pgvector` extensions enabled.
- **Cache**: Redis 7 for rate-limiting.
- **Edge Proxy**: Nginx 1.28 acting as a reverse gateway proxy. It listens on port `7860` (Hugging Face standard) and splits routes:
  - `/v1/` and `/ws` ➜ Fastify API Gateway (`127.0.0.1:4000`)
  - `/` (Fallback) ➜ Next.js Frontend (`127.0.0.1:3000`)

---

## 3. Gaps & Incidents Encountered

During the initial deployment of the Phase 1 container on Hugging Face, several critical startup failures were encountered, preventing Nginx from communicating with the backend services:

### Incident A: Outdated/Incomplete Database Migrations
- **Symptom**: Running `pnpm db:migrate` on startup crashed with `Error: Can't find meta/_journal.json file`.
- **Root Cause**: The migration folder `infra/migrations` only contained a hand-written `init.sql` without drizzle-kit's structured journal meta configurations. When we attempted to run `drizzle-kit generate` to populate this folder, it crashed with `TypeError: Do not know how to serialize a BigInt`. Drizzle-kit's metadata engine calls `JSON.stringify` on the schema representation, which fails natively when it encounters a raw `BigInt(...)` primitive inside the schema file (used for `storageUsedBytes`).

### Incident B: Node TS Workspace Resolution Crash
- **Symptom**: Fastify API crashed immediately on startup with `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"`.
- **Root Cause**: The API was compiled via `tsc` into `dist/` and run using standard `node dist/server.js`. However, it imports the monorepo workspace packages (`@televerse/db`, etc.). The workspace symlinks resolve directly to `/packages/db/src/index.ts`. Standard Node.js does not recognize `.ts` extensions at runtime and failed immediately.

### Incident C: Port Binding Mismatch (502 Bad Gateway)
- **Symptom**: Nginx successfully started on port `7860` but returned `502 Bad Gateway` on all incoming requests.
- **Root Cause**: Next.js standalone server reads `process.env.HOSTNAME` to determine its bind address. In Hugging Face Spaces, the environment automatically sets `HOSTNAME` to the container pod ID (e.g., `r-talpadeavi20...`). Next.js resolved this hostname to the container's external network IP interface (`10.111.177.162`) and only listened there. Since Nginx's `nginx.conf` proxied requests to the loopback IP (`127.0.0.1:3000`), Nginx's connection attempts were refused.

### Incident D: Silenced Background Diagnostics
- **Symptom**: Background services (`&`) started silently in the entrypoint script. If they crashed, they died quietly, making debugging extremely difficult.

### Incident E: Broken Deployment Pipeline
- **Symptom**: Commits pushed to the GitHub repository triggered a successful GitHub Actions CI verification pipeline but never updated the Hugging Face Space, leaving the Space in a permanently outdated state.

---

## 4. Engineering Fixes & Implementations

We implemented five exact, non-breaking modifications to resolve all baseline gaps and deliver a highly robust system:

### Fix 1: Type-Safe Schema Default & Migration Generation
We updated `packages/db/src/schema.ts` to import `sql` from `drizzle-orm` and changed the default definition from a raw JavaScript BigInt to a type-safe SQL template literal:
```diff
-  storageUsedBytes: bigint('storage_used_bytes', { mode: 'bigint' }).default(BigInt(0)),
+  storageUsedBytes: bigint('storage_used_bytes', { mode: 'bigint' }).default(sql`0`),
```
- **Result**: Satisfied the TypeScript compiler (which expects `bigint | SQL`) and allowed `drizzle-kit` to serialize schema defaults without crashing. We successfully executed `drizzle-kit generate` to populate the `infra/migrations` directory with `0000_stiff_speedball.sql` and the correct journal logs.

### Fix 2: Modernized Runtime with `tsx` & `pnpm`
We updated the API execution model to run via **`tsx`** (TypeScript Execute) in production to natively compile and resolve internal workspace modules:
- Moved `tsx` to core production `dependencies` in `apps/api/package.json`.
- Updated the `"start"` script to: `"start": "tsx src/server.ts"`.
- Modified `entrypoint.sh` and `api.Dockerfile` to launch via `pnpm --filter @televerse/api start` to ensure correct local workspace resolution.

### Fix 3: Loopback Host Binding Realignment
We explicitly overrode container-provided network environment variables in `infra/huggingface/entrypoint.sh` to force binding on all interfaces:
- For Next.js: Added `HOSTNAME=0.0.0.0`
- For Fastify: Added `HOST=0.0.0.0`
- **Result**: Binding to `0.0.0.0` allows loopback connections so Nginx's `proxy_pass http://127.0.0.1` routes successfully handshake.

### Fix 4: Output Redirection & Health Checks
We updated `entrypoint.sh` to log background processes and verify port availability on startup:
```bash
pnpm --filter @televerse/api start > /tmp/api.log 2>&1 &
node apps/web/server.js > /tmp/web.log 2>&1 &
sleep 5
```
Added a `netcat` check:
```bash
if ! nc -z 127.0.0.1 4000; then
  echo "❌ Fastify API failed to start! Printing logs:"
  cat /tmp/api.log
fi
```
- **Result**: If a service crashes at startup, the exact Node/TypeScript stack trace is automatically dumped directly onto the Hugging Face Spaces logs.

### Fix 5: Automated GitHub-to-HuggingFace Sync Pipeline
We added a new `deploy-huggingface` job at the end of `.github/workflows/ci.yml` which executes automatically on a successful push to the `main` branch:
```yaml
  deploy-huggingface:
    name: Deploy to Hugging Face Spaces
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Push to Hugging Face
        env:
          HF_TOKEN: ${{ secrets.HF_TOKEN }}
        run: |
          git remote add hf https://hf:$HF_TOKEN@huggingface.co/spaces/talpadeavi20/televerse
          git push hf main --force
```
- **Result**: Committing to GitHub automatically builds, runs validation tests, and securely pushes to Hugging Face Spaces, triggering the remote rebuild.

---

## 5. Verification & Proof of Success

1. **Vitest Unit Tests**: Running `pnpm test` verifies that the `shared` cryptography routines (AES-256-GCM session decryption, SHA-256 hashing) and Fastify server routing run flawlessly (**6/6 tests passed**).
2. **Next.js Standalone Build**: The build script compiling `.next/standalone` outputs correctly.
3. **Application Live**: The Nginx proxy handshakes correctly with the Next.js server, and the TeleVerse landing page loads successfully on **`https://talpadeavi20-televerse.hf.space`**!

---
*End of Phase 1 Report*
