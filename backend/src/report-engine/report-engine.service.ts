import { Injectable, Logger, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportCardEngineService } from '../report-card-engine/report-card-engine.service';
import { ReportCardService } from '../report-card/report-card.service';
import { TemplateRendererService } from '../report-template-builder/template-renderer.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RankingService } from '../ranking-service/ranking.service';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';

export enum ReportType {
  REPORT_CARD = 'REPORT_CARD',
  CLASS_REPORT = 'CLASS_REPORT',
  TRANSCRIPT = 'TRANSCRIPT',
  CERTIFICATE = 'CERTIFICATE',
  ATTENDANCE_REPORT = 'ATTENDANCE_REPORT',
  ANALYTICS_SUMMARY = 'ANALYTICS_SUMMARY',
  MARK_SCHEDULE = 'MARK_SCHEDULE',
  PERFORMANCE_REPORT = 'PERFORMANCE_REPORT',
}

export interface ReportGenerationRequest {
  type: ReportType;
  schoolId: string;
  studentId?: string;
  classId?: string;
  termId?: string;
  templateId?: string;
  options?: Record<string, any>;
}

export interface ReportGenerationResult {
  id: string;
  type: ReportType;
  schoolId: string;
  studentId?: string;
  classId?: string;
  termId?: string;
  templateId?: string;
  pdfUrl: string | null;
  publicId: string | null;
  fileName: string;
  title: string;
  metadata: Record<string, any>;
  generatedAt: Date;
}

const REPORT_TYPE_CONFIG: Record<ReportType, {
  label: string;
  description: string;
  icon: string;
  requiredFields: string[];
  optionalFields: string[];
  supportsBulk: boolean;
}> = {
  [ReportType.REPORT_CARD]: {
    label: 'Individual Report Card',
    description: 'Enhanced report card for a single student with charts and analysis',
    icon: '📄',
    requiredFields: ['studentId', 'termId'],
    optionalFields: ['templateId'],
    supportsBulk: false,
  },
  [ReportType.CLASS_REPORT]: {
    label: 'Class Report Cards',
    description: 'All report cards for a class as a combined PDF',
    icon: '📋',
    requiredFields: ['classId', 'termId'],
    optionalFields: ['templateId'],
    supportsBulk: true,
  },
  [ReportType.TRANSCRIPT]: {
    label: 'Academic Transcript',
    description: 'Full academic transcript for a student',
    icon: '📜',
    requiredFields: ['studentId'],
    optionalFields: [],
    supportsBulk: false,
  },
  [ReportType.CERTIFICATE]: {
    label: 'Certificate',
    description: 'Achievement, merit, or graduation certificate',
    icon: '🏆',
    requiredFields: ['studentId', 'termId'],
    optionalFields: ['templateId'],
    supportsBulk: false,
  },
  [ReportType.ATTENDANCE_REPORT]: {
    label: 'Attendance Report',
    description: 'Attendance summary for a student or class',
    icon: '📅',
    requiredFields: ['termId'],
    optionalFields: ['studentId', 'classId'],
    supportsBulk: true,
  },
  [ReportType.ANALYTICS_SUMMARY]: {
    label: 'Analytics Summary',
    description: 'Class or school performance analytics report',
    icon: '📊',
    requiredFields: ['termId'],
    optionalFields: ['classId'],
    supportsBulk: true,
  },
  [ReportType.MARK_SCHEDULE]: {
    label: 'Mark Schedule',
    description: 'Subject-wise mark schedule for a class',
    icon: '📝',
    requiredFields: ['classId', 'termId'],
    optionalFields: [],
    supportsBulk: true,
  },
  [ReportType.PERFORMANCE_REPORT]: {
    label: 'Performance Report',
    description: 'Detailed student performance profile with comparisons',
    icon: '📈',
    requiredFields: ['studentId', 'termId'],
    optionalFields: [],
    supportsBulk: false,
  },
};

@Injectable()
export class ReportEngineService {
  private readonly logger = new Logger(ReportEngineService.name);
  private readonly pdfBuffers = new Map<string, Buffer>();

  constructor(
    private prisma: PrismaService,
    private reportCardEngine: ReportCardEngineService,
    private reportCardService: ReportCardService,
    private templateRenderer: TemplateRendererService,
    private analyticsService: AnalyticsService,
    private rankingService: RankingService,
    private gradingEngine: GradingEngineService,
    private cloudinary: CloudinaryService,
    @Optional() private schoolEvents?: SchoolEventsGateway,
  ) {}

  getReportTypes() {
    return Object.entries(REPORT_TYPE_CONFIG).map(([key, config]) => ({
      type: key as ReportType,
      ...config,
    }));
  }

  async hasPublishedResults(studentId: string, termId: string, schoolId: string): Promise<boolean> {
    // Consider a term published when the school locked it, when computed results
    // exist in any computed state (COMPUTED/VERIFIED/PUBLISHED/LOCKED), or when
    // legacy/excel-imported Result rows exist for this student+term. The report
    // card engine renders all of these sources, so the gate must match.
    const [computedCount, legacyCount, term] = await Promise.all([
      this.prisma.computedResult.count({
        where: {
          studentId,
          termId,
          schoolId,
          status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        },
      }),
      this.prisma.result.count({
        where: { studentId, termId, schoolId },
      }),
      this.prisma.term.findUnique({
        where: { id: termId },
        select: { resultsLocked: true },
      }),
    ]);
    return computedCount > 0 || legacyCount > 0 || term?.resultsLocked === true;
  }

  async validateGenerationRequest(request: ReportGenerationRequest): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const config = REPORT_TYPE_CONFIG[request.type];

    if (!config) {
      throw new BadRequestException(`Unknown report type: ${request.type}`);
    }

