import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportTemplateType, TemplateStatus, ComponentType } from '@prisma/client';
import { FeatureLockService } from '../feature-lock/feature-lock.service';

const ENHANCED_PROFESSIONAL_COMPONENTS: any[] = [
  { type: 'HEADER', label: 'Report Header', content: { text: 'ENHANCED PROFESSIONAL REPORT CARD', color: '#1e3a8a', fontSize: 16 }, styles: { color: '#1e3a8a', textAlign: 'center' }, position: { x: 30, y: 20 }, size: { width: 535, height: 30 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 0 },
  { type: 'DIVIDER', label: 'Divider', content: {}, styles: { borderTop: '1px solid #1e3a8a' }, position: { x: 30, y: 55 }, size: { width: 535, height: 1 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 1 },
  { type: 'SCHOOL_LOGO', label: 'School Logo', content: {}, styles: {}, position: { x: 30, y: 65 }, size: { width: 60, height: 60 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 2 },
  { type: 'SCHOOL_NAME', label: 'School Name', content: { color: '#1e3a8a', fontSize: 18 }, styles: { color: '#1e3a8a', fontWeight: 'bold' }, position: { x: 100, y: 70 }, size: { width: 300, height: 22 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 3 },
  { type: 'SCHOOL_INFO', label: 'School Info', content: { color: '#666', fontSize: 10 }, styles: { color: '#666' }, position: { x: 100, y: 95 }, size: { width: 300, height: 30 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 4 },
  { type: 'STUDENT_PHOTO', label: 'Student Photo', content: {}, styles: { border: '1px solid #ccc' }, position: { x: 495, y: 65 }, size: { width: 70, height: 70 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 5 },
  { type: 'STUDENT_INFO', label: 'Student Information', content: { color: '#333', fontSize: 11 }, styles: { color: '#333' }, position: { x: 30, y: 140 }, size: { width: 535, height: 45 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 6 },
  { type: 'ATTENDANCE_TABLE', label: 'Attendance', content: { showPercentage: true }, styles: { headerBg: '#1e3a8a', headerColor: '#fff' }, position: { x: 30, y: 195 }, size: { width: 535, height: 35 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 7 },
  { type: 'RESULTS_TABLE', label: 'Subject Results', content: { showGrade: true, showScore: true, showPoints: true, showRemark: true }, styles: { headerBg: '#1e3a8a', headerColor: '#fff' }, position: { x: 30, y: 240 }, size: { width: 535, height: 200 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 8 },
  { type: 'RANKING_TABLE', label: 'Class Ranking', content: { showPosition: true, showTotalStudents: true }, styles: { headerBg: '#047857', headerColor: '#fff' }, position: { x: 30, y: 450 }, size: { width: 535, height: 30 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 9 },
  { type: 'PERFORMANCE_CHART', label: 'Performance Chart', content: { chartType: 'bar' }, styles: {}, position: { x: 30, y: 490 }, size: { width: 250, height: 130 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 10 },
  { type: 'ANALYTICS_SUMMARY', label: 'Summary', content: { showTotal: false, showAverage: true, showPoints: true, showPosition: true }, styles: { bgColor: '#f8fafc' }, position: { x: 300, y: 490 }, size: { width: 265, height: 130 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 11 },
  { type: 'AI_NARRATIVE', label: 'AI Narrative', content: { color: '#555', fontSize: 11 }, styles: { color: '#555', bgColor: '#f5f3ff' }, position: { x: 30, y: 630 }, size: { width: 535, height: 45 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 12 },
  { type: 'STRENGTHS_WEAKNESSES', label: 'Strengths & Weaknesses', content: { color: '#555', fontSize: 11 }, styles: { color: '#555', bgColor: '#ecfdf5' }, position: { x: 30, y: 680 }, size: { width: 535, height: 45 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 13 },
  { type: 'RECOMMENDATIONS', label: 'Recommendations', content: { color: '#555', fontSize: 11 }, styles: { color: '#555', bgColor: '#fffbeb' }, position: { x: 30, y: 730 }, size: { width: 535, height: 40 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 14 },
  { type: 'TEACHER_REMARKS', label: 'Class Teacher Remarks', content: { color: '#555', fontSize: 11 }, styles: { color: '#555', bgColor: '#fefce8' }, position: { x: 30, y: 780 }, size: { width: 535, height: 40 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 15 },
  { type: 'HEAD_TEACHER_REMARKS', label: 'Head Teacher Remarks', content: { color: '#555', fontSize: 11 }, styles: { color: '#555', bgColor: '#eff6ff' }, position: { x: 30, y: 830 }, size: { width: 535, height: 40 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 16 },
  { type: 'PROMOTION_STATUS', label: 'Promotion Status', content: { color: '#047857', fontSize: 12 }, styles: { color: '#047857', fontWeight: 'bold' }, position: { x: 30, y: 880 }, size: { width: 535, height: 20 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 17 },
  { type: 'SIGNATURE', label: 'Signatures', content: { showHeadSig: true, showTeacherSig: true }, styles: {}, position: { x: 30, y: 910 }, size: { width: 400, height: 30 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 18 },
  { type: 'QR_CODE', label: 'QR Code', content: {}, styles: {}, position: { x: 500, y: 905 }, size: { width: 50, height: 50 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 19 },
  { type: 'FOOTER', label: 'Footer', content: { text: 'Smart Tech SaaS - Enhanced Professional Report' }, styles: { color: '#999', fontSize: 8 }, position: { x: 30, y: 945 }, size: { width: 535, height: 15 }, settings: {}, isRequired: false, isLocked: false, sortOrder: 20 },
];

@Injectable()
export class ReportTemplateBuilderService {
  constructor(private prisma: PrismaService, private featureLock: FeatureLockService) {}

  async getCategories(schoolId?: string) {
    return this.prisma.templateCategory.findMany({
      where: { ...(schoolId ? { schoolId } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(schoolId: string, data: { name: string; slug: string; description?: string; icon?: string; sortOrder?: number }) {
    return this.prisma.templateCategory.create({
      data: { ...data, schoolId },
    });
  }

  async deleteCategory(schoolId: string, id: string) {
    const cat = await this.prisma.templateCategory.findFirst({ where: { id, schoolId } });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.templateCategory.delete({ where: { id } });
  }

  async getTemplates(schoolId?: string, filters?: { type?: string; status?: string; categoryId?: string }) {
    if (schoolId && (!filters?.type || filters.type === 'REPORT_CARD')) {
      await this.ensureEnhancedProfessionalTemplate(schoolId);
    }
    const where: any = { ...(schoolId ? { schoolId } : {}) };
    if (filters?.type) where.templateType = filters.type;
    if (filters?.status) {
      // Marketplace copies created by older versions were saved as DRAFT;
      // keep them visible to the owning school so they can be personalized.
      where.status = filters.status === 'ACTIVE' && schoolId
        ? { in: ['ACTIVE', 'DRAFT'] }
        : filters.status;
    }
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    return this.prisma.reportTemplate.findMany({
      where,
      include: {
        category: true,
        _count: { select: { components: true, versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async ensureEnhancedProfessionalTemplate(schoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { subscriptionTier: true } });
    const isPremium = String(school?.subscriptionTier || '').toUpperCase() === 'PREMIUM';
    const existing = await this.prisma.reportTemplate.findFirst({
      where: { schoolId, name: 'Enhanced Professional Report Card' },
      include: { _count: { select: { components: true } } },
    });
    if (existing) {
      if (existing._count.components === 0) {
        await this.seedEnhancedProfessionalComponents(existing.id);
      }
      return existing;
    }
    if (isPremium) {
      await this.prisma.reportTemplate.updateMany({
        where: { schoolId, templateType: 'REPORT_CARD', isDefault: true },
        data: { isDefault: false },
      });
    }
    const created = await this.prisma.reportTemplate.create({
      data: {
        schoolId,
        name: 'Enhanced Professional Report Card',
        description: 'Premium professional report card with charts, rankings, attendance, summaries, and narrative insights.',
        templateType: 'REPORT_CARD',
        status: 'PUBLISHED',
        isDefault: isPremium,
        primaryColor: '#1e3a8a',
        secondaryColor: '#eff6ff',
        metadata: { enhancedProfessional: true, premiumOnly: true },
      },
    });
    await this.seedEnhancedProfessionalComponents(created.id);
    return created;
  }

  private async seedEnhancedProfessionalComponents(templateId: string) {
    await this.prisma.templateComponent.deleteMany({ where: { templateId } });
    await this.prisma.templateComponent.createMany({
      data: ENHANCED_PROFESSIONAL_COMPONENTS.map((c) => ({ ...c, templateId })),
    });
  }

  async getClassReportTemplateAssignments(schoolId: string) {
    await this.ensureEnhancedProfessionalTemplate(schoolId);
    return this.prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        reportTemplateId: true,
        reportTemplate: { select: { id: true, name: true, templateType: true, isDefault: true, metadata: true } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async assignClassReportTemplate(schoolId: string, classId: string, templateId: string | null) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!cls) throw new NotFoundException('Class not found');
    if (templateId) {
      const template = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId, templateType: 'REPORT_CARD' } });
      if (!template) throw new NotFoundException('Report card template not found');
      await this.assertEnhancedTemplateAccess(schoolId, template);
    }
    return this.prisma.class.update({
      where: { id: classId },
      data: { reportTemplateId: templateId },
      select: { id: true, name: true, reportTemplateId: true, reportTemplate: { select: { id: true, name: true, metadata: true } } },
    });
  }

  async setTemplateDefault(schoolId: string, templateId: string, isDefault: boolean) {
    const template = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId, templateType: 'REPORT_CARD' } });
    if (!template) throw new NotFoundException('Report card template not found');
    await this.assertEnhancedTemplateAccess(schoolId, template);
    if (isDefault) {
      await this.prisma.reportTemplate.updateMany({ where: { schoolId, templateType: 'REPORT_CARD', id: { not: templateId } }, data: { isDefault: false } });
    }
    return this.prisma.reportTemplate.update({ where: { id: templateId }, data: { isDefault } });
  }

  private async assertEnhancedTemplateAccess(schoolId: string, template: { metadata: any }) {
    if ((template.metadata as any)?.enhancedProfessional) {
      const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { subscriptionTier: true } });
      if (String(school?.subscriptionTier || '').toUpperCase() !== 'PREMIUM') {
        throw new BadRequestException('Enhanced report templates require a Premium subscription');
      }
      const access = await this.featureLock.checkAccess(schoolId, 'results.enhancedReportTemplate');
      if (!access.hasAccess) throw new BadRequestException(access.reason || 'Enhanced report templates require a Premium subscription');
    }
  }

  async getTemplate(id: string, schoolId?: string) {
    let t = await this.prisma.reportTemplate.findFirst({
      where: { id, ...(schoolId ? { schoolId } : {}) },
      include: {
        category: true,
        components: { orderBy: { sortOrder: 'asc' }, include: { children: { orderBy: { sortOrder: 'asc' } } } },
        certificate: true,
        versions: { orderBy: { version: 'desc' }, take: 10 },
      },
    });
    if (!t && schoolId) {
      t = await this.prisma.reportTemplate.findFirst({
        where: { id, isDefault: true },
        include: {
          category: true,
          components: { orderBy: { sortOrder: 'asc' }, include: { children: { orderBy: { sortOrder: 'asc' } } } },
          certificate: true,
          versions: { orderBy: { version: 'desc' }, take: 10 },
        },
      });
    }
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async createTemplate(schoolId: string, data: {
    name: string;
    templateType?: ReportTemplateType;
    categoryId?: string;
    pageSize?: string;
    orientation?: string;
    fontFamily?: string;
    fontSize?: number;
    primaryColor?: string;
    secondaryColor?: string;
    isDefault?: boolean;
  }) {
    if (data.isDefault) {
      await this.prisma.reportTemplate.updateMany({
        where: { schoolId, isDefault: true },
        data: { isDefault: false },
      });
    }
    // Components may arrive inline (nested create); never spread raw arrays into the relation.
    const { components, ...templateFields } = data as any;
    return this.prisma.reportTemplate.create({
      data: {
        ...templateFields,
        schoolId,
        ...(Array.isArray(components) ? { components: { create: components } } : {}),
      } as any,
    });
  }

  async updateTemplate(schoolId: string, id: string, data: any) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id, schoolId } });
    if (!t) throw new NotFoundException('Template not found');

    if (data.isDefault && !t.isDefault) {
      await this.prisma.reportTemplate.updateMany({
        where: { schoolId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const { components, ...templateFields } = data as any;
    return this.prisma.reportTemplate.update({
      where: { id },
      data: {
        ...templateFields,
        ...(Array.isArray(components) ? { components: { create: components } } : {}),
      } as any,
    });
  }

  async deleteTemplate(schoolId: string, id: string) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id, schoolId } });
    if (!t) throw new NotFoundException('Template not found');
    if (t.isDefault) throw new BadRequestException('Cannot delete default template');
    return this.prisma.reportTemplate.delete({ where: { id } });
  }

  async duplicateTemplate(schoolId: string, id: string) {
    const original = await this.prisma.reportTemplate.findFirst({
      where: { id, schoolId },
      include: { components: true, certificate: true },
    });
    if (!original) throw new NotFoundException('Template not found');

    const copy = await this.prisma.reportTemplate.create({
      data: {
        name: `${original.name} (Copy)`,
        schoolId,
        templateType: original.templateType,
        pageSize: original.pageSize,
        orientation: original.orientation,
        fontFamily: original.fontFamily,
        fontSize: original.fontSize,
        primaryColor: original.primaryColor,
        secondaryColor: original.secondaryColor,
        colorPalette: original.colorPalette,
        layoutJson: original.layoutJson,
        status: 'DRAFT' as TemplateStatus,
        version: 1,
        categoryId: original.categoryId,
        marginTop: original.marginTop,
        marginBottom: original.marginBottom,
        marginLeft: original.marginLeft,
        marginRight: original.marginRight,
        headerText: original.headerText,
        footerText: original.footerText,
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
          sealUrl: cert.sealUrl,
          showQrCode: cert.showQrCode,
          autoNumbering: cert.autoNumbering,
          nextNumber: 1,
          showPhoto: cert.showPhoto,
          signature1Label: cert.signature1Label,
          signature1Name: cert.signature1Name,
          signature1Title: cert.signature1Title,
          signature2Label: cert.signature2Label,
          signature2Name: cert.signature2Name,
          signature2Title: cert.signature2Title,
          awardText: cert.awardText,
          showBadge: cert.showBadge,
          badgeStyle: cert.badgeStyle,
          showWatermark: cert.showWatermark,
          watermarkText: cert.watermarkText,
        },
      });
    }

    return copy;
  }

  async publishTemplate(schoolId: string, id: string) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id, schoolId } });
    if (!t) throw new NotFoundException('Template not found');
    return this.prisma.reportTemplate.update({
      where: { id },
      data: {
        status: 'PUBLISHED' as TemplateStatus,
        version: { increment: 1 },
      },
    });
  }

  async archiveTemplate(schoolId: string, id: string) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id, schoolId } });
    if (!t) throw new NotFoundException('Template not found');
    return this.prisma.reportTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED' as TemplateStatus },
    });
  }

  async saveLayout(schoolId: string, id: string, layoutJson: any) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id, schoolId } });
    if (!t) throw new NotFoundException('Template not found');
    return this.prisma.reportTemplate.update({
      where: { id },
      data: { layoutJson: layoutJson as any },
    });
  }

  async addComponent(schoolId: string, templateId: string, data: {
    type: ComponentType;
    label: string;
    content?: any;
    styles?: any;
    position?: any;
    size?: any;
    settings?: any;
    placeholder?: string;
    parentId?: string;
  }) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');

    const maxOrder = await this.prisma.templateComponent.findFirst({
      where: { templateId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.prisma.templateComponent.create({
      data: {
        templateId,
        type: data.type,
        label: data.label,
        content: (data.content || {}) as any,
        styles: (data.styles || {}) as any,
        position: (data.position || {}) as any,
        size: (data.size || {}) as any,
        settings: (data.settings || {}) as any,
        placeholder: data.placeholder,
        parentId: data.parentId,
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateComponent(schoolId: string, templateId: string, componentId: string, data: any) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');

    const c = await this.prisma.templateComponent.findFirst({ where: { id: componentId, templateId } });
    if (!c) throw new NotFoundException('Component not found');

    return this.prisma.templateComponent.update({
      where: { id: componentId },
      data,
    });
  }

  async deleteComponent(schoolId: string, templateId: string, componentId: string) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');
    return this.prisma.templateComponent.delete({ where: { id: componentId } });
  }

  async reorderComponents(schoolId: string, templateId: string, order: { id: string; sortOrder: number }[]) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');

    for (const item of order) {
      await this.prisma.templateComponent.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      });
    }

    return { success: true };
  }

  async getAssets(schoolId?: string, type?: string) {
    const where: any = { ...(schoolId ? { schoolId } : {}) };
    if (type) where.type = type;
    return this.prisma.templateAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAsset(schoolId: string, data: { name: string; type: string; url: string; size?: number; metadata?: any }) {
    return this.prisma.templateAsset.create({
      data: { ...data, schoolId },
    });
  }

  async deleteAsset(schoolId: string, id: string) {
    const a = await this.prisma.templateAsset.findFirst({ where: { id, schoolId } });
    if (!a) throw new NotFoundException('Asset not found');
    return this.prisma.templateAsset.delete({ where: { id } });
  }

  async getStats() {
    const [totalTemplates, totalMarketplace, totalAssets, totalSignatures, totalStamps, totalBrandPresets, totalCertificates, totalAISuggestions] = await Promise.all([
      this.prisma.reportTemplate.count(),
      this.prisma.templateMarketplace.count(),
      this.prisma.templateAsset.count(),
      this.prisma.digitalSignature.count(),
      this.prisma.digitalStamp.count(),
      this.prisma.brandPreset.count(),
      this.prisma.certificateTemplate.count(),
      this.prisma.aITemplateSuggestion.count(),
    ]);
    return { totalTemplates, totalMarketplace, totalAssets, totalSignatures, totalStamps, totalBrandPresets, totalCertificates, totalAISuggestions };
  }

  async getAvailableComponents() {
    return [
      { type: 'TEXT_BLOCK', label: 'Text Block', icon: 'Type', category: 'text' },
      { type: 'HEADING', label: 'Heading', icon: 'Heading', category: 'text' },
      { type: 'PARAGRAPH', label: 'Paragraph', icon: 'FileText', category: 'text' },
      { type: 'DIVIDER', label: 'Divider', icon: 'Minus', category: 'layout' },
      { type: 'SPACER', label: 'Spacer', icon: 'Expand', category: 'layout' },
      { type: 'IMAGE', label: 'Image', icon: 'Image', category: 'media' },
      { type: 'SCHOOL_LOGO', label: 'School Logo', icon: 'Building2', category: 'school' },
      { type: 'SCHOOL_NAME', label: 'School Name', icon: 'Building2', category: 'school' },
      { type: 'SCHOOL_INFO', label: 'School Info', icon: 'Info', category: 'school' },
      { type: 'STUDENT_NAME', label: 'Student Name', icon: 'User', category: 'student' },
      { type: 'STUDENT_PHOTO', label: 'Student Photo', icon: 'Camera', category: 'student' },
      { type: 'STUDENT_INFO', label: 'Student Info', icon: 'UserCircle', category: 'student' },
      { type: 'STUDENT_PROFILE_CARD', label: 'Profile Card', icon: 'IdCard', category: 'student' },
      { type: 'CLASS_NAME', label: 'Class Name', icon: 'Users', category: 'academic' },
      { type: 'TERM_INFO', label: 'Term Info', icon: 'Calendar', category: 'academic' },
      { type: 'RESULTS_TABLE', label: 'Results Table', icon: 'Table', category: 'data' },
      { type: 'SUBJECT_TABLE', label: 'Subject Table', icon: 'BookOpen', category: 'data' },
      { type: 'GRADE_TABLE', label: 'Grade Table', icon: 'Award', category: 'data' },
      { type: 'ATTENDANCE_TABLE', label: 'Attendance Table', icon: 'ClipboardCheck', category: 'data' },
      { type: 'RANKING_TABLE', label: 'Ranking Table', icon: 'Trophy', category: 'analytics' },
      { type: 'PERFORMANCE_CHART', label: 'Performance Chart', icon: 'BarChart3', category: 'analytics' },
      { type: 'RADAR_CHART', label: 'Radar Chart', icon: 'Radar', category: 'analytics' },
      { type: 'BAR_CHART', label: 'Bar Chart', icon: 'BarChart', category: 'analytics' },
      { type: 'LINE_CHART', label: 'Line Chart', icon: 'TrendingUp', category: 'analytics' },
      { type: 'HEATMAP', label: 'Heatmap', icon: 'Grid3x3', category: 'analytics' },
      { type: 'DISTRIBUTION_CURVE', label: 'Distribution Curve', icon: 'ChartLine', category: 'analytics' },
      { type: 'COMPETENCY_HEATMAP', label: 'Competency Heatmap', icon: 'Brain', category: 'analytics' },
      { type: 'ATTENDANCE_CHART', label: 'Attendance Chart', icon: 'PieChart', category: 'analytics' },
      { type: 'ANALYTICS_SUMMARY', label: 'Analytics Summary', icon: 'BarChart4', category: 'analytics' },
      { type: 'TEACHER_REMARKS', label: 'Teacher Remarks', icon: 'MessageSquare', category: 'remarks' },
      { type: 'HEAD_TEACHER_REMARKS', label: 'Head Teacher Remarks', icon: 'MessageSquare', category: 'remarks' },
      { type: 'PROMOTION_STATUS', label: 'Promotion Status', icon: 'ArrowUp', category: 'official' },
      { type: 'BORDER', label: 'Border', icon: 'BorderAll', category: 'layout' },
      { type: 'AI_NARRATIVE', label: 'AI Narrative', icon: 'BrainCircuit', category: 'remarks' },
      { type: 'RECOMMENDATIONS', label: 'Recommendations', icon: 'Lightbulb', category: 'remarks' },
      { type: 'STRENGTHS_WEAKNESSES', label: 'Strengths & Weaknesses', icon: 'Target', category: 'remarks' },
      { type: 'SIGNATURE', label: 'Signature', icon: 'PenTool', category: 'official' },
      { type: 'STAMP', label: 'Stamp', icon: 'Stamp', category: 'official' },
      { type: 'SEAL', label: 'Seal', icon: 'CircleDot', category: 'official' },
      { type: 'QR_CODE', label: 'QR Code', icon: 'QrCode', category: 'verification' },
      { type: 'BADGE', label: 'Badge', icon: 'Medal', category: 'awards' },
      { type: 'AWARD_TEXT', label: 'Award Text', icon: 'ScrollText', category: 'awards' },
      { type: 'HEADER', label: 'Header', icon: 'AlignStartVertical', category: 'layout' },
      { type: 'FOOTER', label: 'Footer', icon: 'AlignEndVertical', category: 'layout' },
      { type: 'PAGE_NUMBER', label: 'Page Number', icon: 'Hash', category: 'layout' },
      { type: 'WATERMARK', label: 'Watermark', icon: 'Droplets', category: 'layout' },
      { type: 'DYNAMIC_PLACEHOLDER', label: 'Dynamic Placeholder', icon: 'Variable', category: 'advanced' },
      { type: 'CUSTOM_TEXT', label: 'Custom Text', icon: 'Pencil', category: 'text' },
      { type: 'TABLE', label: 'Table', icon: 'Grid', category: 'data' },
    ];
  }
}
