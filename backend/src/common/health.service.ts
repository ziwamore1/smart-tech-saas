import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinistryAdapterFactory } from '../ministry-gateway/adapters/adapter-factory';
import { BlockchainService } from '../blockchain-service/blockchain.service';
import { Pool } from 'pg';
import { normalizeZambianPhone } from './utils/phone.util';
import { AdmissionNumberService } from '../admission-number/admission-number.service';

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

  async backfillClassSequences() {
    const startedAt = Date.now();
    const groups = await this.prisma.enrollment.groupBy({
      by: ['schoolId', 'academicYearId', 'classId'],
      where: { status: 'ACTIVE' },
    });
    let repaired = 0;
    let students = 0;
    const errors: Array<{ schoolId: string; academicYearId: string; classId: string; message: string }> = [];

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
        await this.admissionNumberService.resequenceClass(
          group.schoolId,
          group.academicYearId,
          group.classId,
        );
        repaired += 1;
        students += count;
      } catch (error: any) {
        errors.push({
          schoolId: group.schoolId,
          academicYearId: group.academicYearId,
          classId: group.classId,
          message: error?.message || 'Failed to resequence register',
        });
      }
    }

    return {
      status: errors.length > 0 ? 'partial' : 'ok',
      operation: 'backfill-class-sequences',
      idempotent: true,
      registersScanned: groups.length,
      registersRepaired: repaired,
      activeEnrollmentsProcessed: students,
      errors,
      latencyMs: Date.now() - startedAt,
    };
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
}
