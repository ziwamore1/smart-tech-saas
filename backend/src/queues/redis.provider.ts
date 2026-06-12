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
      retryStrategy: () => null,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      commandTimeout: 5000,
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

    client.connect().catch((err: Error) => {
      logger.warn(`Redis connection failed: ${err.message}`);
    });

    return client;
  },
};
