import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from './email-queue.service';
import { SmsQueueService } from './sms-queue.service';
import { WhatsAppQueueService } from './whatsapp-queue.service';

@Injectable()
export class PgQueueWorker {
  private readonly logger = new Logger(PgQueueWorker.name);

  constructor(
    private readonly emailQueue: EmailQueueService,
    private readonly smsQueue: SmsQueueService,
    private readonly whatsAppQueue: WhatsAppQueueService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processEmailQueue() {
    try {
      const count = await this.emailQueue.processBatch();
      if (count > 0) {
        this.logger.log(`Processed ${count} email jobs`);
      }
    } catch (error: any) {
      this.logger.error(`Email queue processing failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processSmsQueue() {
    try {
      const count = await this.smsQueue.processBatch();
      if (count > 0) {
        this.logger.log(`Processed ${count} SMS jobs`);
      }
    } catch (error: any) {
      this.logger.error(`SMS queue processing failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processWhatsAppQueue() {
    try {
      const count = await this.whatsAppQueue.processBatch();
      if (count > 0) {
        this.logger.log(`Processed ${count} WhatsApp jobs`);
      }
    } catch (error: any) {
      this.logger.error(`WhatsApp queue processing failed: ${error.message}`);
    }
  }

  @Cron('0 20 * * 1-5')
  async autoMarkAttendance() {
    this.logger.log('Running daily attendance auto-mark...');

    const schools = await this.prisma.school.findMany({
      select: { id: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      this.logger.log('Weekend — skipping attendance auto-mark');
      return;
    }

    for (const school of schools) {
      try {
        const currentTerm = await this.prisma.term.findFirst({
          where: {
            academicYear: { schoolId: school.id, isCurrent: true },
            isCurrent: true,
          },
        });

        if (!currentTerm) continue;
        if (today < currentTerm.startDate || today > currentTerm.endDate) continue;

        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            schoolId: school.id,
            status: 'ACTIVE',
            academicYear: { isCurrent: true },
          },
          select: { studentId: true },
        });

        if (enrollments.length === 0) continue;

        const studentIds = enrollments.map(e => e.studentId);

        const existingRecords = await this.prisma.attendance.findMany({
          where: {
            studentId: { in: studentIds },
            date: today,
          },
          select: { studentId: true },
        });

        const alreadyMarked = new Set(existingRecords.map(r => r.studentId));

        const toCreate = studentIds
          .filter(id => !alreadyMarked.has(id))
          .map(studentId => ({
            studentId,
            date: today,
            status: 'PRESENT' as any,
            schoolId: school.id,
          }));

        if (toCreate.length === 0) continue;

        await this.prisma.attendance.createMany({ data: toCreate });
        this.logger.log(`School ${school.id}: Auto-marked ${toCreate.length} students as PRESENT`);
      } catch (err: any) {
        this.logger.error(`School ${school.id}: Auto-mark failed — ${err.message}`);
      }
    }

    this.logger.log('Daily attendance auto-mark complete');
  }
}
