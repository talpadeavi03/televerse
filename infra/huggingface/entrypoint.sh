#!/bin/sh
set -e

echo "=================================================="
echo "🛡️ TELEVERSE STARTUP: Checking Prerequisites..."
echo "=================================================="
MISSING_VARS=""
for var in SESSION_ENCRYPTION_KEY JWT_SECRET INTERNAL_SECRET TG_API_ID TG_API_HASH; do
    eval val=\$$var
    if [ -z "$val" ]; then
        MISSING_VARS="$MISSING_VARS $var"
    fi
done

if [ ! -z "$MISSING_VARS" ]; then
    echo "❌ CRITICAL ERROR: The following required environment variables are missing:$MISSING_VARS"
    echo "Please configure these in your Hugging Face Space Settings -> Variables and Secrets!"
    exit 1
fi
echo "✓ All required environment variables are configured successfully."
echo "=================================================="

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
chmod 700 "$DB_DIR"

# Initialize DB if not already initialized or if corrupted
is_corrupted=false
if [ -d "$DB_DIR" ] && [ -f "$DB_DIR/PG_VERSION" ]; then
    # Verify critical subdirectories exist
    for sub in base global pg_notify pg_wal; do
        if [ ! -d "$DB_DIR/$sub" ]; then
            echo "⚠ Detected corrupted or incomplete Postgres database cluster (missing $sub). Wiping and re-initializing..."
            is_corrupted=true
            break
        fi
    done
fi

if [ ! -s "$DB_DIR/PG_VERSION" ] || [ "$is_corrupted" = true ]; then
    echo "Initializing Postgres database..."
    # Wiping with atomic metadata rename fallback to bypass NFS lock files and 'Directory not empty' errors
    BACKUP_DIR="${DB_DIR}_corrupted_$(date +%s)"
    echo "Moving corrupted cluster out of the way to: $BACKUP_DIR"
    mv "$DB_DIR" "$BACKUP_DIR" 2>/dev/null || rm -rf "$DB_DIR"
    
    mkdir -p "$DB_DIR"
    chmod 700 "$DB_DIR"
    initdb -D "$DB_DIR"
    
    # Configure postgres to allow local connections
    echo "host all all 127.0.0.1/32 trust" >> "$DB_DIR/pg_hba.conf"
fi

echo "Starting Postgres server..."
pg_ctl -D "$DB_DIR" -o "-h 127.0.0.1 -k /tmp" -l /tmp/postgres.log start || {
  echo "❌ Postgres failed to start! Printing database logs:"
  cat /tmp/postgres.log
  exit 1
}

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

# Create televerse database if missing
psql -h 127.0.0.1 -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'televerse'" | grep -q 1 || \
psql -h 127.0.0.1 -d postgres -c "CREATE DATABASE televerse;"

echo "Setting up database extensions on televerse..."
psql -h 127.0.0.1 -d televerse -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql -h 127.0.0.1 -d televerse -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"
psql -h 127.0.0.1 -d televerse -c "CREATE EXTENSION IF NOT EXISTS \"vector\";"

echo "Running migrations..."
DATABASE_URL=postgresql://127.0.0.1:5432/televerse pnpm --filter @televerse/api run db:migrate || echo "Migrations skipped or already applied"

echo "Starting Fastify API..."
DATABASE_URL=postgresql://127.0.0.1:5432/televerse \
REDIS_URL=redis://127.0.0.1:6379 \
PORT=4000 \
HOST=0.0.0.0 \
NODE_ENV=production \
pnpm --filter @televerse/api start > /tmp/api.log 2>&1 &

echo "Starting Next.js Frontend..."
PORT=3000 \
HOSTNAME=0.0.0.0 \
node apps/web/server.js > /tmp/web.log 2>&1 &

# Give background servers 5 seconds to start
sleep 5

echo "Checking backend servers health..."
api_healthy=true
web_healthy=true

if ! nc -z 127.0.0.1 4000; then
  echo "❌ Fastify API failed to start! Printing logs from /tmp/api.log:"
  cat /tmp/api.log || echo "No API log found"
  api_healthy=false
fi

if ! nc -z 127.0.0.1 3000; then
  echo "❌ Next.js Frontend failed to start! Printing logs from /tmp/web.log:"
  cat /tmp/web.log || echo "No Web log found"
  web_healthy=false
fi

if [ "$api_healthy" = true ] && [ "$web_healthy" = true ]; then
  echo "=================================================="
  echo "🎉 SUCCESS: TeleVerse is fully up and running!"
  echo "👉 Web Access: https://talpadeavi20-televerse.hf.space"
  echo "=================================================="
else
  echo "❌ CRITICAL: One or more backend servers failed to start!"
fi

echo "Starting Nginx Reverse Proxy on port 7860..."
nginx -c /app/infra/huggingface/nginx.conf -g "daemon off;"
