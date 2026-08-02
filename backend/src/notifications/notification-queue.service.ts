import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

  async enqueueNotification(data: NotificationJobData, delay?: number): Promise<string | null> {
    try {
      const row = await this.prisma.notificationJob.create({
        data: {
          type: data.type,
          title: data.title,
          body: data.body,
          data: (data.data as any) || undefined,
          category: data.category || 'System Notifications',
          userId: data.userId || null,
          userIds: data.userIds?.length ? (data.userIds as any) : undefined,
          role: data.role || null,
          classId: data.classId || null,
          schoolId: data.schoolId || null,
          schoolIds: data.schoolIds?.length ? (data.schoolIds as any) : undefined,
          createdBy: data.createdBy || null,
          scheduledAt: delay ? new Date(Date.now() + delay) : null,
        },
      });
      this.logger.log(`Enqueued notification job: ${row.id}`);
      return row.id;
    } catch (error) {
      this.logger.error(`Failed to enqueue notification: ${error.message}`);
      return null;
    }
  }

  async getJobStatus(jobId: string) {
    const job = await this.prisma.notificationJob.findUnique({ where: { id: jobId } });
    if (!job) return null;
    return {
      id: job.id,
      queue: 'notification',
      status: job.status,
      timestamp: job.createdAt,
      processedOn: job.processedAt,
      finishedOn: job.processedAt,
      attemptsMade: job.attempts,
      failedReason: job.error,
    };
  }

  async getQueueStats() {
    const [pending, processing, sent, failed] = await Promise.all([
      this.prisma.notificationJob.count({ where: { status: 'pending' } }),
      this.prisma.notificationJob.count({ where: { status: 'processing' } }),
      this.prisma.notificationJob.count({ where: { status: 'sent' } }),
      this.prisma.notificationJob.count({ where: { status: 'failed' } }),
    ]);
    return {
      name: 'notification',
      waiting: pending,
      active: processing,
      completed: sent,
      failed,
      delayed: 0,
      paused: 0,
    };
  }
}
