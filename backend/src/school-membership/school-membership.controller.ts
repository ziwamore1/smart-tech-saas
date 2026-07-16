import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { SchoolMembershipService } from './school-membership.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('school-membership')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolMembershipController {
  constructor(private readonly membershipService: SchoolMembershipService) {}

  @Get('users/search')
  @Roles('Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher')
  async searchUsers(@Req() req: any, @Query('q') q: string) {
    const schoolId = req.user.schoolId;
    return this.membershipService.searchAllUsers(schoolId, q || '');
  }

  @Get('members')
  @Roles('Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher')
  async getMembers(@Req() req: any) {
    const schoolId = req.user.schoolId;
    return this.membershipService.getMembers(schoolId);
  }

  @Get('teaching-staff')
  @Roles('Director', 'SuperAdmin', 'Teacher', 'Head Teacher')
  async getTeachingStaff(@Req() req: any) {
    const schoolId = req.user.schoolId;
    return this.membershipService.getTeachingStaff(schoolId);
  }

  @Get('members/role/:role')
  @Roles('Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher')
  async getMembersByRole(@Req() req: any, @Param('role') role: string) {
    const schoolId = req.user.schoolId;
    return this.membershipService.getMembersByRole(schoolId, role);
  }

  @Post('members')
  @Roles('Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher')
  async addMember(@Req() req: any, @Body() body: { userId: string; isPrimary?: boolean }) {
    const schoolId = req.user.schoolId;
    return this.membershipService.addMember(schoolId, body.userId, body.isPrimary);
  }

  @Delete('members/:userId')
  @Roles('Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher')
  async removeMember(@Req() req: any, @Param('userId') userId: string) {
    const schoolId = req.user.schoolId;
    return this.membershipService.removeMember(schoolId, userId);
  }

  @Post('roles')
  @Roles('Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher')
  async assignRole(@Req() req: any, @Body() body: { userId: string; role: string }) {
    const schoolId = req.user.schoolId;
    return this.membershipService.assignSchoolRole(schoolId, body.userId, body.role, req.user.sub);
  }

  @Delete('roles')
  @Roles('Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher')
  async removeRole(@Req() req: any, @Body() body: { userId: string; role: string }) {
    const schoolId = req.user.schoolId;
    return this.membershipService.removeSchoolRole(schoolId, body.userId, body.role);
  }

  @Get('user/:userId/roles')
  async getUserRoles(@Param('userId') userId: string) {
    return this.membershipService.getUserSchoolRoles(userId);
  }
}
