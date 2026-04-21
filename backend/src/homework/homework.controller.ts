import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('homework')
@UseGuards(JwtAuthGuard)
export class HomeworkController {
  constructor(private homeworkService: HomeworkService) {}

  @Get()
  async getAll(
    @Query('schoolId') schoolId: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('dueDate') dueDate?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.homeworkService.getAll(schoolId, {
      classId,
      subjectId,
      dueDate,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.homeworkService.getById(id);
  }

  @Get('student/:studentId')
  async getByStudent(
    @Param('studentId') studentId: string,
    @Query('includeCompleted') includeCompleted?: string,
  ) {
    return this.homeworkService.getByStudent(studentId, includeCompleted === 'true');
  }

  @Get('class/:classId')
  async getByClass(
    @Param('classId') classId: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.homeworkService.getByClass(classId, subjectId);
  }

  @Get('slot/:slotId')
  async getBySlot(@Param('slotId') slotId: string) {
    return this.homeworkService.getBySlot(slotId);
  }

  @Get(':id/submissions')
  async getSubmissions(@Param('id') id: string) {
    return this.homeworkService.getSubmissions(id);
  }

  @Get(':id/my-submission')
  async getMySubmission(
    @Param('id') id: string,
    @Query('studentId') studentId: string,
  ) {
    return this.homeworkService.getMySubmission(id, studentId);
  }

  @Get('calendar/list')
  async getCalendar(
    @Query('schoolId') schoolId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('classId') classId?: string,
  ) {
    return this.homeworkService.getCalendar(schoolId, startDate, endDate, classId);
  }

  @Post()
  async create(
    @Body() data: {
      title: string;
      description?: string;
      slotId?: string;
      classId: string;
      subjectId: string;
      dueDate: string;
      maxScore?: number;
      attachments?: string[];
      schoolId: string;
      createdById?: string;
    },
  ) {
    return this.homeworkService.create(data);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: {
      title?: string;
      description?: string;
      dueDate?: string;
      maxScore?: number;
      attachments?: string[];
    },
  ) {
    return this.homeworkService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.homeworkService.delete(id);
  }

  @Post(':id/submit')
  async submit(
    @Param('id') id: string,
    @Body() data: { studentId: string; submission?: string; attachments?: string[] },
  ) {
    return this.homeworkService.submit(id, data.studentId, {
      submission: data.submission,
      attachments: data.attachments,
    });
  }

  @Post('submission/:submissionId/grade')
  async grade(
    @Param('submissionId') submissionId: string,
    @Body() data: { score: number; feedback?: string },
  ) {
    return this.homeworkService.grade(submissionId, data);
  }
}
