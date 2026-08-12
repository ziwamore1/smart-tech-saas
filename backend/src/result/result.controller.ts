import {
  Controller,
  Post,
  Patch,
  Delete,
  UploadedFile,
  UseInterceptors,
  Body,
  Req,
  UseGuards,
  Get,
  Param,
  Res,
  Query,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResultService } from './result.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StudentSubjectService } from '../student-subject/student-subject.service';
import { OwnershipService } from '../common/services/ownership.service';

@Controller('results')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultController {
  private readonly logger = new Logger(ResultController.name);

  constructor(
    private readonly resultService: ResultService,
    private prisma: PrismaService,
    private studentSubjectService: StudentSubjectService,
    private ownership: OwnershipService,
  ) {}

  @Get()
  @Roles('Director', 'Deputy Director', 'Deputy Head', 'Deputy', 'HOD', 'Teacher', 'Class Teacher')
  findAll(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Query('subjectId') subjectId: string,
    @Req() req: any,
  ) {
    return this.resultService.findAll(
      req.user.schoolId,
      classId,
      termId,
      subjectId,
    );
  }

  @Get('computed')
  @Roles('Director', 'Deputy Director', 'Deputy Head', 'Deputy', 'HOD', 'Teacher', 'Class Teacher')
  async findComputed(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Req() req: any,
  ) {
    return this.prisma.computedResult.findMany({
      where: {
        schoolId: req.user.schoolId,
        classId,
        termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        student: { status: 'ACTIVE' },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { student: { firstName: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });
  }

  @Get('template/:termId')
  @Roles('Director', 'Deputy Director', 'Deputy Head', 'Deputy', 'HOD', 'Teacher', 'Class Teacher')
  async downloadTemplate(
    @Param('termId') termId: string,
    @Query('classId') classId: string,
    @Req() req,
    @Res() res: Response,
  ) {
    this.logger.log(`downloadTemplate called - termId: ${termId}, classId: ${classId}`);
    this.logger.log(`User: ${JSON.stringify(req.user)}`);

    try {
      const buffer = await this.resultService.generateResultTemplate(
        req.user.id,
        req.user.schoolId,
        termId,
        classId,
        req.user.roles || [],
      );

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="results-template.xlsx"',
      });

      res.send(buffer);
    } catch (error) {
      this.logger.error(`Error generating template: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':id')
  @Roles('Director', 'Deputy Director', 'Deputy Head', 'Deputy', 'HOD', 'Teacher', 'Class Teacher')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.resultService.findOne(id, req.user.schoolId);
  }

  @Get('student/:studentId')
  @Roles('Director', 'Teacher', 'Class Teacher', 'Parent', 'Student')
  async findByStudent(
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
    @Req() req: any,
  ) {
    const resolvedId = await this.ownership.resolveStudentId(req.user, studentId);
    await this.ownership.assertCanViewStudent(req.user, resolvedId);
    return this.resultService.findByStudent(resolvedId, termId, req.user.schoolId);
  }

  @Get(':studentId/:termId')
  @Roles('Director', 'Teacher', 'Class Teacher', 'Parent', 'Student')
  async findByStudentAlt(
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @Req() req: any,
  ) {
    const resolvedId = await this.ownership.resolveStudentId(req.user, studentId);
    await this.ownership.assertCanViewStudent(req.user, resolvedId);

    if (!termId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { schoolId: req.user.schoolId, isCurrent: true },
      });
      if (currentYear) {
        const currentTerm = await this.prisma.term.findFirst({
          where: { academicYearId: currentYear.id, isCurrent: true },
        });
        if (currentTerm) termId = currentTerm.id;
      }
    }

    let results = await this.prisma.computedResult.findMany({
      where: {
        studentId: resolvedId,
        termId,
        schoolId: req.user.schoolId,
        status: { in: ['PUBLISHED', 'LOCKED'] },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    });

    if (results.length > 0) {
      const classId = results[0].classId;
      const validSubjectIds = await this.studentSubjectService.getClassSubjectsForStudent(resolvedId, classId);
      results = results.filter(r => validSubjectIds.includes(r.subjectId));
    }

    return {
      studentId: resolvedId,
      termId,
      results: results.map(r => ({
        id: r.id,
        subjectId: r.subjectId,
        subject: { name: r.subject.name, code: r.subject.code },
        score: r.finalPercentage,
        totalRawScore: r.totalRawScore,
        totalWeightedScore: r.totalWeightedScore,
        finalPercentage: r.finalPercentage,
        grade: r.finalGrade,
        remark: r.finalRemark,
        points: r.points,
        gpa: r.gpa,
        classRank: r.classRank,
        subjectRank: r.subjectRank,
      })),
    };
  }

  @Post()
  @Roles('Director', 'Deputy Director', 'Deputy Head', 'Deputy', 'HOD', 'Teacher', 'Class Teacher')
  async create(
    @Body()
    body: {
      studentId: string;
      subjectId: string;
      termId: string;
      score: number;
    },
    @Req() req: any,
  ) {
    const userId = req.user.id;
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

    // Pass userId instead of teacherId - the service will find the correct teacher from teaching assignments
    return this.resultService.create(
      userId,
      req.user.schoolId,
      body.studentId,
      body.subjectId,
      body.termId,
      body.score,
      req.user.roles || [],
      req.user.isSuperAdmin === true,
    );
  }

  @Post('bulk')
  @Roles('Director', 'Deputy Director', 'Deputy Head', 'Deputy', 'HOD', 'Teacher', 'Class Teacher')
  async createBulk(
    @Body()
    body: {
      results: Array<{
        studentId: string;
        subjectId: string;
        termId: string;
        score: number;
      }>;
    },
    @Req() req: any,
  ) {
    const userId = req.user.id;
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

    return this.resultService.createBulk(
      userId,
      req.user.schoolId,
      body.results,
      req.user.roles || [],
      req.user.isSuperAdmin === true,
    );
  }

  @Post('upload/:termId')
  @Roles('Director', 'Teacher', 'Class Teacher')
  @UseInterceptors(FileInterceptor('file'))
  async uploadResults(
    @UploadedFile() file: Express.Multer.File,
    @Param('termId') termId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
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

    // Pass userId instead of teacherId - the service will find the correct teacher from teaching assignments
    return this.resultService.uploadExcelResults(
      userId,
      req.user.schoolId,
      termId,
      file,
      req.user.roles || [],
    );
  }

  @Patch(':id')
  @Roles('Director', 'Teacher', 'Class Teacher')
  async update(
    @Param('id') id: string,
    @Body() body: { score: number },
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.resultService.update(
      id,
      userId,
      req.user.schoolId,
      body.score,
      req.user.roles || [],
      req.user.isSuperAdmin === true,
    );
  }

  @Delete(':id')
  @Roles('Director')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.resultService.delete(id, req.user.schoolId);
  }

  @Post('recalculate-grades')
  @Roles('Director', 'Teacher', 'Class Teacher')
  async recalculateGrades(
    @Body() body: { classId: string; termId: string },
    @Req() req: any,
  ) {
    const userId = req.user.id;
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

    return this.resultService.recalculateGrades(
      teacherId,
      req.user.schoolId,
      body.classId,
      body.termId,
    );
  }

  @Post('recalculate-points')
  @Roles('Director', 'Teacher', 'Class Teacher')
  async recalculatePoints(
    @Body() body: { classId: string; termId: string },
    @Req() req: any,
  ) {
    const userId = req.user.id;
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

    return this.resultService.recalculatePoints(
      teacherId,
      req.user.schoolId,
      body.classId,
      body.termId,
    );
  }
}
