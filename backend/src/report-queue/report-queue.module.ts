import { Module } from '@nestjs/common';
import { ReportQueueService } from './report-queue.service';
import { ReportQueueController } from './report-queue.controller';

@Module({
  controllers: [ReportQueueController],
  providers: [ReportQueueService],
  exports: [ReportQueueService],
})
export class ReportQueueModule {}
