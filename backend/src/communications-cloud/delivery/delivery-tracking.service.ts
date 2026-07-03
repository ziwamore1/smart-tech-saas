import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CommCloudChannel } from '../interfaces/message.interface';

interface DeliveryLogEntry {
  messageId: string;
  providerId?: string;
  providerName: string;
  event: string;
  status: string;
  statusCode?: string;
  description?: string;
  cost?: number;
  latencyMs?: number;
  attempt?: number;
  rawResponse?: unknown;
  errorDetails?: unknown;
}

interface DeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  sent: number;
  pending: number;
  deliveryRate: number;
  failureRate: number;
  logs: any[];
}

@Injectable()
export class DeliveryTrackingService {
  private readonly logger = new Logger(DeliveryTrackingService.name);

  constructor(private prisma: PrismaService) {}

  async logDeliveryAttempt(
    messageId: string,
    providerId: string | undefined,
    providerName: string,
    event: string,
    status: string,
    details?: Partial<DeliveryLogEntry>,
  ) {
    this.logger.log(`Logging delivery attempt for message ${messageId}: ${event} -> ${status}`);

    const log = await this.prisma.commCloudDeliveryLog.create({
      data: {
        messageId,
        providerId,
        providerName,
        event,
        status,
        statusCode: details?.statusCode,
        description: details?.description,
        cost: details?.cost,
        latencyMs: details?.latencyMs,
        attempt: details?.attempt ?? 1,
        rawResponse: details?.rawResponse ?? undefined,
        errorDetails: details?.errorDetails ?? undefined,
      },
    });

    const statusMap: Record<string, string> = {
      queued: 'QUEUED',
      sent: 'SENT',
      delivered: 'DELIVERED',
      failed: 'FAILED',
      read: 'READ',
      opened: 'OPENED',
      clicked: 'CLICKED',
      bounced: 'FAILED',
      rejected: 'FAILED',
    };

    const messageStatus = statusMap[event] || status;
    const updateData: any = { status: messageStatus };

    if (event === 'sent') updateData.sentAt = new Date();
    if (event === 'delivered') updateData.deliveredAt = new Date();
    if (event === 'read' || event === 'opened') updateData.readAt = new Date();
    if (event === 'clicked') updateData.clickedAt = new Date();
    if (details?.cost !== undefined) updateData.cost = details.cost;
    if (details?.statusCode) updateData.providerMessageId = details.statusCode;

    await this.prisma.commCloudMessage.update({
      where: { id: messageId },
      data: updateData,
    });

    return log;
  }

  async updateDeliveryStatus(
    providerMessageId: string,
    status: string,
    details?: Partial<DeliveryLogEntry>,
  ) {
    const message = await this.prisma.commCloudMessage.findFirst({
      where: { providerMessageId },
    });

    if (!message) {
      this.logger.warn(`No message found with providerMessageId ${providerMessageId}`);
      return null;
    }

    return this.logDeliveryAttempt(
      message.id,
      message.providerId || undefined,
      message.providerName || 'unknown',
      status,
      status,
      details,
    );
  }

  async getMessageDeliveryLogs(messageId: string) {
    return this.prisma.commCloudDeliveryLog.findMany({
      where: { messageId },
      orderBy: { loggedAt: 'asc' },
      include: { provider: { select: { id: true, name: true, channel: true } } },
    });
  }

  async getDeliveryStats(
    channel?: CommCloudChannel,
    schoolId?: string,
    period?: { start: Date; end: Date },
  ): Promise<DeliveryStats> {
    const where: any = {};

    if (channel) where.channel = channel;
    if (schoolId) where.schoolId = schoolId;
    if (period) {
      where.createdAt = { gte: period.start, lte: period.end };
    }

    const [total, delivered, failed, sent, pending] = await Promise.all([
      this.prisma.commCloudMessage.count({ where }),
      this.prisma.commCloudMessage.count({ where: { ...where, status: 'DELIVERED' } }),
      this.prisma.commCloudMessage.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.commCloudMessage.count({ where: { ...where, status: 'SENT' } }),
      this.prisma.commCloudMessage.count({
        where: { ...where, status: { in: ['QUEUED', 'PROCESSING', 'SCHEDULED'] } },
      }),
    ]);

    const logs = await this.prisma.commCloudDeliveryLog.findMany({
      where: period ? { loggedAt: { gte: period.start, lte: period.end } } : {},
      orderBy: { loggedAt: 'desc' },
      take: 100,
    });

    return {
      total,
      delivered,
      failed,
      sent,
      pending,
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
      logs,
    };
  }

  async getFailedDeliveries(channel?: CommCloudChannel, limit = 50) {
    const where: any = { status: 'FAILED' };
    if (channel) where.channel = channel;

    const messages = await this.prisma.commCloudMessage.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        deliveryLogs: {
          where: { event: 'failed' },
          orderBy: { loggedAt: 'desc' },
          take: 1,
        },
      },
    });

    return messages.map(m => ({
      id: m.id,
      channel: m.channel,
      recipient: m.recipient,
      lastError: m.lastError,
      retryCount: m.retryCount,
      lastAttempt: m.deliveryLogs[0]?.loggedAt || m.updatedAt,
      providerName: m.providerName,
    }));
  }
}
