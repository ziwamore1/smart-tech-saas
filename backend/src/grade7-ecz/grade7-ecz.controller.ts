import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Grade7EczService } from './grade7-ecz.service';

@Controller('grade7-ecz')
@UseGuards(JwtAuthGuard, RolesGuard)
export class Grade7EczController {
  constructor(private readonly grade7Ecz: Grade7EczService) {}

  @Get('classes')
  @Roles('DIRECTOR', 'CLASS_TEACHER', 'TEACHER')
  async getClasses(@Request() req) {
    const data = await this.grade7Ecz.getSchoolGrade7Classes(req.user.schoolId);
    return { data, message: 'Grade 7 classes retrieved' };
  }

  @Post('mock-exam')
  @Roles('DIRECTOR', 'CLASS_TEACHER', 'TEACHER')
  async createMockExam(
    @Body() body: {
      classId: string;
      termId: string;
      subjectId: string;
      title: string;
      paperType: 'SP1' | 'SP2' | 'MOCK';
      duration: number;
      totalScore: number;
      instructions?: string;
      questions?: any[];
    },
    @Request() req,
  ) {
    const data = await this.grade7Ecz.createGrade7MockExam({
      ...body,
      schoolId: req.user.schoolId,
      createdById: req.user.id,
    });
    return { data, message: 'Grade 7 mock exam created' };
  }

  @Get('mock-exams')
  @Roles('DIRECTOR', 'CLASS_TEACHER', 'TEACHER')
  async getMockExams(@Query('classId') classId: string, @Request() req) {
    const data = await this.grade7Ecz.getMockExams(req.user.schoolId, classId);
    return { data, message: 'Mock exams retrieved' };
  }

  @Get('mock-exams/:id/results')
  @Roles('DIRECTOR', 'CLASS_TEACHER', 'TEACHER')
  async getMockExamResults(@Param('id') id: string) {
    const data = await this.grade7Ecz.getMockExamResults(id);
    return { data, message: 'Mock exam results retrieved' };
  }

  @Post('enter-score')
  @Roles('DIRECTOR', 'CLASS_TEACHER', 'TEACHER')
  async enterScore(
    @Body() body: { examId: string; studentId: string; score: number; totalScore?: number },
    @Request() req,
  ) {
    const data = await this.grade7Ecz.enterGrade7Score({
      ...body,
      schoolId: req.user.schoolId,
      gradedBy: req.user.id,
    });
    return { data, message: 'Score entered successfully' };
  }

  @Post('enter-bulk-scores')
  @Roles('DIRECTOR', 'CLASS_TEACHER', 'TEACHER')
  async enterBulkScores(
    @Body() body: { examId: string; scores: Array<{ studentId: string; score: number }> },
    @Request() req,
  ) {
    const data = await this.grade7Ecz.enterBulkGrade7Scores({
      ...body,
      schoolId: req.user.schoolId,
      gradedBy: req.user.id,
    });
    return { data, message: 'Bulk scores entered successfully' };
  }

  @Post('compute/:classId/:termId')
  @Roles('DIRECTOR')
  async computeGrade7(@Param('classId') classId: string, @Param('termId') termId: string) {
    const data = await this.grade7Ecz.computeGrade7FromExams(classId, termId);
    return { data, message: 'Grade 7 computation completed' };
  }

  @Get('results/:classId/:termId')
  @Roles('DIRECTOR', 'CLASS_TEACHER', 'TEACHER')
  async getResults(@Param('classId') classId: string, @Param('termId') termId: string) {
    const data = await this.grade7Ecz.getGrade7Results(classId, termId);
    return { data, message: 'Grade 7 results retrieved' };
  }

  @Post('rank/:schoolId/:termId')
  @Roles('DIRECTOR')
  async rankResults(@Param('schoolId') schoolId: string, @Param('termId') termId: string) {
    const data = await this.grade7Ecz.rankGrade7Results(schoolId, termId);
    return { data, message: 'Grade 7 results ranked' };
  }

  @Get('prediction/:classId/:termId')
  @Roles('DIRECTOR', 'CLASS_TEACHER', 'TEACHER')
  async getPrediction(@Param('classId') classId: string, @Param('termId') termId: string) {
    const data = await this.grade7Ecz.getSelectionPrediction(classId, termId);
    return { data, message: 'Selection prediction retrieved' };
  }
}
