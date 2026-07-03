import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RoutingRule,
  RoutingStrategy,
  RetryBackoffStrategy,
} from '../../interfaces/routing.interface';
import { CommCloudChannel } from '../../interfaces/message.interface';

export interface CreateRoutingRuleInput {
  name: string;
  channel: CommCloudChannel;
  ruleType: RoutingStrategy | string;
  priority?: number;
  conditions?: Record<string, unknown>;
  providerOrder: string[];
  preferredProviderId?: string;
  fallbackProviderIds?: string[];
  maxRetries?: number;
  retryDelayMs?: number;
  retryBackoff?: RetryBackoffStrategy;
  createdById?: string;
}

export interface UpdateRoutingRuleInput {
  name?: string;
  channel?: CommCloudChannel;
  ruleType?: RoutingStrategy | string;
  priority?: number;
  conditions?: Record<string, unknown>;
  providerOrder?: string[];
  preferredProviderId?: string;
  fallbackProviderIds?: string[];
  maxRetries?: number;
  retryDelayMs?: number;
  retryBackoff?: RetryBackoffStrategy;
  isActive?: boolean;
}

@Injectable()
export class RoutingRulesService {
  private readonly logger = new Logger(RoutingRulesService.name);

  constructor(private prisma: PrismaService) {}

  async createRule(data: CreateRoutingRuleInput): Promise<RoutingRule> {
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Rule name is required');
    }
    if (!data.providerOrder || data.providerOrder.length === 0) {
      throw new BadRequestException(
        'At least one provider must be specified in providerOrder',
      );
    }

    const existing = await this.prisma.commCloudRoutingRule.findFirst({
      where: { name: data.name, channel: data.channel },
    });
    if (existing) {
      throw new BadRequestException(
        `A rule with name "${data.name}" already exists for channel ${data.channel}`,
      );
    }

    const rule = await this.prisma.commCloudRoutingRule.create({
      data: {
        name: data.name.trim(),
        channel: data.channel,
        ruleType: data.ruleType,
        priority: data.priority ?? 0,
        isActive: true,
        conditions: data.conditions ?? undefined,
        providerOrder: data.providerOrder,
        preferredProviderId: data.preferredProviderId ?? null,
        fallbackProviderIds: data.fallbackProviderIds ?? [],
        maxRetries: data.maxRetries ?? 3,
        retryDelayMs: data.retryDelayMs ?? 2000,
        retryBackoff: data.retryBackoff ?? 'exponential',
        createdById: data.createdById ?? null,
      },
      include: { preferredProvider: true },
    });

    this.logger.log(`Created routing rule "${rule.name}" (${rule.id})`);
    return this.mapToRoutingRule(rule);
  }

  async updateRule(
    id: string,
    data: UpdateRoutingRuleInput,
  ): Promise<RoutingRule> {
    const existing = await this.prisma.commCloudRoutingRule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Routing rule not found: ${id}`);
    }

    if (data.name) {
      const duplicate = await this.prisma.commCloudRoutingRule.findFirst({
        where: {
          name: data.name,
          channel: data.channel ?? existing.channel,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new BadRequestException(
          `A rule with name "${data.name}" already exists`,
        );
      }
    }

    const rule = await this.prisma.commCloudRoutingRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.ruleType !== undefined && { ruleType: data.ruleType }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.conditions !== undefined && {
          conditions: data.conditions,
        }),
        ...(data.providerOrder !== undefined && {
          providerOrder: data.providerOrder,
        }),
        ...(data.preferredProviderId !== undefined && {
          preferredProviderId: data.preferredProviderId ?? null,
        }),
        ...(data.fallbackProviderIds !== undefined && {
          fallbackProviderIds: data.fallbackProviderIds,
        }),
        ...(data.maxRetries !== undefined && {
          maxRetries: data.maxRetries,
        }),
        ...(data.retryDelayMs !== undefined && {
          retryDelayMs: data.retryDelayMs,
        }),
        ...(data.retryBackoff !== undefined && {
          retryBackoff: data.retryBackoff,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { preferredProvider: true },
    });

    this.logger.log(`Updated routing rule "${rule.name}" (${rule.id})`);
    return this.mapToRoutingRule(rule);
  }

  async deleteRule(id: string): Promise<void> {
    const existing = await this.prisma.commCloudRoutingRule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Routing rule not found: ${id}`);
    }

    await this.prisma.commCloudRoutingRule.delete({ where: { id } });
    this.logger.log(`Deleted routing rule "${existing.name}" (${id})`);
  }

  async getRules(
    channel?: CommCloudChannel,
  ): Promise<RoutingRule[]> {
    const where = channel ? { channel } : {};
    const rules = await this.prisma.commCloudRoutingRule.findMany({
      where,
      orderBy: [{ channel: 'asc' }, { priority: 'asc' }],
      include: { preferredProvider: true },
    });
    return rules.map(r => this.mapToRoutingRule(r));
  }

  async getRule(id: string): Promise<RoutingRule> {
    const rule = await this.prisma.commCloudRoutingRule.findUnique({
      where: { id },
      include: { preferredProvider: true },
    });
    if (!rule) {
      throw new NotFoundException(`Routing rule not found: ${id}`);
    }
    return this.mapToRoutingRule(rule);
  }

  async toggleRule(id: string, isActive: boolean): Promise<RoutingRule> {
    const existing = await this.prisma.commCloudRoutingRule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Routing rule not found: ${id}`);
    }

    const rule = await this.prisma.commCloudRoutingRule.update({
      where: { id },
      data: { isActive },
      include: { preferredProvider: true },
    });

    this.logger.log(
      `${isActive ? 'Activated' : 'Deactivated'} routing rule "${rule.name}" (${rule.id})`,
    );
    return this.mapToRoutingRule(rule);
  }

  async recordRuleUsage(id: string): Promise<void> {
    const existing = await this.prisma.commCloudRoutingRule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Routing rule not found: ${id}`);
    }

    await this.prisma.commCloudRoutingRule.update({
      where: { id },
      data: {
        timesUsed: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  private mapToRoutingRule(rule: any): RoutingRule {
    return {
      id: rule.id,
      name: rule.name,
      channel: rule.channel as any,
      ruleType: rule.ruleType as any,
      priority: rule.priority,
      isActive: rule.isActive,
      conditions: rule.conditions as any,
      providerOrder: rule.providerOrder,
      preferredProviderId: rule.preferredProviderId || undefined,
      fallbackProviderIds: rule.fallbackProviderIds || [],
      maxRetries: rule.maxRetries,
      retryDelayMs: rule.retryDelayMs,
      retryBackoff: rule.retryBackoff,
      timesUsed: rule.timesUsed,
      lastUsedAt: rule.lastUsedAt || undefined,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
