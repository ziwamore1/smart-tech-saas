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
  SUBJECT_TEACHER: 'Teacher',
  CLASS_TEACHER: 'Class Teacher',
  LOWER_PRIMARY_SENIOR_TEACHER: 'Lower Primary Senior Teacher',
  UPPER_PRIMARY_SENIOR_TEACHER: 'Upper Primary Senior Teacher',
};

@Injectable()
export class StaffPositionService {
  private readonly logger = new Logger(StaffPositionService.name);
  private readonly lastSyncAt = new Map<string, number>();
  private readonly syncStartedAt = new Map<string, number>();
  private static readonly SYNC_LEASE_MS = 120_000;

  constructor(private readonly prisma: PrismaService) {}

  private shouldRunSync(schoolId: string): boolean {
    const startedAt = this.syncStartedAt.get(schoolId);
    if (startedAt !== undefined && Date.now() - startedAt < StaffPositionService.SYNC_LEASE_MS) return false;
    if (Date.now() - (this.lastSyncAt.get(schoolId) || 0) < 30_000) return false;
    this.syncStartedAt.set(schoolId, Date.now());
    return true;
  }

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
    await this.syncRegisteredDepartments(schoolId);
    this.ensureBackgroundSync(schoolId);
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
    this.ensureBackgroundSync(schoolId);
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
    this.ensureBackgroundSync(schoolId);

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
    const positionType = this.getPositionTypeForRole(role);
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
      const departmentPosition = ['HOD', 'SUBJECT_TEACHER', 'CLASS_TEACHER', 'SENIOR_TEACHER', 'LOWER_PRIMARY_SENIOR_TEACHER', 'UPPER_PRIMARY_SENIOR_TEACHER'].includes(positionType);
      if (departmentPosition && existing.departmentId !== teacher.departmentId) {
        await this.prisma.actingPosition.update({ where: { id: existing.id }, data: { departmentId: teacher.departmentId, isPrimary: positionType === 'HOD' ? true : undefined } });
      }
      return;
    }

    if (positionType === 'HOD' && !teacher.departmentId) return;

    await this.prisma.actingPosition.create({
      data: {
        teacherId,
        schoolId,
        positionType,
        departmentId: ['HOD', 'SUBJECT_TEACHER', 'CLASS_TEACHER', 'SENIOR_TEACHER', 'LOWER_PRIMARY_SENIOR_TEACHER', 'UPPER_PRIMARY_SENIOR_TEACHER'].includes(positionType) ? teacher.departmentId : null,
        isPrimary: true,
      },
    });
  }

  private getPositionTypeForRole(role: string) {
    const normalized = role.trim().toUpperCase().replace(/\s+/g, '_');
    if (normalized === 'TEACHER' || normalized === 'SUBJECT_TEACHER') return 'SUBJECT_TEACHER';
    if (normalized === 'HOD' || normalized === 'HEAD_OF_DEPARTMENT') return 'HOD';
    return Object.entries(POSITION_TO_ROLE).find(([, value]) => value.toLowerCase() === role.toLowerCase())?.[0];
  }

  private ensureBackgroundSync(schoolId: string) {
    this.syncRegisteredPositions(schoolId).catch((err: any) => {
      this.logger.error(`Background staff-position sync failed for school ${schoolId}: ${err.message}`);
    });
  }

  private async syncRegisteredPositions(schoolId: string) {
    await this.syncRegisteredDepartments(schoolId);
    if (!this.shouldRunSync(schoolId)) return;
    try {
      await this.runPositionSync(schoolId);
      this.lastSyncAt.set(schoolId, Date.now());
    } finally {
      this.syncStartedAt.delete(schoolId);
    }
  }

  async forceSync(schoolId: string) {
    if (this.syncStartedAt.has(schoolId)) {
      return { running: true, message: 'A sync is already in progress for this school. Refresh in a moment.' };
    }
    this.lastSyncAt.delete(schoolId);
    const summary = await this.runPositionSync(schoolId);
    this.lastSyncAt.set(schoolId, Date.now());
    return { running: false, message: 'Sync complete', ...summary };
  }

  private async runPositionSync(schoolId: string) {
    const registeredStaff = await this.prisma.teacher.findMany({
      where: { schoolId },
      select: {
        id: true,
        departmentId: true,
        department: true,
        user: {
          select: {
            userRoles: { select: { role: { select: { name: true } } } },
            schoolUsers: {
              where: { schoolId },
              select: { schoolRoleAssignments: { where: { isActive: true }, select: { role: true } } },
            },
          },
        },
      },
    });

    const existingPositions = await this.prisma.actingPosition.findMany({
      where: { schoolId },
      select: { id: true, teacherId: true, positionType: true, departmentId: true, isPrimary: true, isActive: true },
    });
    const positionByTeacherType = new Map<string, { id: string; departmentId: string | null; isPrimary: boolean }>();
    for (const p of existingPositions) {
      positionByTeacherType.set(`${p.teacherId}:${p.positionType}`, p);
    }

    const departments = await this.prisma.department.findMany({
      where: { schoolId },
      select: { id: true, name: true, code: true },
    });
    const departmentByName = new Map<string, string>();
    const departmentByCode = new Map<string, string>();
    for (const d of departments) {
      departmentByName.set(d.name.toLowerCase(), d.id);
      if (d.code) departmentByCode.set(d.code.toLowerCase(), d.id);
    }

    const departmentPositionTypes = ['HOD', 'SUBJECT_TEACHER', 'CLASS_TEACHER', 'SENIOR_TEACHER', 'LOWER_PRIMARY_SENIOR_TEACHER', 'UPPER_PRIMARY_SENIOR_TEACHER'];

    const teacherDeptByGroup = new Map<string, string[]>();
    const positionUpdateByGroup = new Map<string, { ids: string[]; departmentId: string | null; isPrimary: boolean }>();
    const positionsToCreate: { teacherId: string; schoolId: string; positionType: string; departmentId: string | null; isPrimary: boolean }[] = [];

    for (const teacher of registeredStaff) {
      let departmentId = teacher.departmentId;
      if (!departmentId && teacher.department?.trim()) {
        const name = teacher.department.trim().toLowerCase();
        departmentId = departmentByName.get(name) || departmentByCode.get(name) || null;
        if (departmentId) {
          const group = teacherDeptByGroup.get(departmentId) || [];
          group.push(teacher.id);
          teacherDeptByGroup.set(departmentId, group);
          teacher.departmentId = departmentId;
        }
      }

      const roles = new Set<string>(teacher.user.userRoles.map((a) => a.role.name));
      for (const membership of teacher.user.schoolUsers) {
        for (const assignment of membership.schoolRoleAssignments) roles.add(assignment.role);
      }

      for (const role of roles) {
        const positionType = this.getPositionTypeForRole(role);
        if (!positionType) continue;
        const key = `${teacher.id}:${positionType}`;
        const existing = positionByTeacherType.get(key);
        if (existing) {
          const isDeptPos = departmentPositionTypes.includes(positionType);
          if (isDeptPos && existing.departmentId !== departmentId && existing.isActive) {
            const isPrimary = positionType === 'HOD' ? true : existing.isPrimary;
            const groupKey = `${departmentId || 'null'}:${isPrimary}`;
            const group = positionUpdateByGroup.get(groupKey) || { ids: [], departmentId, isPrimary };
            group.ids.push(existing.id);
            positionUpdateByGroup.set(groupKey, group);
            existing.departmentId = departmentId;
          }
          continue;
        }
        if (positionType === 'HOD' && !departmentId) continue;
        positionsToCreate.push({
          teacherId: teacher.id,
          schoolId,
          positionType,
          departmentId: departmentPositionTypes.includes(positionType) ? departmentId : null,
          isPrimary: true,
        });
        positionByTeacherType.set(key, { id: 'pending', departmentId, isPrimary: true });
      }
    }

    for (const [departmentId, teacherIds] of teacherDeptByGroup) {
      try {
        await this.prisma.teacher.updateMany({
          where: { id: { in: teacherIds }, schoolId },
          data: { departmentId },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to link ${teacherIds.length} teachers to department ${departmentId}: ${err.message}`);
      }
    }

    for (const [, group] of positionUpdateByGroup) {
      try {
        await this.prisma.actingPosition.updateMany({
          where: { id: { in: group.ids } },
          data: { departmentId: group.departmentId, isPrimary: group.isPrimary },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to update ${group.ids.length} acting positions: ${err.message}`);
      }
    }

    let created = 0;
    if (positionsToCreate.length) {
      try {
        for (let i = 0; i < positionsToCreate.length; i += 1000) {
          const result = await this.prisma.actingPosition.createMany({
            data: positionsToCreate.slice(i, i + 1000),
            skipDuplicates: true,
          });
          created += result.count;
        }
      } catch (err: any) {
        this.logger.warn(`Failed to create ${positionsToCreate.length} acting positions: ${err.message}`);
      }
      this.logger.log(`Staff-position sync school ${schoolId}: created ${created} acting positions`);
    }

    this.logger.log(
      `Staff-position sync school ${schoolId}: ${registeredStaff.length} teachers scanned, ` +
      `${teacherDeptByGroup.size} department groups linked, ${positionUpdateByGroup.size} position groups updated`,
    );

    return {
      teachersScanned: registeredStaff.length,
      departmentGroupsLinked: teacherDeptByGroup.size,
      positionsCreated: created,
    };
  }

  private async syncRegisteredDepartments(schoolId: string) {
    const registeredDepartments = await this.prisma.teacher.findMany({
      where: { schoolId, department: { not: null } },
      select: { department: true },
      distinct: ['department'],
    });

    const existing = await this.prisma.department.findMany({
      where: { schoolId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((d) => d.name.toLowerCase()));

    const toCreate: { schoolId: string; name: string; category: string; description: string }[] = [];
    for (const record of registeredDepartments) {
      const name = record.department?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (existingNames.has(key)) continue;
      existingNames.add(key);
      toCreate.push({ schoolId, name, category: 'STAFF_REGISTER', description: 'Imported from Staff Register' });
    }

    if (toCreate.length) {
      try {
        await this.prisma.department.createMany({ data: toCreate, skipDuplicates: true });
      } catch (err: any) {
        this.logger.warn(`Failed to import registered departments for school ${schoolId}: ${err.message}`);
      }
    }
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
