import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, UseInterceptors, UploadedFile, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ExamService } from './exam.service';
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
  ) {}

  // ===== CRUD =====
  @Post()
  @Roles('TEACHER', 'DIRECTOR')
  async create(@Body() data: any, @Request() req: any) {
    if (!req.user.schoolId) throw new NotFoundException('School ID required');
    return this.examService.create({ ...data, schoolId: req.user.schoolId, createdById: req.user.id });
  }

  @Get()
  async getAll(@Request() req: any, @Query() filters: any) {
    if (!req.user.schoolId) throw new NotFoundException('School ID required');
    return this.examService.getAll(req.user.schoolId, filters);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.examService.getById(id);
  }

  @Patch(':id')
  @Roles('TEACHER', 'DIRECTOR')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.examService.update(id, data);
  }

  @Delete(':id')
  @Roles('TEACHER', 'DIRECTOR')
  async delete(@Param('id') id: string) {
    return this.examService.delete(id);
  }

  // ===== Sections =====
  @Post(':id/sections')
  @Roles('TEACHER', 'DIRECTOR')
  async addSection(@Param('id') id: string, @Body() data: any) {
    return this.examService.addSection(id, data);
  }

  @Get(':id/sections')
  async getSections(@Param('id') id: string) {
    return this.examService.getSections(id);
  }

  @Patch('sections/:sectionId')
  @Roles('TEACHER', 'DIRECTOR')
  async updateSection(@Param('sectionId') sectionId: string, @Body() data: any) {
    return this.examService.updateSection(sectionId, data);
  }

  @Delete('sections/:sectionId')
  @Roles('TEACHER', 'DIRECTOR')
  async deleteSection(@Param('sectionId') sectionId: string) {
    return this.examService.deleteSection(sectionId);
  }

  // ===== Questions =====
  @Post(':id/questions')
  @Roles('TEACHER', 'DIRECTOR')
  async addQuestion(@Param('id') id: string, @Body() data: any) {
    return this.examService.addQuestion(id, data);
  }

  @Patch('questions/:questionId')
  @Roles('TEACHER', 'DIRECTOR')
  async updateQuestion(@Param('questionId') questionId: string, @Body() data: any) {
    return this.examService.updateQuestion(questionId, data);
  }

  @Delete('questions/:questionId')
  @Roles('TEACHER', 'DIRECTOR')
  async deleteQuestion(@Param('questionId') questionId: string) {
    return this.examService.deleteQuestion(questionId);
  }

  @Post(':id/questions/reorder')
  @Roles('TEACHER', 'DIRECTOR')
  async reorderQuestions(@Param('id') id: string, @Body('order') order: { id: string; order: number }[]) {
    return this.examService.reorderQuestions(id, order);
  }

  @Post(':id/upload-question')
  @Roles('TEACHER', 'DIRECTOR')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/exams',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `question-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (file.originalname.endsWith('.docx') || file.originalname.endsWith('.doc') || file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only Word documents and images are allowed'), false);
      }
    },
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  async uploadQuestionFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() body: any) {
    const baseUrl = process.env.UPLOAD_BASE_URL || '';
    const fileUrl = `${baseUrl}/uploads/exams/${file.filename}`;
    return this.examService.addQuestion(id, {
      question: body.question,
      questionType: body.questionType || 'FILE_UPLOAD',
      correctAnswer: body.correctAnswer,
      score: parseFloat(body.score) || 10,
      attachmentUrl: fileUrl,
    });
  }

  // ===== Publish / Status =====
  @Post(':id/publish')
  @Roles('TEACHER', 'DIRECTOR')
  async publish(@Param('id') id: string) {
    return this.examService.update(id, { isPublished: true, status: 'published' });
  }

  @Post(':id/unpublish')
  @Roles('TEACHER', 'DIRECTOR')
  async unpublish(@Param('id') id: string) {
    return this.examService.update(id, { isPublished: false, status: 'draft' });
  }

  @Post(':id/archive')
  @Roles('TEACHER', 'DIRECTOR')
  async archive(@Param('id') id: string) {
    return this.examService.update(id, { status: 'archived' });
  }

  // ===== Preview =====
  @Get(':id/preview')
  async getPreview(@Param('id') id: string) {
    return this.examService.getPreview(id);
  }

  @Post(':id/preview/html')
  @Roles('TEACHER', 'DIRECTOR')
  async renderPreviewHtml(@Param('id') id: string) {
    return this.examService.renderPreviewHtml(id);
  }

  // ===== Attempts & Taking Exams =====
  @Post(':id/start')
  @Roles('STUDENT', 'TEACHER', 'DIRECTOR')
  async startAttempt(@Param('id') id: string, @Body() data: { studentId: string }, @Request() req: any) {
    const studentId = data.studentId || req.user.studentId;
    return this.examService.startAttempt(id, studentId);
  }

  @Post('attempt/:attemptId/answer')
  @Roles('STUDENT', 'TEACHER', 'DIRECTOR')
  async submitAnswer(@Param('attemptId') attemptId: string, @Body() data: { questionId: string; answer: string; timeSpent?: number }) {
    return this.examService.submitAnswer(attemptId, data.questionId, data.answer, data.timeSpent);
  }

  @Post('attempt/:attemptId/submit')
  @Roles('STUDENT', 'TEACHER', 'DIRECTOR')
  async submitExam(@Param('attemptId') attemptId: string) {
    return this.examService.submitExam(attemptId);
  }

  @Get('attempt/:attemptId')
  async getAttempt(@Param('attemptId') attemptId: string) {
    return this.examService.getAttempt(attemptId);
  }

  // ===== Auto-Marking =====
  @Post(':id/auto-mark')
  @Roles('TEACHER', 'DIRECTOR')
  async autoMarkExam(@Param('id') examId: string) {
    const attempts = await this.examService.getAttemptsForMarking(examId);
    const results = [];
    for (const a of attempts) {
      results.push(await this.markingService.autoMarkAttempt(a.id));
    }
    return results;
  }

  @Post('attempt/:attemptId/auto-mark')
  @Roles('TEACHER', 'DIRECTOR')
  async autoMarkSingle(@Param('attemptId') attemptId: string) {
    return this.markingService.autoMarkAttempt(attemptId);
  }

  // ===== Results =====
  @Get(':id/results')
  async getExamResults(@Param('id') id: string) {
    return this.examService.getExamResults(id);
  }

  @Get('results/student')
  @Roles('STUDENT', 'TEACHER', 'DIRECTOR')
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
    return this.questionBankService.getAll(req.user.schoolId, filters);
  }

  @Post('bank/questions')
  @Roles('TEACHER', 'DIRECTOR')
  async createBankQuestion(@Body() data: any, @Request() req: any) {
    return this.questionBankService.create(req.user.schoolId, data, req.user.id);
  }

  @Patch('bank/questions/:id')
  @Roles('TEACHER', 'DIRECTOR')
  async updateBankQuestion(@Param('id') id: string, @Body() data: any) {
    return this.questionBankService.update(id, data);
  }

  @Delete('bank/questions/:id')
  @Roles('TEACHER', 'DIRECTOR')
  async deleteBankQuestion(@Param('id') id: string) {
    return this.questionBankService.delete(id);
  }

  @Post(':id/bank/import')
  @Roles('TEACHER', 'DIRECTOR')
  async importFromBank(@Param('id') id: string, @Body('questionIds') questionIds: string[]) {
    return this.questionBankService.importToExam(questionIds, id);
  }

  @Get('bank/categories')
  async getBankCategories(@Request() req: any, @Query('subjectId') subjectId?: string) {
    return this.questionBankService.getCategories(req.user.schoolId, subjectId);
  }

  @Post('bank/categories')
  @Roles('TEACHER', 'DIRECTOR')
  async createBankCategory(@Body() data: any, @Request() req: any) {
    return this.questionBankService.createCategory(req.user.schoolId, data);
  }

  @Delete('bank/categories/:id')
  @Roles('TEACHER', 'DIRECTOR')
  async deleteBankCategory(@Param('id') id: string) {
    return this.questionBankService.deleteCategory(id);
  }

  // ===== Exam Templates =====
  @Get('templates')
  async getTemplates(@Request() req: any, @Query('subjectId') subjectId?: string) {
    return this.templateService.getAll(req.user.schoolId, subjectId);
  }

  @Get('templates/:id')
  async getTemplateById(@Param('id') id: string) {
    return this.templateService.getById(id);
  }

  @Post('templates')
  @Roles('TEACHER', 'DIRECTOR')
  async createTemplate(@Body() data: any, @Request() req: any) {
    return this.templateService.create(req.user.schoolId, data, req.user.id);
  }

  @Patch('templates/:id')
  @Roles('TEACHER', 'DIRECTOR')
  async updateTemplate(@Param('id') id: string, @Body() data: any) {
    return this.templateService.update(id, data);
  }

  @Delete('templates/:id')
  @Roles('TEACHER', 'DIRECTOR')
  async deleteTemplate(@Param('id') id: string) {
    return this.templateService.delete(id);
  }

  @Post(':id/apply-template')
  @Roles('TEACHER', 'DIRECTOR')
  async applyTemplate(@Param('id') id: string, @Body('templateId') templateId: string) {
    return this.examService.applyTemplate(id, templateId);
  }

  // ===== Uploaded Exams =====
  @Post('upload')
  @Roles('TEACHER', 'DIRECTOR')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/exams',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `uploaded-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
  }))
  async uploadExam(@UploadedFile() file: Express.Multer.File, @Body() data: any, @Request() req: any) {
    const baseUrl = process.env.UPLOAD_BASE_URL || '';
    const fileUrl = `${baseUrl}/uploads/exams/${file.filename}`;
    return this.uploadedExamService.create({
      ...data,
      fileUrl,
      fileName: file.originalname,
      fileType: extname(file.originalname).toLowerCase().replace('.', ''),
      fileSize: file.size,
      schoolId: req.user.schoolId,
      createdById: req.user.id,
    });
  }

  @Get('uploaded/list')
  async getUploadedExams(@Request() req: any) {
    return this.uploadedExamService.getAll(req.user.schoolId);
  }

  @Get('uploaded/:id')
  async getUploadedExam(@Param('id') id: string) {
    return this.uploadedExamService.getById(id);
  }

  @Patch('uploaded/:id')
  @Roles('TEACHER', 'DIRECTOR')
  async updateUploadedExam(@Param('id') id: string, @Body() data: any) {
    return this.uploadedExamService.update(id, data);
  }

  @Delete('uploaded/:id')
  @Roles('TEACHER', 'DIRECTOR')
  async deleteUploadedExam(@Param('id') id: string) {
    return this.uploadedExamService.delete(id);
  }

  @Post('uploaded/:id/answer-script')
  @Roles('TEACHER', 'DIRECTOR')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/exams/scripts',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `script-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
  }))
  async uploadAnswerScript(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const baseUrl = process.env.UPLOAD_BASE_URL || '';
    const fileUrl = `${baseUrl}/uploads/exams/scripts/${file.filename}`;
    return this.uploadedExamService.attachAnswerScript(id, fileUrl);
  }

  @Post('uploaded/:id/parse')
  @Roles('TEACHER', 'DIRECTOR')
  async parseExamDoc(@Param('id') id: string) {
    return this.uploadedExamService.parseDocument(id);
  }

  @Get('uploaded/:id/preview')
  async getUploadedPreview(@Param('id') id: string) {
    return this.uploadedExamService.getPreview(id);
  }
}
