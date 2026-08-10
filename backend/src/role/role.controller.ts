import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffPositionService } from '../staff-position/staff-position.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoleController {
  private readonly logger = new Logger(RoleController.name);

  constructor(
    private prisma: PrismaService,
    private staffPositionService: StaffPositionService,
  ) {}

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
    
    // Find or create the role
    let role = await this.prisma.role.findFirst({
      where: { name: body.roleName },
    });
    if (!role) {
      role = await this.prisma.role.create({
        data: { name: body.roleName },
      });
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

    // Keep the teacher's staff position in sync so a re-sync shows the updated role
    if (schoolId) {
      const teacher = await this.prisma.teacher.findFirst({ where: { userId: body.userId, schoolId } });
      if (teacher) {
        try {
          await this.staffPositionService.reconcileTeacherRole(teacher.id, schoolId, body.roleName, true);
        } catch (err: any) {
          this.logger.warn(`Failed to reconcile staff position for role ${body.roleName}: ${err.message}`);
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

    // Deactivate the teacher's staff position so a re-sync doesn't show a stale role
    if (schoolId) {
      const teacher = await this.prisma.teacher.findFirst({ where: { userId: body.userId, schoolId } });
      if (teacher) {
        try {
          await this.staffPositionService.reconcileTeacherRole(teacher.id, schoolId, body.roleName, false);
        } catch (err: any) {
          this.logger.warn(`Failed to reconcile staff position for removed role ${body.roleName}: ${err.message}`);
        }
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
      where: {
        OR: [
          { schoolId },
          { schoolUsers: { some: { schoolId } } },
        ],
      },
      include: {
        userRoles: { include: { role: true } },
        schoolUsers: {
          where: { schoolId },
          include: {
            SchoolRoleAssignment: { where: { isActive: true }, select: { role: true } },
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    return users.map(user => {
      const legacyRoles = user.userRoles.map(ur => ur.role.name);
      const schoolRoles = (user.schoolUsers || []).flatMap(su =>
        su.SchoolRoleAssignment.map(sra => sra.role)
      );
      const allRoles = [...new Set([...legacyRoles, ...schoolRoles])];

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
        roles: allRoles.length > 0 ? allRoles : legacyRoles,
      };
    });
  }
}