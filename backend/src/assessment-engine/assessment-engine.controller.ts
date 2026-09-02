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

@Controller('assessment-engine')
@UseGuards(JwtAuthGuard, RolesGuard)
// Keep in sync with result.controller.ts — HODs enter/verify component
// scores (Mid-Term / End-of-Term) and Deputy Directors review them, so both
// need the same access Teachers have here. 'Deputy Head' covers accounts
// provisioned with either 'Deputy Head' or 'Deputy' (the guard normalizes
// both to DEPUTY).
@Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
export class AssessmentEngineController {
  constructor(
    private assessmentEngine: AssessmentEngineService,
    private classAccess: ClassAccessService,
    private prisma: PrismaService,
  ) {}

  private async assertCanEnterScores(req: any, entries: Array<{ classId: string; subjectId: string; termId: string }>) {
    const pairs = new Set(entries.filter(e => e.classId && e.subjectId && e.termId).map(e => `${e.classId}::${e.subjectId}::${e.termId}`));
    for (const pair of pairs) {
      const [classId, subjectId, termId] = pair.split('::');
      const term = await this.prisma.term.findUnique({ where: { id: termId }, select: { academicYearId: true } });
      if (!term) throw new ForbiddenException('Invalid term for score entry');
      await this.classAccess.assertCanEnterResults(
        { id: req.user.id, schoolId: req.user.schoolId, roles: req.user.roles || [], isSuperAdmin: req.user.isSuperAdmin },
        classId,
        subjectId,
        term.academicYearId,
      );
    }
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
