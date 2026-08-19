import { Module, forwardRef } from '@nestjs/common';
import { ResultsManagementController } from './results-management.controller';
import { ResultsManagementService } from './results-management.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GradingEngineModule } from '../grading-engine/grading-engine.module';
import { RankingModule } from '../ranking-service/ranking.module';
import { ResultAnalyticsModule } from '../result-analytics/result-analytics.module';
import { ReportCardEngineModule } from '../report-card-engine/report-card-engine.module';
import { AssessmentEngineModule } from '../assessment-engine/assessment-engine.module';
import { ResultsSmsModule } from '../results-sms/results-sms.module';
import { CompositeSubjectModule } from '../composite-subject/composite-subject.module';

@Module({
  imports: [
    PrismaModule,
    GradingEngineModule,
    RankingModule,
    ResultAnalyticsModule,
    ReportCardEngineModule,
    AssessmentEngineModule,
    forwardRef(() => ResultsSmsModule),
    CompositeSubjectModule,
  ],
  controllers: [ResultsManagementController],
  providers: [ResultsManagementService],
  exports: [ResultsManagementService],
})
export class ResultsManagementModule {}
