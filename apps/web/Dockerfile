# ── Stage 1: base ────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ── Stage 2: install dependencies ────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./

# Shared packages
COPY packages/config/package.json      ./packages/config/
COPY packages/domain/package.json      ./packages/domain/
COPY packages/database/package.json    ./packages/database/
COPY packages/api-schema/package.json  ./packages/api-schema/
COPY packages/blockchain/package.json  ./packages/blockchain/
COPY packages/queue/package.json       ./packages/queue/
COPY packages/storage/package.json     ./packages/storage/

# App manifest
COPY apps/web/package.json             ./apps/web/

RUN pnpm install --frozen-lockfile

# ── Stage 3: build ───────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Ensure the public dir exists so the runner COPY never fails
RUN mkdir -p apps/web/public

# Build the Next.js app (output: "standalone")
RUN pnpm --filter @openbadge/web build

# ── Stage 4: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone output contains the monorepo layout (server.js at apps/web/)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public           ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
