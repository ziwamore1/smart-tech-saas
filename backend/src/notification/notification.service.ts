import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { BeemService } from '../beem/beem.service';

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

export interface AttendanceNotificationData {
  recipientName: string;
  email?: string;
  phone?: string;
  studentName: string;
  date: string;
  status: string;
  schoolName?: string;
}

export interface ResultNotificationData {
  recipientName: string;
  email?: string;
  phone?: string;
  studentName: string;
  term: string;
  subject?: string;
  grade?: string;
  schoolName?: string;
  reportUrl?: string;
}

export interface FeeNotificationData {
  recipientName: string;
  email?: string;
  phone?: string;
  studentName: string;
  amount: string;
  dueDate: string;
  schoolName?: string;
  paymentUrl?: string;
}

export interface ApprovalNotificationData {
  recipientName: string;
  email?: string;
  phone?: string;
  approverName: string;
  documentType: string;
  documentName: string;
  actionRequired: string;
  approvalUrl?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private beemService: BeemService,
  ) {}

  async sendCredentials(data: CredentialNotificationData): Promise<void> {
    this.logger.log(`Sending credentials to ${data.recipientName} (${data.email || data.phone})`);

    if (data.email) {
      try {
        await this.emailService.sendCredentialsEmail(data.email, {
          recipientName: data.recipientName,
          username: data.username,
          password: data.password,
          role: data.role,
          schoolName: data.schoolName,
          loginUrl: data.schoolUrl,
        });
        await this.logNotification(data.email, 'email', 'credentials', 'sent');
        this.logger.log(`Credentials email sent to ${data.email}`);
      } catch (error) {
        this.logger.error(`Failed to send credentials email to ${data.email}: ${error.message}`);
        await this.logNotification(data.email, 'email', 'credentials', 'failed');
      }
    }

    if (data.phone) {
      const message = this.buildCredentialMessage(data);
      await this.sendSMS(data.phone, message);
    }
  }

  async sendAttendanceAlert(data: AttendanceNotificationData): Promise<void> {
    this.logger.log(`Sending attendance alert for ${data.studentName} to ${data.email || data.phone}`);

    if (data.email) {
      try {
        await this.emailService.sendAttendanceAlert(data.email, {
          studentName: data.studentName,
          date: data.date,
          status: data.status,
          schoolName: data.schoolName,
        });
        await this.logNotification(data.email, 'email', 'attendance_alert', 'sent');
        this.logger.log(`Attendance alert sent to ${data.email}`);
      } catch (error) {
        this.logger.error(`Failed to send attendance alert to ${data.email}: ${error.message}`);
        await this.logNotification(data.email, 'email', 'attendance_alert', 'failed');
      }
    }

    if (data.phone) {
      const message = `Attendance alert: ${data.studentName} was marked ${data.status} on ${data.date}.`;
      await this.sendSMS(data.phone, message);
    }
  }

  async sendResultNotification(data: ResultNotificationData): Promise<void> {
    this.logger.log(`Sending result notification for ${data.studentName} to ${data.email || data.phone}`);

    if (data.email) {
      try {
        await this.emailService.sendResultNotification(data.email, {
          studentName: data.studentName,
          term: data.term,
          subject: data.subject,
          grade: data.grade,
          schoolName: data.schoolName,
          reportUrl: data.reportUrl,
        });
        await this.logNotification(data.email, 'email', 'result_notification', 'sent');
        this.logger.log(`Result notification sent to ${data.email}`);
      } catch (error) {
        this.logger.error(`Failed to send result notification to ${data.email}: ${error.message}`);
        await this.logNotification(data.email, 'email', 'result_notification', 'failed');
      }
    }

    if (data.phone) {
      const message = `Results published for ${data.studentName} - ${data.term}. ${data.grade ? `Grade: ${data.grade}` : ''}`;
      await this.sendSMS(data.phone, message);
    }
  }

  async sendFeeReminder(data: FeeNotificationData): Promise<void> {
    this.logger.log(`Sending fee reminder for ${data.studentName} to ${data.email || data.phone}`);

    if (data.email) {
      try {
        await this.emailService.sendFeeReminder(data.email, {
          studentName: data.studentName,
          amount: data.amount,
          dueDate: data.dueDate,
          schoolName: data.schoolName,
          paymentUrl: data.paymentUrl,
        });
        await this.logNotification(data.email, 'email', 'fee_reminder', 'sent');
        this.logger.log(`Fee reminder sent to ${data.email}`);
      } catch (error) {
        this.logger.error(`Failed to send fee reminder to ${data.email}: ${error.message}`);
        await this.logNotification(data.email, 'email', 'fee_reminder', 'failed');
      }
    }

    if (data.phone) {
      const message = `Fee reminder: ${data.amount} due on ${data.dueDate} for ${data.studentName}.`;
      await this.sendSMS(data.phone, message);
    }
  }

  async sendApprovalNotification(data: ApprovalNotificationData): Promise<void> {
    this.logger.log(`Sending approval notification to ${data.email || data.phone}`);

    if (data.email) {
      try {
        await this.emailService.sendApprovalNotification(data.email, {
          approverName: data.approverName,
          documentType: data.documentType,
          documentName: data.documentName,
          actionRequired: data.actionRequired,
          approvalUrl: data.approvalUrl,
        });
        await this.logNotification(data.email, 'email', 'approval_notification', 'sent');
        this.logger.log(`Approval notification sent to ${data.email}`);
      } catch (error) {
        this.logger.error(`Failed to send approval notification to ${data.email}: ${error.message}`);
        await this.logNotification(data.email, 'email', 'approval_notification', 'failed');
      }
    }

    if (data.phone) {
      const message = `Approval required: ${data.documentName} needs your ${data.actionRequired}.`;
      await this.sendSMS(data.phone, message);
    }
  }

  async sendGenericEmail(to: string, subject: string, message: string): Promise<void> {
    this.logger.log(`Sending email to ${to} with subject: ${subject}`);

    try {
      await this.emailService.sendMail(to, subject, `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;"><h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1></div><div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"><h2 style="color: #1f2937; margin-top: 0;">${subject}</h2><div style="color: #6b7280; font-size: 16px; line-height: 1.6;">${message}</div></div><div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;"><p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p></div></div>`);
      await this.logNotification(to, 'email', 'generic', 'sent');
      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      await this.logNotification(to, 'email', 'generic', 'failed');
    }
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

  private async sendSMS(phone: string, message: string): Promise<void> {
    if (this.beemService.isConfigured()) {
      try {
        const result = await this.beemService.sendSms(phone, message);
        if (result.success) {
          this.logger.log(`[Beem SMS] Sent to ${phone}, messageId: ${result.messageId}`);
          await this.logNotification(phone, 'sms', 'generic', 'sent', undefined, message);
        } else {
          this.logger.error(`[Beem SMS] Failed to ${phone}: ${result.error}`);
          await this.logNotification(phone, 'sms', 'generic', 'failed', undefined, message, result.error);
        }
      } catch (error) {
        this.logger.error(`[Beem SMS] Error: ${error.message}`);
        await this.logNotification(phone, 'sms', 'generic', 'failed', undefined, message, error.message);
      }
    } else {
      this.logger.log(`[SMS] To: ${phone}`);
      this.logger.debug(`[SMS] Message: ${message}`);
      await this.logNotification(phone, 'sms', 'generic', 'sent');
    }
  }

  async sendWhatsApp(phone: string, message: string): Promise<void> {
    if (this.beemService.isConfigured()) {
      try {
        const result = await this.beemService.sendWhatsApp(phone, message);
        if (result.success) {
          this.logger.log(`[Beem WhatsApp] Sent to ${phone}, messageId: ${result.messageId}`);
          await this.logNotification(phone, 'whatsapp', 'generic', 'sent', undefined, message);
        } else {
          this.logger.error(`[Beem WhatsApp] Failed to ${phone}: ${result.error}`);
          await this.logNotification(phone, 'whatsapp', 'generic', 'failed', undefined, message, result.error);
        }
      } catch (error) {
        this.logger.error(`[Beem WhatsApp] Error: ${error.message}`);
        await this.logNotification(phone, 'whatsapp', 'generic', 'failed', undefined, message, error.message);
      }
    } else {
      this.logger.log(`[WHATSAPP] To: ${phone}`);
      this.logger.debug(`[WHATSAPP] Message: ${message}`);
      await this.logNotification(phone, 'whatsapp', 'generic', 'sent');
    }
  }

  async sendVoiceOtp(phone: string, otp: string, language?: string): Promise<void> {
    this.logger.warn(`[Voice OTP] Voice OTP not supported by Beem Africa. Cannot send OTP to ${phone}`);
    await this.logNotification(phone, 'voice', 'otp', 'failed', undefined, `OTP: ${otp}`, 'Voice OTP not supported by Beem');
  }

  private async logNotification(
    recipient: string,
    channel: string,
    type: string,
    status: string,
    subject?: string,
    message?: string,
    error?: string,
  ): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          recipient,
          channel,
          type,
          status,
          subject,
          message,
          error,
          sentAt: status === 'sent' ? new Date() : null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to log notification: ${err.message}`);
    }
  }
}
