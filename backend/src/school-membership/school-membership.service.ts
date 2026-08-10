import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffPositionService } from '../staff-position/staff-position.service';

@Injectable()
export class SchoolMembershipService {
  private readonly logger = new Logger(SchoolMembershipService.name);

  constructor(private prisma: PrismaService, private staffPositionService: StaffPositionService) {}

  async addMember(schoolId: string, userId: string, isPrimary = false) {
    const existing = await this.prisma.schoolUser.findFirst({
      where: { userId, schoolId },
    });

    if (existing) {
      // Ensure User.schoolId is set if null
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
      if (!user?.schoolId) {
        await this.prisma.user.update({ where: { id: userId }, data: { schoolId } });
      }
      return existing;
    }

    const membership = await this.prisma.schoolUser.create({
      data: { userId, schoolId, isPrimary },
    });

    // Ensure User.schoolId is set if null
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
    if (!user?.schoolId) {
      await this.prisma.user.update({ where: { id: userId }, data: { schoolId } });
    }

    return membership;
  }

  async removeMember(schoolId: string, userId: string) {
    const membership = await this.prisma.schoolUser.findFirst({
      where: { userId, schoolId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Remove associated school role assignments
    await this.prisma.schoolRoleAssignment.deleteMany({
      where: { schoolMembershipId: membership.id },
    });

    await this.prisma.schoolUser.delete({
      where: { id: membership.id },
    });

    return { message: 'Member removed from school' };
  }

  async getMembers(schoolId: string) {
    return this.prisma.schoolUser.findMany({
      where: { schoolId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            accountStatus: true,
          },
        },
        schoolRoleAssignments: {
          where: { isActive: true },
          select: { role: true, startDate: true },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
  }

  async getMembersByRole(schoolId: string, role: string) {
    return this.prisma.schoolUser.findMany({
      where: {
        schoolId,
        schoolRoleAssignments: {
          some: { role, isActive: true },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        schoolRoleAssignments: {
          where: { isActive: true },
          select: { role: true },
        },
      },
    });

    const roleRecord = await this.prisma.role.findFirst({ where: { name: role } });
    if (roleRecord) {
      await this.prisma.userRole.deleteMany({ where: { userId, roleId: roleRecord.id } });
    }
  }

  async getTeachingStaff(schoolId: string) {
    return this.prisma.schoolUser.findMany({
      where: {
        schoolId,
        OR: [
          // Users with active teaching assignments
          {
            user: {
              teachingAssignments: {
                some: { schoolId, isActive: true },
              },
            },
          },
          // Users with teaching-related school roles
          {
            schoolRoleAssignments: {
              some: {
                role: { in: ['Teacher', 'Class Teacher', 'Director', 'Deputy Director', 'Head Teacher'] },
                isActive: true,
              },
            },
          },
          // Users with Teacher records
          {
            user: {
              teacher: { schoolId },
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            teacher: {
              select: { id: true, employeeNo: true, department: true, staffType: true },
            },
          },
        },
        schoolRoleAssignments: {
          where: { isActive: true },
          select: { role: true },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
  }

  async assignSchoolRole(schoolId: string, userId: string, role: string, assignedBy?: string) {
    const membership = await this.prisma.schoolUser.findFirst({
      where: { userId, schoolId },
    });

    if (!membership) {
      throw new BadRequestException('User is not a member of this school');
    }

    const existing = await this.prisma.schoolRoleAssignment.findFirst({
      where: {
        schoolMembershipId: membership.id,
        role,
        isActive: true,
      },
    });

    if (existing) {
      const teacher = await this.prisma.teacher.findFirst({ where: { userId, schoolId } });
      if (teacher) await this.staffPositionService.reconcileTeacherRole(teacher.id, schoolId, role, true);
      return existing;
    }

    const assignment = await this.prisma.schoolRoleAssignment.create({
      data: {
        schoolMembershipId: membership.id,
        role,
        assignedBy,
        isActive: true,
      },
    });

    const teacher = await this.prisma.teacher.findFirst({ where: { userId, schoolId } });
    if (teacher) await this.staffPositionService.reconcileTeacherRole(teacher.id, schoolId, role, true);

    // Also create legacy UserRole to ensure backward compatibility in JWT
    try {
      let roleRecord = await this.prisma.role.findFirst({ where: { name: role } });
      if (!roleRecord) {
        roleRecord = await this.prisma.role.create({ data: { name: role } });
      }
      const existingUr = await this.prisma.userRole.findFirst({
        where: { userId, roleId: roleRecord.id },
      });
      if (!existingUr) {
        await this.prisma.userRole.create({ data: { userId, roleId: roleRecord.id } });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to create legacy UserRole for role ${role}: ${err.message}`);
    }

    return assignment;
  }

  async removeSchoolRole(schoolId: string, userId: string, role: string) {
    const membership = await this.prisma.schoolUser.findFirst({
      where: { userId, schoolId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    await this.prisma.schoolRoleAssignment.deleteMany({
      where: {
        schoolMembershipId: membership.id,
        role,
      },
    });

    const teacher = await this.prisma.teacher.findFirst({ where: { userId, schoolId } });
    if (teacher) await this.staffPositionService.reconcileTeacherRole(teacher.id, schoolId, role, false);

    return { message: `Role ${role} removed` };
  }

  async searchAllUsers(schoolId: string, query: string) {
    const q = query.trim();
    if (q.length < 2) return [];

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        schoolUsers: {
          where: { schoolId },
          select: { id: true },
        },
      },
      take: 20,
      orderBy: { firstName: 'asc' },
    });

    return users.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      isMember: u.schoolUsers.length > 0,
    }));
  }

  async getUserSchoolRoles(userId: string) {
    return this.prisma.schoolUser.findMany({
      where: { userId },
      include: {
        school: { select: { id: true, name: true } },
        schoolRoleAssignments: {
          where: { isActive: true },
          select: { role: true, startDate: true },
        },
      },
    });
  }
}
