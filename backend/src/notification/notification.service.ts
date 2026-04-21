import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CredentialNotificationData {
  recipientName: string;
  email?: string;
  phone?: string;
  username: string;
  password: string;
  role: string;
  schoolName?: string;
  schoolUrl?: string;
  appDownloadUrl?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  async sendCredentials(data: CredentialNotificationData): Promise<void> {
    this.logger.log(`Sending credentials to ${data.recipientName} (${data.email || data.phone})`);

    const message = this.buildCredentialMessage(data);

    if (data.email) {
      await this.sendEmail(data.email, 'Your Login Credentials', message);
    }

    if (data.phone) {
      await this.sendSMS(data.phone, message);
    }

    this.logger.log(`Credentials sent successfully to ${data.recipientName}`);
  }

  private buildCredentialMessage(data: CredentialNotificationData): string {
    const lines = [
      `Hello ${data.recipientName},`,
      '',
      `Your ${data.role} account has been created.`,
      '',
      'LOGIN CREDENTIALS:',
      `Username: ${data.username}`,
      `Password: ${data.password}`,
      '',
    ];

    if (data.schoolName) {
      lines.push(`School: ${data.schoolName}`);
    }

    if (data.schoolUrl) {
      lines.push(`Login URL: ${data.schoolUrl}`);
    }

    if (data.appDownloadUrl) {
      lines.push('');
      lines.push(`Download App:`);
      lines.push(`Google Play: ${data.appDownloadUrl}`);
    }

    lines.push('');
    lines.push('Please change your password after first login.');

    return lines.join('\n');
  }

  private async sendEmail(to: string, subject: string, message: string): Promise<void> {
    this.logger.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
    this.logger.debug(`[EMAIL] Message: ${message}`);
  }

  private async sendSMS(phone: string, message: string): Promise<void> {
    this.logger.log(`[SMS] To: ${phone}`);
    this.logger.debug(`[SMS] Message: ${message}`);
  }

  async sendWhatsApp(phone: string, message: string): Promise<void> {
    this.logger.log(`[WHATSAPP] To: ${phone}`);
    this.logger.debug(`[WHATSAPP] Message: ${message}`);
  }
}
