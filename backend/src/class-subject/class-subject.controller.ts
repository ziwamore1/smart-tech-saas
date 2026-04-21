import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ClassSubjectService } from './class-subject.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('class-subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassSubjectController {
  constructor(private readonly service: ClassSubjectService) {}

  @Post()
  @Roles('Director')
  async addSubject(
    @Body() body: { classId: string; subjectId: string },
    @Req() req: any,
  ) {
    try {
      console.log('Add subject to class:', body, 'User:', req.user?.id);
      return await this.service.addSubjectToClass(body.classId, body.subjectId, req.user.schoolId);
    } catch (error) {
      console.error('Add subject error:', error);
      throw new HttpException(error.message || 'Failed to add subject', HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':classId/:subjectId')
  @Roles('Director')
  async removeSubject(
    @Param('classId') classId: string,
    @Param('subjectId') subjectId: string,
    @Req() req: any,
  ) {
    try {
      return await this.service.removeSubjectFromClass(classId, subjectId, req.user.schoolId);
    } catch (error) {
      console.error('Remove subject error:', error);
      throw new HttpException(error.message || 'Failed to remove subject', HttpStatus.BAD_REQUEST);
    }
  }

  @Get('class/:classId')
  @Roles('Director', 'Teacher')
  async getSubjectsByClass(
    @Param('classId') classId: string,
    @Req() req: any,
  ) {
    try {
      return await this.service.getSubjectsByClass(classId, req.user.schoolId);
    } catch (error) {
      console.error('Get subjects by class error:', error);
      throw new HttpException(error.message || 'Failed to get subjects', HttpStatus.BAD_REQUEST);
    }
  }

  @Get('subject/:subjectId')
  @Roles('Director')
  async getClassesBySubject(
    @Param('subjectId') subjectId: string,
    @Req() req: any,
  ) {
    return this.service.getClassesBySubject(subjectId, req.user.schoolId);
  }

  @Get()
  @Roles('Director')
  async getAll(@Req() req: any) {
    return this.service.getAllClassSubjects(req.user.schoolId);
  }
}
