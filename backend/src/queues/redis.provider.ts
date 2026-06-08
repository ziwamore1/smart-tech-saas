import { Provider, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN } from './queue-definitions';

const logger = new Logger('RedisProvider');

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT_TOKEN,
  useFactory: () => {
    const client = new Redis(process.env.REDIS_URL!, {
      tls: {
        rejectUnauthorized: false,
      },

      maxRetriesPerRequest: null,
      enableReadyCheck: false,

      retryStrategy(times) {
        return Math.min(times * 200, 2000);
      },
    });

    client.on('connect', () => {
      logger.log('✅ Redis connected successfully');
    });

    client.on('ready', () => {
      logger.log('✅ Redis ready');
    });

    client.on('error', (err) => {
      logger.error(`❌ Redis connection error: ${err?.message}`);
    });

    client.on('close', () => {
      logger.warn('⚠️ Redis connection closed');
    });

    client.on('reconnecting', () => {
      logger.warn('🔄 Redis reconnecting...');
    });

    return client;
  },
};
