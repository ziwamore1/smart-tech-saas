import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
}
