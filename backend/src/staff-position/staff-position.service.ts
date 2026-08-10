import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateActingPositionDto } from './dto/create-acting-position.dto';
import { UpdateActingPositionDto } from './dto/update-acting-position.dto';

const POSITION_TYPES = [
  'DIRECTOR', 'DEPUTY_DIRECTOR', 'HEAD_TEACHER', 'DEPUTY',
  'HOD', 'SUBJECT_TEACHER', 'CLASS_TEACHER',
  'SENIOR_TEACHER', 'ADMINISTRATOR',
  'LOWER_PRIMARY_SENIOR_TEACHER', 'UPPER_PRIMARY_SENIOR_TEACHER',
] as const;

const POSITION_TO_ROLE: Record<string, string> = {
  DIRECTOR: 'Director',
  DEPUTY_DIRECTOR: 'Deputy Director',
  HEAD_TEACHER: 'Head Teacher',
  DEPUTY: 'Deputy',
  HOD: 'HOD',
  CLASS_TEACHER: 'Class Teacher',
  LOWER_PRIMARY_SENIOR_TEACHER: 'Lower Primary Senior Teacher',
  UPPER_PRIMARY_SENIOR_TEACHER: 'Upper Primary Senior Teacher',
};

@Injectable()
export class StaffPositionService {
  private readonly logger = new Logger(StaffPositionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== DEPARTMENTS ====================

  async createDepartment(schoolId: string, dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { schoolId_name: { schoolId, name: dto.name } },
    });
    if (existing) throw new BadRequestException(`Department "${dto.name}" already exists in this school`);

