import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ResultAnalyticsService } from './result-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('result-analytics')
@UseGuards(JwtAuthGuard)
export class ResultAnalyticsController {
  constructor(private analytics: ResultAnalyticsService) {}

  @Get('class')
  getClassAnalytics(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.analytics.getClassAnalytics(classId, termId, req.user.schoolId);
  }

  @Get('teacher')
  getTeacherAnalytics(
    @Query('termId') termId?: string,
    @Request() req?,
  ) {
    return this.analytics.getTeacherAnalytics(req.user.userId, req.user.schoolId, termId);
  }

  @Get('student/trend')
  getStudentTrend(
    @Query('studentId') studentId: string,
    @Request() req,
  ) {
    return this.analytics.getStudentTrendAnalysis(studentId, req.user.schoolId);
  }

  @Get('at-risk')
  getAtRiskStudents(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.analytics.getAtRiskStudents(classId, termId, req.user.schoolId);
  }

  @Get('school')
  getSchoolOverview(
    @Request() req,
    @Query('termId') termId?: string,
  ) {
    return this.analytics.getSchoolPerformanceOverview(req.user.schoolId, termId);
  }
}
