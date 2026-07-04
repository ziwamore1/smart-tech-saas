import { Provider, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN } from './queue-definitions';

const logger = new Logger('RedisProvider');

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT_TOKEN,
  useFactory: () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.log('REDIS_URL not configured — Redis disabled');
      return null;
    }

    const client = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
      enableOfflineQueue: true,
      connectTimeout: 10000,
      commandTimeout: 10000,
    });

    client.on('connect', () => {
      logger.log('Redis connected');
    });

    client.on('ready', () => {
      logger.log('Redis ready');
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    client.on('error', () => {
      logger.warn('Redis connection error (Redis may be unavailable)');
    });

    client.on('reconnecting', () => {
      logger.log('Redis reconnecting...');
    });

    // Connect in background — never block startup; retryStrategy handles retries
    client.connect().catch(() => {});

    return client;
  },
};
