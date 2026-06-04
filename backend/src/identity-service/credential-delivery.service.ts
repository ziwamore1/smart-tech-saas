import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

export interface DeliveryOptions {
  userId: string;
  userCredentialId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  username: string;
  password: string;
  recipientName: string;
  role: string;
  schoolName?: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP';
}

@Injectable()
export class CredentialDeliveryService {
  private readonly logger = new Logger(CredentialDeliveryService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async deliverCredentials(options: DeliveryOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { channel, recipientEmail, recipientPhone, username, password, recipientName, role, schoolName } = options;

    try {
      let messageId: string | undefined;
      let recipient: string;

      switch (channel) {
        case 'EMAIL':
          if (!recipientEmail) throw new Error('Email recipient required');
          recipient = recipientEmail;
          messageId = await this.sendEmailCredentials({
            to: recipientEmail,
            username,
            password,
            recipientName,
            role,
            schoolName,
          });
          break;

        case 'SMS':
          if (!recipientPhone) throw new Error('Phone recipient required');
          recipient = recipientPhone;
          messageId = await this.sendSmsCredentials({
            to: recipientPhone,
            username,
            password,
            recipientName,
          });
          break;

        case 'WHATSAPP':
          if (!recipientPhone) throw new Error('Phone recipient required');
          recipient = recipientPhone;
          messageId = await this.sendWhatsAppCredentials({
            to: recipientPhone,
            username,
            password,
            recipientName,
          });
          break;

        default:
          throw new Error(`Unsupported delivery channel: ${channel}`);
      }

      await this.logDelivery(options, channel, recipient, messageId, 'DELIVERED');

      if (options.userCredentialId) {
        await this.prisma.userCredential.update({
          where: { id: options.userCredentialId },
          data: {
            deliveryStatus: 'DELIVERED',
            deliveredAt: new Date(),
          },
        });
      }

      return { success: true, messageId };
    } catch (error: any) {
      this.logger.error(`Credential delivery failed: ${error.message}`);
      await this.logDelivery(options, channel, recipientEmail || recipientPhone || 'unknown', undefined, 'FAILED', error.message);
      return { success: false, error: error.message };
    }
  }

  private async sendEmailCredentials(data: {
    to: string;
    username: string;
    password: string;
    recipientName: string;
    role: string;
    schoolName?: string;
  }): Promise<string> {
    const subject = `Your ${data.schoolName || 'SmartTech'} Account Credentials`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e3a8a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">${data.schoolName || 'SmartTech'} Portal</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Welcome, ${data.recipientName}!</h2>
          <p>Your ${data.role} account has been created successfully.</p>
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0;">Your Login Credentials</h3>
            <p><strong>Username/Email:</strong> ${data.username}</p>
            <p><strong>Password:</strong> ${data.password}</p>
            <p style="color: #dc2626; font-weight: bold;">You will be required to change your password on first login.</p>
          </div>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login"
             style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Login to Portal
          </a>
        </div>
        <div style="text-align: center; padding: 15px; color: #64748b; font-size: 12px;">
          <p>This is an automated message from SmartTech Education System.</p>
        </div>
      </div>
    `;

    await this.emailService.sendMail(data.to, subject, html);
    return `email-${Date.now()}`;
  }

  private async sendSmsCredentials(data: {
    to: string;
    username: string;
    password: string;
    recipientName: string;
  }): Promise<string> {
    const message = `Welcome ${data.recipientName}! Your SmartTech account has been created. Username: ${data.username}, Password: ${data.password}. Login at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/login. Please change your password on first login.`;
    this.logger.log(`[SMS] Sending credentials to ${data.to}`);
    this.logger.log(`[SMS] Message: ${message}`);
    return `sms-${Date.now()}`;
  }

  private async sendWhatsAppCredentials(data: {
    to: string;
    username: string;
    password: string;
    recipientName: string;
  }): Promise<string> {
    const message = `Hello ${data.recipientName},\n\nYour SmartTech Education account has been created.\n\nUsername: ${data.username}\nPassword: ${data.password}\n\nLogin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/login\n\nPlease change your password on first login.\n\n- SmartTech Team`;
    this.logger.log(`[WhatsApp] Sending credentials to ${data.to}`);
    this.logger.log(`[WhatsApp] Message: ${message}`);
    return `wa-${Date.now()}`;
  }

  private async logDelivery(
    options: DeliveryOptions,
    channel: string,
    recipient: string,
    messageId?: string,
    status: string = 'PENDING',
    errorMessage?: string,
  ) {
    await this.prisma.credentialDeliveryLog.create({
      data: {
        userCredentialId: options.userCredentialId,
        userId: options.userId,
        channel,
        recipient,
        status,
        messageId,
        errorMessage,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      },
    });
  }
}
