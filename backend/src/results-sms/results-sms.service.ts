import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProviderFactory } from '../communications-cloud/providers/sms/sms-provider.factory';
import { SmsProvider } from '../communications-cloud/interfaces/provider.interface';

@Injectable()
export class ResultsSmsService {
  private readonly logger = new Logger(ResultsSmsService.name);

  constructor(
    private prisma: PrismaService,
    private smsProviderFactory: SmsProviderFactory,
  ) {}

  async getRecipients(schoolId: string, classId: string, termId: string) {
    const students = await this.prisma.student.findMany({
      where: {
        schoolId,
        enrollments: {
          some: { classId, status: 'ACTIVE' },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        parents: {
          select: {
            parent: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
          },
        },
      },
    });

    const recipients: any[] = [];

    for (const student of students) {
      const computedResults = await this.prisma.computedResult.findMany({
        where: {
          studentId: student.id,
          classId,
          termId,
          schoolId,
          status: 'PUBLISHED',
        },
        include: {
          subject: { select: { name: true, code: true } },
        },
      });

      if (computedResults.length === 0) continue;

      const totalPoints = computedResults.reduce((sum, r) => sum + (r.points ?? 0), 0);
      const totalPercentage = computedResults.reduce((sum, r) => sum + (r.finalPercentage ?? 0), 0);
      const subjectCount = computedResults.length;
      const average = subjectCount > 0 ? (totalPercentage / subjectCount).toFixed(1) : 'N/A';
      const classRank = computedResults[0]?.classRank;
      const studentGpa = computedResults[0]?.gpa;

      const subjectLines = computedResults.map((r) =>
        `${r.subject.name}: ${r.finalPercentage?.toFixed(1) ?? '-'}% - ${r.finalGrade ?? '-'} (${r.points ?? '-'} pts)`
      ).join('\n');

      const studentName = `${student.firstName} ${student.lastName}`;

      for (const link of student.parents) {
        const parent = link.parent;
        const message = [
          `SMART TECH SCHOOL - EXAM RESULTS`,
          ``,
          `Student: ${studentName}`,
          `Adm: ${student.admissionNumber ?? 'N/A'}`,
          ``,
          subjectLines,
          ``,
          `Average: ${average}%`,
          `Total Points: ${totalPoints}`,
          `GPA: ${studentGpa ?? 'N/A'}`,
          classRank != null ? `Class Rank: ${classRank}` : '',
          ``,
          `Thank you.`,
        ].filter(Boolean).join('\n');

        const phone = parent.phone;
        let phoneStatus: 'VALID' | 'MISSING' | 'INVALID' = 'VALID';
        let errorSuggestion: string | undefined;

        if (!phone) {
          phoneStatus = 'MISSING';
          errorSuggestion = 'Add parent phone number in Parent Management';
        } else if (!this.isValidPhone(phone)) {
          phoneStatus = 'INVALID';
          errorSuggestion = 'Update parent phone number with correct format (e.g. +260XXXXXXXXX)';
        }

        recipients.push({
          parentId: parent.id,
          parentName: `${parent.firstName} ${parent.lastName}`,
          studentId: student.id,
          studentName,
          admissionNumber: student.admissionNumber,
          phoneNumber: phone ?? null,
          message,
          phoneStatus,
          errorSuggestion,
          computedResults: computedResults.map((r) => ({
            subjectName: r.subject.name,
            percentage: r.finalPercentage,
            grade: r.finalGrade,
            points: r.points,
          })),
          average,
          totalPoints,
          gpa: studentGpa,
          classRank,
        });
      }
    }

    return {
      totalRecipients: recipients.length,
      validRecipients: recipients.filter((r) => r.phoneStatus === 'VALID').length,
      missingPhone: recipients.filter((r) => r.phoneStatus === 'MISSING').length,
      invalidPhone: recipients.filter((r) => r.phoneStatus === 'INVALID').length,
      recipients,
    };
  }

  async sendResultsSms(
    schoolId: string,
    classId: string,
    termId: string,
    userId: string,
    options?: { parentIds?: string[] },
  ) {
    const preview = await this.getRecipients(schoolId, classId, termId);
    const batchId = `BATCH_${Date.now()}`;

    let smsProvider: SmsProvider | null = null;
    try {
      smsProvider = await this.smsProviderFactory.getSchoolSmsProvider(schoolId);
    } catch (e) {
      this.logger.warn(`Could not resolve school SMS provider for ${schoolId}: ${e.message}`);
    }

    if (!smsProvider) {
      const skipped: any[] = [];
      for (const r of preview.recipients) {
        const log = await this.prisma.resultSmsLog.create({
          data: {
            schoolId,
            classId,
            termId,
            studentId: r.studentId,
            parentId: r.parentId,
            parentName: r.parentName,
            studentName: r.studentName,
            admissionNumber: r.admissionNumber,
            phoneNumber: r.phoneNumber,
            message: r.message,
            status: 'SKIPPED',
            errorMessage: 'No SMS provider configured. Set up your SMS provider in School Communication Settings.',
            errorSuggestion: 'Configure an SMS provider in Communications Settings',
            batchId,
          },
        });
        skipped.push(log);
      }
      return {
        success: false,
        message: 'No SMS provider configured for this school',
        sent: 0,
        failed: 0,
        skipped: skipped.length,
        logs: skipped,
      };
    }

    let targetRecipients = preview.recipients;
    if (options?.parentIds?.length) {
      targetRecipients = targetRecipients.filter((r) => options.parentIds!.includes(r.parentId));
    }

    let sent = 0;
    let failed = 0;
    const logs: any[] = [];

    for (const r of targetRecipients) {
      if (r.phoneStatus !== 'VALID') {
        const log = await this.prisma.resultSmsLog.create({
          data: {
            schoolId,
            classId,
            termId,
            studentId: r.studentId,
            parentId: r.parentId,
            parentName: r.parentName,
            studentName: r.studentName,
            admissionNumber: r.admissionNumber,
            phoneNumber: r.phoneNumber,
            message: r.message,
            status: 'SKIPPED',
            errorMessage: r.phoneStatus === 'MISSING' ? 'Parent phone number missing' : 'Invalid phone number format',
            errorSuggestion: r.errorSuggestion,
            batchId,
          },
        });
        logs.push(log);
        continue;
      }

      let smsResult: { success: boolean; messageId?: string; error?: string };
      let providerName = 'unknown';

      try {
        const sendResult = await smsProvider.send({
          to: r.phoneNumber,
          body: r.message,
        });
        smsResult = {
          success: sendResult.success,
          messageId: sendResult.providerMessageId || sendResult.messageId,
          error: sendResult.error,
        };
        providerName = sendResult.provider || 'sms-provider';
      } catch (e: any) {
        smsResult = { success: false, error: e.message };
      }

      const status = smsResult.success ? 'SENT' : 'FAILED';
      if (status === 'SENT') sent++;
      else failed++;

      const log = await this.prisma.resultSmsLog.create({
        data: {
          schoolId,
          classId,
          termId,
          studentId: r.studentId,
          parentId: r.parentId,
          parentName: r.parentName,
          studentName: r.studentName,
          admissionNumber: r.admissionNumber,
          phoneNumber: r.phoneNumber,
          message: r.message,
          status,
          provider: smsResult.success ? providerName : undefined,
          providerMessageId: smsResult.messageId,
          errorMessage: smsResult.error,
          errorSuggestion: smsResult.success ? undefined : this.suggestFix(smsResult.error),
          batchId,
          sentAt: smsResult.success ? new Date() : undefined,
        },
      });
      logs.push(log);
    }

    return {
      success: failed === 0,
      message: `Sent ${sent} of ${targetRecipients.length} result SMS messages`,
      total: targetRecipients.length,
      sent,
      failed,
      skipped: targetRecipients.filter((r) => r.phoneStatus !== 'VALID').length,
      batchId,
      logs,
    };
  }

  async getBatchLogs(schoolId: string, batchId: string) {
    return this.prisma.resultSmsLog.findMany({
      where: { schoolId, batchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHistory(schoolId: string, classId?: string, termId?: string) {
    const where: any = { schoolId };
    if (classId) where.classId = classId;
    if (termId) where.termId = termId;

    const allLogs = await this.prisma.resultSmsLog.findMany({
      where,
      select: { batchId: true, status: true, createdAt: true, sentAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const batchMap = new Map<string, { createdAt: Date; sentAt: Date | null; total: number; sent: number; failed: number; skipped: number }>();
    for (const log of allLogs) {
      const key = log.batchId ?? 'UNKNOWN';
      if (!batchMap.has(key)) {
        batchMap.set(key, { createdAt: log.createdAt, sentAt: log.sentAt, total: 0, sent: 0, failed: 0, skipped: 0 });
      }
      const entry = batchMap.get(key)!;
      entry.total++;
      if (log.status === 'SENT') entry.sent++;
      else if (log.status === 'FAILED') entry.failed++;
      else if (log.status === 'SKIPPED') entry.skipped++;
    }

    const history = Array.from(batchMap.entries())
      .map(([batchId, data]) => ({ batchId, ...data }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return history;
  }

  async getLogById(id: string) {
    const log = await this.prisma.resultSmsLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('SMS log not found');
    return log;
  }

  async getFailedLogs(schoolId: string, batchId?: string) {
    const where: any = { schoolId, status: { in: ['FAILED', 'SKIPPED'] } };
    if (batchId) where.batchId = batchId;
    return this.prisma.resultSmsLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSmsSettings(schoolId: string) {
    return this.prisma.communicationSettings.findUnique({
      where: { schoolId },
      select: {
        smsEnabled: true,
        smsProvider: true,
        smsSenderId: true,
      },
    });
  }

  async autoSendOnPublish(schoolId: string, classId: string, termId: string, userId: string) {
    const settings = await this.getSmsSettings(schoolId);
    if (!settings?.smsEnabled) {
      this.logger.log(`[Auto SMS] SMS disabled for school ${schoolId}, skipping auto-send`);
      return null;
    }
    return this.sendResultsSms(schoolId, classId, termId, userId);
  }

  private isValidPhone(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^\+?\d{9,15}$/.test(cleaned);
  }

  private suggestFix(error?: string): string | undefined {
    if (!error) return undefined;
    const e = error.toLowerCase();
    if (e.includes('not found') || e.includes('invalid phone') || e.includes('invalid number')) {
      return 'Verify phone number format. Should be international format (e.g. +260XXXXXXXXX)';
    }
    if (e.includes('insufficient') || e.includes('credit') || e.includes('balance')) {
      return 'Top up SMS credits/balance in Communications Wallet';
    }
    if (e.includes('blacklist') || e.includes('blocked')) {
      return 'Recipient number is blocked/blacklisted. Contact support';
    }
    if (e.includes('timeout') || e.includes('network')) {
      return 'Network error - SMS will be retried automatically';
    }
    return 'Check SMS provider configuration in Communications Settings';
  }
}
