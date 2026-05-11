import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { QueuesService } from '../queues/queues.service';
import { QUEUE_NAMES } from '../queues/queue-definitions';

export type ReportType = 'report-card' | 'transcript' | 'analytics-summary' | 'performance-profile';

export interface EnqueueReportOptions {
  type: ReportType;
  schoolId: string;
  params: Record<string, any>;
  priority?: number;
  delay?: number;
}

@Injectable()
export class ReportQueueService {
  private readonly logger = new Logger(ReportQueueService.name);
  private readonly queueName = QUEUE_NAMES.REPORT_GENERATION;

  constructor(private readonly queuesService: QueuesService) {}

  async enqueueReport(options: EnqueueReportOptions): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID();

    await this.queuesService.addJob(
      this.queueName,
      options.type,
      {
        jobId,
        type: options.type,
        schoolId: options.schoolId,
        params: options.params,
        apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}/api/v1`,
        apiKey: process.env.INTERNAL_API_KEY || 'report-service-key',
      },
      {
        jobId,
        priority: options.priority || 0,
        delay: options.delay || 0,
      },
    );

    this.logger.log(`Enqueued ${options.type} report job: ${jobId}`);
    return { jobId };
  }

  async getJobStatus(jobId: string) {
    return this.queuesService.getJobStatus(this.queueName, jobId);
  }

  async getDownloadPath(schoolId: string, jobId: string): Promise<string | null> {
    const outputDir = process.env.REPORT_OUTPUT_DIR || path.resolve(process.cwd(), '..', 'report-service', 'output');
    const filepath = path.join(outputDir, schoolId, `${jobId}.pdf`);
    return fs.existsSync(filepath) ? filepath : null;
  }

  async getDownloadBuffer(schoolId: string, jobId: string): Promise<Buffer | null> {
    const filepath = await this.getDownloadPath(schoolId, jobId);
    if (!filepath) return null;
    return fs.readFileSync(filepath);
  }

  async getStats() {
    return this.queuesService.getQueueStats(this.queueName);
  }

  async drain() {
    await this.queuesService.drainQueue(this.queueName);
  }

  async clean(hours = 24) {
    await this.queuesService.cleanQueue(this.queueName, hours);
  }
}
