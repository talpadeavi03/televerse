---
title: TeleVerse
emoji: 🌌
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# TeleVerse 🌌
> **Telegram-powered cloud file manager** — store unlimited files in your own Telegram account with an intelligent AI-enhanced manager UI.

[![CI Pipeline](https://github.com/talpadeavi03/televerse/actions/workflows/ci.yml/badge.svg)](https://github.com/talpadeavi03/televerse/actions/workflows/ci.yml)
[![Deployment Status](https://img.shields.io/badge/HF_Space-Live-success?logo=huggingface&color=FFD21E)](https://talpadeavi20-televerse.hf.space)
[![Platform Version](https://img.shields.io/badge/version-v1.0.0--bp%20%7C%20Phase%201-blue.svg)](file:///home/sudo69/devops-core/televerse/mds/Phase1_Foundation.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TeleVerse operates as a custom third-party messaging client utilizing the **Telegram MTProto Client API** via **GramJS** in Node.js. By connecting their own Telegram accounts, users gain unlimited storage directly inside their own personal "Saved Messages" channel, enjoying total privacy and control.

---

## 🚀 Release Tracks & Versioning

We utilize explicit versioning milestones to track development phases and support reliable Quality Assurance checks:

### 🟢 Phase 1: Foundation — `v1.0.0-bp` (Baseline Prototype)
*Status: **Released & Operational** | Live Environment: [https://talpadeavi20-televerse.hf.space](https://talpadeavi20-televerse.hf.space)*
* **Visual Identity & Shell**: A fully responsive landing page styled with rich gradients, modern typography (Inter font), micro-interactions, and visual comparative tables.
* **Encrypted Postgres Auth**: Secure registration (`/auth/register`) and login (`/auth/login`) pipelines saving user credentials as salted `scrypt` hash strings.
* **Session Cache Management**: State caching using an integrated local Redis 7 instance for JWT access and refresh token rotations.
* **Onboarding & Connection Handshake**: Visually complete Link Account portal (`/drive/connect`) with active verification and validation state fields.
* **Gateway Specs & Monitoring**: Standard system health indicator (`/health`) and interactive swagger REST documentation (`/docs`) for development teams.
* **Automated Delivery Pipeline**: Connected GitHub Actions pipeline that verifies checks and automatically forces a git sync to Hugging Face Spaces on every commit to `main`.

### 🟡 Phase 2: Relational Drive & AI Graph — `v2.0.0-dev` (Active Development)
*Status: **Design Lock & In Progress** | Target: [Phase 2 Design Specification](mds/Phase2_Implementation.md)*
* **OTP Telegram Verification Flow**: Implementation of backend OTP and 2FA credential handlers linking directly to live MTProto interfaces.
* **Parallel Chunk Upload Queue**: Split large uploads (up to 2GB) into 512KB physical parts, executing up to 4 concurrent uploads with random jitter and `FLOOD_WAIT` sleep interceptors.
* **Virtual Directory Management**: Fully virtual foldering system mapping file structures recursively without modifying objects on Telegram.
* **High-Context AI Integration**: Migration to **Gemini 2.5 Flash** (supporting a 1M+ token context window) for instant text summaries, semantic tagging, and document chat.
* **WebVerse Force Graph UI**: Interactive force-directed network diagram using **React Flow** visualizing virtual relational links (e.g. `receipt_of`, `depends_on`) between stored files.

---

## 📂 Project Documentation Hub (`mds/`)

Our core design logs, compliance parameters, and test criteria are versioned and stored in the dedicated `/mds` directory:

| Document | Purpose | Target Audience |
|---|---|---|
| [📄 Phase 0 Specs](mds/Phase0_TeleVerse_Documentation.md) | Original specifications and high-level project vision. | Product owners & Stakeholders |
| [📄 Phase 1 Incident Report](mds/Phase1_Foundation.md) | Full breakdown of baseline architecture and resolved runtime bugs. | DevOps & Systems Engineers |
| [📄 Phase 1 Tester Guide](mds/Phase1_Tester_Guide.md) | Detailed manual QA scripts, endpoint validations, and database checks. | QA Engineers & Testers |
| [📄 Phase 2 Design & Spec](mds/Phase2_Implementation.md) | Blueprint for rate limiting, Gemini AI migration, and WebVerse models. | Core Developers |

---

## 🧪 Automated Testing Strategy (100% Free Services)

To scale verification, catch visual bugs, and validate endpoint health automatically, we can integrate the following **entirely free** automated services:

### 1. Headless End-to-End Testing (GitHub Actions + Playwright)
* **Strategy**: Run real browser automated user actions on every PR.
* **Why it's Free**: GitHub Actions provides **2,000 free minutes/month** for public repositories.
* **Implementation Plan**:
  Add an E2E step to `.github/workflows/ci.yml` that boots up local database containers, runs the project dev servers, and runs Playwright:
  ```yaml
  e2e-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: televerse_test
          POSTGRES_USER: televerse
          POSTGRES_PASSWORD: televerse
        ports: [5432:5432]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '9.4.0' }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Install Playwright Browsers
        run: pnpm exec playwright install --with-deps
      - name: Build & Run tests
        run: |
          pnpm build
          pnpm exec playwright test
        env:
          DATABASE_URL: postgresql://televerse:televerse@localhost:5432/televerse_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-32-chars-minimum-here
          SESSION_ENCRYPTION_KEY: 0000000000000000000000000000000000000000000000000000000000000000
          TG_API_ID: 12345
          TG_API_HASH: test_hash
  ```

### 2. Ongoing Health Monitoring (UptimeRobot / Better Stack)
* **Strategy**: Set up an external automated check pinging our health API endpoint.
* **Why it's Free**:
  - **UptimeRobot**: Free tier includes **50 HTTP monitors** running at 5-minute intervals.
  - **Better Stack Uptime**: Free tier includes email alerts, phone notifications, and a status page.
* **Verification Route**: Configure the monitor to hit `https://talpadeavi20-televerse.hf.space/health` and verify it expects an HTTP `200 OK` returning `{"status":"ok"}`.

### 3. Frontend Lighthouse Auditing (Lighthouse CI Action)
* **Strategy**: Keep track of Web Vitals (LCP, FID, CLS) and mobile responsive layout quality directly inside GitHub pull requests.
* **Why it's Free**: The `@lhci/cli` runs inside standard GitHub runner containers.
* **Implementation Plan**:
  Integrate Lighthouse CI into pull request pipelines to audit built Next.js pages, reporting ratings as a PR comment and blocking code merges if performance scores drop below 90.

### 4. Code Coverage Auditing (Codecov)
* **Strategy**: Visualizes test coverage reports directly inside pull request line-diffs.
* **Why it's Free**: **Codecov** and **Code Climate** are 100% free with unlimited coverage reports for all public/open-source repositories.
* **Implementation Plan**:
  Generate coverage logs using Vitest during the CI pipeline (`vitest run --coverage`) and upload them via `codecov/codecov-action` in the CI file.

---

## 🏛️ Monorepo Architecture

```
televerse/
├── apps/
│   ├── web/          Next.js 14 frontend (stand-alone mode, port 3000)
│   └── api/          Fastify backend (REST + WebSockets, port 4000)
├── packages/
│   ├── types/        Shared TypeScript interface definitions
│   ├── shared/       Encryption (AES-256-GCM), sleep helpers, and chunking utils
│   ├── db/           Drizzle ORM postgres schema mapping & migrations
│   └── sdk/          JavaScript SDK for third-party developer access
└── infra/
    ├── docker/       Development and production Docker files
    ├── huggingface/  Edge reverse proxies (Nginx config) and boot entrypoints
    └── migrations/   SQL differential logs generated by drizzle-kit
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend UI** | Next.js 14 + Tailwind CSS + Lucide Icons + React Query |
| **API Gateway** | Fastify + Swagger UI + WebSocket (ws) |
| **Database** | PostgreSQL 16 + pgvector + Drizzle ORM |
| **Session Cache** | Redis 7 + JWT Rotation |
| **Storage Engine** | Telegram MTProto API via GramJS |
| **Local Proxy** | Nginx (serving on Hugging Face port 7860) |
| **Package Engine**| pnpm workspaces |
| **Test Runner** | Vitest |

---

## 🚀 Quick Start Guide

### Prerequisites
* Node.js ≥ 20
* pnpm ≥ 9
* Docker & Docker Compose
* Telegram Client App ID & Hash (`api_id` + `api_hash` registered via [my.telegram.org](https://my.telegram.org))

### Setup & Run
1. **Clone the Repo**:
   ```bash
   git clone https://github.com/talpadeavi03/televerse
   cd televerse
   pnpm install
   ```
2. **Environment Variables**:
   Configure `.env` variables for the backend and frontend:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```
3. **Boot Database and Cache**:
   ```bash
   docker compose up -d postgres redis
   ```
4. **Apply Schema Migrations**:
   ```bash
   pnpm db:migrate
   ```
5. **Start Dev Servers**:
   ```bash
   pnpm dev
   ```
   * Live Frontend: `http://localhost:3000`
   * Live API Server: `http://localhost:4000`
   * Swagger Documentation UI: `http://localhost:4000/docs`

---

## 📜 Monorepo Scripts Reference

| Command | Action |
|---|---|
| `pnpm dev` | Starts Fastify API and Next.js Frontend concurrently in developer watch mode. |
| `pnpm build` | Compiles both application layers and build assets. |
| `pnpm test` | Triggers Vitest to run all packages and API endpoints test files. |
| `pnpm lint` | Audits the codebases for formatting errors and rules compliance. |
| `pnpm format` | Formats all source files across the monorepo using Prettier. |
| `pnpm db:migrate` | Installs the latest generated Drizzle SQL schema files to the database. |

---

## ⚖️ Legal & Compliance

TeleVerse operates strictly in accordance with the **Telegram API Terms of Service**:
1. TeleVerse acts as a client wrapper. It does not operate automated spam programs or scrape data.
2. File data is stored completely inside **users' own accounts**. TeleVerse servers do not mirror, cache, or capture file content buffers permanently.
3. Access is 100% under user control. Sessions can be revoked at any time by the user from their native Telegram Settings ➜ Devices panel.

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
