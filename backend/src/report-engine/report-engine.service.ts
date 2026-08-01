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
        result = await this.generatePerformanceReport(request);
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

    // Check if there's a custom template with components
    if (request.templateId) {
      const template = await this.prisma.reportTemplate.findFirst({
        where: { id: request.templateId, schoolId },
        include: { components: true },
      });

      if (template && template.components && template.components.length > 0) {
        // Use template builder rendering
        const engineData = await this.reportCardEngine.generateReportCardData(
          studentId, termId, schoolId,
        );
        const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
        const html = await this.templateRenderer.renderPreview(schoolId, request.templateId, {
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
        return this.templateRenderer.renderPdfFromHtml(schoolId, request.templateId, html);
      }
    }

    // Default: use the curriculum report card pipeline
    return this.reportCardService.generateCurriculumReportCardPdf(schoolId, studentId, termId);
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

    const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; padding: 40px; font-size: 13px; color: #111827; }
  .header { text-align: center; margin-bottom: 30px; }
  .school-name { font-size: 24px; font-weight: bold; color: #1a365d; }
  .subtitle { font-size: 15px; color: #374151; margin-top: 5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border: 1px solid #9ca3af; padding: 8px; text-align: center; font-size: 13px; }
  th { background: #1a365d; color: white; font-weight: 700; }
  .stat-grid { display: flex; gap: 15px; margin: 20px 0; }
  .stat-box { flex: 1; background: #f8fafc; border: 1px solid #9ca3af; border-radius: 8px; padding: 15px; text-align: center; }
  .stat-value { font-size: 26px; font-weight: bold; }
  .stat-label { font-size: 12px; color: #374151; margin-top: 4px; font-weight: 600; }
</style></head>
<body>
  <div class="header">
    <div class="school-name">${school?.name || 'School'}</div>
    <div class="subtitle">Attendance Report — ${term.name} (${term.academicYear?.name || ''})</div>
  </div>
  <div class="stat-grid">
    <div class="stat-box"><div class="stat-value" style="color:#1d4ed8">${total}</div><div class="stat-label">Total Records</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#047857">${present}</div><div class="stat-label">Present</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#b91c1c">${absent}</div><div class="stat-label">Absent</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#b45309">${late}</div><div class="stat-label">Late</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#6d28d9">${rate}%</div><div class="stat-label">Attendance Rate</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Student</th><th>Admission No</th><th>Present</th><th>Absent</th><th>Late</th><th>Rate</th></tr></thead>
    <tbody>
      ${this.groupAttendanceByStudent(attendance)}
    </tbody>
  </table>
</body></html>`;

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

      rows += `<tr>
        <td>${idx++}</td>
        <td style="text-align:left">${student?.firstName || ''} ${student?.lastName || ''}</td>
        <td>${student?.admissionNumber || ''}</td>
        <td>${present}</td><td>${absent}</td><td>${late}</td>
        <td style="font-weight:bold;color:${Number(rate) >= 80 ? '#047857' : Number(rate) >= 60 ? '#b45309' : '#b91c1c'}">${rate}%</td>
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
      include: { student: { select: { id: true, firstName: true, lastName: true } }, subject: { select: { id: true, name: true } } },
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
        include: { subject: { select: { id: true, name: true } }, student: { select: { id: true, firstName: true, lastName: true } } },
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

    const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; padding: 40px; font-size: 13px; color: #111827; }
  .header { text-align: center; margin-bottom: 30px; }
  .school-name { font-size: 24px; font-weight: bold; color: #1a365d; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border: 1px solid #9ca3af; padding: 8px; text-align: center; font-size: 13px; }
  th { background: #1a365d; color: white; font-weight: 700; }
  .stat-grid { display: flex; gap: 15px; margin: 20px 0; }
  .stat-box { flex: 1; background: #f8fafc; border: 1px solid #9ca3af; border-radius: 8px; padding: 15px; text-align: center; }
  .stat-value { font-size: 26px; font-weight: bold; }
  .stat-label { font-size: 12px; color: #374151; margin-top: 4px; font-weight: 600; }
</style></head>
<body>
  <div class="header">
    <div class="school-name">${school?.name || 'School'}</div>
    <div style="font-size:15px;color:#374151;margin-top:5px">Subject Performance Analytics${classLabel} — ${term?.name || ''} (${term?.academicYear?.name || ''})</div>
  </div>
  <div class="stat-grid">
    <div class="stat-box"><div class="stat-value" style="color:#1d4ed8">${totalStudents}</div><div class="stat-label">Students</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#047857">${avg}%</div><div class="stat-label">Average</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#6d28d9">${highest}%</div><div class="stat-label">Highest</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#b91c1c">${lowest}%</div><div class="stat-label">Lowest</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#b45309">${passRate}%</div><div class="stat-label">Pass Rate</div></div>
  </div>
  <h3 style="margin-top:30px;color:#1a365d">Subject Performance</h3>
  <table>
    <thead><tr>
      <th style="text-align:left">Subject</th>
      <th style="text-align:left">Teacher</th>
      <th>Students</th>
      <th>Average</th>
      <th>Highest</th>
      <th>Lowest</th>
      <th>Pass</th>
    </tr></thead>
    <tbody>${subjectRows}</tbody>
  </table>
</body></html>`;

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

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId: request.classId },
      include: { subject: true },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId: request.classId, academicYearId: term?.academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
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
      `<th style="padding:6px 8px;border:1px solid #9ca3af;background:#1a365d;color:white;font-size:12px;font-weight:700">${cs.subject.name}</th>`
    ).join('');

    const studentRows = enrollments.map((e, idx) => {
      const cells = classSubjects.map(cs => {
        const result = results.find(r => r.studentId === e.studentId && r.subjectId === cs.subjectId);
        return `<td style="padding:5px 8px;border:1px solid #9ca3af;text-align:center;font-size:12px">${result?.finalPercentage != null ? result.finalPercentage.toFixed(1) : '—'}</td>`;
      }).join('');

      return `<tr style="background:${idx % 2 === 0 ? 'white' : '#f3f4f6'}">
        <td style="padding:5px 8px;border:1px solid #9ca3af;font-size:12px">${e.student.admissionNumber}</td>
        <td style="padding:5px 8px;border:1px solid #9ca3af;text-align:left;font-size:12px;font-weight:600">${e.student.firstName} ${e.student.lastName}</td>
        ${cells}
      </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; padding: 30px; font-size: 12px; color: #111827; }
  .header { text-align: center; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #9ca3af; }
</style></head>
<body>
  <div class="header">
    <div style="font-size:22px;font-weight:bold;color:#1a365d">${school?.name || 'School'}</div>
    <div style="font-size:14px;color:#374151;margin-top:4px">Mark Schedule — ${term?.name || ''}</div>
  </div>
  <table>
    <thead><tr>
      <th style="padding:6px 8px;border:1px solid #9ca3af;background:#1a365d;color:white;font-size:12px;font-weight:700">Adm. No</th>
      <th style="padding:6px 8px;border:1px solid #9ca3af;background:#1a365d;color:white;font-size:12px;font-weight:700;text-align:left">Student</th>
      ${subjectHeaders}
    </tr></thead>
    <tbody>${studentRows}</tbody>
  </table>
</body></html>`;

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
}
