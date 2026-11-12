import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CurriculumIntelligenceModule } from '../curriculum-intelligence/curriculum-intelligence.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ExamAuthoringController } from './exam-authoring.controller';
import { ExamAuthoringService } from './exam-authoring.service';
import { ExamExportService } from './exam-export.service';
import { ExamDiagramService } from './exam-diagram.service';

@Module({
  imports: [PrismaModule, CurriculumIntelligenceModule, CloudinaryModule],
  controllers: [ExamAuthoringController],
  providers: [ExamAuthoringService, ExamExportService, ExamDiagramService],
  exports: [ExamAuthoringService, ExamExportService, ExamDiagramService],
})
export class ExamAuthoringModule {}
