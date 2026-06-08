# Backend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (canvas, etc.)
RUN apk add --no-cache python3 build-base cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev

# Install dependencies (including devDependencies needed for build)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source code (including prisma schema)
COPY . .

# Generate Prisma client from schema
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (canvas, etc.)
RUN apk add --no-cache python3 build-base cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Create logs directory
RUN mkdir -p logs

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Start the application
CMD ["node", "dist/main.js"]
