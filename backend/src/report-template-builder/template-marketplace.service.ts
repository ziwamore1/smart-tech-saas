import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TemplateMarketplaceService {
  constructor(private prisma: PrismaService) {}

  async getMarketplaceTemplates(filters?: { category?: string; featured?: boolean; search?: string }) {
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
    return this.prisma.templateMarketplace.findMany({
      where,
      include: { template: { select: { id: true, name: true, templateType: true, pageSize: true } }, school: { select: { name: true } } },
      orderBy: [{ featured: 'desc' }, { downloads: 'desc' }],
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
    const item = await this.prisma.templateMarketplace.findUnique({ where: { id: marketplaceId }, include: { template: true } });
    if (!item) throw new NotFoundException('Marketplace item not found');

    await this.prisma.templateMarketplace.update({ where: { id: marketplaceId }, data: { downloads: { increment: 1 } } });

    const { template } = item;
    const components = await this.prisma.templateComponent.findMany({ where: { templateId: template.id } });

    const copy = await this.prisma.reportTemplate.create({
      data: {
        name: `${template.name} (from Marketplace)`,
        schoolId,
        templateType: template.templateType,
        pageSize: template.pageSize,
        orientation: template.orientation,
        fontFamily: template.fontFamily,
        fontSize: template.fontSize,
        primaryColor: template.primaryColor,
        secondaryColor: template.secondaryColor,
        layoutJson: template.layoutJson as any,
        status: 'DRAFT',
        version: 1,
      },
    });

    for (const c of components) {
      await this.prisma.templateComponent.create({
        data: {
          templateId: copy.id, type: c.type, label: c.label,
          content: c.content as any, styles: c.styles as any,
          position: c.position as any, size: c.size as any,
          settings: c.settings as any, sortOrder: c.sortOrder,
          isRequired: c.isRequired,
        },
      });
    }

    return copy;
  }

  async likeTemplate(marketplaceId: string) {
    return this.prisma.templateMarketplace.update({ where: { id: marketplaceId }, data: { likes: { increment: 1 } } });
  }

  async getCategories() {
    return ['Report Cards', 'Certificates', 'Transcripts', 'Attendance', 'Progress Reports', 'Analytics', 'ID Cards', 'Letters', 'Other'];
  }
}
