import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const redisUrl = process.env.REDIS_URL;

export const config = {
  redis: redisUrl ? {
    url: redisUrl,
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  } : {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
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
