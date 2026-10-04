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

  @Get('me')
  @Roles('Student')
  getMyProgress(@Query() query: Record<string, string>, @Req() req: any) {
    return this.progress.getStudentProgressForOwner(req.user.studentId || req.user.sub || req.user.id, req.user.schoolId, req.user.sub || req.user.id, 'STUDENT', query);
  }

  @Get('children/:studentId')
  @Roles('Parent')
  getChildProgress(@Param('studentId') studentId: string, @Query() query: Record<string, string>, @Req() req: any) {
    return this.progress.getStudentProgressForOwner(studentId, req.user.schoolId, req.user.sub || req.user.id, 'PARENT', query);
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

  @Post('recalculate')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'SuperAdmin')
  recalculateSchool(@Req() req: any) {
    return this.progress.startSchoolBackfill(req.user.schoolId);
  }

  @Get('recalculate/:jobId')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'SuperAdmin')
  backfillStatus(@Param('jobId') jobId: string, @Req() req: any) {
    return this.progress.getBackfillStatus(jobId, req.user.schoolId);
  }

  @Get('reports/student/:studentId/pdf')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Teacher', 'Class Teacher', 'SuperAdmin')
  @Header('Content-Type', 'application/pdf')
  async studentReport(@Param('studentId') studentId: string, @Req() req: any, @Res() res: Response) {
    const report = await this.reports.generateStudentPdf(studentId, req.user.schoolId, req.user.sub || req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.send(report.pdf);
  }

  @Get('reports/class/:classId/pdf')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'SuperAdmin')
  @Header('Content-Type', 'application/pdf')
  async classReport(@Param('classId') classId: string, @Query() query: Record<string, string>, @Req() req: any, @Res() res: Response) {
    const report = await this.reports.generateClassPdf(classId, req.user.schoolId, req.user.sub || req.user.id, query);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.send(report.pdf);
  }

  @Get('reports/teachers/:teacherId/subjects/:subjectId/pdf')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Teacher', 'Class Teacher', 'SuperAdmin')
  @Header('Content-Type', 'application/pdf')
  async teacherSubjectReport(@Param('teacherId') teacherId: string, @Param('subjectId') subjectId: string, @Query() query: Record<string, string>, @Req() req: any, @Res() res: Response) {
    const report = await this.reports.generateTeacherSubjectPdf(teacherId, subjectId, req.user.schoolId, req.user.sub || req.user.id, query);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.send(report.pdf);
  }
}
