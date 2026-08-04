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
   * Safe to run repeatedly; existing named Marketplace copies are skipped.
   */
  async backfillMarketplaceTemplates() {
    const [schools, systemTemplates] = await Promise.all([
      this.prisma.school.findMany({ select: { id: true } }),
      this.prisma.reportTemplate.findMany({
        where: { schoolId: null, isDefault: true },
        include: { components: true, certificate: true },
      }),
    ]);

    let created = 0;
    let skipped = 0;
    for (const school of schools) {
      for (const source of systemTemplates) {
        const name = `${source.name} (from Marketplace)`;
        const existing = await this.prisma.reportTemplate.findFirst({
          where: { schoolId: school.id, name },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const copy = await this.prisma.reportTemplate.create({
          data: {
            name,
            schoolId: school.id,
            templateType: source.templateType,
            pageSize: source.pageSize,
            orientation: source.orientation,
            fontFamily: source.fontFamily,
            fontSize: source.fontSize,
            primaryColor: source.primaryColor,
            secondaryColor: source.secondaryColor,
            layoutJson: source.layoutJson as any,
            metadata: { ...(source.metadata as any || {}), source: 'marketplace-backfill', sourceTemplateId: source.id },
            status: 'ACTIVE',
            version: 1,
          },
        });

        if (source.components.length > 0) {
          await this.prisma.templateComponent.createMany({
            data: source.components.map((component) => ({
              templateId: copy.id,
              type: component.type,
              label: component.label,
              content: component.content as any,
              styles: component.styles as any,
              position: component.position as any,
              size: component.size as any,
              settings: component.settings as any,
              placeholder: component.placeholder,
              isRequired: component.isRequired,
              isLocked: component.isLocked,
              sortOrder: component.sortOrder,
            })),
          });
        }
        if (source.certificate) {
          await this.prisma.certificateTemplate.create({
            data: {
              templateId: copy.id,
              certificateType: source.certificate.certificateType,
              borderStyle: source.certificate.borderStyle,
              borderColor: source.certificate.borderColor,
              sealUrl: source.certificate.sealUrl,
              showQrCode: source.certificate.showQrCode,
              autoNumbering: source.certificate.autoNumbering,
              showPhoto: source.certificate.showPhoto,
              signature1Label: source.certificate.signature1Label,
              signature1Name: source.certificate.signature1Name,
              signature1Title: source.certificate.signature1Title,
              signature2Label: source.certificate.signature2Label,
              signature2Name: source.certificate.signature2Name,
              signature2Title: source.certificate.signature2Title,
              awardText: source.certificate.awardText,
              showBadge: source.certificate.showBadge,
              badgeStyle: source.certificate.badgeStyle,
              showWatermark: source.certificate.showWatermark,
              watermarkText: source.certificate.watermarkText,
              layoutJson: source.certificate.layoutJson as any,
            },
          });
        }
        created++;
      }
    }

    return {
      status: 'completed',
      schools: schools.length,
      sourceTemplates: systemTemplates.length,
      created,
      skipped,
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
