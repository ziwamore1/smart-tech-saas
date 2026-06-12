import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async enqueue(recipient: string, subject: string, body: string, scheduledAt?: Date) {
    await this.prisma.emailQueue.create({
      data: { recipient, subject, body, scheduledAt: scheduledAt ?? null },
    });
    this.logger.log(`Enqueued email to ${recipient}: ${subject}`);
  }

  async processBatch(batchSize = 20): Promise<number> {
    const jobs = await this.prisma.emailQueue.findMany({
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
        await this.prisma.emailQueue.update({
          where: { id: job.id },
          data: { status: 'processing', attempts: { increment: 1 } },
        });

        await this.emailService.sendMail(job.recipient, job.subject, job.body);

        await this.prisma.emailQueue.update({
          where: { id: job.id },
          data: { status: 'sent', sentAt: new Date() },
        });
        processed++;
      } catch (error: any) {
        this.logger.error(`Failed to send email to ${job.recipient}: ${error.message}`);
        await this.prisma.emailQueue.update({
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
      this.prisma.emailQueue.count({ where: { status: 'pending' } }),
      this.prisma.emailQueue.count({ where: { status: 'processing' } }),
      this.prisma.emailQueue.count({ where: { status: 'sent' } }),
      this.prisma.emailQueue.count({ where: { status: 'failed' } }),
    ]);
    return { pending, processing, sent, failed };
  }
}
