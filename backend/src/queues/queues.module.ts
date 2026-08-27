import { Global, Module } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { RedisProvider } from './redis.provider';
import { AnalyticsQueueService } from './analytics-queue.service';
import { ExportQueueService } from './export-queue.service';
import { AiReportQueueService } from './ai-report-queue.service';
import { CloudinaryCleanupWorker } from './cloudinary-cleanup.worker';
import { RedisLifecycle } from './redis.lifecycle';

@Global()
@Module({
  controllers: [QueuesController],
  providers: [
    RedisProvider,
    QueuesService,
    AnalyticsQueueService,
    ExportQueueService,
    AiReportQueueService,
    CloudinaryCleanupWorker,
    RedisLifecycle,
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
