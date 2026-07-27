# ── Stage 1: base ────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ── Stage 2: install dependencies ────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./

COPY packages/config/package.json      ./packages/config/
COPY packages/domain/package.json      ./packages/domain/
COPY packages/database/package.json    ./packages/database/
COPY packages/api-schema/package.json  ./packages/api-schema/
COPY packages/blockchain/package.json  ./packages/blockchain/
COPY packages/queue/package.json       ./packages/queue/
COPY packages/storage/package.json     ./packages/storage/

COPY apps/worker/package.json          ./apps/worker/

RUN pnpm install --frozen-lockfile

# ── Stage 3: build ───────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm --filter @openbadge/config    build || true
RUN pnpm --filter @openbadge/domain    build
RUN pnpm --filter @openbadge/database  generate
RUN pnpm --filter @openbadge/database  build
RUN pnpm --filter @openbadge/api-schema build
RUN pnpm --filter @openbadge/blockchain build
RUN pnpm --filter @openbadge/queue     build
RUN pnpm --filter @openbadge/storage   build
RUN pnpm --filter @openbadge/worker    build

# ── Stage 4: production runner ────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 openbadge

COPY --from=builder --chown=openbadge:nodejs /app/apps/worker/dist      ./apps/worker/dist
COPY --from=builder --chown=openbadge:nodejs /app/apps/worker/package.json ./apps/worker/
COPY --from=builder --chown=openbadge:nodejs /app/packages              ./packages
COPY --from=builder --chown=openbadge:nodejs /app/node_modules          ./node_modules

USER openbadge

CMD ["node", "apps/worker/dist/index.js"]
