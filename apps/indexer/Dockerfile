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
COPY apps/indexer/package.json         ./apps/indexer/

RUN pnpm install --frozen-lockfile

# ── Stage 3: build ───────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared packages in dependency order
RUN pnpm --filter @openbadge/config    build || true
RUN pnpm --filter @openbadge/domain    build
RUN pnpm --filter @openbadge/database  generate
RUN pnpm --filter @openbadge/database  build
RUN pnpm --filter @openbadge/blockchain build

# Build the indexer
RUN pnpm --filter @openbadge/indexer   build

# ── Stage 4: production runner ────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 openbadge

# Only copy what is needed at runtime
COPY --from=builder --chown=openbadge:nodejs /app/apps/indexer/dist      ./apps/indexer/dist
COPY --from=builder --chown=openbadge:nodejs /app/apps/indexer/package.json ./apps/indexer/
COPY --from=builder --chown=openbadge:nodejs /app/packages                ./packages
COPY --from=builder --chown=openbadge:nodejs /app/node_modules            ./node_modules

USER openbadge

CMD ["node", "apps/indexer/dist/index.js"]
