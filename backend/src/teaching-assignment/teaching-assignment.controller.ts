import { Controller, Post, Get, Delete, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { TeachingAssignmentService } from './teaching-assignment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('teaching-assignment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachingAssignmentController {
  constructor(private readonly service: TeachingAssignmentService) {}

  @Post()
  @Roles('Director')
  assign(
    @Body()
    body: {
      teacherId: string;
      subjectId: string;
      classId: string;
      academicYearId: string;
    },
    @Req() req: any,
  ) {
    return this.service.assign(
      body.teacherId,
      body.subjectId,
      body.classId,
      body.academicYearId,
      req.user.schoolId,
    );
  }

  @Get()
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  findAll(@Req() req: any, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.service.findAll(req.user.schoolId, page, limit);
  }

  @Get('teacher/:teacherId')
  findByTeacher(@Param('teacherId') teacherId: string, @Req() req: any) {
    return this.service.findByTeacher(teacherId, req.user.schoolId);
  }

  @Delete(':id')
  @Roles('Director')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.service.delete(id, req.user.schoolId);
  }

  @Patch(':id')
  @Roles('Director')
  update(
    @Param('id') id: string,
    @Body() body: { teacherId: string; subjectId: string; classId: string; academicYearId: string },
    @Req() req: any,
  ) {
    return this.service.update(id, body, req.user.schoolId);
  }
}
