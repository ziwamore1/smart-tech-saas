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
  schoolUrl?: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP';
}

export interface BundledCredentialOptions {
  parentUserId: string;
  studentUserId: string;
  parentEmail?: string;
  parentPhone?: string;
  parentUsername: string;
  parentPassword: string;
  parentName: string;
  studentUsername: string;
  studentPassword: string;
  studentName: string;
  schoolName?: string;
  schoolUrl?: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP' | 'BUNDLED';
}

@Injectable()
export class CredentialDeliveryService {
  private readonly logger = new Logger(CredentialDeliveryService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  private getLoginUrl(schoolUrl?: string): string {
    return schoolUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
  }

  async deliverCredentials(options: DeliveryOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { channel, recipientEmail, recipientPhone, username, password, recipientName, role, schoolName, schoolUrl } = options;

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
            schoolUrl,
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
            schoolUrl,
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
            schoolUrl,
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

  async deliverBundledCredentials(options: BundledCredentialOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { parentEmail, parentPhone, parentUsername, parentPassword, parentName, studentUsername, studentPassword, studentName, schoolName, schoolUrl } = options;

    const loginUrl = this.getLoginUrl(schoolUrl);

    try {
      let recipient: string;
      let messageId: string;

      if (parentEmail) {
        recipient = parentEmail;
        messageId = await this.sendBundledEmail({
          to: parentEmail,
          parentName,
          parentUsername,
          parentPassword,
          studentName,
          studentUsername,
          studentPassword,
          schoolName,
          loginUrl,
        });
      } else if (parentPhone) {
        recipient = parentPhone;
        messageId = await this.sendBundledSms({
          to: parentPhone,
          parentName,
          parentUsername,
          parentPassword,
          studentName,
          studentUsername,
          studentPassword,
          loginUrl,
        });
      } else {
        throw new Error('Parent email or phone required for bundled delivery');
      }

      this.logger.log(`[Bundled Credentials] Sent to ${recipient} for ${parentName} & ${studentName}`);
      return { success: true, messageId };
    } catch (error: any) {
      this.logger.error(`Bundled credential delivery failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async sendBundledEmail(data: {
    to: string;
    parentName: string;
    parentUsername: string;
    parentPassword: string;
    studentName: string;
    studentUsername: string;
    studentPassword: string;
    schoolName?: string;
    loginUrl: string;
  }): Promise<string> {
    const subject = `Your ${data.schoolName || 'SmartTech'} Login Credentials`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e3a8a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">${data.schoolName || 'SmartTech'} Portal</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Welcome, ${data.parentName}!</h2>
          <p>Your account and your child's account have been created.</p>

          <div style="background: #e0f2fe; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #bae6fd;">
            <h3 style="margin-top: 0; color: #0369a1;">Your Login Credentials (Parent)</h3>
            <p><strong>Username/Email:</strong> ${data.parentUsername}</p>
            <p><strong>Password:</strong> ${data.parentPassword}</p>
          </div>

          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #fde68a;">
            <h3 style="margin-top: 0; color: #92400e;">Student Login Credentials</h3>
            <p><strong>Student:</strong> ${data.studentName}</p>
            <p><strong>Username:</strong> ${data.studentUsername}</p>
            <p><strong>Password:</strong> ${data.studentPassword}</p>
          </div>

          <p style="color: #dc2626; font-weight: bold;">Both accounts require a password change on first login.</p>

          <a href="${data.loginUrl}"
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
    return `bundle-email-${Date.now()}`;
  }

  private async sendBundledSms(data: {
    to: string;
    parentName: string;
    parentUsername: string;
    parentPassword: string;
    studentName: string;
    studentUsername: string;
    studentPassword: string;
    loginUrl: string;
  }): Promise<string> {
    const message =
      `Hello ${data.parentName},\n\n` +
      `Your account: User: ${data.parentUsername}, Pass: ${data.parentPassword}\n\n` +
      `Student (${data.studentName}) account: User: ${data.studentUsername}, Pass: ${data.studentPassword}\n\n` +
      `Login: ${data.loginUrl}\n\nChange passwords on first login. - SmartTech`;
    this.logger.log(`[SMS] Bundled credentials sent to ${data.to}`);
    this.logger.log(`[SMS] Message: ${message}`);
    return `bundle-sms-${Date.now()}`;
  }

  async deliverStudentCredentialsOnRequest(options: DeliveryOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { channel, recipientEmail, username, password, recipientName, role, schoolName, schoolUrl } = options;
    const loginUrl = this.getLoginUrl(schoolUrl);

    try {
      let messageId: string;
      let recipient: string;

      if (channel === 'EMAIL' && recipientEmail) {
        recipient = recipientEmail;
        const subject = `Student Login Credentials - ${schoolName || 'SmartTech'}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e3a8a; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">${schoolName || 'SmartTech'} Portal</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <h2>Hello ${recipientName}!</h2>
              <p>Your student login credentials are ready.</p>
              <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #fde68a;">
                <h3 style="margin-top: 0; color: #92400e;">Student Login Credentials</h3>
                <p><strong>Role:</strong> ${role}</p>
                <p><strong>Username:</strong> ${username}</p>
                <p><strong>Password:</strong> ${password}</p>
              </div>
              <a href="${loginUrl}"
                 style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Login to Portal
              </a>
            </div>
          </div>`;
        await this.emailService.sendMail(recipientEmail, subject, html);
        messageId = `student-email-${Date.now()}`;
      } else if (recipientPhone) {
        recipient = recipientPhone;
        const text = `Hello ${recipientName}, your student login is ready. User: ${username}, Pass: ${password}. Login: ${loginUrl}. Change password on first login. - SmartTech`;
        this.logger.log(`[SMS] Student credentials sent to ${recipientPhone}`);
        messageId = `student-sms-${Date.now()}`;
      } else {
        throw new Error('Recipient email or phone required');
      }

      return { success: true, messageId };
    } catch (error: any) {
      this.logger.error(`Student credential delivery failed: ${error.message}`);
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
    schoolUrl?: string;
  }): Promise<string> {
    const loginUrl = this.getLoginUrl(data.schoolUrl);
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
          <a href="${loginUrl}"
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
    schoolUrl?: string;
  }): Promise<string> {
    const loginUrl = this.getLoginUrl(data.schoolUrl);
    const message = `Welcome ${data.recipientName}! Your SmartTech account has been created. Username: ${data.username}, Password: ${data.password}. Login at: ${loginUrl}. Please change your password on first login.`;
    this.logger.log(`[SMS] Sending credentials to ${data.to}`);
    this.logger.log(`[SMS] Message: ${message}`);
    return `sms-${Date.now()}`;
  }

  private async sendWhatsAppCredentials(data: {
    to: string;
    username: string;
    password: string;
    recipientName: string;
    schoolUrl?: string;
  }): Promise<string> {
    const loginUrl = this.getLoginUrl(data.schoolUrl);
    const message = `Hello ${data.recipientName},\n\nYour SmartTech Education account has been created.\n\nUsername: ${data.username}\nPassword: ${data.password}\n\nLogin: ${loginUrl}\n\nPlease change your password on first login.\n\n- SmartTech Team`;
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
