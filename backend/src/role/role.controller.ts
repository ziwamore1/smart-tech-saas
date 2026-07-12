import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('roles')
export class RoleController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('school')
  findSchoolRoles(@Req() req: any) {
    return this.prisma.role.findMany({
      where: {
        name: { in: ['Director', 'Deputy Director', 'SuperAdmin', 'Teacher', 'Head Teacher', 'Deputy', 'Accountant', 'Secretary', 'Class Teacher', 'HOD'] },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get('user/:userId')
  async getUserRoles(@Param('userId') userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map(ur => ({
      roleId: ur.roleId,
      roleName: ur.role.name,
    }));
  }

  @Post('assign')
  async assignRole(
    @Body() body: { userId: string; roleName: string },
    @Req() req: any,
  ) {
    const schoolId = req.user?.schoolId;
    
    // Find the role
    const role = await this.prisma.role.findFirst({
      where: { name: body.roleName },
    });
    if (!role) {
      throw new Error(`Role ${body.roleName} not found`);
    }

    // Check if assignment exists
    const existing = await this.prisma.userRole.findFirst({
      where: { userId: body.userId, roleId: role.id },
    });

    if (existing) {
      return { message: 'Role already assigned' };
    }

    // Create assignment
    const userRole = await this.prisma.userRole.create({
      data: { userId: body.userId, roleId: role.id },
    });

    return { message: 'Role assigned', userRole };
  }

  @Post('remove')
  async removeRole(
    @Body() body: { userId: string; roleName: string },
  ) {
    const role = await this.prisma.role.findFirst({
      where: { name: body.roleName },
    });
    if (!role) {
      throw new Error(`Role ${body.roleName} not found`);
    }

    await this.prisma.userRole.deleteMany({
      where: { userId: body.userId, roleId: role.id },
    });

    return { message: 'Role removed' };
  }

  @Get('school/users')
  async getSchoolUsersWithRoles(@Req() req: any) {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { schoolId },
      include: {
        userRoles: { include: { role: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    return users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      roles: user.userRoles.map(ur => ur.role.name),
    }));
  }
}