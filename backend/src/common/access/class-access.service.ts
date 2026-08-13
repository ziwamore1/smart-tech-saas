import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getDefaultPermissions, normalizeRole, Permission, PERMISSIONS } from './permission-registry';

type AccessUser = {
  id: string;
  schoolId?: string;
  roles?: string[];
  isSuperAdmin?: boolean;
};

@Injectable()
export class ClassAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private roles(user: AccessUser): string[] {
    return (user.roles || []).map(normalizeRole);
  }

  async getPermissions(user: AccessUser): Promise<Permission[]> {
    const defaults = new Set(getDefaultPermissions(this.roles(user)));
    if (!user.schoolId) return Array.from(defaults);
    const membership = await this.prisma.schoolUser.findFirst({ where: { userId: user.id, schoolId: user.schoolId } });
    if (!membership) return Array.from(defaults);
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { schoolMembershipId: membership.id },
      select: { permission: true, granted: true },
    });
    for (const override of overrides) {
      if (override.granted) defaults.add(override.permission as Permission);
      else defaults.delete(override.permission as Permission);
    }
    return Array.from(defaults);
  }

  private isSchoolAdministrator(user: AccessUser): boolean {
    return user.isSuperAdmin === true || this.roles(user).some((role) =>
      ['DIRECTOR', 'SUPERADMIN'].includes(role),
    );
  }

  /**
   * True when the user is permitted to view classes / class students or enter
   * results (either by role defaults or an explicit permission grant).
   */
  async canAccessClasses(user: AccessUser): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return [
      PERMISSIONS.CLASS_VIEW,
      PERMISSIONS.CLASS_STUDENT_VIEW,
      PERMISSIONS.RESULTS_VIEW,
      PERMISSIONS.RESULTS_ENTER,
    ].some((permission) => permissions.includes(permission));
  }

  async schoolClasses(user: AccessUser, academicYearId?: string) {
    if (!user.schoolId) return [];
    const where: any = { schoolId: user.schoolId };
    return this.prisma.class.findMany({
      where,
      select: { id: true, name: true, schoolId: true, levelTypeId: true, levelType: { select: { id: true, name: true } } },
      orderBy: [{ levelTypeId: 'asc' }, { order: 'asc' }],
    });
  }

  async teachingClasses(user: AccessUser, academicYearId?: string) {
    if (!user.schoolId) return [];
    if (this.isSchoolAdministrator(user)) return this.schoolClasses(user, academicYearId);

    const yearFilter = academicYearId ? { academicYearId } : {};
    const [subjectAssignments, classAssignments, directClasses] = await Promise.all([
      this.prisma.teachingAssignment.findMany({
        where: { teacherId: user.id, schoolId: user.schoolId, ...yearFilter },
        select: { classId: true },
      }),
      this.prisma.classTeacherAssignment.findMany({
        where: { teacherId: user.id, schoolId: user.schoolId, isActive: true, ...yearFilter },
        select: { classId: true },
      }),
      this.prisma.class.findMany({
        where: { schoolId: user.schoolId, classTeacherId: user.id },
        select: { id: true },
      }),
    ]);
    const ids = Array.from(new Set([
      ...subjectAssignments.map(({ classId }) => classId),
      ...classAssignments.map(({ classId }) => classId),
      ...directClasses.map(({ id }) => id),
    ]));
    if (!ids.length) return [];
    return this.prisma.class.findMany({
      where: { schoolId: user.schoolId, id: { in: ids } },
      select: { id: true, name: true, schoolId: true, levelTypeId: true, levelType: { select: { id: true, name: true } } },
      orderBy: [{ levelTypeId: 'asc' }, { order: 'asc' }],
    });
  }

  async teachingSubjects(user: AccessUser, classId: string, academicYearId?: string) {
    if (!user.schoolId) return [];
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, schoolId: true },
    });
    if (!classEntity || classEntity.schoolId !== user.schoolId) {
      throw new NotFoundException('Class not found');
    }
    const yearId = academicYearId || (await this.prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true },
      select: { id: true },
    }))?.id;
    if (!yearId) return [];

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId, schoolId: user.schoolId },
      select: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    });
    if (this.isSchoolAdministrator(user)) return classSubjects.map(({ subject }) => subject);

    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId: user.id, schoolId: user.schoolId, classId, academicYearId: yearId },
      select: { subjectId: true },
    });
    const assignedIds = new Set(assignments.map(({ subjectId }) => subjectId));
    return classSubjects
      .filter(({ subject }) => assignedIds.has(subject.id))
      .map(({ subject }) => subject);
  }

  async assertCanEnterResults(user: AccessUser, classId: string, subjectId: string, academicYearId: string) {
    if (!user.schoolId) throw new ForbiddenException('No school context is active');
    const permissions = await this.getPermissions(user);
    if (!permissions.includes(PERMISSIONS.RESULTS_ENTER)) {
      throw new ForbiddenException('You do not have permission to enter results');
    }
    const [classEntity, subject, year] = await Promise.all([
      this.prisma.class.findUnique({ where: { id: classId }, select: { id: true, schoolId: true } }),
      this.prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, schoolId: true } }),
      this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true, schoolId: true } }),
    ]);
    if (!classEntity || classEntity.schoolId !== user.schoolId) throw new ForbiddenException('This class belongs to a different school');
    if (!subject || subject.schoolId !== user.schoolId) throw new ForbiddenException('This subject belongs to a different school');
    if (!year || year.schoolId !== user.schoolId) throw new ForbiddenException('Invalid academic year');
    const subjectAssignment = await this.prisma.teachingAssignment.findFirst({
      where: { teacherId: user.id, schoolId: user.schoolId, classId, subjectId, academicYearId },
    });
    if (subjectAssignment) return true;

    // No assignment for this exact class+subject. Fall back to the permission
    // grant when the user has no teaching assignments at all in this academic
    // year (i.e. the school has not set up assignments, so RESULTS_ENTER is the
    // gate). This keeps the results-entry flow usable for teachers, class
    // teachers and HODs that were granted access but have no assignment rows.
    const anyAssignment = await this.prisma.teachingAssignment.findFirst({
      where: { teacherId: user.id, schoolId: user.schoolId, academicYearId },
      select: { id: true },
    });
    if (!anyAssignment) return true;

    throw new ForbiddenException('You are not assigned to enter results for this class and subject');
  }

  async assertCanEnterAssessmentScore(
    user: AccessUser,
    studentId: string,
    assessmentTypeId: string,
  ) {
    const assessment = await this.prisma.assessmentType.findUnique({
      where: { id: assessmentTypeId },
      select: { subjectId: true, termId: true, schoolId: true, term: { select: { academicYearId: true } } },
    });
    if (!assessment || assessment.schoolId !== user.schoolId) {
      throw new ForbiddenException('Assessment does not belong to this school');
    }
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        schoolId: user.schoolId,
        academicYearId: assessment.term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      select: { classId: true },
    });
    if (!enrollment) throw new ForbiddenException('Student is not enrolled in this academic year');
    return this.assertCanEnterResults(user, enrollment.classId, assessment.subjectId, assessment.term.academicYearId);
  }

  async diagnose(user: AccessUser, academicYearId?: string) {
    const [schoolClasses, assignedClasses] = await Promise.all([
      this.schoolClasses(user, academicYearId),
      this.teachingClasses(user, academicYearId),
    ]);
    return {
      schoolId: user.schoolId,
      roles: user.roles || [],
      permissions: await this.getPermissions(user),
      schoolClasses,
      assignedClasses,
      academicYearId: academicYearId || null,
    };
  }

  async liveResults(user: AccessUser, termId?: string) {
    if (!user.schoolId) throw new ForbiddenException('No school context is active');
    const results = await this.prisma.result.findMany({
      where: { schoolId: user.schoolId, ...(termId ? { termId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true, code: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        term: { select: { id: true, name: true, academicYearId: true } },
      },
    });
    const classIds = [...new Set(results.map((result) => result.studentId))];
    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId: user.schoolId, studentId: { in: classIds }, ...(termId ? { academicYearId: results[0]?.term?.academicYearId } : {}) },
      select: { studentId: true, class: { select: { id: true, name: true } } },
    });
    const classes = new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment.class]));
    return results.map((result) => ({
      id: result.id,
      score: result.score,
      timestamp: result.createdAt,
      teacher: result.teacher,
      subject: result.subject,
      student: result.student,
      term: result.term,
      class: classes.get(result.studentId) || null,
    }));
  }

  async resultsCompletion(user: AccessUser, termId?: string) {
    if (!user.schoolId) throw new ForbiddenException('No school context is active');
    const term = termId
      ? await this.prisma.term.findFirst({ where: { id: termId, academicYear: { schoolId: user.schoolId } }, select: { id: true, academicYearId: true } })
      : await this.prisma.term.findFirst({ where: { isCurrent: true, academicYear: { schoolId: user.schoolId } }, select: { id: true, academicYearId: true } });
    if (!term) return [];
    const classes = await this.prisma.class.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, name: true, classSubjects: { select: { subjectId: true, subject: { select: { id: true, name: true, code: true } } } } },
      orderBy: { name: 'asc' },
    });
    return Promise.all(classes.map(async (classEntity) => {
      const enrolled = await this.prisma.enrollment.count({ where: { schoolId: user.schoolId, classId: classEntity.id, academicYearId: term.academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } } });
      const subjects = await Promise.all(classEntity.classSubjects.map(async ({ subjectId, subject }) => {
        const entered = await this.prisma.result.findMany({ where: { schoolId: user.schoolId, termId: term.id, subjectId, student: { status: 'ACTIVE', enrollments: { some: { classId: classEntity.id, academicYearId: term.academicYearId, status: 'ACTIVE' } } } }, select: { studentId: true }, distinct: ['studentId'] });
        const enteredCount = entered.length;
        return { ...subject, enteredCount, totalStudents: enrolled, completionRate: enrolled ? Math.round((enteredCount / enrolled) * 100) : 0, complete: enrolled > 0 && enteredCount >= enrolled };
      }));
      const completeSubjects = subjects.filter((subject) => subject.complete).length;
      return { classId: classEntity.id, className: classEntity.name, totalStudents: enrolled, totalSubjects: subjects.length, completeSubjects, completionRate: subjects.length ? Math.round((subjects.reduce((sum, subject) => sum + subject.completionRate, 0) / subjects.length)) : 0, complete: subjects.length > 0 && completeSubjects === subjects.length, subjects };
    }));
  }

  async getUserAccess(actor: AccessUser, userId: string) {
    if (!actor.schoolId) throw new ForbiddenException('No school context is active');
    const membership = await this.prisma.schoolUser.findFirst({
      where: { userId, schoolId: actor.schoolId },
      include: { SchoolRoleAssignment: { where: { isActive: true }, select: { role: true } } },
    });
    if (!membership) throw new NotFoundException('User is not a member of this school');
    const [user, permissions, classes, assignments] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true } }),
      this.getPermissions({ id: userId, schoolId: actor.schoolId, roles: membership.SchoolRoleAssignment.map(({ role }) => role) }),
      this.schoolClasses(actor),
      this.prisma.teachingAssignment.findMany({ where: { teacherId: userId, schoolId: actor.schoolId }, select: { classId: true, subjectId: true, academicYearId: true } }),
    ]);
    const overrides = await this.prisma.userPermissionOverride.findMany({ where: { schoolMembershipId: membership.id }, select: { permission: true, granted: true } });
    return { user, roles: membership.SchoolRoleAssignment.map(({ role }) => role), permissions, overrides, classes, assignments };
  }

  async saveUserPermissions(actor: AccessUser, userId: string, permissions: string[]) {
    if (!actor.schoolId) throw new ForbiddenException('No school context is active');
    const membership = await this.prisma.schoolUser.findFirst({ where: { userId, schoolId: actor.schoolId } });
    if (!membership) throw new NotFoundException('User is not a member of this school');
    const valid = new Set(Object.values(PERMISSIONS));
    const selected = new Set(permissions.filter((permission) => valid.has(permission as Permission)));
    const all = Object.values(PERMISSIONS);
    await this.prisma.$transaction(all.map((permission) => this.prisma.userPermissionOverride.upsert({
      where: { schoolMembershipId_permission: { schoolMembershipId: membership.id, permission } },
      create: { schoolMembershipId: membership.id, permission, granted: selected.has(permission), assignedBy: actor.id },
      update: { granted: selected.has(permission), assignedBy: actor.id },
    })));
    return this.getUserAccess(actor, userId);
  }
}
