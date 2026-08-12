import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ClassAccessService } from './class-access.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AccessController {
  constructor(private readonly access: ClassAccessService) {}

  @Get('classes/available')
  schoolClasses(@Req() req: any, @Query('academicYearId') academicYearId?: string) {
    return this.access.schoolClasses(req.user, academicYearId);
  }

  @Get('classes/teaching')
  teachingClasses(@Req() req: any, @Query('academicYearId') academicYearId?: string) {
    return this.access.teachingClasses(req.user, academicYearId);
  }

  @Get('classes/teaching/:classId/subjects')
  teachingSubjects(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.access.teachingSubjects(req.user, classId, academicYearId);
  }

  @Get('me/access/classes')
  diagnose(@Req() req: any, @Query('academicYearId') academicYearId?: string) {
    return this.access.diagnose(req.user, academicYearId);
  }
}
