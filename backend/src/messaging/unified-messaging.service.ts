import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BeemService } from '../beem/beem.service';
import sgMail from '@sendgrid/mail';

interface UserInfo {
  id?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

interface MessagingResult {
  success: boolean;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  messageId?: string;
  error?: string;
}

interface NotificationResult {
  email?: MessagingResult;
  sms?: MessagingResult;
  whatsapp?: MessagingResult;
  errors: string[];
}

const APP_DOWNLOAD_URL = 'https://play.google.com/store/apps/details?id=com.smarttech.app';

const templates = {
  directorWelcome: (data: { username: string; password: string; schoolName: string; schoolUrl: string }) =>
    `Welcome to Smart_Tech!

You have been registered as a School Director.

School: ${data.schoolName}

Login Details:
Username: ${data.username}
Password: ${data.password}

School URL:
${data.schoolUrl}

Download App:
${APP_DOWNLOAD_URL}

Best regards,
Smart Tech Team`,

  teacherWelcome: (data: { username: string; password: string; schoolName: string }) =>
    `Welcome to Smart_Tech!

You have been added as a Teacher.

School: ${data.schoolName}

Login Details:
Username: ${data.username}
Password: ${data.password}

Download App:
${APP_DOWNLOAD_URL}

Best regards,
Smart Tech Team`,

  parentWelcome: (data: { username: string; password: string; childName: string; schoolName: string }) =>
    `Welcome to Smart_Tech!

You can now monitor your child's performance.

School: ${data.schoolName}
Child: ${data.childName}

Login Details:
Username: ${data.username}
Password: ${data.password}

Download App:
${APP_DOWNLOAD_URL}

Best regards,
Smart Tech Team`,

  studentWelcome: (data: { username: string; password: string; studentName: string; schoolName: string }) =>
    `Welcome to Smart_Tech!

Your student account has been created.

Student: ${data.studentName}
School: ${data.schoolName}

Login Details:
Username: ${data.username}
Password: ${data.password}

Download App:
${APP_DOWNLOAD_URL}

Best regards,
Smart Tech Team`,

  customMessage: (data: { message: string }) => data.message,
};

@Injectable()
export class UnifiedMessagingService {
  private readonly logger = new Logger(UnifiedMessagingService.name);
  private readonly envSandboxMode: boolean;
  private sandboxModeCache: boolean | null = null;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private sendgridApiKey: string;
  private sendgridFromEmail: string;
  private sendgridFromName: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private beemService: BeemService,
  ) {
    this.envSandboxMode = this.configService.get<string>('MESSAGING_SANDBOX_MODE', 'true') === 'true';
    this.retryAttempts = parseInt(this.configService.get<string>('MESSAGING_RETRY_ATTEMPTS', '3'), 10);
    this.retryDelay = parseInt(this.configService.get<string>('MESSAGING_RETRY_DELAY_MS', '5000'), 10);
    this.sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY', '');
    this.sendgridFromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL', 'noreply@smarttechsaas.com');
    this.sendgridFromName = this.configService.get<string>('SENDGRID_FROM_NAME', 'Smart Tech');

    if (this.sendgridApiKey && this.sendgridApiKey !== 'your_sendgrid_api_key') {
      sgMail.setApiKey(this.sendgridApiKey);
      this.logger.log('[SendGrid] API initialized');
    }
  }