    return this.prisma.department.create({
      data: { ...dto, schoolId },
    });
  }

  async getDepartments(schoolId: string) {
    const departments = await this.prisma.department.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { teachers: true, positions: true } } },
    });

    const hods = await this.prisma.actingPosition.findMany({
      where: { schoolId, positionType: 'HOD', isActive: true, departmentId: { not: null } },
      include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    return departments.map((department) => ({
      ...department,
      hod: hods.find((position) => position.departmentId === department.id) || null,
      source: 'STAFF_REGISTER',
    }));
  }

  async getDepartmentById(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        teachers: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        _count: { select: { positions: true } },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async deleteDepartment(id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');

    const teacherCount = await this.prisma.teacher.count({ where: { departmentId: id } });
    if (teacherCount > 0) {
      throw new BadRequestException(`Cannot delete department with ${teacherCount} assigned teachers. Reassign them first.`);
    }

    return this.prisma.department.delete({ where: { id } });
  }

  // ==================== ACTING POSITIONS ====================

  async createActingPosition(schoolId: string, dto: CreateActingPositionDto) {
    this.validatePositionType(dto.positionType);

    const teacher = await this.prisma.teacher.findFirst({ where: { id: dto.teacherId, schoolId } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    if (dto.positionType === 'HOD' && !dto.departmentId) {
      throw new BadRequestException('Department ID is required for HOD position');
    }

    if (dto.positionType === 'CLASS_TEACHER' && !dto.classId) {
      throw new BadRequestException('Class ID is required for Class Teacher position');
    }

    const position = await this.prisma.actingPosition.create({
      data: {
        teacherId: dto.teacherId,
        schoolId,
        positionType: dto.positionType,
        departmentId: dto.departmentId,
        classId: dto.classId,
        isPrimary: dto.isPrimary ?? true,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: {
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        department: true,
        class: { select: { id: true, name: true } },
      },
    });

    // Auto-assign the corresponding role
    const roleName = POSITION_TO_ROLE[dto.positionType];
    if (roleName) {
      try {
        let role = await this.prisma.role.findFirst({ where: { name: roleName } });
        if (!role) {
          role = await this.prisma.role.create({ data: { name: roleName } });
        }
        const existingUr = await this.prisma.userRole.findFirst({
          where: { userId: dto.teacherId, roleId: role.id },
        });
        if (!existingUr) {
          await this.prisma.userRole.create({
            data: { userId: dto.teacherId, roleId: role.id },
          });
        }
        const membership = await this.prisma.schoolUser.findFirst({
          where: { userId: dto.teacherId, schoolId },
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
        this.logger.warn(`Failed to auto-assign role "${roleName}" for position ${dto.positionType}: ${err.message}`);
      }
    }

    return position;
  }

  async getTeacherPositions(teacherId: string) {
    return this.prisma.actingPosition.findMany({
      where: { teacherId },
      include: { department: true, class: { select: { id: true, name: true } } },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }],
    });
  }

  async getSchoolPositions(schoolId: string, positionType?: string) {
    const where: any = { schoolId };
    if (positionType) where.positionType = positionType;

    return this.prisma.actingPosition.findMany({
      where,
      include: {
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        department: true,
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ positionType: 'asc' }, { isPrimary: 'desc' }],
    });
  }

  async updateActingPosition(id: string, dto: UpdateActingPositionDto) {
    const pos = await this.prisma.actingPosition.findUnique({ where: { id } });
    if (!pos) throw new NotFoundException('Acting position not found');

    if (dto.positionType) this.validatePositionType(dto.positionType);

    return this.prisma.actingPosition.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        department: true,
        class: { select: { id: true, name: true } },
      },
    });
  }

  async deleteActingPosition(id: string) {
    const pos = await this.prisma.actingPosition.findUnique({ where: { id } });
    if (!pos) throw new NotFoundException('Acting position not found');

    const result = await this.prisma.actingPosition.delete({ where: { id } });

    // Remove the corresponding role if no other positions of the same type exist for this teacher
    const roleName = POSITION_TO_ROLE[pos.positionType];
    if (roleName) {
      try {
        const remaining = await this.prisma.actingPosition.findFirst({
          where: { teacherId: pos.teacherId, positionType: pos.positionType, id: { not: id } },
        });
        if (!remaining) {
          const role = await this.prisma.role.findFirst({ where: { name: roleName } });
          if (role) {
            await this.prisma.userRole.deleteMany({
              where: { userId: pos.teacherId, roleId: role.id },
            });
            const membership = await this.prisma.schoolUser.findFirst({
              where: { userId: pos.teacherId, schoolId: pos.schoolId },
            });
            if (membership) {
              await this.prisma.schoolRoleAssignment.updateMany({
                where: { schoolMembershipId: membership.id, role: roleName },
                data: { isActive: false },
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to remove role "${roleName}" on position delete: ${err.message}`);
      }
    }

    return result;
  }

  // ==================== HIERARCHY / MONITORING ====================

  async getHierarchy(schoolId: string) {
    // Backfill positions for staff registered with supervisory school roles, including legacy records.
    const registeredStaff = await this.prisma.teacher.findMany({
      where: { schoolId },
      include: { user: { include: { userRoles: { include: { role: true } } } } },
    });
    for (const teacher of registeredStaff) {
      for (const userRole of teacher.user.userRoles) {
        await this.reconcileTeacherRole(teacher.id, schoolId, userRole.role.name, true);
      }
    }

    const positions = await this.prisma.actingPosition.findMany({
      where: { schoolId, isActive: true },
      include: {
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        department: true,
      },
    });

    const director = positions.find(p => p.positionType === 'DIRECTOR');
    const deputyDirector = positions.filter(p => p.positionType === 'DEPUTY_DIRECTOR');
    const headTeacher = positions.find(p => p.positionType === 'HEAD_TEACHER');
    const deputies = positions.filter(p => p.positionType === 'DEPUTY');
    const hods = positions.filter(p => p.positionType === 'HOD');
    const lowerPrimarySeniorTeachers = positions.filter(p => p.positionType === 'LOWER_PRIMARY_SENIOR_TEACHER');
    const upperPrimarySeniorTeachers = positions.filter(p => p.positionType === 'UPPER_PRIMARY_SENIOR_TEACHER');
    const subjectTeachers = positions.filter(p => p.positionType === 'SUBJECT_TEACHER');

    const departments = await this.prisma.department.findMany({
      where: { schoolId, isActive: true },
      include: {
        teachers: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });

    const departmentHierarchy = departments.map(dept => {
      const hod = hods.find(h => h.departmentId === dept.id);
      const lowerSenior = lowerPrimarySeniorTeachers.find(s => s.departmentId === dept.id);
      const upperSenior = upperPrimarySeniorTeachers.find(s => s.departmentId === dept.id);
      const deptSupervisor = hod || lowerSenior || upperSenior;
      const members = dept.teachers.filter(t =>
        !deptSupervisor || t.id !== deptSupervisor.teacherId
      );
      return {
        department: { id: dept.id, name: dept.name, code: dept.code, category: dept.category },
        hod: deptSupervisor ? { id: deptSupervisor.id, teacher: (deptSupervisor as any).teacher, positionType: deptSupervisor.positionType } : null,
        members: members.map(m => ({
          id: m.id,
          employeeNo: m.employeeNo,
          user: m.user,
          positions: positions.filter(p => p.teacherId === m.id).map(p => ({
            id: p.id,
            positionType: p.positionType,
            isPrimary: p.isPrimary,
          })),
        })),
      };
    });

    return {
      director: director ? { id: director.id, teacher: director.teacher } : null,
      deputyDirector: deputyDirector.map(d => ({ id: d.id, teacher: d.teacher })),
      headTeacher: headTeacher ? { id: headTeacher.id, teacher: headTeacher.teacher } : null,
      deputies: deputies.map(d => ({ id: d.id, teacher: d.teacher })),
      departments: departmentHierarchy,
      unassignedTeachers: subjectTeachers.filter(t => !departments.some(d => d.teachers.some(t2 => t2.id === t.teacherId))),
    };
  }

  async getDepartmentTeachers(schoolId: string, departmentId: string) {
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, schoolId } });
    if (!dept) throw new NotFoundException('Department not found');

    const teacherIds = (
      await this.prisma.teacher.findMany({
        where: { schoolId, departmentId },
        select: { id: true },
      })
    ).map(t => t.id);

    const positions = await this.prisma.actingPosition.findMany({
      where: { teacherId: { in: teacherIds }, isActive: true },
      include: {
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
        department: true,
        class: { select: { id: true, name: true } },
      },
    });

    const hod = positions.find(p =>
      (p.positionType === 'HOD' || p.positionType === 'LOWER_PRIMARY_SENIOR_TEACHER' || p.positionType === 'UPPER_PRIMARY_SENIOR_TEACHER')
      && p.departmentId === departmentId
    );

    const teachers = await this.prisma.teacher.findMany({
      where: { schoolId, departmentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: { user: { firstName: 'asc' } },
    });

    return {
      department: dept,
      hod: hod ? { id: hod.id, teacher: hod.teacher, positionType: hod.positionType } : null,
      teachers: teachers.map(t => ({
        ...t,
        positions: positions.filter(p => p.teacherId === t.id),
      })),
    };
  }

  async getMonitoringChain(schoolId: string, teacherId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const positions = await this.prisma.actingPosition.findMany({
      where: { teacherId, isActive: true },
    });

    const allPositions = await this.prisma.actingPosition.findMany({
      where: { schoolId, isActive: true },
      include: {
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        department: true,
      },
    });

    const director = allPositions.find(p => p.positionType === 'DIRECTOR');
    const deputyDirector = allPositions.filter(p => p.positionType === 'DEPUTY_DIRECTOR');
    const headTeacher = allPositions.find(p => p.positionType === 'HEAD_TEACHER');
    const deputies = allPositions.filter(p => p.positionType === 'DEPUTY');
    const hods = allPositions.filter(p => p.positionType === 'HOD');
    const lowerPrimarySeniorTeachers = allPositions.filter(p => p.positionType === 'LOWER_PRIMARY_SENIOR_TEACHER');
    const upperPrimarySeniorTeachers = allPositions.filter(p => p.positionType === 'UPPER_PRIMARY_SENIOR_TEACHER');
    const allDeptSupervisors = [...hods, ...lowerPrimarySeniorTeachers, ...upperPrimarySeniorTeachers];
    const seniorLeaders = [...deputyDirector, ...deputies];

    const isDirector = positions.some(p => p.positionType === 'DIRECTOR');
    const isDeputyDirector = positions.some(p => p.positionType === 'DEPUTY_DIRECTOR');
    const isHeadTeacher = positions.some(p => p.positionType === 'HEAD_TEACHER');
    const isDeputy = positions.some(p => p.positionType === 'DEPUTY');
    const isHod = positions.some(p => p.positionType === 'HOD');
    const isLowerPrimarySenior = positions.some(p => p.positionType === 'LOWER_PRIMARY_SENIOR_TEACHER');
    const isUpperPrimarySenior = positions.some(p => p.positionType === 'UPPER_PRIMARY_SENIOR_TEACHER');
    const isDeptSupervisor = isHod || isLowerPrimarySenior || isUpperPrimarySenior;
    const position = positions[0];

    let supervises: any[] = [];
    let supervisedBy: any[] = [];

    if (isDirector) {
      supervises = allPositions.filter(p => p.teacherId !== teacherId);
    } else if (isDeputyDirector || isDeputy) {
      supervises = [...allDeptSupervisors, ...allPositions.filter(p => p.positionType === 'SUBJECT_TEACHER')];
      supervisedBy = director ? [director] : headTeacher ? [headTeacher] : [];
    } else if (isHeadTeacher) {
      supervises = allPositions.filter(p => p.teacherId !== teacherId);
    } else if (isDeptSupervisor && position?.departmentId) {
      const deptTeachers = await this.prisma.teacher.findMany({
        where: { departmentId: position.departmentId },
        select: { id: true },
      });
      const deptTeacherIds = deptTeachers.map(t => t.id);
      supervises = allPositions.filter(p => deptTeacherIds.includes(p.teacherId) && p.teacherId !== teacherId);
      supervisedBy = [...seniorLeaders, ...(director ? [director] : []), ...(headTeacher ? [headTeacher] : [])];
    } else {
      if (position?.departmentId) {
        const deptBoss = allDeptSupervisors.find(s => s.departmentId === position.departmentId);
        if (deptBoss) supervisedBy.push(deptBoss);
      }
      supervisedBy = [...supervisedBy, ...seniorLeaders, ...(director ? [director] : []), ...(headTeacher ? [headTeacher] : [])];
    }

    const uniqueSupervises = supervises.filter((v, i, a) => a.findIndex(t => t.teacherId === v.teacherId) === i);
    const uniqueSupervisedBy = supervisedBy.filter((v, i, a) => a.findIndex(t => t.teacherId === v.teacherId) === i);

    return {
      teacher: { id: teacher.id, user: teacher.user, departmentId: teacher.departmentId },
      positions: positions.map(p => ({ positionType: p.positionType, isPrimary: p.isPrimary })),
      supervises: uniqueSupervises.map(p => ({ id: p.id, positionType: p.positionType, teacher: p.teacher, department: p.department })),
      supervisedBy: uniqueSupervisedBy.map(p => ({ id: p.id, positionType: p.positionType, teacher: p.teacher, department: p.department })),
    };
  }

  async getPositionTypes() {
    return POSITION_TYPES.map(t => ({
      value: t,
      label: t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    }));
  }

  /** Reconciles a registered teacher's role with the live hierarchy. */
  async reconcileTeacherRole(teacherId: string, schoolId: string, role: string, active: boolean) {
    const positionType = Object.entries(POSITION_TO_ROLE).find(([, value]) => value.toLowerCase() === role.toLowerCase())?.[0];
    if (!positionType) return;

    const teacher = await this.prisma.teacher.findFirst({ where: { id: teacherId, schoolId } });
    if (!teacher) return;

    const existing = await this.prisma.actingPosition.findFirst({
      where: { teacherId, schoolId, positionType, isActive: true },
    });

    if (!active) {
      if (existing) await this.prisma.actingPosition.update({ where: { id: existing.id }, data: { isActive: false, endDate: new Date(), isPrimary: false } });
      return;
    }

    if (existing) {
      if (positionType === 'HOD' && existing.departmentId !== teacher.departmentId) {
        await this.prisma.actingPosition.update({ where: { id: existing.id }, data: { departmentId: teacher.departmentId, isPrimary: true } });
      }
      return;
    }

    if (positionType === 'HOD' && !teacher.departmentId) return;

    await this.prisma.actingPosition.create({
      data: {
        teacherId,
        schoolId,
        positionType,
        departmentId: ['HOD', 'LOWER_PRIMARY_SENIOR_TEACHER', 'UPPER_PRIMARY_SENIOR_TEACHER'].includes(positionType) ? teacher.departmentId : null,
        isPrimary: true,
      },
    });
  }

  // ==================== HELPERS ====================

  private validatePositionType(type: string) {
    if (!POSITION_TYPES.includes(type as any)) {
      throw new BadRequestException(
        `Invalid position type. Valid types: ${POSITION_TYPES.join(', ')}`
      );
    }
  }
}
