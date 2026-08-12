import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
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

  @Get('results/live')
  @UseGuards(RolesGuard)
  @Roles('Director', 'Deputy Director', 'Head Teacher')
  liveResults(@Req() req: any, @Query('termId') termId?: string) {
    return this.access.liveResults(req.user, termId);
  }

  @Get('results/completion')
  @UseGuards(RolesGuard)
  @Roles('Director', 'Deputy Director', 'Head Teacher')
  completion(@Req() req: any, @Query('termId') termId?: string) {
    return this.access.resultsCompletion(req.user, termId);
  }

  @Get('users/:userId/permissions')
  @UseGuards(RolesGuard)
  @Roles('Director', 'Deputy Director', 'Head Teacher')
  getUserPermissions(@Req() req: any, @Param('userId') userId: string) {
    return this.access.getUserAccess(req.user, userId);
  }

  @Patch('users/:userId/permissions')
  @UseGuards(RolesGuard)
  @Roles('Director', 'Deputy Director', 'Head Teacher')
  saveUserPermissions(@Req() req: any, @Param('userId') userId: string, @Body() body: { permissions: string[] }) {
    return this.access.saveUserPermissions(req.user, userId, body.permissions || []);
  }
}