  private async checkSandboxMode(): Promise<boolean> {
    if (this.sandboxModeCache !== null) return this.sandboxModeCache;
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'messaging_sandbox_mode' },
      });
      if (setting) {
        this.sandboxModeCache = setting.value === 'true' || setting.value === '1';
        return this.sandboxModeCache;
      }
    } catch {}
    this.sandboxModeCache = this.envSandboxMode;
    return this.sandboxModeCache;
  }

  private normalizePhoneNumber(phone: string): string {
    if (!phone) return '';
    let normalized = phone.replace(/[\s\-\(\)]/g, '');
    if (normalized.startsWith('0')) {
      normalized = '+260' + normalized.substring(1);
    }
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    return normalized;
  }

  private async logMessage(
    userId: string | null,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP',
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED',
    recipientEmail?: string,
    recipientPhone?: string,
    subject?: string,
    message?: string,
    messageId?: string,
    errorMessage?: string,
  ) {
    return this.prisma.messageLog.create({
      data: {
        userId,
        channel,
        status,
        recipientEmail,
        recipientPhone: recipientPhone ? this.normalizePhoneNumber(recipientPhone) : undefined,
        subject,
        message,
        messageId,
        errorMessage,
      },
    });
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`[Retry] ${context} - Attempt ${attempt}/${this.retryAttempts} failed: ${lastError.message}`);

        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    throw lastError;
  }

  async sendEmail(to: string, subject: string, message: string): Promise<MessagingResult> {
    try {
      if (!this.sendgridApiKey || this.sendgridApiKey === 'your_sendgrid_api_key') {
        this.logger.warn(`[Email] SendGrid not configured. Would send to: ${to}`);
        await this.logMessage(null, 'EMAIL', 'SENT', to, undefined, subject, message, 'sandbox_email_id');
        return { success: true, channel: 'EMAIL', messageId: 'sandbox_email_id' };
      }

      const msg = {
        to,
        from: {
          email: this.sendgridFromEmail,
          name: this.sendgridFromName,
        },
        subject,
        text: message,
        html: message.replace(/\n/g, '<br>'),
      };

      if (await this.checkSandboxMode()) {
        this.logger.log(`[Email] Sandbox mode - Would send to: ${to}, Subject: ${subject}`);
        await this.logMessage(null, 'EMAIL', 'SENT', to, undefined, subject, message, 'sandbox_email_id');
        return { success: true, channel: 'EMAIL', messageId: 'sandbox_email_id' };
      }

      const result = await this.retryOperation(
        async () => {
          const [response] = await sgMail.send(msg);
          return response;
        },
        `Email to ${to}`,
      );

      const messageId = result.headers['x-message-id'] || result.headers['message-id'] || `sg_${Date.now()}`;
      this.logger.log(`[Email] Sent to ${to}, MessageId: ${messageId}`);

      await this.logMessage(null, 'EMAIL', 'SENT', to, undefined, subject, message, messageId);

      return { success: true, channel: 'EMAIL', messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Email] Failed to send to ${to}: ${errorMessage}`);

      await this.logMessage(null, 'EMAIL', 'FAILED', to, undefined, subject, message, undefined, errorMessage);

      return { success: false, channel: 'EMAIL', error: errorMessage };
    }
  }

  async sendSMS(phoneNumber: string, message: string): Promise<MessagingResult> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    if (await this.checkSandboxMode()) {
      this.logger.log(`[SMS] Sandbox mode - Would send to: ${normalizedPhone}, Message: ${message.substring(0, 50)}...`);
      await this.logMessage(null, 'SMS', 'SENT', undefined, normalizedPhone, undefined, message, 'sandbox_sms_id');
      return { success: true, channel: 'SMS', messageId: 'sandbox_sms_id' };
    }

    if (!this.beemService.isConfigured()) {
      this.logger.warn(`[SMS] Beem not configured. Would send to: ${normalizedPhone}`);
      await this.logMessage(null, 'SMS', 'SENT', undefined, normalizedPhone, undefined, message, 'sandbox_sms_id');
      return { success: true, channel: 'SMS', messageId: 'sandbox_sms_id' };
    }

    try {
      const result = await this.retryOperation(
        () => this.beemService.sendSms(normalizedPhone, message),
        `SMS to ${normalizedPhone}`,
      );

      if (result.success) {
        this.logger.log(`[SMS] Beem sent to ${normalizedPhone}, messageId: ${result.messageId}`);
        await this.logMessage(null, 'SMS', 'SENT', undefined, normalizedPhone, undefined, message, result.messageId);
        return { success: true, channel: 'SMS', messageId: result.messageId };
      }

      throw new Error(result.error || 'Unknown Beem SMS error');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[SMS] Failed to send to ${normalizedPhone}: ${errorMessage}`);
      await this.logMessage(null, 'SMS', 'FAILED', undefined, normalizedPhone, undefined, message, undefined, errorMessage);
      return { success: false, channel: 'SMS', error: errorMessage };
    }
  }

  async sendWhatsApp(phoneNumber: string, message: string): Promise<MessagingResult> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    if (!this.beemService.isConfigured()) {
      const errorMessage = 'Beem WhatsApp not configured';
      this.logger.error(`[WhatsApp] ${errorMessage}`);
      await this.logMessage(null, 'WHATSAPP', 'FAILED', undefined, normalizedPhone, undefined, message, undefined, errorMessage);
      return { success: false, channel: 'WHATSAPP', error: errorMessage };
    }

    if (await this.checkSandboxMode()) {
      this.logger.log(`[WhatsApp] Sandbox mode - Would send to: ${normalizedPhone}, Message: ${message.substring(0, 50)}...`);
      await this.logMessage(null, 'WHATSAPP', 'SENT', undefined, normalizedPhone, undefined, message, 'sandbox_whatsapp_id');
      return { success: true, channel: 'WHATSAPP', messageId: 'sandbox_whatsapp_id' };
    }

    try {
      const result = await this.retryOperation(
        () => this.beemService.sendWhatsApp(normalizedPhone, message),
        `WhatsApp to ${normalizedPhone}`,
      );

      if (result.success) {
        this.logger.log(`[WhatsApp] Beem sent to ${normalizedPhone}, messageId: ${result.messageId}`);
        await this.logMessage(null, 'WHATSAPP', 'SENT', undefined, normalizedPhone, undefined, message, result.messageId);
        return { success: true, channel: 'WHATSAPP', messageId: result.messageId };
      }

      throw new Error(result.error || 'Unknown Beem WhatsApp error');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[WhatsApp] Failed to send to ${normalizedPhone}: ${errorMessage}`);
      await this.logMessage(null, 'WHATSAPP', 'FAILED', undefined, normalizedPhone, undefined, message, undefined, errorMessage);
      return { success: false, channel: 'WHATSAPP', error: errorMessage };
    }
  }

  async sendNotification(
    user: UserInfo,
    message: string,
    options?: {
      channels?: ('EMAIL' | 'SMS' | 'WHATSAPP')[];
      userId?: string;
      subject?: string;
    },
  ): Promise<NotificationResult> {
    const result: NotificationResult = { errors: [] };
    const userId = options?.userId || user.id;
    const subject = options?.subject || 'Smart Tech Notification';
    const channels = options?.channels || this.determineChannels(user);

    if (channels.includes('EMAIL') && user.email) {
      const emailResult = await this.sendEmail(user.email, subject, message);
      result.email = emailResult;
      if (!emailResult.success && emailResult.error) {
        result.errors.push(`Email: ${emailResult.error}`);
      }
    }

    if (channels.includes('SMS') && user.phone) {
      const smsResult = await this.sendSMS(user.phone, message);
      result.sms = smsResult;
      if (!smsResult.success && smsResult.error) {
        result.errors.push(`SMS: ${smsResult.error}`);
      }
    }

    if (channels.includes('WHATSAPP') && user.phone) {
      const whatsappResult = await this.sendWhatsApp(user.phone, message);
      result.whatsapp = whatsappResult;
      if (!whatsappResult.success && whatsappResult.error) {
        result.errors.push(`WhatsApp: ${whatsappResult.error}`);
      }
    }

    return result;
  }

  private determineChannels(user: UserInfo): ('EMAIL' | 'SMS' | 'WHATSAPP')[] {
    const channels: ('EMAIL' | 'SMS' | 'WHATSAPP')[] = [];

    if (user.email) {
      channels.push('EMAIL');
    }

    if (user.phone) {
      channels.push('SMS');
    }

    return channels;
  }

  async sendDirectorWelcome(
    user: UserInfo,
    credentials: { username: string; password: string },
    school: { name: string; url: string },
  ): Promise<NotificationResult> {
    const message = templates.directorWelcome({
      username: credentials.username,
      password: credentials.password,
      schoolName: school.name,
      schoolUrl: school.url,
    });

    return this.sendNotification(user, message, {
      subject: 'Welcome to Smart Tech - Director Account',
      userId: user.id,
    });
  }

  async sendTeacherWelcome(
    user: UserInfo,
    credentials: { username: string; password: string },
    schoolName: string,
  ): Promise<NotificationResult> {
    const message = templates.teacherWelcome({
      username: credentials.username,
      password: credentials.password,
      schoolName,
    });

    return this.sendNotification(user, message, {
      subject: 'Welcome to Smart Tech - Teacher Account',
      userId: user.id,
    });
  }

  async sendParentWelcome(
    user: UserInfo,
    credentials: { username: string; password: string },
    childName: string,
    schoolName: string,
  ): Promise<NotificationResult> {
    const message = templates.parentWelcome({
      username: credentials.username,
      password: credentials.password,
      childName,
      schoolName,
    });

    return this.sendNotification(user, message, {
      subject: 'Welcome to Smart Tech - Parent Account',
      userId: user.id,
    });
  }

  async sendStudentWelcome(
    user: UserInfo,
    credentials: { username: string; password: string },
    studentName: string,
    schoolName: string,
  ): Promise<NotificationResult> {
    const message = templates.studentWelcome({
      username: credentials.username,
      password: credentials.password,
      studentName,
      schoolName,
    });

    return this.sendNotification(user, message, {
      subject: 'Welcome to Smart Tech - Student Account',
      userId: user.id,
    });
  }

  async sendCustomMessage(
    user: UserInfo,
    message: string,
    options?: {
      channels?: ('EMAIL' | 'SMS' | 'WHATSAPP')[];
      userId?: string;
      subject?: string;
    },
  ): Promise<NotificationResult> {
    return this.sendNotification(user, message, options);
  }

  async getMessageLogs(
    userId?: string,
    channel?: 'EMAIL' | 'SMS' | 'WHATSAPP',
    status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED',
    limit: number = 100,
    offset: number = 0,
  ) {
    const where: any = {};

    if (userId) where.userId = userId;
    if (channel) where.channel = channel;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.messageLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getMessageStats(
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, byChannel, byStatus, recentLogs] = await Promise.all([
      this.prisma.messageLog.count({ where }),
      this.prisma.messageLog.groupBy({
        by: ['channel'],
        where,
        _count: { channel: true },
      }),
      this.prisma.messageLog.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      total,
      byChannel: byChannel.map(c => ({ channel: c.channel, count: c._count.channel })),
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count.status })),
      recentLogs,
    };
  }

  getTemplates() {
    return {
      directorWelcome: 'Director welcome message with school details and login credentials',
      teacherWelcome: 'Teacher welcome message with login credentials',
      parentWelcome: 'Parent welcome message with child name and login credentials',
      studentWelcome: 'Student welcome message with login credentials',
      customMessage: 'Custom message template',
    };
  }
}
