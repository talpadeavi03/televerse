FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# Install runtime system packages (Postgres, Redis, Nginx)
RUN apk add --no-cache postgresql postgresql-contrib redis nginx

# Compile pgvector extension from source
RUN apk add --no-cache --virtual .build-deps git make gcc musl-dev clang-dev llvm-dev postgresql-dev && \
    git clone https://github.com/pgvector/pgvector.git && \
    cd pgvector && \
    make && \
    make install && \
    cd .. && rm -rf pgvector && \
    apk del .build-deps

# Create /data directory for persistent storage
RUN mkdir -p /data && chmod -R 777 /data

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/sdk/package.json ./packages/sdk/
RUN pnpm install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @televerse/api build && \
    pnpm --filter @televerse/web build

FROM base AS runner
WORKDIR /app

# Copy the entire built application with all nested node_modules
COPY --from=builder /app ./

# Next.js standalone setup
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Copy configs and entrypoint script
COPY infra/huggingface ./infra/huggingface
RUN chmod +x ./infra/huggingface/entrypoint.sh

# Set correct permissions so Hugging Face user (UID 1000) owns everything
RUN chown -R 1000:1000 /app /data /var/lib/nginx /var/log/nginx /run

USER 1000
EXPOSE 7860
ENV PORT=7860 HOME=/tmp

ENTRYPOINT ["./infra/huggingface/entrypoint.sh"]
