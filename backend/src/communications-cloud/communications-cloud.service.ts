import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RoutingEngineService } from './routing/routing-engine.service';
import { CommunicationQueueService } from './queue/communication-queue.service';
import { DeliveryTrackingService } from './delivery/delivery-tracking.service';
import { CreditWalletService } from './billing/credit-wallet.service';
import { BillingService } from './billing/billing.service';
import { CommunicationsAnalyticsService } from './analytics/communications-analytics.service';
import { AuditLogService } from './security/audit-log.service';
import { SmsProviderFactory } from './providers/sms/sms-provider.factory';
import { SmsProvider } from './interfaces/provider.interface';
import { EmailProviderFactory } from './providers/email/email-provider.factory';
import { BrevoAdapter, type BrevoConfig } from './providers/email/adapters/brevo.adapter';
import { WhatsAppProviderFactory } from './providers/whatsapp/whatsapp-provider.factory';
import { PushProviderFactory } from './providers/push/push-provider.factory';
import { ZamtelAdapter } from './providers/sms/adapters/zamtel.adapter';
import {
  SendSmsDto, SendEmailDto, SendWhatsAppDto, SendPushDto, SendInAppDto,
  BroadcastDto, ScheduleDto, CommunicationResponseDto, CommCloudChannel,
} from './dto';

@Injectable()
export class CommunicationsCloudService {
  private readonly logger = new Logger(CommunicationsCloudService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private routingEngine: RoutingEngineService,
    private queueService: CommunicationQueueService,
    private deliveryTracking: DeliveryTrackingService,
    private creditWallet: CreditWalletService,
    private billing: BillingService,
    private analytics: CommunicationsAnalyticsService,
    private auditLog: AuditLogService,
    private smsProviderFactory: SmsProviderFactory,
    private emailProviderFactory: EmailProviderFactory,
    private whatsAppProviderFactory: WhatsAppProviderFactory,
    private pushProviderFactory: PushProviderFactory,
  ) {}

  async sendSms(options: SendSmsDto): Promise<CommunicationResponseDto> {
    console.error('[commService] sendSms called', JSON.stringify({ recipient: options.recipient?.slice(0,4) }));
    return this.send(CommCloudChannel.SMS, {
      recipient: options.recipient,
      body: options.message,
      senderIdentity: options.senderId,
      schoolId: options.schoolId,
      userId: options.userId,
      scheduledAt: options.scheduledAt,
      messageType: options.messageType || 'transactional',
      priority: options.priority,
      metadata: { ...options.metadata },
    });
  }

  async sendEmail(options: SendEmailDto): Promise<CommunicationResponseDto> {
    return this.send(CommCloudChannel.EMAIL, {
      recipient: options.getRecipient(),
      subject: options.subject,
      body: options.body,
      htmlBody: options.htmlBody,
      senderIdentity: options.senderEmail,
      senderName: options.senderName,
      schoolId: options.schoolId,
      scheduledAt: options.scheduledAt,
      attachments: options.attachments,
      metadata: {
        cc: options.cc,
        bcc: options.bcc,
        trackOpens: options.trackOpens,
        trackClicks: options.trackClicks,
        ...options.metadata,
      },
    });
  }

  async sendWhatsApp(options: SendWhatsAppDto): Promise<CommunicationResponseDto> {
    return this.send(CommCloudChannel.WHATSAPP, {
      recipient: options.recipient,
      body: options.message,
      schoolId: options.schoolId,
      scheduledAt: options.scheduledAt,
      messageType: 'transactional',
      metadata: {
        templateName: options.templateName,
        templateData: options.templateData,
        mediaUrl: options.mediaUrl,
        mediaType: options.mediaType,
        document: options.document,
        ...options.metadata,
      },
    });
  }

