import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, UseInterceptors, UploadedFile, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamService } from './exam.service';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
import { cloudinaryMemoryStorage, CLOUDINARY_FILE_FILTER } from '../cloudinary/multer-cloudinary';
import { ExamMarkingService } from './exam-marking.service';
import { ExamTemplateService } from './exam-template.service';
import { QuestionBankService } from './question-bank.service';
import { UploadedExamService } from './uploaded-exam.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('exam')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamController {
  constructor(
    private examService: ExamService,
    private markingService: ExamMarkingService,
    private templateService: ExamTemplateService,
    private questionBankService: QuestionBankService,
    private uploadedExamService: UploadedExamService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ===== CRUD =====
  @Post()
  @Roles('Teacher', 'Director')
  async create(@Body() data: any, @Request() req: any) {
    if (!req.user.schoolId) throw new NotFoundException('School ID required');
    return this.examService.create({ ...data, schoolId: req.user.schoolId, createdById: req.user.id });
  }

  @Get()
  async getAll(@Request() req: any, @Query() filters: any) {
    if (!req.user.schoolId) return [];
    return this.examService.getAll(req.user.schoolId, filters);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.examService.getById(id);
  }

  @Patch(':id')
  @Roles('Teacher', 'Director')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.examService.update(id, data);
  }

  @Delete(':id')
  @Roles('Teacher', 'Director')
  async delete(@Param('id') id: string) {
    return this.examService.delete(id);
  }

  // ===== Sections =====
  @Post(':id/sections')
  @Roles('Teacher', 'Director')
  async addSection(@Param('id') id: string, @Body() data: any) {
    return this.examService.addSection(id, data);
  }

  @Get(':id/sections')
  async getSections(@Param('id') id: string) {
    return this.examService.getSections(id);
  }

  @Patch('sections/:sectionId')
  @Roles('Teacher', 'Director')
  async updateSection(@Param('sectionId') sectionId: string, @Body() data: any) {
    return this.examService.updateSection(sectionId, data);
  }

  @Delete('sections/:sectionId')
  @Roles('Teacher', 'Director')
  async deleteSection(@Param('sectionId') sectionId: string) {
    return this.examService.deleteSection(sectionId);
  }

  // ===== Questions =====
  @Post(':id/questions')
  @Roles('Teacher', 'Director')
  async addQuestion(@Param('id') id: string, @Body() data: any) {
    return this.examService.addQuestion(id, data);
  }

  @Patch('questions/:questionId')
  @Roles('Teacher', 'Director')
  async updateQuestion(@Param('questionId') questionId: string, @Body() data: any) {
    return this.examService.updateQuestion(questionId, data);
  }

  @Delete('questions/:questionId')
  @Roles('Teacher', 'Director')
  async deleteQuestion(@Param('questionId') questionId: string) {
    return this.examService.deleteQuestion(questionId);
  }

  @Post(':id/questions/reorder')
  @Roles('Teacher', 'Director')
  async reorderQuestions(@Param('id') id: string, @Body('order') order: { id: string; order: number }[]) {
    return this.examService.reorderQuestions(id, order);
  }

  @Post(':id/upload-question')
  @Roles('Teacher', 'Director')
  @UseInterceptors(FileInterceptor('file', {
    storage: cloudinaryMemoryStorage(),
    fileFilter: CLOUDINARY_FILE_FILTER,
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  async uploadQuestionFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() body: any) {
    const result = await this.cloudinary.upload(file, FOLDERS.examinations);
    return this.examService.addQuestion(id, {
      question: body.question,
      questionType: body.questionType || 'FILE_UPLOAD',
      correctAnswer: body.correctAnswer,
      score: parseFloat(body.score) || 10,
      attachmentUrl: result.secureUrl,
    });
  }

  // ===== Publish / Status =====
  @Post(':id/publish')
  @Roles('Teacher', 'Director')
  async publish(@Param('id') id: string) {
    return this.examService.update(id, { isPublished: true, status: 'published' });
  }

  @Post(':id/unpublish')
  @Roles('Teacher', 'Director')
  async unpublish(@Param('id') id: string) {
    return this.examService.update(id, { isPublished: false, status: 'draft' });
  }

  @Post(':id/archive')
  @Roles('Teacher', 'Director')
  async archive(@Param('id') id: string) {
    return this.examService.update(id, { status: 'archived' });
  }

  // ===== Preview =====
  @Get(':id/preview')
  async getPreview(@Param('id') id: string) {
    return this.examService.getPreview(id);
  }

  @Post(':id/preview/html')
  @Roles('Teacher', 'Director')
  async renderPreviewHtml(@Param('id') id: string) {
    return this.examService.renderPreviewHtml(id);
  }

  // ===== Answer Key / Marking Key =====
  @Post(':id/answer-key')
  @Roles('Teacher', 'Director')
  @UseInterceptors(FileInterceptor('file', {
    storage: cloudinaryMemoryStorage(),
    fileFilter: CLOUDINARY_FILE_FILTER,
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  async uploadAnswerKey(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinary.upload(file, FOLDERS.examinations);
    return this.examService.update(id, { answerKeyUrl: result.secureUrl });
  }

  @Post(':id/marking-key')
  @Roles('Teacher', 'Director')
  @UseInterceptors(FileInterceptor('file', {
    storage: cloudinaryMemoryStorage(),
    fileFilter: CLOUDINARY_FILE_FILTER,
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  async uploadMarkingKey(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinary.upload(file, FOLDERS.examinations);
    return this.examService.update(id, { markingKeyUrl: result.secureUrl });
  }

  @Patch(':id/auto-grade')
  @Roles('Teacher', 'Director')
  async toggleAutoGrade(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.examService.update(id, { autoGrade: enabled });
  }

  @Patch('attempt/:attemptId/answer')
  @Roles('Teacher', 'Director')
  async gradeAnswer(@Param('attemptId') attemptId: string, @Body() data: { questionId: string; score: number; isCorrect?: boolean; feedback?: string }) {
    return this.examService.updateExamAnswer(attemptId, data.questionId, data);
  }

  // ===== Attempts & Taking Exams =====
  @Post(':id/start')
  @Roles('Student', 'Teacher', 'Director')
  async startAttempt(@Param('id') id: string, @Body() data: { studentId: string }, @Request() req: any) {
    const studentId = data.studentId || req.user.studentId;
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.examService.startAttempt(id, studentId, ip, ua);
  }

  @Post('attempt/:attemptId/answer')
  @Roles('Student', 'Teacher', 'Director')
  async submitAnswer(@Param('attemptId') attemptId: string, @Body() data: { questionId: string; answer: string; timeSpent?: number }) {
    return this.examService.submitAnswer(attemptId, data.questionId, data.answer, data.timeSpent);
  }

  @Post('attempt/:attemptId/submit')
  @Roles('Student', 'Teacher', 'Director')
  async submitExam(@Param('attemptId') attemptId: string) {
    return this.examService.submitExam(attemptId);
  }

  @Get('attempt/:attemptId')
  async getAttempt(@Param('attemptId') attemptId: string) {
    return this.examService.getAttempt(attemptId);
  }

  // ===== Auto-Marking =====
  @Post(':id/auto-mark')
  @Roles('Teacher', 'Director')
  async autoMarkExam(@Param('id') examId: string) {
    const attempts = await this.examService.getAttemptsForMarking(examId);
    const results = [];
    for (const a of attempts) {
      results.push(await this.markingService.autoMarkAttempt(a.id));
    }
    return results;
  }

  @Post('attempt/:attemptId/auto-mark')
  @Roles('Teacher', 'Director')
  async autoMarkSingle(@Param('attemptId') attemptId: string) {
    return this.markingService.autoMarkAttempt(attemptId);
  }

  // ===== Results =====
  @Get(':id/results')
  async getExamResults(@Param('id') id: string) {
    return this.examService.getExamResults(id);
  }

  @Get('results/student')
  @Roles('Student', 'Teacher', 'Director')
  async getStudentResults(@Request() req: any, @Query() filters: any) {
    const studentId = req.user.studentId || filters.studentId;
    if (!studentId) throw new NotFoundException('Student ID not found');
    return this.examService.getStudentResults(studentId, filters);
  }

  @Get(':id/stats')
  async getExamStats(@Param('id') id: string) {
    return this.markingService.computeExamStats(id);
  }

  // ===== Question Bank =====
  @Get('bank/questions')
  async getBankQuestions(@Request() req: any, @Query() filters: any) {
    if (!req.user.schoolId) return [];
    return this.questionBankService.getAll(req.user.schoolId, filters);
  }

  @Post('bank/questions')
  @Roles('Teacher', 'Director')
  async createBankQuestion(@Body() data: any, @Request() req: any) {
    return this.questionBankService.create(req.user.schoolId, data, req.user.id);
  }

  @Patch('bank/questions/:id')
  @Roles('Teacher', 'Director')
  async updateBankQuestion(@Param('id') id: string, @Body() data: any) {
    return this.questionBankService.update(id, data);
  }

  @Delete('bank/questions/:id')
  @Roles('Teacher', 'Director')
  async deleteBankQuestion(@Param('id') id: string) {
    return this.questionBankService.delete(id);
  }

  @Post(':id/bank/import')
  @Roles('Teacher', 'Director')
  async importFromBank(@Param('id') id: string, @Body('questionIds') questionIds: string[]) {
    return this.questionBankService.importToExam(questionIds, id);
  }

  @Get('bank/categories')
  async getBankCategories(@Request() req: any, @Query('subjectId') subjectId?: string) {
    if (!req.user.schoolId) return [];
    return this.questionBankService.getCategories(req.user.schoolId, subjectId);
  }

  @Post('bank/categories')
  @Roles('Teacher', 'Director')
  async createBankCategory(@Body() data: any, @Request() req: any) {
    return this.questionBankService.createCategory(req.user.schoolId, data);
  }

  @Delete('bank/categories/:id')
  @Roles('Teacher', 'Director')
  async deleteBankCategory(@Param('id') id: string) {
    return this.questionBankService.deleteCategory(id);
  }

  // ===== Exam Templates =====
  @Get('templates')
  async getTemplates(@Request() req: any, @Query('subjectId') subjectId?: string) {
    if (!req.user.schoolId) return [];
    return this.templateService.getAll(req.user.schoolId, subjectId);
  }

  @Get('templates/:id')
  async getTemplateById(@Param('id') id: string) {
    return this.templateService.getById(id);
  }

  @Post('templates')
  @Roles('Teacher', 'Director')
  async createTemplate(@Body() data: any, @Request() req: any) {
    return this.templateService.create(req.user.schoolId, data, req.user.id);
  }

  @Patch('templates/:id')
  @Roles('Teacher', 'Director')
  async updateTemplate(@Param('id') id: string, @Body() data: any) {
    return this.templateService.update(id, data);
  }

  @Delete('templates/:id')
  @Roles('Teacher', 'Director')
  async deleteTemplate(@Param('id') id: string) {
    return this.templateService.delete(id);
  }

  @Post(':id/apply-template')
  @Roles('Teacher', 'Director')
  async applyTemplate(@Param('id') id: string, @Body('templateId') templateId: string) {
    return this.examService.applyTemplate(id, templateId);
  }

  // ===== Uploaded Exams =====
  @Post('upload')
  @Roles('Teacher', 'Director')
  @UseInterceptors(FileInterceptor('file', {
    storage: cloudinaryMemoryStorage(),
    fileFilter: CLOUDINARY_FILE_FILTER,
    limits: { fileSize: 100 * 1024 * 1024 },
  }))
  async uploadExam(@UploadedFile() file: Express.Multer.File, @Body() data: any, @Request() req: any) {
    const result = await this.cloudinary.upload(file, FOLDERS.examinations);
    return this.uploadedExamService.create({
      ...data,
      fileUrl: result.secureUrl,
      fileName: file.originalname,
      fileType: result.format || file.originalname.split('.').pop()?.toLowerCase() || 'unknown',
      fileSize: result.size,
      schoolId: req.user.schoolId,
      createdById: req.user.id,
    });
  }

  @Get('uploaded/list')
  async getUploadedExams(@Request() req: any) {
    if (!req.user.schoolId) return [];
    return this.uploadedExamService.getAll(req.user.schoolId);
  }

  @Get('uploaded/:id')
  async getUploadedExam(@Param('id') id: string) {
    return this.uploadedExamService.getById(id);
  }

  @Patch('uploaded/:id')
  @Roles('Teacher', 'Director')
  async updateUploadedExam(@Param('id') id: string, @Body() data: any) {
    return this.uploadedExamService.update(id, data);
  }

  @Delete('uploaded/:id')
  @Roles('Teacher', 'Director')
  async deleteUploadedExam(@Param('id') id: string) {
    return this.uploadedExamService.delete(id);
  }

  @Post('uploaded/:id/answer-script')
  @Roles('Teacher', 'Director')
  @UseInterceptors(FileInterceptor('file', {
    storage: cloudinaryMemoryStorage(),
    fileFilter: CLOUDINARY_FILE_FILTER,
    limits: { fileSize: 100 * 1024 * 1024 },
  }))
  async uploadAnswerScript(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinary.upload(file, FOLDERS.examinations);
    return this.uploadedExamService.attachAnswerScript(id, result.secureUrl);
  }

  @Post('uploaded/:id/parse')
  @Roles('Teacher', 'Director')
  async parseExamDoc(@Param('id') id: string) {
    return this.uploadedExamService.parseDocument(id);
  }

  @Get('uploaded/:id/preview')
  async getUploadedPreview(@Param('id') id: string) {
    return this.uploadedExamService.getPreview(id);
  }
}
