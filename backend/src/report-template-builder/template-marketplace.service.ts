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
    const item = await this.prisma.templateMarketplace.findUnique({
      where: { id: marketplaceId },
      select: {
        id: true,
        template: {
          select: {
            id: true, name: true, templateType: true, pageSize: true,
            orientation: true, fontFamily: true, fontSize: true,
            primaryColor: true, secondaryColor: true, layoutJson: true,
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Marketplace item not found');
    if (!item.template) throw new NotFoundException('Source template not found for this marketplace item');

    const { template } = item;
    const components = await this.prisma.templateComponent.findMany({
      where: { templateId: template.id },
      select: {
        type: true, label: true, content: true, styles: true,
        position: true, size: true, settings: true, sortOrder: true, isRequired: true,
      },
    });

    const copy = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reportTemplate.create({
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
          layoutJson: (template.layoutJson || {}) as any,
          status: 'DRAFT',
          version: 1,
        },
      });

      if (components.length > 0) {
        await tx.templateComponent.createMany({
          data: components.map((c) => ({
            templateId: created.id,
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

      await tx.templateMarketplace.update({
        where: { id: marketplaceId },
        data: { downloads: { increment: 1 } },
      });

      return created;
    });

    return copy;
  }

  async likeTemplate(marketplaceId: string) {
    return this.prisma.templateMarketplace.update({ where: { id: marketplaceId }, data: { likes: { increment: 1 } } });
  }

  async getCategories() {
    return ['Report Cards', 'Certificates', 'Transcripts', 'Attendance', 'Progress Reports', 'Analytics', 'ID Cards', 'Letters', 'Other'];
  }
}