  async sendPush(options: SendPushDto): Promise<CommunicationResponseDto> {
    const recipients = options.userIds || (options.userId ? [options.userId] : []);
    const results = await Promise.all(
      recipients.map(userId =>
        this.send(CommCloudChannel.PUSH, {
          recipient: userId,
          subject: options.title,
          body: options.body,
          schoolId: options.schoolId,
          metadata: {
            data: options.data,
            role: options.role,
            classId: options.classId,
          },
        }),
      ),
    );
    return results[0];
  }

  async sendInApp(options: SendInAppDto): Promise<CommunicationResponseDto> {
    const recipients = options.userIds || (options.userId ? [options.userId] : []);
    const results = await Promise.all(
      recipients.map(userId =>
        this.send(CommCloudChannel.IN_APP, {
          recipient: userId,
          subject: options.title,
          body: options.body,
          schoolId: options.schoolId,
          metadata: {
            type: options.type,
            link: options.data?.link,
            action: options.data?.action,
          },
        }),
      ),
    );
    return results[0];
  }

  async broadcast(options: BroadcastDto): Promise<CommunicationResponseDto[]> {
    const recipients = await this.resolveRecipients(options);
    const messages = recipients.map(r => ({
      channel: options.channel,
      recipient: r,
      body: options.message,
      subject: options.subject,
      schoolId: options.schoolIds?.[0],
      scheduledAt: options.scheduledAt,
      messageType: 'broadcast',
    }));

    const results = await Promise.all(
      messages.map(m => this.send(m.channel, m)),
    );

    await this.auditLog.record('BROADCAST_SENT', { channel: options.channel, count: results.length });
    return results;
  }

  async schedule(options: ScheduleDto): Promise<CommunicationResponseDto> {
    return this.send(options.communicationType, {
      recipient: options.recipient,
      subject: options.subject,
      body: options.message,
      schoolId: options.schoolId,
      scheduledAt: options.scheduledAt,
      metadata: options.metadata,
    });
  }

  async cancel(messageId: string): Promise<void> {
    await this.prisma.commCloudMessage.update({
      where: { id: messageId },
      data: { status: 'CANCELLED' },
    });
    await this.auditLog.record('MESSAGE_CANCELLED', { messageId });
  }

  async retry(messageId: string): Promise<CommunicationResponseDto> {
    const message = await this.prisma.commCloudMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.status !== 'FAILED') throw new BadRequestException('Only failed messages can be retried');

    await this.queueService.retryMessage(messageId);

