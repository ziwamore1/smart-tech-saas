import { Controller, Get, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { TeacherAnalyticsService } from './teacher-analytics.service';
import { TeacherAnalyticsAiService } from './teacher-analytics-ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const TEACHER_ROLES = ['Teacher', 'Class Teacher', 'Director', 'HOD', 'Deputy'];

@Controller('teacher-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherAnalyticsController {
  constructor(
    private service: TeacherAnalyticsService,
    private ai: TeacherAnalyticsAiService,
  ) {}

  private async resolve(user: any, termId?: string) {
    const context = await this.service.resolveContext(user);
    const cycle = await this.service.resolveAcademicCycle(context.schoolId, termId);
    return { context, cycle };
  }

  @Get('me')
  @Roles(...TEACHER_ROLES)
  async getOverview(@Request() req, @Query('termId') termId?: string) {
    const overview = await this.service.getOverview(req.user, termId);
    const insights = overview.summary ? await this.ai.generateInsights(overview) : null;
    return { ...overview, insights };
  }

  @Get('me/summary')
  @Roles(...TEACHER_ROLES)
  async getSummary(@Request() req, @Query('termId') termId?: string) {
    const { context, cycle } = await this.resolve(req.user, termId);
    if (!cycle.term) return { summary: null };
    const assignments = await this.service.getAssignmentsAnalytics(
      context.userId,
      context.schoolId,
      cycle.term,
      cycle.term.academicYear?.name || '',
    );
    return {
      summary: await this.service.buildTeacherSummary(
        context,
        assignments,
        { id: cycle.term.id, name: cycle.term.name },
        cycle.term.academicYear?.name || null,
      ),
    };
  }

  @Get('me/assignments')
  @Roles(...TEACHER_ROLES)
  async getAssignments(@Request() req, @Query('termId') termId?: string) {
    const { context, cycle } = await this.resolve(req.user, termId);
    if (!cycle.term) return { assignments: [], term: null };
    const assignments = await this.service.getAssignmentsAnalytics(
      context.userId,
      context.schoolId,
      cycle.term,
      cycle.term.academicYear?.name || '',
    );
    return { assignments, term: { id: cycle.term.id, name: cycle.term.name } };
  }

  @Get('me/classes')
  @Roles(...TEACHER_ROLES)
  async getClasses(@Request() req, @Query('termId') termId?: string) {
    const { context, cycle } = await this.resolve(req.user, termId);
    if (!cycle.term) return [];
    return this.service.getClassAnalytics(
      context,
      cycle.term,
      cycle.term.academicYear?.name || '',
    );
  }

  @Get('me/subjects')
  @Roles(...TEACHER_ROLES)
  async getSubjects(@Request() req, @Query('termId') termId?: string) {
    const { context, cycle } = await this.resolve(req.user, termId);
    if (!cycle.term) return [];
    return this.service.getSubjectAnalytics(
      context,
      cycle.term,
      cycle.term.academicYear?.name || '',
    );
  }

  @Get('me/competencies')
  @Roles(...TEACHER_ROLES)
  async getCompetencies(@Request() req, @Query('termId') termId?: string) {
    const { context, cycle } = await this.resolve(req.user, termId);
    if (!cycle.term) return { available: false, dataRequired: 'No active term.' };
    return this.service.getCompetencyAnalysis(
      context,
      { id: cycle.term.id },
      cycle.term.academicYear?.name || '',
    );
  }

  @Get('me/students-at-risk')
  @Roles(...TEACHER_ROLES)
  async getStudentsAtRisk(@Request() req, @Query('termId') termId?: string) {
    const { context, cycle } = await this.resolve(req.user, termId);
    if (!cycle.term) return [];
    return this.service.getStudentsAtRisk(
      context,
      cycle.term,
      cycle.term.academicYear?.name || '',
    );
  }

  @Get('me/trends')
  @Roles(...TEACHER_ROLES)
  async getTrends(@Request() req, @Query('termId') termId?: string) {
    const { context, cycle } = await this.resolve(req.user, termId);
    if (!cycle.term) return [];
    return this.service.getHistoricalPoints(context, { id: cycle.term.id }, context.schoolId);
  }

  @Get('me/attendance-correlation')
  @Roles(...TEACHER_ROLES)
  async getAttendanceCorrelation(@Request() req, @Query('termId') termId?: string) {
    const { context, cycle } = await this.resolve(req.user, termId);
    if (!cycle.term) return { available: false, dataRequired: 'No active term.' };
    return this.service.getAttendanceCorrelation(context, cycle.term);
  }

  @Get('me/teaching-load')
  @Roles(...TEACHER_ROLES)
  async getTeachingLoad(@Request() req, @Query('termId') termId?: string) {
    const { context, cycle } = await this.resolve(req.user, termId);
    if (!cycle.term) return null;
    return this.service.getTeachingLoad(context, cycle.term.id, cycle.term.academicYearId);
  }

  @Get('me/insights')
  @Roles(...TEACHER_ROLES)
  async getInsights(@Request() req, @Query('termId') termId?: string) {
    const overview = await this.service.getOverview(req.user, termId);
    if (!overview.summary) {
      throw new NotFoundException('No active term — insights cannot be generated yet.');
    }
    return this.ai.generateInsights(overview);
  }

  @Get('me/report-data')
  @Roles(...TEACHER_ROLES)
  async getReportData(
    @Request() req,
    @Query('termId') termId?: string,
    @Query('examType') examType?: string,
  ) {
    return this.service.getReportData(req.user, { termId, examType });
  }
}