import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialDocumentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialAuditService } from './financial-audit.service';

export interface FinancialTemplateInput {
  docType?: FinancialDocumentType;
  name?: string;
  description?: string;
  theme?: Record<string, any>;
  headerLayout?: string;
  footerLayout?: string;
  watermarkText?: string;
  components?: Record<string, any>;
  legalFooter?: string;
  termsAndConditions?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

@Injectable()
export class FinancialTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinancialAuditService,
  ) {}

  async list(docType?: string) {
    return this.prisma.financialDocumentTemplate.findMany({
      where: docType ? { docType: docType as FinancialDocumentType } : {},
      orderBy: [{ docType: 'asc' }, { isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(id: string) {
    const template = await this.prisma.financialDocumentTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Financial template not found.');
    return template;
  }

  async create(input: FinancialTemplateInput, userId?: string | null, userEmail?: string | null) {
    if (!input.docType || !input.name) throw new BadRequestException('docType and name are required.');
    const template = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.financialDocumentTemplate.updateMany({ where: { docType: input.docType!, isDefault: true }, data: { isDefault: false } });
      }
      return tx.financialDocumentTemplate.create({
        data: {
          docType: input.docType!,
          name: input.name!,
          description: input.description,
          theme: input.theme,
          headerLayout: input.headerLayout,
          footerLayout: input.footerLayout,
          watermarkText: input.watermarkText,
          components: input.components,
          legalFooter: input.legalFooter,
          termsAndConditions: input.termsAndConditions,
          isActive: input.isActive ?? true,
          isDefault: input.isDefault ?? false,
          version: 1,
          createdById: userId ?? undefined,
        },
      });
    });
    await this.audit.write({ action: 'CREATE', entity: 'FinancialDocumentTemplate', entityId: template.id, userId, userEmail, newValues: { docType: template.docType, name: template.name, version: template.version } });
    return template;
  }

  async update(id: string, input: FinancialTemplateInput, userId?: string | null, userEmail?: string | null) {
    const existing = await this.get(id);
    const template = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.financialDocumentTemplate.updateMany({ where: { docType: existing.docType, isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.financialDocumentTemplate.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.theme !== undefined ? { theme: input.theme } : {}),
          ...(input.headerLayout !== undefined ? { headerLayout: input.headerLayout } : {}),
          ...(input.footerLayout !== undefined ? { footerLayout: input.footerLayout } : {}),
          ...(input.watermarkText !== undefined ? { watermarkText: input.watermarkText } : {}),
          ...(input.components !== undefined ? { components: input.components } : {}),
          ...(input.legalFooter !== undefined ? { legalFooter: input.legalFooter } : {}),
          ...(input.termsAndConditions !== undefined ? { termsAndConditions: input.termsAndConditions } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          version: { increment: 1 },
        },
      });
    });
    await this.audit.write({
      action: 'UPDATE',
      entity: 'FinancialDocumentTemplate',
      entityId: template.id,
      userId,
      userEmail,
      oldValues: { name: existing.name, version: existing.version },
      newValues: { name: template.name, version: template.version },
    });
    return template;
  }

  async duplicate(id: string, userId?: string | null) {
    const source = await this.get(id);
    return this.prisma.financialDocumentTemplate.create({
      data: {
        docType: source.docType,
        name: `${source.name} (Copy)`,
        description: source.description,
        theme: source.theme,
        headerLayout: source.headerLayout,
        footerLayout: source.footerLayout,
        watermarkText: source.watermarkText,
        components: source.components,
        legalFooter: source.legalFooter,
        termsAndConditions: source.termsAndConditions,
        isActive: true,
        isDefault: false,
        version: 1,
        createdById: userId ?? undefined,
      },
    });
  }

  async remove(id: string, userId?: string | null, userEmail?: string | null) {
    const existing = await this.get(id);
    if (existing.isDefault) {
      throw new BadRequestException('The default template cannot be deleted. Set another template as default first.');
    }
    await this.prisma.financialDocumentTemplate.delete({ where: { id } });
    await this.audit.write({ action: 'DELETE', entity: 'FinancialDocumentTemplate', entityId: id, userId, userEmail, oldValues: { name: existing.name } });
    return { ok: true };
  }

  async resolveFor(docType: FinancialDocumentType): Promise<any> {
    return this.prisma.financialDocumentTemplate.findFirst({
      where: { docType, isDefault: true, isActive: true },
      orderBy: { version: 'desc' },
    });
  }
}