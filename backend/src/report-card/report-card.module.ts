import { Module } from '@nestjs/common';
import { ReportCardController } from './report-card.controller';
import { ReportCardService } from './report-card.service';
import { ReportTemplateController } from './report-template.controller';
import { ReportTemplateService } from './report-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReportCardEngineModule } from '../report-card-engine/report-card-engine.module';
import { CompositeSubjectModule } from '../composite-subject/composite-subject.module';

@Module({
  imports: [AnalyticsModule, ReportCardEngineModule, CompositeSubjectModule],
  controllers: [ReportCardController, ReportTemplateController],
  providers: [ReportCardService, ReportTemplateService, PrismaService],
  exports: [ReportCardService, ReportTemplateService],
})
export class ReportCardModule {}
