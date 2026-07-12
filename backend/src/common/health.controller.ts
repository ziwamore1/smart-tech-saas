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

  @Head()
  async head() {
    const health = await this.healthService.check();
    if (health.status === 'unhealthy') {
      throw new Error('Service unhealthy');
    }
    return { status: 'ok' };
  }
}
