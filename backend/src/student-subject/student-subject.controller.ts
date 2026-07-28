import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StudentSubjectService } from './student-subject.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('student-subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentSubjectController {
  constructor(private readonly service: StudentSubjectService) {}

  @Get('student/:studentId')
  getStudentSubjects(@Param('studentId') studentId: string) {
    return this.service.getStudentSubjects(studentId);
  }

  @Get('class/:classId')
  getClassAssignments(@Param('classId') classId: string) {
    return this.service.getClassSubjectAssignments(classId);
  }

  @Get('class/:classId/missing')
  getStudentsWithoutSubjects(@Param('classId') classId: string) {
    return this.service.getStudentsWithoutSubjects(classId);
  }

  @Post('assign')
  @Roles('Teacher', 'Director')
  assign(
    @Body() body: { studentId: string; subjectIds: string[]; classId: string; academicYearId?: string },
    @Req() req: any,
  ) {
    return this.service.assignSubjects(
      body.studentId,
      body.subjectIds,
      body.classId,
      req.user.schoolId,
      body.academicYearId,
    );
  }

  @Post('bulk-assign')
  @Roles('Teacher', 'Director')
  bulkAssign(
    @Body() body: { classId: string; assignments: Array<{ studentId: string; subjectIds: string[] }>; academicYearId?: string },
    @Req() req: any,
  ) {
    return this.service.bulkAssign(
      body.classId,
      body.assignments,
      req.user.schoolId,
      body.academicYearId,
    );
  }

  @Delete()
  @Roles('Teacher', 'Director')
  unassign(
    @Query('studentId') studentId: string,
    @Query('subjectId') subjectId: string,
    @Query('classId') classId: string,
  ) {
    return this.service.unassignSubject(studentId, subjectId, classId);
  }
}
