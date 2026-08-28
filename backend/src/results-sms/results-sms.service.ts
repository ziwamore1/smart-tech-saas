import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProviderFactory } from '../communications-cloud/providers/sms/sms-provider.factory';
import { SmsProvider } from '../communications-cloud/interfaces/provider.interface';
import { CompositeSubjectService } from '../composite-subject/composite-subject.service';
import { mapBounded } from '../common/utils/concurrency.util';
import { QueuesService } from '../queues/queues.service';
import { QUEUE_NAMES } from '../queues/queue-definitions';

const SINGLE_SMS_LIMIT = 160;

@Injectable()
export class ResultsSmsService {
  private readonly logger = new Logger(ResultsSmsService.name);

  constructor(
    private prisma: PrismaService,
    private smsProviderFactory: SmsProviderFactory,
    private compositeSubjectService: CompositeSubjectService,
    private queuesService: QueuesService,
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

    const priorSent = new Map<string, { id: string; status: string; sentAt: Date | null }>();
    for (const prior of await this.prisma.resultSmsLog.findMany({
      where: { schoolId, termId, status: { in: ['SENT', 'DELIVERED'] } },
      select: { studentId: true, resultVersion: true, id: true, status: true, sentAt: true },
    })) {
      const key = `${prior.studentId}:${prior.resultVersion}`;
      if (!priorSent.has(key)) priorSent.set(key, { id: prior.id, status: prior.status, sentAt: prior.sentAt });
    }

    const averages = new Map<string, number>();
    for (const student of students) {
      const rows = computed.filter((r) => r.studentId === student.id && r.finalPercentage != null);
      if (rows.length) averages.set(student.id, rows.reduce((sum, row) => sum + (row.finalPercentage || 0), 0) / rows.length);
    }
    const ranking = Array.from(averages.entries()).sort((a, b) => b[1] - a[1]);
    const positions = new Map<string, number>();
    let lastAverage: number | null = null;
    let lastPosition = 0;
    ranking.forEach(([studentId, average], index) => {
      if (lastAverage === null || Math.abs(average - lastAverage) > 0.001) {
        lastPosition = index + 1;
        lastAverage = average;
      }
      positions.set(studentId, lastPosition);
    });

    const compositesByStudent = new Map<string, any[]>();
    const computedComposites = await mapBounded(students, (student) =>
      this.compositeSubjectService.getCompositeResultsForStudent(student.id, termId, classId, schoolId),
    );
    computedComposites.forEach((comps, i) => compositesByStudent.set(students[i].id, comps));

    const recipients: any[] = [];
    for (const student of students) {
      const rows = computed.filter((r) => r.studentId === student.id);
      if (!rows.length) continue;
      const summary = summaries.find((s) => s.studentId === student.id);
      const isPrimary = school?.institutionType?.code === 'PRIMARY_SCHOOL';
      const officialSubjects = rows.map((row) => ({
        subjectName: row.subject.name,
        subjectCode: row.subject.code,
        totalRawScore: row.totalRawScore,
        finalPercentage: row.finalPercentage,
        finalGrade: row.finalGrade,
        finalRemark: row.finalRemark,
        points: row.points,
        isAbsent: row.isAbsent,
      })).map((subject: any) => ({
        name: subject.subjectName,
        code: subject.subjectCode,
        mark: isPrimary ? subject.totalRawScore : null,
        grade: subject.finalGrade,
        remark: subject.finalRemark,
        points: subject.points,
        absent: subject.isAbsent ?? false,
      }));

      // Replace component subjects with composite subjects (e.g. Physics+Chemistry → Science)
      const composites = compositesByStudent.get(student.id) ?? [];
      if (composites.length > 0) {
        const componentIds = new Set<string>();
        for (const comp of composites) {
          for (const c of comp.components) componentIds.add(c.subjectId);
        }
        const filtered = officialSubjects.filter((s: any) => {
          const matchingRow = rows.find((r) => r.subject.name === s.name || r.subject.code === s.code);
          return !matchingRow || !componentIds.has(matchingRow.subjectId);
        });
        for (const comp of composites) {
          filtered.push({
            name: comp.composite.name,
            code: comp.composite.code,
            mark: isPrimary ? comp.finalPercentage : null,
            grade: comp.finalGrade,
            remark: null,
            points: null,
            absent: comp.finalPercentage == null,
          });
        }
        officialSubjects.length = 0;
        officialSubjects.push(...filtered);
      }

      const subjectPoints = officialSubjects.map((s: any) => s.points).filter((p: any) => p != null);
      const bestSix = isPrimary || subjectPoints.length === 0
        ? null
        : subjectPoints.slice().sort((a: number, b: number) => a - b).slice(0, 6).reduce((sum: number, p: number) => sum + p, 0);
      const version = createHash('sha256').update(JSON.stringify({ rows, summary })).digest('hex');
      const result = {
        subjects: officialSubjects,
        total: isPrimary ? Number(officialSubjects.reduce((sum: number, subject: any) => sum + (subject.mark || 0), 0).toFixed(1)) : null,
        bestSix,
        overall: summary?.overallPercentage != null
          ? Number(summary.overallPercentage.toFixed(1))
          : averages.get(student.id) == null ? null : Number(averages.get(student.id)!.toFixed(1)),
        grade: summary?.overallGrade ?? null,
        division: (summary?.competencyScores as any)?.division ?? null,
        position: positions.get(student.id) ?? null,
        classSize: ranking.length || summary?.classSize || undefined,
        attendance: summary?.attendanceRate ?? null,
      };
      const message = this.formatMessage(student, klass?.name, term?.name, result);
      const length = message.length;
      const existing = priorSent.get(`${student.id}:${version}`);
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
      multiSegment: valid.some((r) => r.segments > 1), recipients,
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
    logs.push(...(await mapBounded(
      preview.recipients.filter((item) => !targets.includes(item)),
      (r) => this.prisma.resultSmsLog.create({ data: {
        schoolId, classId, termId, studentId: r.studentId, parentId: r.parentId, parentName: r.parentName, studentName: r.studentName,
        admissionNumber: r.admissionNumber, phoneNumber: r.phoneNumber, message: r.message, status: 'SKIPPED', failureCode: r.errorCode || 'NO_PHONE_NUMBER',
        errorMessage: r.errorCode === 'INVALID_PHONE_NUMBER' ? 'Parent phone number is invalid.' : 'No parent phone number is registered.', errorSuggestion: r.errorSuggestion,
        resultVersion: r.resultVersion, initiatedById: userId, messageHash: this.hash(r.message), batchId, retryCount: 0,
      } }),
    )));
    const queuedLogs = await mapBounded(targets, (r) => this.prisma.resultSmsLog.create({ data: {
      schoolId, classId, termId, studentId: r.studentId, parentId: r.parentId, parentName: r.parentName, studentName: r.studentName,
      admissionNumber: r.admissionNumber, phoneNumber: r.phoneNumber, message: r.message, status: 'QUEUED',
      resultVersion: r.resultVersion, initiatedById: userId, messageHash: this.hash(r.message), batchId, retryCount: 0,
    } }));
    logs.push(...queuedLogs);
    const job = await this.queuesService.addJob(QUEUE_NAMES.RESULTS_SMS, 'send-results', {
      schoolId,
      batchId,
      logs: queuedLogs.map((log, index) => ({ id: log.id, recipient: targets[index] })),
    }, { jobId: batchId });
    if (!job) throw new Error('Redis is unavailable; results SMS was not queued.');
    return { success: true, batchId, total: targets.length, sent: 0, queued: targets.length, failed: 0, skipped: preview.recipients.length - targets.length, estimatedUnits: preview.estimatedUnits, logs };
  }

  async processQueuedBatch(data: { schoolId: string; logs: Array<{ id: string; recipient: any }> }) {
    const provider = await this.resolveProvider(data.schoolId);
    await mapBounded(data.logs, async ({ id, recipient }) => {
      let result: any;
      let providerName: string | undefined;
      try {
        const sent = await provider.send({ to: recipient.phoneNumber, body: recipient.message });
        result = { success: sent.success, id: sent.providerMessageId || sent.messageId, error: sent.error, response: JSON.stringify(sent) };
        providerName = sent.provider || 'sms-provider';
      } catch (error: any) { result = { success: false, error: error.message, response: error.stack }; }
      await this.prisma.resultSmsLog.update({ where: { id }, data: {
        status: result.success ? 'SENT' : this.failureStatus(result.error), provider: providerName,
        providerMessageId: result.id, providerResponse: result.response,
        errorMessage: result.success ? null : this.diagnostic(result.error).message,
        errorSuggestion: result.success ? null : this.diagnostic(result.error).action,
        failureCode: result.success ? null : this.diagnostic(result.error).code,
        sentAt: result.success ? new Date() : null, failedAt: result.success ? null : new Date(),
      } });
    });
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
  private formatMessage(student: any, className: string | undefined, term: string | undefined, result: any) {
    const subjects = result.subjects.map((s: any) => {
      const label = this.subjectShortcut(s.name);
      if (result.bestSix != null) return `${label} ${s.points ?? '-'}`;
      return `${label} ${s.absent ? 'ABS' : s.mark == null ? '-' : Number(s.mark.toFixed(1))}`;
    }).join(', ');
    const overall = [
      result.total != null ? `Total ${result.total}` : '',
      result.bestSix != null ? `Pts ${result.bestSix}` : '',
      result.overall != null ? `Avg ${result.overall}%` : '',
      result.grade ? `Grade ${result.grade}` : '',
      result.division ? `Div ${result.division}` : '',
      result.position ? `Pos ${result.position}${result.classSize ? `/${result.classSize}` : ''}` : '',
      result.attendance != null ? `Att ${Number(result.attendance.toFixed(1))}%` : '',
    ].filter(Boolean).join(', ');
    let message = `${student.firstName} ${student.lastName} (${student.admissionNumber || 'N/A'}), ${className || 'Class'}, ${term || 'Results'}: ${subjects}. ${overall}. app.smarttechsaas.com`;
    if (message.length > SINGLE_SMS_LIMIT && result.classSize) message = message.replace(`/${result.classSize}`, '');
    if (message.length > SINGLE_SMS_LIMIT) message = message.replace(/,\s*Att [\d.]+%/, '');
    return message;
  }
  private subjectShortcut(name: string) {
    const normalized = name.trim().toLowerCase();
    const known: Record<string, string> = {
      english: 'Eng', 'english language': 'Eng', mathematics: 'Math', maths: 'Math', science: 'Sci',
      'social studies': 'SS', 'religious education': 'RE', 'computer studies': 'Comp', 'computer science': 'Comp',
      biology: 'Bio', chemistry: 'Chem', physics: 'Phys', geography: 'Geo', history: 'Hist',
      'civic education': 'Civ', 'business studies': 'Bus', accounting: 'Acct', economics: 'Econ',
      'mathematics i': 'MI', 'mathematics ii': 'MII', 'maths i': 'MI', 'maths ii': 'MII',
      'information and communication technology': 'ICT', 'information and communications technology': 'ICT', 'ict': 'ICT',
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
