import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ClassTeacherAssignmentService } from './class-teacher-assignment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('class-teacher-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassTeacherAssignmentController {
  constructor(private readonly assignmentService: ClassTeacherAssignmentService) {}

  @Post()
  @Roles('Director', 'SuperAdmin', 'Head Teacher')
  async assign(@Req() req: any, @Body() body: {
    teacherId: string;
    classId: string;
    academicYearId: string;
    isPrimary?: boolean;
  }) {
    return this.assignmentService.assign({
      ...body,
      schoolId: req.user.schoolId,
      assignedBy: req.user.sub,
    });
  }

  @Delete(':id')
  @Roles('Director', 'SuperAdmin', 'Head Teacher')
  async remove(@Param('id') id: string) {
    return this.assignmentService.remove(id);
  }

  @Get('class/:classId')
  async findByClass(@Param('classId') classId: string, @Query('academicYearId') academicYearId?: string) {
    return this.assignmentService.findByClass(classId, academicYearId);
  }

  @Get('teacher/:teacherId')
  async findByTeacher(@Param('teacherId') teacherId: string, @Req() req: any) {
    return this.assignmentService.findByTeacher(teacherId, req.user.schoolId);
  }

  @Get('school')
  @Roles('Director', 'SuperAdmin', 'Head Teacher')
  async findBySchool(@Req() req: any, @Query('academicYearId') academicYearId?: string) {
    return this.assignmentService.findBySchool(req.user.schoolId, academicYearId);
  }
}
