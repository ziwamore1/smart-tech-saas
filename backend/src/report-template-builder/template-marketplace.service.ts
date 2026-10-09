import { Injectable, NotFoundException, RequestTimeoutException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType } from '@prisma/client';

@Injectable()
export class TemplateMarketplaceService {
  constructor(private prisma: PrismaService) {}

  async getMarketplaceTemplates(filters?: { category?: string; featured?: boolean; search?: string; documentType?: string; recipientType?: string }) {
    await this.ensureSystemTemplatesPublished();
    const where: any = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.featured) where.featured = true;
    if (filters?.documentType) where.documentType = filters.documentType;
    if (filters?.recipientType) where.recipientType = filters.recipientType;
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
        include: { template: { select: { id: true, name: true, templateType: true, pageSize: true, certificate: true } }, school: { select: { name: true } } },
        orderBy: [{ featured: 'desc' }, { downloads: 'desc' }],
      }),
      15000,
    );
  }

  private async ensureSystemTemplatesPublished(): Promise<void> {
    const systemTemplates = await this.prisma.reportTemplate.findMany({
      where: { schoolId: null, isDefault: true },
      include: { category: { select: { slug: true } }, certificate: true },
    });
    if (systemTemplates.length === 0) return;

    // Repair legacy system certificates that were seeded before recipient and
    // award-category metadata existed. Only system templates are touched.
    for (const template of systemTemplates.filter((item) => item.templateType === 'CERTIFICATE' && item.certificate)) {
      const name = template.name.toLowerCase();
      const audience = /teacher|staff/.test(name) ? 'TEACHER' : 'STUDENT';
      const awardCategory = audience === 'TEACHER'
        ? (name.includes('staff') || name.includes('service') ? 'TEACHER_SERVICE' : 'TEACHER_PERFORMANCE')
        : name.includes('attendance') ? 'ATTENDANCE'
          : name.includes('sports') ? 'SPORTS'
            : name.includes('leadership') ? 'LEADERSHIP'
              : name.includes('graduation') ? 'GRADUATION'
                : name.includes('service') ? 'COMMUNITY_SERVICE'
                  : 'OVERALL_AVERAGE';
      if (template.certificate!.audience !== audience || template.certificate!.awardCategory !== awardCategory) {
        await this.prisma.certificateTemplate.update({ where: { templateId: template.id }, data: { audience, awardCategory } });
      }
      await this.prisma.templateMarketplace.updateMany({
        where: { templateId: template.id },
        data: { documentType: 'CERTIFICATE', recipientType: audience, awardCategory },
      });
    }

    // Normalize every published certificate, including school-authored entries,
    // from the certificate template itself. Marketplace metadata must never be
    // allowed to disagree with the source template audience.
    const certificateEntries = await this.prisma.templateMarketplace.findMany({
      where: { template: { templateType: 'CERTIFICATE', certificate: { isNot: null } } },
      select: { id: true, template: { select: { certificate: { select: { audience: true, awardCategory: true } } } } },
    });
    for (const entry of certificateEntries) {
      const certificate = entry.template.certificate;
      if (!certificate) continue;
      await this.prisma.templateMarketplace.update({
        where: { id: entry.id },
        data: { documentType: DocumentType.CERTIFICATE, recipientType: certificate.audience || 'STUDENT', awardCategory: certificate.awardCategory || 'OVERALL_AVERAGE' },
      });
    }

    // Backfill the professional HBS contract for templates seeded before the
    // marketplace renderer was introduced. Rendering uses this metadata to
    // select a template variant instead of the old canvas component layout.
    for (const template of systemTemplates) {
      if (!['REPORT_CARD', 'PROGRESS_REPORT', 'TRANSCRIPT'].includes(template.templateType)) continue;
      const metadata = (template.metadata as any) || {};
      if (metadata.professionalHbs && metadata.hbsVariant) continue;
      await this.prisma.reportTemplate.update({
        where: { id: template.id },
        data: {
          metadata: {
            ...metadata,
            source: metadata.source || 'system-seed',
            professionalHbs: true,
            hbsVariant: template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          },
        },
      });
    }

    for (const template of systemTemplates) {
      const documentType = this.resolveTemplateDocumentType(template);
      if (documentType !== 'ACADEMIC_REPORT') {
        await this.prisma.templateMarketplace.updateMany({
          where: { templateId: template.id, documentType: 'ACADEMIC_REPORT' },
          data: { documentType },
        });
      }
    }

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
        documentType: this.resolveTemplateDocumentType(template),
        title: template.name,
        description: template.description || '',
        category: template.category?.slug || 'Report Cards',
        tags: [template.templateType],
        featured: false,
      })),
      skipDuplicates: true,
    });
  }

  private resolveTemplateDocumentType(template: { templateType: string; name?: string; category?: { slug?: string } | null }): DocumentType {
    const haystack = `${template.templateType} ${template.name || ''} ${template.category?.slug || ''}`.toUpperCase();
    if (haystack.includes('TRANSCRIPT')) return DocumentType.TRANSCRIPT;
    if (haystack.includes('ATTENDANCE')) return DocumentType.ATTENDANCE;
    if (haystack.includes('CERTIFICATE')) return DocumentType.CERTIFICATE;
    if (haystack.includes('LEADERSHIP')) return DocumentType.LEADERSHIP;
    return DocumentType.ACADEMIC_REPORT;
  }

  async publishToMarketplace(schoolId: string, templateId: string, data: {
    title: string; description?: string; category?: string; tags?: string[]; price?: number; previewUrl?: string; documentType?: DocumentType; recipientType?: string; awardCategory?: string;
  }) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId }, include: { certificate: true } });
    if (!t) throw new NotFoundException('Template not found');
    const documentType = t.templateType === 'CERTIFICATE' ? DocumentType.CERTIFICATE : (data.documentType || this.resolveTemplateDocumentType(t));
    if (t.templateType === 'CERTIFICATE' && data.recipientType && data.recipientType !== (t.certificate?.audience || 'STUDENT')) {
      throw new NotFoundException('Certificate recipient type does not match the template audience');
    }
    return this.prisma.templateMarketplace.upsert({
      where: { templateId },
      create: { templateId, schoolId, ...data, documentType, recipientType: t.templateType === 'CERTIFICATE' ? (t.certificate?.audience || 'STUDENT') : (data.recipientType || 'STUDENT'), awardCategory: t.templateType === 'CERTIFICATE' ? t.certificate?.awardCategory : data.awardCategory, tags: data.tags || [] },
      update: { ...data, documentType, recipientType: t.templateType === 'CERTIFICATE' ? (t.certificate?.audience || 'STUDENT') : (data.recipientType || 'STUDENT'), awardCategory: t.templateType === 'CERTIFICATE' ? t.certificate?.awardCategory : data.awardCategory },
    });
  }

  async publishSystemTemplate(templateId: string, data: {
    title: string; description?: string; category?: string; tags?: string[]; price?: number; previewUrl?: string; featured?: boolean;
  }) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, isDefault: true }, include: { certificate: true } });
    if (!t) throw new NotFoundException('System template not found');
    const documentType = t.templateType === 'CERTIFICATE' ? DocumentType.CERTIFICATE : this.resolveTemplateDocumentType(t);
    return this.prisma.templateMarketplace.upsert({
      where: { templateId },
      create: { templateId, schoolId: null, ...data, documentType, recipientType: t.templateType === 'CERTIFICATE' ? (t.certificate?.audience || 'STUDENT') : 'STUDENT', awardCategory: t.templateType === 'CERTIFICATE' ? t.certificate?.awardCategory : undefined, tags: data.tags || [] },
      update: { ...data, documentType, recipientType: t.templateType === 'CERTIFICATE' ? (t.certificate?.audience || 'STUDENT') : 'STUDENT', awardCategory: t.templateType === 'CERTIFICATE' ? t.certificate?.awardCategory : undefined },
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
          metadata: {
            ...(template.metadata as any || {}),
            source: 'marketplace-download',
            sourceTemplateId: template.id,
            professionalHbs: template.templateType === 'REPORT_CARD' || template.templateType === 'PROGRESS_REPORT',
          },
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
          audience: template.certificate.audience,
          awardCategory: template.certificate.awardCategory,
          subjectId: template.certificate.subjectId,
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
