import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcademicTemplatesService {
  constructor(private prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.templateCategory.findMany({
      where: { isSystem: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { templates: true } },
      },
    });
  }

  async createCategory(data: {
    name: string; slug: string; description?: string; icon?: string;
    educationLevel?: string; sortOrder?: number;
  }) {
    const existing = await this.prisma.templateCategory.findFirst({
      where: { slug: data.slug, isSystem: true },
    });
    if (existing) throw new BadRequestException('Category slug already exists');
    return this.prisma.templateCategory.create({
      data: { ...data, isSystem: true },
    });
  }

  async updateCategory(id: string, data: any) {
    const cat = await this.prisma.templateCategory.findFirst({ where: { id, isSystem: true } });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.templateCategory.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    const cat = await this.prisma.templateCategory.findFirst({ where: { id, isSystem: true } });
    if (!cat) throw new NotFoundException('Category not found');
    const count = await this.prisma.reportTemplate.count({ where: { categoryId: id } });
    if (count > 0) throw new BadRequestException(`Cannot delete category with ${count} templates. Remove templates first.`);
    return this.prisma.templateCategory.delete({ where: { id } });
  }

  async getTemplates(filters?: { categoryId?: string; educationLevel?: string; type?: string }) {
    const where: any = { isDefault: true };
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.type) where.templateType = filters.type;
    if (filters?.educationLevel) {
      where.category = { educationLevel: filters.educationLevel, isSystem: true };
    }
    return this.prisma.reportTemplate.findMany({
      where,
      include: {
        category: true,
        certificate: true,
        _count: { select: { components: true } },
      },
      orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
    });
  }

  async getTemplate(id: string) {
    const t = await this.prisma.reportTemplate.findFirst({
      where: { id, isDefault: true },
      include: {
        category: true,
        components: { orderBy: { sortOrder: 'asc' } },
        certificate: true,
      },
    });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async createTemplate(data: any) {
    return this.prisma.reportTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        isDefault: true,
        templateType: data.templateType || 'REPORT_CARD',
        categoryId: data.categoryId,
        pageSize: data.pageSize || 'A4',
        orientation: data.orientation || 'portrait',
        primaryColor: data.primaryColor || '#1a365d',
        secondaryColor: data.secondaryColor || '#f5f5f5',
        fontFamily: data.fontFamily || 'Arial',
        fontSize: data.fontSize || 11,
        status: 'PUBLISHED',
        version: 1,
        includeLogo: true,
        includeSignature: true,
        remarksEnabled: true,
        ...data,
      },
      include: { category: true },
    });
  }

  async updateTemplate(id: string, data: any) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id, isDefault: true } });
    if (!t) throw new NotFoundException('Template not found');
    return this.prisma.reportTemplate.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  async deleteTemplate(id: string) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id, isDefault: true } });
    if (!t) throw new NotFoundException('Template not found');
    return this.prisma.reportTemplate.delete({ where: { id } });
  }

  async duplicateTemplate(id: string) {
    const original = await this.prisma.reportTemplate.findFirst({
      where: { id, isDefault: true },
      include: { components: true, certificate: true },
    });
    if (!original) throw new NotFoundException('Template not found');

    const copy = await this.prisma.reportTemplate.create({
      data: {
        name: `${original.name} (Copy)`,
        isDefault: true,
        description: original.description,
        templateType: original.templateType,
        categoryId: original.categoryId,
        pageSize: original.pageSize,
        orientation: original.orientation,
        primaryColor: original.primaryColor,
        secondaryColor: original.secondaryColor,
        fontFamily: original.fontFamily,
        fontSize: original.fontSize,
        status: 'PUBLISHED',
        version: 1,
        includeLogo: original.includeLogo,
        includeStamp: original.includeStamp,
        includeSignature: original.includeSignature,
        remarksEnabled: original.remarksEnabled,
        metadata: original.metadata as any,
      },
    });

    for (const c of original.components) {
      await this.prisma.templateComponent.create({
        data: {
          templateId: copy.id,
          type: c.type,
          label: c.label,
          content: c.content as any,
          styles: c.styles as any,
          position: c.position as any,
          size: c.size as any,
          settings: c.settings as any,
          placeholder: c.placeholder,
          isRequired: c.isRequired,
          sortOrder: c.sortOrder,
        },
      });
    }

    if (original.certificate) {
      const cert = original.certificate;
      await this.prisma.certificateTemplate.create({
        data: {
          templateId: copy.id,
          certificateType: cert.certificateType,
          borderStyle: cert.borderStyle,
          borderColor: cert.borderColor,
          showQrCode: cert.showQrCode,
          autoNumbering: cert.autoNumbering,
          nextNumber: 1,
          signature1Label: cert.signature1Label,
          signature1Name: cert.signature1Name,
          signature2Label: cert.signature2Label,
          signature2Name: cert.signature2Name,
          awardText: cert.awardText,
          showBadge: cert.showBadge,
          badgeStyle: cert.badgeStyle,
          showWatermark: cert.showWatermark,
        },
      });
    }

    return copy;
  }

  async seedDefaults() {
    return {
      success: false,
      message: 'Run seed manually: npx ts-node prisma/seed-templates.ts',
      instructions: 'Navigate to backend/ directory and run: npx ts-node prisma/seed-templates.ts',
    };
  }

  async getOverview() {
    const [categories, totalTemplates, byType, byCategory] = await Promise.all([
      this.prisma.templateCategory.findMany({ where: { isSystem: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.reportTemplate.count({ where: { isDefault: true } }),
      this.prisma.reportTemplate.groupBy({
        by: ['templateType'],
        where: { isDefault: true },
        _count: true,
      }),
      this.prisma.reportTemplate.groupBy({
        by: ['categoryId'],
        where: { isDefault: true },
        _count: true,
      }),
    ]);
    return { categories, totalTemplates, byType, byCategory };
  }

  async generateAiRemarks(data: {
    type: 'teacher' | 'class_teacher' | 'head_teacher' | 'promotion';
    studentName?: string;
    academicPerformance?: string;
    attendance?: string;
    discipline?: string;
    assessmentResults?: string;
  }) {
    const templates: Record<string, string[]> = {
      teacher: [
        '{student} has shown {performance} performance this term. {attendance_note} {discipline_note} Continue working hard to improve.',
        '{student} demonstrated {performance} understanding of the subjects. {attendance_note} Keep up the good work.',
        'Overall, {student} performed {performance} this term. {assessment_note} {discipline_note}',
      ],
      class_teacher: [
        '{student} is a {discipline} student who has performed {performance} academically. {attendance_note} Recommended for promotion.',
        '{student} showed {performance} progress this term. {discipline_note} {attendance_note} Parents are encouraged to support learning at home.',
        'As class teacher, I commend {student} for {performance} performance. {discipline_note} {assessment_note}',
      ],
      head_teacher: [
        'After reviewing {student}\'s overall performance, I note {performance} results. {discipline_note} {attendance_note} Best wishes for next term.',
        '{student} has completed the term with {performance} grades. {discipline_note} The school commends the effort made.',
        'The school administration acknowledges {student}\'s {performance} performance. {discipline_note} Keep striving for excellence.',
      ],
      promotion: [
        'Based on academic performance and overall assessment, {student} is promoted to the next grade. {performance_note}',
        '{student} meets the requirements for promotion. {performance_note} Congratulations on your progression.',
        'Promotion status: Approved. {student} has demonstrated sufficient {performance} performance to advance.',
      ],
    };

    const selectedTemplates = templates[data.type] || templates.teacher;
    const index = Math.floor(Math.random() * selectedTemplates.length);
    let remark = selectedTemplates[index];

    const perf = data.academicPerformance || 'satisfactory';
    const attendanceText = data.attendance
      ? `Attendance: ${data.attendance}.`
      : '';
    const disciplineText = data.discipline
      ? `Discipline: ${data.discipline}.`
      : '';
    const assessmentText = data.assessmentResults
      ? `Assessment results: ${data.assessmentResults}.`
      : '';

    remark = remark
      .replace(/\{student\}/g, data.studentName || 'the student')
      .replace(/\{performance\}/g, perf.toLowerCase())
      .replace(/\{attendance_note\}/g, attendanceText)
      .replace(/\{discipline_note\}/g, disciplineText)
      .replace(/\{assessment_note\}/g, assessmentText)
      .replace(/\{performance_note\}/g, `Performance: ${perf}.`);

    return {
      remark,
      type: data.type,
      generatedAt: new Date().toISOString(),
    };
  }
}
