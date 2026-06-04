import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private prisma: PrismaService) {}

  async generateOtp(
    userId: string,
    purpose: string,
    channel: string,
    recipient: string,
    expiryMinutes: number = 10,
  ): Promise<string> {
    const otpCode = crypto.randomInt(100000, 999999).toString();

    await this.prisma.otpVerification.create({
      data: {
        userId,
        otpCode: await this.hashOtp(otpCode),
        purpose,
        channel,
        recipient,
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
        maxAttempts: 5,
      },
    });

    return otpCode;
  }

  async verifyOtp(
    userId: string,
    otpCode: string,
    purpose: string,
  ): Promise<{ valid: boolean; message: string }> {
    const hashedInput = await this.hashOtp(otpCode);

    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        userId,
        purpose,
        verifiedAt: null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return { valid: false, message: 'No valid OTP found. Request a new one.' };
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      return { valid: false, message: 'Maximum OTP attempts exceeded. Request a new one.' };
    }

    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    if (otpRecord.otpCode !== hashedInput) {
      return { valid: false, message: 'Invalid OTP code.' };
    }

    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    return { valid: true, message: 'OTP verified successfully.' };
  }

  async sendOtp(
    userId: string,
    purpose: string,
    channel: string,
    recipient: string,
  ): Promise<{ sent: boolean; message: string }> {
    const otp = await this.generateOtp(userId, purpose, channel, recipient);

    try {
      switch (channel) {
        case 'EMAIL':
          this.logger.log(`[OTP] Sending OTP ${otp} to email ${recipient}`);
          break;
        case 'SMS':
          this.logger.log(`[OTP] Sending OTP ${otp} to SMS ${recipient}`);
          break;
        case 'WHATSAPP':
          this.logger.log(`[OTP] Sending OTP ${otp} via WhatsApp to ${recipient}`);
          break;
      }

      await this.prisma.accountSecurityLog.create({
        data: {
          userId,
          action: 'OTP_SENT',
          details: `OTP sent via ${channel} for ${purpose}`,
        },
      });

      return { sent: true, message: `OTP sent to ${recipient} via ${channel}` };
    } catch (error: any) {
      this.logger.error(`Failed to send OTP: ${error.message}`);
      return { sent: false, message: 'Failed to send OTP.' };
    }
  }

  private async hashOtp(otp: string): Promise<string> {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }
}
