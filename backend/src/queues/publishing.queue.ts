import { Queue } from 'bullmq';

export const publishingQueue = new Queue('report-generation', {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});
