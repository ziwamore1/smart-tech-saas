import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StudentAwardsService } from './student-awards.service';

@Controller('student-awards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentAwardsController {
  constructor(private readonly service: StudentAwardsService) {}

  @Get('catalog')
  @Roles('Director', 'Class Teacher', 'Teacher')
  catalog(@Req() req: any) { return this.service.getCatalog(req.user.schoolId); }

  @Post('leadership-roles')
  @Roles('Director')
  addRole(@Req() req: any, @Body() body: any) { return this.service.addRole(req.user.schoolId, body); }

  @Post('leadership-appointments')
  @Roles('Director', 'Class Teacher')
  appoint(@Req() req: any, @Body() body: any) { return this.service.appoint(req.user.schoolId, req.user.id, body); }

  @Post('leadership-appointments/:id/duties')
  @Roles('Director', 'Class Teacher')
  addDuty(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.addDuty(req.user.schoolId, id, body); }

  @Post('leadership-duties/:id/verify')
  @Roles('Director', 'Class Teacher')
  completeDuty(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.completeDuty(req.user.schoolId, id, req.user.id, body); }

  @Post('sports-recommendations')
  @Roles('Director', 'Class Teacher', 'Teacher')
  recommendSport(@Req() req: any, @Body() body: any) { return this.service.recommendSport(req.user.schoolId, req.user.id, body); }

  @Get('students/:studentId/eligibility/:category')
  @Roles('Director', 'Class Teacher', 'Teacher')
  eligibility(@Req() req: any, @Param('studentId') studentId: string, @Param('category') category: string) { return this.service.getEligibility(req.user.schoolId, studentId, category); }
}
