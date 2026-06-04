import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class SessionManagementService {
  private readonly logger = new Logger(SessionManagementService.name);

  constructor(private prisma: PrismaService) {}

  async createSession(
    userId: string,
    token: string,
    options: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
      deviceType?: string;
      browser?: string;
      os?: string;
      location?: string;
    },
  ): Promise<any> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const refreshToken = crypto.randomBytes(32).toString('hex');

    const session = await this.prisma.loginSession.create({
      data: {
        userId,
        token,
        refreshToken,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        deviceFingerprint: options.deviceFingerprint,
        deviceType: options.deviceType,
        browser: options.browser,
        os: options.os,
        location: options.location,
        expiresAt,
      },
    });

    return { ...session, refreshToken: undefined };
  }

  async invalidateSession(token: string): Promise<void> {
    await this.prisma.loginSession.updateMany({
      where: { token, isActive: true },
      data: { isActive: false, loggedOutAt: new Date() },
    });
  }

  async invalidateAllUserSessions(userId: string, excludeToken?: string): Promise<number> {
    const where: any = { userId, isActive: true };
    if (excludeToken) {
      where.token = { not: excludeToken };
    }

    const result = await this.prisma.loginSession.updateMany({
      where,
      data: { isActive: false, loggedOutAt: new Date() },
    });

    return result.count;
  }

  async getActiveSessions(userId: string): Promise<any[]> {
    return this.prisma.loginSession.findMany({
      where: { userId, isActive: true, expiresAt: { gte: new Date() } },
      orderBy: { lastActivity: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        deviceType: true,
        browser: true,
        os: true,
        location: true,
        lastActivity: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async updateSessionActivity(token: string): Promise<void> {
    await this.prisma.loginSession.updateMany({
      where: { token, isActive: true },
      data: { lastActivity: new Date() },
    });
  }

  async getSessionByToken(token: string): Promise<any> {
    return this.prisma.loginSession.findFirst({
      where: { token, isActive: true, expiresAt: { gte: new Date() } },
    });
  }

  async cleanExpiredSessions(): Promise<number> {
    const result = await this.prisma.loginSession.updateMany({
      where: { expiresAt: { lt: new Date() }, isActive: true },
      data: { isActive: false, loggedOutAt: new Date() },
    });
    return result.count;
  }
}
