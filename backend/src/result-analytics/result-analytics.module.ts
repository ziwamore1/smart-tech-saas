import { Module } from '@nestjs/common';
import { ResultAnalyticsService } from './result-analytics.service';
import { ResultAnalyticsController } from './result-analytics.controller';

@Module({
  controllers: [ResultAnalyticsController],
  providers: [ResultAnalyticsService],
  exports: [ResultAnalyticsService],
})
export class ResultAnalyticsModule {}
