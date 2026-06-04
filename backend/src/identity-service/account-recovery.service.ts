import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp.service';
import { PasswordGenerationService } from './password-generation.service';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class AccountRecoveryService {
  private readonly logger = new Logger(AccountRecoveryService.name);

  constructor(
    private prisma: PrismaService,
    private otpService: OtpService,
    private passwordService: PasswordGenerationService,
    private emailService: EmailService,
  ) {}

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { message: 'If an account exists with that email, recovery instructions have been sent.' };
    }

    const otp = await this.otpService.sendOtp(
      user.id,
      'PASSWORD_RESET',
      'EMAIL',
      user.email,
    );

    await this.prisma.accountSecurityLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        details: 'Password reset requested via email',
      },
    });

    return { message: 'If an account exists with that email, recovery instructions have been sent.' };
  }

  async forgotUsername(email: string): Promise<{ message: string; username?: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !user.username) {
      return { message: 'If an account exists, your username will be sent to your email.' };
    }

    if (user.email) {
      await this.emailService.sendMail(
        user.email,
        'Your SmartTech Account Username',
        `Your username is: ${user.username}`,
      );
    }

    return { message: 'If an account exists, your username has been sent to your email.' };
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const validation = this.passwordService.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');

    await this.prisma.$transaction([
      this.prisma.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash: user.password,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
          resetToken: null,
          resetTokenExpiry: null,
          mustChangePassword: false,
          lastPasswordChange: new Date(),
        },
      }),
      this.prisma.accountSecurityLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_RESET_COMPLETED',
          details: 'Password reset completed successfully',
        },
      }),
    ]);

    return { message: 'Password has been reset successfully.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new BadRequestException('User not found');

    const validation = this.passwordService.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    const recentPasswords = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { changedAt: 'desc' },
      take: 5,
    });

    const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    for (const history of recentPasswords) {
      if (history.passwordHash === newHash) {
        throw new BadRequestException('Cannot reuse a recent password');
      }
    }

    await this.prisma.$transaction([
      this.prisma.passwordHistory.create({
        data: {
          userId,
          passwordHash: user.password,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          password: newHash,
          mustChangePassword: false,
          lastPasswordChange: new Date(),
        },
      }),
      this.prisma.accountSecurityLog.create({
        data: {
          userId,
          action: 'PASSWORD_CHANGED',
          details: 'Password changed by user',
        },
      }),
    ]);

    return { message: 'Password changed successfully.' };
  }

  async forcePasswordChange(userId: string, adminId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });

    await this.prisma.accountSecurityLog.create({
      data: {
        userId,
        action: 'PASSWORD_CHANGE_FORCED',
        details: `Password change forced by admin ${adminId}`,
      },
    });

    return { message: 'User will be required to change password on next login.' };
  }
}
