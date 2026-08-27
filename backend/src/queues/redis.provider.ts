import { Provider, Logger } from '@nestjs/common';
import { REDIS_CLIENT_TOKEN } from './queue-definitions';
import { createRedisClient } from './redis.config';
import Redis from 'ioredis';

const logger = new Logger('RedisProvider');

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT_TOKEN,
  useFactory: () => {
    const client = createRedisClient();
    if (!client) {
      logger.log('REDIS_URL not configured — Redis disabled');
      return null;
    }

    let lastErrorLog = 0;
    let reconnectCount = 0;

    client.on('connect', () => {
      logger.log('Redis connected');
    });

    client.on('ready', () => {
      logger.log(`Redis ready (reconnects: ${reconnectCount})`);
    });

    client.on('close', () => {
      if (Date.now() - lastErrorLog > 30_000) {
        lastErrorLog = Date.now();
        logger.warn('Redis connection lost; retrying with backoff');
      }
    });

    client.on('error', (error) => {
      if (Date.now() - lastErrorLog > 30_000) {
        lastErrorLog = Date.now();
        logger.warn(`Redis connection error: ${error.message}`);
      }
    });

    client.on('reconnecting', () => {
      reconnectCount++;
      if (Date.now() - lastErrorLog > 30_000) {
        lastErrorLog = Date.now();
        logger.log(`Redis reconnect attempt ${reconnectCount}`);
      }
    });

    // Connect in background — never block startup; retryStrategy handles retries
    client.connect().catch(() => {});

    return client;
  },
};
