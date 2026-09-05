import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProviderFactory } from '../communications-cloud/providers/sms/sms-provider.factory';
import { SmsProvider } from '../communications-cloud/interfaces/provider.interface';
import { CompositeSubjectService } from '../composite-subject/composite-subject.service';
import { mapBounded } from '../common/utils/concurrency.util';
import { normalizeZambianPhone } from '../common/utils/phone.util';
import { QueuesService } from '../queues/queues.service';
import { QUEUE_NAMES } from '../queues/queue-definitions';

const SINGLE_SMS_LIMIT = 160;

export const RESULTS_SMS_BATCH_STATUSES = {
  ACTIVE: ['QUEUED', 'STARTING', 'PROCESSING'] as string[],
  TERMINAL: ['COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED', 'CANCELLED'] as string[],
} as const;

const SENT_STATUSES = ['SENT', 'DELIVERED'];
const FAILED_STATUSES = ['FAILED', 'REJECTED', 'INVALID_NUMBER', 'PROVIDER_ERROR', 'INSUFFICIENT_BALANCE', 'OPTED_OUT'];

/** How long a batch may show zero activity before it is considered stalled. */
export const resultsSmsStallMs = () => parseInt(process.env.RESULTS_SMS_STALL_MS ?? '90000', 10);
/** How long a queued batch may wait for a dedicated worker before the scheduler takes over. */
export const resultsSmsQueueGraceMs = () => parseInt(process.env.RESULTS_SMS_QUEUE_GRACE_MS ?? '15000', 10);
/** Maximum attempts per recipient for transient failures (timeout, network, rate limit). */
export const resultsSmsMaxRetries = () => parseInt(process.env.RESULTS_SMS_MAX_RETRIES ?? '3', 10);
/** Base backoff for retries: base * 2^retryCount milliseconds. */
export const resultsSmsRetryBaseDelayMs = () => parseInt(process.env.RESULTS_SMS_RETRY_BASE_DELAY_MS ?? '5000', 10);

@Injectable()
export class ResultsSmsService {
  private readonly logger = new Logger(ResultsSmsService.name);

  constructor(
    private prisma: PrismaService,
    private smsProviderFactory: SmsProviderFactory,
    private compositeSubjectService: CompositeSubjectService,
    private queuesService: QueuesService,
  ) {}

