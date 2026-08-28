import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BeemService } from '../beem/beem.service';
import { TwilioService } from '../twilio/twilio.service';
import { mapBounded } from '../common/utils/concurrency.util';

@Injectable()
export class SmsQueueService {
  private readonly logger = new Logger(SmsQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly beemService: BeemService,
    private readonly twilioService: TwilioService,
  ) {}

  async enqueue(phoneNumber: string, message: string, provider = 'beem', scheduledAt?: Date) {
    await this.prisma.smsQueue.create({
      data: { phoneNumber, message, provider, scheduledAt: scheduledAt ?? null },
    });
    this.logger.log(`Enqueued SMS to ${phoneNumber}`);
  }

  async processBatch(batchSize = 20): Promise<number> {
    const jobs = await this.prisma.smsQueue.findMany({
      where: {
        status: 'pending',
        AND: [
          { scheduledAt: null },
          { OR: [{ scheduledAt: { lte: new Date() } }, { scheduledAt: null }] },
        ],
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    if (jobs.length === 0) return 0;

    let processed = 0;
    await mapBounded(jobs, async (job) => {
      try {
        await this.prisma.smsQueue.update({
          where: { id: job.id },
          data: { status: 'processing', attempts: { increment: 1 } },
        });

        if (job.provider === 'twilio') {
          await this.twilioService.sendSms(job.phoneNumber, job.message);
        } else {
          await this.beemService.sendSms(job.phoneNumber, job.message);
        }

        await this.prisma.smsQueue.update({
          where: { id: job.id },
          data: { status: 'sent', sentAt: new Date() },
        });
        processed++;
      } catch (error: any) {
        this.logger.error(`Failed to send SMS to ${job.phoneNumber}: ${error.message}`);
        await this.prisma.smsQueue.update({
          where: { id: job.id },
          data: {
            status: job.attempts >= 2 ? 'failed' : 'pending',
            error: error.message,
          },
        });
      }
    });
    return processed;
  }

  async getStats() {
    const [pending, processing, sent, failed] = await Promise.all([
      this.prisma.smsQueue.count({ where: { status: 'pending' } }),
      this.prisma.smsQueue.count({ where: { status: 'processing' } }),
      this.prisma.smsQueue.count({ where: { status: 'sent' } }),
      this.prisma.smsQueue.count({ where: { status: 'failed' } }),
    ]);
    return { pending, processing, sent, failed };
  }
}
