import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(data: {
    userId: string;
    action: string;
    details?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.prisma.accountSecurityLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata || undefined,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to log security event: ${error.message}`);
    }
  }

  async getAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      schoolId?: string;
    },
    pagination: { page: number; limit: number } = { page: 1, limit: 50 },
  ): Promise<{ logs: any[]; total: number; page: number; limit: number }> {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.accountSecurityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.accountSecurityLog.count({ where }),
    ]);

    return { logs, total, page: pagination.page, limit: pagination.limit };
  }

  async getSecuritySummary(userId: string): Promise<any> {
    const [totalLogs, failedLogins, passwordChanges, recentActivity] = await Promise.all([
      this.prisma.accountSecurityLog.count({ where: { userId } }),
      this.prisma.accountSecurityLog.count({ where: { userId, action: 'LOGIN_FAILED' } }),
      this.prisma.accountSecurityLog.count({
        where: { userId, action: { in: ['PASSWORD_CHANGED', 'PASSWORD_RESET_COMPLETED'] } },
      }),
      this.prisma.accountSecurityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { action: true, details: true, createdAt: true, ipAddress: true },
      }),
    ]);

    return {
      totalLogs,
      failedLogins,
      passwordChanges,
      recentActivity,
    };
  }

  async logLoginAttempt(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      details: success ? 'Successful login' : 'Failed login attempt',
      ipAddress,
      userAgent,
    });

    if (!success) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedAttempts: { increment: 1 } },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { failedAttempts: true },
      });

      if (user && user.failedAttempts >= 5) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            accountStatus: 'LOCKED',
            lockoutUntil: new Date(Date.now() + 30 * 60 * 1000),
          },
        });

        await this.log({
          userId,
          action: 'ACCOUNT_LOCKED',
          details: 'Account locked due to too many failed login attempts',
          ipAddress,
          userAgent,
        });
      }
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedAttempts: 0, lastLogin: new Date() },
      });
    }
  }
}