    return {
      id: message.id,
      channel: message.channel as CommCloudChannel,
      status: 'QUEUED',
      recipient: message.recipient,
      subject: message.subject || undefined,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async sendOTP(phone: string, message?: string): Promise<CommunicationResponseDto> {
    return this.sendSms({
      recipient: phone,
      message: message || 'Your verification code is {{otp}}. Valid for 10 minutes.',
      messageType: 'OTP',
    } as SendSmsDto);
  }

  async findAll(filters: {
    channel?: string;
    status?: string;
    schoolId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ messages: any[]; total: number }> {
    const where: any = {};
    if (filters.channel) where.channel = filters.channel;
    if (filters.status) where.status = filters.status;
    if (filters.schoolId) where.schoolId = filters.schoolId;

    const [messages, total] = await Promise.all([
      this.prisma.commCloudMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.commCloudMessage.count({ where }),
    ]);

    return { messages, total };
  }

  async findOne(id: string): Promise<any> {
    const message = await this.prisma.commCloudMessage.findUnique({
      where: { id },
      include: {
        deliveryLogs: {
          orderBy: { loggedAt: 'asc' },
          include: { provider: { select: { id: true, name: true, channel: true } } },
        },
      },
    });
    if (!message) throw new NotFoundException(`Message ${id} not found`);
    return message;
  }

  async processMessage(messageData: any): Promise<any> {
    const { id, channel, recipient, body, subject, htmlBody, senderIdentity, schoolId, metadata } = messageData;

    try {
      const routingContext = {
        channel,
        messageType: messageData.messageType,
        schoolId,
        country: metadata?.country,
        preferredProviderId: metadata?.preferredProviderId,
      };

      const decision = await this.routingEngine.resolveProvider(routingContext);
      const dbProviderId = decision.providerId.startsWith('env:') ? null : decision.providerId;

      let result: any;
      switch (channel) {
        case CommCloudChannel.SMS:
          let smsProvider: SmsProvider;
          if (decision.providerId.startsWith('env:') && schoolId) {
            smsProvider = await this.smsProviderFactory.getSchoolSmsProvider(schoolId)
              || this.smsProviderFactory.getProviderByType(decision.providerId.slice(4))
              || await this.smsProviderFactory.getProvider(decision.providerId);
          } else {
            smsProvider = await this.smsProviderFactory.getProvider(decision.providerId);
          }
          result = await smsProvider.send({ to: recipient, body, senderId: senderIdentity });
          break;
        case CommCloudChannel.EMAIL:
          let emailProvider: any;
          if (decision.providerId.startsWith('env:')) {
            const providerType = decision.providerId.slice(4);
            emailProvider = this.buildEnvEmailProvider(providerType);
          } else {
            emailProvider = await this.emailProviderFactory.getProvider(decision.providerId);
          }
          result = await emailProvider.send({
            to: recipient, subject, body, htmlBody, from: senderIdentity,
            cc: metadata?.cc, bcc: metadata?.bcc,
          });
          break;
        case CommCloudChannel.WHATSAPP:
          const waProvider = await this.whatsAppProviderFactory.getProvider(decision.providerId);
          result = await waProvider.send({
            to: recipient, body,
            templateId: metadata?.templateName,
            templateData: metadata?.templateData,
            mediaUrl: metadata?.mediaUrl,
            mediaType: metadata?.mediaType,
          });
          break;
        case CommCloudChannel.PUSH:
          const pushProvider = await this.pushProviderFactory.getProvider(decision.providerId);
          result = await pushProvider.send({
            to: recipient,
            title: subject,
            body,
            data: metadata?.data,
          });
          break;
        case CommCloudChannel.IN_APP:
          result = { success: true, messageId: id, status: 'DELIVERED' };
          break;
        default:
          throw new Error(`Unknown channel: ${channel}`);
      }

      const status = result.success ? 'SENT' : 'FAILED';
      await this.prisma.commCloudMessage.update({
        where: { id },
        data: {
          status,
          providerId: dbProviderId,
          providerName: decision.providerName,
          providerMessageId: result.providerMessageId,
          cost: result.cost,
          creditsUsed: result.creditsUsed || 0,
          sentAt: new Date(),
          lastError: result.error || null,
        },
      });

      await this.deliveryTracking.logDeliveryAttempt(
        id, dbProviderId, decision.providerName,
        status.toLowerCase(), status, {
          providerMessageId: result.providerMessageId,
          cost: result.cost,
          rawResponse: result.rawResponse,
        },
      );

      if (result.cost && result.cost > 0) {
        try {
          const wallet = await this.creditWallet.getOrCreateWallet('school', schoolId || 'platform');
          await this.creditWallet.deductCredits(wallet.id, channel, 1, result.cost);
        } catch (creditError) {
          this.logger.warn(`Credit deduction failed: ${creditError.message}`);
        }
      }

      await this.analytics.recordMessage(
        channel, schoolId, dbProviderId,
        status, result.cost || 0, result.creditsUsed || 0, result.latencyMs,
        metadata?.country,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to process message ${id}: ${error.message}`);

      const message = await this.prisma.commCloudMessage.findUnique({ where: { id } });
      const retryCount = (message?.retryCount || 0) + 1;

      if (retryCount <= 3) {
        await this.prisma.commCloudMessage.update({
          where: { id },
          data: { status: 'QUEUED', retryCount, lastError: error.message },
        });
        try {
          await this.queueService.enqueueMessage({ ...messageData, id }, 10, Math.pow(2, retryCount) * 1000);
        } catch (retryErr) {
          this.logger.warn(`Re-enqueue failed (Redis may be unavailable): ${(retryErr as Error).message}`);
        }
      } else {
        await this.prisma.commCloudMessage.update({
          where: { id },
          data: { status: 'FAILED', lastError: error.message },
        });
        await this.deliveryTracking.logDeliveryAttempt(id, null, 'unknown', 'failed', 'FAILED', {
          error: error.message,
        });
      }

      throw error;
    }
  }

  private async send(channel: CommCloudChannel, data: any): Promise<CommunicationResponseDto> {
    console.error('[commService] send called', channel, data.recipient?.slice(0,4));
    try {
    const message = await this.prisma.commCloudMessage.create({
      data: {
        channel,
        messageType: data.messageType || 'transactional',
        status: 'QUEUED',
        recipient: data.recipient,
        recipientName: data.recipientName,
        subject: data.subject,
        body: data.body,
        htmlBody: data.htmlBody,
        senderIdentity: data.senderIdentity,
        schoolId: data.schoolId,
        userId: data.userId,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        metadata: data.metadata || {},
        attachments: data.attachments || undefined,
      },
    });

    if (data.scheduledAt) {
      await this.queueService.scheduleMessage(message, new Date(data.scheduledAt));
    } else {
      const job = await this.queueService.enqueueMessage(message, data.priority);
      if (!job) {
        const syncResult = await this.processMessage(message);
        await this.auditLog.record('MESSAGE_SENT', {
          channel, messageId: message.id, recipient: data.recipient, schoolId: data.schoolId,
        });
        if (!syncResult.success) {
          throw new Error(syncResult.error || 'Failed to send message');
        }
        return {
          id: message.id,
          channel,
          status: syncResult.status || 'SENT',
          recipient: data.recipient,
          subject: data.subject,
          createdAt: message.createdAt.toISOString(),
        };
      }
    }

    await this.analytics.recordMessage(channel, data.schoolId, null, 'QUEUED', 0, 0, 0);
    await this.auditLog.record('MESSAGE_SENT', {
      channel, messageId: message.id, recipient: data.recipient, schoolId: data.schoolId,
    });

    return {
      id: message.id,
      channel,
      status: 'QUEUED',
      recipient: data.recipient,
      subject: data.subject,
      createdAt: message.createdAt.toISOString(),
    };
    } catch (err: any) {
      console.error('[commService] send failed:', err?.message || err);
      throw err;
    }
  }

  private async resolveRecipients(options: BroadcastDto): Promise<string[]> {
    if (options.recipientType === 'custom' && options.recipientIds) {
      return options.recipientIds;
    }
    if (options.recipientType === 'school' && options.schoolIds) {
      return options.schoolIds;
    }
    return options.recipientIds || [];
  }

  private buildEnvEmailProvider(type: string): any {
    switch (type) {
      case 'brevo':
        return new BrevoAdapter({
          apiKey: this.configService.get('BREVO_API_KEY') || this.configService.get('BREVO_SMTP_KEY'),
          smtpHost: this.configService.get('BREVO_SMTP_HOST', 'smtp-relay.brevo.com'),
          smtpPort: parseInt(this.configService.get('BREVO_SMTP_PORT', '587'), 10),
          smtpLogin: this.configService.get('BREVO_SMTP_LOGIN') || this.configService.get('BREVO_SMTP_USER'),
          smtpPassword: this.configService.get('BREVO_SMTP_PASSWORD') || this.configService.get('BREVO_SMTP_PASS'),
          fromEmail: this.configService.get('BREVO_FROM_EMAIL') || this.configService.get('EMAIL_FROM'),
          fromName: this.configService.get('BREVO_FROM_NAME') || this.configService.get('EMAIL_FROM_NAME', 'Smart Tech'),
        } as BrevoConfig);
      default:
        throw new Error(`No env-based email adapter for type: ${type}`);
    }
  }

  // ===================== SCHOOL-SPECIFIC METHODS =====================

  async getSchoolWallet(schoolId: string) {
    const wallet = await this.creditWallet.getOrCreateWallet('school', schoolId);

    const [smsDebits, transactions] = await Promise.all([
      this.prisma.commCloudBillingTransaction.aggregate({
        where: { walletId: wallet.id, transactionType: 'debit', channel: 'SMS' },
        _sum: { units: true },
      }),
      this.prisma.commCloudBillingTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const smsUsed = smsDebits._sum.units || 0;
    const smsTotal = wallet.smsBalance + smsUsed;

    return {
      ...wallet,
      smsCredits: { total: smsTotal, used: smsUsed },
      recentTransactions: transactions,
    };
  }

  async getSchoolWalletTransactions(schoolId: string, limit?: number, offset?: number) {
    const wallet = await this.creditWallet.getOrCreateWallet('school', schoolId);
    const [transactions, total] = await Promise.all([
      this.prisma.commCloudBillingTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit || 50,
        skip: offset || 0,
      }),
      this.prisma.commCloudBillingTransaction.count({ where: { walletId: wallet.id } }),
    ]);
    return { transactions, total, walletId: wallet.id };
  }

  async rechargeSchoolWallet(schoolId: string, dto: { amount: number; channel?: string; description?: string }) {
    const wallet = await this.creditWallet.getOrCreateWallet('school', schoolId);
    return this.creditWallet.addCredits(
      wallet.id,
      (dto.channel as any) || 'SMS',
      Math.floor(dto.amount / 0.05),
      dto.amount,
      dto.description || 'Wallet recharge',
    );
  }

  async getSchoolMessages(schoolId: string, filters: {
    channel?: string; status?: string; limit?: number; offset?: number; from?: string; to?: string;
  }) {
    const where: any = { schoolId };
    if (filters.channel) where.channel = filters.channel;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const [messages, total] = await Promise.all([
      this.prisma.commCloudMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
        include: { deliveryLogs: { take: 1, orderBy: { loggedAt: 'desc' } } },
      }),
      this.prisma.commCloudMessage.count({ where }),
    ]);

    const stats = {
      total,
      sent: messages.filter(m => ['SENT', 'DELIVERED'].includes(m.status)).length,
      delivered: messages.filter(m => m.status === 'DELIVERED').length,
      failed: messages.filter(m => m.status === 'FAILED').length,
      pending: messages.filter(m => ['QUEUED', 'PROCESSING'].includes(m.status)).length,
    };

    return { messages, total, stats };
  }

  async getSchoolStats(schoolId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, today, thisMonth, wallet] = await Promise.all([
      this.prisma.commCloudMessage.count({ where: { schoolId } }),
      this.prisma.commCloudMessage.count({ where: { schoolId, createdAt: { gte: todayStart } } }),
      this.prisma.commCloudMessage.count({ where: { schoolId, createdAt: { gte: monthStart } } }),
      this.creditWallet.getOrCreateWallet('school', schoolId),
    ]);

    const byChannel = await this.prisma.commCloudMessage.groupBy({
      by: ['channel'],
      where: { schoolId },
      _count: true,
    });

    const byStatus = await this.prisma.commCloudMessage.groupBy({
      by: ['status'],
      where: { schoolId },
      _count: true,
    });

    return {
      total,
      today,
      thisMonth,
      wallet: {
        smsBalance: wallet.smsBalance,
        emailBalance: wallet.emailBalance,
        whatsappBalance: wallet.whatsappBalance,
        pushBalance: wallet.pushBalance,
        prepaidBalance: wallet.prepaidBalance,
      },
      byChannel: byChannel.reduce((acc: any, c) => ({ ...acc, [c.channel]: c._count }), {}),
      byStatus: byStatus.reduce((acc: any, s) => ({ ...acc, [s.status]: s._count }), {}),
    };
  }

  async checkSchoolProviderBalance(schoolId: string) {
    const settings = await this.prisma.communicationSettings.findUnique({
      where: { schoolId },
    });
    if (!settings?.smsProvider) {
      return { provider: null, balance: null, message: 'No SMS provider configured' };
    }
    const providerName = settings.smsProvider.toLowerCase();

    try {
      const cloudProvider = await this.prisma.commCloudProvider.findFirst({
        where: { providerType: providerName, channel: 'SMS', isActive: true },
      });

      if (cloudProvider) {
        const provider = await this.smsProviderFactory.getProvider(cloudProvider.id);
        const balance = await provider.getBalance();
        return { provider: providerName, balance: balance.balance, currency: balance.currency };
      }

      if (providerName === 'zamtel' || providerName === 'zamtel bulk') {
        const adapter = new ZamtelAdapter({
          apiKey: settings.smsApiKey || '',
          senderId: settings.smsSenderId || 'SMARTTECH',
        });
        const balance = await adapter.getBalance();
        return { provider: 'zamtel', balance: balance.balance, currency: balance.currency };
      }

      const provider = this.smsProviderFactory.getProviderByType(providerName);
      if (provider && typeof provider.getBalance === 'function') {
        const balance = await provider.getBalance();
        return { provider: providerName, balance: balance.balance, currency: balance.currency };
      }

      return { provider: providerName, balance: null, message: 'Balance check not available for this provider' };
    } catch (error) {
      return { provider: providerName, balance: null, error: error.message };
    }
  }

  async getSchoolCommSettings(schoolId: string) {
    const settings = await this.prisma.communicationSettings.findUnique({
      where: { schoolId },
    });

    const cloudProviders = await this.prisma.commCloudProvider.findMany({
      where: { channel: 'SMS', isActive: true },
      orderBy: { priority: 'asc' },
      select: { id: true, name: true, providerType: true, channel: true, isActive: true, priority: true, costPerMessage: true, currency: true },
    });

    return {
      settings: settings || {},
      availableProviders: cloudProviders,
    };
  }

  async updateSchoolCommSettings(schoolId: string, dto: any) {
    const data: any = {};
    if (dto.smsProvider) data.smsProvider = dto.smsProvider;
    if (dto.smsApiKey) data.smsApiKey = dto.smsApiKey;
    if (dto.smsSenderId) data.smsSenderId = dto.smsSenderId;
    if (dto.emailProvider) data.emailProvider = dto.emailProvider;
    if (dto.emailApiKey) data.smtpApiKey = dto.emailApiKey;
    if (dto.whatsappProvider) data.whatsappProvider = dto.whatsappProvider;
    if (dto.whatsappApiKey) data.whatsappApiKey = dto.whatsappApiKey;

    const settings = await this.prisma.communicationSettings.upsert({
      where: { schoolId },
      update: data,
      create: { schoolId, ...data, smsEnabled: true, emailEnabled: true, whatsappEnabled: true },
    });

    await this.auditLog.record('SCHOOL_SETTINGS_UPDATED', { schoolId, ...dto });
    return settings;
  }

  async sendSchoolSms(schoolId: string, dto: { recipient: string; message: string; senderId?: string; scheduledAt?: string }) {
    const settings = await this.prisma.communicationSettings.findUnique({ where: { schoolId } });

    return this.send(CommCloudChannel.SMS, {
      recipient: dto.recipient,
      body: dto.message,
      senderIdentity: dto.senderId || settings?.smsSenderId,
      schoolId,
      scheduledAt: dto.scheduledAt,
      messageType: 'transactional',
      metadata: { preferredProviderId: settings?.smsProvider },
    });
  }
}
