#!/usr/bin/env bash
# TeleVerse project setup script
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

# Check prerequisites
command -v node >/dev/null || error "Node.js 20+ required"
command -v pnpm >/dev/null || error "pnpm 9+ required (run: npm i -g pnpm)"
command -v docker >/dev/null || warn "Docker not found — skip Docker setup"

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
[[ "$NODE_VER" -lt 20 ]] && error "Node.js 20+ required (found v${NODE_VER})"

log "Installing dependencies..."
pnpm install

log "Setting up environment files..."
[[ -f apps/api/.env ]] || cp apps/api/.env.example apps/api/.env && log "Created apps/api/.env"
[[ -f apps/web/.env.local ]] || cp apps/web/.env.example apps/web/.env.local && log "Created apps/web/.env.local"

log "Setting up git hooks..."
pnpm prepare 2>/dev/null || true

if command -v docker >/dev/null; then
  log "Starting Docker services (Postgres + Redis)..."
  docker compose up -d postgres redis
  log "Waiting for database to be ready..."
  sleep 5
  log "Running database migrations..."
  pnpm db:migrate
else
  warn "Skipping Docker/DB setup — configure DATABASE_URL manually"
fi

log ""
log "✅ Setup complete!"
log ""
log "Next steps:"
log "  1. Edit apps/api/.env with your Telegram API credentials"
log "  2. Get api_id and api_hash from https://my.telegram.org"
log "  3. Set GROQ_API_KEY from https://console.groq.com"
log "  4. Run: pnpm dev"
log ""
log "  Frontend: http://localhost:3000"
log "  API:      http://localhost:4000"
log "  API Docs: http://localhost:4000/docs"
