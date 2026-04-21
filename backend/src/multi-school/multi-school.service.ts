import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MultiSchoolService {
  constructor(private prisma: PrismaService) {}

  async getUserSchools(userId: string) {
    const schoolUsers = await this.prisma.schoolUser.findMany({
      where: { userId },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            registrationNumber: true,
            logoUrl: true,
            logo: true,
            subscriptionStatus: true,
            subscriptionTier: true,
          },
        },
      },
      orderBy: { isPrimary: 'desc' },
    });

    return schoolUsers.map(su => ({
      ...su.school,
      isPrimary: su.isPrimary,
    }));
  }

  async getSchoolDetails(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        schoolUsers: {
          where: { isPrimary: true },
          include: { user: true },
        },
        _count: {
          select: {
            teachers: true,
            students: true,
            classes: true,
          },
        },
      },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return school;
  }

  async addUserToSchool(userId: string, schoolId: string, isPrimary: boolean = false) {
    const existing = await this.prisma.schoolUser.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });

    if (existing) {
      throw new ForbiddenException('User already has access to this school');
    }

    if (isPrimary) {
      await this.prisma.schoolUser.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.schoolUser.create({
      data: { userId, schoolId, isPrimary },
      include: { school: true },
    });
  }

  async removeUserFromSchool(userId: string, schoolId: string) {
    const schoolUser = await this.prisma.schoolUser.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });

    if (!schoolUser) {
      throw new NotFoundException('User access not found');
    }

    if (schoolUser.isPrimary) {
      throw new ForbiddenException('Cannot remove primary school access. Set another school as primary first.');
    }

    await this.prisma.schoolUser.delete({
      where: { userId_schoolId: { userId, schoolId } },
    });

    return { success: true };
  }

  async setPrimarySchool(userId: string, schoolId: string) {
    await this.prisma.schoolUser.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });

    return this.prisma.schoolUser.update({
      where: { userId_schoolId: { userId, schoolId } },
      data: { isPrimary: true },
      include: { school: true },
    });
  }

  async getSchoolUsers(schoolId: string) {
    return this.prisma.schoolUser.findMany({
      where: { schoolId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        },
      },
    });
  }

  async transferOwnership(schoolId: string, currentOwnerId: string, newOwnerId: string) {
    const currentOwner = await this.prisma.user.findUnique({
      where: { id: currentOwnerId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });
    const isSuperAdmin = currentOwner?.userRoles.some(ur => ur.role.name === 'SUPER_ADMIN');
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only super admins can transfer ownership');
    }

    return this.prisma.school.update({
      where: { id: schoolId },
      data: {},
    });
  }

  async getSchoolStats(schoolId: string) {
    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      activeEnrollments,
    ] = await Promise.all([
      this.prisma.student.count({ where: { schoolId } }),
      this.prisma.teacher.count({ where: { schoolId } }),
      this.prisma.class.count({ where: { schoolId } }),
      this.prisma.subject.count({ where: { schoolId } }),
      this.prisma.enrollment.count({ where: { schoolId, status: 'ACTIVE' } }),
    ]);

    return {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      activeEnrollments,
    };
  }

  async switchSchoolContext(userId: string, schoolId: string) {
    const schoolUser = await this.prisma.schoolUser.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });

    if (!schoolUser) {
      throw new ForbiddenException('User does not have access to this school');
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionTier: true,
      },
    });

    return { school, isPrimary: schoolUser.isPrimary };
  }
}
