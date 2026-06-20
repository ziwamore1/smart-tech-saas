import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CurriculumIntelligenceController } from './curriculum-intelligence.controller';
import { CurriculumIntelligenceService } from './curriculum-intelligence.service';
import { PdfImportService } from './pdf-import.service';
import { AiContextService } from './ai-context.service';
import { ExaminationGeneratorService } from './examination-generator.service';
import { SbaManagementService } from './sba-management.service';
import { LessonPlanningService } from './lesson-planning.service';
import { AnalyticsService } from './analytics.service';
import { CieAdaptiveService } from './cie-adaptive.service';

@Module({
  imports: [PrismaModule],
  controllers: [CurriculumIntelligenceController],
  providers: [
    CurriculumIntelligenceService,
    PdfImportService,
    AiContextService,
    ExaminationGeneratorService,
    SbaManagementService,
    LessonPlanningService,
    AnalyticsService,
    CieAdaptiveService,
  ],
  exports: [
    CurriculumIntelligenceService,
    AiContextService,
    ExaminationGeneratorService,
    SbaManagementService,
    LessonPlanningService,
    AnalyticsService,
    CieAdaptiveService,
  ],
})
export class CurriculumIntelligenceModule {}
