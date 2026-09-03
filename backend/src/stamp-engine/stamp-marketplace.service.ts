import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StampTemplateConfig } from './stamp-engine.types';
import { SubscriptionTier } from '@prisma/client';
import { TemplateActor } from './stamp-template.service';

const TIER_ORDER: Record<SubscriptionTier, number> = {
  BASIC: 1,
  STANDARD: 2,
  PREMIUM: 3,
};

const MARKETPLACE_CATEGORIES = ['EXAMINATION', 'OFFICIAL_SCHOOL', 'CERTIFICATE', 'VERIFICATION', 'CUSTOM'];

interface PublishDto {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  minTier?: SubscriptionTier;
}

/**
 * Super-admin platform stamp designer + Marketplace.
 *
 * A super-admin authors an ADVANCED stamp (a layer-based `StampTemplate` whose
 * `configJson` may include the free-position secondary-shape tool). The authored
 * template lives in PLATFORM scope (schoolId = null, scope = 'PLATFORM').
 *
 * "Publishing to the marketplace" exposes it to eligible schools. A school
 * "installs" it, which COPY-SNAPSHOTS the platform config into that school's own
 * editable `StampTemplate` (schoolId set, scope = 'SCHOOL') and records a
 * `StampMarketplaceInstall`. Only STANDARD + PREMIUM schools may install
 * (gated by each entry's `minTier`).
 */
@Injectable()
export class StampMarketplaceService {
  constructor(private prisma: PrismaService) {}

  // ── Guards ──

  private assertPlatformAdmin(actor: TemplateActor): void {
    if (!actor.isSuperAdmin) throw new ForbiddenException('Platform stamp administration requires super admin');
  }

  private requireSchool(actor: TemplateActor): string {
    if (!actor.schoolId) throw new BadRequestException('School context required');
    return actor.schoolId;
  }

  private findPlatformTemplate(id: string) {
    return this.prisma.stampTemplate.findFirst({
      where: { id, schoolId: null, scope: 'PLATFORM' },
      include: { marketplace: true },
    });
  }

  private async assertPlatformTemplate(id: string) {
    const t = await this.findPlatformTemplate(id);
    if (!t) throw new NotFoundException('Platform stamp template not found');
    return t;
  }

  // ── Super-admin platform authoring (advanced designer save) ──

