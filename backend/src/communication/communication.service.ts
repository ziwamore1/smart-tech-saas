import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import mail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';
import AfricasTalking from 'africastalking';

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);
  private readonly atApiKey: string;
  private readonly atSenderId: string;
  private readonly sendgridApiKey: string;
  private readonly sendgridFromEmail: string;
  private readonly twilioAccountSid: string;
  private readonly twilioAuthToken: string;
  private readonly twilioPhoneNumber: string;
  private readonly twilioWhatsAppNumber: string;
  private readonly zohoTransporter: any;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.atApiKey = this.configService.get<string>('AFRICASTALKING_API_KEY', '');
    this.atSenderId = this.configService.get<string>('AFRICASTALKING_SENDER_ID', 'SmartTech');
    this.sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY', '');
    this.sendgridFromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL', 'noreply@smarttechsaas.com');
    this.twilioAccountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID', '');
    this.twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN', '');
    this.twilioPhoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER', '');
    this.twilioWhatsAppNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER', '');

    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD', '');
    this.zohoTransporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: {
        user: 'noreply@smarttechsaas.com',
        pass: emailPassword,
      },
    });

    if (this.sendgridApiKey) {
      mail.setApiKey(this.sendgridApiKey);
      this.logger.log('[SendGrid] API initialized');
    }
  }

  private async ensureSystemSchool(): Promise<void> {
    const systemSchool = await this.prisma.school.findUnique({
      where: { id: 'system' },
    });
    if (!systemSchool) {
      await this.prisma.school.create({
        data: {
          id: 'system',
          name: 'System',
        },
      });
    }
  }

  async createCommunication(data: {
    type: string;
    subject?: string;
    message: string;
    recipientType?: string;
    recipientIds?: string[];
    schoolId: string;
    createdById?: string;
    scheduledAt?: Date;
  }) {
    const communication = await this.prisma.communication.create({
      data: {
        type: data.type as any,
        subject: data.subject,
        message: data.message,
        recipientType: data.recipientType,
        recipientIds: data.recipientIds || [],
        schoolId: data.schoolId,
        createdById: data.createdById,
        scheduledAt: data.scheduledAt,
        status: 'PENDING',
      },
    });

    return communication;
  }

  async getCommunications(
    schoolId: string,
    options?: {
      type?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { schoolId };
    if (options?.type) where.type = options.type;
    if (options?.status) where.status = options.status;

    const [communications, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        include: {
          communicationLogs: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.communication.count({ where }),
    ]);

    return { communications, total };
  }

  async getCommunicationById(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      include: {
        communicationLogs: {
          orderBy: { timestamp: 'desc' },
        },
        school: { select: { id: true, name: true } },
      },
    });

    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    return communication;
  }

  async sendCommunication(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      include: {
        school: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    const settings = await this.getCommunicationSettings(
      communication.schoolId,
    );

    try {
      let result: any = { success: true };

      switch (communication.type) {
        case 'SMS':
          result = await this.sendSMS(communication, settings);
          break;
        case 'EMAIL':
          result = await this.sendEmail(communication, settings);
          break;
        case 'WHATSAPP':
          result = await this.sendWhatsApp(communication, settings);
          break;
        case 'FACEBOOK':
          result = await this.sendFacebookPost(communication, settings);
          break;
        case 'YOUTUBE':
          result = await this.publishYouTube(communication, settings);
          break;
        case 'LINKEDIN':
          result = await this.postLinkedIn(communication, settings);
          break;
        case 'PUSH_NOTIFICATION':
          result = await this.sendPushNotification(communication, settings);
          break;
        default:
          throw new BadRequestException(
            `Unsupported communication type: ${communication.type}`,
          );
      }

      await this.prisma.communication.update({
        where: { id },
        data: {
          status: result.success ? 'SENT' : 'FAILED',
          sentAt: result.success ? new Date() : undefined,
          errorMessage: result.error,
        },
      });

      await this.addLog(id, result.success ? 'sent' : 'failed', {
        details: result.details,
        error: result.error,
      });

      return result;
    } catch (error) {
      await this.prisma.communication.update({
        where: { id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          retryCount: { increment: 1 },
        },
      });

      await this.addLog(id, 'failed', { error: error.message });

      throw error;
    }
  }

  private async sendSMS(communication: any, settings: any) {
    if (!settings.smsEnabled) {
      return { success: false, error: 'SMS is not enabled for this school' };
    }

    const recipients = await this.getRecipients(communication);

    this.logger.log(
      `[SMS] Sending to ${recipients.length} recipients: ${communication.message.substring(0, 50)}...`,
    );

    for (const recipient of recipients) {
      if (recipient.phone) {
        await this.simulateSMSApi(
          settings,
          recipient.phone,
          communication.message,
        );
        await this.addLog(communication.id, 'sent', {
          recipientId: recipient.id,
          phone: recipient.phone,
        });
      }
    }

    return {
      success: true,
      details: {
        recipientsCount: recipients.filter((r: any) => r.phone).length,
      },
    };
  }

  private async sendEmail(communication: any, settings: any) {
    if (!settings.emailEnabled) {
      return { success: false, error: 'Email is not enabled for this school' };
    }

    const recipients = await this.getRecipients(communication);

    this.logger.log(
      `[Email] Sending to ${recipients.length} recipients: ${communication.subject}`,
    );

    for (const recipient of recipients) {
      if (recipient.email) {
        await this.simulateEmailApi(
          settings,
          recipient.email,
          communication.subject,
          communication.message,
        );
        await this.addLog(communication.id, 'sent', {
          recipientId: recipient.id,
          email: recipient.email,
        });
      }
    }

    return {
      success: true,
      details: {
        recipientsCount: recipients.filter((r: any) => r.email).length,
      },
    };
  }

  private async sendWhatsApp(communication: any, settings: any) {
    if (!settings.whatsappEnabled) {
      return {
        success: false,
        error: 'WhatsApp is not enabled for this school',
      };
    }

    const recipients = await this.getRecipients(communication);

    this.logger.log(`[WhatsApp] Sending to ${recipients.length} recipients`);

    const finalSettings: any = { ...settings };
    if (this.twilioAccountSid && this.twilioAuthToken && this.twilioWhatsAppNumber) {
      finalSettings.whatsappProvider = 'twilio';
      finalSettings.whatsappApiKey = this.twilioAccountSid;
      finalSettings.whatsappApiSecret = this.twilioAuthToken;
      finalSettings.whatsappPhoneId = this.twilioWhatsAppNumber;
    }

    for (const recipient of recipients) {
      if (recipient.phone) {
        await this.simulateWhatsAppApi(
          finalSettings,
          recipient.phone,
          communication.message,
        );
        await this.addLog(communication.id, 'sent', {
          recipientId: recipient.id,
          phone: recipient.phone,
        });
      }
    }

    return {
      success: true,
      details: {
        recipientsCount: recipients.filter((r: any) => r.phone).length,
      },
    };
  }

  private async sendFacebookPost(communication: any, settings: any) {
    if (!settings.facebookEnabled) {
      return { success: false, error: 'Facebook integration is not enabled' };
    }

    this.logger.log(`[Facebook] Posting to page ${settings.facebookPageId}`);

    const postResult = await this.simulateFacebookApi(
      settings,
      communication.message,
      communication.subject,
    );

    await this.addLog(communication.id, 'posted', {
      pageId: settings.facebookPageId,
      postId: postResult.postId,
    });

    return {
      success: true,
      details: { postId: postResult.postId, platform: 'Facebook' },
    };
  }

  private async publishYouTube(communication: any, settings: any) {
    if (!settings.youtubeEnabled) {
      return { success: false, error: 'YouTube integration is not enabled' };
    }

    this.logger.log(
      `[YouTube] Publishing to channel ${settings.youtubeChannelId}`,
    );

    const videoResult = await this.simulateYouTubeApi(
      settings,
      communication.subject,
      communication.message,
    );

    await this.addLog(communication.id, 'published', {
      channelId: settings.youtubeChannelId,
      videoId: videoResult.videoId,
    });

    return {
      success: true,
      details: { videoId: videoResult.videoId, platform: 'YouTube' },
    };
  }

  private async postLinkedIn(communication: any, settings: any) {
    if (!settings.linkedinEnabled) {
      return { success: false, error: 'LinkedIn integration is not enabled' };
    }

    this.logger.log(`[LinkedIn] Posting to page ${settings.linkedinPageId}`);

    const postResult = await this.simulateLinkedInApi(
      settings,
      communication.subject,
      communication.message,
    );

    await this.addLog(communication.id, 'posted', {
      pageId: settings.linkedinPageId,
      postId: postResult.postId,
    });

    return {
      success: true,
      details: { postId: postResult.postId, platform: 'LinkedIn' },
    };
  }

  private async sendPushNotification(communication: any, settings: any) {
    if (!settings.pushEnabled) {
      return { success: false, error: 'Push notifications are not enabled' };
    }

    const recipients = await this.getRecipients(communication);

    this.logger.log(`[Push] Sending to ${recipients.length} recipients`);

    for (const recipient of recipients) {
      if (recipient.id) {
        await this.simulatePushApi(
          settings,
          recipient.id,
          communication.subject,
          communication.message,
        );
        await this.addLog(communication.id, 'sent', {
          recipientId: recipient.id,
        });
      }
    }

    return {
      success: true,
      details: { recipientsCount: recipients.length },
    };
  }

  private async getRecipients(communication: any) {
    const { recipientType, recipientIds, schoolId } = communication;

    if (recipientIds && recipientIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: recipientIds }, schoolId },
        select: { id: true, email: true, phone: true },
      });
      return users;
    }

    switch (recipientType) {
      case 'student':
        return this.prisma.student
          .findMany({
            where: { schoolId },
            include: { user: { select: { id: true, email: true } } },
          })
          .then((students) =>
            students.map((s) => ({
              id: s.user?.id,
              email: s.user?.email,
              phone: undefined,
            })),
          );

      case 'parent':
        return this.prisma.parent.findMany({
          where: { schoolId },
          select: { id: true, email: true, phone: true },
        });

      case 'teacher':
        return this.prisma.user.findMany({
          where: { schoolId, teacher: { isNot: null } },
          select: { id: true, email: true, phone: true },
        });

      case 'director':
        const directorRole = await this.prisma.role.findUnique({
          where: { name: 'Director' },
        });
        return this.prisma.user.findMany({
          where: {
            schoolId,
            userRoles: { some: { roleId: directorRole?.id } },
          },
          select: { id: true, email: true, phone: true },
        });

      case 'all':
      default:
        const allUsers = await this.prisma.user.findMany({
          where: { schoolId },
          select: { id: true, email: true, phone: true },
        });
        const allParents = await this.prisma.parent.findMany({
          where: { schoolId },
          select: { id: true, email: true, phone: true },
        });
        return [...allUsers, ...allParents];
    }
  }

  async getCommunicationSettings(schoolId: string) {
    let settings = await this.prisma.communicationSettings.findUnique({
      where: { schoolId },
    });

    if (!settings) {
      settings = await this.prisma.communicationSettings.create({
        data: { schoolId },
      });
    }

    return settings;
  }

  async updateCommunicationSettings(schoolId: string, data: any) {
    const settings = await this.prisma.communicationSettings.upsert({
      where: { schoolId },
      update: data,
      create: { schoolId, ...data },
    });

    return settings;
  }

  async getCommunicationStats(
    schoolId: string,
    dateRange?: { start: Date; end: Date },
  ) {
    const where: any = { schoolId };
    if (dateRange) {
      where.createdAt = { gte: dateRange.start, lte: dateRange.end };
    }

    const [total, byType, byStatus, recentActivity] = await Promise.all([
      this.prisma.communication.count({ where }),
      this.prisma.communication.groupBy({
        by: ['type'],
        where,
        _count: { type: true },
      }),
      this.prisma.communication.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.communication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          status: true,
          subject: true,
          createdAt: true,
          sentAt: true,
        },
      }),
    ]);

    return {
      total,
      byType: byType.map((t) => ({ type: t.type, count: t._count.type })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      recentActivity,
    };
  }

  async deleteCommunication(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
    });
    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    await this.prisma.communication.delete({ where: { id } });
    return { message: 'Communication deleted successfully' };
  }

  private async addLog(communicationId: string, action: string, details?: any) {
    return this.prisma.communicationLog.create({
      data: {
        communicationId,
        action,
        details,
      },
    });
  }

  async sendBulkCommunication(id: string, recipientIds: string[]) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      include: { school: true },
    });

    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    const settings = await this.getCommunicationSettings(
      communication.schoolId,
    );

    try {
      let result: any = { success: true };

      switch (communication.type) {
        case 'SMS':
          result = await this.sendBulkSMS(
            communication,
            settings,
            recipientIds,
          );
          break;
        case 'WHATSAPP':
          result = await this.sendBulkWhatsApp(
            communication,
            settings,
            recipientIds,
          );
          break;
        case 'EMAIL':
          result = await this.sendBulkEmail(
            communication,
            settings,
            recipientIds,
          );
          break;
        default:
          throw new BadRequestException(
            `Bulk sending not supported for type: ${communication.type}`,
          );
      }

      await this.prisma.communication.update({
        where: { id },
        data: {
          status: result.success ? 'SENT' : 'FAILED',
          sentAt: result.success ? new Date() : undefined,
          recipientIds: recipientIds,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.communication.update({
        where: { id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      throw error;
    }
  }

  private async sendBulkSMS(
    communication: any,
    settings: any,
    recipientIds: string[],
  ) {
    if (!settings.smsEnabled) {
      return { success: false, error: 'SMS is not enabled for this school' };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: recipientIds }, schoolId: communication.schoolId },
      select: { id: true, phone: true },
    });

    let sentCount = 0;
    for (const user of users) {
      if (user.phone) {
        await this.simulateSMSApi(settings, user.phone, communication.message);
        await this.addLog(communication.id, 'sent', {
          recipientId: user.id,
          phone: user.phone,
        });
        sentCount++;
      }
    }

    return {
      success: true,
      details: {
        recipientsCount: sentCount,
        totalRecipients: recipientIds.length,
      },
    };
  }

  private async sendBulkWhatsApp(
    communication: any,
    settings: any,
    recipientIds: string[],
  ) {
    if (!settings.whatsappEnabled) {
      return {
        success: false,
        error: 'WhatsApp is not enabled for this school',
      };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: recipientIds }, schoolId: communication.schoolId },
      select: { id: true, phone: true },
    });

    const finalSettings: any = { ...settings };
    if (this.twilioAccountSid && this.twilioAuthToken && this.twilioWhatsAppNumber) {
      finalSettings.whatsappProvider = 'twilio';
      finalSettings.whatsappApiKey = this.twilioAccountSid;
      finalSettings.whatsappApiSecret = this.twilioAuthToken;
      finalSettings.whatsappPhoneId = this.twilioWhatsAppNumber;
    }

    let sentCount = 0;
    let failedCount = 0;
    const failures: string[] = [];
    for (const user of users) {
      if (user.phone) {
        const result = await this.simulateWhatsAppApi(
          finalSettings,
          user.phone,
          communication.message,
        );
        if (result.success) {
          await this.addLog(communication.id, 'sent', {
            recipientId: user.id,
            phone: user.phone,
          });
          sentCount++;
        } else {
          failedCount++;
          failures.push(`${user.phone}: ${result.error}`);
        }
      }
    }

    return {
      success: failedCount === 0,
      details: {
        recipientsCount: sentCount,
        totalRecipients: recipientIds.length,
        failedCount,
        failures,
      },
    };
  }

  private async sendBulkEmail(
    communication: any,
    settings: any,
    recipientIds: string[],
  ) {
    if (!settings.emailEnabled) {
      return { success: false, error: 'Email is not enabled for this school' };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: recipientIds }, schoolId: communication.schoolId },
      select: { id: true, email: true },
    });

    let sentCount = 0;
    let failedCount = 0;
    const failures: string[] = [];
    for (const user of users) {
      if (user.email) {
        const result = await this.simulateEmailApi(
          settings,
          user.email,
          communication.subject,
          communication.message,
        );
        if (result.success) {
          await this.addLog(communication.id, 'sent', {
            recipientId: user.id,
            email: user.email,
          });
          sentCount++;
        } else {
          failedCount++;
          failures.push(`${user.email}: ${result.error}`);
        }
      }
    }

    return {
      success: failedCount === 0,
      details: {
        recipientsCount: sentCount,
        totalRecipients: recipientIds.length,
        failedCount,
        failures,
      },
    };
  }

  async scheduleCommunication(data: {
    type: string;
    subject?: string;
    message: string;
    recipientType?: string;
    schoolId: string;
    createdById?: string;
    scheduledAt: Date;
  }) {
    const communication = await this.prisma.communication.create({
      data: {
        type: data.type as any,
        subject: data.subject,
        message: data.message,
        recipientType: data.recipientType,
        recipientIds: [],
        schoolId: data.schoolId,
        createdById: data.createdById,
        scheduledAt: data.scheduledAt,
        status: 'PENDING',
      },
    });

    await this.addLog(communication.id, 'scheduled', {
      scheduledAt: data.scheduledAt,
    });

    return communication;
  }

  async getCommunicationTemplates(schoolId: string) {
    return [
      {
        id: '1',
        name: 'Exam Results Notification',
        type: 'SMS',
        subject: 'Exam Results Available',
        message:
          "Dear Parent, Your child's exam results for {term} are now available. Please check the portal for details.",
      },
      {
        id: '2',
        name: 'Fee Reminder',
        type: 'SMS',
        subject: 'Fee Payment Reminder',
        message:
          'Dear Parent, This is a reminder that school fees for {term} are due. Please ensure payment is made by {dueDate}.',
      },
      {
        id: '3',
        name: 'Event Announcement',
        type: 'WHATSAPP',
        subject: 'School Event',
        message:
          'Dear Parents, You are invited to {eventName} on {eventDate}. Kindly confirm attendance.',
      },
      {
        id: '4',
        name: 'Achievement Celebration',
        type: 'FACEBOOK',
        subject: 'Student Achievement',
        message:
          'Congratulations to our students for their outstanding performance in {exam}! We are proud of you.',
      },
      {
        id: '5',
        name: 'Important Notice',
        type: 'EMAIL',
        subject: 'Important School Notice',
        message:
          'Dear Parents and Guardians, Please be informed about the upcoming changes to the school schedule.',
      },
      {
        id: '6',
        name: 'Emergency Alert',
        type: 'SMS',
        subject: 'Emergency Alert',
        message: 'URGENT: {message}. Please take immediate action.',
      },
    ];
  }

  async createCommunicationTemplate(data: {
    name: string;
    type: string;
    subject?: string;
    message: string;
    schoolId: string;
  }) {
    return {
      id: `template_${Date.now()}`,
      ...data,
      createdAt: new Date(),
    };
  }

  async getPlatformAnalytics(schoolId: string, platform: string) {
    const communications = await this.prisma.communication.findMany({
      where: { schoolId, type: platform as any },
      include: { communicationLogs: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const total = communications.length;
    const sent = communications.filter((c) => c.status === 'SENT').length;
    const failed = communications.filter((c) => c.status === 'FAILED').length;
    const pending = communications.filter(
      (c) => c.status === 'PENDING',
    ).length;

    const deliveryRate = total > 0 ? (sent / total) * 100 : 0;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    const recentPosts = communications.map((c) => ({
      id: c.id,
      message: c.message,
      status: c.status,
      createdAt: c.createdAt,
      sentAt: c.sentAt,
    }));

    return {
      platform,
      overview: {
        total,
        sent,
        failed,
        pending,
        deliveryRate: Number(deliveryRate.toFixed(2)),
        failureRate: Number(failureRate.toFixed(2)),
      },
      recentPosts,
      engagement:
        platform === 'YOUTUBE'
          ? {
              views: Math.floor(Math.random() * 1000),
              likes: Math.floor(Math.random() * 200),
              comments: Math.floor(Math.random() * 50),
            }
          : platform === 'FACEBOOK'
            ? {
                likes: Math.floor(Math.random() * 500),
                shares: Math.floor(Math.random() * 100),
                comments: Math.floor(Math.random() * 75),
              }
            : platform === 'LINKEDIN'
              ? {
                  impressions: Math.floor(Math.random() * 2000),
                  clicks: Math.floor(Math.random() * 300),
                  engagementRate: Number((Math.random() * 10).toFixed(2)),
                }
              : {
                  delivered: sent,
                  read: Math.floor(sent * 0.7),
                  responseRate: Number((Math.random() * 30).toFixed(2)),
                },
    };
  }

  async getRealtimeAlerts(schoolId: string) {
    const recentResults = await this.prisma.result.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { student: true, subject: true },
    });

    const alerts: Array<{
      type: string;
      priority: string;
      student?: string;
      subject?: string;
      score?: number;
      count?: number;
      message: string;
      timestamp: Date;
    }> = [];

    for (const result of recentResults) {
      if (result.score < 40) {
        alerts.push({
          type: 'LOW_SCORE',
          priority: 'high',
          student: `${result.student.firstName} ${result.student.lastName}`,
          subject: result.subject.name,
          score: result.score,
          message: `Alert: ${result.student.firstName} scored ${result.score}% in ${result.subject.name}. Immediate intervention recommended.`,
          timestamp: result.createdAt,
        });
      }
    }

    const pendingFees = await this.prisma.feePayment.groupBy({
      by: ['status'],
      where: { schoolId },
      _count: true,
    });

    const unpaidFees = pendingFees.find((p) => p.status === 'PENDING');
    if (unpaidFees && unpaidFees._count > 5) {
      alerts.push({
        type: 'UNPAID_FEES',
        priority: 'medium',
        count: unpaidFees._count,
        message: `${unpaidFees._count} students have unpaid fees. Consider sending payment reminders.`,
        timestamp: new Date(),
      });
    }

    return alerts.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async sendSMSAlert(data: {
    message: string;
    priority?: string;
    schoolId: string;
    createdById?: string;
  }) {
    const communication = await this.prisma.communication.create({
      data: {
        type: 'SMS',
        message: data.message,
        schoolId: data.schoolId,
        createdById: data.createdById,
        status: 'PENDING',
        recipientType: 'all',
        metadata: { priority: data.priority || 'normal', isAlert: true },
      },
    });

    try {
      const result = await this.sendCommunication(communication.id);
      return {
        ...result,
        communicationId: communication.id,
        sentAt: new Date(),
      };
    } catch (error) {
      await this.prisma.communication.update({
        where: { id: communication.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      throw error;
    }
  }

  private async simulateSMSApi(settings: any, phone: string, message: string) {
    if (settings.smsProvider === 'twilio' && settings.smsApiKey && settings.smsApiSecret && settings.smsSenderId) {
      try {
        const client = twilio(settings.smsApiKey, settings.smsApiSecret);
        const result = await client.messages.create({
          body: message,
          from: settings.smsSenderId,
          to: phone,
        });
        this.logger.log(`[Twilio SMS] Sent to ${phone}, SID: ${result.sid}`);
        return { success: true, messageId: result.sid };
      } catch (error) {
        this.logger.error(`[Twilio SMS] Failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    }

    if (settings.smsProvider === 'africastalking' && settings.smsApiKey && settings.smsSenderId) {
      this.logger.log(`[Africa's Talking SMS] To: ${phone}, Message: ${message.substring(0, 30)}...`);
      return { success: true, messageId: `at_${Date.now()}` };
    }

    this.logger.log(
      `[SMS API] To: ${phone}, Message: ${message.substring(0, 30)}...`,
    );
    return { success: true, messageId: `sms_${Date.now()}` };
  }

  private async simulateEmailApi(
    settings: any,
    to: string,
    subject: string,
    body: string,
  ) {
    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD', '');
    
    if (emailPassword && emailPassword !== 'your_zoho_password') {
      try {
        const info = await this.zohoTransporter.sendMail({
          from: '"Smart Tech" <noreply@smarttechsaas.com>',
          to,
          subject,
          html: body,
        });
        this.logger.log(`[Zoho Email] Sent to ${to}, MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (error) {
        this.logger.warn(`[Zoho Email] Failed: ${error.message}`);
      }
    }

    if (settings.emailProvider === 'sendgrid' && settings.smtpApiKey) {
      const msg = {
        to,
        from: settings.smtpFromEmail || 'noreply@school.com',
        subject,
        html: body,
      };
      try {
        await mail.send(msg);
        this.logger.log(`[SendGrid Email] Sent to ${to}`);
        return { success: true, messageId: `sg_${Date.now()}` };
      } catch (error) {
        this.logger.error(`[SendGrid Email] Failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    }

    if (settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPassword) {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpPort === 465,
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPassword,
        },
      });
      try {
        const info = await transporter.sendMail({
          from: `"${settings.smtpFromName || 'School'}" <${settings.smtpFromEmail}>`,
          to,
          subject,
          html: body,
        });
        this.logger.log(`[SMTP Email] Sent to ${to}, MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (error) {
        this.logger.error(`[SMTP Email] Failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    }

    this.logger.error(`[Email] No email provider configured. Set EMAIL_PASSWORD in .env`);
    return { success: false, error: 'No email provider configured' };
  }

  private async simulateWhatsAppApi(
    settings: any,
    phone: string,
    message: string,
  ) {
    if (settings.whatsappProvider === 'twilio' && settings.whatsappApiKey && settings.whatsappApiSecret && settings.whatsappPhoneId) {
      try {
        const client = twilio(settings.whatsappApiKey, settings.whatsappApiSecret);
        const normalizedTo = phone.startsWith('+') ? phone : `+${phone}`;
        const result = await client.messages.create({
          body: message,
          from: `whatsapp:${settings.whatsappPhoneId}`,
          to: `whatsapp:${normalizedTo}`,
        });
        this.logger.log(`[Twilio WhatsApp] Sent to ${phone}, SID: ${result.sid}`);
        return { success: true, messageId: result.sid };
      } catch (error) {
        this.logger.error(`[Twilio WhatsApp] Failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    }

    const twilioAccountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER');

    if (twilioAccountSid && twilioAuthToken && twilioWhatsAppNumber) {
      try {
        const client = twilio(twilioAccountSid, twilioAuthToken);
        const normalizedTo = phone.startsWith('+') ? phone : `+${phone}`;
        const result = await client.messages.create({
          body: message,
          from: `whatsapp:${twilioWhatsAppNumber}`,
          to: `whatsapp:${normalizedTo}`,
        });
        this.logger.log(`[Twilio WhatsApp] Sent to ${phone}, SID: ${result.sid}`);
        return { success: true, messageId: result.sid };
      } catch (error) {
        this.logger.error(`[Twilio WhatsApp] Failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    }

    this.logger.error('[WhatsApp] No WhatsApp provider configured or missing credentials');
    return { success: false, error: 'WhatsApp provider not configured' };
  }

  private async simulateFacebookApi(
    settings: any,
    message: string,
    link?: string,
  ) {
    this.logger.log(
      `[Facebook API] Page: ${settings.facebookPageId}, Message: ${message.substring(0, 30)}...`,
    );
    return { success: true, postId: `fb_${Date.now()}` };
  }

  private async simulateYouTubeApi(
    settings: any,
    title: string,
    description: string,
  ) {
    this.logger.log(
      `[YouTube API] Channel: ${settings.youtubeChannelId}, Title: ${title}`,
    );
    return { success: true, videoId: `yt_${Date.now()}` };
  }

  private async simulateLinkedInApi(
    settings: any,
    title: string,
    content: string,
  ) {
    this.logger.log(
      `[LinkedIn API] Page: ${settings.linkedinPageId}, Title: ${title}`,
    );
    return { success: true, postId: `li_${Date.now()}` };
  }

  private async simulatePushApi(
    settings: any,
    userId: string,
    title: string,
    body: string,
    data?: any,
  ) {
    if (settings.pushProvider === 'fcm' && settings.fcmServerKey) {
      this.logger.log(`[FCM Push] To user: ${userId}, Title: ${title}`);
      return { success: true, messageId: `fcm_${Date.now()}` };
    }

    this.logger.log(
      `[Push API] To user: ${userId}, Title: ${title}, Body: ${body.substring(0, 30)}...`,
    );
    return { success: true, messageId: `push_${Date.now()}` };
  }

  async sendSystemEmail(to: string, subject: string, content: string) {
    await this.ensureSystemSchool();
    let settings = await this.prisma.communicationSettings.findUnique({
      where: { schoolId: 'system' },
    });

    if (!settings) {
      settings = await this.prisma.communicationSettings.create({
        data: { 
          schoolId: 'system', 
          emailEnabled: true, 
          whatsappEnabled: true,
          emailProvider: 'zoho',
          smtpApiKey: this.sendgridApiKey,
          smtpFromEmail: this.sendgridFromEmail,
        },
      });
    }

    if (!settings.emailEnabled) {
      this.logger.warn('[Email] Email not enabled');
      return { success: false, error: 'Email not enabled' };
    }

    if (this.sendgridApiKey && (!settings.smtpApiKey || settings.smtpApiKey !== this.sendgridApiKey)) {
      settings.smtpApiKey = this.sendgridApiKey;
      settings.emailProvider = 'zoho';
      settings.smtpFromEmail = this.sendgridFromEmail;
      await this.prisma.communicationSettings.update({
        where: { schoolId: 'system' },
        data: {
          smtpApiKey: this.sendgridApiKey,
          emailProvider: 'zoho',
          smtpFromEmail: this.sendgridFromEmail,
        },
      });
      this.logger.log('[Email] Using Zoho SMTP (SendGrid as backup)');
    }

    try {
      const result = await this.simulateEmailApi(settings, to, subject, content);
      if (result.success) {
        this.logger.log(`[Email] Sent to ${to}: ${subject}`);
        return { success: true };
      } else {
        this.logger.error(`[Email] Failed to send to ${to}: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error) {
      this.logger.error(`[Email] Failed to send to ${to}:`, error);
      throw error;
    }
  }

  async sendSystemWhatsApp(to: string, message: string) {
    await this.ensureSystemSchool();
    let settings = await this.prisma.communicationSettings.findUnique({
      where: { schoolId: 'system' },
    });

    if (!settings) {
      settings = await this.prisma.communicationSettings.create({
        data: { 
          schoolId: 'system', 
          emailEnabled: true, 
          whatsappEnabled: true,
          whatsappProvider: this.atApiKey ? 'africastalking' : null,
          whatsappApiKey: this.atApiKey,
          smsSenderId: this.atSenderId,
        },
      });
    }

    if (!settings.whatsappEnabled) {
      this.logger.warn('[WhatsApp] WhatsApp not enabled');
      return { success: false, error: 'WhatsApp not enabled' };
    }

    if (this.twilioAccountSid && this.twilioAuthToken && this.twilioPhoneNumber) {
      this.logger.log('[WhatsApp] Twilio configured via environment variables - skipping provider override');
    } else if (this.atApiKey && (!settings.whatsappApiKey || settings.whatsappApiKey !== this.atApiKey)) {
      settings.whatsappApiKey = this.atApiKey;
      settings.whatsappProvider = 'africastalking';
      settings.smsSenderId = this.atSenderId;
      await this.prisma.communicationSettings.update({
        where: { schoolId: 'system' },
        data: {
          whatsappApiKey: this.atApiKey,
          whatsappProvider: 'africastalking',
          smsSenderId: this.atSenderId,
        },
      });
      this.logger.log('[WhatsApp] Updated settings with Africa\'s Talking credentials');
    }

    const normalizedPhone = to.replace(/\s/g, '');
    const finalSettings: any = { ...settings };

    if (this.twilioAccountSid && this.twilioAuthToken && this.twilioWhatsAppNumber) {
      finalSettings.whatsappProvider = 'twilio';
      finalSettings.whatsappApiKey = this.twilioAccountSid;
      finalSettings.whatsappApiSecret = this.twilioAuthToken;
      finalSettings.whatsappPhoneId = this.twilioWhatsAppNumber;
      this.logger.log('[WhatsApp] Using Twilio WhatsApp from environment variables');
    } else {
      finalSettings.whatsappApiKey = this.atApiKey || settings.whatsappApiKey;
      finalSettings.whatsappProvider = this.atApiKey ? 'africastalking' : settings.whatsappProvider;
      finalSettings.smsSenderId = this.atSenderId || settings.smsSenderId;
    }

    try {
      this.logger.log(`[WhatsApp] Calling simulateWhatsAppApi with provider=${finalSettings.whatsappProvider}, apiKey=${!!finalSettings.whatsappApiKey}`);
      const result = await this.simulateWhatsAppApi(finalSettings, normalizedPhone, message);
      if (result.success) {
        this.logger.log(`[WhatsApp] Sent to ${normalizedPhone}`);
        return { success: true };
      } else {
        this.logger.error(`[WhatsApp] Failed to send to ${normalizedPhone}: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error) {
      this.logger.error(`[WhatsApp] Failed to send to ${normalizedPhone}:`, error);
      throw error;
    }
  }
}
