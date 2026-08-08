import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProviderFactory } from '../communications-cloud/providers/sms/sms-provider.factory';
import { SmsProvider } from '../communications-cloud/interfaces/provider.interface';
import { ReportCardEngineService } from '../report-card-engine/report-card-engine.service';

const SINGLE_SMS_LIMIT = 160;

@Injectable()
export class ResultsSmsService {
  private readonly logger = new Logger(ResultsSmsService.name);

  constructor(
    private prisma: PrismaService,
    private smsProviderFactory: SmsProviderFactory,
    private reportCardEngine: ReportCardEngineService,
  ) {}

  /** The formatter consumes published computed results; it never grades or recalculates them. */
  async getRecipients(schoolId: string, classId: string, termId: string, studentIds?: string[]) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, ...(studentIds?.length ? { id: { in: studentIds } } : {}), enrollments: { some: { classId, status: 'ACTIVE' } } },
      select: {
        id: true, firstName: true, lastName: true, admissionNumber: true,
        parents: { select: { parent: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
      },
    });
    if (!students.length) return this.emptyPreview();

    const computed = await this.prisma.computedResult.findMany({
      where: { schoolId, classId, termId, status: 'PUBLISHED', studentId: { in: students.map((s) => s.id) } },
      include: { subject: { select: { name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    });
    const summaries = await this.prisma.termSummary.findMany({
      where: { schoolId, classId, termId, studentId: { in: students.map((s) => s.id) } },
    });
    const [school, term, klass] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, institutionType: { select: { code: true } } } }),
      this.prisma.term.findUnique({ where: { id: termId }, select: { name: true, academicYear: { select: { name: true } } } }),
      this.prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
    ]);

    const recipients: any[] = [];
    const previewWarnings: string[] = [];
    for (const student of students) {
      const rows = computed.filter((r) => r.studentId === student.id);
      if (!rows.length) continue;
      const summary = summaries.find((s) => s.studentId === student.id);
      let report: any = null;
      try {
        report = await this.reportCardEngine.generateReportCardData(student.id, termId, schoolId);
      } catch (error: any) {
        // A malformed optional report-card configuration must not hide all valid
        // published recipients. Keep the published snapshot and expose a warning.
        const detail = error?.message || 'Report card data could not be generated';
        this.logger.warn(`Results SMS report fallback for student ${student.id}: ${detail}`);
        previewWarnings.push(`${student.firstName} ${student.lastName}: ${detail}`);
      }
      const isPrimary = school?.institutionType?.code === 'PRIMARY_SCHOOL';
      const officialSubjects = (report?.subjectBreakdown || rows.map((row) => ({
        subjectName: row.subject.name,
        subjectCode: row.subject.code,
        totalRawScore: row.totalRawScore,
        finalPercentage: row.finalPercentage,
        finalGrade: row.finalGrade,
        finalRemark: row.finalRemark,
        points: row.points,
        isAbsent: row.isAbsent,
      }))).map((subject: any) => ({
        name: subject.subjectName,
        code: subject.subjectCode,
        mark: isPrimary ? subject.totalRawScore : null,
        grade: subject.finalGrade,
        remark: subject.finalRemark,
        points: subject.points,
        absent: subject.isAbsent ?? false,
      }));
      const version = createHash('sha256').update(JSON.stringify({ rows, summary, report })).digest('hex');
      const result = {
        subjects: officialSubjects,
        total: isPrimary ? Number(officialSubjects.reduce((sum: number, subject: any) => sum + (subject.mark || 0), 0).toFixed(1)) : null,
        points: isPrimary ? null : report?.termSummary?.totalPoints ?? report?.totalPoints ?? summary?.totalPoints ?? null,
        overall: report?.termSummary?.overallPercentage != null
          ? Number(report.termSummary.overallPercentage.toFixed(1))
          : summary?.overallPercentage == null ? null : Number(summary.overallPercentage.toFixed(1)),
        grade: report?.termSummary?.overallGrade ?? summary?.overallGrade ?? null,
        division: report?.division?.division ?? (summary?.competencyScores as any)?.division ?? null,
        position: report?.termSummary?.classRank ?? summary?.classRank ?? null,
        classSize: report?.termSummary?.classSize || summary?.classSize || undefined,
        attendance: report?.attendance?.attendanceRate ?? summary?.attendanceRate ?? null,
      };
      const message = this.formatMessage(school?.name || 'SCHOOL', student, klass?.name, term?.name, result);
      const length = message.length;
      const existing = await this.prisma.resultSmsLog.findFirst({
        where: { schoolId, studentId: student.id, termId, resultVersion: version, status: { in: ['SENT', 'DELIVERED'] } },
        orderBy: { createdAt: 'desc' }, select: { id: true, status: true, sentAt: true },
      });
      for (const link of student.parents) {
        const parent = link.parent;
        const phoneStatus = !parent.phone ? 'MISSING' : this.isValidPhone(parent.phone) ? 'VALID' : 'INVALID';
        recipients.push({
          parentId: parent.id, parentName: `${parent.firstName} ${parent.lastName}`, studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`, admissionNumber: student.admissionNumber,
          phoneNumber: parent.phone ?? null, phoneStatus, message, result, resultVersion: version,
          characters: length, segments: Math.max(1, Math.ceil(length / SINGLE_SMS_LIMIT)), estimatedUnits: Math.max(1, Math.ceil(length / SINGLE_SMS_LIMIT)),
          alreadySent: Boolean(existing), previousStatus: existing?.status ?? null,
          errorCode: !parent.phone ? 'NO_PHONE_NUMBER' : phoneStatus === 'INVALID' ? 'INVALID_PHONE_NUMBER' : undefined,
          errorSuggestion: !parent.phone ? 'Add a parent phone number in Parent Management.' : phoneStatus === 'INVALID' ? 'Use an international phone number, for example +260XXXXXXXXX.' : undefined,
        });
      }
    }
    const valid = recipients.filter((r) => r.phoneStatus === 'VALID');
    return {
      academicYear: term?.academicYear?.name ?? null, term: term?.name ?? null, assessment: term?.name ?? null,
      class: klass?.name ?? null, totalStudents: recipients.length ? new Set(recipients.map((r) => r.studentId)).size : 0,
      totalRecipients: recipients.length, validRecipients: valid.length,
      missingPhone: recipients.filter((r) => r.phoneStatus === 'MISSING').length,
      invalidPhone: recipients.filter((r) => r.phoneStatus === 'INVALID').length,
      estimatedUnits: valid.reduce((sum, r) => sum + r.estimatedUnits, 0),
      multiSegment: valid.some((r) => r.segments > 1), previewWarnings, recipients,
    };
  }

  async sendResultsSms(schoolId: string, classId: string, termId: string, userId: string, options?: { parentIds?: string[]; studentIds?: string[]; allowResend?: boolean }) {
    const preview = await this.getRecipients(schoolId, classId, termId, options?.studentIds);
    const targets = preview.recipients.filter((r) => (!options?.parentIds?.length || options.parentIds.includes(r.parentId)) && r.phoneStatus === 'VALID');
    if (!targets.length) throw new BadRequestException('No valid parent phone numbers are available for this send.');
    if (!options?.allowResend && targets.some((r) => r.alreadySent)) {
      throw new BadRequestException({ code: 'DUPLICATE_RESULT_SMS', message: 'One or more selected results were already sent. Confirm resend explicitly.', alreadySent: targets.filter((r) => r.alreadySent).map((r) => r.studentId) });
    }
    const batchId = `RESULTS-${Date.now()}`;
    const logs: any[] = [];
    for (const r of preview.recipients.filter((item) => !targets.includes(item))) {
      logs.push(await this.prisma.resultSmsLog.create({ data: {
        schoolId, classId, termId, studentId: r.studentId, parentId: r.parentId, parentName: r.parentName, studentName: r.studentName,
        admissionNumber: r.admissionNumber, phoneNumber: r.phoneNumber, message: r.message, status: 'SKIPPED', failureCode: r.errorCode || 'NO_PHONE_NUMBER',
        errorMessage: r.errorCode === 'INVALID_PHONE_NUMBER' ? 'Parent phone number is invalid.' : 'No parent phone number is registered.', errorSuggestion: r.errorSuggestion,
        resultVersion: r.resultVersion, initiatedById: userId, messageHash: this.hash(r.message), batchId, retryCount: 0,
      } }));
    }
    let provider: SmsProvider;
    try {
      provider = await this.resolveProvider(schoolId);
    } catch (error: any) {
      for (const r of targets) {
        logs.push(await this.prisma.resultSmsLog.create({ data: {
          schoolId, classId, termId, studentId: r.studentId, parentId: r.parentId, parentName: r.parentName, studentName: r.studentName,
          admissionNumber: r.admissionNumber, phoneNumber: r.phoneNumber, message: r.message, status: 'PROVIDER_ERROR', failureCode: 'PROVIDER_NOT_CONFIGURED',
          errorMessage: 'SMS provider is not configured for this school.', errorSuggestion: 'Configure an SMS provider in Communications Settings.', resultVersion: r.resultVersion, initiatedById: userId, messageHash: this.hash(r.message), batchId, failedAt: new Date(),
        } }));
      }
      return { success: false, batchId, total: targets.length, sent: 0, failed: targets.length, skipped: preview.recipients.length - targets.length, estimatedUnits: preview.estimatedUnits, logs, message: error.message };
    }
    for (const r of targets) {
      let result: any;
      let providerName: string | undefined;
      try {
        const sent = await provider.send({ to: r.phoneNumber, body: r.message });
        result = { success: sent.success, id: sent.providerMessageId || sent.messageId, error: sent.error, response: JSON.stringify(sent) };
        providerName = sent.provider || 'sms-provider';
      } catch (error: any) { result = { success: false, error: error.message, response: error.stack }; }
      logs.push(await this.prisma.resultSmsLog.create({ data: {
        schoolId, classId, termId, studentId: r.studentId, parentId: r.parentId, parentName: r.parentName, studentName: r.studentName,
        admissionNumber: r.admissionNumber, phoneNumber: r.phoneNumber, message: r.message, status: result.success ? 'SENT' : this.failureStatus(result.error),
        provider: providerName, providerMessageId: result.id, providerResponse: result.response, errorMessage: result.success ? undefined : this.diagnostic(result.error).message,
        errorSuggestion: result.success ? undefined : this.diagnostic(result.error).action, failureCode: result.success ? undefined : this.diagnostic(result.error).code,
        resultVersion: r.resultVersion, initiatedById: userId, messageHash: this.hash(r.message), batchId, sentAt: result.success ? new Date() : undefined, failedAt: result.success ? undefined : new Date(), retryCount: 0,
      } }));
    }
    const sent = logs.filter((l) => l.status === 'SENT').length;
    return { success: sent === targets.length, batchId, total: targets.length, sent, failed: targets.length - sent, skipped: preview.recipients.length - targets.length, estimatedUnits: preview.estimatedUnits, logs };
  }

  async retryLog(schoolId: string, id: string, userId: string) {
    const log = await this.prisma.resultSmsLog.findFirst({ where: { id, schoolId } });
    if (!log) throw new NotFoundException('SMS log not found');
    if (!['FAILED', 'REJECTED', 'INVALID_NUMBER', 'PROVIDER_ERROR'].includes(log.status)) throw new BadRequestException('Only failed messages can be retried.');
    const result = await this.sendResultsSms(schoolId, log.classId, log.termId, userId, { studentIds: [log.studentId], parentIds: log.parentId ? [log.parentId] : [], allowResend: true });
    await this.prisma.resultSmsLog.update({ where: { id }, data: { retryCount: { increment: 1 } } });
    return result;
  }

  async getBatchLogs(schoolId: string, batchId: string) { return this.prisma.resultSmsLog.findMany({ where: { schoolId, batchId }, orderBy: { createdAt: 'desc' } }); }
  async getHistory(schoolId: string, classId?: string, termId?: string) {
    const logs = await this.prisma.resultSmsLog.findMany({ where: { schoolId, ...(classId ? { classId } : {}), ...(termId ? { termId } : {}) }, orderBy: { createdAt: 'desc' } });
    const batches = new Map<string, any>();
    for (const log of logs) { const key = log.batchId || 'UNKNOWN'; const b = batches.get(key) || { batchId: key, createdAt: log.createdAt, total: 0, sent: 0, delivered: 0, pending: 0, failed: 0, skipped: 0, units: 0 }; b.total++; b.units += Math.max(1, Math.ceil(log.message.length / SINGLE_SMS_LIMIT)); if (log.status === 'SENT') b.sent++; else if (log.status === 'DELIVERED') b.delivered++; else if (['FAILED', 'REJECTED', 'INVALID_NUMBER', 'PROVIDER_ERROR'].includes(log.status)) b.failed++; else if (log.status === 'SKIPPED') b.skipped++; else b.pending++; batches.set(key, b); }
    return Array.from(batches.values());
  }
  async getLogById(schoolId: string, id: string) { const log = await this.prisma.resultSmsLog.findFirst({ where: { id, schoolId } }); if (!log) throw new NotFoundException('SMS log not found'); return log; }
  async updateDeliveryStatus(schoolId: string, id: string, status: string, providerResponse?: string) {
    const allowed = ['PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'REJECTED', 'INVALID_NUMBER', 'INSUFFICIENT_BALANCE', 'PROVIDER_ERROR', 'OPTED_OUT'];
    const normalized = status.toUpperCase();
    if (!allowed.includes(normalized)) throw new BadRequestException('Unsupported delivery status.');
    const log = await this.prisma.resultSmsLog.findFirst({ where: { id, schoolId } });
    if (!log) throw new NotFoundException('SMS log not found');
    return this.prisma.resultSmsLog.update({ where: { id }, data: { status: normalized, providerResponse, deliveredAt: normalized === 'DELIVERED' ? new Date() : undefined, failedAt: ['FAILED', 'REJECTED', 'PROVIDER_ERROR'].includes(normalized) ? new Date() : undefined } });
  }
  async getFailedLogs(schoolId: string, batchId?: string) { return this.prisma.resultSmsLog.findMany({ where: { schoolId, ...(batchId ? { batchId } : {}), status: { in: ['FAILED', 'REJECTED', 'INVALID_NUMBER', 'PROVIDER_ERROR', 'SKIPPED'] } }, orderBy: { createdAt: 'desc' } }); }
  async getSmsSettings(schoolId: string) { return this.prisma.communicationSettings.findUnique({ where: { schoolId }, select: { smsEnabled: true, smsProvider: true, smsSenderId: true } }); }
  async getDashboard(schoolId: string) { const [settings, logs] = await Promise.all([this.getSmsSettings(schoolId), this.prisma.resultSmsLog.findMany({ where: { schoolId }, select: { status: true, message: true } })]); const sent = logs.filter((l) => ['SENT', 'DELIVERED'].includes(l.status)).length; return { smsEnabled: settings?.smsEnabled ?? false, provider: settings?.smsProvider ?? null, balance: await this.getBalance(schoolId), total: logs.length, sent, delivered: logs.filter((l) => l.status === 'DELIVERED').length, failed: logs.filter((l) => ['FAILED', 'REJECTED', 'INVALID_NUMBER', 'PROVIDER_ERROR'].includes(l.status)).length, pending: logs.filter((l) => ['PENDING', 'QUEUED'].includes(l.status)).length, usedUnits: logs.reduce((n, l) => n + Math.max(1, Math.ceil(l.message.length / SINGLE_SMS_LIMIT)), 0), deliveryRate: sent ? Math.round((logs.filter((l) => l.status === 'DELIVERED').length / sent) * 100) : 0 }; }
  async autoSendOnPublish(schoolId: string, classId: string, termId: string, userId: string) { const settings = await this.getSmsSettings(schoolId); return settings?.smsEnabled ? this.sendResultsSms(schoolId, classId, termId, userId) : null; }

  private async resolveProvider(schoolId: string): Promise<SmsProvider> { try { const provider = await this.smsProviderFactory.getSchoolSmsProvider(schoolId); if (!provider) throw new Error('SMS provider is not configured.'); return provider; } catch (e: any) { throw new BadRequestException({ code: 'PROVIDER_NOT_CONFIGURED', message: e.message || 'Configure an SMS provider in Communications Settings.' }); } }
  private async getBalance(schoolId: string) { try { const p = await this.smsProviderFactory.getSchoolSmsProvider(schoolId); return await p.getBalance(); } catch { return null; } }
  private emptyPreview() { return { totalStudents: 0, totalRecipients: 0, validRecipients: 0, missingPhone: 0, invalidPhone: 0, estimatedUnits: 0, multiSegment: false, recipients: [] }; }
  private formatMessage(school: string, student: any, className: string | undefined, term: string | undefined, result: any) {
    const subjects = result.subjects.map((s: any) => {
      const label = this.subjectShortcut(s.name);
      if (result.points != null) return `${label} ${s.points ?? '-'}`;
      return `${label} ${s.absent ? 'ABS' : s.mark == null ? '-' : Number(s.mark.toFixed(1))}`;
    }).join(', ');
    const overall = [
      result.total != null ? `Total ${result.total}` : '',
      result.points != null ? `Points ${result.points}` : '',
      result.overall != null ? `Avg ${result.overall}%` : '',
      result.grade ? `Grade ${result.grade}` : '',
      result.division ? `Div ${result.division}` : '',
      result.position ? `Pos ${result.position}${result.classSize ? `/${result.classSize}` : ''}` : '',
      result.attendance != null ? `Att ${Number(result.attendance.toFixed(1))}%` : '',
    ].filter(Boolean).join('. ');
    return `${school}: ${student.firstName} ${student.lastName} (${student.admissionNumber || 'N/A'}), ${className || 'Class'}, ${term || 'Results'}: ${subjects}. ${overall}. Report: app.smarttechsaas.com`;
  }
  private subjectShortcut(name: string) {
    const normalized = name.trim().toLowerCase();
    const known: Record<string, string> = {
      english: 'Eng', 'english language': 'Eng', mathematics: 'Math', maths: 'Math', science: 'Sci',
      'social studies': 'SS', 'religious education': 'RE', 'computer studies': 'Comp', 'computer science': 'Comp',
      biology: 'Bio', chemistry: 'Chem', physics: 'Phys', geography: 'Geo', history: 'Hist',
      'civic education': 'Civ', 'business studies': 'Bus', accounting: 'Acct', economics: 'Econ',
    };
    if (known[normalized]) return known[normalized];
    const words = name.split(/\s+/).filter(Boolean);
    return words.length > 1 ? words.map((word) => word[0]).join('').slice(0, 4).toUpperCase() : name.slice(0, 5);
  }
  private isValidPhone(phone: string) { return /^\+?\d{9,15}$/.test(phone.replace(/[\s\-\(\)]/g, '')); }
  private hash(message: string) { return createHash('sha256').update(message).digest('hex'); }
  private failureStatus(error?: string) { const code = this.diagnostic(error).code; return code === 'INVALID_PHONE_NUMBER' ? 'INVALID_NUMBER' : code === 'INSUFFICIENT_BALANCE' ? 'INSUFFICIENT_BALANCE' : code === 'RATE_LIMITED' ? 'QUEUED' : 'PROVIDER_ERROR'; }
  private diagnostic(error?: string) { const e = (error || '').toLowerCase(); if (e.includes('balance') || e.includes('credit')) return { code: 'INSUFFICIENT_BALANCE', message: 'School SMS balance is insufficient.', action: 'Top up SMS units in Communications Wallet.' }; if (e.includes('invalid') || e.includes('number')) return { code: 'INVALID_PHONE_NUMBER', message: 'Parent phone number is invalid.', action: 'Update the parent phone number in Parent Management.' }; if (e.includes('rate')) return { code: 'RATE_LIMITED', message: 'Provider rate limit reached.', action: 'Retry after the provider window resets.' }; if (e.includes('timeout') || e.includes('network')) return { code: 'PROVIDER_ERROR', message: 'SMS provider timed out or returned an error.', action: 'Check provider status and retry later.' }; return { code: 'PROVIDER_ERROR', message: 'SMS provider returned an error.', action: 'Check provider configuration and retry later.' }; }
}
