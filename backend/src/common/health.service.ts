import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinistryAdapterFactory } from '../ministry-gateway/adapters/adapter-factory';
import { BlockchainService } from '../blockchain-service/blockchain.service';
import { Pool } from 'pg';
import { normalizeZambianPhone } from './utils/phone.util';
import { AdmissionNumberService } from '../admission-number/admission-number.service';
import { randomUUID } from 'crypto';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: Record<string, HealthCheck>;
}

export interface HealthCheck {
  status: 'up' | 'down' | 'degraded';
  message?: string;
  latency?: number;
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();
  private readonly version = process.env.npm_package_version || '2.0.0';
  private readonly sequenceBackfillJobs = new Map<string, {
    status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
    startedAt: string;
    finishedAt?: string;
    registersScanned: number;
    registersRepaired: number;
    activeEnrollmentsProcessed: number;
    errors: Array<{ schoolId: string; academicYearId: string; classId: string; message: string }>;
  }>();

  constructor(
    private prisma: PrismaService,
    private ministryAdapterFactory: MinistryAdapterFactory,
    private blockchainService: BlockchainService,
    private admissionNumberService: AdmissionNumberService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const checks: Record<string, HealthCheck> = {};

    checks.database = await this.checkDatabase();
    checks.ministry = await this.checkMinistryAdapters();
    checks.blockchain = await this.checkBlockchain();
    checks.memory = this.checkMemory();
    checks.classIdBackfill = await this.checkClassIdBackfill();

    const allStatuses = Object.values(checks).map(c => c.status);
    let status: HealthCheckResult['status'] = 'healthy';

    if (allStatuses.some(s => s === 'down')) {
      status = 'unhealthy';
    } else if (allStatuses.some(s => s === 'degraded')) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
      checks,
    };
  }

  async backfillComputedResults(apply = false) {
    const summary = {
      mode: apply ? 'APPLY' : 'DRY_RUN',
      legacyCreated: 0,
      legacyRepaired: 0,
      componentCreated: 0,
      componentRepaired: 0,
      skippedNoEnrollment: 0,
    };
    const classCache = new Map<string, string | null>();

    const resolveClass = async (studentId: string, academicYearId: string) => {
      const key = `${studentId}:${academicYearId}`;
      if (classCache.has(key)) return classCache.get(key) ?? null;
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { studentId, academicYearId, status: 'ACTIVE' },
        select: { classId: true },
      });
      classCache.set(key, enrollment?.classId ?? null);
      return enrollment?.classId ?? null;
    };

    const legacyRows = await this.prisma.result.findMany({
      select: {
        studentId: true,
        subjectId: true,
        termId: true,
        schoolId: true,
        score: true,
        grade: true,
        remark: true,
        term: { select: { academicYearId: true } },
      },
    });

    for (const row of legacyRows) {
      const classId = await resolveClass(row.studentId, row.term.academicYearId);
      if (!classId) {
        summary.skippedNoEnrollment++;
        continue;
      }
      const existing = await this.prisma.computedResult.findUnique({
        where: { studentId_subjectId_termId: { studentId: row.studentId, subjectId: row.subjectId, termId: row.termId } },
        select: { id: true, finalPercentage: true, classId: true, schoolId: true },
      });
      const needsRepair = !existing || existing.finalPercentage == null || existing.classId !== classId || existing.schoolId !== row.schoolId;
      if (!needsRepair) continue;
      if (apply) {
        await this.prisma.computedResult.upsert({
          where: { studentId_subjectId_termId: { studentId: row.studentId, subjectId: row.subjectId, termId: row.termId } },
          update: {
            classId,
            schoolId: row.schoolId,
            totalRawScore: row.score,
            finalPercentage: row.score,
            finalGrade: row.grade,
            finalRemark: row.remark,
            status: 'COMPUTED',
            computedAt: new Date(),
          },
          create: {
            studentId: row.studentId,
            subjectId: row.subjectId,
            termId: row.termId,
            classId,
            schoolId: row.schoolId,
            totalRawScore: row.score,
            finalPercentage: row.score,
            finalGrade: row.grade,
            finalRemark: row.remark,
            status: 'COMPUTED',
            computedAt: new Date(),
          },
        });
      }
      existing ? summary.legacyRepaired++ : summary.legacyCreated++;
    }

    const componentRows = await this.prisma.studentAssessmentResult.findMany({
      where: { OR: [{ rawScore: { not: null } }, { isAbsent: true }] },
      select: {
        studentId: true,
        subjectId: true,
        termId: true,
        classId: true,
        rawScore: true,
        percentage: true,
        grade: true,
        remarks: true,
        isAbsent: true,
        class: { select: { schoolId: true } },
      },
    });

    for (const row of componentRows) {
      const score = row.isAbsent ? null : row.percentage ?? row.rawScore;
      const existing = await this.prisma.computedResult.findUnique({
        where: { studentId_subjectId_termId: { studentId: row.studentId, subjectId: row.subjectId, termId: row.termId } },
        select: { id: true, finalPercentage: true, classId: true, schoolId: true },
      });
      const schoolId = row.class.schoolId;
      const needsRepair = !existing || existing.finalPercentage == null || existing.classId !== row.classId || existing.schoolId !== schoolId;
      if (!needsRepair) continue;
      if (apply) {
        await this.prisma.computedResult.upsert({
          where: { studentId_subjectId_termId: { studentId: row.studentId, subjectId: row.subjectId, termId: row.termId } },
          update: {
            classId: row.classId,
            schoolId,
            ...(score != null ? { totalRawScore: score, finalPercentage: score } : {}),
            ...(row.grade ? { finalGrade: row.grade } : {}),
            ...(row.remarks ? { finalRemark: row.remarks } : {}),
          },
          create: {
            studentId: row.studentId,
            subjectId: row.subjectId,
            termId: row.termId,
            classId: row.classId,
            schoolId,
            totalRawScore: score,
            finalPercentage: score,
            finalGrade: row.grade,
            finalRemark: row.remarks,
            status: score != null ? 'COMPUTED' : 'PENDING',
            isAbsent: row.isAbsent,
            computedAt: score != null ? new Date() : null,
          },
        });
      }
      existing ? summary.componentRepaired++ : summary.componentCreated++;
    }

    return summary;
  }

  async checkDetailed(): Promise<HealthCheckResult> {
    const checks: Record<string, HealthCheck> = {};

    checks.database = await this.checkDatabase();
    checks.ministry = await this.checkMinistryAdapters();
    checks.blockchain = await this.checkBlockchain();
    checks.memory = this.checkMemory();
    checks.disk = this.checkDisk();

    const allStatuses = Object.values(checks).map(c => c.status);
    let status: HealthCheckResult['status'] = 'healthy';

    if (allStatuses.some(s => s === 'down')) {
      status = 'unhealthy';
    } else if (allStatuses.some(s => s === 'degraded')) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
      checks,
    };
  }

  async backfillPhoneNumbers() {
    const startedAt = Date.now();
    const results: Record<string, { scanned: number; updated: number; error?: string }> = {};
    const models = ['user', 'parent', 'school', 'systemUser'];

    for (const modelName of models) {
      try {
        const model = (this.prisma as any)[modelName];
        const rows = await model.findMany({
          where: { phone: { not: null } },
          select: { id: true, phone: true },
        });
        const updates = rows
          .map((row: { id: string; phone: string }) => ({ id: row.id, phone: normalizeZambianPhone(row.phone), original: row.phone }))
          .filter((row: { phone: string | null; original: string }) => row.phone && row.phone !== row.original);
        let updated = 0;

        // Keep the endpoint below common reverse-proxy timeouts without
        // creating an unbounded number of database connections.
        for (let i = 0; i < updates.length; i += 50) {
          const batch = updates.slice(i, i + 50);
          const updatedRows = await Promise.all(batch.map((row: { id: string; phone: string | null }) =>
            model.update({ where: { id: row.id }, data: { phone: row.phone } }),
          ));
          updated += updatedRows.length;
        }
        results[modelName] = { scanned: rows.length, updated };
      } catch (error: any) {
        results[modelName] = { scanned: 0, updated: 0, error: error?.message || 'Backfill failed' };
      }
    }

    return {
      status: Object.values(results).some((value) => value.error) ? 'partial' : 'ok',
      operation: 'backfill-phone-numbers',
      format: '+260XXXXXXXXX',
      idempotent: true,
      latencyMs: Date.now() - startedAt,
      results,
      totalUpdated: Object.values(results).reduce((sum, value) => sum + value.updated, 0),
    };
  }

  async checkClassSequences() {
    const startedAt = Date.now();
    try {
      const activeEnrollments = await this.prisma.enrollment.count({ where: { status: 'ACTIVE' } });
      const missingSequence = await this.prisma.enrollment.count({
        where: { status: 'ACTIVE', sequenceNumber: null },
      });
      const registers = await this.prisma.enrollment.groupBy({
        by: ['schoolId', 'academicYearId', 'classId'],
        where: { status: 'ACTIVE' },
      });

      return {
        status: missingSequence === 0 ? 'ok' : 'degraded',
        operation: 'check-class-sequences',
        activeEnrollments,
        registers: registers.length,
        missingSequence,
        consistent: missingSequence === 0,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error: any) {
      return {
        status: 'error',
        operation: 'check-class-sequences',
        message: error?.message || 'Sequence column is not available; run prisma migrate deploy first.',
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  async startClassSequenceBackfill() {
    const running = [...this.sequenceBackfillJobs.entries()].find(([, job]) => job.status === 'queued' || job.status === 'running');
    if (running) {
      return { status: 'already-running', operation: 'backfill-class-sequences', jobId: running[0] };
    }

    const jobId = randomUUID();
    this.sequenceBackfillJobs.set(jobId, {
      status: 'queued',
      startedAt: new Date().toISOString(),
      registersScanned: 0,
      registersRepaired: 0,
      activeEnrollmentsProcessed: 0,
      errors: [],
    });

    void this.runClassSequenceBackfill(jobId);
    return { status: 'started', operation: 'backfill-class-sequences', jobId };
  }

  async auditClassRegisters(schoolIdFilter?: string) {
    const startedAt = Date.now();
    const registers: Array<Record<string, any>> = [];

    try {
      const schools = await this.prisma.school.findMany({
        select: { id: true, name: true },
      });
      const schoolNameById = new Map(schools.map((school) => [school.id, school.name]));

      const academicYears = await this.prisma.academicYear.findMany({
        select: { id: true, schoolId: true, name: true, startDate: true, isCurrent: true },
        orderBy: { startDate: 'asc' },
      });

      for (const academicYear of academicYears) {
        if (schoolIdFilter && academicYear.schoolId !== schoolIdFilter) continue;

        const classes = await this.prisma.class.findMany({
          where: { schoolId: academicYear.schoolId },
          select: { id: true, name: true },
        });

        for (const classItem of classes) {
          const enrollments = await this.prisma.enrollment.findMany({
            where: {
              schoolId: academicYear.schoolId,
              academicYearId: academicYear.id,
              classId: classItem.id,
              status: 'ACTIVE',
            },
            orderBy: [{ sequenceNumber: 'asc' }, { student: { admissionNumber: 'asc' } }],
            select: {
              id: true,
              sequenceNumber: true,
              status: true,
              student: {
                select: { id: true, firstName: true, lastName: true, admissionNumber: true, classId: true, status: true },
              },
            },
          });

          if (enrollments.length === 0) continue;

          const year = academicYear.startDate.getFullYear();
          let contiguous = true;
          let allMatch = true;
          enrollments.forEach((enrollment, index) => {
            const expected = `ST-${year}-${String(index + 1).padStart(3, '0')}`;
            if (enrollment.sequenceNumber !== index + 1) contiguous = false;
            if (enrollment.student.admissionNumber !== expected) allMatch = false;
          });

          registers.push({
            schoolId: academicYear.schoolId,
            schoolName: schoolNameById.get(academicYear.schoolId) || null,
            academicYearId: academicYear.id,
            academicYear: academicYear.name,
            isCurrent: academicYear.isCurrent,
            classId: classItem.id,
            className: classItem.name,
            year,
            count: enrollments.length,
            sequenceContiguous: contiguous,
            admissionMatchesSequence: allMatch,
            students: enrollments.map((enrollment) => ({
              position: enrollment.sequenceNumber,
              name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
              admissionNumber: enrollment.student.admissionNumber,
              studentClassId: enrollment.student.classId,
              enrollmentClassId: classItem.id,
              classIdMatches: enrollment.student.classId === classItem.id,
              studentStatus: enrollment.student.status,
              enrollmentStatus: enrollment.status,
            })),
          });
        }
      }
    } catch (error: any) {
      return {
        status: 'error',
        operation: 'audit-class-registers',
        message: error?.message || 'Audit failed',
        latencyMs: Date.now() - startedAt,
      };
    }

    return {
      status: 'ok',
      operation: 'audit-class-registers',
      registerCount: registers.length,
      registersWithGaps: registers.filter((r) => !r.sequenceContiguous).length,
      registersWithStaleAdmission: registers.filter((r) => !r.admissionMatchesSequence).length,
      latencyMs: Date.now() - startedAt,
      registers,
    };
  }

  getClassSequenceBackfillStatus(jobId?: string) {
    const jobIds = [...this.sequenceBackfillJobs.keys()];
    const selectedId = jobId || jobIds[jobIds.length - 1];
    if (!selectedId) return { status: 'not-found', operation: 'backfill-class-sequences' };
    const job = this.sequenceBackfillJobs.get(selectedId);
    if (!job) return { status: 'not-found', operation: 'backfill-class-sequences', jobId: selectedId };
    return { operation: 'backfill-class-sequences', jobId: selectedId, ...job };
  }

  private async runClassSequenceBackfill(jobId: string) {
    const job = this.sequenceBackfillJobs.get(jobId);
    if (!job) return;
    job.status = 'running';

    try {
      const groups = await this.prisma.enrollment.groupBy({
        by: ['schoolId', 'academicYearId', 'classId'],
        where: { status: 'ACTIVE' },
      });
      job.registersScanned = groups.length;

      for (const group of groups) {
        try {
          const count = await this.prisma.enrollment.count({
            where: {
              schoolId: group.schoolId,
              academicYearId: group.academicYearId,
              classId: group.classId,
              status: 'ACTIVE',
            },
          });
          await this.admissionNumberService.resequenceClass(group.schoolId, group.academicYearId, group.classId);
          job.registersRepaired += 1;
          job.activeEnrollmentsProcessed += count;
        } catch (error: any) {
          job.errors.push({
            schoolId: group.schoolId,
            academicYearId: group.academicYearId,
            classId: group.classId,
            message: error?.message || 'Failed to resequence register',
          });
        }
      }
      job.status = job.errors.length > 0 ? 'partial' : 'completed';
    } catch (error: any) {
      job.status = 'failed';
      job.errors.push({ schoolId: '', academicYearId: '', classId: '', message: error?.message || 'Backfill failed' });
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  }

  /**
   * Provisions system Marketplace templates into every school-owned library.
   * Implemented with three batched INSERT ... SELECT statements so the heavy
   * copying happens inside Postgres — keeps this endpoint fast and low-memory
   * on memory-constrained instances. Safe to run repeatedly:
   *   - templates: unique (name, schoolId) + ON CONFLICT DO NOTHING
   *   - components/certificates: NOT EXISTS guards (self-heals partial runs)
   */
  async backfillMarketplaceTemplates() {
    const start = Date.now();

    const [sourceTemplates, schools] = await Promise.all([
      this.prisma.reportTemplate.count({ where: { schoolId: null, isDefault: true } }),
      this.prisma.school.count(),
    ]);

    if (sourceTemplates === 0 || schools === 0) {
      return {
        status: 'completed',
        latencyMs: Date.now() - start,
        schools,
        sourceTemplates,
        created: 0,
        skipped: 0,
      };
    }

    const created = await this.prisma.$executeRawUnsafe(`
      INSERT INTO "ReportTemplate"
        ("id", "name", "schoolId", "templateType", "pageSize", "orientation", "fontFamily", "fontSize",
         "primaryColor", "secondaryColor", "layoutJson", "metadata", "status", "version", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), src."name" || ' (from Marketplace)', s."id",
             src."templateType", src."pageSize", src."orientation", src."fontFamily", src."fontSize",
             src."primaryColor", src."secondaryColor", src."layoutJson",
             (COALESCE(src."metadata", '{}'::jsonb) || jsonb_build_object('source', 'marketplace-backfill', 'sourceTemplateId', src."id")),
             'PUBLISHED', 1, now(), now()
      FROM "ReportTemplate" src
      CROSS JOIN "School" s
      WHERE src."schoolId" IS NULL AND src."isDefault" = true AND s."id" <> 'system'
      ON CONFLICT ("name", "schoolId") DO NOTHING
    `);

    const componentsCreated = await this.prisma.$executeRawUnsafe(`
      INSERT INTO "TemplateComponent"
        ("id", "templateId", "type", "label", "content", "styles", "position", "size", "settings",
         "placeholder", "isRequired", "isLocked", "sortOrder", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), c."id", sc."type", sc."label", sc."content", sc."styles", sc."position", sc."size", sc."settings",
             sc."placeholder", sc."isRequired", sc."isLocked", sc."sortOrder", now(), now()
      FROM "TemplateComponent" sc
      JOIN "ReportTemplate" src ON sc."templateId" = src."id"
      JOIN "ReportTemplate" c ON c."metadata"->>'sourceTemplateId' = src."id"
      WHERE src."schoolId" IS NULL AND src."isDefault" = true
        AND c."name" = src."name" || ' (from Marketplace)'
        AND c."schoolId" <> 'system'
        AND NOT EXISTS (SELECT 1 FROM "TemplateComponent" e WHERE e."templateId" = c."id" LIMIT 1)
    `);

    const certificatesCreated = await this.prisma.$executeRawUnsafe(`
      INSERT INTO "CertificateTemplate"
        ("id", "templateId", "certificateType", "borderStyle", "borderColor", "sealUrl", "showQrCode", "autoNumbering",
         "nextNumber", "showPhoto", "signature1Label", "signature1Name", "signature1Title", "signature2Label",
         "signature2Name", "signature2Title", "awardText", "showBadge", "badgeStyle", "showWatermark",
         "watermarkText", "layoutJson", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), c."id", cert."certificateType", cert."borderStyle", cert."borderColor", cert."sealUrl",
             cert."showQrCode", cert."autoNumbering", 1, cert."showPhoto",
             cert."signature1Label", cert."signature1Name", cert."signature1Title",
             cert."signature2Label", cert."signature2Name", cert."signature2Title",
             cert."awardText", cert."showBadge", cert."badgeStyle", cert."showWatermark",
             cert."watermarkText", cert."layoutJson", now(), now()
      FROM "CertificateTemplate" cert
      JOIN "ReportTemplate" src ON cert."templateId" = src."id"
      JOIN "ReportTemplate" c ON c."metadata"->>'sourceTemplateId' = src."id"
      WHERE src."schoolId" IS NULL AND src."isDefault" = true
        AND c."name" = src."name" || ' (from Marketplace)'
        AND c."schoolId" <> 'system'
        AND NOT EXISTS (SELECT 1 FROM "CertificateTemplate" e WHERE e."templateId" = c."id" LIMIT 1)
    `);

    const totalCopies = await this.prisma.reportTemplate.count({
      where: { schoolId: { not: null }, name: { contains: ' (from Marketplace)' } },
    });

    return {
      status: 'completed',
      latencyMs: Date.now() - start,
      schools,
      sourceTemplates,
      created,
      skipped: totalCopies - created,
      componentsCreated,
      certificatesCreated,
      totalCopies,
    };
  }

  private async checkClassIdBackfill(): Promise<HealthCheck> {
    try {
      const total = await this.prisma.student.count();
      if (total === 0) return { status: 'up', message: 'No students to backfill' };
      const needsBackfill = await this.prisma.student.count({ where: { OR: [{ classId: '__SCHOOL__' }, { classId: null }] } });
      if (needsBackfill === 0) return { status: 'up', message: `${total} students have proper classIds` };
      return {
        status: 'degraded',
        message: `${needsBackfill}/${total} students need classId backfill — run GET /health/backfill-classid`,
      };
    } catch (e: any) {
      if (e?.message?.includes('does not exist') || e?.message?.includes('column') || e?.message?.includes('classId')) {
        return { status: 'degraded', message: 'classId column not yet migrated — run prisma migrate deploy' };
      }
      return { status: 'down', message: `Failed to check classId backfill: ${e?.message}` };
    }
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    let pool;
    try {
      const dbUrl = (process.env.DATABASE_URL || '').replace(/\?.*$/, '');
      pool = new Pool({ connectionString: dbUrl, max: 1, connectionTimeoutMillis: 5000 });
      await pool.query('SELECT 1');
      const latency = Date.now() - start;
      return {
        status: latency > 1000 ? 'degraded' : 'up',
        message: `Response time: ${latency}ms`,
        latency,
      };
    } catch (error) {
      return {
        status: 'down',
        message: `Database connection failed: ${error.message}`,
      };
    } finally {
      if (pool) await pool.end().catch(() => {});
    }
  }

  private async checkMinistryAdapters(): Promise<HealthCheck> {
    const adapters = this.ministryAdapterFactory.getAllAdapters();
    const available = Array.from(adapters.values()).filter(a => a.isAvailable()).length;
    const total = adapters.size;

    if (total === 0) {
      return {
        status: 'degraded',
        message: 'No ministry adapters configured',
      };
    }

    return {
      status: available > 0 ? 'up' : 'down',
      message: `${available}/${total} adapters available`,
    };
  }

  private async checkBlockchain(): Promise<HealthCheck> {
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const privateKey = process.env.PRIVATE_KEY;

    if (!contractAddress || !privateKey || privateKey.startsWith('0x000')) {
      return {
        status: 'degraded',
        message: 'Blockchain not configured (development mode)',
      };
    }

    try {
      const total = await this.blockchainService.getTotalRegistered();
      return {
        status: 'up',
        message: `${total} certificates registered on-chain`,
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: `Blockchain connection issue: ${error.message}`,
      };
    }
  }

  private checkMemory(): HealthCheck {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    const rssMB = Math.round(used.rss / 1024 / 1024);

    const status = heapUsedMB > 1024 ? 'degraded' : 'up';

    return {
      status,
      message: `Heap: ${heapUsedMB}MB/${heapTotalMB}MB, RSS: ${rssMB}MB`,
    };
  }

  private checkDisk(): HealthCheck {
    return {
      status: 'up',
      message: 'Disk check not implemented',
    };
  }

  async backfillSheetCounts(apply = false, schoolId?: string) {
    const start = Date.now();
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;

    const sheets = await this.prisma.resultSheet.findMany({
      where,
      select: { id: true, classId: true, termId: true, schoolId: true, academicYearId: true, totalStudents: true, enteredCount: true },
    });

    let updated = 0;
    let alreadyCorrect = 0;
    const results: any[] = [];

    for (const sheet of sheets) {
      let ayId = sheet.academicYearId;
      if (!ayId) {
        const term = await this.prisma.term.findUnique({ where: { id: sheet.termId }, select: { academicYearId: true } });
        ayId = term?.academicYearId;
      }
      if (!ayId) {
        results.push({ sheetId: sheet.id, error: 'No academic year resolved', wasCorrect: false });
        continue;
      }

      const [totalStudents, enteredResults] = await Promise.all([
        this.prisma.enrollment.count({
          where: { classId: sheet.classId, academicYearId: ayId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
        }),
        this.prisma.result.groupBy({
          by: ['studentId'],
          where: { schoolId: sheet.schoolId, termId: sheet.termId, student: { enrollments: { some: { classId: sheet.classId, academicYearId: ayId, status: 'ACTIVE' } }, status: 'ACTIVE' } },
        }),
      ]);
      const enteredCount = enteredResults.length;
      const wasCorrect = sheet.totalStudents === totalStudents && sheet.enteredCount === enteredCount;

      if (!wasCorrect && apply) {
        await this.prisma.resultSheet.update({
          where: { id: sheet.id },
          data: { totalStudents, enteredCount },
        });
      }

      if (wasCorrect) {
        alreadyCorrect++;
      } else {
        updated++;
      }

      results.push({
        sheetId: sheet.id,
        classId: sheet.classId,
        termId: sheet.termId,
        schoolId: sheet.schoolId,
        previousTotal: sheet.totalStudents,
        newTotal: totalStudents,
        previousEntered: sheet.enteredCount,
        newEntered: enteredCount,
        wasCorrect,
        applied: !wasCorrect && apply,
      });
    }

    return {
      mode: apply ? 'APPLY' : 'DRY_RUN',
      totalSheets: sheets.length,
      updated,
      alreadyCorrect,
      results,
      latencyMs: Date.now() - start,
    };
  }
}
