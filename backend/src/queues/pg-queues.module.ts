import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { BeemModule } from '../beem/beem.module';
import { EmailQueueService } from './email-queue.service';
import { SmsQueueService } from './sms-queue.service';
import { WhatsAppQueueService } from './whatsapp-queue.service';
import { PgQueueWorker } from './pg-queue.worker';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
    BeemModule,
  ],
  providers: [
    EmailQueueService,
    SmsQueueService,
    WhatsAppQueueService,
    PgQueueWorker,
  ],
  exports: [
    EmailQueueService,
    SmsQueueService,
    WhatsAppQueueService,
  ],
})
export class PgQueuesModule {}
