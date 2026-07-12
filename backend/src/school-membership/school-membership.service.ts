import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchoolMembershipService {
  private readonly logger = new Logger(SchoolMembershipService.name);

  constructor(private prisma: PrismaService) {}

  async addMember(schoolId: string, userId: string, isPrimary = false) {
    const existing = await this.prisma.schoolUser.findFirst({
      where: { userId, schoolId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.schoolUser.create({
      data: { userId, schoolId, isPrimary },
    });
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
      return existing;
    }

    return this.prisma.schoolRoleAssignment.create({
      data: {
        schoolMembershipId: membership.id,
        role,
        assignedBy,
        isActive: true,
      },
    });
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

    return { message: `Role ${role} removed` };
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
