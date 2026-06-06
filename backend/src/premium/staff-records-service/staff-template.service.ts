import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StaffTemplateService {
  private readonly logger = new Logger(StaffTemplateService.name);

  constructor(private prisma: PrismaService) {}

  // ── Templates ──

  async findAllTemplates(schoolId: string) {
    return this.prisma.staffReturnTemplate.findMany({
      where: { schoolId },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findTemplateById(id: string) {
    const template = await this.prisma.staffReturnTemplate.findUnique({
      where: { id },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
        submissions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async createTemplate(data: {
    name: string;
    description?: string;
    schoolId: string;
    returnType?: string;
    category?: string;
    columns?: {
      columnName: string;
      columnLabel: string;
      columnOrder: number;
      dataType?: string;
      isRequired?: boolean;
      width?: number;
      alignment?: string;
    }[];
  }) {
    const template = await this.prisma.staffReturnTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        schoolId: data.schoolId,
        returnType: data.returnType || 'MONTHLY',
        category: data.category || 'DISTRICT',
        columns: data.columns
          ? {
              create: data.columns.map((col) => ({
                columnName: col.columnName,
                columnLabel: col.columnLabel,
                columnOrder: col.columnOrder,
                dataType: col.dataType || 'string',
                isRequired: col.isRequired || false,
                width: col.width || 120,
                alignment: col.alignment || 'left',
              })),
            }
          : undefined,
      },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
      },
    });

    return template;
  }

  async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      returnType?: string;
      isActive?: boolean;
      isDefault?: boolean;
      category?: string;
      config?: any;
    },
  ) {
    const existing = await this.prisma.staffReturnTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.staffReturnTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        returnType: data.returnType,
        isActive: data.isActive,
        isDefault: data.isDefault,
        category: data.category,
        config: data.config !== undefined ? (data.config as any) : undefined,
      },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
      },
    });
  }

  async deleteTemplate(id: string) {
    const existing = await this.prisma.staffReturnTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.staffReturnTemplate.delete({ where: { id } });

    return { message: 'Template deleted successfully' };
  }

  async duplicateTemplate(id: string, newName: string) {
    const existing = await this.prisma.staffReturnTemplate.findUnique({
      where: { id },
      include: { columns: true },
    });

    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.staffReturnTemplate.create({
      data: {
        name: newName || `${existing.name} (Copy)`,
        description: existing.description,
        schoolId: existing.schoolId,
        returnType: existing.returnType,
        category: existing.category,
        config: existing.config as any,
        columns: {
          create: existing.columns.map((col) => ({
            columnName: col.columnName,
            columnLabel: col.columnLabel,
            columnOrder: col.columnOrder,
            dataType: col.dataType,
            isRequired: col.isRequired,
            isVisible: col.isVisible,
            isEditable: col.isEditable,
            width: col.width,
            alignment: col.alignment,
            fontStyle: col.fontStyle,
            backgroundColor: col.backgroundColor,
            defaultValue: col.defaultValue,
            options: col.options as any,
            validationRules: col.validationRules as any,
          })),
        },
      },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
      },
    });
  }

  // ── Columns ──

  async addColumn(
    templateId: string,
    data: {
      columnName: string;
      columnLabel: string;
      columnOrder: number;
      dataType?: string;
      isRequired?: boolean;
      width?: number;
      alignment?: string;
      defaultValue?: string;
    },
  ) {
    const template = await this.prisma.staffReturnTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.staffReturnColumn.create({
      data: {
        templateId,
        columnName: data.columnName,
        columnLabel: data.columnLabel,
        columnOrder: data.columnOrder,
        dataType: data.dataType || 'string',
        isRequired: data.isRequired || false,
        width: data.width || 120,
        alignment: data.alignment || 'left',
        defaultValue: data.defaultValue,
      },
    });
  }

  async updateColumn(
    id: string,
    data: {
      columnName?: string;
      columnLabel?: string;
      columnOrder?: number;
      dataType?: string;
      isRequired?: boolean;
      isVisible?: boolean;
      isEditable?: boolean;
      width?: number;
      alignment?: string;
      fontStyle?: string;
      backgroundColor?: string;
      defaultValue?: string;
      options?: any[];
      validationRules?: any;
    },
  ) {
    const existing = await this.prisma.staffReturnColumn.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Column not found');
    }

    return this.prisma.staffReturnColumn.update({
      where: { id },
      data: {
        columnName: data.columnName,
        columnLabel: data.columnLabel,
        columnOrder: data.columnOrder,
        dataType: data.dataType,
        isRequired: data.isRequired,
        isVisible: data.isVisible,
        isEditable: data.isEditable,
        width: data.width,
        alignment: data.alignment,
        fontStyle: data.fontStyle,
        backgroundColor: data.backgroundColor,
        defaultValue: data.defaultValue,
        options: data.options !== undefined ? (data.options as any) : undefined,
        validationRules: data.validationRules !== undefined ? (data.validationRules as any) : undefined,
      },
    });
  }

  async deleteColumn(id: string) {
    const existing = await this.prisma.staffReturnColumn.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Column not found');
    }

    await this.prisma.staffReturnColumn.delete({ where: { id } });

    return { message: 'Column deleted successfully' };
  }

  async reorderColumns(templateId: string, columnOrder: { id: string; order: number }[]) {
    const template = await this.prisma.staffReturnTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    for (const item of columnOrder) {
      await this.prisma.staffReturnColumn.update({
        where: { id: item.id },
        data: { columnOrder: item.order },
      });
    }

    return this.prisma.staffReturnColumn.findMany({
      where: { templateId },
      orderBy: { columnOrder: 'asc' },
    });
  }

  // ── Submissions ──

  async findAllSubmissions(schoolId: string, templateId?: string) {
    const where: any = { schoolId };
    if (templateId) where.templateId = templateId;

    return this.prisma.staffReturnSubmission.findMany({
      where,
      include: {
        template: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findSubmissionById(id: string) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id },
      include: {
        template: {
          include: { columns: { orderBy: { columnOrder: 'asc' } } },
        },
        logs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  async createSubmission(data: {
    templateId: string;
    schoolId: string;
    period: string;
    academicYear?: string;
    term?: string;
    data?: any[];
  }) {
    const template = await this.prisma.staffReturnTemplate.findUnique({
      where: { id: data.templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.staffReturnSubmission.create({
      data: {
        templateId: data.templateId,
        schoolId: data.schoolId,
        period: data.period,
        academicYear: data.academicYear,
        term: data.term,
        data: (data.data || []) as any,
        status: 'DRAFT',
      },
      include: {
        template: {
          include: { columns: { orderBy: { columnOrder: 'asc' } } },
        },
      },
    });
  }

  async updateSubmission(id: string, data: any[]) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return this.prisma.staffReturnSubmission.update({
      where: { id },
      data: {
        data: data as any,
        status: 'DRAFT',
      },
    });
  }

  async submitSubmission(id: string, performedBy?: string) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    await this.createAuditLog({
      submissionId: id,
      schoolId: submission.schoolId,
      action: 'SUBMIT',
      entityType: 'STAFF_RETURN',
      entityId: id,
      performedBy: performedBy || 'system',
    });

    return this.prisma.staffReturnSubmission.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        generatedBy: performedBy,
        generatedAt: new Date(),
      },
    });
  }

  async approveSubmission(id: string, approvedBy: string) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    await this.createAuditLog({
      submissionId: id,
      schoolId: submission.schoolId,
      action: 'APPROVE',
      entityType: 'STAFF_RETURN',
      entityId: id,
      performedBy: approvedBy,
    });

    return this.prisma.staffReturnSubmission.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  async deleteSubmission(id: string) {
    await this.prisma.staffReturnSubmission.delete({ where: { id } });
    return { message: 'Submission deleted successfully' };
  }

  // ── Audit Log ──

  async createAuditLog(data: {
    submissionId?: string;
    profileId?: string;
    schoolId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    performedBy?: string;
    performedByName?: string;
    changes?: any;
    metadata?: any;
  }) {
    return this.prisma.staffAuditLog.create({
      data: {
        submissionId: data.submissionId,
        profileId: data.profileId,
        schoolId: data.schoolId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        performedBy: data.performedBy,
        performedByName: data.performedByName,
        changes: data.changes as any,
        metadata: data.metadata as any,
      },
    });
  }

  async getAuditLogs(schoolId: string, limit = 50) {
    return this.prisma.staffAuditLog.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
