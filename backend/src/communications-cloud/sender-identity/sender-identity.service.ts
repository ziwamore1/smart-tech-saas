import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CommCloudChannel } from '../interfaces/message.interface';

@Injectable()
export class SenderIdentityService {
  private readonly logger = new Logger(SenderIdentityService.name);

  constructor(private prisma: PrismaService) {}

  async getIdentities(channel?: string, scope?: string, schoolId?: string) {
    const where: any = {};
    if (channel) where.channel = channel;
    if (scope) where.scope = scope;
    if (schoolId) where.schoolId = schoolId;

    return this.prisma.commCloudSenderIdentity.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getIdentity(id: string) {
    const identity = await this.prisma.commCloudSenderIdentity.findUnique({ where: { id } });
    if (!identity) throw new NotFoundException(`Sender identity not found: ${id}`);
    return identity;
  }

  async createIdentity(data: {
    name: string;
    channel: CommCloudChannel;
    senderId?: string;
    senderName?: string;
    senderEmail?: string;
    senderPhone?: string;
    businessAccountId?: string;
    scope?: string;
    schoolId?: string;
    isDefault?: boolean;
  }) {
    const existing = await this.prisma.commCloudSenderIdentity.findFirst({
      where: { name: data.name, channel: data.channel, scope: data.scope ?? 'platform', schoolId: data.schoolId ?? null },
    });
    if (existing) {
      throw new BadRequestException(`Sender identity "${data.name}" already exists for channel ${data.channel}`);
    }

    return this.prisma.commCloudSenderIdentity.create({
      data: {
        name: data.name,
        channel: data.channel,
        senderId: data.senderId ?? null,
        senderName: data.senderName ?? null,
        senderEmail: data.senderEmail ?? null,
        senderPhone: data.senderPhone ?? null,
        businessAccountId: data.businessAccountId ?? null,
        scope: data.scope ?? 'platform',
        schoolId: data.schoolId ?? null,
        isDefault: data.isDefault ?? false,
      },
    });
  }

  async updateIdentity(id: string, data: {
    name?: string;
    channel?: CommCloudChannel;
    senderId?: string;
    senderName?: string;
    senderEmail?: string;
    senderPhone?: string;
    businessAccountId?: string;
    scope?: string;
    schoolId?: string;
    isDefault?: boolean;
    isActive?: boolean;
    isVerified?: boolean;
    verificationStatus?: string;
  }) {
    await this.getIdentity(id);
    return this.prisma.commCloudSenderIdentity.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.senderId !== undefined && { senderId: data.senderId }),
        ...(data.senderName !== undefined && { senderName: data.senderName }),
        ...(data.senderEmail !== undefined && { senderEmail: data.senderEmail }),
        ...(data.senderPhone !== undefined && { senderPhone: data.senderPhone }),
        ...(data.businessAccountId !== undefined && { businessAccountId: data.businessAccountId }),
        ...(data.scope !== undefined && { scope: data.scope }),
        ...(data.schoolId !== undefined && { schoolId: data.schoolId }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isVerified !== undefined && { isVerified: data.isVerified }),
        ...(data.verificationStatus !== undefined && { verificationStatus: data.verificationStatus }),
      },
    });
  }

  async deleteIdentity(id: string) {
    await this.getIdentity(id);
    return this.prisma.commCloudSenderIdentity.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async setDefault(id: string) {
    const identity = await this.getIdentity(id);

    await this.prisma.commCloudSenderIdentity.updateMany({
      where: {
        channel: identity.channel,
        scope: identity.scope,
        schoolId: identity.schoolId,
        isDefault: true,
        id: { not: id },
      },
      data: { isDefault: false },
    });

    return this.prisma.commCloudSenderIdentity.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async getDefaultIdentity(channel: CommCloudChannel, scope: string, schoolId?: string) {
    const where: any = {
      channel,
      scope,
      isDefault: true,
      isActive: true,
    };
    if (schoolId) where.schoolId = schoolId;

    return this.prisma.commCloudSenderIdentity.findFirst({ where });
  }
}
