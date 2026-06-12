# Backend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (canvas, etc.) and OpenSSL for Prisma engine
RUN apk add --no-cache python3 build-base cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev openssl

# Install dependencies (including devDependencies needed for build)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source code (including prisma schema)
COPY . .

# Generate Prisma client from schema (OpenSSL 3 detection)
RUN npx prisma generate

# Build the application with reduced memory for Railway
RUN node --max-old-space-size=2048 ./node_modules/@nestjs/cli/bin/nest.js build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (canvas, etc.) and OpenSSL for Prisma engine
RUN apk add --no-cache --virtual .build-deps python3 build-base cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev openssl

# Copy package.json and install ALL deps (including dev, needed for build at runtime if start command rebuilds)
COPY package*.json ./
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Remove build-only deps to shrink image
RUN apk del .build-deps

# Generate Prisma client from schema (OpenSSL 3 detection)
RUN npx prisma generate

# Create logs directory
RUN mkdir -p logs

# Port auto-detected by Railway via PORT env var

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app/logs
USER nodejs

# Start the application
CMD ["node", "dist/main.js"]
