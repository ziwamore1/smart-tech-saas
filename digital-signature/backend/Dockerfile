# Digital Signature Service (Part B) Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# DATABASE_URL is only needed at build time to parse the datasource block;
# Prisma does not connect during `generate`. The real URL is injected at
# runtime via compose (postgres). Override with --build-arg DATABASE_URL=….
ARG DATABASE_URL=postgresql://build:build@localhost:5432/signatures

# Generate Prisma client from the PostgreSQL schema (production), then build
# with SWC (typeCheck disabled in nest-cli).
RUN npx prisma generate --schema=./prisma/schema.postgres.prisma && \
    ./node_modules/@nestjs/cli/bin/nest.js build && \
    test -f dist/main.js || (echo "BUILD FAILED" && exit 1)

FROM node:20-alpine

WORKDIR /app

# OpenSSL required by Prisma engines; persists (no --virtual)
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN npx prisma generate --schema=./prisma/schema.postgres.prisma && mkdir -p /app/data && \
    addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-4001}/health || exit 1

# Production uses PostgreSQL: apply the checked-in migration baseline, then boot.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.postgres.prisma; node dist/main.js"]
