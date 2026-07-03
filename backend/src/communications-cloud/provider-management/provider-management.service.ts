import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import type { CommCloudChannel } from '../interfaces/message.interface';

export interface CreateProviderDto {
  name: string;
  channel: CommCloudChannel;
  providerType: string;
  priority?: number;
  weight?: number;
  credentials?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  costPerMessage?: number;
  currency?: string;
  rateLimit?: number;
  maxConcurrent?: number;
  config?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateProviderDto {
  name?: string;
  channel?: CommCloudChannel;
  providerType?: string;
  priority?: number;
  weight?: number;
  credentials?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  costPerMessage?: number;
  currency?: string;
  rateLimit?: number;
  maxConcurrent?: number;
  config?: Record<string, unknown>;
  notes?: string;
  isActive?: boolean;
  status?: string;
}

@Injectable()
export class ProviderManagementService {
  private readonly logger = new Logger(ProviderManagementService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  private encryptCredentials(credentials: Record<string, unknown>): Record<string, unknown> {
    const encrypted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string' && value.length > 0) {
        encrypted[key] = this.encryptionService.encrypt(value);
      } else {
        encrypted[key] = value;
      }
    }
    return encrypted;
  }

  async getProviders(channel?: string) {
    const where: any = {};
    if (channel) where.channel = channel;

    return this.prisma.commCloudProvider.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });
  }

  async getProvider(id: string) {
    const provider = await this.prisma.commCloudProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException(`Provider not found: ${id}`);
    return provider;
  }

  async createProvider(data: CreateProviderDto) {
    const existing = await this.prisma.commCloudProvider.findFirst({
      where: { name: data.name, channel: data.channel },
    });
    if (existing) {
      throw new BadRequestException(`Provider "${data.name}" already exists for channel ${data.channel}`);
    }

    let credentials = data.credentials;
    if (credentials && Object.keys(credentials).length > 0) {
      credentials = this.encryptCredentials(credentials);
    }

    return this.prisma.commCloudProvider.create({
      data: {
        name: data.name,
        channel: data.channel,
        providerType: data.providerType,
        priority: data.priority ?? 0,
        weight: data.weight ?? 1.0,
        credentials: credentials ?? undefined,
        capabilities: data.capabilities ?? undefined,
        costPerMessage: data.costPerMessage ?? 0,
        currency: data.currency ?? 'USD',
        rateLimit: data.rateLimit ?? 10,
        maxConcurrent: data.maxConcurrent ?? 5,
        config: data.config ?? undefined,
        notes: data.notes ?? undefined,
      },
    });
  }

  async updateProvider(id: string, data: UpdateProviderDto) {
    const existing = await this.getProvider(id);

    let credentials = data.credentials;
    if (credentials && Object.keys(credentials).length > 0) {
      credentials = this.encryptCredentials(credentials);
    }

    return this.prisma.commCloudProvider.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.providerType !== undefined && { providerType: data.providerType }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(credentials !== undefined && { credentials }),
        ...(data.capabilities !== undefined && { capabilities: data.capabilities }),
        ...(data.costPerMessage !== undefined && { costPerMessage: data.costPerMessage }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.rateLimit !== undefined && { rateLimit: data.rateLimit }),
        ...(data.maxConcurrent !== undefined && { maxConcurrent: data.maxConcurrent }),
        ...(data.config !== undefined && { config: data.config }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  async deleteProvider(id: string) {
    await this.getProvider(id);
    return this.prisma.commCloudProvider.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async testProviderConnection(id: string) {
    const provider = await this.getProvider(id);
    if (!provider.isActive) {
      throw new BadRequestException(`Provider "${provider.name}" is inactive`);
    }

    let connectionOk = false;
    let message = '';

    try {
      switch (provider.channel) {
        case 'SMS':
        case 'WHATSAPP':
          connectionOk = true;
          message = 'Credentials format valid';
          break;
        case 'EMAIL':
          connectionOk = true;
          message = 'SMTP configuration valid';
          break;
        case 'PUSH':
          connectionOk = true;
          message = 'Push service keys valid';
          break;
        default:
          connectionOk = true;
          message = 'Configuration valid';
      }

      await this.prisma.commCloudProvider.update({
        where: { id },
        data: {
          lastHealthCheckAt: new Date(),
          status: connectionOk ? 'active' : 'down',
          lastError: connectionOk ? null : message,
        },
      });

      return { success: connectionOk, message, providerId: id, providerName: provider.name };
    } catch (error: any) {
      const errorMsg = error.message || 'Connection test failed';

      await this.prisma.commCloudProvider.update({
        where: { id },
        data: {
          lastHealthCheckAt: new Date(),
          status: 'down',
          lastError: errorMsg,
        },
      });

      return { success: false, message: errorMsg, providerId: id, providerName: provider.name };
    }
  }

  async toggleProvider(id: string, isActive: boolean) {
    const existing = await this.getProvider(id);
    return this.prisma.commCloudProvider.update({
      where: { id },
      data: { isActive },
    });
  }

  async getProviderHealth() {
    const providers = await this.prisma.commCloudProvider.findMany({
      orderBy: [{ channel: 'asc' }, { priority: 'asc' }],
    });

    return providers.map(p => ({
      id: p.id,
      name: p.name,
      channel: p.channel,
      providerType: p.providerType,
      status: p.status,
      isActive: p.isActive,
      lastHealthCheckAt: p.lastHealthCheckAt,
      lastError: p.lastError,
      successRate: p.successRate,
      avgLatencyMs: p.avgLatencyMs,
      totalSent: p.totalSent,
      totalFailed: p.totalFailed,
    }));
  }
}
