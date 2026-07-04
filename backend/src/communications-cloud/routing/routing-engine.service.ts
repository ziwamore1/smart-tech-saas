import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RoutingStrategy,
  RoutingRule,
  RoutingDecision,
  RoutingContext,
  ProviderHealth,
} from '../interfaces/routing.interface';
import { CommCloudChannel } from '../interfaces/message.interface';

@Injectable()
export class RoutingEngineService {
  private readonly logger = new Logger(RoutingEngineService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async resolveProvider(context: RoutingContext): Promise<RoutingDecision> {
    const rules = await this.loadRules(context.channel);

    const matchingRules = rules
      .filter(rule => this.evaluateRule(rule, context))
      .sort((a, b) => a.priority - b.priority);

    if (context.preferredProviderId) {
      const provider = await this.prisma.commCloudProvider.findUnique({
        where: { id: context.preferredProviderId },
      });
      if (provider && provider.isActive && provider.status === 'active') {
        return {
          providerId: provider.id,
          providerName: provider.name,
          strategy: RoutingStrategy.PREFERRED,
          reason: 'Preferred provider specified in context',
          confidence: 1.0,
        };
      }
    }

    if (context.schoolId) {
      const schoolRule = matchingRules.find(
        r => r.ruleType === RoutingStrategy.SCHOOL_PREFERRED,
      );
      if (schoolRule) {
        const providerId = schoolRule.preferredProviderId;
        if (providerId) {
          const provider = await this.prisma.commCloudProvider.findUnique({
            where: { id: providerId },
          });
          if (provider?.isActive && provider?.status === 'active') {
            return {
              providerId: provider.id,
              providerName: provider.name,
              strategy: RoutingStrategy.SCHOOL_PREFERRED,
              reason: 'School preferred provider',
              confidence: 1.0,
            };
          }
        }
      }
    }

    for (const rule of matchingRules) {
      const decision = await this.applyRule(rule, context);
      if (decision) return decision;
    }

    return this.getPriorityFallback(context.channel);
  }

  private async loadRules(channel: CommCloudChannel): Promise<RoutingRule[]> {
    const dbRules = await this.prisma.commCloudRoutingRule.findMany({
      where: { channel, isActive: true },
      orderBy: { priority: 'asc' },
      include: { preferredProvider: true },
    });

    return dbRules.map(r => ({
      id: r.id,
      name: r.name,
      channel: r.channel as any,
      ruleType: r.ruleType as any,
      priority: r.priority,
      isActive: r.isActive,
      conditions: r.conditions as any,
      providerOrder: r.providerOrder,
      preferredProviderId: r.preferredProviderId || undefined,
      fallbackProviderIds: r.fallbackProviderIds || [],
      maxRetries: r.maxRetries,
      retryDelayMs: r.retryDelayMs,
      retryBackoff: r.retryBackoff,
      timesUsed: r.timesUsed,
    }));
  }

  private evaluateRule(
    rule: RoutingRule,
    context: RoutingContext,
  ): boolean {
    if (!rule.conditions) return true;
    const conditions = rule.conditions as any;

    if (
      conditions.countries &&
      context.country &&
      !conditions.countries.includes(context.country)
    ) {
      return false;
    }

    if (
      conditions.schoolId &&
      context.schoolId &&
      conditions.schoolId !== context.schoolId
    ) {
      return false;
    }

    if (
      conditions.messageType &&
      context.messageType &&
      !conditions.messageType.includes(context.messageType)
    ) {
      return false;
    }

    return true;
  }

  private async applyRule(
    rule: RoutingRule,
    context: RoutingContext,
  ): Promise<RoutingDecision | null> {
    const providerOrder = rule.providerOrder;
    if (!providerOrder || providerOrder.length === 0) return null;

    for (const providerId of providerOrder) {
      const provider = await this.prisma.commCloudProvider.findUnique({
        where: { id: providerId },
      });
      if (provider && provider.isActive && provider.status === 'active') {
        return {
          providerId: provider.id,
          providerName: provider.name,
          strategy: rule.ruleType as any,
          reason: `Matched rule: ${rule.name}`,
          confidence: 0.9,
        };
      }
    }
    return null;
  }

  private async getPriorityFallback(
    channel: CommCloudChannel,
  ): Promise<RoutingDecision> {
    const providers = await this.prisma.commCloudProvider.findMany({
      where: { channel, isActive: true, status: 'active' },
      orderBy: [{ priority: 'asc' }, { successRate: 'desc' }],
    });

    if (providers.length > 0) {
      const p = providers[0];
      return {
        providerId: p.id,
        providerName: p.name,
        strategy: RoutingStrategy.PRIORITY_BASED,
        reason: 'Priority-based fallback',
        confidence: 0.7,
      };
    }

    return this.getEnvFallback(channel);
  }

  private getEnvFallback(channel: CommCloudChannel): RoutingDecision {
    if (channel !== CommCloudChannel.SMS) {
      throw new Error(`No active providers found for channel: ${channel}`);
    }

    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    if (twilioSid) {
      return {
        providerId: 'env:twilio',
        providerName: 'Twilio',
        strategy: RoutingStrategy.PRIORITY_BASED,
        reason: 'Env-configured fallback (Twilio)',
        confidence: 0.7,
      };
    }

    const beemKey = this.configService.get<string>('BEEM_API_KEY');
    if (beemKey) {
      return {
        providerId: 'env:beem',
        providerName: 'Beem',
        strategy: RoutingStrategy.PRIORITY_BASED,
        reason: 'Env-configured fallback (Beem)',
        confidence: 0.7,
      };
    }

    throw new Error(`No active providers found for channel: ${channel}`);
  }

  async getFallbackProvider(
    context: RoutingContext,
    failedProviderId: string,
  ): Promise<RoutingDecision> {
    const failedProvider = await this.prisma.commCloudProvider.findUnique({
      where: { id: failedProviderId },
    });
    if (!failedProvider) return this.resolveProvider(context);

    const remaining = await this.prisma.commCloudProvider.findMany({
      where: {
        channel: failedProvider.channel,
        isActive: true,
        status: 'active',
        id: { not: failedProviderId },
      },
      orderBy: [{ priority: 'asc' }, { successRate: 'desc' }],
    });

    if (remaining.length === 0) {
      throw new Error(
        `No fallback providers available for channel: ${failedProvider.channel}`,
      );
    }

    const p = remaining[0];
    return {
      providerId: p.id,
      providerName: p.name,
      strategy: RoutingStrategy.FALLBACK,
      reason: `Automatic failover from ${failedProvider.name}`,
      confidence: 0.6,
    };
  }

  async checkProviderHealth(
    providerId: string,
  ): Promise<ProviderHealth> {
    const provider = await this.prisma.commCloudProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    return {
      providerId: provider.id,
      providerName: provider.name,
      status: provider.status as any,
      isActive: provider.isActive,
      successRate: provider.successRate,
      avgLatencyMs: provider.avgLatencyMs,
      lastHealthCheckAt: provider.lastHealthCheckAt || undefined,
      lastError: provider.lastError || undefined,
      totalSent: provider.totalSent,
      totalFailed: provider.totalFailed,
    };
  }

  async getProvidersByPriority(
    channel: CommCloudChannel,
  ): Promise<any[]> {
    return this.prisma.commCloudProvider.findMany({
      where: { channel, isActive: true, status: 'active' },
      orderBy: [{ priority: 'asc' }, { successRate: 'desc' }],
    });
  }
}
