import { Provider, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN } from './queue-definitions';

const logger = new Logger('RedisProvider');

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT_TOKEN,
  useFactory: () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    const client = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        return Math.min(times * 1000, 10000);
      },
    });

    client.on('connect', () => {
      logger.log('Redis connected successfully');
    });

    client.on('ready', () => {
      logger.log('Redis ready');
    });

    client.on('error', () => {});

    client.connect().catch((err: Error) => {
      logger.error(`Redis connection failed: ${err.message}`);
    });

    return client;
  },
};
