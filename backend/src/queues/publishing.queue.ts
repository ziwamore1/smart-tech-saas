import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || '';
const connection = redisUrl.startsWith('rediss://')
  ? new IORedis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true, enableReadyCheck: false })
  : undefined;

export const publishingQueue = connection
  ? new Queue('report-generation', { connection, defaultJobOptions: { removeOnComplete: { age: 86400 } } })
  : (null as unknown as Queue);
