import { Injectable, Logger } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { QUEUE_NAMES } from './queue-definitions';
import * as crypto from 'crypto';

export type AnalyticsJobType =
  | 'descriptive-stats'
  | 'predictive-analysis'
  | 'trend-analysis'
  | 'correlation-analysis'
  | 'competency-diagnosis'
  | 'benchmarking'
  | 'batch-psychometric';

export interface AnalyticsJobData {
  jobId: string;
  type: AnalyticsJobType;
  schoolId: string;
  params: Record<string, any>;
}

@Injectable()
export class AnalyticsQueueService {
  private readonly logger = new Logger(AnalyticsQueueService.name);

  constructor(private readonly queuesService: QueuesService) {}

  async enqueue(options: {
    type: AnalyticsJobType;
    schoolId: string;
    params: Record<string, any>;
    priority?: number;
    delay?: number;
  }): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID();
    const data: AnalyticsJobData = { jobId, type: options.type, schoolId: options.schoolId, params: options.params };

    await this.queuesService.addJob(QUEUE_NAMES.ANALYTICS, options.type, data, {
      jobId,
      priority: options.priority,
      delay: options.delay,
    });

    this.logger.log(`Enqueued analytics job: ${options.type} (${jobId})`);
    return { jobId };
  }

  async getStatus(jobId: string) {
    return this.queuesService.getJobStatus(QUEUE_NAMES.ANALYTICS, jobId);
  }

  async getStats() {
    return this.queuesService.getQueueStats(QUEUE_NAMES.ANALYTICS);
  }

  async getFailedJobs(start = 0, end = 20) {
    return this.queuesService.getFailedJobs(QUEUE_NAMES.ANALYTICS, start, end);
  }

  async retryJob(jobId: string) {
    return this.queuesService.retryJob(QUEUE_NAMES.ANALYTICS, jobId);
  }

  async clean(hours = 24) {
    return this.queuesService.cleanQueue(QUEUE_NAMES.ANALYTICS, hours);
  }
}
