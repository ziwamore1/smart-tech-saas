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

  private async checkClassIdBackfill(): Promise<HealthCheck> {
    try {
      const total = await this.prisma.student.count();
      if (total === 0) return { status: 'up', message: 'No students to backfill' };
      const needsBackfill = await this.prisma.student.count({ where: { classId: { in: ['__SCHOOL__', null] } } });
      if (needsBackfill === 0) return { status: 'up', message: `${total} students have proper classIds` };
      return {
        status: 'degraded',
        message: `${needsBackfill}/${total} students need classId backfill — run GET /health/backfill-classid`,
      };
    } catch {
      return { status: 'down', message: 'Failed to check classId backfill status' };
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
