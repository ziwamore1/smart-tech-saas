import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('class-performance')
  async getClassPerformance(
    @Req() req: Request,
    @Query('classId') classId: string,
    @Query('term') term: string,
  ) {
    const user = (req as any).user;

    return this.analyticsService.getClassPerformance(
      user.schoolId,
      classId,
      term,
    );
  }
  @Get('class-ranking')
  @UseGuards(JwtAuthGuard)
  async getClassRanking(
    @Req() req: Request,
    @Query('classId') classId: string,
    @Query('term') term: string,
  ) {
    const user = (req as any).user;

    return this.analyticsService.getClassRanking(user.schoolId, classId, term);
  }
  @Get('student-comment')
  @UseGuards(JwtAuthGuard)
  async getStudentComment(
    @Req() req: Request,
    @Query('studentId') studentId: string,
    @Query('term') term: string,
  ) {
    const user = (req as any).user;

    return this.analyticsService.generateStudentComment(
      user.schoolId,
      studentId,
      term,
    );
  }
  @Get('subject-performance')
  async subjectPerformance(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.analyticsService.getSubjectPerformance(classId, termId);
  }

  @Get('grade-distribution')
  getGradeDistribution(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.analyticsService.getGradeDistribution(classId, termId);
  }

  @Get('gender-performance')
  genderPerformance(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.analyticsService.getGenderPerformance(classId, termId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('teacher-performance')
  teacherPerformance(@Req() req: any, @Query('termId') termId: string) {
    const user = (req as any).user;
    return this.analyticsService.getTeacherPerformance(user?.schoolId, termId);
  }
  @Get('director-dashboard')
  @Roles('Director')
  getDirectorDashboard(
    @Req() req: any,
    @Query('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.analyticsService.getDirectorDashboard(
      req.user.schoolId,
      classId,
      termId,
    );
  }
  @Get('heatmap/:classId/:termId')
  async getSubjectHeatmap(
    @Param('classId') classId: string,
    @Param('termId') termId: string,
  ) {
    return this.analyticsService.getSubjectHeatmap(classId, termId);
  }

  @Get('alerts/:classId/:termId')
  async getPerformanceAlerts(
    @Param('classId') classId: string,
    @Param('termId') termId: string,
    @Query('previousTermId') previousTermId?: string,
  ) {
    return this.analyticsService.generatePerformanceAlerts(
      classId,
      termId,
      previousTermId,
    );
  }

  @Get('charts/pie')
  @UseGuards(JwtAuthGuard)
  async getPieChartData(
    @Req() req: Request,
    @Query('classId') classId?: string,
  ) {
    const user = (req as any).user;
    return this.analyticsService.getPieChartData(user.schoolId, classId);
  }

  @Get('charts/line')
  @UseGuards(JwtAuthGuard)
  async getLineChartData(
    @Req() req: Request,
    @Query('classId') classId: string,
    @Query('subjectId') subjectId?: string,
  ) {
    const user = (req as any).user;
    return this.analyticsService.getLineChartData(
      user.schoolId,
      classId,
      subjectId,
    );
  }

  @Get('charts/bar')
  @UseGuards(JwtAuthGuard)
  async getBarChartData(
    @Req() req: Request,
    @Query('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    const user = (req as any).user;
    return this.analyticsService.getBarChartData(
      user.schoolId,
      classId,
      termId,
    );
  }

  @Get('charts/histogram')
  @UseGuards(JwtAuthGuard)
  async getHistogramData(
    @Req() req: Request,
    @Query('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    const user = (req as any).user;
    return this.analyticsService.getHistogramData(
      user.schoolId,
      classId,
      termId,
    );
  }

  @Get('results-stats')
  @UseGuards(JwtAuthGuard)
  async getStudentResultsStats(
    @Req() req: Request,
    @Query('termId') termId: string,
  ) {
    const user = (req as any).user;
    return this.analyticsService.getStudentResultsStats(user.schoolId, termId);
  }

  @Get('subscription-stats')
  @UseGuards(JwtAuthGuard)
  async getSubscriptionStats(@Req() req: Request) {
    const user = (req as any).user;
    return this.analyticsService.getSubscriptionStats(user.schoolId);
  }

  @Get('dashboard-charts')
  @UseGuards(JwtAuthGuard)
  async getDashboardCharts(@Req() req: Request) {
    const user = (req as any).user;
    return this.analyticsService.getDashboardCharts(user.schoolId);
  }
}
