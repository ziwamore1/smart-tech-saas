import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  schoolId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  documentVerificationId?: string | null;
  beforeStatus?: string | null;
  afterStatus?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  detail?: Record<string, any>;
  result?: 'SUCCESS' | 'DENIED';
}

/**
 * Immutable security-sensitive action trail.
 * Failures to log are swallowed (logged) so audits never break business flows,
 * matching the platform's existing audit-log behavior elsewhere.
 */
@Injectable()
export class DocumentAuditService {
  private readonly logger = new Logger(DocumentAuditService.name);

  constructor(private prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.documentAuditLog.create({
        data: {
          schoolId: entry.schoolId ?? undefined,
          actorId: entry.actorId ?? undefined,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? undefined,
          documentVerificationId: entry.documentVerificationId ?? undefined,
          beforeStatus: entry.beforeStatus ?? undefined,
          afterStatus: entry.afterStatus ?? undefined,
          ipAddress: entry.ipAddress ?? undefined,
          userAgent: entry.userAgent ?? undefined,
          detail: (entry.detail || {}) as any,
          result: entry.result ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write DocumentAuditLog for ${entry.action}: ${err?.message}`);
    }
  }

  async listForDocument(schoolId: string, documentVerificationId: string) {
    return this.prisma.documentAuditLog.findMany({
      where: { schoolId, OR: [{ documentVerificationId }, { entityId: documentVerificationId }] },
      orderBy: { createdAt: 'asc' },
    });
  }
}
