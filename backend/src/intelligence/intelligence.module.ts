import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

@Module({
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
  ],
  exports: [
    DescriptiveStatsService,
    TrendAnalysisService,
    DiagnosticAnalysisService,
  ],
})
export class IntelligenceModule {}
