import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsController } from './analytics.controller';
import { StudentSubjectModule } from '../student-subject/student-subject.module';

@Module({
  imports: [StudentSubjectModule],
  providers: [AnalyticsService, PrismaService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