  async createPlatform(actor: TemplateActor, data: { name: string; type?: string; configJson: StampTemplateConfig }): Promise<any> {
    this.assertPlatformAdmin(actor);
    if (!data?.name?.trim()) throw new BadRequestException('Stamp name is required');
    const clash = await this.prisma.stampTemplate.findFirst({ where: { schoolId: null, scope: 'PLATFORM', name: data.name.trim() }, select: { id: true } });
    if (clash) throw new BadRequestException(`A platform stamp named "${data.name.trim()}" already exists`);

    const template = await this.prisma.stampTemplate.create({
      data: {
        schoolId: null,
        scope: 'PLATFORM',
        name: data.name.trim(),
        type: (data.type as any) || 'CUSTOM',
        status: 'PUBLISHED',
        version: 1,
        configJson: data.configJson as any,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
    await this.prisma.stampTemplateVersion.create({
      data: { templateId: template.id, version: 1, configJson: data.configJson as any, changeNote: 'Platform template created', createdById: actor.userId },
    });
    return this.getPlatform(actor, template.id);
  }

  async updatePlatform(actor: TemplateActor, id: string, data: { name?: string; configJson?: StampTemplateConfig }): Promise<any> {
    this.assertPlatformAdmin(actor);
    const t = await this.assertPlatformTemplate(id);
    if (data.configJson) {
      const nextVersion = t.version + 1;
      await this.prisma.stampTemplateVersion.create({
        data: { templateId: id, version: nextVersion, configJson: data.configJson as any, changeNote: data.name ? `Updated: ${data.name}` : 'Updated', createdById: actor.userId },
      });
      await this.prisma.stampTemplate.update({
        where: { id },
        data: { name: data.name || t.name, configJson: data.configJson as any, version: nextVersion, status: 'PUBLISHED', updatedBy: actor.userId },
      });
    } else if (data.name) {
      await this.prisma.stampTemplate.update({ where: { id }, data: { name: data.name, updatedBy: actor.userId } });
    }
    return this.getPlatform(actor, id);
  }

  async getPlatform(actor: TemplateActor, id: string): Promise<any> {
    this.assertPlatformAdmin(actor);
    const t = await this.findPlatformTemplate(id);
    if (!t) throw new NotFoundException('Platform stamp template not found');
    return t;
  }

  async listPlatform(actor: TemplateActor): Promise<any[]> {
    this.assertPlatformAdmin(actor);
    return this.prisma.stampTemplate.findMany({
      where: { schoolId: null, scope: 'PLATFORM' },
      include: { marketplace: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async deletePlatform(actor: TemplateActor, id: string): Promise<{ success: boolean }> {
    this.assertPlatformAdmin(actor);
    // Delete marketplace row (cascades installs), then the platform template.
    const m = await this.prisma.stampMarketplace.findUnique({ where: { templateId: id }, select: { id: true } });
    if (m) await this.prisma.stampMarketplace.delete({ where: { id: m.id } });
    await this.prisma.stampTemplate.delete({ where: { id } });
    return { success: true };
  }

  // ── Marketplace management (super admin) ──

  async publishToMarketplace(actor: TemplateActor, templateId: string, dto: PublishDto): Promise<any> {
    this.assertPlatformAdmin(actor);
    const t = await this.assertPlatformTemplate(templateId);
    const name = dto?.name?.trim() || t.name;
    const entry = await this.prisma.stampMarketplace.upsert({
      where: { templateId },
      update: {
        name,
        description: dto.description ?? undefined,
        category: dto.category ?? undefined,
        tags: dto.tags ?? undefined,
        minTier: dto.minTier ?? undefined,
        status: 'PUBLISHED',
        version: t.version,
        publishedAt: new Date(),
      },
      create: {
        templateId,
        name,
        description: dto.description,
        category: dto.category,
        tags: dto.tags ?? [],
        minTier: dto.minTier ?? 'STANDARD',
        status: 'PUBLISHED',
        version: t.version,
        publishedAt: new Date(),
        createdBy: actor.userId,
      },
    });
    return entry;
  }

  async unpublishMarketplace(actor: TemplateActor, templateId: string): Promise<any> {
    this.assertPlatformAdmin(actor);
    const entry = await this.prisma.stampMarketplace.findUnique({ where: { templateId } });
    if (!entry) throw new NotFoundException('Marketplace entry not found');
    return this.prisma.stampMarketplace.update({
      where: { id: entry.id },
      data: { status: 'UNPUBLISHED', publishedAt: null },
    });
  }

  async listMarketplaceEntries(actor: TemplateActor, opts: { mineOnly?: boolean } = {}): Promise<any[]> {
    this.assertPlatformAdmin(actor);
    return this.prisma.stampMarketplace.findMany({
      where: opts.mineOnly ? undefined : undefined,
      include: { template: true, _count: { select: { installs: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ── School-facing browse / install ──

  async browse(actor: TemplateActor, category?: string): Promise<any[]> {
    const schoolId = this.requireSchool(actor);
    const installed = new Set(
      (await this.prisma.stampMarketplaceInstall.findMany({ where: { schoolId }, select: { marketplaceId: true } })).map(r => r.marketplaceId),
    );
    const entries = await this.prisma.stampMarketplace.findMany({
      where: {
        status: 'PUBLISHED',
        ...(category && category !== 'ALL' ? { category } : {}),
      },
      include: { template: { select: { configJson: true, type: true } }, _count: { select: { installs: true } } },
      orderBy: [{ installCount: 'desc' }, { updatedAt: 'desc' }],
    });
    return entries.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      category: e.category,
      tags: e.tags,
      minTier: e.minTier,
      installCount: e.installCount,
      type: (e.template as any)?.type,
      previewConfigJson: (e.template as any)?.configJson,
      installed: installed.has(e.id),
    }));
  }

  async myInstalled(actor: TemplateActor): Promise<any[]> {
    const schoolId = this.requireSchool(actor);
    const rows = await this.prisma.stampMarketplaceInstall.findMany({
      where: { schoolId },
      include: { marketplace: true, template: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => ({ installId: r.id, ...r.marketplace, installedTemplateId: r.templateId }));
  }

  async install(actor: TemplateActor, marketplaceId: string): Promise<any> {
    const schoolId = this.requireSchool(actor);
    const entry = await this.prisma.stampMarketplace.findFirst({
      where: { id: marketplaceId, status: 'PUBLISHED' },
      include: { template: true },
    });
    if (!entry) throw new NotFoundException('Marketplace stamp not found');

    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { subscriptionTier: true } });
    const schoolTier = ((school?.subscriptionTier || 'basic').toUpperCase() as SubscriptionTier);
    if (TIER_ORDER[schoolTier] < TIER_ORDER[entry.minTier]) {
      throw new ForbiddenException(`Installing this stamp requires ${entry.minTier} tier. Current: ${schoolTier}`);
    }

    const existing = await this.prisma.stampMarketplaceInstall.findUnique({
      where: { marketplaceId_schoolId: { marketplaceId, schoolId } },
    });
    if (existing) return { success: true, alreadyInstalled: true, installId: existing.id };

    const config = entry.template.configJson as StampTemplateConfig;
    const copy = await this.prisma.stampTemplate.create({
      data: {
        schoolId,
        scope: 'SCHOOL',
        name: entry.name,
        type: (entry.template.type as any) || 'CUSTOM',
        status: 'PUBLISHED',
        version: 1,
        configJson: config as any,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
    await this.prisma.stampTemplateVersion.create({
      data: { templateId: copy.id, version: 1, configJson: config as any, changeNote: `Installed from marketplace "${entry.name}"`, createdById: actor.userId },
    });

    await this.prisma.$transaction([
      this.prisma.stampMarketplaceInstall.create({
        data: { marketplaceId, schoolId, templateId: copy.id, installedBy: actor.userId },
      }),
      this.prisma.stampMarketplace.update({ where: { id: entry.id }, data: { installCount: { increment: 1 } } }),
    ]);

    return { success: true, installId: (await this.prisma.stampMarketplaceInstall.findUnique({ where: { marketplaceId_schoolId: { marketplaceId, schoolId } } }))?.id, installedTemplateId: copy.id };
  }

  async uninstall(actor: TemplateActor, marketplaceId: string): Promise<{ success: boolean }> {
    const schoolId = this.requireSchool(actor);
    const install = await this.prisma.stampMarketplaceInstall.findUnique({
      where: { marketplaceId_schoolId: { marketplaceId, schoolId } },
    });
    if (!install) throw new NotFoundException('Stamp not installed');
    // Remove the school's copied template and the install record.
    await this.prisma.stampMarketplaceInstall.delete({ where: { id: install.id } });
    await this.prisma.stampTemplate.deleteMany({ where: { id: install.templateId, schoolId } }).catch(() => undefined);
    await this.prisma.stampMarketplace.update({ where: { id: marketplaceId }, data: { installCount: { decrement: 1 } } }).catch(() => undefined);
    return { success: true };
  }

  // ── Helpers used by the designer to persist an advanced platform stamp ──

  categories(): string[] {
    return MARKETPLACE_CATEGORIES;
  }
}
