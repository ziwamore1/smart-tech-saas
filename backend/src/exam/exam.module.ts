import { Module } from '@nestjs/common';
import { ExamService } from './exam.service';
import { ExamController } from './exam.controller';
import { ExamMarkingService } from './exam-marking.service';
import { ExamTemplateService } from './exam-template.service';
import { QuestionBankService } from './question-bank.service';
import { UploadedExamService } from './uploaded-exam.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    ExamService,
    ExamMarkingService,
    ExamTemplateService,
    QuestionBankService,
    UploadedExamService,
  ],
  controllers: [ExamController],
  exports: [
    ExamService,
    ExamMarkingService,
    ExamTemplateService,
    QuestionBankService,
    UploadedExamService,
  ],
})
export class ExamModule {}
