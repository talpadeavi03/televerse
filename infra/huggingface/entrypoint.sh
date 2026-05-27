#!/bin/sh
set -e

echo "Starting local Redis..."
redis-server --daemonize yes --port 6379

echo "Setting up Postgres database..."
DB_DIR="/data/postgres"

# Test if we can write to /data, otherwise fallback to /tmp/postgres
if mkdir -p /data/test_write 2>/dev/null; then
    rm -rf /data/test_write
    echo "✓ /data is writeable. Using persistent storage."
else
    echo "⚠ /data is NOT writeable (possibly owned by root). Falling back to ephemeral storage in /tmp/postgres."
    DB_DIR="/tmp/postgres"
fi

mkdir -p "$DB_DIR"

# Initialize DB if not already initialized
if [ ! -s "$DB_DIR/PG_VERSION" ]; then
    echo "Initializing Postgres database..."
    initdb -D "$DB_DIR"
    
    # Configure postgres to allow local connections
    echo "host all all 127.0.0.1/32 trust" >> "$DB_DIR/pg_hba.conf"
fi

echo "Starting Postgres server..."
pg_ctl -D "$DB_DIR" -h 127.0.0.1 -l /tmp/postgres.log start

# Wait for postgres to be ready (up to 15 seconds)
echo "Waiting for Postgres to start..."
retries=0
until pg_isready -h 127.0.0.1 > /dev/null 2>&1 || [ $retries -eq 15 ]; do
  sleep 1
  retries=$((retries + 1))
done

if ! pg_isready -h 127.0.0.1 > /dev/null 2>&1; then
  echo "❌ Postgres failed to start! Printing database logs:"
  cat /tmp/postgres.log
  exit 1
fi

echo "Setting up database extensions..."
psql -h 127.0.0.1 -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql -h 127.0.0.1 -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"
psql -h 127.0.0.1 -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"vector\";"

# Create televerse database if missing
psql -h 127.0.0.1 -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'televerse'" | grep -q 1 || \
psql -h 127.0.0.1 -d postgres -c "CREATE DATABASE televerse;"

echo "Running migrations..."
DATABASE_URL=postgresql://127.0.0.1:5432/televerse pnpm --filter @televerse/api run db:migrate || echo "Migrations skipped or already applied"

echo "Starting Fastify API..."
DATABASE_URL=postgresql://127.0.0.1:5432/televerse \
REDIS_URL=redis://127.0.0.1:6379 \
PORT=4000 \
NODE_ENV=production \
node apps/api/dist/server.js &

echo "Starting Next.js Frontend..."
PORT=3000 \
node apps/web/server.js &

echo "Starting Nginx Reverse Proxy on port 7860..."
nginx -c /app/infra/huggingface/nginx.conf -g "daemon off;"
