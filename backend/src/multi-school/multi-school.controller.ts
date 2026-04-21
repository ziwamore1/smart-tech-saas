import { Controller, Get, Post, Delete, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MultiSchoolService } from './multi-school.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('multi-school')
@UseGuards(JwtAuthGuard)
export class MultiSchoolController {
  constructor(private readonly multiSchoolService: MultiSchoolService) {}

  @Get('schools')
  async getUserSchools(@Request() req) {
    return this.multiSchoolService.getUserSchools(req.user.id);
  }

  @Get('schools/:schoolId')
  async getSchoolDetails(@Param('schoolId') schoolId: string) {
    return this.multiSchoolService.getSchoolDetails(schoolId);
  }

  @Get('schools/:schoolId/users')
  async getSchoolUsers(@Param('schoolId') schoolId: string) {
    return this.multiSchoolService.getSchoolUsers(schoolId);
  }

  @Get('schools/:schoolId/stats')
  async getSchoolStats(@Param('schoolId') schoolId: string) {
    return this.multiSchoolService.getSchoolStats(schoolId);
  }

  @Post('schools/:schoolId/access')
  async addUserToSchool(
    @Param('schoolId') schoolId: string,
    @Body() body: { userId: string; isPrimary?: boolean },
    @Request() req,
  ) {
    return this.multiSchoolService.addUserToSchool(body.userId, schoolId, body.isPrimary);
  }

  @Delete('schools/:schoolId/access')
  async removeUserFromSchool(@Param('schoolId') schoolId: string, @Request() req) {
    return this.multiSchoolService.removeUserFromSchool(req.user.id, schoolId);
  }

  @Put('schools/:schoolId/primary')
  async setPrimarySchool(@Param('schoolId') schoolId: string, @Request() req) {
    return this.multiSchoolService.setPrimarySchool(req.user.id, schoolId);
  }

  @Post('switch/:schoolId')
  async switchSchoolContext(@Param('schoolId') schoolId: string, @Request() req) {
    return this.multiSchoolService.switchSchoolContext(req.user.id, schoolId);
  }

  @Post('transfer-ownership')
  async transferOwnership(
    @Body() body: { schoolId: string; currentOwnerId: string; newOwnerId: string },
    @Request() req,
  ) {
    return this.multiSchoolService.transferOwnership(body.schoolId, body.currentOwnerId, body.newOwnerId);
  }
}
