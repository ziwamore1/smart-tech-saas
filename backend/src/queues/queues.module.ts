import { Global, Module } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { RedisProvider } from './redis.provider';
import { AnalyticsQueueService } from './analytics-queue.service';
import { ExportQueueService } from './export-queue.service';
import { AiReportQueueService } from './ai-report-queue.service';

@Global()
@Module({
  controllers: [QueuesController],
  providers: [
    RedisProvider,
    QueuesService,
    AnalyticsQueueService,
    ExportQueueService,
    AiReportQueueService,
  ],
  exports: [
    RedisProvider,
    QueuesService,
    AnalyticsQueueService,
    ExportQueueService,
    AiReportQueueService,
  ],
})
export class QueuesModule {}
