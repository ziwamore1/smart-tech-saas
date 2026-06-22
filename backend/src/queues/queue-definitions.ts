import { JobsOptions } from 'bullmq';

export const QUEUE_NAMES = {
  REPORT_GENERATION: 'report-generation',
  ANALYTICS: 'analytics-computation',
  EXPORT: 'export-jobs',
  AI_REPORT: 'ai-report-generation',
  NOTIFICATION: 'notification-delivery',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_DEFAULT_OPTIONS: Record<QueueName, JobsOptions> = {
  [QUEUE_NAMES.REPORT_GENERATION]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 86400, count: 100 },
    removeOnFail: { age: 604800, count: 50 },
  },
  [QUEUE_NAMES.ANALYTICS]: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 86400, count: 100 },
  },
  [QUEUE_NAMES.EXPORT]: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 3000 },
    removeOnComplete: { age: 7200, count: 50 },
    removeOnFail: { age: 86400, count: 50 },
  },
  [QUEUE_NAMES.AI_REPORT]: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { age: 86400, count: 100 },
    removeOnFail: { age: 604800, count: 50 },
  },
  [QUEUE_NAMES.NOTIFICATION]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 86400, count: 200 },
    removeOnFail: { age: 604800, count: 100 },
  },
};

export const REDIS_CLIENT_TOKEN = 'REDIS_CLIENT';
