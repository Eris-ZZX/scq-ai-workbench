# syntax=docker/dockerfile:1

# pnpm 11 requires Node >=22.13; application runtime remains Node 20 below.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=768
ENV NEXT_BUILD_CPUS=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Turbopack emits hashed external-module aliases under .next/node_modules.
# The standalone tree already contains their traced pnpm package bodies.
COPY --from=builder --chown=nextjs:nodejs /app/.next/node_modules ./.next/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/db/seed-data ./db/seed-data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
