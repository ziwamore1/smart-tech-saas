import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinistryAdapterFactory } from '../ministry-gateway/adapters/adapter-factory';
import { BlockchainService } from '../blockchain-service/blockchain.service';
import { Pool } from 'pg';

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
