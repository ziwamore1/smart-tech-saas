import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AssessmentEngineService } from './assessment-engine.service';
import { ClassAccessService } from '../common/access/class-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RESULTS_ENTRY_ROLES } from '../common/access/permission-registry';

@Controller('assessment-engine')
@UseGuards(JwtAuthGuard, RolesGuard)
// Keep in sync with result.controller.ts — every teaching role that may save
// results may also enter/verify component scores. Role aliases are normalized
// by RolesGuard, so spaced and compact role labels behave identically.
@Roles(...RESULTS_ENTRY_ROLES)
export class AssessmentEngineController {
  constructor(
    private assessmentEngine: AssessmentEngineService,
    private classAccess: ClassAccessService,
    private prisma: PrismaService,
  ) {}

  private async assertCanEnterScores(req: any, entries: Array<{ classId: string; subjectId: string; termId: string }>) {
    const pairs = new Set(
      entries
        .filter(e => e.classId && e.subjectId && e.termId)
        .map(e => `${e.classId}::${e.subjectId}::${e.termId}`),
    );
    if (!pairs.size) return;

    const termIds = [...new Set([...pairs].map(pair => pair.split('::')[2]))];
    const terms = await this.prisma.term.findMany({
      where: { id: { in: termIds }, academicYear: { schoolId: req.user.schoolId } },
      select: { id: true, academicYearId: true },
    });
    const termMap = new Map(terms.map(term => [term.id, term]));

    const scopes = [...pairs].map((pair) => {
      const [classId, subjectId, termId] = pair.split('::');
      const term = termMap.get(termId);
      if (!term) throw new ForbiddenException('Invalid term for score entry');
      return { classId, subjectId, academicYearId: term.academicYearId };
    });

    await this.classAccess.assertCanEnterResultsBatch(
      { id: req.user.id, schoolId: req.user.schoolId, roles: req.user.roles || [], isSuperAdmin: req.user.isSuperAdmin },
      scopes,
    );
  }

  @Post('definitions')
  createDefinition(@Request() req, @Body() body: any) {
    return this.assessmentEngine.createAssessmentDefinition(req.user.schoolId, body);
  }

  @Get('definitions')
  getDefinitions(@Request() req, @Query('activeOnly') activeOnly?: string) {
    return this.assessmentEngine.getAssessmentDefinitions(
      req.user.schoolId,
      activeOnly !== 'false',
    );
  }

  @Put('definitions/:id')
  updateDefinition(@Param('id') id: string, @Body() body: any) {
    return this.assessmentEngine.updateAssessmentDefinition(id, body);
  }

  @Delete('definitions/:id')
  deleteDefinition(@Param('id') id: string) {
    return this.assessmentEngine.deleteAssessmentDefinition(id);
  }

  @Post('configure')
  configureTermAssessment(@Request() req, @Body() body: any) {
    return this.assessmentEngine.configureTermAssessment(req.user.schoolId, body);
  }

  @Get('configurations')
  getConfigurations(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
  ) {
    return this.assessmentEngine.getTermAssessmentConfigurations(classId, subjectId, termId);
  }

  @Put('configurations')
  updateConfiguration(@Request() req, @Body() body: any) {
    return this.assessmentEngine.updateTermAssessmentConfiguration(
      req.user.schoolId,
      body.classId,
      body.subjectId,
      body.termId,
      body.assessmentDefId,
      {
        weightPercentage: body.weightPercentage,
        maxScore: body.maxScore,
        mandatory: body.mandatory,
      },
    );
  }

  @Post('scores/bulk')
  async bulkEnterScores(@Request() req, @Body() body: any) {
    const entries = Array.isArray(body?.scores) && body.scores.length
      ? body.scores.map((s: any) => ({ classId: s?.classId || body.classId, subjectId: s?.subjectId || body.subjectId, termId: s?.termId || body.termId }))
      : [{ classId: body.classId, subjectId: body.subjectId, termId: body.termId }];
    await this.assertCanEnterScores(req, entries);
    return this.assessmentEngine.bulkEnterScores(req.user.schoolId, {
      ...body,
      enteredBy: req.user.id,
    });
  }

  @Post('scores')
  async enterSingleScore(@Request() req, @Body() body: any) {
    await this.assertCanEnterScores(req, [{ classId: body.classId, subjectId: body.subjectId, termId: body.termId }]);
    return this.assessmentEngine.enterSingleScore(req.user.schoolId, {
      ...body,
      enteredBy: req.user.id,
    });
  }

  @Get('results/student/:studentId')
  getStudentResults(
    @Param('studentId') studentId: string,
    @Query('termId') termId?: string,
  ) {
    return this.assessmentEngine.getStudentResults(studentId, termId);
  }

  @Get('results/class')
  getClassResults(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
    @Query('assessmentDefId') assessmentDefId?: string,
  ) {
    return this.assessmentEngine.getClassResults(classId, subjectId, termId, assessmentDefId);
  }

  @Get('batches/:batchId')
  getBatchResults(@Param('batchId') batchId: string) {
    return this.assessmentEngine.getBatchResults(batchId);
  }

  @Post('batches/:batchId/verify')
  verifyBatch(@Param('batchId') batchId: string, @Request() req) {
    return this.assessmentEngine.verifyBatch(batchId, req.user.id);
  }

  @Post('batches/:batchId/lock')
  lockBatch(@Param('batchId') batchId: string) {
    return this.assessmentEngine.lockBatch(batchId);
  }

  @Get('teacher/pending')
  getTeacherPendingAssessments(@Request() req, @Query('termId') termId?: string) {
    return this.assessmentEngine.getTeacherPendingAssessments(req.user.id, req.user.schoolId, termId);
  }

  @Get('teacher/overview')
  getTeacherAssessmentOverview(@Request() req, @Query('teacherIds') teacherIds?: string, @Query('termId') termId?: string) {
    const ids = teacherIds?.split(',').map((id) => id.trim()).filter(Boolean) || [req.user.id];
    return this.assessmentEngine.getTeacherPendingAssessments(req.user.id, req.user.schoolId, termId, ids, true);
  }

  @Get('completion-stats')
  getCompletionStats(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
  ) {
    return this.assessmentEngine.getAssessmentCompletionStats(classId, subjectId, termId);
  }
}
