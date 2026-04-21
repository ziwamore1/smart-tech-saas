import { Module } from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { PublishingController } from './publishing.controller';
import { ReportCardModule } from '../report-card/report-card.module';

@Module({
  imports: [ReportCardModule],
  controllers: [PublishingController],
  providers: [PublishingService],
})
export class PublishingModule {}
