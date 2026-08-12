# Multi-stage Dockerfile for KYA Service (Know Your Agent)
# Base image: node:20-alpine

# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund

# Copy source files and compile TypeScript to dist/
COPY src/ ./src/
RUN npm run build

# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Create non-root system group and user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=UTC

# Install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy compiled JavaScript output from build stage
COPY --from=build /app/dist/ ./dist/

# Create runtime data directory for watchlists and audit logs
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/v1/health || exit 1

CMD ["node", "dist/app.js"]
