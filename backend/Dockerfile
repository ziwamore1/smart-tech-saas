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

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (canvas, etc.) and OpenSSL for Prisma engine
RUN apk add --no-cache python3 build-base cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev openssl

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

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
