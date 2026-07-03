import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { QueuesService } from '../../queues/queues.service';
import { PrismaService } from '../../prisma/prisma.service';

export const COMM_CLOUD_QUEUE = 'communications-cloud';

@Injectable()
export class CommunicationQueueService {
  private readonly logger = new Logger(CommunicationQueueService.name);

  constructor(
    private queuesService: QueuesService,
    private prisma: PrismaService,
  ) {}

  async enqueueMessage(message: any, priority?: number, delay?: number) {
    this.logger.log(`Enqueuing message ${message.id || 'new'}`);
    return this.queuesService.addJob(COMM_CLOUD_QUEUE, 'send-message', message, { priority, delay });
  }

  async enqueueBatch(messages: any[]) {
    const jobs = messages.map(m => this.enqueueMessage(m));
    return Promise.all(jobs);
  }

  async scheduleMessage(message: any, scheduledAt: Date) {
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    return this.enqueueMessage(message, undefined, delay);
  }

  async retryMessage(messageId: string) {
    const message = await this.prisma.commCloudMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    await this.prisma.commCloudMessage.update({
      where: { id: messageId },
      data: { status: 'QUEUED', retryCount: { increment: 1 }, lastError: null },
    });

    return this.enqueueMessage(message, 10);
  }

  async cancelMessage(messageId: string) {
    await this.prisma.commCloudMessage.update({
      where: { id: messageId },
      data: { status: 'CANCELLED' },
    });
  }

  async getQueueStatus() {
    try {
      return this.queuesService.getQueueStats(COMM_CLOUD_QUEUE);
    } catch {
      return null;
    }
  }

  async getFailedMessages(start = 0, end = 20) {
    try {
      return this.queuesService.getFailedJobs(COMM_CLOUD_QUEUE, start, end);
    } catch {
      return [];
    }
  }
}
