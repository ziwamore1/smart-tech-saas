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
    const schoolId = '40a1039f-e292-4e91-948d-05848ac2ad89';

    const step = async (name: string, fn: () => Promise<any>) => {
      const t = Date.now();
      try {
        results[name] = { status: 'ok', ms: 0, count: 0 };
        const data = await Promise.race([
          fn(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 8000)),
        ]);
        results[name] = { status: 'ok', ms: Date.now() - t, count: Array.isArray(data) ? data.length : 1 };
      } catch (error: any) {
        results[name] = { status: 'error', ms: Date.now() - t, message: error?.message?.slice(0, 200) };
      }
    };

    await step('1_simple_findMany', () =>
      this.prisma.student.findMany({ where: { schoolId }, take: 5 })
    );

    await step('2_select_scalars_only', () =>
      this.prisma.student.findMany({
        where: { schoolId },
        select: {
          id: true, firstName: true, lastName: true, admissionNumber: true,
          gender: true, status: true, createdAt: true,
        },
        take: 5,
      })
    );

    await step('3_select_with_enrollments', () =>
      this.prisma.student.findMany({
        where: { schoolId },
        select: {
          id: true, firstName: true, lastName: true,
          enrollments: {
            include: { class: true, academicYear: true },
          },
        },
        take: 5,
      })
    );

    await step('4_select_with_parents', () =>
      this.prisma.student.findMany({
        where: { schoolId },
        select: {
          id: true, firstName: true, lastName: true,
          parents: { include: { parent: true } },
        },
        take: 5,
      })
    );

    await step('5_full_findAll', () =>
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
        take: 5,
      })
    );

    return {
      status: 'ok',
      totalMs: Date.now() - start,
      steps: results,
    };
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
