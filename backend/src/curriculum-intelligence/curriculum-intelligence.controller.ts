import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurriculumIntelligenceService } from './curriculum-intelligence.service';
import { PdfImportService } from './pdf-import.service';
import { AiContextService } from './ai-context.service';
import { ExaminationGeneratorService } from './examination-generator.service';
import { SbaManagementService } from './sba-management.service';
import { LessonPlanningService } from './lesson-planning.service';
import { AnalyticsService } from './analytics.service';
import { BloomLevel, QuestionType } from '@prisma/client';

@Controller('curriculum-intelligence')
export class CurriculumIntelligenceController {
  constructor(
    private readonly service: CurriculumIntelligenceService,
    private readonly pdfImport: PdfImportService,
    private readonly aiContext: AiContextService,
    private readonly examGenerator: ExaminationGeneratorService,
    private readonly sbaManagement: SbaManagementService,
    private readonly lessonPlanning: LessonPlanningService,
    private readonly analytics: AnalyticsService,
  ) {}

  // ===================== TOPICS =====================

  @Post('topics')
  @UseGuards(AuthGuard('jwt'))
  createTopic(@Body() body: { name: string; code?: string; description?: string; sortOrder?: number; subjectId: string; academicStageId?: string; schoolId?: string }) {
    return this.service.createTopic(body);
  }

  @Get('topics')
  @UseGuards(AuthGuard('jwt'))
  getTopics(@Query('subjectId') subjectId?: string, @Query('academicStageId') academicStageId?: string) {
    return this.service.getTopics(subjectId, academicStageId);
  }

  @Get('topics/:id')
  @UseGuards(AuthGuard('jwt'))
  getTopic(@Param('id') id: string) {
    return this.service.getTopic(id);
  }

  @Patch('topics/:id')
  @UseGuards(AuthGuard('jwt'))
  updateTopic(@Param('id') id: string, @Body() body: any) {
    return this.service.updateTopic(id, body);
  }

  @Delete('topics/:id')
  @UseGuards(AuthGuard('jwt'))
  deleteTopic(@Param('id') id: string) {
    return this.service.deleteTopic(id);
  }

  // ===================== SUBTOPICS =====================

  @Post('subtopics')
  @UseGuards(AuthGuard('jwt'))
  createSubtopic(@Body() body: { name: string; code?: string; description?: string; sortOrder?: number; topicId: string; schoolId?: string }) {
    return this.service.createSubtopic(body);
  }

  @Get('topics/:topicId/subtopics')
  @UseGuards(AuthGuard('jwt'))
  getSubtopics(@Param('topicId') topicId: string) {
    return this.service.getSubtopics(topicId);
  }

  @Patch('subtopics/:id')
  @UseGuards(AuthGuard('jwt'))
  updateSubtopic(@Param('id') id: string, @Body() body: any) {
    return this.service.updateSubtopic(id, body);
  }

  @Delete('subtopics/:id')
  @UseGuards(AuthGuard('jwt'))
  deleteSubtopic(@Param('id') id: string) {
    return this.service.deleteSubtopic(id);
  }

  // ===================== COMPETENCIES =====================

  @Post('competencies')
  @UseGuards(AuthGuard('jwt'))
  createCompetency(@Body() body: { name: string; code?: string; description?: string; category?: string; bloomLevel?: BloomLevel; topicId?: string; subtopicId?: string; subjectId?: string; eocId?: string; schoolId?: string }) {
    return this.service.createCompetency(body);
  }

  @Get('competencies')
  @UseGuards(AuthGuard('jwt'))
  getCompetencies(
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('eocId') eocId?: string,
  ) {
    return this.service.getCompetencies({ subjectId, topicId, eocId });
  }

  @Patch('competencies/:id')
  @UseGuards(AuthGuard('jwt'))
  updateCompetency(@Param('id') id: string, @Body() body: any) {
    return this.service.updateCompetency(id, body);
  }

  @Delete('competencies/:id')
  @UseGuards(AuthGuard('jwt'))
  deleteCompetency(@Param('id') id: string) {
    return this.service.deleteCompetency(id);
  }

  // ===================== ELEMENTS OF CONSTRUCT =====================

  @Post('elements-of-construct')
  @UseGuards(AuthGuard('jwt'))
  createEoc(@Body() body: { name: string; code?: string; description?: string; sortOrder?: number; subjectId: string; construct?: string; schoolId?: string }) {
    return this.service.createElementOfConstruct(body);
  }

  @Get('subjects/:subjectId/elements-of-construct')
  @UseGuards(AuthGuard('jwt'))
  getEocs(@Param('subjectId') subjectId: string) {
    return this.service.getElementsOfConstruct(subjectId);
  }

  @Patch('elements-of-construct/:id')
  @UseGuards(AuthGuard('jwt'))
  updateEoc(@Param('id') id: string, @Body() body: any) {
    return this.service.updateElementOfConstruct(id, body);
  }

