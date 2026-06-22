import { Injectable, Logger } from '@nestjs/common';
import { QueuesService } from '../queues/queues.service';
import { QUEUE_NAMES } from '../queues/queue-definitions';

export interface NotificationJobData {
  type: 'single' | 'multi' | 'role' | 'class' | 'school' | 'platform';
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: string;
  userId?: string;
  userIds?: string[];
  role?: string;
  classId?: string;
  schoolId?: string;
  schoolIds?: string[];
  createdBy?: string;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(private readonly queuesService: QueuesService) {}

  async enqueueNotification(data: NotificationJobData, delay?: number): Promise<string | null> {
    try {
      const job = await this.queuesService.addJob(
        QUEUE_NAMES.NOTIFICATION,
        'send-notification',
        data,
        {
          priority: data.type === 'single' ? 1 : 2,
          delay: delay || 0,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
      this.logger.log(`Enqueued notification job: ${job?.id || 'unknown'}`);
      return job?.id || null;
    } catch (error) {
      this.logger.error(`Failed to enqueue notification: ${error.message}`);
      return null;
    }
  }

  async getJobStatus(jobId: string) {
    return this.queuesService.getJobStatus(QUEUE_NAMES.NOTIFICATION, jobId);
  }

  async getQueueStats() {
    return this.queuesService.getQueueStats(QUEUE_NAMES.NOTIFICATION);
  }
}
