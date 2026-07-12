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
          where: { schoolId, AND: [{ OR: [{ status: 'ACTIVE' as any }, { status: null }] }] },
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
