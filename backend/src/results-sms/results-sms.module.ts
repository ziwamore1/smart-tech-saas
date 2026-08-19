import { Module } from '@nestjs/common';
import { ResultsSmsController } from './results-sms.controller';
import { ResultsSmsService } from './results-sms.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProviderFactory } from '../communications-cloud/providers/sms/sms-provider.factory';
import { CommunicationsCloudModule } from '../communications-cloud/communications-cloud.module';
import { CompositeSubjectModule } from '../composite-subject/composite-subject.module';

@Module({
  imports: [CommunicationsCloudModule, CompositeSubjectModule],
  controllers: [ResultsSmsController],
  providers: [ResultsSmsService, PrismaService],
  exports: [ResultsSmsService],
})
export class ResultsSmsModule {}
