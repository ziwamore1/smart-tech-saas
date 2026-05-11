import { Injectable, Logger } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { QUEUE_NAMES } from './queue-definitions';
import * as crypto from 'crypto';

export type AiReportJobType =
  | 'student-narrative'
  | 'class-narrative'
  | 'longitudinal-analysis'
  | 'intervention-suggestion'
  | 'performance-summary'
  | 'teacher-insight';

export interface AiReportJobData {
  jobId: string;
  type: AiReportJobType;
  schoolId: string;
  params: Record<string, any>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

@Injectable()
export class AiReportQueueService {
  private readonly logger = new Logger(AiReportQueueService.name);

  constructor(private readonly queuesService: QueuesService) {}

  async enqueue(options: {
    type: AiReportJobType;
    schoolId: string;
    params: Record<string, any>;
    priority?: number;
    delay?: number;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID();
    const data: AiReportJobData = {
      jobId,
      type: options.type,
      schoolId: options.schoolId,
      params: options.params,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    };

    await this.queuesService.addJob(QUEUE_NAMES.AI_REPORT, options.type, data, {
      jobId,
      priority: options.priority,
      delay: options.delay,
    });

    this.logger.log(`Enqueued AI report job: ${options.type} (${jobId})`);
    return { jobId };
  }

  async getStatus(jobId: string) {
    return this.queuesService.getJobStatus(QUEUE_NAMES.AI_REPORT, jobId);
  }

  async getStats() {
    return this.queuesService.getQueueStats(QUEUE_NAMES.AI_REPORT);
  }

  async getFailedJobs(start = 0, end = 20) {
    return this.queuesService.getFailedJobs(QUEUE_NAMES.AI_REPORT, start, end);
  }

  async retryJob(jobId: string) {
    return this.queuesService.retryJob(QUEUE_NAMES.AI_REPORT, jobId);
  }

  async clean(hours = 24) {
    return this.queuesService.cleanQueue(QUEUE_NAMES.AI_REPORT, hours);
  }
}
