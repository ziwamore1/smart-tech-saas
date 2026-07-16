import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
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
        name: { in: ['Director', 'Deputy Director', 'SuperAdmin', 'Teacher', 'Head Teacher', 'Deputy', 'Accountant', 'Secretary', 'Class Teacher', 'HOD', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'] },
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

    if (!existing) {
      // Create legacy UserRole assignment
      await this.prisma.userRole.create({
        data: { userId: body.userId, roleId: role.id },
      });
    }

    // Also create SchoolRoleAssignment for school-level authorization
    if (schoolId) {
      const membership = await this.prisma.schoolUser.findFirst({
        where: { userId: body.userId, schoolId },
      });
      if (membership) {
        const existingSchoolRole = await this.prisma.schoolRoleAssignment.findFirst({
          where: { schoolMembershipId: membership.id, role: body.roleName },
        });
        if (!existingSchoolRole) {
          await this.prisma.schoolRoleAssignment.create({
            data: { schoolMembershipId: membership.id, role: body.roleName, isActive: true },
          });
        } else if (!existingSchoolRole.isActive) {
          await this.prisma.schoolRoleAssignment.update({
            where: { id: existingSchoolRole.id },
            data: { isActive: true },
          });
        }
      }
    }

    return { message: 'Role assigned successfully' };
  }

  @Post('remove')
  async removeRole(
    @Body() body: { userId: string; roleName: string },
    @Req() req: any,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { name: body.roleName },
    });
    if (!role) {
      throw new Error(`Role ${body.roleName} not found`);
    }

    // Remove legacy UserRole
    await this.prisma.userRole.deleteMany({
      where: { userId: body.userId, roleId: role.id },
    });

    // Also deactivate SchoolRoleAssignment
    const schoolId = req.user?.schoolId;
    if (schoolId) {
      const membership = await this.prisma.schoolUser.findFirst({
        where: { userId: body.userId, schoolId },
      });
      if (membership) {
        await this.prisma.schoolRoleAssignment.updateMany({
          where: { schoolMembershipId: membership.id, role: body.roleName },
          data: { isActive: false },
        });
      }
    }

    return { message: 'Role removed successfully' };
  }

  @Get('school/users')
  @Roles('Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher')
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