    // Validate required fields
    for (const field of config.requiredFields) {
      if (!request[field as keyof ReportGenerationRequest]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate school exists
    const school = await this.prisma.school.findUnique({ where: { id: request.schoolId } });
    if (!school) {
      errors.push('School not found');
    }

    // Validate student if provided
    if (request.studentId) {
      const student = await this.prisma.student.findUnique({ where: { id: request.studentId } });
      if (!student) {
        errors.push('Student not found');
      } else if (student.schoolId !== request.schoolId) {
        errors.push('Student does not belong to this school');
      }
    }

    // Validate class if provided
    if (request.classId) {
      const cls = await this.prisma.class.findUnique({ where: { id: request.classId } });
      if (!cls) {
        errors.push('Class not found');
      } else if (cls.schoolId !== request.schoolId) {
        errors.push('Class does not belong to this school');
      }
    }

    // Validate term if provided
    if (request.termId) {
      const term = await this.prisma.term.findUnique({
        where: { id: request.termId },
        include: { academicYear: true },
      });
      if (!term) {
        errors.push('Term not found');
      } else if (term.academicYear.schoolId !== request.schoolId) {
        errors.push('Term does not belong to this school');
      }
    }

    // Validate template if provided
    if (request.templateId) {
      const template = await this.prisma.reportTemplate.findFirst({
        where: { id: request.templateId, schoolId: request.schoolId },
      });
      if (!template) {
        errors.push('Template not found');
      }
    }

    // Type-specific validations
    if (request.type === ReportType.REPORT_CARD || request.type === ReportType.PERFORMANCE_REPORT) {
      if (request.studentId && request.termId) {
        const computedResults = await this.prisma.computedResult.findMany({
          where: {
            studentId: request.studentId,
            termId: request.termId,
            status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
            student: { status: 'ACTIVE' },
          },
        });
        if (computedResults.length === 0) {
          warnings.push('No computed results found for this student in this term');
        }
      }
    }

    if (request.type === ReportType.CLASS_REPORT && request.classId && request.termId) {
      const status = await this.reportCardEngine.getReportCardStatus(
        request.classId, request.termId, request.schoolId,
      );
      if (!status.readyForPublication) {
        warnings.push(
          `Only ${status.completionRate.toFixed(0)}% of students have completed report cards ` +
          `(${status.studentsWithSummary}/${status.totalStudents})`,
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async generateReport(request: ReportGenerationRequest): Promise<ReportGenerationResult> {
    const validation = await this.validateGenerationRequest(request);
    if (!validation.valid) {
      throw new BadRequestException(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const startTime = Date.now();
    let result: { buffer: Buffer; url: string | null; publicId: string | null };
    let fileName: string;
    let metadata: Record<string, any> = {};

    switch (request.type) {
      case ReportType.REPORT_CARD:
        result = await this.generateReportCard(request);
        fileName = `report-card-${request.studentId}-${request.termId}.pdf`;
        break;

      case ReportType.CLASS_REPORT:
        result = await this.generateClassReport(request);
        fileName = `class-report-cards-${request.classId}-${request.termId}.pdf`;
        break;

      case ReportType.TRANSCRIPT:
        result = await this.generateTranscript(request);
        fileName = `transcript-${request.studentId}.pdf`;
        break;

      case ReportType.CERTIFICATE:
        result = await this.generateCertificate(request);
        fileName = `certificate-${request.studentId}-${request.termId}.pdf`;
        break;

      case ReportType.ATTENDANCE_REPORT:
        result = await this.generateAttendanceReport(request);
        fileName = `attendance-report-${request.termId}.pdf`;
        break;

      case ReportType.ANALYTICS_SUMMARY:
        result = await this.generateAnalyticsReport(request);
        fileName = `analytics-report-${request.termId}.pdf`;
        break;

      case ReportType.MARK_SCHEDULE:
        result = await this.generateMarkSchedule(request);
        fileName = `mark-schedule-${request.classId}-${request.termId}.pdf`;
        break;

      case ReportType.PERFORMANCE_REPORT:
        // Performance reports use the same complete report-card presentation,
        // including the student summary and performance charts.
        result = await this.generateReportCard(request);
        fileName = `performance-report-${request.studentId}-${request.termId}.pdf`;
        break;

      default:
        throw new BadRequestException(`Unsupported report type: ${request.type}`);
    }

    const elapsed = Date.now() - startTime;
    metadata.generationTimeMs = elapsed;
    metadata.warnings = validation.warnings;

    const title = this.buildReportTitle(request.type, request);

    let persistedId: string | null = null;
    try {
      const student = request.studentId
        ? await this.prisma.student.findUnique({ where: { id: request.studentId }, select: { firstName: true, lastName: true, admissionNumber: true } })
        : null;
      const cls = request.classId
        ? await this.prisma.class.findUnique({ where: { id: request.classId }, select: { name: true } })
        : null;

      const saved = await this.prisma.generatedReport.create({
        data: {
          schoolId: request.schoolId,
          reportType: request.type,
          title,
          studentId: request.studentId || null,
          className: cls?.name || null,
          classId: request.classId || null,
          termId: request.termId || null,
          fileName,
          fileUrl: result.url,
          templateId: request.templateId || null,
          generatedById: request.options?.userId || 'system',
          generatedByName: request.options?.userName || 'System',
          status: result.url ? 'COMPLETED' : 'FAILED',
          metadata: metadata as any,
        },
      });
      persistedId = saved.id;
    } catch (err) {
      this.logger.warn(`Failed to persist report metadata: ${err.message}`);
    }

    const report: ReportGenerationResult = {
      id: persistedId || `report-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type: request.type,
      schoolId: request.schoolId,
      studentId: request.studentId,
      classId: request.classId,
      termId: request.termId,
      templateId: request.templateId,
      pdfUrl: result.url,
      publicId: result.publicId,
      fileName,
      title,
      metadata,
      generatedAt: new Date(),
    };

    this.logger.log(
      `Generated ${request.type} report in ${elapsed}ms for school ${request.schoolId}` +
      (request.studentId ? ` student ${request.studentId}` : '') +
      (request.classId ? ` class ${request.classId}` : ''),
    );

    // Cache the PDF buffer for direct download (avoids Cloudinary round-trip corruption)
    if (result.buffer) {
      const cacheKey = `${request.schoolId}_${request.studentId || ''}_${request.classId || ''}_${request.termId || ''}_${request.type}_${Date.now()}`;
      this.pdfBuffers.set(cacheKey, result.buffer);
      // Auto-evict after 30 minutes
      setTimeout(() => this.pdfBuffers.delete(cacheKey), 30 * 60 * 1000);
      (report as any)._bufferKey = cacheKey;
    }

    return report;
  }

  async generateBulkReports(
    request: Omit<ReportGenerationRequest, 'studentId'> & { studentIds?: string[] },
  ): Promise<ReportGenerationResult[]> {
    const reports: ReportGenerationResult[] = [];

    if (request.type === ReportType.CLASS_REPORT && request.classId && request.termId) {
      // Generate ONE combined class PDF (single Puppeteer render) instead of
      // launching a browser per student — this is what made bulk generation time out.
      try {
        const report = await this.generateReport({
          ...request,
          type: ReportType.CLASS_REPORT,
        });
        reports.push(report);
        return reports;
      } catch (error) {
        this.logger.error(`Failed to generate combined class report: ${error.message}`);
        return reports;
      }
    }

    if (
      request.type === ReportType.ATTENDANCE_REPORT ||
      request.type === ReportType.ANALYTICS_SUMMARY ||
      request.type === ReportType.MARK_SCHEDULE
    ) {
      // These types generate a single report per class/school
      try {
        const report = await this.generateReport(request);
        reports.push(report);
      } catch (error) {
        this.logger.error(`Failed to generate bulk ${request.type}: ${error.message}`);
      }
      return reports;
    }

    // Per-student bulk types (TRANSCRIPT, CERTIFICATE, PERFORMANCE_REPORT) — run
    // with limited concurrency so large batches don't blow the request timeout.
    const studentIds = request.studentIds?.length
      ? request.studentIds
      : request.classId && request.termId
        ? (await this.prisma.enrollment.findMany({
            where: { classId: request.classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
            select: { studentId: true },
          })).map(e => e.studentId)
        : [];

    let index = 0;
    const worker = async () => {
      while (index < studentIds.length) {
        const studentId = studentIds[index++];
        try {
          const report = await this.generateReport({
            ...request,
            studentId,
          });
          reports.push(report);
        } catch (error) {
          this.logger.error(
            `Failed to generate ${request.type} for student ${studentId}: ${error.message}`,
          );
        }
      }
    };

    const workers = Array.from({ length: Math.min(3, studentIds.length || 1) }, worker);
    await Promise.all(workers);
    return reports;
  }

  async downloadPdf(reportUrl: string): Promise<Buffer> {
    const response = await fetch(reportUrl);
    if (!response.ok) {
      throw new BadRequestException('Failed to download PDF');
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  getCachedPdfBuffer(bufferKey: string): Buffer | null {
    return this.pdfBuffers.get(bufferKey) || null;
  }

  async listReports(
    schoolId: string,
    filters: {
      reportType?: ReportType;
      classId?: string;
      studentId?: string;
      termId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { schoolId };
    if (filters.reportType) where.reportType = filters.reportType;
    if (filters.classId) where.classId = filters.classId;
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.termId) where.termId = filters.termId;
    if (filters.status) where.status = filters.status;

    const [reports, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.generatedReport.count({ where }),
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReportById(id: string, schoolId: string) {
    const report = await this.prisma.generatedReport.findFirst({
      where: { id, schoolId },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }

  async deleteReport(id: string, schoolId: string) {
    const report = await this.prisma.generatedReport.findFirst({
      where: { id, schoolId },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    await this.prisma.generatedReport.delete({ where: { id } });
    return { deleted: true };
  }

  private buildReportTitle(type: ReportType, request: ReportGenerationRequest): string {
    const config = REPORT_TYPE_CONFIG[type];
    const parts: string[] = [config.label];
    if (request.studentId) parts.push(`Student ${request.studentId}`);
    if (request.classId) parts.push(`Class ${request.classId}`);
    if (request.termId) parts.push(`Term ${request.termId}`);
    return parts.join(' — ');
  }

  private async generateReportCard(request: ReportGenerationRequest) {
    const studentId = request.studentId!;
    const termId = request.termId!;
    const schoolId = request.schoolId;

    const rendered = await this.renderReportCardWithTemplate(request);
    if (rendered) {
      return this.templateRenderer.renderPdfFromHtml(schoolId, rendered.templateId, rendered.html);
    }

    // Last resort: use the curriculum report card pipeline
    return this.reportCardService.generateCurriculumReportCardPdf(schoolId, studentId, termId);
  }

  /**
   * Renders the professional report card HTML using the school's template
   * (explicit -> default -> any template with components). Returns null when
   * no template with components is configured so callers can fall back to the
   * basic curriculum pipeline.
   */
  private async renderReportCardWithTemplate(request: ReportGenerationRequest): Promise<{
    html: string;
    templateId: string;
    engineData: any;
  } | null> {
    const studentId = request.studentId!;
    const termId = request.termId!;
    const schoolId = request.schoolId;

    // Resolve template: explicit -> school default -> any template with components.
    // This guarantees report cards always render with the school's professional
    // Web Platform template rather than silently falling back to the basic
    // curriculum pipeline.
    let template = request.templateId
      ? await this.prisma.reportTemplate.findFirst({
          where: { id: request.templateId, schoolId },
          include: { components: true },
        })
      : null;

    if (!template) {
      template = await this.prisma.reportTemplate.findFirst({
        where: { schoolId, isDefault: true },
        include: { components: true },
      });
    }

    if (!template || !template.components || template.components.length === 0) {
      template = await this.prisma.reportTemplate.findFirst({
        where: { schoolId, components: { some: {} } },
        include: { components: true },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!template || !template.components || template.components.length === 0) {
      return null;
    }

    request.templateId = template.id;
    const engineData = await this.reportCardEngine.generateReportCardData(
      studentId, termId, schoolId,
    );
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const html = await this.templateRenderer.renderPreview(schoolId, template.id, {
      ...engineData,
      schoolName: school?.name,
      schoolLogo: school?.logoUrl || school?.logo,
      subjects: engineData.subjectBreakdown?.map((s: any) => ({
        subject: s.subjectName,
        score: s.finalPercentage,
        grade: s.finalGrade,
        points: s.points,
        remark: s.finalRemark,
      })) || [],
      summary: {
        totalMarks: engineData.subjectBreakdown?.reduce((sum: number, s: any) => sum + (s.totalRawScore || 0), 0) || 0,
        average: engineData.bestSubjectsAverage || 0,
        totalPoints: engineData.totalPoints || 0,
        positionInClass: engineData.termSummary?.classRank || 0,
        totalStudents: engineData.termSummary?.classSize || 0,
        bestSixTotal: engineData.totalPoints || 0,
        eligibleForUniversity: 'YES',
      },
    });
    return { html, templateId: template.id, engineData };
  }

  /**
   * Generates the professional report card HTML for in-platform viewing
   * ("View Report Card"). Uses the school template when available, otherwise
   * renders a complete standalone report card from the report card engine data.
   */
  async previewReportCardHtml(request: ReportGenerationRequest): Promise<{ html: string; data: any }> {
    const rendered = await this.renderReportCardWithTemplate(request);
    if (rendered) {
      return { html: rendered.html, data: rendered.engineData };
    }

    const studentId = request.studentId!;
    const termId = request.termId!;
    const schoolId = request.schoolId;
    const engineData = await this.reportCardEngine.generateReportCardData(studentId, termId, schoolId);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const html = this.buildFallbackReportCardHtml(engineData, school);
    return { html, data: engineData };
  }

  private buildFallbackReportCardHtml(engineData: any, school: any): string {
    const subjects = engineData?.subjectBreakdown || [];
    const summary = engineData?.termSummary || {};
    const student = engineData?.student || {};
    const cls = engineData?.class || {};
    const term = engineData?.term || {};
    const attendance = engineData?.attendance || {};

    const subjectRows = subjects.map((s: any, i: number) =>
      `<tr style="background:${i % 2 === 0 ? 'white' : '#f8fafc'};">
        <td style="padding:7px 8px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;">${s.subjectName || ''}</td>
        <td style="padding:7px 8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;font-weight:bold;">${s.finalPercentage != null ? s.finalPercentage.toFixed(1) + '%' : ''}</td>
        <td style="padding:7px 8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;">${s.finalGrade || ''}</td>
        <td style="padding:7px 8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;">${s.points != null ? s.points : ''}</td>
        <td style="padding:7px 8px;border:1px solid #e5e7eb;font-size:10px;color:#555;">${s.finalRemark || ''}</td>
      </tr>`
    ).join('');

    const strengths = Array.isArray(summary.strengths) && summary.strengths.length
      ? `<ul style="margin:4px 0;padding-left:18px;">${summary.strengths.map((x: string) => `<li style="font-size:11px;color:#166534;">${x}</li>`).join('')}</ul>`
      : '';
    const weaknesses = Array.isArray(summary.weaknesses) && summary.weaknesses.length
      ? `<ul style="margin:4px 0;padding-left:18px;">${summary.weaknesses.map((x: string) => `<li style="font-size:11px;color:#b91c1c;">${x}</li>`).join('')}</ul>`
      : '';

    const stat = (label: string, value: string, bg: string, color: string) =>
      `<div style="flex:1;min-width:110px;background:${bg};padding:10px;border-radius:8px;text-align:center;">
        <div style="font-size:20px;font-weight:bold;color:${color};">${value}</div>
        <div style="font-size:10px;color:#666;font-weight:600;">${label}</div>
      </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Report Card</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111827; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { page-break-inside: avoid; width: 100%; border-collapse: collapse; }
  @media print { body { margin: 0; padding: 0; } }
</style>
</head>
<body>
  <div style="text-align:center;border-bottom:2px solid #1a365d;padding-bottom:12px;margin-bottom:18px;">
    ${school?.logoUrl ? `<img src="${school.logoUrl}" alt="School Logo" style="height:54px;margin-bottom:6px;"/>` : ''}
    <div style="font-size:24px;font-weight:bold;color:#1a365d;">${school?.name || 'School'}</div>
    <div style="font-size:14px;color:#374151;margin-top:3px;">Academic Report Card — ${term?.name || ''} (${engineData?.academicYear?.name || ''})</div>
  </div>

  <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:16px;">
    <div style="font-size:12px;line-height:1.7;">
      <div><strong>Student:</strong> ${student?.firstName || ''} ${student?.lastName || ''}</div>
      <div><strong>Admission No:</strong> ${student?.admissionNumber || ''}</div>
      <div><strong>Class:</strong> ${cls?.name || ''}</div>
    </div>
    <div style="text-align:right;font-size:12px;line-height:1.7;">
      <div><strong>Term:</strong> ${term?.name || ''}</div>
      <div><strong>Year:</strong> ${engineData?.academicYear?.name || ''}</div>
      <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
    </div>
  </div>

  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;">
    ${stat('Average', summary.overallPercentage != null ? summary.overallPercentage.toFixed(1) + '%' : '—', '#eff6ff', '#2563eb')}
    ${stat('GPA', summary.gpa != null ? summary.gpa : '—', '#f0fdf4', '#16a34a')}
    ${stat('Total Points', summary.totalPoints != null ? String(summary.totalPoints) : '—', '#fefce8', '#ca8a04')}
    ${stat('Position', summary.classRank != null ? '#' + summary.classRank + ' of ' + (summary.classSize || '—') : '—', '#f5f3ff', '#7c3aed')}
    ${stat('Attendance', attendance.attendanceRate != null ? attendance.attendanceRate + '%' : '—', '#fff7ed', '#ea580c')}
  </div>

  <table>
    <thead>
      <tr style="background:#1a365d;color:white;">
        <th style="padding:8px;border:1px solid #1a365d;text-align:left;font-size:11px;">Subject</th>
        <th style="padding:8px;border:1px solid #1a365d;text-align:center;font-size:11px;">Score</th>
        <th style="padding:8px;border:1px solid #1a365d;text-align:center;font-size:11px;">Grade</th>
        <th style="padding:8px;border:1px solid #1a365d;text-align:center;font-size:11px;">Points</th>
        <th style="padding:8px;border:1px solid #1a365d;text-align:left;font-size:11px;">Remark</th>
      </tr>
    </thead>
    <tbody>${subjectRows || '<tr><td colspan="5" style="padding:10px;border:1px solid #e5e7eb;text-align:center;font-size:12px;">No subject results available.</td></tr>'}</tbody>
  </table>

  ${strengths || weaknesses ? `<div style="margin-top:18px;display:flex;gap:24px;">
    ${strengths ? `<div style="flex:1;background:#f0fdf4;padding:10px;border-radius:8px;"><strong style="font-size:12px;color:#15803d;">Strengths</strong>${strengths}</div>` : ''}
    ${weaknesses ? `<div style="flex:1;background:#fef2f2;padding:10px;border-radius:8px;"><strong style="font-size:12px;color:#b91c1c;">Areas for Improvement</strong>${weaknesses}</div>` : ''}
  </div>` : ''}

  ${summary.teacherRemarks ? `<div style="margin-top:18px;padding:10px;background:#f8fafc;border-left:3px solid #1a365d;border-radius:6px;font-size:11px;"><strong>Teacher's Remarks:</strong><br/>${summary.teacherRemarks}</div>` : ''}

  <div style="display:flex;justify-content:space-between;margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;">
    <div style="width:40%;"><div style="border-top:1px solid #000;margin-top:28px;font-size:10px;color:#666;">Class Teacher</div></div>
    <div style="width:40%;"><div style="border-top:1px solid #000;margin-top:28px;font-size:10px;color:#666;">Head Teacher</div></div>
  </div>
</body>
</html>`;
  }

  private async generateClassReport(request: ReportGenerationRequest) {
    return this.reportCardService.generateClassCurriculumReportCardsPdf(
      request.schoolId,
      request.classId!,
      request.termId!,
    );
  }

  private async generateTranscript(request: ReportGenerationRequest) {
    return this.reportCardService.generateStudentTranscript(
      request.schoolId,
      request.studentId!,
    );
  }

  private async generateCertificate(request: ReportGenerationRequest) {
    const school = await this.prisma.school.findUnique({ where: { id: request.schoolId } });
    const student = await this.prisma.student.findUnique({ where: { id: request.studentId } });

    // Resolve template: explicit -> first school certificate template -> any template
    let template = request.templateId
      ? await this.prisma.reportTemplate.findFirst({
          where: { id: request.templateId, schoolId: request.schoolId },
          include: { certificate: true },
        })
      : null;
    if (!template) {
      template = await this.prisma.reportTemplate.findFirst({
        where: { schoolId: request.schoolId, certificate: { isNot: null } },
        include: { certificate: true },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!template) {
      template = await this.prisma.reportTemplate.findFirst({
        where: { schoolId: request.schoolId },
        include: { certificate: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!template?.certificate) {
      throw new BadRequestException(
        'No certificate template configured for this school. Create one in the Template Builder first.',
      );
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: request.studentId!,
        academicYear: { terms: { some: { id: request.termId } } },
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      include: { class: true, academicYear: true },
    });

    const html = await this.templateRenderer.renderPreview(
      request.schoolId,
      template.id,
      {
        student: {
          firstName: student?.firstName,
          lastName: student?.lastName,
          admissionNumber: student?.admissionNumber,
          photoUrl: student?.photoUrl,
        },
        class: { name: enrollment?.class?.name || '' },
        term: { name: '', academicYear: enrollment?.academicYear?.name || '' },
        certificateNumber: `CERT-${Date.now()}`,
      },
    );

    return this.templateRenderer.renderPdfFromHtml(request.schoolId, template.id, html);
  }

  private async generateAttendanceReport(request: ReportGenerationRequest) {
    const term = await this.prisma.term.findUnique({
      where: { id: request.termId },
      include: { academicYear: true },
    });
    if (!term) throw new BadRequestException('Term not found');

    const school = await this.prisma.school.findUnique({ where: { id: request.schoolId } });

    const whereClause: any = {
      date: { gte: term.startDate, lte: term.endDate },
    };
    if (request.studentId) {
      whereClause.studentId = request.studentId;
    } else if (request.classId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { classId: request.classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
        select: { studentId: true },
      });
      const studentIds = enrollments.map(e => e.studentId);
      if (studentIds.length === 0) {
        return { buffer: Buffer.from(''), url: null, publicId: null };
      }
      whereClause.studentId = { in: studentIds };
    } else {
      whereClause.schoolId = request.schoolId;
    }

    const attendance = await this.prisma.attendance.findMany({
      where: whereClause,
      include: {
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
      },
    });

    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'PRESENT').length;
    const absent = attendance.filter(a => a.status === 'ABSENT').length;
    const late = attendance.filter(a => a.status === 'LATE').length;
    const rate = total > 0 ? ((present + late) / total * 100).toFixed(1) : '0';

    const content = `
      <div class="summary-grid">
        <div class="summary-card"><div class="summary-value" style="color:#1d4ed8">${total}</div><div class="summary-label">Total Records</div></div>
        <div class="summary-card"><div class="summary-value pass">${present}</div><div class="summary-label">Present</div></div>
        <div class="summary-card"><div class="summary-value fail">${absent}</div><div class="summary-label">Absent</div></div>
        <div class="summary-card"><div class="summary-value warn">${late}</div><div class="summary-label">Late</div></div>
        <div class="summary-card"><div class="summary-value" style="color:#6d28d9">${rate}%</div><div class="summary-label">Attendance Rate</div></div>
      </div>
      <table>
        <thead><tr>
          <th class="text-center" style="width:30px">#</th>
          <th style="min-width:150px">Student</th>
          <th class="text-center">Admission No</th>
          <th class="text-center">Total</th>
          <th class="text-center">Present</th>
          <th class="text-center">Absent</th>
          <th class="text-center">Late</th>
          <th class="text-center">Rate</th>
          <th class="text-center" style="min-width:150px">Attendance Rate</th>
        </tr></thead>
        <tbody>${this.groupAttendanceByStudent(attendance)}</tbody>
      </table>`;

    const html = this.buildEnhancedReportShell({
      schoolName: school?.name || 'School',
      subtitle: `Attendance Report — ${term.name} (${term.academicYear?.name || ''})`,
      title: 'Attendance Report',
      content: this.buildMetaBar([
        { label: 'Scope', value: request.studentId ? 'Single Student' : request.classId ? 'Class' : 'School' },
        { label: 'Term', value: term.name },
        { label: 'Year', value: term.academicYear?.name || '' },
        { label: 'Period', value: `${term.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${term.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` },
      ]) + content,
      orientation: 'landscape',
    });

    const buffer = await this.renderHtmlToPdf(html);
    const result = await this.cloudinary.uploadBuffer(buffer, {
      folder: `${FOLDERS.system}/reports`,
      publicId: `attendance-${request.termId}-${Date.now()}`,
      resourceType: 'raw',
    });

    return { buffer, url: result.secureUrl, publicId: result.publicId };
  }

  private groupAttendanceByStudent(attendance: any[]): string {
    const grouped = new Map<string, any[]>();
    for (const a of attendance) {
      const key = a.studentId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(a);
    }

    let rows = '';
    let idx = 1;
    for (const [studentId, records] of grouped) {
      const student = records[0]?.student;
      const present = records.filter(r => r.status === 'PRESENT').length;
      const absent = records.filter(r => r.status === 'ABSENT').length;
      const late = records.filter(r => r.status === 'LATE').length;
      const total = records.length;
      const rate = total > 0 ? ((present + late) / total * 100).toFixed(1) : '0';
      const barColor = Number(rate) >= 80 ? '#059669' : Number(rate) >= 60 ? '#d97706' : '#dc2626';
      const barWidth = Math.min(100, Number(rate));

      rows += `<tr>
        <td class="text-center">${idx++}</td>
        <td style="text-align:left">${student?.firstName || ''} ${student?.lastName || ''}</td>
        <td class="text-center">${student?.admissionNumber || ''}</td>
        <td class="text-center">${total}</td>
        <td class="text-center pass font-semibold">${present}</td>
        <td class="text-center fail font-semibold">${absent}</td>
        <td class="text-center warn font-semibold">${late}</td>
        <td class="text-center font-bold" style="color:${barColor}">${rate}%</td>
        <td style="min-width:140px">
          <div class="bar-track"><div class="chart-bar" style="width:${barWidth}%;background:${barColor}"></div></div>
        </td>
      </tr>`;
    }
    return rows;
  }

  private async generateAnalyticsReport(request: ReportGenerationRequest) {
    const school = await this.prisma.school.findUnique({ where: { id: request.schoolId } });
    const term = await this.prisma.term.findUnique({
      where: { id: request.termId },
      include: { academicYear: true },
    });

    // Fetch class name if classId provided
    let className = '';
    if (request.classId) {
      const classRecord = await this.prisma.class.findUnique({ where: { id: request.classId }, select: { name: true } });
      className = classRecord?.name || '';
    }

    // Fetch teaching assignments for this class + academic year → subject→teacher map
    const teacherMap = new Map<string, string>();
    if (request.classId && term?.academicYearId) {
      const assignments = await this.prisma.teachingAssignment.findMany({
        where: { classId: request.classId, academicYearId: term.academicYearId, schoolId: request.schoolId },
        include: { teacher: { select: { firstName: true, lastName: true } }, subject: { select: { name: true } } },
      });
      for (const a of assignments) {
        const teacherName = `${(a.teacher as any)?.firstName || ''} ${(a.teacher as any)?.lastName || ''}`.trim();
        if (teacherName) teacherMap.set((a.subject as any)?.name || '', teacherName);
      }
    } else if (term?.academicYearId) {
      // School-wide: get all assignments for the academic year
      const assignments = await this.prisma.teachingAssignment.findMany({
        where: { academicYearId: term.academicYearId, schoolId: request.schoolId },
        include: { teacher: { select: { firstName: true, lastName: true } }, subject: { select: { name: true } }, class: { select: { name: true } } },
      });
      for (const a of assignments) {
        const teacherName = `${(a.teacher as any)?.firstName || ''} ${(a.teacher as any)?.lastName || ''}`.trim();
        const cname = (a.class as any)?.name || '';
        const sname = (a.subject as any)?.name || '';
        const key = cname ? `${sname}__${cname}` : sname;
        if (teacherName) teacherMap.set(key, teacherName);
      }
    }

    // Get enrolled student IDs for the class (if classId provided) or school
    let enrolledStudentIds: string[] = [];
    const enrollmentWhere: any = { schoolId: request.schoolId, status: 'ACTIVE', student: { status: 'ACTIVE' } };
    if (request.classId) {
      enrollmentWhere.classId = request.classId;
    }
    if (term?.academicYearId) {
      enrollmentWhere.academicYearId = term.academicYearId;
    }
    const enrollments = await this.prisma.enrollment.findMany({
      where: enrollmentWhere,
      select: { studentId: true },
    });
    enrolledStudentIds = [...new Set(enrollments.map(e => e.studentId))];

    // Get stats from ComputedResult
    const whereCondition: any = {
      termId: request.termId,
      schoolId: request.schoolId,
      status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      finalPercentage: { not: null },
      student: { status: 'ACTIVE' },
    };
    if (request.classId) {
      whereCondition.classId = request.classId;
    }

    let computedResults = await this.prisma.computedResult.findMany({
      where: whereCondition,
      include: { student: { select: { id: true, firstName: true, lastName: true, gender: true } }, subject: { select: { id: true, name: true } } },
    });

    // Fallback: students enrolled but missing from ComputedResult — use Result table
    const computedStudentIds = new Set(computedResults.map(r => r.studentId));
    const missingStudentIds = enrolledStudentIds.filter(id => !computedStudentIds.has(id));

    if (missingStudentIds.length > 0) {
      const fallbackResults = await this.prisma.result.findMany({
        where: {
          studentId: { in: missingStudentIds },
          termId: request.termId,
          schoolId: request.schoolId,
          student: { status: 'ACTIVE' },
        },
        include: { subject: { select: { id: true, name: true } }, student: { select: { id: true, firstName: true, lastName: true, gender: true } } },
      });

      const gradingCategories = await this.prisma.performanceCategory.findMany({
        where: { schoolId: request.schoolId },
        orderBy: { minScore: 'desc' },
      });

      for (const result of fallbackResults) {
        const score = result.score ?? 0;
        const grade = result.grade || this.computeGrade(score, gradingCategories);
        computedResults.push({
          id: result.id,
          studentId: result.studentId,
          subjectId: result.subjectId,
          termId: result.termId,
          classId: request.classId || '',
          schoolId: request.schoolId,
          totalRawScore: score,
          totalWeightedScore: score,
          finalPercentage: score,
          finalGrade: grade,
          finalRemark: null,
          classRank: null,
          subjectRank: null,
          gpa: null,
          points: null,
          status: 'COMPUTED' as any,
          computedAt: null,
          verifiedBy: null,
          verifiedAt: null,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          student: result.student as any,
          subject: result.subject as any,
        } as any);
      }
    }

    // Total enrolled students (always use enrollment count)
    const totalStudents = enrolledStudentIds.length || new Set(computedResults.map(r => r.studentId)).size;

    const percentages = computedResults.map(r => r.finalPercentage ?? 0).filter(p => p > 0);
    const avg = percentages.length > 0
      ? (percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1)
      : '0';
    const highest = percentages.length > 0 ? Math.max(...percentages).toFixed(1) : '0';
    const lowest = percentages.length > 0 ? Math.min(...percentages).toFixed(1) : '0';
    const passRate = percentages.length > 0
      ? (percentages.filter(p => p >= 50).length / percentages.length * 100).toFixed(1)
      : '0';

    // Subject performance — track subjectId for teacher lookup
    interface SubjectData { scores: number[]; subjectId: string; subjectName: string; }
    const subjectMap = new Map<string, SubjectData>();
    for (const r of computedResults) {
      const sname = (r.subject as any)?.name || 'Unknown';
      const sid = (r.subject as any)?.id || '';
      if (!subjectMap.has(sname)) subjectMap.set(sname, { scores: [], subjectId: sid, subjectName: sname });
      subjectMap.get(sname)!.scores.push(r.finalPercentage ?? 0);
    }

    const subjectRows = Array.from(subjectMap.entries())
      .map(([name, data]) => {
        const subjectAvg = (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1);
        // Look up teacher: first try class-level key, then subject-level key
        let teacher = teacherMap.get(name) || '';
        if (!teacher && className) {
          teacher = teacherMap.get(`${name}__${className}`) || '';
        }
        const passCount = data.scores.filter(p => p >= 50).length;
        return `<tr>
          <td style="text-align:left;font-weight:500">${name}</td>
          <td style="text-align:left">${teacher || '<span style=\"color:#6b7280\">N/A</span>'}</td>
          <td>${data.scores.length}</td>
          <td style="font-weight:600">${subjectAvg}%</td>
          <td>${Math.max(...data.scores).toFixed(1)}%</td>
          <td>${Math.min(...data.scores).toFixed(1)}%</td>
          <td>${passCount}/${data.scores.length}</td>
        </tr>`;
      }).join('');

    const classLabel = className ? ` — ${className}` : '';

    // Grade distribution
    const gradeDistribution: Record<string, number> = {};
    for (const r of computedResults) {
      const g = (r.finalGrade || '—').trim() || '—';
      gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
    }

    // Per-student aggregates
    const studentMap = new Map<string, { name: string; gender: string; pcts: number[] }>();
    for (const r of computedResults) {
      const s = (r as any).student as any;
      const name = `${s?.firstName || ''} ${s?.lastName || ''}`.trim();
      const gender = (s?.gender || '').toUpperCase();
      if (!studentMap.has(r.studentId)) {
        studentMap.set(r.studentId, { name, gender, pcts: [] });
      }
      if (r.finalPercentage != null) studentMap.get(r.studentId)!.pcts.push(r.finalPercentage);
    }

    const studentAvg = (v: { pcts: number[] }) =>
      v.pcts.length > 0 ? v.pcts.reduce((a, b) => a + b, 0) / v.pcts.length : 0;

    const studentRowsForRank = Array.from(studentMap.entries()).map(([studentId, v]) => ({
      studentId,
      name: v.name || 'Student',
      gender: v.gender.startsWith('M') ? 'M' : v.gender ? 'F' : '-',
      avg: studentAvg(v),
    }));

    // Top performers (Ranking section)
    const rankings = [...studentRowsForRank].sort((a, b) => b.avg - a.avg);
    const rankRows = rankings.slice(0, 20).map((s, i) => {
      const avgColor = this.scoreColor(s.avg);
      const grade = s.avg >= 75 ? 'A' : s.avg >= 65 ? 'B' : s.avg >= 50 ? 'C' : s.avg >= 40 ? 'D' : 'E';
      const gc = this.gradeColor(grade);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
      return `<tr>
        <td class="text-center font-bold" style="font-size:14px;color:${i < 3 ? '#d97706' : '#6b7280'}">${medal}</td>
        <td style="font-weight:600">${s.name}</td>
        <td class="text-center" style="color:#6b7280">${s.gender}</td>
        <td class="text-center font-bold" style="color:${avgColor}">${s.avg.toFixed(1)}%</td>
        <td class="text-center"><span class="grade-badge" style="background:${gc.bg};color:${gc.text}">${grade}</span></td>
      </tr>`;
    }).join('');

    // At-risk students
    const atRisk = studentRowsForRank.filter(s => s.avg < 40).sort((a, b) => a.avg - b.avg);
    const atRiskCount = atRisk.length;
    const atRiskRows = atRisk.slice(0, 25).map((s, i) => {
      const gc = this.gradeColor('E');
      return `<tr>
        <td class="text-center" style="color:#6b7280">${i + 1}</td>
        <td style="font-weight:600">${s.name}</td>
        <td class="text-center" style="color:${s.gender === 'M' ? '#2563eb' : '#db2777'};font-weight:600">${s.gender}</td>
        <td class="text-center font-bold fail">${s.avg.toFixed(1)}%</td>
        <td class="text-center"><span class="grade-badge" style="background:${gc.bg};color:${gc.text}">E</span></td>
      </tr>`;
    }).join('');

    // Gender performance overview
    const maleStudents = studentRowsForRank.filter(s => s.gender === 'M');
    const femaleStudents = studentRowsForRank.filter(s => s.gender === 'F');
    const genderStats = maleStudents.length + femaleStudents.length > 0 ? {
      maleCount: maleStudents.length,
      femaleCount: femaleStudents.length,
      maleAverage: maleStudents.length > 0 ? maleStudents.reduce((a, b) => a + b.avg, 0) / maleStudents.length : 0,
      femaleAverage: femaleStudents.length > 0 ? femaleStudents.reduce((a, b) => a + b.avg, 0) / femaleStudents.length : 0,
      malePassRate: maleStudents.length > 0 ? maleStudents.filter(s => s.avg >= 50).length / maleStudents.length * 100 : 0,
      femalePassRate: femaleStudents.length > 0 ? femaleStudents.filter(s => s.avg >= 50).length / femaleStudents.length * 100 : 0,
    } : null;

    // Subject-level gender breakdown
    const subjectGenderMap = new Map<string, { maleScores: number[]; femaleScores: number[] }>();
    for (const r of computedResults) {
      const sname = (r.subject as any)?.name || 'Unknown';
      const gender = ((r.student as any)?.gender || '').toUpperCase();
      if (r.finalPercentage == null) continue;
      if (!subjectGenderMap.has(sname)) subjectGenderMap.set(sname, { maleScores: [], femaleScores: [] });
      const entry = subjectGenderMap.get(sname)!;
      if (gender.startsWith('M')) entry.maleScores.push(r.finalPercentage);
      else entry.femaleScores.push(r.finalPercentage);
    }

    const enhancedSubjectRows = Array.from(subjectMap.entries()).map(([name, data]) => {
      const subjectAvg = data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0;
      let teacher = teacherMap.get(name) || '';
      if (!teacher && className) teacher = teacherMap.get(`${name}__${className}`) || '';
      const passCount = data.scores.filter(p => p >= 50).length;
      const passRatePct = data.scores.length > 0 ? passCount / data.scores.length * 100 : 0;
      const distinction = data.scores.filter(p => p >= 75).length;
      const distinctionPct = data.scores.length > 0 ? distinction / data.scores.length * 100 : 0;
      const sg = subjectGenderMap.get(name);
      const maleAvg = sg && sg.maleScores.length > 0 ? (sg.maleScores.reduce((a, b) => a + b, 0) / sg.maleScores.length).toFixed(1) : '-';
      const femaleAvg = sg && sg.femaleScores.length > 0 ? (sg.femaleScores.reduce((a, b) => a + b, 0) / sg.femaleScores.length).toFixed(1) : '-';
      const malePass = sg && sg.maleScores.length > 0 ? (sg.maleScores.filter(p => p >= 50).length / sg.maleScores.length * 100).toFixed(0) : '-';
      const femalePass = sg && sg.femaleScores.length > 0 ? (sg.femaleScores.filter(p => p >= 50).length / sg.femaleScores.length * 100).toFixed(0) : '-';
      const avgColor = this.scoreColor(subjectAvg);
      return `<tr>
        <td style="font-weight:600">${name}</td>
        <td style="text-align:left">${teacher || '<span style="color:#9ca3af">N/A</span>'}</td>
        <td class="text-center font-semibold" style="color:${avgColor}">${subjectAvg.toFixed(1)}%</td>
        <td class="text-center pass">${Math.max(...data.scores).toFixed(1)}%</td>
        <td class="text-center fail">${Math.min(...data.scores).toFixed(1)}%</td>
        <td class="text-center"><span class="grade-badge" style="background:${passRatePct >= 70 ? '#d1fae5' : passRatePct >= 40 ? '#fef3c7' : '#fee2e2'};color:${passRatePct >= 70 ? '#059669' : passRatePct >= 40 ? '#d97706' : '#dc2626'}">${passRatePct.toFixed(1)}%</span></td>
        <td class="text-center"><span class="grade-badge" style="background:#f3e8ff;color:#7c3aed">${distinctionPct.toFixed(1)}%</span></td>
        <td class="text-center" style="color:#2563eb;font-weight:600">${maleAvg}</td>
        <td class="text-center" style="color:#db2777;font-weight:600">${femaleAvg}</td>
        <td class="text-center" style="color:#2563eb">${malePass}</td>
        <td class="text-center" style="color:#db2777">${femalePass}</td>
      </tr>`;
    }).join('');

    // Grade distribution pie chart (SVG)
    const gradePieColors: Record<string, string> = {
      'A+': '#059669', 'A': '#10b981', 'A-': '#34d399',
      'B+': '#2563eb', 'B': '#3b82f6', 'B-': '#60a5fa',
      'C+': '#d97706', 'C': '#f59e0b', 'C-': '#fbbf24',
      'D+': '#dc2626', 'D': '#ef4444', 'D-': '#f87171',
      'E': '#991b1b', 'F': '#7f1d1d',
      '1': '#059669', '2': '#2563eb', '3': '#d97706', '4': '#dc2626', '5': '#991b1b',
    };
    const distEntries = Object.entries(gradeDistribution);
    let cumulativePercent = 0;
    const pieSlices = distEntries.map(([grade, count]) => {
      const pct = totalStudents > 0 ? (count as number) / totalStudents * 100 : 0;
      const startAngle = cumulativePercent / 100 * 360;
      cumulativePercent += pct;
      const endAngle = cumulativePercent / 100 * 360;
      const color = gradePieColors[grade] || '#9ca3af';
      const largeArc = pct > 50 ? 1 : 0;
      const startRad = (startAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      const x1 = 100 + 80 * Math.cos(startRad);
      const y1 = 100 + 80 * Math.sin(startRad);
      const x2 = 100 + 80 * Math.cos(endRad);
      const y2 = 100 + 80 * Math.sin(endRad);
      if (pct < 0.5) return '';
      return `<path d="M100,100 L${x1},${y1} A80,80 0 ${largeArc},1 ${x2},${y2} Z" fill="${color}" stroke="white" stroke-width="1"/>`;
    }).join('');
    const distLegend = distEntries.map(([grade, count]) => {
      const pct = totalStudents > 0 ? ((count as number) / totalStudents * 100).toFixed(1) : '0.0';
      const color = gradePieColors[grade] || '#9ca3af';
      return `<tr>
        <td class="text-center font-bold" style="color:${color};font-size:13px">${grade}</td>
        <td class="text-center font-semibold">${count}</td>
        <td class="text-center">${pct}%</td>
        <td><div style="width:16px;height:16px;border-radius:3px;background:${color};display:inline-block;vertical-align:middle;margin-right:6px"></div></td>
      </tr>`;
    }).join('');

    const distinctionRate = percentages.length > 0
      ? (percentages.filter(p => p >= 75).length / percentages.length * 100).toFixed(1)
      : '0';

    const genderSection = genderStats ? `
      <div class="section-title">Gender Performance Overview</div>
      <div class="summary-grid">
        <div class="summary-card" style="border-left:4px solid #2563eb"><div class="summary-value" style="color:#2563eb">${genderStats.maleCount}</div><div class="summary-label">Male Students</div></div>
        <div class="summary-card" style="border-left:4px solid #db2777"><div class="summary-value" style="color:#db2777">${genderStats.femaleCount}</div><div class="summary-label">Female Students</div></div>
        <div class="summary-card" style="border-left:4px solid #2563eb"><div class="summary-value" style="color:#2563eb">${genderStats.malePassRate.toFixed(1)}%</div><div class="summary-label">Male Pass Rate</div></div>
        <div class="summary-card" style="border-left:4px solid #db2777"><div class="summary-value" style="color:#db2777">${genderStats.femalePassRate.toFixed(1)}%</div><div class="summary-label">Female Pass Rate</div></div>
        <div class="summary-card" style="border-left:4px solid #2563eb"><div class="summary-value" style="color:#2563eb">${genderStats.maleAverage.toFixed(1)}%</div><div class="summary-label">Male Average</div></div>
        <div class="summary-card" style="border-left:4px solid #db2777"><div class="summary-value" style="color:#db2777">${genderStats.femaleAverage.toFixed(1)}%</div><div class="summary-label">Female Average</div></div>
      </div>` : '';

    const content = `
      <div class="summary-grid">
        <div class="summary-card"><div class="summary-value">${totalStudents}</div><div class="summary-label">Total Students</div></div>
        <div class="summary-card"><div class="summary-value pass">${passRate}%</div><div class="summary-label">Class Pass Rate</div></div>
        <div class="summary-card"><div class="summary-value" style="color:#ea6645">${avg}%</div><div class="summary-label">Class Average</div></div>
        <div class="summary-card"><div class="summary-value" style="color:#7c3aed">${distinctionRate}%</div><div class="summary-label">Distinction Rate</div></div>
        <div class="summary-card"><div class="summary-value fail">${atRiskCount}</div><div class="summary-label">At Risk Students</div></div>
      </div>

      ${genderSection}

      <div class="section-title">Grade Distribution</div>
      <div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap">
        <div style="flex-shrink:0">
          <svg width="200" height="200" viewBox="0 0 200 200">${pieSlices || '<circle cx="100" cy="100" r="80" fill="#e5e7eb"/>'}<circle cx="100" cy="100" r="35" fill="white"/><text x="100" y="105" text-anchor="middle" font-size="12" fill="#374151" font-weight="700">${totalStudents}</text><text x="100" y="118" text-anchor="middle" font-size="8" fill="#9ca3af">STUDENTS</text></svg>
        </div>
        <table style="max-width:350px;margin:0">
          <thead><tr><th class="text-center">Grade</th><th class="text-center">Count</th><th class="text-center">%</th><th></th></tr></thead>
          <tbody>${distLegend || '<tr><td colspan="4" class="text-center" style="color:#9ca3af">No graded results</td></tr>'}</tbody>
        </table>
      </div>

      <div class="section-title">Top Performers</div>
      <table>
        <thead><tr><th class="text-center" style="width:50px">Rank</th><th>Student Name</th><th class="text-center" style="width:60px">Gender</th><th class="text-center" style="min-width:80px">Average</th><th class="text-center" style="width:50px">Grade</th></tr></thead>
        <tbody>${rankRows || '<tr><td colspan="5" class="text-center" style="color:#9ca3af">No data available</td></tr>'}</tbody>
      </table>

      <div class="section-title">Subject Performance Breakdown</div>
      <table>
        <thead><tr><th>Subject</th><th>Teacher</th><th class="text-center">Class Avg</th><th class="text-center">Highest</th><th class="text-center">Lowest</th><th class="text-center">Pass Rate</th><th class="text-center">Distinction</th><th class="text-center">Male Avg</th><th class="text-center">Female Avg</th><th class="text-center">Male Pass%</th><th class="text-center">Female Pass%</th></tr></thead>
        <tbody>${enhancedSubjectRows || '<tr><td colspan="11" class="text-center" style="color:#9ca3af">No data available</td></tr>'}</tbody>
      </table>

      ${atRiskRows ? `
      <div class="section-title">At-Risk Students (Below 40%)</div>
      <table>
        <thead><tr><th class="text-center">#</th><th>Student Name</th><th class="text-center">Gender</th><th class="text-center">Score</th><th class="text-center">Grade</th></tr></thead>
        <tbody>${atRiskRows}</tbody>
      </table>` : ''}`;

    const html = this.buildEnhancedReportShell({
      schoolName: school?.name || 'School',
      subtitle: `Results Analysis${classLabel} — ${term?.name || ''} (${term?.academicYear?.name || ''})`,
      title: 'Analytics Summary',
      content: this.buildMetaBar([
        { label: 'Scope', value: className || 'School' },
        { label: 'Term', value: term?.name || '' },
        { label: 'Year', value: term?.academicYear?.name || '' },
        { label: 'Exam', value: 'END OF TERM' },
        { label: 'Date', value: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
      ]) + content,
      orientation: 'landscape',
    });

    const buffer = await this.renderHtmlToPdf(html);
    const result = await this.cloudinary.uploadBuffer(buffer, {
      folder: `${FOLDERS.system}/reports`,
      publicId: `analytics-${request.termId}-${Date.now()}`,
      resourceType: 'raw',
    });

    return { buffer, url: result.secureUrl, publicId: result.publicId };
  }

  private async generateMarkSchedule(request: ReportGenerationRequest) {
    const school = await this.prisma.school.findUnique({ where: { id: request.schoolId } });
    const term = await this.prisma.term.findUnique({
      where: { id: request.termId },
      include: { academicYear: true },
    });
    if (!term) throw new BadRequestException('Term not found');

    const classInfo = await this.prisma.class.findUnique({
      where: { id: request.classId },
      select: { name: true, classTeacher: true },
    });

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId: request.classId },
      include: { subject: true },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId: request.classId, academicYearId: term.academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      include: { student: { select: { firstName: true, lastName: true, admissionNumber: true, gender: true } } },
    });

    const studentIds = enrollments.map(e => e.studentId);
    const results = await this.prisma.computedResult.findMany({
      where: {
        studentId: { in: studentIds },
        termId: request.termId,
        classId: request.classId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        student: { status: 'ACTIVE' },
      },
    });

    const subjectHeaders = classSubjects.map(cs =>
      `<th class="text-center">${cs.subject.name}</th>`
    ).join('');

    const studentRowsData = enrollments.map((e, idx) => {
      const studentResults = results.filter(r => r.studentId === e.studentId);
      const cells = classSubjects.map(cs => {
        const result = studentResults.find(r => r.subjectId === cs.subjectId);
        const pct = result?.finalPercentage;
        const grade = result?.finalGrade || null;
        const remark = result?.finalRemark || null;
        if (pct == null) {
          return `<td class="text-center" style="background:#fffbeb"><span style="color:#d1d5db">-</span></td>`;
        }
        const color = this.scoreColor(pct);
        return `<td class="text-center" style="background:${pct < 50 ? '#fef2f2' : 'transparent'}">
          <div style="font-weight:600;font-size:12px;color:${color}">${pct.toFixed(1)}%</div>
          <div style="font-size:10px;color:#6b7280">${grade || '-'}${remark ? ` (${remark})` : ''}</div>
        </td>`;
      }).join('');

      const scored = studentResults.map(r => r.finalPercentage).filter((p): p is number => p != null);
      const avg = scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
      const totalPoints = studentResults.reduce((sum, r) => sum + (r.points || 0), 0);
      const grade = avg >= 75 ? 'A' : avg >= 65 ? 'B' : avg >= 50 ? 'C' : avg >= 40 ? 'D' : 'E';

      return {
        idx: idx + 1,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        admissionNumber: e.student.admissionNumber,
        gender: e.student.gender || '-',
        cells,
        avg,
        totalPoints,
        grade,
      };
    });

    const ranked = [...studentRowsData].sort((a, b) => b.avg - a.avg);
    const rankMap = new Map<string, number>();
    ranked.forEach((s, i) => rankMap.set(`${s.firstName}_${s.lastName}_${s.admissionNumber}`, i + 1));

    const studentRows = studentRowsData.map(s => {
      const avgColor = this.scoreColor(s.avg);
      const gc = this.gradeColor(s.grade);
      const rank = rankMap.get(`${s.firstName}_${s.lastName}_${s.admissionNumber}`) || s.idx;
      return `<tr style="background:${(s.idx - 1) % 2 === 0 ? 'white' : '#faf7f4'}">
        <td class="text-center" style="color:#6b7280;width:30px">${s.idx}</td>
        <td style="font-weight:600">${s.firstName} ${s.lastName}</td>
        <td style="color:#6b7280;font-size:11px">${s.admissionNumber || '-'}</td>
        <td class="text-center" style="color:#6b7280">${s.gender}</td>
        ${s.cells}
        <td class="text-center font-bold" style="color:${avgColor}">${s.avg.toFixed(1)}%</td>
        <td class="text-center font-semibold" style="color:#059669">${s.totalPoints}</td>
        <td class="text-center"><span class="grade-badge" style="background:${gc.bg};color:${gc.text}">${s.grade}</span></td>
        <td class="text-center font-semibold">${rank}</td>
      </tr>`;
    }).join('');

    const allScores = results.map(r => r.finalPercentage).filter((p): p is number => p != null);
    const classAvg = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '0';
    const passRate = allScores.length > 0 ? (allScores.filter(p => p >= 50).length / allScores.length * 100).toFixed(1) : '0';
    const topScore = allScores.length > 0 ? Math.max(...allScores).toFixed(1) : '0';

    const content = `
      <div class="summary-grid">
        <div class="summary-card"><div class="summary-value">${enrollments.length}</div><div class="summary-label">Total Students</div></div>
        <div class="summary-card"><div class="summary-value pass">${classAvg}%</div><div class="summary-label">Class Average</div></div>
        <div class="summary-card"><div class="summary-value" style="color:#ea6645">${passRate}%</div><div class="summary-label">Pass Rate</div></div>
        <div class="summary-card"><div class="summary-value" style="color:#7c3aed">${classSubjects.length}</div><div class="summary-label">Subjects</div></div>
        <div class="summary-card"><div class="summary-value" style="color:#2563eb">${topScore}%</div><div class="summary-label">Top Score</div></div>
      </div>
      <table>
        <thead><tr>
          <th class="text-center" style="width:30px">#</th>
          <th style="min-width:150px">Student Name</th>
          <th style="min-width:90px">Admission No.</th>
          <th class="text-center" style="width:50px">Gender</th>
          ${subjectHeaders}
          <th class="text-center" style="min-width:60px">Average</th>
          <th class="text-center" style="width:50px">Points</th>
          <th class="text-center" style="width:50px">Grade</th>
          <th class="text-center" style="width:40px">Rank</th>
        </tr></thead>
        <tbody>${studentRows}</tbody>
      </table>
      <div class="signatures">
        <div class="sig"><div class="sig-line">Class Teacher: ${classInfo?.classTeacher || '________________'}</div></div>
        <div class="sig"><div class="sig-line">Head of Department</div></div>
        <div class="sig"><div class="sig-line">Director / Principal</div></div>
      </div>`;

    const html = this.buildEnhancedReportShell({
      schoolName: school?.name || 'School',
      subtitle: `Mark Schedule — ${classInfo?.name || ''} — ${term.name} (${term.academicYear?.name || ''})`,
      title: 'Mark Schedule',
      content: this.buildMetaBar([
        { label: 'Class', value: classInfo?.name || '' },
        { label: 'Term', value: term.name },
        { label: 'Year', value: term.academicYear?.name || '' },
        { label: 'Exam', value: 'END OF TERM' },
        { label: 'Date', value: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
      ]) + content,
      orientation: 'landscape',
    });

    const buffer = await this.renderHtmlToPdf(html);
    const result = await this.cloudinary.uploadBuffer(buffer, {
      folder: `${FOLDERS.system}/reports`,
      publicId: `mark-schedule-${request.classId}-${request.termId}-${Date.now()}`,
      resourceType: 'raw',
    });

    return { buffer, url: result.secureUrl, publicId: result.publicId };
  }

  private async generatePerformanceReport(request: ReportGenerationRequest) {
    const engineData = await this.reportCardEngine.generateReportCardData(
      request.studentId!, request.termId!, request.schoolId,
    );

    const school = await this.prisma.school.findUnique({ where: { id: request.schoolId } });

    // Get template or use default
    let templateId = request.templateId;
    if (!templateId) {
      const defaultTemplate = await this.prisma.reportTemplate.findFirst({
        where: { schoolId: request.schoolId, isDefault: true },
      });
      templateId = defaultTemplate?.id;
    }

    if (templateId) {
      const html = await this.templateRenderer.renderPreview(request.schoolId, templateId, {
        ...engineData,
        schoolName: school?.name,
        schoolLogo: school?.logoUrl || school?.logo,
        subjects: engineData.subjectBreakdown?.map((s: any) => ({
          subject: s.subjectName,
          score: s.finalPercentage,
          grade: s.finalGrade,
          points: s.points,
          remark: s.finalRemark,
        })) || [],
        summary: {
          totalMarks: engineData.subjectBreakdown?.reduce((sum: number, s: any) => sum + (s.totalRawScore || 0), 0) || 0,
          average: engineData.bestSubjectsAverage || 0,
          totalPoints: engineData.totalPoints || 0,
          positionInClass: engineData.termSummary?.classRank || 0,
          totalStudents: engineData.termSummary?.classSize || 0,
        },
      });
      return this.templateRenderer.renderPdfFromHtml(request.schoolId, templateId, html);
    }

    // Fallback to curriculum report card
    return this.reportCardService.generateCurriculumReportCardPdf(
      request.schoolId, request.studentId!, request.termId!,
    );
  }

  private async renderHtmlToPdf(html: string): Promise<Buffer> {
    const puppeteer = await import('puppeteer');
    const os = await import('os');
    const crypto = await import('crypto');
    const path = await import('path');

    const userDataDir = path.join(os.tmpdir(), `puppeteer_${crypto.randomBytes(8).toString('hex')}`);
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      userDataDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true,
      timeout: 120000,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setContent(html, { waitUntil: 'networkidle0' as any });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();
    return Buffer.from(pdf);
  }

  private computeGrade(score: number, categories: any[]): string {
    if (categories.length > 0) {
      for (const cat of categories) {
        if (score >= cat.minScore) return cat.name;
      }
      return categories[categories.length - 1].name;
    }
    if (score >= 75) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'E';
  }

  // ===== Enhanced report shell (matches Web Platform Results Management templates) =====

  private scoreColor(pct: number | null | undefined): string {
    if (pct == null) return '#9ca3af';
    if (pct >= 75) return '#059669';
    if (pct >= 50) return '#3b82f6';
    if (pct >= 40) return '#d97706';
    return '#dc2626';
  }

  private gradeColor(grade?: string | null): { text: string; bg: string } {
    const map: Record<string, [string, string]> = {
      'A+': ['#059669', '#d1fae5'], 'A': ['#059669', '#d1fae5'], 'A-': ['#059669', '#d1fae5'],
      'B+': ['#2563eb', '#dbeafe'], 'B': ['#2563eb', '#dbeafe'], 'B-': ['#2563eb', '#dbeafe'],
      'C+': ['#d97706', '#fef3c7'], 'C': ['#d97706', '#fef3c7'], 'C-': ['#d97706', '#fef3c7'],
      'D+': ['#dc2626', '#fee2e2'], 'D': ['#dc2626', '#fee2e2'], 'D-': ['#dc2626', '#fee2e2'],
      'E': ['#dc2626', '#fee2e2'], 'F': ['#dc2626', '#fee2e2'],
      '1': ['#059669', '#d1fae5'], '2': ['#2563eb', '#dbeafe'], '3': ['#d97706', '#fef3c7'], '4': ['#dc2626', '#fee2e2'], '5': ['#dc2626', '#fee2e2'],
    };
    const entry = grade ? map[grade.trim()] : undefined;
    return entry ? { text: entry[0], bg: entry[1] } : { text: '#9ca3af', bg: '#f3f4f6' };
  }

  private enhancedReportStyles(orientation: 'landscape' | 'portrait' = 'portrait'): string {
    return `
      @page { margin: 15mm; size: A4 ${orientation}; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif; color: #1f2937; background: white; padding: 24px; line-height: 1.4; }
      .report-header { text-align: center; margin-bottom: 24px; padding: 16px 20px; background: linear-gradient(135deg, #5f4b3a 0%, #7a6b5a 100%); border-radius: 8px; color: white; }
      .school-name { font-size: 22px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
      .school-sub { font-size: 12px; color: #e8ddd0; margin-top: 4px; }
      .report-title { font-size: 16px; font-weight: 600; color: white; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.95; }
      .report-meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; font-size: 13px; color: #374151; background: #f5f0eb; padding: 10px 16px; border-radius: 6px; border: 1px solid #e8ddd0; }
      .report-meta strong { color: #5f4b3a; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #5f4b3a; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #7a6b5a; }
      td { padding: 6px 10px; border: 1px solid #e5e7eb; }
      tr:nth-child(even) { background: #faf7f4; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .font-bold { font-weight: 700; }
      .font-semibold { font-weight: 600; }
      .pass { color: #059669; }
      .fail { color: #dc2626; }
      .warn { color: #d97706; }
      .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
      .summary-card { background: #faf7f4; border: 1px solid #e8ddd0; border-radius: 8px; padding: 12px 16px; text-align: center; }
      .summary-value { font-size: 24px; font-weight: 700; color: #5f4b3a; }
      .summary-label { font-size: 11px; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
      .grade-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
      .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
      .sig { text-align: center; flex: 1; }
      .sig-line { width: 180px; border-top: 1px solid #1f2937; margin: 40px auto 0; padding-top: 6px; font-size: 11px; color: #6b7280; }
      .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; }
      .section-title { font-size: 14px; font-weight: 600; color: #5f4b3a; margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e8ddd0; }
      .chart-bar { height: 18px; border-radius: 4px; }
      .bar-track { background: #f3f4f6; border-radius: 4px; height: 18px; overflow: hidden; }
    `;
  }

  private buildEnhancedReportShell(opts: {
    schoolName: string;
    subtitle?: string;
    title: string;
    content: string;
    orientation?: 'landscape' | 'portrait';
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${opts.title}</title>
<style>${this.enhancedReportStyles(opts.orientation || 'portrait')}</style>
</head>
<body>
<div class="report-header">
  <div class="school-name">${opts.schoolName}</div>
  ${opts.subtitle ? `<div class="report-title">${opts.subtitle}</div>` : ''}
</div>
${opts.content}
<div class="footer">Smart Tech SaaS - Results Management System | Confidential</div>
</body></html>`;
  }

  private buildMetaBar(meta: Array<{ label: string; value: string }>): string {
    const spans = meta
      .filter(m => m.value)
      .map(m => `<span><strong>${m.label}:</strong> ${m.value}</span>`)
      .join('');
    return `<div class="report-meta">${spans}</div>`;
  }
}
