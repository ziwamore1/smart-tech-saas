import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordGenerationService } from './password-generation.service';
import { UsernameGenerationService } from './username-generation.service';
import { CredentialDeliveryService, DeliveryOptions } from './credential-delivery.service';
import { OtpService } from './otp.service';
import { AccountRecoveryService } from './account-recovery.service';
import { SessionManagementService } from './session-management.service';
import { SecurityAuditService } from './security-audit.service';
import * as crypto from 'crypto';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private prisma: PrismaService,
    private passwordGenService: PasswordGenerationService,
    private usernameGenService: UsernameGenerationService,
    private credentialDeliveryService: CredentialDeliveryService,
    private otpService: OtpService,
    private accountRecoveryService: AccountRecoveryService,
    private sessionManagementService: SessionManagementService,
    private securityAuditService: SecurityAuditService,
  ) {}

  async getPasswordHubData(adminId: string, schoolId?: string, filters?: {
    role?: string; search?: string; accountStatus?: string; schoolId?: string;
  }) {
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (filters?.schoolId) where.schoolId = filters.schoolId;
    if (filters?.role) {
      where.userRoles = { some: { role: { name: filters.role } } };
    }
    if (filters?.accountStatus) where.accountStatus = filters.accountStatus;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        userRoles: { include: { role: true } },
        userCredentials: { orderBy: { generatedAt: 'desc' }, take: 1 },
        loginSessions: { where: { isActive: true }, select: { id: true, lastActivity: true, deviceType: true } },
        deviceSessions: { where: { isActive: true }, select: { id: true, deviceName: true, lastUsedAt: true, deviceType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      username: user.username,
      roles: user.userRoles.map(ur => ur.role.name),
      accountStatus: user.accountStatus,
      mustChangePassword: user.mustChangePassword,
      mfaEnabled: user.mfaEnabled,
      failedAttempts: user.failedAttempts,
      lastLogin: user.lastLogin,
      lastPasswordChange: user.lastPasswordChange,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastCredential: user.userCredentials[0] || null,
      activeSessions: user.loginSessions.length,
      activeDevices: user.deviceSessions.length,
    }));
  }

  async generateAndDeliverCredentials(
    userId: string,
    adminId: string,
    channel: 'SMS' | 'EMAIL' | 'WHATSAPP' = 'EMAIL',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) throw new NotFoundException('User not found');

    const role = user.userRoles[0]?.role?.name || 'User';
    const generatedPassword = this.passwordGenService.generateRoleBasedPassword(role);
    const username = user.username || this.usernameGenService.generateUsername(
      user.firstName, user.lastName, role, user.schoolId,
    );

    if (!user.username) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { username },
      });
    }

    const credential = await this.prisma.userCredential.create({
      data: {
        userId,
        generatedUsername: username,
        generatedPasswordHash: generatedPassword.hash,
        deliveryChannel: channel,
        deliveryStatus: 'PENDING',
        generatedById: adminId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const school = user.schoolId ? await this.prisma.school.findUnique({ where: { id: user.schoolId } }) : null;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const schoolUrl = school ? `${frontendUrl}/login?school=${school.id}` : `${frontendUrl}/login`;

    let recipientEmail = user.email || undefined;
    let recipientName = `${user.firstName} ${user.lastName}`;

    if (user.studentId) {
      let parentStudent = await this.prisma.parentStudent.findFirst({
        where: { studentId: user.studentId },
        include: { parent: true },
      });
      // Fallback: look up via Student relation
      if (!parentStudent) {
        const student = await this.prisma.student.findUnique({
          where: { id: user.studentId },
          include: { parentStudents: { include: { parent: true } } },
        });
        if (student?.parentStudents?.length) {
          parentStudent = student.parentStudents[0] as any;
        }
      }
      if (parentStudent?.parent?.email) {
        recipientEmail = parentStudent.parent.email;
        recipientName = `${parentStudent.parent.firstName} ${parentStudent.parent.lastName}`;
      }
    }

    const deliveryResult = await this.credentialDeliveryService.deliverCredentials({
      userId,
      userCredentialId: credential.id,
      recipientEmail,
      recipientPhone: user.phone || undefined,
      username,
      password: generatedPassword.password,
      recipientName,
      role,
      schoolName: school?.name,
      schoolUrl,
      channel,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });

    await this.securityAuditService.log({
      userId,
      action: 'CREDENTIALS_GENERATED',
      details: `Credentials generated and delivered via ${channel} by admin ${adminId}`,
    });

    return {
      credentialId: credential.id,
      username,
      deliveryChannel: channel,
      deliveryStatus: deliveryResult.success ? 'DELIVERED' : 'FAILED',
      requiresPasswordChange: true,
    };
  }

  async bulkGenerateCredentials(
    userIds: string[],
    adminId: string,
    channel: 'SMS' | 'EMAIL' | 'WHATSAPP' = 'EMAIL',
  ) {
    const results = [];
    for (const userId of userIds) {
      try {
        const result = await this.generateAndDeliverCredentials(userId, adminId, channel);
        results.push({ userId, success: true, ...result });
      } catch (error: any) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    return { total: userIds.length, succeeded: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
  }

  async resendCredentials(userId: string, adminId: string, channel: 'SMS' | 'EMAIL' | 'WHATSAPP') {
    const credential = await this.prisma.userCredential.findFirst({
      where: { userId, deliveryStatus: { in: ['DELIVERED', 'PENDING'] } },
      orderBy: { generatedAt: 'desc' },
    });

    if (!credential) throw new BadRequestException('No previous credentials found. Generate new credentials instead.');

    return this.generateAndDeliverCredentials(userId, adminId, channel);
  }

  async resetPassword(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) throw new NotFoundException('User not found');

    const role = user.userRoles[0]?.role?.name || 'User';
    const generatedPassword = this.passwordGenService.generateRoleBasedPassword(role);

    await this.prisma.$transaction([
      this.prisma.passwordHistory.create({
        data: { userId, passwordHash: user.password },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          password: generatedPassword.hash,
          mustChangePassword: true,
          lastPasswordChange: new Date(),
        },
      }),
    ]);

    await this.securityAuditService.log({
      userId,
      action: 'PASSWORD_RESET_BY_ADMIN',
      details: `Password reset by admin ${adminId}`,
    });

    return { message: 'Password reset successfully', newPassword: generatedPassword.password };
  }

  async lockAccount(userId: string, adminId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: 'LOCKED' },
    });

    await this.sessionManagementService.invalidateAllUserSessions(userId);

    await this.securityAuditService.log({
      userId,
      action: 'ACCOUNT_LOCKED_BY_ADMIN',
      details: `Account locked by admin ${adminId}. Reason: ${reason || 'No reason provided'}`,
    });

    return { message: 'Account locked successfully' };
  }

  async unlockAccount(userId: string, adminId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'ACTIVE',
        failedAttempts: 0,
        lockoutUntil: null,
      },
    });

    await this.securityAuditService.log({
      userId,
      action: 'ACCOUNT_UNLOCKED_BY_ADMIN',
      details: `Account unlocked by admin ${adminId}. Reason: ${reason || 'No reason provided'}`,
    });

    return { message: 'Account unlocked successfully' };
  }

  async toggleMfa(userId: string, adminId: string, enable: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: enable },
    });

    await this.securityAuditService.log({
      userId,
      action: enable ? 'MFA_ENABLED' : 'MFA_DISABLED',
      details: `MFA ${enable ? 'enabled' : 'disabled'} by admin ${adminId}`,
    });

    return { message: `MFA ${enable ? 'enabled' : 'disabled'} successfully` };
  }

  async forceLogoutAllDevices(userId: string, adminId: string) {
    const count = await this.sessionManagementService.invalidateAllUserSessions(userId);

    await this.securityAuditService.log({
      userId,
      action: 'FORCE_LOGOUT_ALL',
      details: `All ${count} sessions invalidated by admin ${adminId}`,
    });

    return { message: `Logged out from ${count} device(s)` };
  }

  async getSecurityLogs(userId: string) {
    return this.securityAuditService.getSecuritySummary(userId);
  }

  async getAuditLogs(query: any) {
    return this.securityAuditService.getAuditLogs(query, { page: query.page || 1, limit: query.limit || 50 });
  }

  async getActiveSessions(userId: string) {
    return this.sessionManagementService.getActiveSessions(userId);
  }

  async getDevices(userId: string) {
    return this.prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async registerDevice(userId: string, data: any) {
    const existing = await this.prisma.deviceSession.findUnique({
      where: { userId_deviceId: { userId, deviceId: data.deviceId } },
    });

    if (existing) {
      return this.prisma.deviceSession.update({
        where: { id: existing.id },
        data: {
          deviceName: data.deviceName,
          deviceType: data.deviceType,
          platform: data.platform,
          os: data.os,
          browser: data.browser,
          pushToken: data.pushToken,
          lastUsedAt: new Date(),
        },
      });
    }

    return this.prisma.deviceSession.create({
      data: {
        userId,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        deviceType: data.deviceType || 'UNKNOWN',
        platform: data.platform || 'WEB',
        os: data.os,
        browser: data.browser,
        pushToken: data.pushToken,
      },
    });
  }

  async removeDevice(userId: string, deviceId: string) {
    await this.prisma.deviceSession.deleteMany({
      where: { userId, deviceId },
    });

    await this.securityAuditService.log({
      userId,
      action: 'DEVICE_REMOVED',
      details: `Device ${deviceId} removed`,
    });

    return { message: 'Device removed successfully' };
  }

  async getDeliveryHistory(userId: string) {
    return this.prisma.credentialDeliveryLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getAccountCenterData(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        deviceSessions: { where: { isActive: true } },
        loginSessions: { where: { isActive: true } },
      },
    });

    if (!user) {
      const sysUser = await this.prisma.systemUser.findUnique({
        where: { id: userId },
      });

      if (!sysUser) throw new NotFoundException('User not found');

      return {
        profile: {
          id: sysUser.id,
          firstName: sysUser.fullName,
          lastName: '',
          email: sysUser.email,
          phone: sysUser.phone || '',
          username: sysUser.email,
          roles: ['SUPER_ADMIN'],
        },
        security: {
          accountStatus: 'ACTIVE',
          mustChangePassword: false,
          mfaEnabled: false,
          lastLogin: null,
          lastPasswordChange: null,
          failedAttempts: 0,
        },
        sessions: {
          activeSessions: 0,
          activeDevices: 0,
        },
      };
    }

    return {
      profile: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        username: user.username,
        roles: user.userRoles.map(ur => ur.role.name),
      },
      security: {
        accountStatus: user.accountStatus,
        mustChangePassword: user.mustChangePassword,
        mfaEnabled: user.mfaEnabled,
        lastLogin: user.lastLogin,
        lastPasswordChange: user.lastPasswordChange,
        failedAttempts: user.failedAttempts,
      },
      sessions: {
        activeSessions: user.loginSessions.length,
        activeDevices: user.deviceSessions.length,
      },
    };
  }

  async updateProfile(userId: string, data: { email?: string; phone?: string; firstName?: string; lastName?: string }) {
    const updateData: any = {};
    if (data.email) updateData.email = data.email.toLowerCase();
    if (data.phone) updateData.phone = data.phone;
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;

    const existingUser = await this.prisma.user.findUnique({ where: { id: userId } });

    if (existingUser) {
      if (data.email) {
        const existing = await this.prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
        if (existing && existing.id !== userId) {
          throw new BadRequestException('Email already in use');
        }
      }

      const user = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      await this.securityAuditService.log({
        userId,
        action: 'PROFILE_UPDATED',
        details: 'Profile updated by user',
      });

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      };
    }

    const sysUser = await this.prisma.systemUser.findUnique({ where: { id: userId } });
    if (!sysUser) throw new NotFoundException('User not found');

    const sysUpdateData: any = {};
    if (data.email) sysUpdateData.email = data.email.toLowerCase();
    if (data.phone) sysUpdateData.phone = data.phone;
    if (data.firstName) sysUpdateData.fullName = data.firstName + (data.lastName ? ` ${data.lastName}` : '');
    if (data.lastName && !data.firstName) {
      const current = sysUser;
      sysUpdateData.fullName = `${current.fullName} ${data.lastName}`;
    }

    if (data.email) {
      const existing = await this.prisma.systemUser.findUnique({ where: { email: data.email.toLowerCase() } });
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Email already in use');
      }
    }

    const updated = await this.prisma.systemUser.update({
      where: { id: userId },
      data: sysUpdateData,
    });

    return {
      id: updated.id,
      firstName: updated.fullName,
      lastName: '',
      email: updated.email,
      phone: updated.phone || '',
    };
  }

  async setPassword(userId: string, newPassword: string) {
    const validation = this.passwordGenService.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    const hash = crypto.createHash('sha256').update(newPassword).digest('hex');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction([
      this.prisma.passwordHistory.create({
        data: { userId, passwordHash: user.password },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hash,
          mustChangePassword: false,
          lastPasswordChange: new Date(),
        },
      }),
    ]);

    await this.securityAuditService.log({
      userId,
      action: 'PASSWORD_SET',
      details: 'Password set by admin',
    });

    return { message: 'Password set successfully' };
  }
}
