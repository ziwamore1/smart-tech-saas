import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Query,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ClassAccessService } from '../common/access/class-access.service';

@Controller('assessment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentController {
  constructor(
    private service: AssessmentService,
    private prisma: PrismaService,
    private classAccess: ClassAccessService,
  ) {}

  @Get('types')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  getTypes(
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
    @Req() req: any,
  ) {
    return this.service.getAssessmentTypes(
      req.user.schoolId,
      subjectId,
      termId,
    );
  }

  @Get('weights')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  getWeights(
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
    @Req() req: any,
  ) {
    return this.service.getSubjectWeights(
      req.user.schoolId,
      subjectId,
      termId,
    );
  }

  @Get('student')
  getStudentAssessments(
    @Query('studentId') studentId: string,
    @Query('termId') termId: string,
  ) {
    return this.service.getStudentAssessments(studentId, termId);
  }

  @Get('class-dashboard')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  getDashboard(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
  ) {
    return this.service.getClassAssessmentDashboard(classId, subjectId, termId);
  }

  @Get('teacher-heatmap')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  getTeacherHeatmap(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
  ) {
    return this.service.getTeacherPerformanceHeatmap(classId, subjectId, termId);
  }

  @Post('create-type')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  createType(@Body() body: any, @Req() req: any) {
    return this.service.createAssessmentType(
      req.user.schoolId,
      body.subjectId,
      body.termId,
      body.name,
      body.maxScore,
      body.weight,
    );
  }

  @Post('bulk-create')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  createBulkTypes(@Body() body: any, @Req() req: any) {
    return this.service.createBulkAssessmentTypes(
      req.user.schoolId,
      body.subjectId,
      body.termId,
      body.types,
    );
  }

  @Patch('type/:id')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  updateType(
    @Param('id') id: string,
    @Body() body: { name?: string; maxScore?: number; weight?: number },
    @Req() req: any,
  ) {
    return this.service.updateAssessmentType(id, req.user.schoolId, body);
  }

  @Delete('type/:id')
  @Roles('Director')
  deleteType(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteAssessmentType(id, req.user.schoolId);
  }

  @Post('enter-score')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  async enterScore(@Body() body: any, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    await this.classAccess.assertCanEnterAssessmentScore(
      { id: userId, schoolId: req.user.schoolId, roles: req.user.roles || [], isSuperAdmin: req.user.isSuperAdmin },
      body.studentId,
      body.assessmentTypeId,
    );
    let teacherId = userId;

    let teacher = await this.prisma.teacher.findFirst({
      where: { userId },
    });

    if (!teacher && req.user.roles?.includes('DIRECTOR')) {
      teacher = await this.prisma.teacher.create({
        data: {
          userId,
          schoolId: req.user.schoolId,
        },
      });
    }

    if (teacher) {
      teacherId = teacher.id;
    }

    return this.service.enterScore(
      body.studentId,
      body.assessmentTypeId,
      teacherId,
      req.user.schoolId,
      body.score,
    );
  }

  @Post('bulk-enter-scores')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  async enterBulkScores(@Body() body: any, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    for (const item of body.scores || []) {
      await this.classAccess.assertCanEnterAssessmentScore(
        { id: userId, schoolId: req.user.schoolId, roles: req.user.roles || [], isSuperAdmin: req.user.isSuperAdmin },
        item.studentId,
        item.assessmentTypeId,
      );
    }
    let teacherId = userId;

    let teacher = await this.prisma.teacher.findFirst({
      where: { userId },
    });

    if (!teacher && req.user.roles?.includes('DIRECTOR')) {
      teacher = await this.prisma.teacher.create({
        data: {
          userId,
          schoolId: req.user.schoolId,
        },
      });
    }

    if (teacher) {
      teacherId = teacher.id;
    }

    return this.service.enterBulkScores(
      body.scores,
      teacherId,
      req.user.schoolId,
    );
  }

  @Patch('score/:id')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  async updateScore(
    @Param('id') id: string,
    @Body() body: { score: number },
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user.sub;
    const existing = await this.prisma.assessmentScore.findUnique({
      where: { id },
      select: { studentId: true, assessmentTypeId: true },
    });
    if (!existing) return this.service.updateScore(id, userId, req.user.schoolId, body.score);
    await this.classAccess.assertCanEnterAssessmentScore(
      { id: userId, schoolId: req.user.schoolId, roles: req.user.roles || [], isSuperAdmin: req.user.isSuperAdmin },
      existing.studentId,
      existing.assessmentTypeId,
    );
    let teacherId = userId;

    let teacher = await this.prisma.teacher.findFirst({
      where: { userId },
    });

    if (!teacher && req.user.roles?.includes('DIRECTOR')) {
      teacher = await this.prisma.teacher.create({
        data: {
          userId,
          schoolId: req.user.schoolId,
        },
      });
    }

    if (teacher) {
      teacherId = teacher.id;
    }

    return this.service.updateScore(id, teacherId, req.user.schoolId, body.score);
  }

  @Get('compute')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  async computeResults(
    @Query('studentId') studentId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user.sub;
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, schoolId: req.user.schoolId, status: 'ACTIVE' },
      select: { classId: true, academicYearId: true },
    });
    if (!enrollment) throw new ForbiddenException('Student is not enrolled in this school');
    await this.classAccess.assertCanEnterResults(
      { id: userId, schoolId: req.user.schoolId, roles: req.user.roles || [], isSuperAdmin: req.user.isSuperAdmin },
      enrollment.classId,
      subjectId,
      enrollment.academicYearId,
    );
    let teacherId = userId;

    let teacher = await this.prisma.teacher.findFirst({
      where: { userId },
    });

    if (!teacher && req.user.roles?.includes('DIRECTOR')) {
      teacher = await this.prisma.teacher.create({
        data: {
          userId,
          schoolId: req.user.schoolId,
        },
      });
    }

    if (teacher) {
      teacherId = teacher.id;
    }

    return this.service.aggregateStudentSubjectScore(
      studentId,
      subjectId,
      termId,
      req.user.schoolId,
      teacherId,
    );
  }

  @Post('compute-all')
  @Roles('Teacher', 'Class Teacher', 'HOD', 'Deputy Director', 'Deputy Head', 'Deputy', 'Director')
  async computeAllResults(@Body() body: { classId: string; subjectId: string; termId: string }, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    const term = await this.prisma.term.findUnique({ where: { id: body.termId }, select: { academicYearId: true, academicYear: { select: { schoolId: true } } } });
    if (!term || term.academicYear.schoolId !== req.user.schoolId) throw new ForbiddenException('Invalid term');
    await this.classAccess.assertCanEnterResults(
      { id: userId, schoolId: req.user.schoolId, roles: req.user.roles || [], isSuperAdmin: req.user.isSuperAdmin },
      body.classId,
      body.subjectId,
      term.academicYearId,
    );
    let teacherId = userId;

    let teacher = await this.prisma.teacher.findFirst({
      where: { userId },
    });

    if (!teacher && req.user.roles?.includes('DIRECTOR')) {
      teacher = await this.prisma.teacher.create({
        data: {
          userId,
          schoolId: req.user.schoolId,
        },
      });
    }

    if (teacher) {
      teacherId = teacher.id;
    }

    return this.service.computeAllClassResults(
      body.classId,
      body.subjectId,
      body.termId,
      req.user.schoolId,
      teacherId,
    );
  }
}
