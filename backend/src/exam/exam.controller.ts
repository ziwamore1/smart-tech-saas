import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ExamService } from './exam.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('exam')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamController {
  constructor(private examService: ExamService) {}

  @Post()
  @Roles('TEACHER', 'DIRECTOR')
  async create(@Body() data: any, @Request() req: any) {
    return this.examService.create({
      ...data,
      schoolId: req.user.schoolId,
      createdById: req.user.id,
    });
  }

  @Get()
  async getAll(
    @Request() req: any,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('termId') termId?: string,
    @Query('type') type?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    return this.examService.getAll(req.user.schoolId, {
      classId,
      subjectId,
      termId,
      type,
      isPublished: isPublished === 'true' ? true : isPublished === 'false' ? false : undefined,
    });
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

  @Post(':id/publish')
  @Roles('TEACHER', 'DIRECTOR')
  async publish(@Param('id') id: string) {
    return this.examService.update(id, { isPublished: true });
  }

  @Post(':id/unpublish')
  @Roles('TEACHER', 'DIRECTOR')
  async unpublish(@Param('id') id: string) {
    return this.examService.update(id, { isPublished: false });
  }

  @Post(':id/questions')
  @Roles('TEACHER', 'DIRECTOR')
  async addQuestion(@Param('id') id: string, @Body() data: any) {
    return this.examService.addQuestion(id, data);
  }

  @Patch('questions/:questionId')
  @Roles('TEACHER', 'DIRECTOR')
  async updateQuestion(
    @Param('questionId') questionId: string,
    @Body() data: any,
  ) {
    return this.examService.updateQuestion(questionId, data);
  }

  @Delete('questions/:questionId')
  @Roles('TEACHER', 'DIRECTOR')
  async deleteQuestion(@Param('questionId') questionId: string) {
    return this.examService.deleteQuestion(questionId);
  }

  @Post(':id/upload-question')
  @Roles('TEACHER', 'DIRECTOR')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/exams',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `question-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.originalname.endsWith('.docx') || file.originalname.endsWith('.doc')) {
          callback(null, true);
        } else {
          callback(new Error('Only Word documents are allowed'), false);
        }
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadQuestion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { question: string; questionType: string; correctAnswer: string; score: string },
  ) {
    const baseUrl = process.env.UPLOAD_BASE_URL || '';
    const fileUrl = `${baseUrl}/uploads/exams/${file.filename}`;
    return this.examService.addQuestion(id, {
      question: body.question,
      questionType: body.questionType,
      correctAnswer: body.correctAnswer,
      score: parseFloat(body.score) || 10,
      attachmentUrl: fileUrl,
    });
  }

  @Post(':id/start')
  @Roles('STUDENT', 'TEACHER', 'DIRECTOR')
  async startAttempt(
    @Param('id') id: string,
    @Body() data: { studentId: string },
  ) {
    return this.examService.startAttempt(id, data.studentId);
  }

  @Post('attempt/:attemptId/answer')
  @Roles('STUDENT', 'TEACHER', 'DIRECTOR')
  async submitAnswer(
    @Param('attemptId') attemptId: string,
    @Body() data: { questionId: string; answer: string },
  ) {
    return this.examService.submitAnswer(attemptId, data.questionId, data.answer);
  }

  @Post('attempt/:attemptId/submit')
  @Roles('STUDENT', 'TEACHER', 'DIRECTOR')
  async submitExam(@Param('attemptId') attemptId: string) {
    return this.examService.submitExam(attemptId);
  }

  @Get('results/student')
  @Roles('STUDENT', 'TEACHER', 'DIRECTOR')
  async getStudentResults(
    @Request() req: any,
    @Query('examId') examId?: string,
    @Query('classId') classId?: string,
    @Query('termId') termId?: string,
  ) {
    const studentId = req.user.studentId;
    if (!studentId) {
      throw new Error('Student ID not found');
    }
    return this.examService.getStudentResults(studentId, { examId, classId, termId });
  }

  @Get(':id/results')
  @Roles('TEACHER', 'DIRECTOR')
  async getExamResults(@Param('id') id: string) {
    return this.examService.getExamResults(id);
  }
}
