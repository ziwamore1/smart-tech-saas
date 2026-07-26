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
    requiredFields: ['studentId', 'termId', 'templateId'],
    optionalFields: [],
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
          publicId: result.publicId || null,
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

    return report;
  }

  async generateBulkReports(
    request: Omit<ReportGenerationRequest, 'studentId'> & { studentIds?: string[] },
  ): Promise<ReportGenerationResult[]> {
    const reports: ReportGenerationResult[] = [];

    if (request.type === ReportType.CLASS_REPORT && request.classId && request.termId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { classId: request.classId, status: 'ACTIVE' },
        select: { studentId: true },
      });

      for (const enrollment of enrollments) {
        try {
          const report = await this.generateReport({
            ...request,
            studentId: enrollment.studentId,
            type: ReportType.REPORT_CARD,
          });
          reports.push(report);
        } catch (error) {
          this.logger.error(
            `Failed to generate report for student ${enrollment.studentId}: ${error.message}`,
          );
        }
      }
    }

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
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: request.templateId, schoolId: request.schoolId },
      include: { certificate: true },
    });

    if (!template?.certificate) {
      throw new BadRequestException('Template does not have certificate configuration');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: request.studentId!,
        academicYear: { terms: { some: { id: request.termId } } },
        status: 'ACTIVE',
      },
      include: { class: true, academicYear: true },
    });

    const html = await this.templateRenderer.renderPreview(
      request.schoolId,
      request.templateId!,
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

    return this.templateRenderer.renderPdfFromHtml(request.schoolId, request.templateId!, html);
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
    if (request.studentId) whereClause.studentId = request.studentId;
    if (request.classId) whereClause.classId = request.classId;

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
  body { font-family: Arial, sans-serif; padding: 40px; }
  .header { text-align: center; margin-bottom: 30px; }
  .school-name { font-size: 24px; font-weight: bold; color: #1a365d; }
  .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 12px; }
  th { background: #1a365d; color: white; }
  .stat-grid { display: flex; gap: 15px; margin: 20px 0; }
  .stat-box { flex: 1; background: #f8fafc; border-radius: 8px; padding: 15px; text-align: center; }
  .stat-value { font-size: 24px; font-weight: bold; }
  .stat-label { font-size: 11px; color: #666; margin-top: 4px; }
</style></head>
<body>
  <div class="header">
    <div class="school-name">${school?.name || 'School'}</div>
    <div class="subtitle">Attendance Report — ${term.name} (${term.academicYear?.name || ''})</div>
  </div>
  <div class="stat-grid">
    <div class="stat-box"><div class="stat-value" style="color:#2563eb">${total}</div><div class="stat-label">Total Records</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#16a34a">${present}</div><div class="stat-label">Present</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#dc2626">${absent}</div><div class="stat-label">Absent</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#f59e0b">${late}</div><div class="stat-label">Late</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#7c3aed">${rate}%</div><div class="stat-label">Attendance Rate</div></div>
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
      resourceType: 'image',
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
        <td style="font-weight:bold;color:${Number(rate) >= 80 ? '#16a34a' : Number(rate) >= 60 ? '#f59e0b' : '#dc2626'}">${rate}%</td>
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

    // Get school-wide stats
    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        termId: request.termId,
        schoolId: request.schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        finalPercentage: { not: null },
      },
      include: { student: { select: { id: true, classId: true } }, subject: { select: { name: true } } },
    });

    const percentages = computedResults.map(r => r.finalPercentage ?? 0).filter(p => p > 0);
    const avg = percentages.length > 0
      ? (percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1)
      : '0';
    const highest = percentages.length > 0 ? Math.max(...percentages).toFixed(1) : '0';
    const lowest = percentages.length > 0 ? Math.min(...percentages).toFixed(1) : '0';
    const passRate = percentages.length > 0
      ? (percentages.filter(p => p >= 50).length / percentages.length * 100).toFixed(1)
      : '0';

    // Subject performance
    const subjectMap = new Map<string, number[]>();
    for (const r of computedResults) {
      const name = r.subject?.name || 'Unknown';
      if (!subjectMap.has(name)) subjectMap.set(name, []);
      subjectMap.get(name)!.push(r.finalPercentage ?? 0);
    }

    const subjectRows = Array.from(subjectMap.entries())
      .map(([name, scores]) => {
        const subjectAvg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        return `<tr><td style="text-align:left">${name}</td><td>${scores.length}</td><td>${subjectAvg}%</td><td>${Math.max(...scores).toFixed(1)}%</td><td>${Math.min(...scores).toFixed(1)}%</td></tr>`;
      }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; padding: 40px; }
  .header { text-align: center; margin-bottom: 30px; }
  .school-name { font-size: 24px; font-weight: bold; color: #1a365d; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 12px; }
  th { background: #1a365d; color: white; }
  .stat-grid { display: flex; gap: 15px; margin: 20px 0; }
  .stat-box { flex: 1; background: #f8fafc; border-radius: 8px; padding: 15px; text-align: center; }
  .stat-value { font-size: 24px; font-weight: bold; }
  .stat-label { font-size: 11px; color: #666; margin-top: 4px; }
</style></head>
<body>
  <div class="header">
    <div class="school-name">${school?.name || 'School'}</div>
    <div style="font-size:14px;color:#666;margin-top:5px">Analytics Report — ${term?.name || ''} (${term?.academicYear?.name || ''})</div>
  </div>
  <div class="stat-grid">
    <div class="stat-box"><div class="stat-value" style="color:#2563eb">${computedResults.length > 0 ? new Set(computedResults.map(r => r.studentId)).size : 0}</div><div class="stat-label">Students</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#16a34a">${avg}%</div><div class="stat-label">Average</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#7c3aed">${highest}%</div><div class="stat-label">Highest</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#dc2626">${lowest}%</div><div class="stat-label">Lowest</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#f59e0b">${passRate}%</div><div class="stat-label">Pass Rate</div></div>
  </div>
  <h3 style="margin-top:30px;color:#1a365d">Subject Performance</h3>
  <table>
    <thead><tr><th style="text-align:left">Subject</th><th>Students</th><th>Average</th><th>Highest</th><th>Lowest</th></tr></thead>
    <tbody>${subjectRows}</tbody>
  </table>
</body></html>`;

    const buffer = await this.renderHtmlToPdf(html);
    const result = await this.cloudinary.uploadBuffer(buffer, {
      folder: `${FOLDERS.system}/reports`,
      publicId: `analytics-${request.termId}-${Date.now()}`,
      resourceType: 'image',
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
      where: { classId: request.classId, academicYearId: term?.academicYearId, status: 'ACTIVE' },
      include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
    });

    const studentIds = enrollments.map(e => e.studentId);
    const results = await this.prisma.computedResult.findMany({
      where: {
        studentId: { in: studentIds },
        termId: request.termId,
        classId: request.classId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      },
    });

    const subjectHeaders = classSubjects.map(cs =>
      `<th style="padding:6px 8px;border:1px solid #ddd;background:#1a365d;color:white;font-size:10px">${cs.subject.name}</th>`
    ).join('');

    const studentRows = enrollments.map((e, idx) => {
      const cells = classSubjects.map(cs => {
        const result = results.find(r => r.studentId === e.studentId && r.subjectId === cs.subjectId);
        return `<td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-size:10px">${result?.finalPercentage != null ? result.finalPercentage.toFixed(1) : '—'}</td>`;
      }).join('');

      return `<tr style="background:${idx % 2 === 0 ? 'white' : '#f8fafc'}">
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px">${e.student.admissionNumber}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:left;font-size:10px">${e.student.firstName} ${e.student.lastName}</td>
        ${cells}
      </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; padding: 30px; }
  .header { text-align: center; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; }
</style></head>
<body>
  <div class="header">
    <div style="font-size:22px;font-weight:bold;color:#1a365d">${school?.name || 'School'}</div>
    <div style="font-size:13px;color:#666;margin-top:4px">Mark Schedule — ${term?.name || ''}</div>
  </div>
  <table>
    <thead><tr>
      <th style="padding:6px 8px;border:1px solid #ddd;background:#1a365d;color:white;font-size:10px">Adm. No</th>
      <th style="padding:6px 8px;border:1px solid #ddd;background:#1a365d;color:white;font-size:10px;text-align:left">Student</th>
      ${subjectHeaders}
    </tr></thead>
    <tbody>${studentRows}</tbody>
  </table>
</body></html>`;

    const buffer = await this.renderHtmlToPdf(html);
    const result = await this.cloudinary.uploadBuffer(buffer, {
      folder: `${FOLDERS.system}/reports`,
      publicId: `mark-schedule-${request.classId}-${request.termId}-${Date.now()}`,
      resourceType: 'image',
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
      userDataDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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
}
