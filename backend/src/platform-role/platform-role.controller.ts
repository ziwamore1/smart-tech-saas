import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PlatformRoleService } from './platform-role.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('platform-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlatformRoleController {
  constructor(private readonly platformRoleService: PlatformRoleService) {}

  @Get()
  async getAllRoles() {
    return this.platformRoleService.getAllPlatformRoles();
  }

  @Post('assign')
  @Roles('SuperAdmin')
  async assignRole(@Body() body: { userId: string; role: string }) {
    return this.platformRoleService.assignPlatformRole(body.userId, body.role);
  }

  @Delete('remove')
  @Roles('SuperAdmin')
  async removeRole(@Body() body: { userId: string; role: string }) {
    return this.platformRoleService.removePlatformRole(body.userId, body.role);
  }

  @Get('user/:userId')
  async getUserRoles(@Param('userId') userId: string) {
    return this.platformRoleService.getUserPlatformRoles(userId);
  }

  @Get('role/:role/users')
  @Roles('SuperAdmin')
  async getUsersByRole(@Param('role') role: string) {
    return this.platformRoleService.getUsersByPlatformRole(role);
  }
}
