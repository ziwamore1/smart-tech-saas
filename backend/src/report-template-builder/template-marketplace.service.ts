import { Injectable, NotFoundException, RequestTimeoutException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TemplateMarketplaceService {
  constructor(private prisma: PrismaService) {}

  async getMarketplaceTemplates(filters?: { category?: string; featured?: boolean; search?: string }) {
    await this.ensureSystemTemplatesPublished();
    const where: any = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.featured) where.featured = true;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { tags: { has: filters.search } },
      ];
    }
    return withTimeout(
      this.prisma.templateMarketplace.findMany({
        where,
        include: { template: { select: { id: true, name: true, templateType: true, pageSize: true } }, school: { select: { name: true } } },
        orderBy: [{ featured: 'desc' }, { downloads: 'desc' }],
      }),
      15000,
    );
  }

  private async ensureSystemTemplatesPublished(): Promise<void> {
    const systemTemplates = await this.prisma.reportTemplate.findMany({
      where: { schoolId: null, isDefault: true },
      include: { category: { select: { slug: true } } },
    });
    if (systemTemplates.length === 0) return;

    const published = await this.prisma.templateMarketplace.findMany({
      where: { templateId: { in: systemTemplates.map((template) => template.id) } },
      select: { templateId: true },
    });
    const publishedIds = new Set(published.map((item) => item.templateId));
    const missing = systemTemplates.filter((template) => !publishedIds.has(template.id));
    if (missing.length === 0) return;

    await this.prisma.templateMarketplace.createMany({
      data: missing.map((template) => ({
        templateId: template.id,
        schoolId: null,
        title: template.name,
        description: template.description || '',
        category: template.category?.slug || 'Report Cards',
        tags: [template.templateType],
        featured: false,
      })),
      skipDuplicates: true,
    });
  }

  async publishToMarketplace(schoolId: string, templateId: string, data: {
    title: string; description?: string; category?: string; tags?: string[]; price?: number; previewUrl?: string;
  }) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');
    return this.prisma.templateMarketplace.upsert({
      where: { templateId },
      create: { templateId, schoolId, ...data, tags: data.tags || [] },
      update: data,
    });
  }

  async publishSystemTemplate(templateId: string, data: {
    title: string; description?: string; category?: string; tags?: string[]; price?: number; previewUrl?: string; featured?: boolean;
  }) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, isDefault: true } });
    if (!t) throw new NotFoundException('System template not found');
    return this.prisma.templateMarketplace.upsert({
      where: { templateId },
      create: { templateId, schoolId: null, ...data, tags: data.tags || [] },
      update: data,
    });
  }

  async downloadTemplate(schoolId: string, marketplaceId: string) {
    return withTimeout(this._downloadTemplate(schoolId, marketplaceId), 30000);
  }

  private async _downloadTemplate(schoolId: string, marketplaceId: string) {
    const item = await this.prisma.templateMarketplace.findUnique({
      where: { id: marketplaceId },
      select: { id: true, templateId: true },
    });
    if (!item) throw new NotFoundException('Marketplace item not found');

    const template = await this.prisma.reportTemplate.findUnique({
      where: { id: item.templateId },
      include: { certificate: true },
    });
    if (!template) throw new NotFoundException('Source template not found');

    const copy = await this.prisma.reportTemplate.create({
      data: {
        name: `${template.name || 'Template'} (from Marketplace)`,
        schoolId,
        templateType: template.templateType || 'REPORT_CARD',
        pageSize: template.pageSize || 'A4',
        orientation: template.orientation || 'PORTRAIT',
        fontFamily: template.fontFamily || 'Arial',
        fontSize: template.fontSize || 12,
        primaryColor: template.primaryColor || '#1a365d',
        secondaryColor: template.secondaryColor || '#f5f5f5',
         layoutJson: {},
         metadata: { source: 'marketplace-download', sourceTemplateId: template.id },
         status: 'PUBLISHED',
        version: 1,
      },
    });

    const components = await this.prisma.templateComponent.findMany({
      where: { templateId: template.id },
      select: { type: true, label: true, content: true, styles: true, position: true, size: true, settings: true, sortOrder: true, isRequired: true },
    });

    if (components.length > 0) {
      await this.prisma.templateComponent.createMany({
        data: components.map((c) => ({
          templateId: copy.id,
          type: c.type || 'TEXT',
          label: c.label || '',
          content: (c.content || {}) as any,
          styles: (c.styles || {}) as any,
          position: (c.position || { x: 0, y: 0 }) as any,
          size: (c.size || { width: 100, height: 50 }) as any,
          settings: (c.settings || {}) as any,
          sortOrder: c.sortOrder || 0,
          isRequired: c.isRequired || false,
        })),
      });
    }

    if (template.certificate) {
      await this.prisma.certificateTemplate.create({
        data: {
          templateId: copy.id,
          certificateType: template.certificate.certificateType,
          borderStyle: template.certificate.borderStyle,
          borderColor: template.certificate.borderColor,
          sealUrl: template.certificate.sealUrl,
          showQrCode: template.certificate.showQrCode,
          autoNumbering: template.certificate.autoNumbering,
          showPhoto: template.certificate.showPhoto,
          signature1Label: template.certificate.signature1Label,
          signature1Name: template.certificate.signature1Name,
          signature1Title: template.certificate.signature1Title,
          signature2Label: template.certificate.signature2Label,
          signature2Name: template.certificate.signature2Name,
          signature2Title: template.certificate.signature2Title,
          awardText: template.certificate.awardText,
          showBadge: template.certificate.showBadge,
          badgeStyle: template.certificate.badgeStyle,
          showWatermark: template.certificate.showWatermark,
          watermarkText: template.certificate.watermarkText,
          layoutJson: template.certificate.layoutJson as any,
        },
      });
    }

    await this.prisma.templateMarketplace.update({
      where: { id: marketplaceId },
      data: { downloads: { increment: 1 } },
    });

    return copy;
  }

  async likeTemplate(marketplaceId: string) {
    return this.prisma.templateMarketplace.update({ where: { id: marketplaceId }, data: { likes: { increment: 1 } } });
  }

  async getCategories() {
    await this.ensureSystemTemplatesPublished();
    const rows = await this.prisma.templateMarketplace.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map((row) => ({
      id: row.category!,
      slug: row.category!,
      name: row.category!.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    }));
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new RequestTimeoutException(`Query timed out after ${ms}ms`)), ms)),
  ]);
}
