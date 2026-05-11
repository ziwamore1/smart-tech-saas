import { Provider, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN } from './queue-definitions';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT_TOKEN,
  useFactory: () => {
    const logger = new Logger('RedisProvider');
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    const client = new Redis({
      host,
      port,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 5000);
        return delay;
      },
    });

    client.on('connect', () => {
      logger.log(`Connected to Redis at ${host}:${port}`);
    });

    client.on('error', (err) => {
      logger.error(`Redis connection error: ${err.message}`);
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    return client;
  },
};
