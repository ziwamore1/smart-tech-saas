import { Module } from '@nestjs/common';
import { TeacherAnalyticsService } from './teacher-analytics.service';
import { TeacherAnalyticsStatisticsService } from './teacher-analytics-statistics.service';
import { TeacherAnalyticsAiService } from './teacher-analytics-ai.service';
import { TeacherAnalyticsController } from './teacher-analytics.controller';
import { StudentSubjectModule } from '../student-subject/student-subject.module';

@Module({
  imports: [StudentSubjectModule],
  controllers: [TeacherAnalyticsController],
  providers: [TeacherAnalyticsService, TeacherAnalyticsStatisticsService, TeacherAnalyticsAiService],
  exports: [TeacherAnalyticsService, TeacherAnalyticsStatisticsService, TeacherAnalyticsAiService],
})
export class TeacherAnalyticsModule {}