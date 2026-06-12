# Backend Dockerfile — build context is repo root, backend/ contains the app
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 build-base cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev openssl

# Copy backend package files and install deps
COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps

# Copy entire backend source
COPY backend/ ./

# Generate Prisma client and build
RUN npx prisma generate
RUN node --max-old-space-size=4096 node_modules/@nestjs/cli/bin/nest.js build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache --virtual .build-deps python3 build-base cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev openssl

# Copy and install ALL deps (dev deps included to support npm run build if needed)
COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Copy built app and prisma schema from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN apk del .build-deps

# Generate Prisma client
RUN npx prisma generate

RUN mkdir -p logs

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app/logs
USER nodejs

CMD ["node", "dist/main.js"]
