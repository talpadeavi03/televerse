FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

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

COPY tsconfig.json ./
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/
RUN pnpm --filter @televerse/api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages ./packages

EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
