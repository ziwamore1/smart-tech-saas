# Digital Signature Service (Part B) Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client, then build with SWC (typeCheck disabled in nest-cli)
RUN npx prisma generate && \
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

RUN npx prisma generate && mkdir -p /app/data && \
    addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-4001}/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma || npx prisma db push --skip-generate; node dist/main.js"]
