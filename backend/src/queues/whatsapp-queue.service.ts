import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BeemService } from '../beem/beem.service';

@Injectable()
export class WhatsAppQueueService {
  private readonly logger = new Logger(WhatsAppQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly beemService: BeemService,
  ) {}

  async enqueue(phoneNumber: string, message: string, templateName?: string, scheduledAt?: Date) {
    await this.prisma.whatsAppQueue.create({
      data: { phoneNumber, message, templateName: templateName ?? null, scheduledAt: scheduledAt ?? null },
    });
    this.logger.log(`Enqueued WhatsApp to ${phoneNumber}`);
  }

  async processBatch(batchSize = 20): Promise<number> {
    const jobs = await this.prisma.whatsAppQueue.findMany({
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
    for (const job of jobs) {
      try {
        await this.prisma.whatsAppQueue.update({
          where: { id: job.id },
          data: { status: 'processing', attempts: { increment: 1 } },
        });

        await this.beemService.sendWhatsApp(job.phoneNumber, job.message);

        await this.prisma.whatsAppQueue.update({
          where: { id: job.id },
          data: { status: 'sent', sentAt: new Date() },
        });
        processed++;
      } catch (error: any) {
        this.logger.error(`Failed to send WhatsApp to ${job.phoneNumber}: ${error.message}`);
        await this.prisma.whatsAppQueue.update({
          where: { id: job.id },
          data: {
            status: job.attempts >= 2 ? 'failed' : 'pending',
            error: error.message,
          },
        });
      }
    }
    return processed;
  }

  async getStats() {
    const [pending, processing, sent, failed] = await Promise.all([
      this.prisma.whatsAppQueue.count({ where: { status: 'pending' } }),
      this.prisma.whatsAppQueue.count({ where: { status: 'processing' } }),
      this.prisma.whatsAppQueue.count({ where: { status: 'sent' } }),
      this.prisma.whatsAppQueue.count({ where: { status: 'failed' } }),
    ]);
    return { pending, processing, sent, failed };
  }
}
