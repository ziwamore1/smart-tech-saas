import { Module } from '@nestjs/common';
import { AnalyticsClientService } from './analytics-client.service';

@Module({
  providers: [AnalyticsClientService],
  exports: [AnalyticsClientService],
})
export class AnalyticsClientModule {}