  @Delete('elements-of-construct/:id')
  @UseGuards(AuthGuard('jwt'))
  deleteEoc(@Param('id') id: string) {
    return this.service.deleteElementOfConstruct(id);
  }

  // ===================== LEARNING OUTCOMES =====================

  @Post('learning-outcomes')
  @UseGuards(AuthGuard('jwt'))
  createLearningOutcome(@Body() body: { name: string; code?: string; description?: string; bloomLevel?: BloomLevel; topicId?: string; subtopicId?: string; subjectId?: string; schoolId?: string }) {
    return this.service.createLearningOutcome(body);
  }

  @Get('learning-outcomes')
  @UseGuards(AuthGuard('jwt'))
  getLearningOutcomes(@Query('subjectId') subjectId?: string, @Query('topicId') topicId?: string) {
    return this.service.getLearningOutcomes({ subjectId, topicId });
  }

  @Patch('learning-outcomes/:id')
  @UseGuards(AuthGuard('jwt'))
  updateLearningOutcome(@Param('id') id: string, @Body() body: any) {
    return this.service.updateLearningOutcome(id, body);
  }

  @Delete('learning-outcomes/:id')
  @UseGuards(AuthGuard('jwt'))
  deleteLearningOutcome(@Param('id') id: string) {
    return this.service.deleteLearningOutcome(id);
  }

  // ===================== ASSESSMENT OBJECTIVES =====================

  @Post('assessment-objectives')
  @UseGuards(AuthGuard('jwt'))
  createAssessmentObjective(@Body() body: { name: string; code?: string; description?: string; weight?: number; subjectId: string; schoolId?: string }) {
    return this.service.createAssessmentObjective(body);
  }

  @Get('subjects/:subjectId/assessment-objectives')
  @UseGuards(AuthGuard('jwt'))
  getAssessmentObjectives(@Param('subjectId') subjectId: string) {
    return this.service.getAssessmentObjectives(subjectId);
  }

  @Patch('assessment-objectives/:id')
  @UseGuards(AuthGuard('jwt'))
  updateAssessmentObjective(@Param('id') id: string, @Body() body: any) {
    return this.service.updateAssessmentObjective(id, body);
  }

  @Delete('assessment-objectives/:id')
  @UseGuards(AuthGuard('jwt'))
  deleteAssessmentObjective(@Param('id') id: string) {
    return this.service.deleteAssessmentObjective(id);
  }

  // ===================== SYLLABUS DOCUMENTS =====================

  @Post('syllabus-documents')
  @UseGuards(AuthGuard('jwt'))
  createSyllabusDocument(@Body() body: {
    title: string; documentType: string; curriculum?: string; educationLevelId?: string;
    academicStageId?: string; filePath: string; fileSize?: number; fileType?: string; schoolId?: string;
  }) {
    return this.service.createSyllabusDocument(body);
  }

  @Get('syllabus-documents')
  @UseGuards(AuthGuard('jwt'))
  getSyllabusDocuments(
    @Query('documentType') documentType?: string,
    @Query('curriculum') curriculum?: string,
    @Query('educationLevelId') educationLevelId?: string,
  ) {
    return this.service.getSyllabusDocuments({ documentType, curriculum, educationLevelId });
  }

  @Get('syllabus-documents/:id')
  @UseGuards(AuthGuard('jwt'))
  getSyllabusDocument(@Param('id') id: string) {
    return this.service.getSyllabusDocument(id);
  }

  @Delete('syllabus-documents/:id')
  @UseGuards(AuthGuard('jwt'))
  deleteSyllabusDocument(@Param('id') id: string) {
    return this.service.deleteSyllabusDocument(id);
  }

  // ===================== PDF IMPORT =====================

  @Post('import/assessment-scheme')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SuperAdmin')
  @UseInterceptors(FileInterceptor('file'))
  async importAssessmentScheme(@UploadedFile() file: Express.Multer.File, @Body() body: { title?: string; educationLevelId?: string; academicStageId?: string }) {
    return this.pdfImport.importAssessmentSchemePdf(file, body);
  }

  // ===================== SUBJECT TREE =====================

  @Get('subjects/:subjectId/tree')
  @UseGuards(AuthGuard('jwt'))
  getSubjectTree(@Param('subjectId') subjectId: string) {
    return this.service.getFullSubjectTree(subjectId);
  }

  // ===================== AI CONTEXT =====================

  @Get('ai-context/:schoolId/:subjectId/:topicId')
  @UseGuards(AuthGuard('jwt'))
  getAiContext(@Param('schoolId') schoolId: string, @Param('subjectId') subjectId: string, @Param('topicId') topicId: string) {
    return this.aiContext.getCurriculumContext(schoolId, subjectId, topicId);
  }

  @Post('ai-context/enrich-prompt')
  @UseGuards(AuthGuard('jwt'))
  enrichAiPrompt(@Body() body: { prompt: string; schoolId: string; subjectId?: string; topicId?: string; userRole?: string }) {
    return this.aiContext.enrichPromptWithCurriculum(body);
  }

