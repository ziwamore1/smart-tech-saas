import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getDefaultPermissions,
  hasResultsEntryRole,
  isPublicOnlyRoleSet,
  normalizeRole,
  Permission,
  PERMISSIONS,
  restrictToPublicData,
} from './permission-registry';
import { mapBounded } from '../utils/concurrency.util';

type AccessUser = {
  id: string;
  schoolId?: string;
  roles?: string[];
  isSuperAdmin?: boolean;
};

type ResultsEntryScope = { classId: string; subjectId: string; academicYearId: string };
type ResultsEntryIssue = ResultsEntryScope & { error?: string };

@Injectable()
export class ClassAccessService {
  // This endpoint fans out several reads per class; run classes one at a time
  // instead of queueing every class against the small production pool.
  private completionQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly prisma: PrismaService) {}

  private async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.completionQueue.then(task, task);
    this.completionQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  private roles(user: AccessUser): string[] {
    return (user.roles || []).map(normalizeRole);
  }

  /**
   * Merge roles from the JWT with active school role assignments from the
   * database. This makes access checks resilient to stale or empty JWT roles
   * (provisioned accounts, identity switches, tokens issued before a role was
   * assigned) by always consulting the source of truth for the school context.
   */
  private async effectiveRoles(user: AccessUser): Promise<string[]> {
    const roleNames = new Set(this.roles(user));
    if (user.schoolId) {
      const membership = await this.prisma.schoolUser.findFirst({
        where: { userId: user.id, schoolId: user.schoolId },
        include: { SchoolRoleAssignment: { where: { isActive: true }, select: { role: true } } },
      });
      for (const assignment of membership?.SchoolRoleAssignment || []) {
        roleNames.add(normalizeRole(assignment.role));
      }
    }
    return Array.from(roleNames);
  }

  async getPermissions(user: AccessUser, resolvedRoles?: string[]): Promise<Permission[]> {
    const roles = resolvedRoles ?? await this.effectiveRoles(user);
    const defaults = new Set(getDefaultPermissions(roles));
    if (!user.schoolId) return isPublicOnlyRoleSet(roles) ? restrictToPublicData(Array.from(defaults)) : Array.from(defaults);
    const membership = await this.prisma.schoolUser.findFirst({ where: { userId: user.id, schoolId: user.schoolId } });
    if (!membership) return isPublicOnlyRoleSet(roles) ? restrictToPublicData(Array.from(defaults)) : Array.from(defaults);
    let overrides: Array<{ permission: string; granted: boolean }> = [];
    try {
      overrides = await this.prisma.userPermissionOverride.findMany({
        where: { schoolMembershipId: membership.id },
        select: { permission: true, granted: true },
      });
    } catch (error) {
      // The permission-overrides table may not exist on databases where the
      // migration has not been applied yet. Fall back to role defaults so
      // access checks keep working instead of failing the whole request.
    }
    for (const override of overrides) {
      if (override.granted) defaults.add(override.permission as Permission);
      else defaults.delete(override.permission as Permission);
    }
    const permissions = Array.from(defaults);
    return isPublicOnlyRoleSet(roles) ? restrictToPublicData(permissions) : permissions;
  }

  private async isSchoolAdministrator(user: AccessUser, resolvedRoles?: string[]): Promise<boolean> {
    if (user.isSuperAdmin === true) return true;
    const roles = resolvedRoles ?? await this.effectiveRoles(user);
    return roles.some((role) => ['DIRECTOR', 'DEPUTY DIRECTOR', 'SUPERADMIN'].includes(role));
  }

  private async canEnterResultsAnywhere(user: AccessUser, resolvedRoles?: string[]): Promise<boolean> {
    if (user.isSuperAdmin === true) return true;
    const roles = resolvedRoles ?? await this.effectiveRoles(user);
    return hasResultsEntryRole(roles);
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
      select: { id: true, name: true, schoolId: true, levelTypeId: true, gradingSystemId: true, levelType: { select: { id: true, name: true } } },
      orderBy: [{ levelTypeId: 'asc' }, { order: 'asc' }],
    });
  }

  async teachingClasses(user: AccessUser, academicYearId?: string) {
    if (!user.schoolId) return [];
    if (await this.canEnterResultsAnywhere(user)) return this.schoolClasses(user, academicYearId);

    const yearFilter = academicYearId ? { academicYearId } : {};
    const delegated = await this.delegatedEntries(user, academicYearId);
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
      ...delegated.map(({ classId }) => classId),
    ]));
    if (!ids.length) {
      // No assignment rows. Fall back to all school classes when the user is
      // permitted to view classes / class students or enter results, so
      // teachers, class teachers and HODs granted access are not blocked by
      // missing or stale assignments.
      if (await this.canAccessClasses(user)) return this.schoolClasses(user, academicYearId);
      return [];
    }
    return this.prisma.class.findMany({
      where: { schoolId: user.schoolId, id: { in: ids } },
      select: { id: true, name: true, schoolId: true, levelTypeId: true, gradingSystemId: true, levelType: { select: { id: true, name: true } } },
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
    if (await this.canEnterResultsAnywhere(user)) return classSubjects.map(({ subject }) => subject);

    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId: user.id, schoolId: user.schoolId, classId, academicYearId: yearId },
      select: { subjectId: true },
    });
    const assignedIds = new Set(assignments.map(({ subjectId }) => subjectId));
    const delegated = await this.delegatedEntries(user, yearId, classId);
    const delegatedIds = new Set(delegated.map(({ subjectId }) => subjectId));
    const directEntryIds = await this.directEntrySubjectIds(classId, yearId);
    const hasClassAccess = await this.hasClassLevelAccess(user, classId, yearId);
    if (!hasClassAccess) {
      const anyAssignment = await this.prisma.teachingAssignment.findFirst({
        where: { teacherId: user.id, schoolId: user.schoolId, academicYearId: yearId },
        select: { id: true },
      });
      if (!anyAssignment && (await this.canAccessClasses(user))) {
        return classSubjects.map(({ subject }) => subject);
      }
      return [];
    }
    return classSubjects
      .filter(({ subject }) =>
        assignedIds.has(subject.id) ||
        delegatedIds.has(subject.id) ||
        directEntryIds.has(subject.id),
      )
      .map(({ subject }) => subject);
  }

  private async directEntrySubjectIds(classId: string, academicYearId: string): Promise<Set<string>> {
    const [classSubjects, weighted] = await Promise.all([
      this.prisma.classSubject.findMany({ where: { classId }, select: { subjectId: true } }),
      this.prisma.termAssessmentConfiguration.findMany({
        where: { classId, term: { academicYearId } },
        select: { subjectId: true },
        distinct: ['subjectId'],
      }),
    ]);
    const weightedIds = new Set(weighted.map(({ subjectId }) => subjectId));
    return new Set(classSubjects.map(({ subjectId }) => subjectId).filter((id) => !weightedIds.has(id)));
  }

  private async hasClassLevelAccess(
    user: AccessUser,
    classId: string,
    academicYearId: string,
    resolvedRoles?: string[],
  ): Promise<boolean> {
    if (await this.canEnterResultsAnywhere(user, resolvedRoles)) return true;
    const [subjectAssignment, classAssignment, directClass, delegated] = await Promise.all([
      this.prisma.teachingAssignment.findFirst({
        where: { teacherId: user.id, schoolId: user.schoolId, classId, academicYearId },
        select: { id: true },
      }),
      this.prisma.classTeacherAssignment.findFirst({
        where: { teacherId: user.id, schoolId: user.schoolId, classId, academicYearId, isActive: true },
        select: { id: true },
      }),
      this.prisma.class.findFirst({
        where: { id: classId, schoolId: user.schoolId, classTeacherId: user.id },
        select: { id: true },
      }),
      this.delegatedEntries(user, academicYearId, classId),
    ]);
    return !!(subjectAssignment || classAssignment || directClass || delegated.length > 0);
  }

  private dedupeScopes(entries: ResultsEntryScope[]): ResultsEntryScope[] {
    const seen = new Set<string>();
    return entries.filter((entry) => {
      const key = `${entry.classId}::${entry.subjectId}::${entry.academicYearId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Validate a whole score-entry batch with a fixed number of queries instead
   * of resolving roles, permissions and assignments once per score.
   */
  async checkResultsEntryAccessBatch(
    user: AccessUser,
    entries: ResultsEntryScope[],
  ): Promise<ResultsEntryIssue[]> {
    const scopes = this.dedupeScopes(entries);
    if (!scopes.length) return [];
    const withError = (error: string): ResultsEntryIssue[] => scopes.map(scope => ({ ...scope, error }));

    if (!user.schoolId) return withError('No school context is active');

    const roles = await this.effectiveRoles(user);
    if (isPublicOnlyRoleSet(roles)) {
      return withError('Non-teaching staff cannot access student results.');
    }

    const [classes, subjects, years] = await Promise.all([
      this.prisma.class.findMany({
        where: { id: { in: scopes.map(scope => scope.classId) }, schoolId: user.schoolId },
        select: { id: true },
      }),
      this.prisma.subject.findMany({
        where: { id: { in: scopes.map(scope => scope.subjectId) }, schoolId: user.schoolId },
        select: { id: true },
      }),
      this.prisma.academicYear.findMany({
        where: { id: { in: scopes.map(scope => scope.academicYearId) }, schoolId: user.schoolId },
        select: { id: true },
      }),
    ]);

    const classIds = new Set(classes.map(({ id }) => id));
    const subjectIds = new Set(subjects.map(({ id }) => id));
    const yearIds = new Set(years.map(({ id }) => id));
    const scopeIssues: ResultsEntryIssue[] = [];
    for (const scope of scopes) {
      if (!classIds.has(scope.classId)) {
        scopeIssues.push({ ...scope, error: 'This class belongs to a different school' });
      } else if (!subjectIds.has(scope.subjectId)) {
        scopeIssues.push({ ...scope, error: 'This subject belongs to a different school' });
      } else if (!yearIds.has(scope.academicYearId)) {
        scopeIssues.push({ ...scope, error: 'Invalid academic year' });
      }
    }
    if (scopeIssues.length) return scopeIssues;

    // Teachers (and school leaders) may enter results anywhere in their own
    // school. This also avoids an assignment lookup for every class/subject.
    if (await this.canEnterResultsAnywhere(user, roles)) return [];

    const issues = await mapBounded(scopes, async (scope) => {
      try {
        await this.assertRestrictedResultsEntry(user, roles, scope);
        return null;
      } catch (error: any) {
        return { ...scope, error: error.message } as ResultsEntryIssue;
      }
    }, 8);
    return issues.filter(Boolean) as ResultsEntryIssue[];
  }

  async assertCanEnterResultsBatch(user: AccessUser, entries: ResultsEntryScope[]) {
    const issues = await this.checkResultsEntryAccessBatch(user, entries);
    if (issues.length) throw new ForbiddenException(issues[0].error);
    return true;
  }

  async assertCanEnterResults(user: AccessUser, classId: string, subjectId: string, academicYearId: string) {
    return this.assertCanEnterResultsBatch(user, [{ classId, subjectId, academicYearId }]);
  }

  private async assertRestrictedResultsEntry(
    user: AccessUser,
    roles: string[],
    scope: ResultsEntryScope,
  ): Promise<boolean> {
    const { classId, subjectId, academicYearId } = scope;

    const subjectAssignment = await this.prisma.teachingAssignment.findFirst({
      where: { teacherId: user.id, schoolId: user.schoolId, classId, subjectId, academicYearId },
    });
    if (subjectAssignment) return true;

    if ((await this.delegatedEntries(user, academicYearId, classId, subjectId, roles)).length > 0) return true;

    const permissions = await this.getPermissions(user, roles);
    if (!permissions.includes(PERMISSIONS.RESULTS_ENTER)) {
      throw new ForbiddenException('You do not have permission to enter results. Contact the Director to request access for this class and subject.');
    }

    const directEntryIds = await this.directEntrySubjectIds(classId, academicYearId);
    if (directEntryIds.has(subjectId) && (await this.hasClassLevelAccess(user, classId, academicYearId, roles))) return true;

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

  async assertCanEnterAssessmentScoresBatch(
    user: AccessUser,
    entries: Array<{ studentId: string; assessmentTypeId: string }>,
  ) {
    if (!user.schoolId || !entries.length) return true;

    const assessmentTypeIds = [...new Set(entries.map(entry => entry.assessmentTypeId))];
    const studentIds = [...new Set(entries.map(entry => entry.studentId))];
    const [assessmentTypes, enrollments] = await Promise.all([
      this.prisma.assessmentType.findMany({
        where: { id: { in: assessmentTypeIds }, schoolId: user.schoolId },
        select: {
          id: true,
          subjectId: true,
          termId: true,
          schoolId: true,
          term: { select: { academicYearId: true } },
        },
      }),
      this.prisma.enrollment.findMany({
        where: {
          studentId: { in: studentIds },
          schoolId: user.schoolId,
          status: 'ACTIVE',
          student: { status: 'ACTIVE' },
        },
        select: { studentId: true, classId: true, academicYearId: true },
      }),
    ]);

    const typeMap = new Map(assessmentTypes.map(type => [type.id, type]));
    const enrollmentMap = new Map(
      enrollments.map(enrollment => [`${enrollment.studentId}::${enrollment.academicYearId}`, enrollment.classId]),
    );
    const scopes: ResultsEntryScope[] = [];
    for (const entry of entries) {
      const assessmentType = typeMap.get(entry.assessmentTypeId);
      if (!assessmentType || assessmentType.schoolId !== user.schoolId) {
        throw new ForbiddenException('Assessment does not belong to this school');
      }
      const classId = enrollmentMap.get(`${entry.studentId}::${assessmentType.term.academicYearId}`);
      if (!classId) throw new ForbiddenException('Student is not enrolled in this academic year');
      scopes.push({
        classId,
        subjectId: assessmentType.subjectId,
        academicYearId: assessmentType.term.academicYearId,
      });
    }

    return this.assertCanEnterResultsBatch(user, scopes);
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
    const studentIds = [...new Set(results.map((result) => result.studentId))];
    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId: user.schoolId, studentId: { in: studentIds }, ...(termId ? { academicYearId: results[0]?.term?.academicYearId } : {}) },
      select: { studentId: true, class: { select: { id: true, name: true } } },
    });
    const classes = new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment.class]));
    const legacyActivities = results.map((result) => ({
      id: result.id,
      score: result.score,
      timestamp: result.createdAt,
      teacher: result.teacher,
      subject: result.subject,
      student: result.student,
      term: result.term,
      class: classes.get(result.studentId) || null,
    }));

    // Component-based entry is stored in StudentAssessmentResult until a final
    // result is computed, so include it in live tracking as well.
    const componentResults = await this.prisma.studentAssessmentResult.findMany({
      where: {
        ...(termId ? { termId } : {}),
        OR: [{ rawScore: { not: null } }, { isAbsent: true }],
        class: { schoolId: user.schoolId },
        student: { status: 'ACTIVE' },
      },
      orderBy: { enteredAt: 'desc' },
      take: 30,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        term: { select: { id: true, name: true, academicYearId: true } },
        class: { select: { id: true, name: true } },
        assessmentDef: { select: { name: true, code: true } },
      },
    });
    const enteredByIds = [...new Set(componentResults.map((result) => result.enteredBy))];
    const enteredByUsers = await this.prisma.user.findMany({
      where: { id: { in: enteredByIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const teachers = new Map(enteredByUsers.map((teacher) => [teacher.id, teacher]));
    const componentActivities = componentResults.map((result) => {
      const teacher = teachers.get(result.enteredBy);
      return {
        id: result.id,
        score: result.isAbsent ? null : result.rawScore,
        timestamp: result.enteredAt,
        teacher,
        subject: result.subject,
        student: result.student,
        term: result.term,
        class: result.class,
        assessmentDef: result.assessmentDef,
      };
    });

    return [...legacyActivities, ...componentActivities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 30);
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
    return Promise.all(classes.map((classEntity) => this.runExclusive(async () => {
      const enrolled = await this.prisma.enrollment.count({ where: { schoolId: user.schoolId, classId: classEntity.id, academicYearId: term.academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } } });
      const enrolledFallback = await this.prisma.computedResult.findMany({ where: { schoolId: user.schoolId, classId: classEntity.id, termId: term.id, finalPercentage: { not: null }, student: { status: 'ACTIVE' } }, select: { studentId: true }, distinct: ['studentId'] }).then(r => r.length);
      const effectiveEnrolled = enrolled || enrolledFallback;
      const subjects = await Promise.all(classEntity.classSubjects.map(async ({ subjectId, subject }) => {
        const [entered, componentEntered, computedEntered] = await Promise.all([
          this.prisma.result.findMany({ where: { schoolId: user.schoolId, termId: term.id, subjectId, student: { status: 'ACTIVE', enrollments: { some: { classId: classEntity.id, academicYearId: term.academicYearId, status: 'ACTIVE' } } } }, select: { studentId: true }, distinct: ['studentId'] }),
          this.prisma.studentAssessmentResult.findMany({ where: { classId: classEntity.id, termId: term.id, subjectId, student: { status: 'ACTIVE' }, OR: [{ rawScore: { not: null } }, { isAbsent: true }] }, select: { studentId: true }, distinct: ['studentId'] }),
          this.prisma.computedResult.findMany({ where: { classId: classEntity.id, termId, subjectId, finalPercentage: { not: null }, student: { status: 'ACTIVE' } }, select: { studentId: true }, distinct: ['studentId'] }),
        ]);
        const enteredStudentIds = new Set([...entered, ...componentEntered, ...computedEntered].map((row) => row.studentId));
        const enteredCount = enteredStudentIds.size;
        return { ...subject, enteredCount, totalStudents: effectiveEnrolled, completionRate: effectiveEnrolled ? Math.round((enteredCount / effectiveEnrolled) * 100) : 0, complete: effectiveEnrolled > 0 && enteredCount >= effectiveEnrolled };
      }));
      const completeSubjects = subjects.filter((subject) => subject.complete).length;
      return { classId: classEntity.id, className: classEntity.name, totalStudents: effectiveEnrolled, totalSubjects: subjects.length, completeSubjects, completionRate: subjects.length ? Math.round((subjects.reduce((sum, subject) => sum + subject.completionRate, 0) / subjects.length)) : 0, complete: subjects.length > 0 && completeSubjects === subjects.length, subjects };
    })));
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
    const [overrides, resultEntryPermissions] = await Promise.all([
      this.prisma.userPermissionOverride.findMany({ where: { schoolMembershipId: membership.id }, select: { permission: true, granted: true } }),
      this.prisma.resultEntryPermission.findMany({ where: { schoolMembershipId: membership.id }, include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true, code: true } }, academicYear: { select: { id: true, name: true } } } }),
    ]);
    return { user, roles: membership.SchoolRoleAssignment.map(({ role }) => role), permissions, overrides, classes, assignments, resultEntryPermissions };
  }

  async saveUserPermissions(actor: AccessUser, userId: string, permissions: string[], resultEntryPermissions: Array<{ classId: string; subjectId: string; academicYearId: string }> = []) {
    if (!actor.schoolId) throw new ForbiddenException('No school context is active');
    const membership = await this.prisma.schoolUser.findFirst({ where: { userId, schoolId: actor.schoolId } });
    if (!membership) throw new NotFoundException('User is not a member of this school');
    const entries = resultEntryPermissions.filter((entry, index, all) => all.findIndex((item) => item.classId === entry.classId && item.subjectId === entry.subjectId && item.academicYearId === entry.academicYearId) === index);
    if (entries.length) {
      const [classes, subjects, years, links] = await Promise.all([
        this.prisma.class.findMany({ where: { schoolId: actor.schoolId, id: { in: entries.map((entry) => entry.classId) } }, select: { id: true } }),
        this.prisma.subject.findMany({ where: { schoolId: actor.schoolId, id: { in: entries.map((entry) => entry.subjectId) } }, select: { id: true } }),
        this.prisma.academicYear.findMany({ where: { schoolId: actor.schoolId, id: { in: entries.map((entry) => entry.academicYearId) } }, select: { id: true } }),
        this.prisma.classSubject.findMany({ where: { schoolId: actor.schoolId, classId: { in: entries.map((entry) => entry.classId) }, subjectId: { in: entries.map((entry) => entry.subjectId) } }, select: { classId: true, subjectId: true } }),
      ]);
      const validClasses = new Set(classes.map(({ id }) => id));
      const validSubjects = new Set(subjects.map(({ id }) => id));
      const validYears = new Set(years.map(({ id }) => id));
      const validLinks = new Set(links.map(({ classId, subjectId }) => `${classId}:${subjectId}`));
      if (entries.some((entry) => !validClasses.has(entry.classId) || !validSubjects.has(entry.subjectId) || !validYears.has(entry.academicYearId) || !validLinks.has(`${entry.classId}:${entry.subjectId}`))) {
        throw new ForbiddenException('Each delegated result-entry scope must belong to this school and an assigned class subject');
      }
    }
    const valid = new Set(Object.values(PERMISSIONS));
    const selected = new Set(permissions.filter((permission) => valid.has(permission as Permission)));
    const all = Object.values(PERMISSIONS);
    await this.prisma.$transaction(all.map((permission) => this.prisma.userPermissionOverride.upsert({
      where: { schoolMembershipId_permission: { schoolMembershipId: membership.id, permission } },
      create: { schoolMembershipId: membership.id, permission, granted: selected.has(permission), assignedBy: actor.id },
      update: { granted: selected.has(permission), assignedBy: actor.id },
    })));
    await this.prisma.resultEntryPermission.deleteMany({ where: { schoolMembershipId: membership.id } });
    if (selected.has(PERMISSIONS.RESULTS_DELEGATED_ENTRY) && entries.length) {
      await this.prisma.resultEntryPermission.createMany({ data: entries.map((entry) => ({ ...entry, schoolMembershipId: membership.id, assignedBy: actor.id })) });
    }
    return this.getUserAccess(actor, userId);
  }

  private async delegatedEntries(
    user: AccessUser,
    academicYearId?: string,
    classId?: string,
    subjectId?: string,
    rolesOverride?: string[],
  ) {
    if (!user.schoolId || !(await this.getPermissions(user, rolesOverride)).includes(PERMISSIONS.RESULTS_DELEGATED_ENTRY)) return [];
    const membership = await this.prisma.schoolUser.findFirst({ where: { userId: user.id, schoolId: user.schoolId }, select: { id: true } });
    if (!membership) return [];
    return this.prisma.resultEntryPermission?.findMany({ where: { schoolMembershipId: membership.id, ...(academicYearId ? { academicYearId } : {}), ...(classId ? { classId } : {}), ...(subjectId ? { subjectId } : {}) }, select: { classId: true, subjectId: true, academicYearId: true } }) || [];
  }
}
