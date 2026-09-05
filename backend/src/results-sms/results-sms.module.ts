import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ResultsSmsController } from './results-sms.controller';
import { ResultsSmsService } from './results-sms.service';
import { ResultsSmsMonitor } from './results-sms.monitor';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProviderFactory } from '../communications-cloud/providers/sms/sms-provider.factory';
import { CommunicationsCloudModule } from '../communications-cloud/communications-cloud.module';
import { CompositeSubjectModule } from '../composite-subject/composite-subject.module';
import { ResultsSmsWorker } from './results-sms.worker';

@Module({
  imports: [ScheduleModule.forRoot(), CommunicationsCloudModule, CompositeSubjectModule],
  controllers: [ResultsSmsController],
  providers: [ResultsSmsService, PrismaService, ResultsSmsWorker, ResultsSmsMonitor],
  exports: [ResultsSmsService],
})
export class ResultsSmsModule {}
