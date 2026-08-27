import { Queue } from 'bullmq';
import { createRedisClient } from './redis.config';

const connection = createRedisClient();

export const publishingQueue = connection
  ? new Queue('report-generation', { connection, defaultJobOptions: { removeOnComplete: { age: 86400 } } })
  : (null as unknown as Queue);
