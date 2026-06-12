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

  getQueue(name: string): Queue {
    if (!this.redisAvailable) {
      throw new Error(`Redis unavailable — cannot access queue '${name}'`);
    }

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
    if (!this.redisAvailable) {
      this.logger.warn(`Redis unavailable — skipping addJob to '${queueName}'`);
      return null;
    }
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, {
      jobId: opts?.jobId,
      priority: opts?.priority,
      delay: opts?.delay,
    });
    this.logger.log(`Job ${job.id} added to queue '${queueName}'`);
    return job;
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined | null> {
    if (!this.redisAvailable) return null;
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  async getJobStatus(queueName: string, jobId: string) {
    if (!this.redisAvailable) return null;
    const queue = this.getQueue(queueName);
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
    if (!this.redisAvailable) return null;
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused().then((p) => (p ? 1 : 0)),
    ]);

    return { name: queueName, waiting, active, completed, failed, delayed, paused };
  }

  async getAllQueueStats() {
    if (!this.redisAvailable) return [];
    const names = this.getRegisteredQueueNames();
    const stats = await Promise.all(names.map((name) => this.getQueueStats(name)));
    return stats.filter(Boolean);
  }

  getRegisteredQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  async pauseQueue(queueName: string) {
    if (!this.redisAvailable) throw new Error('Redis unavailable');
    const queue = this.getQueue(queueName);
    await queue.pause();
    this.logger.log(`Queue '${queueName}' paused`);
  }

  async resumeQueue(queueName: string) {
    if (!this.redisAvailable) throw new Error('Redis unavailable');
    const queue = this.getQueue(queueName);
    await queue.resume();
    this.logger.log(`Queue '${queueName}' resumed`);
  }

  async cleanQueue(queueName: string, hours = 24) {
    if (!this.redisAvailable) throw new Error('Redis unavailable');
    const queue = this.getQueue(queueName);
    const timestamp = hours * 60 * 60 * 1000;
    await queue.clean(timestamp, 100, 'completed');
    await queue.clean(timestamp, 100, 'failed');
    this.logger.log(`Queue '${queueName}' cleaned (older than ${hours}h)`);
  }

  async drainQueue(queueName: string) {
    if (!this.redisAvailable) throw new Error('Redis unavailable');
    const queue = this.getQueue(queueName);
    await queue.drain();
    this.logger.log(`Queue '${queueName}' drained`);
  }

  async getFailedJobs(queueName: string, start = 0, end = 20) {
    if (!this.redisAvailable) return [];
    const queue = this.getQueue(queueName);
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
    if (!this.redisAvailable) throw new Error('Redis unavailable');
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in queue '${queueName}'`);
    await job.retry();
    this.logger.log(`Job ${jobId} retried in queue '${queueName}'`);
  }

  async removeJob(queueName: string, jobId: string) {
    if (!this.redisAvailable) throw new Error('Redis unavailable');
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in queue '${queueName}'`);
    await job.remove();
    this.logger.log(`Job ${jobId} removed from queue '${queueName}'`);
  }
}
