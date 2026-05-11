import { Injectable, Logger } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { QUEUE_NAMES } from './queue-definitions';
import * as crypto from 'crypto';

export type ExportJobType =
  | 'results-csv'
  | 'results-excel'
  | 'attendance-csv'
  | 'fee-report'
  | 'student-list'
  | 'analytics-export'
  | 'custom-report';

export interface ExportJobData {
  jobId: string;
  type: ExportJobType;
  schoolId: string;
  userId: string;
  params: Record<string, any>;
  format: 'csv' | 'xlsx' | 'pdf';
}

@Injectable()
export class ExportQueueService {
  private readonly logger = new Logger(ExportQueueService.name);

  constructor(private readonly queuesService: QueuesService) {}

  async enqueue(options: {
    type: ExportJobType;
    schoolId: string;
    userId: string;
    params: Record<string, any>;
    format: 'csv' | 'xlsx' | 'pdf';
    priority?: number;
    delay?: number;
  }): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID();
    const data: ExportJobData = {
      jobId,
      type: options.type,
      schoolId: options.schoolId,
      userId: options.userId,
      params: options.params,
      format: options.format,
    };

    await this.queuesService.addJob(QUEUE_NAMES.EXPORT, options.type, data, {
      jobId,
      priority: options.priority,
      delay: options.delay,
    });

    this.logger.log(`Enqueued export job: ${options.type} (${jobId})`);
    return { jobId };
  }

  async getStatus(jobId: string) {
    return this.queuesService.getJobStatus(QUEUE_NAMES.EXPORT, jobId);
  }

  async getStats() {
    return this.queuesService.getQueueStats(QUEUE_NAMES.EXPORT);
  }

  async getFailedJobs(start = 0, end = 20) {
    return this.queuesService.getFailedJobs(QUEUE_NAMES.EXPORT, start, end);
  }

  async retryJob(jobId: string) {
    return this.queuesService.retryJob(QUEUE_NAMES.EXPORT, jobId);
  }

  async clean(hours = 24) {
    return this.queuesService.cleanQueue(QUEUE_NAMES.EXPORT, hours);
  }
}
