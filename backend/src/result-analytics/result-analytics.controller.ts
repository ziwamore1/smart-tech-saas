import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ResultAnalyticsService } from './result-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('result-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultAnalyticsController {
  constructor(private analytics: ResultAnalyticsService) {}

  @Get('class')
  @Roles('Director', 'Teacher', 'Class Teacher')
  getClassAnalytics(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.analytics.getClassAnalytics(classId, termId, req.user.schoolId);
  }

  @Get('teacher')
  @Roles('Director', 'Teacher', 'Class Teacher')
  getTeacherAnalytics(
    @Query('termId') termId?: string,
    @Request() req?,
  ) {
    return this.analytics.getTeacherAnalytics(req.user.id, req.user.schoolId, termId);
  }

  @Get('student/trend')
  @Roles('Director', 'Teacher', 'Class Teacher')
  getStudentTrend(
    @Query('studentId') studentId: string,
    @Request() req,
  ) {
    return this.analytics.getStudentTrendAnalysis(studentId, req.user.schoolId);
  }

  @Get('at-risk')
  @Roles('Director', 'Teacher', 'Class Teacher')
  getAtRiskStudents(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.analytics.getAtRiskStudents(classId, termId, req.user.schoolId);
  }

  @Get('school')
  @Roles('Director')
  getSchoolOverview(
    @Request() req,
    @Query('termId') termId?: string,
  ) {
    return this.analytics.getSchoolPerformanceOverview(req.user.schoolId, termId);
  }
}
