import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunicationQueueService } from '../queue/communication-queue.service';
import type { CommCloudChannel } from '../interfaces/message.interface';

@Injectable()
export class CommunicationsAnalyticsService {
  private readonly logger = new Logger(CommunicationsAnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: CommunicationQueueService,
  ) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalMessages,
      todayMessages,
      monthlyMessages,
      deliveredCount,
      failedCount,
      providerHealth,
      creditsAgg,
      revenueAgg,
      queueStatus,
    ] = await Promise.all([
      this.prisma.commCloudMessage.count(),
      this.prisma.commCloudMessage.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      this.prisma.commCloudMessage.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.commCloudMessage.count({
        where: { status: 'DELIVERED' },
      }),
      this.prisma.commCloudMessage.count({
        where: { status: 'FAILED' },
      }),
      this.prisma.commCloudProvider.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.commCloudMessage.aggregate({
        _sum: { creditsUsed: true },
      }),
      this.prisma.commCloudMessage.aggregate({
        _sum: { cost: true },
      }),
      this.queueService.getQueueStatus().catch(() => null),
    ]);

    const terminalTotal = deliveredCount + failedCount;
    const deliveryRate = terminalTotal > 0 ? (deliveredCount / terminalTotal) * 100 : 0;
    const failureRate = terminalTotal > 0 ? (failedCount / terminalTotal) * 100 : 0;

    const healthMap: Record<string, number> = {};
    for (const h of providerHealth) {
      healthMap[h.status] = h._count.id;
    }

    return {
      totalMessages,
      todayMessages,
      monthlyMessages,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      queueStatus,
      providerHealth: {
        active: healthMap['active'] || 0,
        down: healthMap['down'] || 0,
        maintenance: healthMap['maintenance'] || 0,
        degraded: healthMap['degraded'] || 0,
      },
      creditsTotal: creditsAgg._sum.creditsUsed || 0,
      revenue: revenueAgg._sum.cost || 0,
    };
  }

  async getDailyMessages(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const messages = await this.prisma.commCloudMessage.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, channel: true },
      orderBy: { createdAt: 'asc' },
    });

    const groups = new Map<string, Map<string, number>>();
    for (const msg of messages) {
      const day = msg.createdAt.toISOString().slice(0, 10);
      const channel = msg.channel;
      if (!groups.has(day)) groups.set(day, new Map());
      const channelMap = groups.get(day)!;
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
    }

    return Array.from(groups.entries()).map(([date, channelMap]) => ({
      date,
      count: Array.from(channelMap.values()).reduce((a, b) => a + b, 0),
      channels: Object.fromEntries(channelMap),
    }));
  }

  async getMonthlyMessages(months: number = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const messages = await this.prisma.commCloudMessage.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, channel: true },
      orderBy: { createdAt: 'asc' },
    });

    const groups = new Map<string, Map<string, number>>();
    for (const msg of messages) {
      const month = msg.createdAt.toISOString().slice(0, 7);
      const channel = msg.channel;
      if (!groups.has(month)) groups.set(month, new Map());
      const channelMap = groups.get(month)!;
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
    }

    return Array.from(groups.entries()).map(([date, channelMap]) => ({
      date,
      count: Array.from(channelMap.values()).reduce((a, b) => a + b, 0),
      channels: Object.fromEntries(channelMap),
    }));
  }

  async getCountryUsage(channel?: string) {
    const where: any = {};
    if (channel) where.channel = channel;

    const messages = await this.prisma.commCloudMessage.findMany({
      where,
      select: { recipientMetadata: true, channel: true },
    });

    const countryMap = new Map<string, number>();
    for (const msg of messages) {
      const meta = msg.recipientMetadata as any;
      const country = meta?.country || 'Unknown';
      countryMap.set(country, (countryMap.get(country) || 0) + 1);
    }

    return Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getSchoolUsage(schoolId: string, period?: { start: Date; end: Date }) {
    const where: any = {};
    const schoolFilter = { path: ['recipientMetadata', 'schoolId'], equals: schoolId };

    if (period) {
      where.createdAt = { gte: period.start, lte: period.end };
    }

    const messages = await this.prisma.commCloudMessage.findMany({
      where: {
        ...where,
        OR: [
          { schoolId },
          { recipientMetadata: { path: ['schoolId'], equals: schoolId } },
        ],
      },
      select: {
        channel: true,
        status: true,
        cost: true,
        creditsUsed: true,
        createdAt: true,
      },
    });

    const byChannel = new Map<string, { sent: number; delivered: number; failed: number; cost: number }>();
    for (const msg of messages) {
      const ch = msg.channel;
      if (!byChannel.has(ch)) byChannel.set(ch, { sent: 0, delivered: 0, failed: 0, cost: 0 });
      const entry = byChannel.get(ch)!;
      entry.sent++;
      if (msg.status === 'DELIVERED') entry.delivered++;
      if (msg.status === 'FAILED') entry.failed++;
      entry.cost += msg.cost || 0;
    }

    return {
      schoolId,
      totalSent: messages.length,
      totalCost: messages.reduce((s, m) => s + (m.cost || 0), 0),
      totalCredits: messages.reduce((s, m) => s + (m.creditsUsed || 0), 0),
      channels: Object.fromEntries(byChannel),
    };
  }

  async getProviderComparison(channel?: string) {
    const where: any = {};
    if (channel) where.channel = channel;

    const providers = channel
      ? await this.prisma.commCloudProvider.findMany({ where: { channel: channel as CommCloudChannel } })
      : await this.prisma.commCloudProvider.findMany();

    const comparison = await Promise.all(
      providers.map(async (p) => {
        const msgWhere: any = { providerId: p.id };
        if (channel) msgWhere.channel = channel;

        const [sent, delivered, failed, latencyAgg] = await Promise.all([
          this.prisma.commCloudMessage.count({ where: msgWhere }),
          this.prisma.commCloudMessage.count({ where: { ...msgWhere, status: 'DELIVERED' } }),
          this.prisma.commCloudMessage.count({ where: { ...msgWhere, status: 'FAILED' } }),
          this.prisma.commCloudDeliveryLog.aggregate({
            where: { providerId: p.id, event: 'delivered' },
            _avg: { latencyMs: true },
          }),
        ]);

        return {
          providerId: p.id,
          providerName: p.name,
          providerType: p.providerType,
          channel: p.channel,
          sent,
          delivered,
          failed,
          avgLatencyMs: latencyAgg._avg.latencyMs || 0,
          successRate: sent > 0 ? (delivered / sent) * 100 : 0,
        };
      }),
    );

    return comparison.sort((a, b) => b.sent - a.sent);
  }

  async getDeliveryRate(channel?: string, period?: { start: Date; end: Date }) {
    const where: any = {};
    if (channel) where.channel = channel;
    if (period) where.createdAt = { gte: period.start, lte: period.end };

    const [total, delivered] = await Promise.all([
      this.prisma.commCloudMessage.count({ where }),
      this.prisma.commCloudMessage.count({ where: { ...where, status: 'DELIVERED' } }),
    ]);

    return {
      channel: channel || 'all',
      total,
      delivered,
      rate: total > 0 ? (delivered / total) * 100 : 0,
    };
  }

  async getFailureRate(channel?: string, period?: { start: Date; end: Date }) {
    const where: any = {};
    if (channel) where.channel = channel;
    if (period) where.createdAt = { gte: period.start, lte: period.end };

    const [total, failed] = await Promise.all([
      this.prisma.commCloudMessage.count({ where }),
      this.prisma.commCloudMessage.count({ where: { ...where, status: 'FAILED' } }),
    ]);

    return {
      channel: channel || 'all',
      total,
      failed,
      rate: total > 0 ? (failed / total) * 100 : 0,
    };
  }

  async recordMessage(
    channel: string,
    schoolId: string | null | undefined,
    providerId: string | null,
    status: string,
    cost: number,
    creditsUsed: number,
    latencyMs?: number,
    country?: string,
  ) {
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 1);

      const analyticsSchoolId = schoolId || 'system';
      const isDelivered = status === 'SENT' || status === 'DELIVERED';
      const isFailed = status === 'FAILED';
      const isQueued = status === 'QUEUED';
      const incrementSent = isDelivered || isQueued ? 1 : 0;
      const incrementDelivered = isDelivered ? 1 : 0;

      await this.prisma.commCloudAnalytics.upsert({
        where: {
          period_periodStart_channel_schoolId: {
            period: 'daily',
            periodStart,
            channel: channel as any,
            schoolId: analyticsSchoolId,
          },
        },
        update: {
          totalSent: { increment: incrementSent },
          totalDelivered: { increment: incrementDelivered },
          totalFailed: { increment: isFailed ? 1 : 0 },
          totalCost: { increment: cost },
          totalCreditsUsed: { increment: creditsUsed },
          byProvider: providerId ? { increment: { [providerId]: { sent: incrementSent, delivered: incrementDelivered, failed: isFailed ? 1 : 0 } } } : undefined,
          byCountry: country ? { increment: { [country]: { sent: incrementSent } } } : undefined,
        },
        create: {
          period: 'daily',
          periodStart,
          periodEnd,
          channel: channel as any,
          schoolId: analyticsSchoolId,
          totalSent: incrementSent,
          totalDelivered: isDelivered ? 1 : 0,
          totalFailed: isFailed ? 1 : 0,
          totalCost: cost,
          totalCreditsUsed: creditsUsed,
          avgLatencyMs: latencyMs || 0,
          byProvider: providerId ? { [providerId]: { sent: incrementSent, delivered: isDelivered ? 1 : 0, failed: isFailed ? 1 : 0 } } : null,
          byCountry: country ? { [country]: { sent: 1 } } : null,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to record analytics: ${error.message}`);
    }
  }

  async getRevenue(period?: { start: Date; end: Date }) {
    const where: any = {};
    if (period) where.createdAt = { gte: period.start, lte: period.end };

    const [aggregation, byChannel] = await Promise.all([
      this.prisma.commCloudMessage.aggregate({
        where,
        _sum: { cost: true },
        _count: { id: true },
      }),
      this.prisma.commCloudMessage.groupBy({
        by: ['channel'],
        where,
        _sum: { cost: true },
        _count: { id: true },
      }),
    ]);

    return {
      totalRevenue: aggregation._sum.cost || 0,
      totalMessages: aggregation._count.id,
      byChannel: byChannel.map(b => ({
        channel: b.channel,
        revenue: b._sum.cost || 0,
        messages: b._count.id,
      })),
    };
  }
}
