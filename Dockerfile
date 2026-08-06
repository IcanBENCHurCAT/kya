# /home/st9797/.openclaw/workspace/agents/coding/kya-service/Dockerfile
#
# KYA Service — Know Your Agent (Sanctions Screening)
# Multi-stage build for minimal production image
#
# Build: docker build -t kya-service .
# Run:   docker run -p 3000:3000 --env-file .env kya-service
#
# Licensed under AGPL-3.0 — See LICENSE file for details.

# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first (leverage Docker layer cache)
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund 2>&1 | tail -5

# Copy source and build
COPY src/ ./src/
RUN npm run build 2>&1 | tail -5

# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM node:22-alpine AS production

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=UTC

# Install only production dependencies (faster, smaller)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -3

# Copy built application
COPY --from=build /app/dist/ ./dist/

# Create data directory for runtime files (watchlists, audit logs)
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
