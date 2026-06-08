import { Queue, QueueEvents, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Lesson } from '../solver/fastCSPSolver';
import { SlotIndex } from '../entities/cache';
import { HybridConfig, PenaltyWeights } from '../solver/fastHybridSolver';

const connection = new IORedis(process.env.REDIS_URL!, {
  tls: {
    rejectUnauthorized: false,
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

export interface TimetableJobData {
  lessons: Lesson[];
  slots: SlotIndex[];
  config?: Partial<HybridConfig>;
  weights?: PenaltyWeights;
  schoolId?: string;
  userId?: string;
}

export interface TimetableJobResult {
  success: boolean;
  schedule: any;
  score: number;
  method: 'csp' | 'hybrid';
  cspIterations: number;
  cspBacktracks: number;
  geneticIterations: number;
  timeElapsed: number;
}

export const timetableQueue = new Queue<TimetableJobData>('timetable', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 3600,
    },
    removeOnFail: {
      count: 50,
    },
  },
});

export const queueEvents = new QueueEvents('timetable', {
  connection,
});

export function createJob(
  data: TimetableJobData,
  options?: { priority?: number; delay?: number }
) {
  return timetableQueue.add('generate', data, {
    priority: options?.priority ?? 2,
    delay: options?.delay,
  });
}

export function createHighPriorityJob(data: TimetableJobData) {
  return timetableQueue.add('generate', data, {
    priority: 1,
  });
}

export async function getJobStatus(jobId: string) {
  const job = await timetableQueue.getJob(jobId);
  
  if (!job) {
    return null;
  }

  const state = await job.getState();
  
  return {
    id: job.id,
    state,
    result: job.returnvalue,
    progress: job.progress,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    createdOn: job.timestamp,
  };
}

export async function getWaitingJobs() {
  const waiting = await timetableQueue.getWaiting();
  const active = await timetableQueue.getActive();
  
  return {
    waiting: waiting.length,
    active: active.length,
  };
}

export async function clearOldJobs(olderThanHours: number = 24) {
  const jobs = await timetableQueue.clean(olderThanHours * 60 * 60 * 1000, 100, 'completed');
  return jobs.length;
}

export { connection };
