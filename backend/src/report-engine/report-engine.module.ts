import { Module } from '@nestjs/common';
import { ReportEngineService } from './report-engine.service';
import { ReportEngineController } from './report-engine.controller';
import { ReportCardEngineModule } from '../report-card-engine/report-card-engine.module';
import { ReportCardModule } from '../report-card/report-card.module';
import { ReportTemplateBuilderModule } from '../report-template-builder/report-template-builder.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RankingModule } from '../ranking-service/ranking.module';
import { GradingEngineModule } from '../grading-engine/grading-engine.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CommonModule } from '../common/common.module';
import { ResultsManagementModule } from '../results-management/results-management.module';

@Module({
  imports: [
    CommonModule,
    ReportCardEngineModule,
    ReportCardModule,
    ReportTemplateBuilderModule,
    AnalyticsModule,
    RankingModule,
    GradingEngineModule,
    CloudinaryModule,
    ResultsManagementModule,
  ],
  controllers: [ReportEngineController],
  providers: [ReportEngineService],
  exports: [ReportEngineService],
})
export class ReportEngineModule {}
