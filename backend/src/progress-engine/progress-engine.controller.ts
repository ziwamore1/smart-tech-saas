import { Controller, Get, Header, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProgressEngineService } from './progress-engine.service';
import { ProgressReportService } from './progress-report.service';

@Controller('progress')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressEngineController {
  constructor(private readonly progress: ProgressEngineService, private readonly reports: ProgressReportService) {}

  @Get('students/:studentId')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Teacher', 'Class Teacher', 'SuperAdmin')
  getStudent(@Param('studentId') studentId: string, @Query() query: Record<string, string>, @Req() req: any) {
    return this.progress.getStudentProgress(studentId, req.user.schoolId, query);
  }

  @Get('students/:studentId/timeline')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Teacher', 'Class Teacher', 'SuperAdmin')
  getTimeline(@Param('studentId') studentId: string, @Query() query: Record<string, string>, @Req() req: any) {
    return this.progress.getStudentProgress(studentId, req.user.schoolId, query);
  }

  @Get('classes/:classId')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Teacher', 'Class Teacher', 'SuperAdmin')
  getClass(@Param('classId') classId: string, @Query() query: Record<string, string>, @Req() req: any) {
    return this.progress.getClassProgress(classId, req.user.schoolId, query);
  }

  @Get('teachers/:teacherId/subjects/:subjectId')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Teacher', 'Class Teacher', 'SuperAdmin')
  getTeacherSubject(@Param('teacherId') teacherId: string, @Param('subjectId') subjectId: string, @Query() query: Record<string, string>, @Req() req: any) {
    return this.progress.getTeacherSubjectProgress(teacherId, subjectId, req.user.schoolId, query);
  }

  @Post('students/:studentId/recalculate')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'SuperAdmin')
  recalculate(@Param('studentId') studentId: string, @Req() req: any) {
    return this.progress.recalculateStudent(studentId, req.user.schoolId);
  }

  @Post('classes/:classId/recalculate')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'SuperAdmin')
  recalculateClass(@Param('classId') classId: string, @Req() req: any) {
    return this.progress.recalculateClass(classId, req.user.schoolId);
  }

  @Get('reports/student/:studentId/pdf')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Teacher', 'Class Teacher', 'SuperAdmin')
  @Header('Content-Type', 'application/pdf')
  async studentReport(@Param('studentId') studentId: string, @Req() req: any, @Res() res: Response) {
    const report = await this.reports.generateStudentPdf(studentId, req.user.schoolId, req.user.sub || req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.send(report.pdf);
  }
}
