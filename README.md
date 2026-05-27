---
title: TeleVerse
emoji: 🌌
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# TeleVerse
> Telegram-powered cloud file manager — store unlimited files in your own Telegram account

[![CI](https://github.com/your-org/televerse/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/televerse/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Architecture

```
televerse/
├── apps/
│   ├── web/          Next.js 14 frontend (file manager UI)
│   └── api/          Fastify backend (REST + WebSocket)
├── packages/
│   ├── types/        Shared TypeScript types
│   ├── shared/       Shared utilities & constants
│   ├── db/           Drizzle ORM schema & migrations
│   └── sdk/          JavaScript SDK for third-party devs
└── infra/
    ├── docker/       Docker configs
    └── migrations/   SQL migration files
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 + Tailwind CSS + TypeScript |
| Backend | Fastify + TypeScript |
| Database | PostgreSQL 16 + Drizzle ORM |
| Cache | Redis 7 |
| Storage | Telegram MTProto (GramJS) |
| Auth | JWT + Supabase Auth / custom |
| Realtime | WebSocket (ws) |
| AI | Groq (llama-3.3-70b) |
| Deploy | Docker Compose |
| CI/CD | GitHub Actions |
| Package | pnpm workspaces |

## Quick Start

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Docker + Docker Compose
- Telegram API credentials (`api_id` + `api_hash` from [my.telegram.org](https://my.telegram.org))

### Setup

```bash
# Clone and install
git clone https://github.com/your-org/televerse
cd televerse
pnpm install

# Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit both .env files with your credentials

# Start infrastructure
docker compose up -d postgres redis

# Run migrations
pnpm db:migrate

# Start dev servers
pnpm dev
```

Frontend: http://localhost:3000  
API: http://localhost:4000  
API Docs: http://localhost:4000/docs

## Environment Variables

See [apps/api/.env.example](apps/api/.env.example) and [apps/web/.env.example](apps/web/.env.example).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `pnpm docker:up` | Start Docker services |
| `pnpm db:migrate` | Run database migrations |

## Legal

TeleVerse uses the Telegram MTProto Client API — the same protocol used by Nicegram, Telegram X, and all third-party Telegram clients. This is explicitly permitted by the [Telegram API Terms of Service](https://core.telegram.org/api/terms).

Files are stored in **users' own Telegram accounts** — TeleVerse never holds user files.

## License

MIT © TeleVerse Contributors
