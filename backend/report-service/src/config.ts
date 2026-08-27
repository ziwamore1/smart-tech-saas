import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const redisUrl = process.env.REDIS_URL?.trim();
if (!redisUrl) {
  console.warn('REDIS_URL is not configured; report worker will run in degraded mode');
}
const redisEndpoint = redisUrl ? new URL(redisUrl) : undefined;

export const config = {
  redis: redisEndpoint ? {
    host: redisEndpoint.hostname,
    port: parseInt(redisEndpoint.port || '6379', 10),
    username: redisEndpoint.username ? decodeURIComponent(redisEndpoint.username) : undefined,
    password: redisEndpoint.password ? decodeURIComponent(redisEndpoint.password) : undefined,
    tls: redisEndpoint.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
    commandTimeout: 5000,
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (attempt: number) => Math.min(1000 * 2 ** Math.min(attempt - 1, 5), 30000),
  } : null,
  queue: {
    name: process.env.REPORT_QUEUE_NAME || 'report-generation',
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3', 10),
  },
  puppeteer: {
    headless: true,
    timeout: parseInt(process.env.PUPPETEER_TIMEOUT || '120000', 10),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
  storage: {
    outputDir: process.env.REPORT_OUTPUT_DIR || path.resolve(__dirname, '..', 'output'),
    baseUrl: process.env.REPORT_BASE_URL || 'http://localhost:3001/api/v1/reports/download',
  },
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api/v1',
    key: process.env.INTERNAL_API_KEY || 'report-service-key',
  },
  server: {
    port: parseInt(process.env.REPORT_SERVICE_PORT || '3005', 10),
  },
};