  // ===================== EXAMINATION GENERATOR =====================

  @Post('generate/questions')
  @UseGuards(AuthGuard('jwt'))
  generateQuestions(@Body() body: {
    subjectId: string; topicId?: string; questionType: QuestionType; count?: number;
    bloomLevel?: BloomLevel; difficulty?: string; eocId?: string; totalMarks?: number;
  }) {
    return this.examGenerator.generateQuestions(body);
  }

  @Post('generate/exam-paper')
  @UseGuards(AuthGuard('jwt'))
  generateExamPaper(@Body() body: {
    subjectId: string; academicStageId: string; totalMarks?: number;
    includeEocs?: string[]; includeTopics?: string[]; difficultyDistribution?: any;
  }) {
    return this.examGenerator.generateExamPaper(body);
  }

  // ===================== SBA MANAGEMENT =====================

  @Post('sba/tasks')
  @UseGuards(AuthGuard('jwt'))
  createSbaTask(@Body() body: {
    title: string; description?: string; taskNumber: number; subjectId: string;
    academicStageId?: string; termId?: string; maxMarks?: number; weight?: number;
    competencyId?: string; eocId?: string; dueDate?: string; schoolId?: string;
  }) {
    return this.sbaManagement.createSbaTask(body);
  }

  @Get('sba/tasks')
  @UseGuards(AuthGuard('jwt'))
  getSbaTasks(@Query('subjectId') subjectId?: string, @Query('academicStageId') academicStageId?: string) {
    return this.sbaManagement.getSbaTasks({ subjectId, academicStageId });
  }

  @Get('sba/templates/:subjectId')
  @UseGuards(AuthGuard('jwt'))
  generateSbaTemplate(@Param('subjectId') subjectId: string, @Query('academicStageId') academicStageId?: string) {
    return this.sbaManagement.generateSbaTemplate(subjectId, academicStageId);
  }

  // ===================== LESSON PLANNING =====================

  @Post('lesson-plans')
  @UseGuards(AuthGuard('jwt'))
  createLessonPlan(@Body() body: {
    title: string; subjectId: string; topicId?: string; subtopicId?: string;
    classId?: string; teacherId?: string; duration?: number; weekNumber?: number;
    termId?: string; academicYearId?: string; schoolId?: string;
  }) {
    return this.lessonPlanning.createLessonPlan(body);
  }

  @Post('lesson-plans/generate')
  @UseGuards(AuthGuard('jwt'))
  generateLessonPlan(@Body() body: {
    subjectId: string; topicId: string; classId?: string; teacherId?: string;
    duration?: number; weekNumber?: number; termId?: string; academicYearId?: string; schoolId?: string;
  }) {
    return this.lessonPlanning.generateFromCurriculum(body);
  }

  @Get('lesson-plans')
  @UseGuards(AuthGuard('jwt'))
  getLessonPlans(@Query('teacherId') teacherId?: string, @Query('subjectId') subjectId?: string, @Query('classId') classId?: string) {
    return this.lessonPlanning.getLessonPlans({ teacherId, subjectId, classId });
  }

  @Get('lesson-plans/:id')
  @UseGuards(AuthGuard('jwt'))
  getLessonPlan(@Param('id') id: string) {
    return this.lessonPlanning.getLessonPlan(id);
  }

  @Patch('lesson-plans/:id')
  @UseGuards(AuthGuard('jwt'))
  updateLessonPlan(@Param('id') id: string, @Body() body: any) {
    return this.lessonPlanning.updateLessonPlan(id, body);
  }

  // ===================== CURRICULUM COVERAGE =====================

  @Post('coverage')
  @UseGuards(AuthGuard('jwt'))
  markCoverage(@Body() body: {
    classId: string; subjectId: string; topicId: string; subtopicId?: string;
    teacherId?: string; termId?: string; percentage?: number; notes?: string; schoolId?: string;
  }) {
    return this.service.markCoverage(body);
  }

  @Get('coverage/report/:classId/:subjectId')
  @UseGuards(AuthGuard('jwt'))
  getCoverageReport(@Param('classId') classId: string, @Param('subjectId') subjectId: string, @Query('termId') termId?: string) {
    return this.service.getCoverageReport(classId, subjectId, termId);
  }

  // ===================== ANALYTICS =====================

  @Get('analytics/subject/:subjectId')
  @UseGuards(AuthGuard('jwt'))
  getSubjectAnalytics(@Param('subjectId') subjectId: string, @Query('schoolId') schoolId?: string, @Query('classId') classId?: string) {
    return this.analytics.getSubjectPerformanceAnalytics(subjectId, schoolId, classId);
  }

  @Get('analytics/curriculum-compliance/:schoolId')
  @UseGuards(AuthGuard('jwt'))
  getCurriculumCompliance(@Param('schoolId') schoolId: string) {
    return this.analytics.getCurriculumCompliance(schoolId);
  }
}
