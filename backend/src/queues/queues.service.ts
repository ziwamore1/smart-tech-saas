import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN, QUEUE_DEFAULT_OPTIONS, QueueName } from './queue-definitions';

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly redisAvailable: boolean;

  constructor(@Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis | null) {
    this.redisAvailable = !!redis;
    if (!this.redisAvailable) {
      this.logger.warn('Redis unavailable — BullMQ queues disabled');
    }
  }

  private tryGetQueue(name: string): Queue | null {
    if (!this.redisAvailable) return null;
    const status = this.redis ? (this.redis as any).status : 'close';
    if (status !== 'ready' && status !== 'connect' && status !== 'connecting') return null;

    if (!this.queues.has(name)) {
      const defaultOpts = QUEUE_DEFAULT_OPTIONS[name as QueueName];
      const queue = new Queue(name, {
        connection: this.redis!,
        defaultJobOptions: defaultOpts || {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 86400, count: 100 },
          removeOnFail: { age: 604800, count: 50 },
        },
      });

      this.queues.set(name, queue);
      this.logger.log(`Queue '${name}' initialized`);
    }
    return this.queues.get(name)!;
  }

  async addJob(
    queueName: string,
    jobName: string,
    data: Record<string, any>,
    opts?: { jobId?: string; priority?: number; delay?: number },
  ): Promise<Job | null> {
    const queue = this.tryGetQueue(queueName);
    if (!queue) {
      this.logger.warn(`Redis unavailable — skipping addJob to '${queueName}'`);
      return null;
    }
    const job = await queue.add(jobName, data, {
      jobId: opts?.jobId,
      priority: opts?.priority,
      delay: opts?.delay,
    });
    this.logger.log(`Job ${job.id} added to queue '${queueName}'`);
    return job;
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined | null> {
    const queue = this.tryGetQueue(queueName);
    if (!queue) return null;
    return queue.getJob(jobId);
  }

  async getJobStatus(queueName: string, jobId: string) {
    const queue = this.tryGetQueue(queueName);
    if (!queue) return null;
    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      id: job.id,
      queue: queueName,
      status: state,
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
    };
  }

  async getQueueStats(queueName: string) {
    const queue = this.tryGetQueue(queueName);
    if (!queue) return null;
    try {
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused().then((p) => (p ? 1 : 0)),
      ]);
      return { name: queueName, waiting, active, completed, failed, delayed, paused };
    } catch (err) {
      this.logger.warn(`Failed to get stats for queue '${queueName}': ${(err as Error).message}`);
      return null;
    }
  }

  async getAllQueueStats() {
    const names = Array.from(this.queues.keys());
    const stats = await Promise.all(names.map((name) => this.getQueueStats(name)));
    return stats.filter(Boolean);
  }

  async pauseQueue(queueName: string) {
    const queue = this.tryGetQueue(queueName);
    if (!queue) throw new Error('Redis unavailable');
    await queue.pause();
    this.logger.log(`Queue '${queueName}' paused`);
  }

  async resumeQueue(queueName: string) {
    const queue = this.tryGetQueue(queueName);
    if (!queue) throw new Error('Redis unavailable');
    await queue.resume();
    this.logger.log(`Queue '${queueName}' resumed`);
  }

  async cleanQueue(queueName: string, hours = 24) {
    const queue = this.tryGetQueue(queueName);
    if (!queue) throw new Error('Redis unavailable');
    const timestamp = hours * 60 * 60 * 1000;
    await queue.clean(timestamp, 100, 'completed');
    await queue.clean(timestamp, 100, 'failed');
    this.logger.log(`Queue '${queueName}' cleaned (older than ${hours}h)`);
  }

  async drainQueue(queueName: string) {
    const queue = this.tryGetQueue(queueName);
    if (!queue) throw new Error('Redis unavailable');
    await queue.drain();
    this.logger.log(`Queue '${queueName}' drained`);
  }

  async getFailedJobs(queueName: string, start = 0, end = 20) {
    const queue = this.tryGetQueue(queueName);
    if (!queue) return [];
    const jobs = await queue.getJobs(['failed'], start, end);
    return Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
      })),
    );
  }

  async retryJob(queueName: string, jobId: string) {
    const queue = this.tryGetQueue(queueName);
    if (!queue) throw new Error('Redis unavailable');
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in queue '${queueName}'`);
    await job.retry();
    this.logger.log(`Job ${jobId} retried in queue '${queueName}'`);
  }

  async removeJob(queueName: string, jobId: string) {
    const queue = this.tryGetQueue(queueName);
    if (!queue) throw new Error('Redis unavailable');
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in queue '${queueName}'`);
    await job.remove();
    this.logger.log(`Job ${jobId} removed from queue '${queueName}'`);
  }
}
