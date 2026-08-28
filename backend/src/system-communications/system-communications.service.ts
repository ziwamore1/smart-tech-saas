import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BeemService } from '../beem/beem.service';
import { TwilioService } from '../twilio/twilio.service';
import { EmailService } from '../email/email.service';
import { PushNotificationService } from '../push-notification/push-notification.service';
import { NotificationService } from '../notification/notification.service';
import { StudentFilterService } from '../common/services/student-filter.service';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { mapBounded } from '../common/utils/concurrency.util';

@Injectable()
export class SystemCommunicationsService {
  private readonly logger = new Logger(SystemCommunicationsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private beemService: BeemService,
    private twilioService: TwilioService,
    private emailService: EmailService,
    private pushNotificationService: PushNotificationService,
    private notificationService: NotificationService,
    private studentFilter: StudentFilterService,
  ) {}

  // ===================== DASHBOARD =====================

  async getDashboardStats() {
    const [providers, broadcasts, campaigns, recentBroadcasts, messageStats, notificationStats] = await Promise.all([
      this.prisma.systemProvider.findMany(),
      this.prisma.broadcast.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
      this.prisma.campaign.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
      this.prisma.broadcast.findMany({
        where: { status: { not: 'DRAFT' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.messageLog.groupBy({
        by: ['channel', 'status'],
        _count: true,
      }),
      this.prisma.notificationLog.groupBy({
        by: ['channel', 'status'],
        _count: true,
      }),
    ]);

    const providerByStatus = providers.reduce(
      (acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const providerByChannel = providers.reduce(
      (acc, p) => {
        acc[p.channel] = (acc[p.channel] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      providers: {
        total: providers.length,
        byStatus: providerByStatus,
        byChannel: providerByChannel,
        connected: providers.filter((p) => p.status === 'Connected').length,
        notConfigured: providers.filter((p) => p.status === 'Not Configured').length,
        error: providers.filter((p) => p.status === 'Connection Error').length,
      },
      broadcasts: {
        total: await this.prisma.broadcast.count(),
        byStatus: await this.getBroadcastCountByStatus(),
      },
      campaigns: {
        total: await this.prisma.campaign.count(),
        byStatus: await this.getCampaignCountByStatus(),
      },
      messageStats: this.aggregateStats(messageStats),
      notificationStats: this.aggregateStats(notificationStats),
      recentActivity: recentBroadcasts.map((b) => ({
        id: b.id,
        title: b.title,
        channels: b.channels,
        status: b.status,
        createdAt: b.createdAt,
      })),
    };
  }

  private async getBroadcastCountByStatus() {
    const groups = await this.prisma.broadcast.groupBy({
      by: ['status'],
      _count: true,
    });
    return groups.reduce((acc, g) => {
      acc[g.status] = g._count;
      return acc;
    }, {} as Record<string, number>);
  }

  private async getCampaignCountByStatus() {
    const groups = await this.prisma.campaign.groupBy({
      by: ['status'],
      _count: true,
    });
    return groups.reduce((acc, g) => {
      acc[g.status] = g._count;
      return acc;
    }, {} as Record<string, number>);
  }

  private aggregateStats(stats: { channel: string; status: string; _count: number }[]) {
    const result: Record<string, { sent: number; delivered: number; failed: number; pending: number }> = {};
    for (const s of stats) {
      if (!result[s.channel]) {
        result[s.channel] = { sent: 0, delivered: 0, failed: 0, pending: 0 };
      }
      const key = s.status.toLowerCase() as keyof typeof result[string];
      if (key in result[s.channel]) {
        (result[s.channel] as any)[key] += s._count;
      }
    }
    return result;
  }

  // ===================== PROVIDERS =====================

  async getProviders() {
    return this.prisma.systemProvider.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProviderById(id: string) {
    const provider = await this.prisma.systemProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  async createProvider(data: {
    name: string;
    type: string;
    channel: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    senderEmail?: string;
    senderName?: string;
    isDefault?: boolean;
    config?: any;
  }) {
    const existing = await this.prisma.systemProvider.findUnique({
      where: { name_channel: { name: data.name, channel: data.channel } },
    });
    if (existing) {
      throw new BadRequestException('Provider with this name and channel already exists');
    }

    if (data.isDefault) {
      await this.prisma.systemProvider.updateMany({
        where: { channel: data.channel, isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await this.prisma.systemProvider.create({
      data: {
        name: data.name,
        type: data.type,
        channel: data.channel,
        host: data.host,
        port: data.port,
        username: data.username,
        password: data.password,
        senderEmail: data.senderEmail,
        senderName: data.senderName,
        isDefault: data.isDefault || false,
        config: data.config || {},
        status: this.determineProviderStatus(data),
      },
    });

    return provider;
  }

  async updateProvider(id: string, data: any) {
    const provider = await this.prisma.systemProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');

    if (data.isDefault) {
      await this.prisma.systemProvider.updateMany({
        where: { channel: data.channel || provider.channel, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.systemProvider.update({
      where: { id },
      data: {
        ...data,
        status: data.host || data.username || data.apiKey
          ? this.determineProviderStatus({ ...provider, ...data })
          : undefined,
      },
    });

    return updated;
  }

  async deleteProvider(id: string) {
    const provider = await this.prisma.systemProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    await this.prisma.systemProvider.delete({ where: { id } });
    return { message: 'Provider deleted successfully' };
  }

  async testProvider(id: string) {
    const provider = await this.prisma.systemProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');

    let result: { success: boolean; message: string };

    switch (provider.channel?.toUpperCase()) {
      case 'SMTP':
      case 'EMAIL':
        result = await this.testSmtpConnection(provider);
        break;
      case 'SMS':
      case 'WHATSAPP':
      case 'PUSH':
        result = await this.testApiConnection(provider);
        break;
      default:
        result = await this.testSmtpConnection(provider);
    }

    await this.prisma.systemProvider.update({
      where: { id },
      data: {
        status: result.success ? 'Connected' : 'Connection Error',
        lastTestedAt: new Date(),
      },
    });

    return result;
  }

  async setDefaultProvider(id: string) {
    const provider = await this.prisma.systemProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');

    await this.prisma.systemProvider.updateMany({
      where: { channel: provider.channel, isDefault: true },
      data: { isDefault: false },
    });

    const updated = await this.prisma.systemProvider.update({
      where: { id },
      data: { isDefault: true },
    });

    return updated;
  }

  private async testSmtpConnection(provider: any): Promise<{ success: boolean; message: string }> {
    const portsToTry = provider.port
      ? [provider.port, provider.port === 465 ? 587 : 465]
      : [587, 465];

    for (const port of portsToTry) {
      try {
        const transporter = nodemailer.createTransport({
          host: provider.host || 'smtp.zoho.com',
          port,
          secure: port === 465,
          requireTLS: port !== 465,
          auth: {
            user: provider.username || provider.senderEmail,
            pass: provider.password,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
          tls: { rejectUnauthorized: false },
        });

        await transporter.verify();

        const testTo = provider.senderEmail || 'test@smarttechsaas.com';
        const info = await transporter.sendMail({
          from: `"${provider.senderName || 'System Communications'}" <${provider.senderEmail || 'noreply@smarttechsaas.com'}>`,
          to: testTo,
          subject: 'SMTP Connection Test - Smart Tech SaaS',
          html: '<h3>SMTP Test Successful</h3><p>This is an automated test message from the System Communications Center.</p><p>If you received this, your SMTP configuration is working correctly.</p>',
        });

        this.logger.log(`[SMTP Test] Connection successful on port ${port}, messageId: ${info.messageId}`);
        return {
          success: true,
          message: `SMTP connection successful on port ${port}. Test email sent to ${testTo}.`,
        };
      } catch (error: any) {
        this.logger.warn(`[SMTP Test] Port ${port} failed: ${error.message}, trying next port...`);
      }
    }

    return {
      success: false,
      message: 'SMTP connection failed on both ports 587 and 465. Check firewall or network settings.',
    };
  }

  private async testApiConnection(provider: any): Promise<{ success: boolean; message: string }> {
    try {
      const apiKey = provider.apiKey || '';
      const apiSecret = provider.apiSecret || '';
      if (!apiKey || !apiSecret) {
        return { success: false, message: 'API credentials not configured. Save API Key and API Secret first.' };
      }

      if (apiKey.startsWith('AC') && apiKey.length === 34) {
        try {
          const client = new (require('twilio'))(apiKey, apiSecret);
          const balanceData = await client.api.accounts(apiKey).balance.fetch();
          return {
            success: true,
            message: `Twilio connection successful. Balance: ${balanceData.currency || 'USD'} ${balanceData.balance || '0'}`,
          };
        } catch (twilioError: any) {
          return { success: false, message: `Twilio connection failed: ${twilioError.message}` };
        }
      }

      const response = await fetch('https://apisms.beem.africa/public/v1/vendors/balance', {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `API connection successful. Balance: ${data.currency || ''} ${data.balance || ''}`.trim(),
        };
      }

      const errorText = await response.text();
      return {
        success: false,
        message: `API connection failed (${response.status}): ${errorText}`,
      };
    } catch (error: any) {
      this.logger.error(`[API Test] Connection failed: ${error.message}`);
      return { success: false, message: `API connection failed: ${error.message}` };
    }
  }

  private determineProviderStatus(provider: any): string {
    const hasCredentials =
      (provider.username && provider.password) ||
      (provider.apiKey && provider.apiSecret) ||
      (provider.host && provider.port);

    if (!hasCredentials) return 'Not Configured';
    return 'Configured';
  }

  // ===================== BROADCASTS =====================

  async getBroadcasts(options?: { page?: number; limit?: number; status?: string }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const where: any = {};
    if (options?.status) where.status = options.status;

    const [broadcasts, total] = await Promise.all([
      this.prisma.broadcast.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.broadcast.count({ where }),
    ]);

    return {
      broadcasts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getBroadcastById(id: string) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new NotFoundException('Broadcast not found');
    return broadcast;
  }

  async createBroadcast(data: {
    title: string;
    message: string;
    channels: string[];
    targetType: string;
    targetIds?: string[];
    scheduledAt?: Date;
    createdById?: string;
  }) {
    const broadcast = await this.prisma.broadcast.create({
      data: {
        title: data.title,
        message: data.message,
        channels: data.channels,
        targetType: data.targetType,
        targetIds: data.targetIds || [],
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt,
        createdById: data.createdById,
      },
    });
    return broadcast;
  }

  async updateBroadcast(id: string, data: any) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new NotFoundException('Broadcast not found');
    if (broadcast.status === 'SENT' || broadcast.status === 'SENDING') {
      throw new BadRequestException('Cannot update a broadcast that has been sent or is sending');
    }
    return this.prisma.broadcast.update({ where: { id }, data });
  }

  async deleteBroadcast(id: string) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new NotFoundException('Broadcast not found');
    await this.prisma.broadcast.delete({ where: { id } });
    return { message: 'Broadcast deleted successfully' };
  }

  async sendBroadcast(broadcastId: string) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) throw new NotFoundException('Broadcast not found');
    if (broadcast.status === 'SENT') {
      throw new BadRequestException('Broadcast has already been sent');
    }

    await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'SENDING', sentAt: new Date() },
    });

    try {
      const recipients = await this.resolveTargets(broadcast.targetType, broadcast.targetIds);

      for (const channel of broadcast.channels) {
        await this.sendToChannel(channel, broadcast, recipients);
      }

      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'SENT', completedAt: new Date() },
      });

      return { success: true, message: 'Broadcast sent successfully', recipientsCount: recipients.length };
    } catch (error: any) {
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'FAILED' },
      });
      this.logger.error(`[Broadcast] Failed to send: ${error.message}`);
      throw new BadRequestException(`Failed to send broadcast: ${error.message}`);
    }
  }

  async scheduleBroadcast(id: string, scheduledAt: Date) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new NotFoundException('Broadcast not found');

    return this.prisma.broadcast.update({
      where: { id },
      data: { scheduledAt, status: 'SCHEDULED' },
    });
  }

  // ===================== CAMPAIGNS =====================

  async getCampaigns(options?: { page?: number; limit?: number; status?: string }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const where: any = {};
    if (options?.status) where.status = options.status;

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return {
      campaigns,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCampaignById(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async createCampaign(data: {
    name: string;
    description?: string;
    type: string;
    channels: string[];
    targetType: string;
    targetIds?: string[];
    templateId?: string;
    scheduledAt?: Date;
    createdById?: string;
  }) {
    return this.prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        channels: data.channels,
        targetType: data.targetType,
        targetIds: data.targetIds || [],
        templateId: data.templateId,
        status: 'DRAFT',
        scheduledAt: data.scheduledAt,
        createdById: data.createdById,
      },
    });
  }

  async updateCampaign(id: string, data: any) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === 'ACTIVE' || campaign.status === 'COMPLETED') {
      throw new BadRequestException('Cannot update an active or completed campaign');
    }
    return this.prisma.campaign.update({ where: { id }, data });
  }

  async deleteCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    await this.prisma.campaign.delete({ where: { id } });
    return { message: 'Campaign deleted successfully' };
  }

  async launchCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });

    try {
      const recipients = await this.resolveTargets(campaign.targetType, campaign.targetIds);

      for (const channel of campaign.channels) {
        await this.sendToChannel(channel, campaign, recipients);
      }

      await this.prisma.campaign.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          sentCount: recipients.length,
        },
      });
    } catch (error: any) {
      this.logger.error(`[Campaign] Error during launch: ${error.message}`);
    }

    return updated;
  }

  async pauseCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  // ===================== TEMPLATES =====================

  async getTemplates(type?: string) {
    const where: any = { scope: 'system' };
    if (type) where.type = type;
    return this.prisma.communicationTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSystemTemplate(data: {
    name: string;
    type: string;
    subject?: string;
    message: string;
    category?: string;
  }) {
    return this.prisma.communicationTemplate.create({
      data: {
        name: data.name,
        type: data.type,
        subject: data.subject,
        message: data.message,
        category: data.category,
        schoolId: 'system',
        scope: 'system',
        isDefault: false,
      },
    });
  }

  async updateTemplate(id: string, data: any) {
    const template = await this.prisma.communicationTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return this.prisma.communicationTemplate.update({ where: { id }, data });
  }

  async deleteTemplate(id: string) {
    const template = await this.prisma.communicationTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    await this.prisma.communicationTemplate.delete({ where: { id } });
    return { message: 'Template deleted successfully' };
  }

  // ===================== NOTIFICATIONS =====================

  async getNotificationLogs(options?: { page?: number; limit?: number; channel?: string }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const where: any = {};
    if (options?.channel) where.channel = options.channel;

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return {
      notifications: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async triggerSystemNotification(type: string, data: any) {
    this.logger.log(`[System Notification] Triggering: ${type}`);

    switch (type) {
      case 'new_school_registration':
        return this.handleNewSchoolRegistration(data);
      case 'teacher_account_created':
        return this.handleAccountCreated('teacher', data);
      case 'student_account_created':
        return this.handleAccountCreated('student', data);
      case 'parent_account_created':
        return this.handleAccountCreated('parent', data);
      case 'password_reset':
        return this.handlePasswordReset(data);
      case 'fee_reminder':
        return this.handleFeeReminder(data);
      case 'exam_result_published':
        return this.handleExamResultPublished(data);
      case 'report_card_generated':
        return this.handleReportCardGenerated(data);
      case 'maintenance_notification':
        return this.handleMaintenanceNotification(data);
      case 'security_alert':
        return this.handleSecurityAlert(data);
      default:
        throw new BadRequestException(`Unknown notification type: ${type}`);
    }
  }

  private async handleNewSchoolRegistration(data: any) {
    const superAdmins = await this.prisma.systemUser.findMany();
    const school = data.schoolName || 'Unknown School';

    for (const admin of superAdmins) {
      try {
        await this.emailService.sendMail(
          admin.email,
          'New School Registration - Smart Tech',
          `<h3>New School Registered</h3><p>School: ${school}</p><p>Please review and activate the account.</p>`,
        );
      } catch (error: any) {
        this.logger.error(`Failed to notify ${admin.email}: ${error.message}`);
      }
    }

    return { success: true, message: `Notification sent for new school: ${school}` };
  }

  private async handleAccountCreated(role: string, data: any) {
    const { email, phone, name, username, password, schoolName } = data;

    const tasks: Promise<any>[] = [];

    if (email) {
      tasks.push(
        this.emailService.sendCredentialsEmail(email, {
          recipientName: name,
          username: username || email,
          password: password || 'Welcome123',
          role,
          schoolName,
          email: email,
        }).catch((err: any) => this.logger.error(`[${role}] Email failed: ${err.message}`)),
      );
    }

    if (phone) {
      const message = `Hello ${name},\nYour ${role} account has been created.\nUsername: ${username || email}\nPassword: ${password || 'Welcome123'}\nPlease login and change your password.`;
      tasks.push(
        this.notificationService.sendWhatsApp(phone, message).catch((err: any) =>
          this.logger.error(`[${role}] WhatsApp failed: ${err.message}`),
        ),
      );
    }

    await Promise.all(tasks);
    return { success: true, message: `${role} account credentials sent` };
  }

  private async handlePasswordReset(data: any) {
    const { email, resetLink, name } = data;
    if (email) {
      await this.emailService.sendPasswordResetEmail(email, resetLink);
    }
    return { success: true, message: `Password reset link sent to ${email}` };
  }

  private async handleFeeReminder(data: any) {
    const { parentEmail, parentName, studentName, amount, dueDate, schoolName, phone } = data;

    const tasks: Promise<any>[] = [];

    if (parentEmail) {
      tasks.push(
        this.emailService.sendFeeReminder(parentEmail, {
          studentName,
          amount,
          dueDate,
          schoolName,
        }).catch((err: any) => this.logger.error(`[FeeReminder] Email failed: ${err.message}`)),
      );
    }

    if (phone) {
      const message = `Fee Reminder: ${amount} due on ${dueDate} for ${studentName}. Please make payment to avoid penalties.`;
      tasks.push(
        this.notificationService.sendWhatsApp(phone, message).catch((err: any) =>
          this.logger.error(`[FeeReminder] WhatsApp failed: ${err.message}`),
        ),
      );
    }

    await Promise.all(tasks);
    return { success: true, message: `Fee reminder sent for ${studentName}` };
  }

  private async handleExamResultPublished(data: any) {
    const { parentEmail, parentName, studentName, term, schoolName, phone, reportUrl } = data;

    const tasks: Promise<any>[] = [];

    if (parentEmail) {
      tasks.push(
        this.emailService.sendResultNotification(parentEmail, {
          studentName,
          term,
          schoolName,
          reportUrl,
        }).catch((err: any) => this.logger.error(`[ResultPublished] Email failed: ${err.message}`)),
      );
    }

    if (phone) {
      const message = `Results published for ${studentName} - ${term}. Check the portal for details.`;
      tasks.push(
        this.notificationService.sendWhatsApp(phone, message).catch((err: any) =>
          this.logger.error(`[ResultPublished] WhatsApp failed: ${err.message}`),
        ),
      );
    }

    await Promise.all(tasks);
    return { success: true, message: `Result notification sent for ${studentName}` };
  }

  private async handleReportCardGenerated(data: any) {
    const { parentEmail, parentName, studentName, term, academicYear, schoolName, downloadUrl } = data;

    if (parentEmail) {
      await this.emailService.sendReportCardReady(parentEmail, {
        recipientName: parentName || 'Parent',
        studentName,
        term,
        academicYear: academicYear || term,
        schoolName,
        downloadUrl,
      });
    }

    return { success: true, message: `Report card notification sent for ${studentName}` };
  }

  private async handleMaintenanceNotification(data: any) {
    const { description, startDate, endDate, impact } = data;

    const allSchools = await this.prisma.school.findMany({
      select: { id: true, name: true },
    });

    for (const school of allSchools) {
      const users = await this.prisma.user.findMany({
        where: { schoolId: school.id, userRoles: { some: { role: { name: 'SuperAdmin' } } } },
        select: { id: true, email: true },
      });

      for (const user of users) {
        if (user.email) {
          await this.emailService
            .sendMail(
              user.email,
              'System Maintenance - Smart Tech',
              `<h3>Scheduled Maintenance</h3><p>${description || 'System maintenance scheduled.'}</p><p>Start: ${startDate}<br/>End: ${endDate || 'N/A'}<br/>Impact: ${impact || 'Minor disruption expected'}</p>`,
            )
            .catch((err: any) => this.logger.error(`[Maintenance] Email to ${user.email} failed: ${err.message}`));
        }
      }
    }

    return { success: true, message: 'Maintenance notification sent to all schools' };
  }

  private async handleSecurityAlert(data: any) {
    const { message, severity } = data;
    const superAdmins = await this.prisma.systemUser.findMany();

    for (const admin of superAdmins) {
      try {
        await this.emailService.sendMail(
          admin.email,
          `[${severity || 'HIGH'}] Security Alert - Smart Tech`,
          `<h3>Security Alert</h3><p>${message}</p><p>Severity: ${severity || 'HIGH'}</p><p>Please take immediate action.</p>`,
        );
      } catch (error: any) {
        this.logger.error(`Failed to send security alert to ${admin.email}: ${error.message}`);
      }
    }

    return { success: true, message: 'Security alert sent to all super admins' };
  }

  // ===================== YOUTUBE =====================

  async getYouTubeChannelConfig() {
    const channels = await this.prisma.youtubeChannel.findMany({
      where: { schoolId: null },
    });
    return channels[0] || null;
  }

  async saveYouTubeChannelConfig(data: { channelUrl?: string; channelName?: string; apiKey?: string }) {
    const existing = await this.prisma.youtubeChannel.findFirst({
      where: { schoolId: null },
    });

    if (existing) {
      return this.prisma.youtubeChannel.update({
        where: { id: existing.id },
        data: {
          ...data,
          isConnected: true,
        },
      });
    }

    return this.prisma.youtubeChannel.create({
      data: {
        ...data,
        isConnected: true,
      },
    });
  }

  async syncYouTubeChannel() {
    const config = await this.prisma.youtubeChannel.findFirst({
      where: { schoolId: null },
    });

    if (!config) throw new NotFoundException('YouTube channel not configured');

    const apiKey = config.apiKey || this.configService.get<string>('YOUTUBE_API_KEY');
    if (!apiKey) throw new BadRequestException('YouTube API key not configured');

    try {
      const youtube = google.youtube({ version: 'v3', auth: apiKey });

      let channelId = config.channelId;
      if (config.channelUrl && !channelId) {
        const urlParts = config.channelUrl.split('/');
        const handleOrId = urlParts[urlParts.length - 1];
        const searchRes = await youtube.search.list({
          part: ['id', 'snippet'],
          q: config.channelName || handleOrId,
          type: ['channel'],
          maxResults: 1,
        });
        channelId = searchRes.data.items?.[0]?.id?.channelId;
      }

      if (!channelId) throw new BadRequestException('Could not resolve YouTube channel ID');

      const channelRes = await youtube.channels.list({
        part: ['statistics', 'snippet', 'contentDetails'],
        id: [channelId],
      });

      const channelData = channelRes.data.items?.[0];
      if (!channelData) throw new NotFoundException('YouTube channel not found');

      const stats = channelData.statistics;
      const subscriberCount = parseInt(stats?.subscriberCount || '0', 10);
      const viewCount = parseInt(stats?.viewCount || '0', 10);
      const videoCount = parseInt(stats?.videoCount || '0', 10);

      let latestVideos: any[] = [];
      try {
        const uploadsPlaylistId = channelData.contentDetails?.relatedPlaylists?.uploads;
        if (uploadsPlaylistId) {
          const playlistRes = await youtube.playlistItems.list({
            part: ['snippet', 'contentDetails'],
            playlistId: uploadsPlaylistId,
            maxResults: 10,
          });
          latestVideos = (playlistRes.data.items || []).map((item: any) => ({
            videoId: item.contentDetails?.videoId,
            title: item.snippet?.title,
            publishedAt: item.snippet?.publishedAt,
            thumbnails: item.snippet?.thumbnails,
          }));
        }
      } catch (err: any) {
        this.logger.warn(`[YouTube Sync] Could not fetch latest videos: ${err.message}`);
      }

      const updated = await this.prisma.youtubeChannel.update({
        where: { id: config.id },
        data: {
          channelId,
          channelName: channelData.snippet?.title || config.channelName,
          subscriberCount,
          viewCount,
          videoCount,
          isConnected: true,
          lastSyncedAt: new Date(),
        },
      });

      return {
        ...updated,
        latestVideos,
      };
    } catch (error: any) {
      this.logger.error(`[YouTube Sync] Failed: ${error.message}`);
      throw new BadRequestException(`YouTube sync failed: ${error.message}`);
    }
  }

  async disconnectYouTubeChannel() {
    const config = await this.prisma.youtubeChannel.findFirst({
      where: { schoolId: null },
    });

    if (config) {
      await this.prisma.youtubeChannel.update({
        where: { id: config.id },
        data: {
          isConnected: false,
          apiKey: null,
          accessToken: null,
          refreshToken: null,
        },
      });
    }

    return { success: true, message: 'YouTube channel disconnected' };
  }

  // ===================== ANALYTICS =====================

  async getUsageAnalytics(dateRange?: { start: Date; end: Date }) {
    const dateFilter: any = {};
    if (dateRange) {
      dateFilter.createdAt = { gte: dateRange.start, lte: dateRange.end };
    }

    const [messageLogs, notificationLogs] = await Promise.all([
      this.prisma.messageLog.findMany({ where: dateFilter }),
      this.prisma.notificationLog.findMany({ where: dateFilter }),
    ]);

    const emailStats = this.calculateChannelStats(messageLogs, notificationLogs, ['EMAIL', 'email']);
    const smsStats = this.calculateChannelStats(messageLogs, notificationLogs, ['SMS', 'sms']);
    const whatsappStats = this.calculateChannelStats(messageLogs, notificationLogs, ['WHATSAPP', 'whatsapp']);
    const pushStats = this.calculatePushStats(notificationLogs);
    const trends = this.calculateTrends(messageLogs, notificationLogs);

    const totalSent = emailStats.sent + smsStats.sent + whatsappStats.sent + pushStats.sent;
    const totalDelivered = emailStats.delivered + smsStats.delivered + whatsappStats.delivered;
    const totalFailed = emailStats.failed + smsStats.failed + whatsappStats.failed;

    return {
      summary: {
        totalCommunications: totalSent,
        totalDelivered,
        totalFailed,
        overallDeliveryRate: totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(2)) : 0,
        overallFailureRate: totalSent > 0 ? Number(((totalFailed / totalSent) * 100).toFixed(2)) : 0,
      },
      channels: {
        email: emailStats,
        sms: smsStats,
        whatsapp: whatsappStats,
        push: pushStats,
      },
      trends,
    };
  }

  private calculateChannelStats(
    messageLogs: any[],
    notificationLogs: any[],
    channels: string[],
  ) {
    const [msgChannel, notifChannel] = channels;

    const msgLogs = messageLogs.filter(
      (l) => l.channel === msgChannel,
    );
    const notifLogs = notificationLogs.filter(
      (l) => l.channel === notifChannel,
    );

    const sent = msgLogs.filter((l) => l.status === 'SENT').length + notifLogs.filter((l) => l.status === 'sent').length;
    const delivered = msgLogs.filter((l) => l.status === 'DELIVERED').length + notifLogs.filter((l) => l.status === 'delivered').length;
    const failed = msgLogs.filter((l) => l.status === 'FAILED').length + notifLogs.filter((l) => l.status === 'failed').length;
    const pending = msgLogs.filter((l) => l.status === 'PENDING').length;

    const total = sent + delivered + failed + pending;
    const totalNonPending = sent + delivered + failed;

    return {
      sent: sent + delivered,
      delivered,
      failed,
      pending,
      total,
      deliveryRate: totalNonPending > 0 ? Number(((delivered / totalNonPending) * 100).toFixed(2)) : 0,
      failureRate: totalNonPending > 0 ? Number(((failed / totalNonPending) * 100).toFixed(2)) : 0,
    };
  }

  private calculatePushStats(notificationLogs: any[]) {
    const pushLogs = notificationLogs.filter((l) => l.channel === 'push');
    const sent = pushLogs.length;
    return {
      sent,
      delivered: 0,
      failed: 0,
      pending: 0,
      total: sent,
      deliveryRate: 0,
      failureRate: 0,
    };
  }

  private calculateTrends(messageLogs: any[], notificationLogs: any[]) {
    const dailyMap = new Map<string, { sent: number; delivered: number; failed: number }>();

    const allLogs = [
      ...messageLogs.map((l) => ({
        date: l.createdAt,
        status: l.status === 'SENT' || l.status === 'DELIVERED' ? 'sent' : l.status.toLowerCase(),
      })),
      ...notificationLogs.map((l) => ({
        date: l.createdAt,
        status: l.status,
      })),
    ];

    for (const log of allLogs) {
      if (!log.date) continue;
      const day = new Date(log.date).toISOString().split('T')[0];
      if (!dailyMap.has(day)) {
        dailyMap.set(day, { sent: 0, delivered: 0, failed: 0 });
      }
      const entry = dailyMap.get(day)!;
      if (log.status === 'sent' || log.status === 'SENT') entry.sent++;
      else if (log.status === 'delivered' || log.status === 'DELIVERED') entry.delivered++;
      else if (log.status === 'failed' || log.status === 'FAILED') entry.failed++;
    }

    const trends = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return trends;
  }

  // ===================== DELIVERY LOGS =====================

  async getDeliveryLogs(options: {
    type?: string;
    provider?: string;
    recipient?: string;
    status?: string;
    dateRange?: { start: Date; end: Date };
    page?: number;
    limit?: number;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const where: any = {};

    if (options.type) where.channel = options.type.toUpperCase();
    if (options.status) where.status = options.status;
    if (options.recipient) {
      where.OR = [
        { recipientEmail: { contains: options.recipient, mode: 'insensitive' } },
        { recipientPhone: { contains: options.recipient } },
        { recipient: { contains: options.recipient, mode: 'insensitive' } },
      ];
    }
    if (options.dateRange) {
      where.createdAt = { gte: options.dateRange.start, lte: options.dateRange.end };
    }

    const [messageLogs, notificationLogs, messageTotal, notificationTotal] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.messageLog.count({ where }),
      this.prisma.notificationLog.count({ where }),
    ]);

    const logs = [
      ...messageLogs.map((l) => ({
        id: l.id,
        type: 'message',
        channel: l.channel,
        status: l.status,
        recipientEmail: l.recipientEmail,
        recipientPhone: l.recipientPhone,
        subject: l.subject,
        message: l.message,
        error: l.errorMessage,
        createdAt: l.createdAt,
        sentAt: l.sentAt,
      })),
      ...notificationLogs.map((l) => ({
        id: l.id,
        type: 'notification',
        channel: l.channel,
        status: l.status,
        recipient: l.recipient,
        subject: l.subject,
        message: l.message,
        error: l.error,
        createdAt: l.createdAt,
        sentAt: l.sentAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = messageTotal + notificationTotal;

    return {
      logs: logs.slice(0, limit),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ===================== STATUS ENGINE =====================

  async getSystemStatus() {
    const providers = await this.prisma.systemProvider.findMany();
    const providerStatuses: Record<string, { status: string; lastTestedAt: Date | null }> = {};

    for (const p of providers) {
      providerStatuses[`${p.name}_${p.channel}`] = {
        status: p.status,
        lastTestedAt: p.lastTestedAt,
      };
    }

    const zohoStatus = providers.find(
      (p) => p.type === 'EMAIL' && p.host?.includes('zoho'),
    )?.status || 'Not Configured';

    const sendGridStatus = providers.find(
      (p) => p.type === 'EMAIL' && p.name.toLowerCase().includes('sendgrid'),
    )?.status || 'Not Configured';

    const beemStatus = providers.find(
      (p) => p.type === 'SMS' && p.name.toLowerCase().includes('beem'),
    )?.status || ((await this.beemService.isConfigured()) ? 'Connected' : 'Not Configured');

    const connectedCount = providers.filter((p) => p.status === 'Connected').length;
    const errorCount = providers.filter((p) => p.status === 'Connection Error').length;
    const totalCount = providers.length;

    const isHealthy = errorCount === 0 && connectedCount > 0;

    return {
      overallHealth: isHealthy ? 'Healthy' : 'Degraded',
      providers: {
        zoho: { status: zohoStatus, type: 'SMTP' },
        sendgrid: { status: sendGridStatus, type: 'API' },
        beem: { status: beemStatus, type: 'API' },
        ...providerStatuses,
      },
      summary: {
        total: totalCount,
        connected: connectedCount,
        configured: providers.filter((p) => p.status === 'Configured').length,
        notConfigured: providers.filter((p) => p.status === 'Not Configured').length,
        error: errorCount,
      },
      timestamp: new Date(),
    };
  }

  async forceCheckAllProviders() {
    const providers = await this.prisma.systemProvider.findMany();
    const results: any[] = [];

    for (const provider of providers) {
      const result = await this.testProvider(provider.id);
      results.push({
        providerId: provider.id,
        name: provider.name,
        channel: provider.channel,
        ...result,
      });
    }

    return {
      results,
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    };
  }

  // ===================== BEEM DASHBOARD =====================

  async getBeemDashboard() {
    const balanceResult = await this.beemService.getBalance();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [todayMessages, monthMessages, todayWhatsApp, monthWhatsApp, todayFailed, monthFailed] =
      await Promise.all([
        this.prisma.messageLog.count({
          where: {
            channel: 'SMS',
            status: { in: ['SENT', 'DELIVERED'] },
            createdAt: { gte: todayStart, lte: todayEnd },
          },
        }),
        this.prisma.messageLog.count({
          where: {
            channel: 'SMS',
            status: { in: ['SENT', 'DELIVERED'] },
            createdAt: { gte: monthStart },
          },
        }),
        this.prisma.messageLog.count({
          where: {
            channel: 'WHATSAPP',
            status: { in: ['SENT', 'DELIVERED'] },
            createdAt: { gte: todayStart, lte: todayEnd },
          },
        }),
        this.prisma.messageLog.count({
          where: {
            channel: 'WHATSAPP',
            status: { in: ['SENT', 'DELIVERED'] },
            createdAt: { gte: monthStart },
          },
        }),
        this.prisma.messageLog.count({
          where: {
            channel: 'SMS',
            status: 'FAILED',
            createdAt: { gte: todayStart, lte: todayEnd },
          },
        }),
        this.prisma.messageLog.count({
          where: {
            channel: 'SMS',
            status: 'FAILED',
            createdAt: { gte: monthStart },
          },
        }),
      ]);

    const totalMonthSent = monthMessages + monthWhatsApp;
    const costPerSms = 0.05;
    const costPerWhatsApp = 0.03;
    const estimatedCost = monthMessages * costPerSms + monthWhatsApp * costPerWhatsApp;
    const deliverySuccessRate =
      totalMonthSent > 0
        ? Number(
            ((totalMonthSent / (totalMonthSent + monthFailed)) * 100).toFixed(2),
          )
        : 0;

    return {
      balance: balanceResult.success ? balanceResult.balance : 0,
      currency: balanceResult.success ? balanceResult.currency : 'TZS',
      today: {
        smsSent: todayMessages,
        whatsAppSent: todayWhatsApp,
        failed: todayFailed,
        total: todayMessages + todayWhatsApp,
      },
      thisMonth: {
        smsSent: monthMessages,
        whatsAppSent: monthWhatsApp,
        failed: monthFailed,
        total: totalMonthSent,
      },
      costEstimation: {
        estimatedCost: Number(estimatedCost.toFixed(2)),
        currency: 'USD',
        breakdown: {
          sms: { count: monthMessages, rate: costPerSms, cost: Number((monthMessages * costPerSms).toFixed(2)) },
          whatsapp: { count: monthWhatsApp, rate: costPerWhatsApp, cost: Number((monthWhatsApp * costPerWhatsApp).toFixed(2)) },
        },
      },
      deliverySuccessRate,
    };
  }

  // ===================== SCHEDULED MESSAGES =====================

  async getScheduledCommunications() {
    const [broadcasts, communications] = await Promise.all([
      this.prisma.broadcast.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.communication.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        select: {
          id: true,
          type: true,
          subject: true,
          status: true,
          scheduledAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      broadcasts: broadcasts.map((b) => ({
        id: b.id,
        title: b.title,
        type: 'broadcast',
        channels: b.channels,
        status: b.status,
        scheduledAt: b.scheduledAt,
      })),
      communications: communications.map((c) => ({
        id: c.id,
        title: c.subject || c.type,
        type: 'communication',
        channels: [c.type],
        status: c.status,
        scheduledAt: c.scheduledAt,
      })),
    };
  }

  async cancelScheduledCommunication(id: string) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id } });
    if (broadcast) {
      if (broadcast.status !== 'SCHEDULED') {
        throw new BadRequestException('Broadcast is not in scheduled status');
      }
      await this.prisma.broadcast.update({
        where: { id },
        data: { status: 'CANCELLED', scheduledAt: null },
      });
      return { message: 'Scheduled broadcast cancelled' };
    }

    const communication = await this.prisma.communication.findUnique({ where: { id } });
    if (communication) {
      if (communication.status !== 'PENDING') {
        throw new BadRequestException('Communication is not in pending status');
      }
      await this.prisma.communication.update({
        where: { id },
        data: { status: 'CANCELLED', scheduledAt: null },
      });
      return { message: 'Scheduled communication cancelled' };
    }

    throw new NotFoundException('Scheduled item not found');
  }

  // ===================== TARGET RESOLUTION =====================

  private async resolveTargets(targetType: string, targetIds: string[]): Promise<any[]> {
    switch (targetType) {
      case 'all_schools': {
        const schools = await this.prisma.school.findMany({ select: { id: true } });
        const users = await this.prisma.user.findMany({
          where: { schoolId: { in: schools.map((s) => s.id) }, isActive: true },
          select: { id: true, email: true, phone: true, firstName: true, lastName: true },
        });
        return users;
      }
      case 'selected_schools': {
        if (!targetIds || targetIds.length === 0) return [];
        const users = await this.prisma.user.findMany({
          where: { schoolId: { in: targetIds }, isActive: true },
          select: { id: true, email: true, phone: true, firstName: true, lastName: true },
        });
        return users;
      }
      case 'directors': {
        const directorRole = await this.prisma.role.findUnique({ where: { name: 'Director' } });
        if (!directorRole) return [];
        return this.prisma.user.findMany({
          where: { userRoles: { some: { roleId: directorRole.id } }, isActive: true },
          select: { id: true, email: true, phone: true, firstName: true, lastName: true },
        });
      }
      case 'teachers': {
        return this.prisma.user.findMany({
          where: { teacher: { isNot: null }, isActive: true },
          select: { id: true, email: true, phone: true, firstName: true, lastName: true },
        });
      }
      case 'parents': {
        return this.prisma.parent.findMany({
          select: { id: true, email: true, phone: true, firstName: true, lastName: true },
        });
      }
      case 'students': {
        return this.prisma.student.findMany({
          where: this.studentFilter.communicationRecipientWhere(),
          select: { id: true, firstName: true, lastName: true },
        });
      }
      case 'custom_users': {
        if (!targetIds || targetIds.length === 0) return [];
        return this.prisma.user.findMany({
          where: { id: { in: targetIds }, isActive: true },
          select: { id: true, email: true, phone: true, firstName: true, lastName: true },
        });
      }
      default:
        return [];
    }
  }

  private async sendToChannel(channel: string, item: any, recipients: any[]) {
    switch (channel.toUpperCase()) {
      case 'EMAIL':
        return this.sendEmailToRecipients(item, recipients);
      case 'SMS':
        return this.sendSmsToRecipients(item, recipients);
      case 'WHATSAPP':
        return this.sendWhatsAppToRecipients(item, recipients);
      case 'PUSH_NOTIFICATION':
        return this.sendPushToRecipients(item, recipients);
      case 'INAPPLICATION':
        return this.sendInAppToRecipients(item, recipients);
      default:
        this.logger.warn(`[Channel] Unknown channel: ${channel}`);
    }
  }

  private async sendEmailToRecipients(item: any, recipients: any[]) {
    const defaultProvider = await this.prisma.systemProvider.findFirst({
      where: { channel: 'EMAIL', isDefault: true, status: 'Connected' },
    });

    for (const recipient of recipients) {
      const email = recipient.email;
      if (!email) continue;

      try {
        if (defaultProvider) {
          const transporter = nodemailer.createTransport({
            host: defaultProvider.host || 'smtp.zoho.com',
            port: defaultProvider.port || 465,
            secure: (defaultProvider.port || 465) === 465,
            auth: {
              user: defaultProvider.username || defaultProvider.senderEmail,
              pass: defaultProvider.password,
            },
            tls: { rejectUnauthorized: false },
          });
          await transporter.sendMail({
            from: `"${defaultProvider.senderName || 'System Communications'}" <${defaultProvider.senderEmail || 'noreply@smarttechsaas.com'}>`,
            to: email,
            subject: item.title || item.subject || 'System Communication',
            html: item.message,
          });
        } else {
          await this.emailService.sendMail(
            email,
            item.title || item.subject || 'System Communication',
            item.message,
          );
        }

        await this.logMessageSent('EMAIL', 'SENT', { recipientEmail: email, message: item.message });
      } catch (error: any) {
        this.logger.error(`[Email] Failed to send to ${email}: ${error.message}`);
        await this.logMessageSent('EMAIL', 'FAILED', {
          recipientEmail: email,
          errorMessage: error.message,
          message: item.message,
        });
      }
    }
  }

  private async sendSmsToRecipients(item: any, recipients: any[]) {
    const twilioConfigured = await this.twilioService.isConfigured();
    const beemConfigured = await this.beemService.isConfigured();

    await mapBounded(recipients.filter((r) => r.phone), async (recipient) => {
      const phone = recipient.phone;

      try {
        if (twilioConfigured) {
          const result = await this.twilioService.sendSms(phone, item.message);
          await this.logMessageSent('SMS', result.success ? 'SENT' : 'FAILED', {
            recipientPhone: phone,
            messageId: result.messageId,
            errorMessage: result.error,
            message: item.message,
          });
          if (result.success) return;
          this.logger.warn(`[SMS] Twilio failed, falling back to Beem: ${result.error}`);
        }

        if (beemConfigured) {
          const result = await this.beemService.sendSms(phone, item.message);
          await this.logMessageSent('SMS', result.success ? 'SENT' : 'FAILED', {
            recipientPhone: phone,
            messageId: result.messageId,
            errorMessage: result.error,
            message: item.message,
          });
        } else {
          this.logger.warn(`[SMS] No provider configured for ${phone}`);
          await this.logMessageSent('SMS', 'FAILED', {
            recipientPhone: phone,
            errorMessage: 'No SMS provider configured',
            message: item.message,
          });
        }
      } catch (error: any) {
        this.logger.error(`[SMS] Failed to send to ${phone}: ${error.message}`);
        await this.logMessageSent('SMS', 'FAILED', {
          recipientPhone: phone,
          errorMessage: error.message,
          message: item.message,
        });
      }
    });
  }

  private async sendWhatsAppToRecipients(item: any, recipients: any[]) {
    for (const recipient of recipients) {
      const phone = recipient.phone;
      if (!phone) continue;

      try {
        const result = await this.beemService.sendWhatsApp(phone, item.message);
        await this.logMessageSent('WHATSAPP', result.success ? 'SENT' : 'FAILED', {
          recipientPhone: phone,
          messageId: result.messageId,
          errorMessage: result.error,
          message: item.message,
        });
      } catch (error: any) {
        this.logger.error(`[WhatsApp] Failed to send to ${phone}: ${error.message}`);
        await this.logMessageSent('WHATSAPP', 'FAILED', {
          recipientPhone: phone,
          errorMessage: error.message,
          message: item.message,
        });
      }
    }
  }

  private async sendPushToRecipients(item: any, recipients: any[]) {
    for (const recipient of recipients) {
      const userId = recipient.id;
      if (!userId) continue;

      try {
        await this.pushNotificationService.sendToUser(userId, {
          title: item.title || item.subject || 'System Communication',
          body: item.message,
          data: { type: 'system_communication' },
        });
      } catch (error: any) {
        this.logger.error(`[Push] Failed to send to user ${userId}: ${error.message}`);
      }
    }
  }

  private async sendInAppToRecipients(item: any, recipients: any[]) {
    for (const recipient of recipients) {
      const userId = recipient.id;
      if (!userId) continue;

      try {
        await this.prisma.notification.create({
          data: {
            userId,
            title: item.title || 'System Communication',
            body: item.message,
            type: 'system_communication',
            data: { source: 'broadcast', broadcastId: item.id },
          },
        });
      } catch (error: any) {
        this.logger.error(`[InApp] Failed to create notification for user ${userId}: ${error.message}`);
      }
    }
  }

  async sendTestSms(to: string, message?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const msg = message || 'This is a test SMS from Smart Tech SaaS. If you receive this, SMS is working correctly.';

    const normalizedTo = to.replace(/[+\s\-\(\)]/g, '');
    const formattedTo = normalizedTo.startsWith('+') ? normalizedTo : `+${normalizedTo}`;

    const twilioConfigured = await this.twilioService.isConfigured();
    const beemConfigured = await this.beemService.isConfigured();

    if (twilioConfigured) {
      try {
        const result = await this.twilioService.sendSms(formattedTo, msg);
        if (result.success) {
          await this.logMessageSent('SMS', 'SENT', {
            recipientPhone: formattedTo,
            messageId: result.messageId,
            message: msg,
          });
          return { success: true, messageId: result.messageId };
        }
        this.logger.warn(`[Test SMS] Twilio failed, falling back to Beem: ${result.error}`);
      } catch (error: any) {
        this.logger.warn(`[Test SMS] Twilio error, falling back to Beem: ${error.message}`);
      }
    }

    if (beemConfigured) {
      try {
        const result = await this.beemService.sendSms(formattedTo, msg);
        if (result.success) {
          await this.logMessageSent('SMS', 'SENT', {
            recipientPhone: formattedTo,
            messageId: result.messageId,
            message: msg,
          });
          return { success: true, messageId: result.messageId };
        }
        return { success: false, error: result.error || 'Beem SMS failed' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    return { success: false, error: 'No SMS provider configured. Set up Twilio or Beem first.' };
  }

  private async logMessageSent(
    channel: string,
    status: string,
    data: {
      recipientEmail?: string;
      recipientPhone?: string;
      message?: string;
      messageId?: string;
      errorMessage?: string;
    },
  ) {
    try {
      await this.prisma.messageLog.create({
        data: {
          channel: channel as any,
          status: status as any,
          recipientEmail: data.recipientEmail,
          recipientPhone: data.recipientPhone,
          message: data.message || '',
          messageId: data.messageId,
          errorMessage: data.errorMessage,
          sentAt: status === 'SENT' ? new Date() : null,
        },
      });
    } catch (error: any) {
      this.logger.error(`[LogMessage] Failed to log: ${error.message}`);
    }
  }
}