  /** Builds the per-student subject list exactly like the results sheet, then formats and sends the SMS. */
  async getRecipients(schoolId: string, classId: string, termId: string, studentIds?: string[]) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, ...(studentIds?.length ? { id: { in: studentIds } } : {}), enrollments: { some: { classId, status: 'ACTIVE' } } },
      select: {
        id: true, firstName: true, lastName: true, admissionNumber: true,
        parents: { select: { parent: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
      },
    });
    if (!students.length) return this.emptyPreview();

    const studentIdsArr = students.map((s) => s.id);
    // The subject list and every subject mark mirror the results sheet exactly:
    // computed rows take precedence, then legacy single scores, then component
    // marks aggregated into a weighted percentage. The SMS is therefore never able
    // to omit a subject the teacher sees on the results table, and it never shows
    // a raw sum of component scores in place of the computed result.
    const computed = await this.prisma.computedResult.findMany({
      where: {
        schoolId, classId, termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        studentId: { in: studentIdsArr },
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    });
    const rawResults = await this.prisma.result.findMany({
      where: { schoolId, termId, studentId: { in: studentIdsArr }, student: { status: 'ACTIVE' } },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });
    const componentResults = await this.prisma.studentAssessmentResult.findMany({
      where: {
        studentId: { in: studentIdsArr }, classId, termId,
        OR: [{ rawScore: { not: null } }, { isAbsent: true }],
        student: { status: 'ACTIVE' },
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const rawResultMap = new Map<string, { score: number | null; grade: string | null; remark: string | null; subjectId: string; subject: any }>();
    for (const r of rawResults) {
      rawResultMap.set(`${r.studentId}::${r.subjectId}`, { score: r.score, grade: r.grade, remark: r.remark, subjectId: r.subjectId, subject: r.subject });
    }

    const configSubjectIds = [...new Set(componentResults.map((c) => c.subjectId))];
    const configs = configSubjectIds.length > 0
      ? await this.prisma.termAssessmentConfiguration.findMany({ where: { classId, termId, subjectId: { in: configSubjectIds } } })
      : [];
    const configMap = new Map<string, { assessmentDefId: string; maxScore: number; weightPercentage: number }[]>();
    for (const cfg of configs) {
      const arr = configMap.get(cfg.subjectId) || [];
      arr.push({ assessmentDefId: cfg.assessmentDefId, maxScore: cfg.maxScore, weightPercentage: cfg.weightPercentage });
      configMap.set(cfg.subjectId, arr);
    }

    const componentAggMap = new Map<string, { studentId: string; subjectId: string; subject: any; entries: any[] }>();
    for (const result of componentResults) {
      const key = `${result.studentId}::${result.subjectId}`;
      const existing = componentAggMap.get(key);
      if (!existing) componentAggMap.set(key, { studentId: result.studentId, subjectId: result.subjectId, subject: result.subject, entries: [result] });
      else existing.entries.push(result);
    }

    const baseByStudent = new Map<string, any[]>();
    for (const student of students) {
      baseByStudent.set(student.id, this.buildBaseSubjects(student.id, computed, rawResultMap, componentAggMap, configMap));
    }

    const summaries = await this.prisma.termSummary.findMany({
      where: { schoolId, classId, termId, studentId: { in: studentIdsArr } },
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
    for (const [studentId, base] of baseByStudent) {
      const marks = base.filter((s) => !s.absent && s.mark != null).map((s) => Number(s.mark));
      if (marks.length) averages.set(studentId, marks.reduce((sum, m) => sum + m, 0) / marks.length);
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
      const base = baseByStudent.get(student.id) ?? [];
      if (!base.length) continue;
      const summary = summaries.find((s) => s.studentId === student.id);
      const isPrimary = school?.institutionType?.code === 'PRIMARY_SCHOOL';
      const officialSubjects = base.map((subject: any) => ({
        name: subject.subjectName,
        code: subject.subjectCode,
        mark: subject.mark,
        grade: subject.grade,
        remark: subject.remark,
        points: subject.points,
        absent: subject.absent ?? false,
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
            mark: comp.finalPercentage,
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
      const version = createHash('sha256').update(JSON.stringify({ base, summary, subjects: officialSubjects })).digest('hex');
      const result = {
        subjects: officialSubjects,
        total: isPrimary ? Number(officialSubjects.reduce((sum: number, subject: any) => sum + (subject.mark || 0), 0).toFixed(1)) : null,
        bestSix,
        overall: summary?.overallPercentage != null
          ? Number(summary.overallPercentage.toFixed(1))
          : averages.get(student.id) == null ? null : Number(averages.get(student.id)!.toFixed(1)),
        grade: summary?.overallGrade ?? null,
        division: (summary?.competencyScores as any)?.division ?? null,
        position: summary?.classRank ?? positions.get(student.id) ?? null,
        classSize: summary?.classSize || ranking.length || undefined,
        attendance: summary?.attendanceRate ?? null,
      };
      const message = this.formatMessage(student, klass?.name, term?.name, result);
      const length = message.length;
      const existing = priorSent.get(`${student.id}:${version}`);
      for (const link of student.parents) {
        const parent = link.parent;
        const normalizedPhone = normalizeZambianPhone(parent.phone);
        const phoneStatus = normalizedPhone == null ? 'MISSING' : this.isValidPhone(normalizedPhone) ? 'VALID' : 'INVALID';
        recipients.push({
          parentId: parent.id, parentName: `${parent.firstName} ${parent.lastName}`, studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`, admissionNumber: student.admissionNumber,
          phoneNumber: normalizedPhone, phoneStatus, message, result, resultVersion: version,
          characters: length, segments: Math.max(1, Math.ceil(length / SINGLE_SMS_LIMIT)), estimatedUnits: Math.max(1, Math.ceil(length / SINGLE_SMS_LIMIT)),
          alreadySent: Boolean(existing), previousStatus: existing?.status ?? null,
          errorCode: normalizedPhone == null ? 'NO_PHONE_NUMBER' : phoneStatus === 'INVALID' ? 'INVALID_PHONE_NUMBER' : undefined,
          errorSuggestion: normalizedPhone == null ? 'Add a parent phone number in Parent Management.' : phoneStatus === 'INVALID' ? 'Use an international phone number, for example +260XXXXXXXXX.' : undefined,
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

  private buildBaseSubjects(
    studentId: string,
    computed: any[],
    rawResultMap: Map<string, { score: number | null; grade: string | null; remark: string | null; subjectId: string; subject: any }>,
    componentAggMap: Map<string, { studentId: string; subjectId: string; subject: any; entries: any[] }>,
    configMap: Map<string, { assessmentDefId: string; maxScore: number; weightPercentage: number }[]>,
  ): any[] {
    const rows = computed.filter((r) => r.studentId === studentId);
    const base: any[] = [];
    const crSubjects = new Set<string>();

    // Computed final results take precedence.
    for (const cr of rows) {
      // Skip empty phantom rows (the results sheet deletes these): a subject with
      // neither a final percentage, a raw score, nor an absence flag renders nothing.
      if (cr.finalPercentage == null && !cr.totalRawScore && !cr.isAbsent) continue;
      crSubjects.add(cr.subjectId);
      let mark = cr.finalPercentage;
      if (mark == null) {
        // Never fall back to the raw sum of component scores; derive the weighted
        // component percentage exactly like the results sheet, else the legacy score.
        mark = this.componentAggregateMark(studentId, cr.subjectId, componentAggMap, configMap)
          ?? rawResultMap.get(`${studentId}::${cr.subjectId}`)?.score ?? null;
      }
      base.push({
        subjectName: cr.subject.name,
        subjectCode: cr.subject.code,
        mark,
        grade: cr.finalGrade,
        remark: cr.finalRemark,
        points: cr.points,
        absent: cr.isAbsent ?? false,
      });
    }

    // Legacy single-score records for subjects that never received a computed row.
    for (const [key, raw] of rawResultMap) {
      if (key.startsWith(`${studentId}::`) && !crSubjects.has(raw.subjectId)) {
        base.push({
          subjectName: raw.subject.name,
          subjectCode: raw.subject.code,
          mark: raw.score ?? null,
          grade: raw.grade ?? null,
          remark: raw.remark ?? null,
          points: null,
          absent: false,
        });
      }
    }

    // Marks entered against assessment definitions, aggregated into a weighted
    // percentage — again mirroring the results sheet.
    for (const [key, agg] of componentAggMap) {
      if (!key.startsWith(`${studentId}::`) || crSubjects.has(agg.subjectId) || rawResultMap.has(key)) continue;
      const { mark, absent } = this.aggregateComponents(agg, configMap);
      base.push({
        subjectName: agg.subject.name,
        subjectCode: agg.subject.code,
        mark,
        grade: agg.entries[0]?.grade ?? null,
        remark: agg.entries[0]?.remarks ?? null,
        points: null,
        absent,
      });
    }

    return base.sort((a: any, b: any) => a.subjectName.localeCompare(b.subjectName));
  }

  private componentAggregateMark(
    studentId: string,
    subjectId: string,
    componentAggMap: Map<string, any>,
    configMap: Map<string, { assessmentDefId: string; maxScore: number; weightPercentage: number }[]>,
  ): number | null {
    const agg = componentAggMap.get(`${studentId}::${subjectId}`);
    if (!agg || agg.entries.every((e: any) => e.isAbsent)) return null;
    return this.aggregateComponents(agg, configMap).mark;
  }

  private aggregateComponents(
    agg: any,
    configMap: Map<string, { assessmentDefId: string; maxScore: number; weightPercentage: number }[]>,
  ): { mark: number | null; absent: boolean } {
    const subjectConfigs = configMap.get(agg.subjectId) || [];
    const absent = agg.entries.length > 0 && agg.entries.every((e: any) => e.isAbsent);
    let totalWeighted = 0;
    let totalWeight = 0;
    for (const entry of agg.entries) {
      if (entry.isAbsent) continue;
      const cfg = subjectConfigs.find((c) => c.assessmentDefId === entry.assessmentDefId);
      const maxScore = cfg?.maxScore || entry.maxScore || 100;
      const weight = cfg?.weightPercentage || 0;
      if (entry.rawScore != null && weight > 0) {
        totalWeighted += ((entry.rawScore / maxScore) * 100) * (weight / 100);
        totalWeight += weight;
      }
    }
    const mark = totalWeight > 0 ? parseFloat(((totalWeighted / totalWeight) * 100).toFixed(2)) : null;
    return { mark, absent };
  }

  async sendResultsSms(schoolId: string, classId: string, termId: string, userId: string, options?: {
    parentIds?: string[]; studentIds?: string[]; allowResend?: boolean;
  }) {
    const preview = await this.getRecipients(schoolId, classId, termId, options?.studentIds);
    const targets = preview.recipients.filter((r) => (!options?.parentIds?.length || options.parentIds.includes(r.parentId)) && r.phoneStatus === 'VALID');
    if (!targets.length) throw new BadRequestException('No valid parent phone numbers are available for this send.');
    if (!options?.allowResend && targets.some((r) => r.alreadySent)) {
      throw new BadRequestException({ code: 'DUPLICATE_RESULT_SMS', message: 'One or more selected results were already sent. Confirm resend explicitly.', alreadySent: targets.filter((r) => r.alreadySent).map((r) => r.studentId) });
    }

    // Refuse to queue a second batch for the same class/term while one is already
    // being processed — prevents accidental duplicate sends from double-clicking.
    const scoped = !options?.studentIds?.length && !options?.parentIds?.length;
    const active = await this.prisma.resultSmsBatch.findFirst({
      where: { schoolId, classId: classId || undefined, termId: termId || undefined, status: { in: RESULTS_SMS_BATCH_STATUSES.ACTIVE } },
    });
    if (active && scoped) {
      throw new BadRequestException({ code: 'DUPLICATE_BATCH', message: `A results SMS batch for this class is already being processed (${active.id}).`, batchId: active.id });
    }

    // Do not silently start a send the provider cannot afford.
    const balance = await this.getBalance(schoolId);
    if (balance && Number(balance.balance) <= 0) {
      throw new BadRequestException({ code: 'INSUFFICIENT_BALANCE', message: 'School SMS balance is 0 units. Top up SMS units in the Communications Wallet before sending.' });
    }

    const batchId = `RESULTS-${Date.now()}`;
    const skippedCount = preview.recipients.filter((item) => !targets.includes(item)).length;
    const estimatedUnits = preview.estimatedUnits;
    const now = new Date();

    await this.prisma.resultSmsBatch.create({
      data: {
        id: batchId, schoolId, classId: classId || null, termId: termId || null, initiatedById: userId,
        status: 'QUEUED', total: targets.length, skipped: skippedCount,
        queued: targets.length, pending: targets.length, progress: 0, estimatedUnits,
        queuedAt: now, lastActivityAt: now,
      },
    });
    this.logger.log(`Results SMS batch ${batchId} created for class ${classId}, term ${termId} (${targets.length} recipients)`);

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

    // Enqueue for background processing. The API returns here immediately; the
    // batch, not the request, is the source of truth for progress. If the queue
    // cannot accept the job we do NOT pretend it is being processed — the batch
    // stays QUEUED and the scheduled monitor will pick it up (or mark it failed),
    // so it is always observable.
    const payload = { batchId, schoolId, logs: queuedLogs.map((log, index) => ({ id: log.id, recipient: targets[index] })) };
    const job = await this.queuesService.addJob(QUEUE_NAMES.RESULTS_SMS, 'send-results', payload, { jobId: batchId });
    if (!job) {
      this.logger.warn(`Redis/BullMQ unavailable — batch ${batchId} will be picked up by the scheduled monitor`);
    }
    return { success: true, batchId, status: 'QUEUED', total: targets.length, sent: 0, failed: 0, queued: targets.length, pending: targets.length, skipped: skippedCount, estimatedUnits, logs };
  }

  /**
   * Processes a batch (or a sub-set of its recipients). Called by the BullMQ
   * worker and by the scheduled monitor during recovery. Safe to invoke
   * concurrently: each recipient is claimed atomically (QUEUED→SENDING), so a
   * restarted worker or a second processor can never send the same message twice.
   */
  async processQueuedBatch(data: { batchId?: string; schoolId: string; logs: Array<{ id: string; recipient: any }> }) {
    const batchId = data.batchId;
    const logIds = data.logs.map((log) => log.id);
    const now = new Date();
    if (batchId) {
      await this.prisma.resultSmsBatch.updateMany({
        where: { id: batchId, status: 'QUEUED' },
        data: { status: 'STARTING', startedAt: now, heartbeatAt: now, lastActivityAt: now },
      }).catch(() => {});
      await this.prisma.resultSmsBatch.updateMany({
        where: { id: batchId, status: { in: ['QUEUED', 'STARTING', 'PROCESSING'] } },
        data: { status: 'PROCESSING', heartbeatAt: now },
      }).catch(() => {});
    }

    let provider: SmsProvider;
    try {
      provider = await this.resolveProvider(data.schoolId);
    } catch (error: any) {
      const notConfigured = error?.response?.code === 'PROVIDER_NOT_CONFIGURED' || String(error?.message || '').includes('not configured');
      const code = notConfigured ? 'PROVIDER_NOT_CONFIGURED' : this.diagnostic(error.message).code;
      const message = notConfigured ? 'SMS provider is not configured for this school.' : this.diagnostic(error.message).message;
      const suggestion = notConfigured ? 'Configure an SMS provider in Communications Settings, then retry.' : this.diagnostic(error.message).action;
      await this.prisma.resultSmsLog.updateMany({
        where: { id: { in: logIds }, status: { in: ['PENDING', 'QUEUED', 'RETRYING', 'SENDING'] } },
        data: { status: 'PROVIDER_ERROR', failureCode: code, errorMessage: message, errorSuggestion: suggestion, failedAt: new Date() },
      });
      if (batchId) {
        await this.syncBatchCounts(batchId, data.schoolId);
        await this.failBatch(batchId, code, message, suggestion);
      }
      return;
    }

    try {
      await mapBounded(data.logs, async ({ id, recipient }) => {
        await this.processRecipient(batchId, data.schoolId, id, recipient, provider);
      });
    } catch (err) {
      this.logger.error(`Processing error for batch ${batchId}: ${(err as Error).message}`);
    } finally {
      if (batchId) await this.finalizeBatch(batchId, data.schoolId);
    }
  }

  /**
   * Sends one recipient's message with an atomic claim so concurrent processors
   * and restarts cannot double-send. Transient failures (timeout, network, rate
   * limit) are retried with backoff; permanent failures are marked terminal with
   * an actionable reason.
   */
  private async processRecipient(batchId: string | undefined, schoolId: string, logId: string, recipient: any, provider: SmsProvider) {
    const claim = await this.prisma.resultSmsLog.updateMany({
      where: { id: logId, status: { in: ['PENDING', 'QUEUED', 'RETRYING'] } },
      data: { status: 'SENDING', nextRetryAt: null },
    });
    if (claim.count === 0) return; // another worker already claimed/completed this recipient

    await this.touchBatch(batchId);
    this.logger.log(`Recipient ${logId} sending (batch ${batchId || 'n/a'})`);
    let result: any;
    let providerName: string | undefined;
    try {
      const sent = await provider.send({ to: recipient.phoneNumber, body: recipient.message });
      result = { success: sent.success, id: sent.providerMessageId || sent.messageId, error: sent.error, response: JSON.stringify(sent) };
      providerName = sent.provider || 'sms-provider';
    } catch (error: any) { result = { success: false, error: error.message, response: error.stack, provider: (error as any).provider }; }

    await this.touchBatch(batchId);
    if (result.success) {
      await this.prisma.resultSmsLog.update({ where: { id: logId }, data: {
        status: 'SENT', provider: providerName, providerMessageId: result.id, providerResponse: result.response,
        errorMessage: null, errorSuggestion: null, failureCode: null, sentAt: new Date(), failedAt: null, nextRetryAt: null,
      } });
      this.logger.log(`Recipient ${logId} sent (batch ${batchId || 'n/a'})`);
    } else {
      const diag = this.diagnostic(result.error);
      const isTransient = ['PROVIDER_ERROR', 'RATE_LIMITED'].includes(diag.code);
      const current = await this.prisma.resultSmsLog.findUnique({ where: { id: logId }, select: { retryCount: true } });
      const retryCount = current?.retryCount ?? 0;
      if (isTransient && retryCount < resultsSmsMaxRetries()) {
        const nextRetryAt = new Date(Date.now() + resultsSmsRetryBaseDelayMs() * Math.pow(2, retryCount));
        await this.prisma.resultSmsLog.update({ where: { id: logId }, data: {
          status: 'RETRYING', retryCount: { increment: 1 }, nextRetryAt, provider: providerName, providerResponse: result.response,
          failureCode: diag.code, errorMessage: diag.message, errorSuggestion: diag.action, failedAt: null, sentAt: null,
        } });
        this.logger.warn(`Recipient ${logId} transient failure (${diag.code}), retry ${retryCount + 1} scheduled (batch ${batchId || 'n/a'})`);
      } else {
        const finalStatus = this.failureStatus(result.error);
        await this.prisma.resultSmsLog.update({ where: { id: logId }, data: {
          status: finalStatus, retryCount: { increment: isTransient ? 1 : 0 }, nextRetryAt: null, provider: providerName,
          providerResponse: result.response, failureCode: diag.code, errorMessage: diag.message, errorSuggestion: diag.action,
          failedAt: new Date(), sentAt: null,
        } });
        this.logger.warn(`Recipient ${logId} failed (${diag.code}) (batch ${batchId || 'n/a'})`);
      }
    }
    await this.syncBatchCounts(batchId, schoolId);
  }

  private async touchBatch(batchId: string | undefined) {
    if (!batchId) return;
    await this.prisma.resultSmsBatch.update({ where: { id: batchId }, data: { heartbeatAt: new Date(), lastActivityAt: new Date() } }).catch(() => {});
  }

  /** Recomputes batch counters from the persisted recipient logs. The database is the source of truth. */
  async syncBatchCounts(batchId: string, schoolId: string) {
    const counts = await this.prisma.resultSmsLog.groupBy({ by: ['status'], where: { schoolId, batchId }, _count: { _all: true } });
    const c = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;
    const sent = c('SENT') + c('DELIVERED');
    const failed = FAILED_STATUSES.reduce((sum, s) => sum + c(s), 0);
    const retrying = c('RETRYING');
    const sending = c('SENDING');
    const queued = c('QUEUED') + c('PENDING');
    const skipped = c('SKIPPED');
    const total = sent + failed + retrying + sending + queued + skipped;
    const target = total - skipped;
    const progress = target ? Math.round(((sent + failed) / target) * 100) : 100;
    await this.prisma.resultSmsBatch.update({
      where: { id: batchId },
      data: {
        total, sent, failed, retrying, sending, queued, skipped,
        pending: queued + sending + retrying, progress,
        heartbeatAt: new Date(), lastActivityAt: new Date(),
      },
    }).catch(() => undefined);
  }

  /** Persists the batch terminal state once every recipient is terminal. */
  async finalizeBatch(batchId: string, schoolId: string) {
    await this.syncBatchCounts(batchId, schoolId);
    const batch = await this.prisma.resultSmsBatch.findUnique({ where: { id: batchId } }).catch(() => null);
    if (!batch || !RESULTS_SMS_BATCH_STATUSES.ACTIVE.includes(batch.status)) return;
    if (batch.pending > 0) return; // retries scheduled in the future or work still in flight
    const target = batch.total - batch.skipped;
    let status = 'COMPLETED';
    if (batch.failed > 0 && batch.sent > 0) status = 'COMPLETED_WITH_FAILURES';
    else if (batch.failed === Math.max(target, 0)) status = 'FAILED';
    await this.prisma.resultSmsBatch.update({
      where: { id: batchId },
      data: { status, completedAt: new Date(), heartbeatAt: new Date(), lastActivityAt: new Date() },
    }).catch(() => undefined);
    this.logger.log(`Results SMS batch ${batchId} completed as ${status} (${batch.sent} sent, ${batch.failed} failed, ${batch.skipped} skipped)`);
  }

  private async failBatch(batchId: string, errorCode: string, message: string, suggestion: string) {
    await this.prisma.resultSmsBatch.update({
      where: { id: batchId },
      data: { status: 'FAILED', errorCode, errorMessage: message, errorSuggestion: suggestion, completedAt: new Date(), heartbeatAt: new Date(), lastActivityAt: new Date() },
    }).catch(() => undefined);
  }

  /** Full persisted status of a batch with derived liveness/progress for the UI. */
  async getBatchStatus(schoolId: string, batchId: string) {
    const batch = await this.prisma.resultSmsBatch.findFirst({ where: { id: batchId, schoolId } });
    if (!batch) throw new NotFoundException('SMS batch not found');
    const counts = await this.prisma.resultSmsLog.groupBy({ by: ['status'], where: { schoolId, batchId }, _count: { _all: true } });
    const c = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;
    const sent = c('SENT') + c('DELIVERED');
    const failed = FAILED_STATUSES.reduce((sum, s) => sum + c(s), 0);
    const retrying = c('RETRYING');
    const sending = c('SENDING');
    const queued = c('QUEUED') + c('PENDING');
    const skipped = c('SKIPPED');
    const total = sent + failed + retrying + sending + queued + skipped;
    const target = Math.max(total - skipped, 0);
    const progress = target ? Math.round(((sent + failed) / target) * 100) : 100;
    const now = Date.now();
    const lastActivitySecondsAgo = Math.round((now - batch.lastActivityAt.getTime()) / 1000);
    const heartbeatSecondsAgo = batch.heartbeatAt ? Math.round((now - batch.heartbeatAt.getTime()) / 1000) : null;
    const terminal = RESULTS_SMS_BATCH_STATUSES.TERMINAL.includes(batch.status);
    const stallSeconds = Math.ceil(resultsSmsStallMs() / 1000);
    const stalled = !terminal && (lastActivitySecondsAgo >= stallSeconds || (heartbeatSecondsAgo !== null && heartbeatSecondsAgo >= stallSeconds));
    const workerAlive = !terminal && !stalled;
    return {
      batchId, status: batch.status, total, sent, failed, retrying, sending, queued, skipped,
      pending: queued + sending + retrying, progress, estimatedUnits: batch.estimatedUnits,
      queuedAt: batch.queuedAt, startedAt: batch.startedAt, completedAt: batch.completedAt,
      lastActivityAt: batch.lastActivityAt, heartbeatAt: batch.heartbeatAt,
      lastActivitySecondsAgo, heartbeatSecondsAgo, workerAlive, stalled,
      errorCode: batch.errorCode, errorMessage: batch.errorMessage, errorSuggestion: batch.errorSuggestion,
    };
  }

  async getRecentBatches(schoolId: string, limit = 25) {
    const batches = await this.prisma.resultSmsBatch.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' }, take: limit });
    return batches.map((b) => ({ ...b, active: RESULTS_SMS_BATCH_STATUSES.ACTIVE.includes(b.status) }));
  }

  async cancelBatch(schoolId: string, batchId: string) {
    const batch = await this.prisma.resultSmsBatch.findFirst({ where: { id: batchId, schoolId } });
    if (!batch) throw new NotFoundException('SMS batch not found');
    if (!RESULTS_SMS_BATCH_STATUSES.ACTIVE.includes(batch.status)) throw new BadRequestException('Only an active batch can be cancelled.');
    await this.prisma.resultSmsLog.updateMany({
      where: { schoolId, batchId, status: { in: ['QUEUED', 'PENDING', 'RETRYING'] } },
      data: { status: 'CANCELLED', errorMessage: 'Cancelled by an administrator.', failedAt: new Date() },
    });
    await this.prisma.resultSmsLog.updateMany({
      where: { schoolId, batchId, status: 'SENDING' },
      data: { status: 'PROVIDER_ERROR', failureCode: 'CANCELLED', errorMessage: 'Cancelled by an administrator while the message was in flight.', failedAt: new Date() },
    });
    await this.prisma.resultSmsBatch.update({ where: { id: batchId }, data: { status: 'CANCELLED', completedAt: new Date(), lastActivityAt: new Date() } });
    await this.syncBatchCounts(batchId, schoolId);
    return this.getBatchStatus(schoolId, batchId);
  }

  /** Controlled retry of a batch's failed messages: re-validates parent numbers and queues a fresh send. */
  async retryFailedBatch(schoolId: string, batchId: string, userId: string) {
    const batch = await this.prisma.resultSmsBatch.findFirst({ where: { id: batchId, schoolId } });
    if (!batch) throw new NotFoundException('SMS batch not found');
    const failedLogs = await this.prisma.resultSmsLog.findMany({
      where: { schoolId, batchId, status: { in: FAILED_STATUSES } },
      select: { studentId: true, classId: true, termId: true },
    });
    if (!failedLogs.length) throw new BadRequestException('No failed messages in this batch to retry.');
    const studentIds = [...new Set(failedLogs.map((l) => l.studentId))];
    const klass = batch.classId ?? failedLogs[0].classId;
    const term = batch.termId ?? failedLogs[0].termId;
    if (!klass || !term) throw new BadRequestException('The batch has no class/term to retry against.');
    return this.sendResultsSms(schoolId, klass, term, userId, { studentIds, allowResend: true });
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
      if (s.absent) return `${label} ABS`;
      const mark = s.mark != null ? Number(s.mark.toFixed(1)) : null;
      if (mark != null) return `${label} ${mark}`;
      return `${label} -`;
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
    // Trim optional parts when over budget, but always keep Pts, Avg, Pos and the domain.
    if (message.length > SINGLE_SMS_LIMIT && result.classSize) message = message.replace(`/${result.classSize}`, '');
    if (message.length > SINGLE_SMS_LIMIT) message = message.replace(/,\s*Att [\d.]+%/, '');
    if (message.length > SINGLE_SMS_LIMIT) message = message.replace(/,\s*Grade [^,]+/, '');
    if (message.length > SINGLE_SMS_LIMIT) message = message.replace(/,\s*Div [^,]+/, '');
    if (message.length > SINGLE_SMS_LIMIT) message = message.replace(/,\s*Total [\d.]+/, '');
    if (message.length > SINGLE_SMS_LIMIT && (student.admissionNumber || '').length > 0) message = message.replace(/\s*\([^)]*\)/g, '');
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
  private failureStatus(error?: string) { const code = this.diagnostic(error).code; return code === 'INVALID_PHONE_NUMBER' ? 'INVALID_NUMBER' : code === 'INSUFFICIENT_BALANCE' ? 'INSUFFICIENT_BALANCE' : 'PROVIDER_ERROR'; }
  private diagnostic(error?: string) { const e = (error || '').toLowerCase(); if (e.includes('balance') || e.includes('credit')) return { code: 'INSUFFICIENT_BALANCE', message: 'School SMS balance is insufficient.', action: 'Top up SMS units in Communications Wallet.' }; if (e.includes('invalid') || e.includes('number')) return { code: 'INVALID_PHONE_NUMBER', message: 'Parent phone number is invalid.', action: 'Update the parent phone number in Parent Management.' }; if (e.includes('rate')) return { code: 'RATE_LIMITED', message: 'Provider rate limit reached.', action: 'Retry after the provider window resets.' }; if (e.includes('timeout') || e.includes('timed out') || e.includes('network')) return { code: 'PROVIDER_ERROR', message: 'SMS provider timed out or returned an error.', action: 'Check provider status and retry later.' }; return { code: 'PROVIDER_ERROR', message: 'SMS provider returned an error.', action: 'Check provider configuration and retry later.' }; }
}
