import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassTeacherAssignmentService {
  private readonly logger = new Logger(ClassTeacherAssignmentService.name);

  constructor(private prisma: PrismaService) {}

  async assign(data: {
    teacherId: string;
    classId: string;
    academicYearId: string;
    schoolId: string;
    isPrimary?: boolean;
    assignedBy?: string;
  }) {
    // Validate teacher exists
    const user = await this.prisma.user.findUnique({ where: { id: data.teacherId } });
    if (!user) throw new BadRequestException('Teacher not found');

    // Validate class exists
    const cls = await this.prisma.class.findUnique({ where: { id: data.classId } });
    if (!cls) throw new BadRequestException('Class not found');

    // Validate academic year exists
    const year = await this.prisma.academicYear.findUnique({ where: { id: data.academicYearId } });
    if (!year) throw new BadRequestException('Academic year not found');

    // Check for existing assignment
    const existing = await this.prisma.classTeacherAssignment.findFirst({
      where: {
        teacherId: data.teacherId,
        classId: data.classId,
        academicYearId: data.academicYearId,
      },
    });

    if (existing) {
      throw new BadRequestException('Assignment already exists for this teacher/class/year');
    }

    // If this is a primary assignment, deactivate other primary assignments for this class
    if (data.isPrimary !== false) {
      await this.prisma.classTeacherAssignment.updateMany({
        where: {
          classId: data.classId,
          academicYearId: data.academicYearId,
          isPrimary: true,
          isActive: true,
        },
        data: { isPrimary: false },
      });
    }

    const assignment = await this.prisma.classTeacherAssignment.create({
      data: {
        teacherId: data.teacherId,
        classId: data.classId,
        academicYearId: data.academicYearId,
        schoolId: data.schoolId,
        isPrimary: data.isPrimary ?? true,
        assignedBy: data.assignedBy,
        isActive: true,
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        class: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    // Also update Class.classTeacherId for backward compatibility
    if (data.isPrimary !== false) {
      await this.prisma.class.update({
        where: { id: data.classId },
        data: { classTeacherId: data.teacherId },
      });
    }

    // Auto-assign "Class Teacher" role to the teacher
    try {
      const roleName = 'Class Teacher';
      let role = await this.prisma.role.findFirst({ where: { name: roleName } });
      if (!role) {
        role = await this.prisma.role.create({ data: { name: roleName } });
      }
      const existingUr = await this.prisma.userRole.findFirst({
        where: { userId: data.teacherId, roleId: role.id },
      });
      if (!existingUr) {
        await this.prisma.userRole.create({
          data: { userId: data.teacherId, roleId: role.id },
        });
      }
      const membership = await this.prisma.schoolUser.findFirst({
        where: { userId: data.teacherId, schoolId: data.schoolId },
      });
      if (membership) {
        const existingSr = await this.prisma.schoolRoleAssignment.findFirst({
          where: { schoolMembershipId: membership.id, role: roleName },
        });
        if (!existingSr) {
          await this.prisma.schoolRoleAssignment.create({
            data: { schoolMembershipId: membership.id, role: roleName, isActive: true },
          });
        } else if (!existingSr.isActive) {
          await this.prisma.schoolRoleAssignment.update({
            where: { id: existingSr.id },
            data: { isActive: true },
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to auto-assign "Class Teacher" role: ${err.message}`);
    }

    this.logger.log(`Class teacher assigned: ${data.teacherId} -> class ${data.classId}`);
    return assignment;
  }

  async remove(id: string) {
    const assignment = await this.prisma.classTeacherAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    await this.prisma.classTeacherAssignment.update({
      where: { id },
      data: { isActive: false, endDate: new Date() },
    });

    // Update Class.classTeacherId if this was the primary assignment
    if (assignment.isPrimary) {
      const otherPrimary = await this.prisma.classTeacherAssignment.findFirst({
        where: {
          classId: assignment.classId,
          academicYearId: assignment.academicYearId,
          isPrimary: true,
          isActive: true,
          id: { not: id },
        },
      });

      await this.prisma.class.update({
        where: { id: assignment.classId },
        data: { classTeacherId: otherPrimary?.teacherId || null },
      });
    }

    return { message: 'Assignment removed' };
  }

  async findByClass(classId: string, academicYearId?: string) {
    const where: any = { classId, isActive: true };
    if (academicYearId) where.academicYearId = academicYearId;

    return this.prisma.classTeacherAssignment.findMany({
      where,
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }],
    });
  }

  async findByTeacher(teacherId: string, schoolId?: string) {
    const where: any = { teacherId, isActive: true };
    if (schoolId) where.schoolId = schoolId;

    return this.prisma.classTeacherAssignment.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: [{ startDate: 'desc' }],
    });
  }

  async findBySchool(schoolId: string, academicYearId?: string) {
    const where: any = { schoolId, isActive: true };
    if (academicYearId) where.academicYearId = academicYearId;

    return this.prisma.classTeacherAssignment.findMany({
      where,
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        class: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: [{ class: { name: 'asc' } }],
    });
  }
}
