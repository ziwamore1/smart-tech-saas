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
} from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('assessment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentController {
  constructor(
    private service: AssessmentService,
    private prisma: PrismaService,
  ) {}

  @Get('types')
  @Roles('TEACHER', 'DIRECTOR')
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
  @Roles('TEACHER', 'DIRECTOR')
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
  @Roles('TEACHER', 'DIRECTOR')
  getDashboard(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
  ) {
    return this.service.getClassAssessmentDashboard(classId, subjectId, termId);
  }

  @Get('teacher-heatmap')
  @Roles('TEACHER', 'DIRECTOR')
  getTeacherHeatmap(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
  ) {
    return this.service.getTeacherPerformanceHeatmap(classId, subjectId, termId);
  }

  @Post('create-type')
  @Roles('TEACHER', 'DIRECTOR')
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
  @Roles('TEACHER', 'DIRECTOR')
  createBulkTypes(@Body() body: any, @Req() req: any) {
    return this.service.createBulkAssessmentTypes(
      req.user.schoolId,
      body.subjectId,
      body.termId,
      body.types,
    );
  }

  @Patch('type/:id')
  @Roles('TEACHER', 'DIRECTOR')
  updateType(
    @Param('id') id: string,
    @Body() body: { name?: string; maxScore?: number; weight?: number },
    @Req() req: any,
  ) {
    return this.service.updateAssessmentType(id, req.user.schoolId, body);
  }

  @Delete('type/:id')
  @Roles('DIRECTOR')
  deleteType(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteAssessmentType(id, req.user.schoolId);
  }

  @Post('enter-score')
  @Roles('TEACHER', 'DIRECTOR')
  async enterScore(@Body() body: any, @Req() req: any) {
    const userId = req.user.sub;
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
  @Roles('TEACHER', 'DIRECTOR')
  async enterBulkScores(@Body() body: any, @Req() req: any) {
    const userId = req.user.sub;
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
  @Roles('TEACHER', 'DIRECTOR')
  async updateScore(
    @Param('id') id: string,
    @Body() body: { score: number },
    @Req() req: any,
  ) {
    const userId = req.user.sub;
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
  @Roles('TEACHER', 'DIRECTOR')
  async computeResults(
    @Query('studentId') studentId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
    @Req() req: any,
  ) {
    const userId = req.user.sub;
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
  @Roles('TEACHER', 'DIRECTOR')
  async computeAllResults(@Body() body: { classId: string; subjectId: string; termId: string }, @Req() req: any) {
    const userId = req.user.sub;
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
