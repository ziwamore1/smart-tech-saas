import { Controller, Get, Head } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async check() {
    return this.healthService.check();
  }

  @Get('detailed')
  async checkDetailed() {
    return this.healthService.checkDetailed();
  }

  @Get('prisma-test')
  async prismaTest() {
    const start = Date.now();
    try {
      const schoolCount = await this.prisma.school.count();
      const userCount = await this.prisma.user.count();
      const studentCount = await this.prisma.student.count();
      const classCount = await this.prisma.class.count();
      return {
        status: 'ok',
        latencyMs: Date.now() - start,
        counts: { schools: schoolCount, users: userCount, students: studentCount, classes: classCount },
      };
    } catch (error: any) {
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        message: error?.message,
        code: error?.code,
      };
    }
  }

  @Get('student-query-test')
  async studentQueryTest() {
    const results: Record<string, any> = {};

    try {
      const colCheck = await this.prisma.$queryRawUnsafe<{column_name: string}[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'Student' AND column_name IN ('grade', 'className')`
      );
      results.columns = colCheck.map(c => c.column_name);
    } catch (e: any) {
      results.columns = 'ERROR: ' + e.message;
    }

    try {
      const t = Date.now();
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, "firstName", "lastName" FROM "Student" LIMIT 3`
      );
      results.rawSql = { ok: true, ms: Date.now() - t, rows };
    } catch (e: any) {
      results.rawSql = { ok: false, error: e.message };
    }

    try {
      const t = Date.now();
      const alter = await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "grade" TEXT`
      );
      results.alterGrade = { ok: true, ms: Date.now() - t, result: alter };
    } catch (e: any) {
      results.alterGrade = { ok: false, error: e.message };
    }

    try {
      const t = Date.now();
      const alter = await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "className" TEXT`
      );
      results.alterClassName = { ok: true, ms: Date.now() - t, result: alter };
    } catch (e: any) {
      results.alterClassName = { ok: false, error: e.message };
    }

    try {
      const t = Date.now();
      const rows = await Promise.race([
        this.prisma.student.findMany({ where: { schoolId: '40a1039f-e292-4e91-948d-05848ac2ad89' }, take: 3, select: { id: true, firstName: true } }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 8000)),
      ]);
      results.findManySelect = { ok: true, ms: Date.now() - t, count: (rows as any[]).length };
    } catch (e: any) {
      results.findManySelect = { ok: false, error: e.message };
    }

    try {
      const t = Date.now();
      const rows = await Promise.race([
        this.prisma.student.findMany({ where: { schoolId: '40a1039f-e292-4e91-948d-05848ac2ad89' }, take: 3 }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 8000)),
      ]);
      results.findManyAll = { ok: true, ms: Date.now() - t, count: (rows as any[]).length };
    } catch (e: any) {
      results.findManyAll = { ok: false, error: e.message };
    }

    const schoolId = '40a1039f-e292-4e91-948d-05848ac2ad89';

    try {
      const t = Date.now();
      const rows = await Promise.race([
        this.prisma.student.findMany({
          where: { schoolId },
          select: {
            id: true, admissionNumber: true, studentUuid: true, status: true,
            dateOfBirth: true, schoolId: true, firstName: true, lastName: true,
            gender: true, photoUrl: true, photoPublicId: true, createdAt: true, updatedAt: true,
            enrollments: {
              include: { class: true, academicYear: true },
              orderBy: { academicYear: { startDate: 'desc' } as any },
            },
            parents: { include: { parent: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 10000)),
      ]);
      results.fullFindAll = { ok: true, ms: Date.now() - t, count: (rows as any[]).length };
    } catch (e: any) {
      results.fullFindAll = { ok: false, error: e.message };
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT DISTINCT status, COUNT(*)::int as count FROM "Student" WHERE "schoolId" = $1 GROUP BY status`, schoolId
      );
      results.statusBreakdown = rows;
    } catch (e: any) {
      results.statusBreakdown = 'ERROR: ' + e.message;
    }

    try {
      const t = Date.now();
      const rows = await Promise.race([
        this.prisma.student.findMany({
          where: { schoolId, status: 'ACTIVE' as any },
          take: 3,
          select: { id: true, firstName: true, status: true },
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 8000)),
      ]);
      results.activeFilter = { ok: true, ms: Date.now() - t, count: (rows as any[]).length, rows };
    } catch (e: any) {
      results.activeFilter = { ok: false, error: e.message };
    }

    return results;
  }

  @Get('class-teacher-test')
  async classTeacherTest() {
    const schoolId = '40a1039f-e292-4e91-948d-05848ac2ad89';
    const results: Record<string, any> = {};

    try {
      const classes = await this.prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, classTeacherId: true },
      });
      results.classes = classes;
    } catch (e: any) {
      results.classes = 'ERROR: ' + e.message;
    }

    try {
      const users = await this.prisma.user.findMany({
        where: { schoolId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      results.users = users.map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email }));
    } catch (e: any) {
      results.users = 'ERROR: ' + e.message;
    }

    try {
      const teachers = await this.prisma.teacher.findMany({
        where: { schoolId },
        select: { id: true, userId: true, employeeNo: true },
      });
      results.teacherRecords = teachers;
    } catch (e: any) {
      results.teacherRecords = 'ERROR: ' + e.message;
    }

    try {
      const roles = await this.prisma.role.findMany({
        select: { id: true, name: true },
      });
      results.roles = roles;
    } catch (e: any) {
      results.roles = 'ERROR: ' + e.message;
    }

    try {
      const userRoles = await this.prisma.userRole.findMany({
        where: { user: { schoolId } },
        select: { id: true, userId: true, role: { select: { id: true, name: true } } },
      });
      results.userRoles = userRoles;
    } catch (e: any) {
      results.userRoles = 'ERROR: ' + e.message;
    }

    if (results.classes?.length > 0 && results.users?.length > 0) {
      const testClassId = results.classes[0].id;
      const testUserId = results.users[0].id;
      try {
        const testResult = await this.prisma.class.update({
          where: { id: testClassId },
          data: { classTeacherId: testUserId },
          include: { classTeacher: { select: { id: true, firstName: true, lastName: true } } },
        });
        results.testUpdate = { ok: true, classId: testClassId, teacherId: testUserId, classTeacher: testResult.classTeacher };
        await this.prisma.class.update({
          where: { id: testClassId },
          data: { classTeacherId: null },
        });
      } catch (e: any) {
        results.testUpdate = { ok: false, error: e.message, code: e.code };
      }
    }

    return results;
  }

  @Get('fix-orphaned-teacher')
  async fixOrphanedTeacher() {
    const schoolId = '40a1039f-e292-4e91-948d-05848ac2ad89';
    const results: Record<string, any> = {};

    try {
      const orphaned = await this.prisma.teacher.findMany({
        where: { schoolId },
        select: { id: true, userId: true, employeeNo: true, schoolId: true },
      });

      for (const t of orphaned) {
        const user = await this.prisma.user.findUnique({ where: { id: t.userId } });
        if (!user) {
          const email = `teacher_${t.employeeNo || t.id.slice(0, 8)}@smarttech.edu`;
          const bcrypt = require('bcrypt');
          const hashedPassword = await bcrypt.hash('Teacher123!', 10);

          const newUser = await this.prisma.user.create({
            data: {
              id: t.userId,
              email,
              password: hashedPassword,
              firstName: 'JACKSON',
              lastName: 'MWANZA',
              schoolId,
            },
          });

          const teacherRole = await this.prisma.role.findFirst({
            where: { name: { equals: 'Teacher', mode: 'insensitive' } },
          });
          if (teacherRole) {
            await this.prisma.userRole.create({
              data: { userId: newUser.id, roleId: teacherRole.id },
            });
          }

          results.repaired = { teacherId: t.id, userId: t.userId, email, name: 'JACKSON MWANZA' };
        } else {
          const updates: any = {};
          if (!user.schoolId) updates.schoolId = schoolId;
          if (Object.keys(updates).length > 0) {
            await this.prisma.user.update({ where: { id: t.userId }, data: updates });
            results.repaired = { teacherId: t.id, userId: t.userId, fixed: updates };
          } else {
            results.repaired = { teacherId: t.id, userId: t.userId, status: 'user exists and is healthy' };
          }
        }
      }

      if (orphaned.length === 0) {
        results.repaired = 'no teachers found';
      }
    } catch (e: any) {
      results.error = e.message;
    }

    return results;
  }

  @Get('fix-ecz-g7-grading')
  async fixEczG7Grading() {
    const results: Record<string, any> = { updated: [], skipped: [], errors: [] };

    const correctScales = [
      { grade: 'One', points: 1, minScore: 75, maxScore: 100, remark: 'Excellent' },
      { grade: 'Two', points: 2, minScore: 60, maxScore: 74, remark: 'Very Good' },
      { grade: 'Three', points: 3, minScore: 50, maxScore: 59, remark: 'Good' },
      { grade: 'Four', points: 4, minScore: 40, maxScore: 49, remark: 'Satisfactory' },
      { grade: 'Five', points: 5, minScore: 0, maxScore: 39, remark: 'Fail' },
    ];

    try {
      const systems = await this.prisma.gradingSystem.findMany({
        where: { name: 'ECZ Grade 7 Grading System' },
        include: { gradeScales: true },
      });

      for (const system of systems) {
        const needsUpdate = system.gradeScales.some((s) => {
          const correct = correctScales.find((c) => c.grade === s.grade);
          return !correct || s.minScore !== correct.minScore || s.maxScore !== correct.maxScore || s.points !== correct.points;
        });

        if (!needsUpdate) {
          results.skipped.push({ schoolId: system.schoolId, systemId: system.id });
          continue;
        }

        try {
          await this.prisma.gradeScale.deleteMany({ where: { gradingSystemId: system.id } });
          await this.prisma.gradeScale.createMany({
            data: correctScales.map((s) => ({ gradingSystemId: system.id, ...s })),
          });
          results.updated.push({ schoolId: system.schoolId, systemId: system.id });
        } catch (e: any) {
          results.errors.push({ schoolId: system.schoolId, error: e.message });
        }
      }

      const policies = await this.prisma.gradingPolicy.findMany({
        where: { code: 'ECZ_G7' },
        include: { scales: true },
      });

      for (const policy of policies) {
        const needsUpdate = policy.scales.some((s) => {
          const correct = correctScales.find((c) => c.grade === s.grade);
          return !correct || s.minScore !== correct.minScore || s.maxScore !== correct.maxScore || s.points !== correct.points;
        });

        if (!needsUpdate) continue;

        try {
          await this.prisma.gradingScale.deleteMany({ where: { policyId: policy.id } });
          await this.prisma.gradingScale.createMany({
            data: correctScales.map((s, i) => ({
              policyId: policy.id,
              minScore: s.minScore,
              maxScore: s.maxScore,
              grade: s.grade,
              remark: s.remark,
              points: s.points,
              gpa: [5.0, 4.0, 3.0, 2.0, 0][i],
              sortOrder: i + 1,
            })),
          });
          results.updated.push({ policyId: policy.id, schoolId: policy.schoolId });
        } catch (e: any) {
          results.errors.push({ policyId: policy.id, error: e.message });
        }
      }
    } catch (e: any) {
      results.fatalError = e.message;
    }

    results.summary = `${results.updated.length} updated, ${results.skipped.length} skipped, ${results.errors.length} errors`;
    return results;
  }

  @Get('migrate-identity')
  async migrateIdentity() {
    const results: Record<string, any> = {
      schoolUsers: { created: 0, skipped: 0 },
      schoolRoleAssignments: { created: 0, skipped: 0 },
      platformRoleAssignments: { created: 0, skipped: 0 },
      classTeacherAssignments: { created: 0, skipped: 0 },
      errors: [],
    };

    try {
      // Step 1: Create SchoolUser records for users with schoolId
      const usersWithSchool = await this.prisma.user.findMany({
        where: { schoolId: { not: null }, schoolUsers: { none: {} } },
        select: { id: true, schoolId: true },
      });
      for (const user of usersWithSchool) {
        try {
          await this.prisma.schoolUser.create({
            data: { userId: user.id, schoolId: user.schoolId!, isPrimary: true },
          });
          results.schoolUsers.created++;
        } catch { results.schoolUsers.skipped++; }
      }

      // Step 2: Create SchoolRoleAssignment from existing UserRole
      const schoolRoleNames = ['Director', 'Deputy Director', 'Head Teacher', 'Deputy', 'Teacher', 'Class Teacher', 'HOD', 'Accountant', 'Secretary', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'];
      const userRoles = await this.prisma.userRole.findMany({
        include: { role: true, user: { select: { schoolId: true } } },
        where: { user: { schoolId: { not: null } } },
      });
      for (const ur of userRoles) {
        if (!schoolRoleNames.includes(ur.role.name) || !ur.user.schoolId) continue;
        const membership = await this.prisma.schoolUser.findFirst({
          where: { userId: ur.userId, schoolId: ur.user.schoolId },
        });
        if (!membership) continue;
        const existing = await this.prisma.schoolRoleAssignment.findFirst({
          where: { schoolMembershipId: membership.id, role: ur.role.name },
        });
        if (existing) { results.schoolRoleAssignments.skipped++; continue; }
        try {
          await this.prisma.schoolRoleAssignment.create({
            data: { schoolMembershipId: membership.id, role: ur.role.name, isActive: true },
          });
          results.schoolRoleAssignments.created++;
        } catch { results.schoolRoleAssignments.skipped++; }
      }

      // Step 3: PlatformRoleAssignment for SuperAdmin
      const superAdminRole = await this.prisma.role.findFirst({
        where: { name: { equals: 'SuperAdmin', mode: 'insensitive' } },
      });
      if (superAdminRole) {
        const superAdmins = await this.prisma.userRole.findMany({
          where: { roleId: superAdminRole.id },
          select: { userId: true },
        });
        for (const ur of superAdmins) {
          const existing = await this.prisma.platformRoleAssignment.findFirst({
            where: { userId: ur.userId, role: 'SuperAdmin' },
          });
          if (existing) { results.platformRoleAssignments.skipped++; continue; }
          try {
            await this.prisma.platformRoleAssignment.create({
              data: { userId: ur.userId, role: 'SuperAdmin', isActive: true },
            });
            results.platformRoleAssignments.created++;
          } catch { results.platformRoleAssignments.skipped++; }
        }
      }

      // Step 4: ClassTeacherAssignment from Class.classTeacherId
      const classesWithTeacher = await this.prisma.class.findMany({
        where: { classTeacherId: { not: null } },
        select: { id: true, classTeacherId: true, schoolId: true },
      });
      for (const cls of classesWithTeacher) {
        if (!cls.classTeacherId) continue;
        const currentYear = await this.prisma.academicYear.findFirst({
          where: { schoolId: cls.schoolId, isCurrent: true },
        });
        if (!currentYear) continue;
        const existing = await this.prisma.classTeacherAssignment.findFirst({
          where: { teacherId: cls.classTeacherId, classId: cls.id, academicYearId: currentYear.id },
        });
        if (existing) { results.classTeacherAssignments.skipped++; continue; }
        try {
          await this.prisma.classTeacherAssignment.create({
            data: {
              teacherId: cls.classTeacherId,
              classId: cls.id,
              academicYearId: currentYear.id,
              schoolId: cls.schoolId,
              isPrimary: true,
              isActive: true,
            },
          });
          results.classTeacherAssignments.created++;
        } catch { results.classTeacherAssignments.skipped++; }
      }

    } catch (e: any) {
      results.fatalError = e.message;
    }

    return results;
  }

  @Get('backfill-identity-data')
  async backfillIdentityData() {
    const results = {
      schoolUsers: { created: 0, skipped: 0 },
      schoolRoles: { created: 0, skipped: 0 },
      userSchoolIds: { fixed: 0, skipped: 0 },
    };

    try {
      // Step 1: Create SchoolUser records for users with schoolId but no SchoolUser
      const usersNeedingSchoolUser = await this.prisma.user.findMany({
        where: {
          schoolId: { not: null },
          schoolUsers: { none: {} },
        },
        select: { id: true, schoolId: true },
      });

      for (const user of usersNeedingSchoolUser) {
        try {
          const membership = await this.prisma.schoolUser.create({
            data: { userId: user.id, schoolId: user.schoolId!, isPrimary: true },
          });
          results.schoolUsers.created++;
        } catch {
          results.schoolUsers.skipped++;
        }
      }

      // Step 2: Create SchoolRoleAssignment from existing UserRole records
      const userRoles = await this.prisma.userRole.findMany({
        include: { role: true, user: { select: { schoolId: true } } },
        where: { user: { schoolId: { not: null } } },
      });

      const schoolRoleNames = ['Director', 'Deputy Director', 'Head Teacher', 'Deputy', 'Teacher', 'Class Teacher', 'HOD', 'Accountant', 'Secretary', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'];

      for (const ur of userRoles) {
        if (!schoolRoleNames.includes(ur.role.name)) continue;
        if (!ur.user.schoolId) continue;

        const membership = await this.prisma.schoolUser.findFirst({
          where: { userId: ur.userId, schoolId: ur.user.schoolId },
        });
        if (!membership) continue;

        const existing = await this.prisma.schoolRoleAssignment.findFirst({
          where: { schoolMembershipId: membership.id, role: ur.role.name },
        });
        if (existing) { results.schoolRoles.skipped++; continue; }

        try {
          await this.prisma.schoolRoleAssignment.create({
            data: { schoolMembershipId: membership.id, role: ur.role.name, isActive: true },
          });
          results.schoolRoles.created++;
        } catch {
          results.schoolRoles.skipped++;
        }
      }

      // Step 3: Fix users with SchoolUser but no schoolId on User record
      const memberships = await this.prisma.schoolUser.findMany({
        where: { user: { schoolId: null } },
        select: { userId: true, schoolId: true, isPrimary: true },
      });

      const primaryMemberships = new Map<string, string>();
      for (const m of memberships) {
        if (!primaryMemberships.has(m.userId)) {
          primaryMemberships.set(m.userId, m.schoolId);
        }
        if (m.isPrimary) {
          primaryMemberships.set(m.userId, m.schoolId);
        }
      }

      for (const [userId, schoolId] of primaryMemberships) {
        try {
          await this.prisma.user.update({ where: { id: userId }, data: { schoolId } });
          results.userSchoolIds.fixed++;
        } catch {
          results.userSchoolIds.skipped++;
        }
      }
    } catch (e: any) {
      (results as any).fatalError = e.message;
    }

    return results;
  }

  @Get('diagnose-identity')
  async diagnoseIdentity() {
    const results: Record<string, any> = {};

    // 1. Count all users with schoolId vs null
    const usersWithSchoolId = await this.prisma.user.count({ where: { schoolId: { not: null } } });
    const usersWithoutSchoolId = await this.prisma.user.count({ where: { schoolId: null } });
    results.userSchoolIdBreakdown = { withSchoolId: usersWithSchoolId, withoutSchoolId: usersWithoutSchoolId };

    // 2. Count SchoolUser records
    const schoolUserCount = await this.prisma.schoolUser.count();
    results.schoolUserCount = schoolUserCount;

    // 3. For each school, show user counts by different methods
    const schools = await this.prisma.school.findMany({ select: { id: true, name: true } });
    results.schools = [];

    for (const school of schools) {
      const userCountBySchoolId = await this.prisma.user.count({ where: { schoolId: school.id } });
      const userCountBySchoolUser = await this.prisma.schoolUser.count({ where: { schoolId: school.id } });
      const userCountByTeacher = await this.prisma.teacher.count({ where: { schoolId: school.id } });
      const userCountByUserRole = await this.prisma.userRole.count({
        where: { user: { OR: [{ schoolId: school.id }, { schoolUsers: { some: { schoolId: school.id } } }] } },
      });

      // Users who would appear in Password Hub (schoolId match OR SchoolUser match)
      const usersInPasswordHub = await this.prisma.user.count({
        where: { OR: [{ schoolId: school.id }, { schoolUsers: { some: { schoolId: school.id } } }] },
      });

      results.schools.push({
        id: school.id,
        name: school.name,
        userCountBySchoolId,
        userCountBySchoolUser,
        userCountByTeacher,
        userCountByUserRole,
        usersInPasswordHub,
        gap: userCountByTeacher - usersInPasswordHub,
      });
    }

    // 4. Users with Teacher records but no User.schoolId
    const teachersWithoutSchoolId = await this.prisma.teacher.findMany({
      where: { user: { schoolId: null } },
      select: { id: true, userId: true, schoolId: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    results.teachersWithUserSchoolIdNull = teachersWithoutSchoolId.length;
    results.teachersWithUserSchoolIdNullSample = teachersWithoutSchoolId.slice(0, 10);

    // 5. Users with SchoolUser but schoolId is null on User
    const usersWithSchoolUserButNullSchoolId = await this.prisma.user.count({
      where: { schoolId: null, schoolUsers: { some: {} } },
    });
    results.usersWithSchoolUserButNullSchoolId = usersWithSchoolUserButNullSchoolId;

    return results;
  }

  @Get('fix-identity-comprehensive')
  async fixIdentityComprehensive() {
    const results: Record<string, any> = {
      userSchoolIdsFixed: 0,
      schoolUsersCreated: 0,
      schoolRoleAssignmentsCreated: 0,
      errors: [],
    };

    try {
      // Step 1: Fix User.schoolId from Teacher records
      const teachersWithSchool = await this.prisma.teacher.findMany({
        where: { user: { schoolId: null } },
        select: { userId: true, schoolId: true },
      });
      for (const t of teachersWithSchool) {
        if (!t.schoolId) continue;
        try {
          await this.prisma.user.update({ where: { id: t.userId }, data: { schoolId: t.schoolId } });
          results.userSchoolIdsFixed++;
        } catch (e: any) {
          results.errors.push({ step: 'fixUserSchoolId', userId: t.userId, error: e.message });
        }
      }

      // Step 2: Create SchoolUser for all users with schoolId but no SchoolUser
      const usersNeedingSchoolUser = await this.prisma.user.findMany({
        where: { schoolId: { not: null }, schoolUsers: { none: {} } },
        select: { id: true, schoolId: true },
      });
      for (const u of usersNeedingSchoolUser) {
        try {
          await this.prisma.schoolUser.create({
            data: { userId: u.id, schoolId: u.schoolId!, isPrimary: true },
          });
          results.schoolUsersCreated++;
        } catch (e: any) {
          results.errors.push({ step: 'createSchoolUser', userId: u.id, error: e.message });
        }
      }

      // Step 3: Create SchoolRoleAssignment from existing UserRole records
      const schoolRoleNames = ['Director', 'Deputy Director', 'Head Teacher', 'Deputy', 'Teacher', 'Class Teacher', 'HOD', 'Accountant', 'Secretary', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'];
      const userRoles = await this.prisma.userRole.findMany({
        include: { role: true, user: { select: { schoolId: true } } },
        where: { user: { schoolId: { not: null } } },
      });
      for (const ur of userRoles) {
        if (!schoolRoleNames.includes(ur.role.name)) continue;
        const membership = await this.prisma.schoolUser.findFirst({
          where: { userId: ur.userId, schoolId: ur.user.schoolId! },
        });
        if (!membership) continue;
        const existing = await this.prisma.schoolRoleAssignment.findFirst({
          where: { schoolMembershipId: membership.id, role: ur.role.name },
        });
        if (existing) continue;
        try {
          await this.prisma.schoolRoleAssignment.create({
            data: { schoolMembershipId: membership.id, role: ur.role.name, isActive: true },
          });
          results.schoolRoleAssignmentsCreated++;
        } catch (e: any) {
          results.errors.push({ step: 'createSchoolRoleAssignment', membershipId: membership.id, error: e.message });
        }
      }

    } catch (e: any) {
      results.fatalError = e.message;
    }

    results.summary = `userSchoolIdsFixed: ${results.userSchoolIdsFixed}, schoolUsersCreated: ${results.schoolUsersCreated}, schoolRoleAssignmentsCreated: ${results.schoolRoleAssignmentsCreated}, errors: ${results.errors.length}`;
    return results;
  }

  @Get('backfill-published-results')
  async backfillPublishedResults() {
    const results: Record<string, any> = {
      sheetsFixed: 0,
      computedResultsUpdated: 0,
      sheets: [],
      errors: [],
    };

    try {
      // Find all ResultSheets that are PUBLISHED but their ComputedResults might not be
      const publishedSheets = await this.prisma.resultSheet.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true, classId: true, termId: true, schoolId: true, publishedAt: true },
      });

      for (const sheet of publishedSheets) {
        try {
          const updateResult = await this.prisma.computedResult.updateMany({
            where: {
              classId: sheet.classId,
              termId: sheet.termId,
              schoolId: sheet.schoolId,
              status: { not: 'PUBLISHED' },
            },
            data: { status: 'PUBLISHED' },
          });

          if (updateResult.count > 0) {
            results.sheetsFixed++;
            results.computedResultsUpdated += updateResult.count;
            results.sheets.push({
              sheetId: sheet.id,
              classId: sheet.classId,
              termId: sheet.termId,
              updated: updateResult.count,
            });
          }
        } catch (e: any) {
          results.errors.push({ sheetId: sheet.id, error: e.message });
        }
      }

      // Also find VERIFIED sheets that should be PUBLISHED (from failed publish attempts)
      // Check if there are computed results with PUBLISHED status for VERIFIED sheets
      const verifiedSheets = await this.prisma.resultSheet.findMany({
        where: { status: 'VERIFIED' },
        select: { id: true, classId: true, termId: true, schoolId: true },
      });

      for (const sheet of verifiedSheets) {
        const publishedCount = await this.prisma.computedResult.count({
          where: {
            classId: sheet.classId,
            termId: sheet.termId,
            schoolId: sheet.schoolId,
            status: 'PUBLISHED',
          },
        });

        if (publishedCount > 0) {
          // This sheet has PUBLISHED computed results but is still VERIFIED - fix it
          try {
            await this.prisma.resultSheet.update({
              where: { id: sheet.id },
              data: { status: 'PUBLISHED', publishedAt: new Date() },
            });
            results.sheetsFixed++;
            results.sheets.push({
              sheetId: sheet.id,
              classId: sheet.classId,
              termId: sheet.termId,
              fixed: 'sheet status updated to PUBLISHED',
            });
          } catch (e: any) {
            results.errors.push({ sheetId: sheet.id, error: e.message });
          }
        }
      }

    } catch (e: any) {
      results.fatalError = e.message;
    }

    results.summary = `sheetsFixed: ${results.sheetsFixed}, computedResultsUpdated: ${results.computedResultsUpdated}, errors: ${results.errors.length}`;
    return results;
  }

  @Head()
  async head() {
    const health = await this.healthService.check();
    if (health.status === 'unhealthy') {
      throw new Error('Service unhealthy');
    }
    return { status: 'ok' };
  }
}
