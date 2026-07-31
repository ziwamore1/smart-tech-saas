import { Controller, Post, Body, Get, Param, Req, UseGuards, HttpException, HttpStatus, Delete } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(private enrollmentService: EnrollmentService) {}

  @Post()
  async enroll(@Body() body: any, @Req() req: any) {
    try {
      console.log('Enrollment request:', body, 'User:', req.user?.id);
      return await this.enrollmentService.enrollStudent({
        ...body,
        schoolId: req.user.schoolId,
      });
    } catch (error) {
      console.error('Enrollment error:', error);
      throw new HttpException(error.message || 'Enrollment failed', HttpStatus.BAD_REQUEST);
    }
  }

  @Get('class/:classId')
  async getByClass(@Param('classId') classId: string) {
    return this.enrollmentService.getActiveEnrollmentsByClass(classId);
  }

  @Delete(':id')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  removeFromClass(@Param('id') id: string, @Req() req: any) {
    return this.enrollmentService.removeEnrollment(id, req.user.schoolId);
  }
}
