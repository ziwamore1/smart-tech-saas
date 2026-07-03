import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private prisma: PrismaService) {}

  async record(event: string, details: any, userId?: string, schoolId?: string): Promise<void> {
    this.logger.log(`[AUDIT] ${event} | user=${userId} | school=${schoolId} | details=${JSON.stringify(details)}`);
    await this.prisma.notificationLog.create({
      data: {
        recipient: userId || schoolId || 'system',
        channel: 'AUDIT',
        type: event,
        status: 'logged',
        message: JSON.stringify({ details, schoolId }),
      },
    }).catch(err => this.logger.error('Failed to store audit log', err));
  }

  async getAuditLogs(filters?: { event?: string; userId?: string; schoolId?: string; limit?: number; offset?: number }) {
    const where: any = { channel: 'AUDIT' };
    if (filters?.event) where.type = filters.event;
    if (filters?.userId) where.recipient = filters.userId;

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return { logs, total };
  }
}
