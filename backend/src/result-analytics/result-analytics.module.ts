import { Module } from '@nestjs/common';
import { ResultAnalyticsService } from './result-analytics.service';
import { ResultAnalyticsController } from './result-analytics.controller';
import { StudentSubjectModule } from '../student-subject/student-subject.module';

@Module({
  imports: [StudentSubjectModule],
  controllers: [ResultAnalyticsController],
  providers: [ResultAnalyticsService],
  exports: [ResultAnalyticsService],
})
export class ResultAnalyticsModule {}
