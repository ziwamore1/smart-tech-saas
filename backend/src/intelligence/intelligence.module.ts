import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QueuesModule } from '../queues/queues.module';
import { CurriculumIntelligenceModule } from '../curriculum-intelligence/curriculum-intelligence.module';
import { CompositeSubjectModule } from '../composite-subject/composite-subject.module';
import { IntelligenceController } from './intelligence.controller';
import { DescriptiveStatsService } from './services/descriptive-stats.service';
import { TrendAnalysisService } from './services/trend-analysis.service';
import { CorrelationAnalysisService } from './services/correlation-analysis.service';
import { PredictiveAnalysisService } from './services/predictive-analysis.service';
import { DiagnosticAnalysisService } from './services/diagnostic-analysis.service';
import { NarrativeReportService } from './services/narrative-report.service';
import { RecommendationService } from './services/recommendation.service';
import { BenchmarkingService } from './services/benchmarking.service';
import { PsychometricAnalysisService } from './services/psychometric-analysis.service';
import { AdaptiveTestingService } from './services/adaptive-testing.service';
import { LearningStyleAnalysisService } from './services/learning-style-analysis.service';
import { ExamQualityAnalysisService } from './services/exam-quality-analysis.service';
import { AiTutorService } from './services/ai-tutor.service';
import { AiContextService } from './services/ai-context.service';
import { SubjectEngineService } from './services/subject-engine.service';
import { AiMemoryService } from './services/ai-memory.service';

@Module({
  imports: [ConfigModule, QueuesModule, CurriculumIntelligenceModule, CompositeSubjectModule],
  controllers: [IntelligenceController],
  providers: [
    PrismaService,
    DescriptiveStatsService,
    TrendAnalysisService,
    CorrelationAnalysisService,
    PredictiveAnalysisService,
    DiagnosticAnalysisService,
    NarrativeReportService,
    RecommendationService,
    BenchmarkingService,
    PsychometricAnalysisService,
    AdaptiveTestingService,
    LearningStyleAnalysisService,
    ExamQualityAnalysisService,
    AiTutorService,
    AiContextService,
    SubjectEngineService,
    AiMemoryService,
  ],
  exports: [
    DescriptiveStatsService,
    TrendAnalysisService,
    DiagnosticAnalysisService,
    AiTutorService,
    AiContextService,
    SubjectEngineService,
    AiMemoryService,
  ],
})
export class IntelligenceModule {}
