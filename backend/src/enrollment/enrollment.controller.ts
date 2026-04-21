import { Controller, Post, Body, Get, Param, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
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
}
