import { Injectable, NotFoundException, BadRequestException, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
import { RankingService } from '../ranking-service/ranking.service';
import { ResultAnalyticsService } from '../result-analytics/result-analytics.service';
import { ReportCardEngineService } from '../report-card-engine/report-card-engine.service';
import { AssessmentEngineService } from '../assessment-engine/assessment-engine.service';
import { ResultsSmsService } from '../results-sms/results-sms.service';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

@Injectable()
export class ResultsManagementService {
  private readonly logger = new Logger(ResultsManagementService.name);

  constructor(
    private prisma: PrismaService,
    private gradingEngine: GradingEngineService,
    private rankingService: RankingService,
    private resultAnalytics: ResultAnalyticsService,
    private reportCardEngine: ReportCardEngineService,
    private assessmentEngine: AssessmentEngineService,
    @Optional() @Inject(forwardRef(() => ResultsSmsService))
    private resultsSmsService?: ResultsSmsService,
  ) {}

  async getResultSheets(
    schoolId: string,
    filters: { status?: string; classId?: string; termId?: string; examType?: string },
  ) {
    const targetTermId = filters.termId;
    const examType = filters.examType || 'END_TERM';

    if (!filters.classId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
      });

      if (currentYear) {
        let termId = targetTermId;
        if (!termId) {
          const currentTerm = await this.prisma.term.findFirst({
            where: { academicYearId: currentYear.id, isCurrent: true },
          });
          if (currentTerm) termId = currentTerm.id;
        }

        if (termId) {
          const existingSheets = await this.prisma.resultSheet.findMany({
            where: { schoolId, termId, examType },
            select: { classId: true },
          });
          const existingClassIds = new Set(existingSheets.map((s) => s.classId));

          const activeClasses = await this.prisma.class.findMany({
            where: { schoolId },
            select: { id: true },
          });

          for (const cls of activeClasses) {
            if (!existingClassIds.has(cls.id)) {
              const totalStudents = await this.prisma.enrollment.count({
                where: { classId: cls.id, academicYearId: currentYear.id, status: 'ACTIVE' },
              });
              await this.prisma.resultSheet.create({
                data: {
                  schoolId,
                  classId: cls.id,
                  termId,
                  academicYearId: currentYear.id,
                  examType,
                  createdBy: 'SYSTEM',
                  totalStudents,
                },
              });
            }
          }
        }
      }
    }

    const where: any = { schoolId };
    if (filters.status) where.status = filters.status;
    if (filters.classId) where.classId = filters.classId;
    if (filters.termId) where.termId = filters.termId;
    if (filters.examType) where.examType = filters.examType;

    let sheets = await this.prisma.resultSheet.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, classTeacher: { select: { firstName: true, lastName: true } } } },
        term: { select: { id: true, name: true, academicYear: { select: { name: true } } } },
        school: { select: { id: true, name: true, address: true, phone: true, email: true } },
      },
      orderBy: [{ term: { startDate: 'desc' } }, { class: { name: 'asc' } }],
    });

    // Auto-create sheet if none exists for the requested class+term
    if (sheets.length === 0 && filters.classId && targetTermId) {
      const term = await this.prisma.term.findUnique({
        where: { id: targetTermId },
        include: { academicYear: { select: { id: true } } },
      });
      if (term && term.academicYear) {
        const totalStudents = await this.prisma.enrollment.count({
          where: { classId: filters.classId, academicYearId: term.academicYear.id, status: 'ACTIVE' },
        });
        const newSheet = await this.prisma.resultSheet.create({
          data: {
            schoolId,
            classId: filters.classId,
            termId: targetTermId,
            academicYearId: term.academicYear.id,
            examType,
            createdBy: 'SYSTEM',
            totalStudents,
          },
          include: {
            class: { select: { id: true, name: true, classTeacher: { select: { firstName: true, lastName: true } } } },
            term: { select: { id: true, name: true, academicYear: { select: { name: true } } } },
            school: { select: { id: true, name: true, address: true, phone: true, email: true } },
          },
        });
        sheets = [newSheet];
      }
    }

    return sheets;
  }

  async getResultSheet(id: string) {
    const sheet = await this.prisma.resultSheet.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            levelType: { select: { id: true, name: true } },
            classTeacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        term: { include: { academicYear: { select: { id: true, name: true } } } },
      },
    });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    const auditLogs = await this.prisma.resultAuditLog.findMany({
      where: { entityType: 'RESULT_SHEET', entityId: id },
      orderBy: { createdAt: 'asc' },
    });

    return { ...sheet, statusTimeline: auditLogs };
  }

  async getSheetStudents(sheetId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({
      where: { id: sheetId },
      select: { classId: true, termId: true, schoolId: true, academicYearId: true },
    });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId: sheet.classId,
        academicYearId: sheet.academicYearId,
        status: 'ACTIVE',
      },
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            gender: true,
          },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    let students = enrollments.map((e) => e.student);

    // Fallback: if no enrollments found, get students from Result table
    if (students.length === 0) {
      const resultsWithStudents = await this.prisma.result.findMany({
        where: {
          termId: sheet.termId,
          schoolId: sheet.schoolId,
        },
        select: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              gender: true,
            },
          },
        },
        distinct: ['studentId'],
      });
      students = resultsWithStudents.map((r) => r.student).filter(Boolean);
    }

    let computedResults = await this.prisma.computedResult.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        termId: sheet.termId,
        classId: sheet.classId,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ studentId: 'asc' }, { subject: { name: 'asc' } }],
    });

    // Fallback: if no computed results for this class, try without classId filter
    if (computedResults.length === 0 && students.length > 0) {
      computedResults = await this.prisma.computedResult.findMany({
        where: {
          studentId: { in: students.map((s) => s.id) },
          termId: sheet.termId,
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ studentId: 'asc' }, { subject: { name: 'asc' } }],
      });
    }

    const rawResults = await this.prisma.result.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        termId: sheet.termId,
        schoolId: sheet.schoolId,
      },
      select: {
        studentId: true,
        subjectId: true,
        score: true,
        grade: true,
        remark: true,
      },
    });

    const rawResultMap = new Map<string, { score: number; grade: string | null; remark: string | null }>();
    for (const r of rawResults) {
      rawResultMap.set(`${r.studentId}::${r.subjectId}`, { score: r.score, grade: r.grade, remark: r.remark });
    }

    return {
      students: students.map((student) => ({
        ...student,
        results: computedResults.filter((r) => r.studentId === student.id).map((cr) => {
          const raw = rawResultMap.get(`${cr.studentId}::${cr.subjectId}`);
          return {
            ...cr,
            score: raw?.score ?? cr.totalRawScore ?? cr.finalPercentage ?? null,
            grade: raw?.grade ?? cr.finalGrade ?? null,
            remark: raw?.remark ?? cr.finalRemark ?? null,
          };
        }),
      })),
    };
  }

  async getSheetSubjects(sheetId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({
      where: { id: sheetId },
      select: { classId: true, termId: true, schoolId: true },
    });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId: sheet.classId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    });

    const enrolledCount = await this.prisma.enrollment.count({
      where: { classId: sheet.classId, status: 'ACTIVE' },
    });

    const subjectsWithStatus = await Promise.all(
      classSubjects.map(async (cs) => {
        const configs = await this.prisma.termAssessmentConfiguration.findMany({
          where: { classId: sheet.classId, subjectId: cs.subjectId, termId: sheet.termId },
        });

        if (configs.length === 0) {
          return { ...cs.subject, entryStatus: 'NOT_CONFIGURED', entryProgress: 0 };
        }

        const enteredScores = await this.prisma.studentAssessmentResult.count({
          where: {
            classId: sheet.classId,
            subjectId: cs.subjectId,
            termId: sheet.termId,
            rawScore: { not: null },
          },
        });

        const totalExpected = enrolledCount * configs.length;
        const entryProgress = totalExpected > 0 ? Math.round((enteredScores / totalExpected) * 100) : 0;

        let entryStatus = 'NOT_STARTED';
        if (entryProgress >= 100) {
          entryStatus = 'COMPLETE';
        } else if (enteredScores > 0) {
          entryStatus = 'IN_PROGRESS';
        }

        return {
          ...cs.subject,
          entryStatus,
          entryProgress,
          totalConfigs: configs.length,
          configurations: configs.map((c) => ({
            assessmentDefId: c.assessmentDefId,
            maxScore: c.maxScore,
            weightPercentage: c.weightPercentage,
            mandatory: c.mandatory,
          })),
        };
      }),
    );

    return subjectsWithStatus;
  }

  async submitSheet(id: string, userId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({ where: { id } });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    if (sheet.status !== 'DRAFT') {
      throw new BadRequestException('Only draft sheets can be submitted');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.resultSheet.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          submittedBy: userId,
        },
      });

      await tx.resultAuditLog.create({
        data: {
          schoolId: sheet.schoolId,
          action: 'SUBMITTED',
          entityType: 'RESULT_SHEET',
          entityId: id,
          classId: sheet.classId,
          termId: sheet.termId,
          performedBy: userId,
        },
      });

      return updated;
    });
  }

  async verifySheet(id: string, userId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({
      where: { id },
      include: { class: { select: { id: true, name: true } } },
    });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    if (sheet.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted sheets can be verified');
    }

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId: sheet.classId },
    });

    const computationResults = [];
    for (const cs of classSubjects) {
      const result = await this.gradingEngine.computeAllClassResults(
        sheet.classId,
        cs.subjectId,
        sheet.termId,
        sheet.schoolId,
      );
      computationResults.push({ subjectId: cs.subjectId, ...result });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.resultSheet.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          verifiedBy: userId,
          verifiedAt: new Date(),
        },
      });

      await tx.computedResult.updateMany({
        where: {
          classId: sheet.classId,
          termId: sheet.termId,
          schoolId: sheet.schoolId,
        },
        data: { status: 'VERIFIED' },
      });

      await tx.resultAuditLog.create({
        data: {
          schoolId: sheet.schoolId,
          action: 'PUBLISHED',
          entityType: 'RESULT_SHEET',
          entityId: id,
          classId: sheet.classId,
          termId: sheet.termId,
          performedBy: userId,
        },
      });

      return updated;
    });
  }

  private async triggerAutoSms(schoolId: string, classId: string, termId: string, userId: string) {
    if (!this.resultsSmsService) return;
    try {
      const result = await this.resultsSmsService.autoSendOnPublish(schoolId, classId, termId, userId);
      if (result) {
        this.logger.log(`[Auto SMS] ${result.message}`);
      }
    } catch (error: any) {
      this.logger.error(`[Auto SMS] Failed: ${error.message}`);
    }
  }

  async publishSheet(id: string, userId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({ where: { id } });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    if (sheet.status !== 'VERIFIED') {
      throw new BadRequestException('Only verified sheets can be published');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.resultSheet.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      await tx.resultPublication.upsert({
        where: {
          classId_termId: {
            classId: sheet.classId,
            termId: sheet.termId,
          },
        },
        update: {
          published: true,
          publishedAt: new Date(),
        },
        create: {
          classId: sheet.classId,
          termId: sheet.termId,
          schoolId: sheet.schoolId,
          published: true,
          publishedAt: new Date(),
        },
      });

      await tx.computedResult.updateMany({
        where: {
          classId: sheet.classId,
          termId: sheet.termId,
          schoolId: sheet.schoolId,
        },
        data: { status: 'PUBLISHED' },
      });

      await tx.resultAuditLog.create({
        data: {
          schoolId: sheet.schoolId,
          action: 'PUBLISHED',
          entityType: 'RESULT_SHEET',
          entityId: id,
          classId: sheet.classId,
          termId: sheet.termId,
          performedBy: userId,
        },
      });

      return updated;
    });

    this.triggerAutoSms(sheet.schoolId, sheet.classId, sheet.termId, userId);

    return result;
  }

  async lockSheet(id: string, userId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({ where: { id } });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    if (sheet.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published sheets can be locked');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.resultSheet.update({
        where: { id },
        data: {
          status: 'LOCKED',
          lockedAt: new Date(),
          lockedBy: userId,
        },
      });

      await tx.computedResult.updateMany({
        where: {
          classId: sheet.classId,
          termId: sheet.termId,
          schoolId: sheet.schoolId,
        },
        data: { status: 'LOCKED' },
      });

      await tx.resultAuditLog.create({
        data: {
          schoolId: sheet.schoolId,
          action: 'LOCKED',
          entityType: 'RESULT_SHEET',
          entityId: id,
          classId: sheet.classId,
          termId: sheet.termId,
          performedBy: userId,
        },
      });

      return updated;
    });
  }

  async unlockSheet(id: string, userId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({ where: { id } });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    if (sheet.status !== 'LOCKED') {
      throw new BadRequestException('Only locked sheets can be unlocked');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.resultSheet.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          lockedAt: null,
          lockedBy: null,
        },
      });

      await tx.computedResult.updateMany({
        where: {
          classId: sheet.classId,
          termId: sheet.termId,
          schoolId: sheet.schoolId,
        },
        data: { status: 'PUBLISHED' },
      });

      await tx.resultAuditLog.create({
        data: {
          schoolId: sheet.schoolId,
          action: 'UNLOCKED',
          entityType: 'RESULT_SHEET',
          entityId: id,
          classId: sheet.classId,
          termId: sheet.termId,
          performedBy: userId,
        },
      });

      return updated;
    });
  }

  async getRankings(sheetId: string, type: string = 'class') {
    const sheet = await this.prisma.resultSheet.findUnique({
      where: { id: sheetId },
      select: { classId: true, termId: true, schoolId: true },
    });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    if (type === 'subject') {
      const classSubjects = await this.prisma.classSubject.findMany({
        where: { classId: sheet.classId },
        select: { subjectId: true },
      });

      const subjectRankings = [];
      for (const cs of classSubjects) {
        try {
          const rankings = await this.rankingService.computeSubjectRankings(
            cs.subjectId,
            sheet.termId,
            sheet.classId,
            sheet.schoolId,
          );
          subjectRankings.push({ subjectId: cs.subjectId, rankings });
        } catch (error) {
          this.logger.warn(`Failed to compute subject rankings for ${cs.subjectId}: ${error.message}`);
        }
      }
      return subjectRankings;
    }

    if (type === 'gender') {
      const computedResults = await this.prisma.computedResult.findMany({
        where: {
          classId: sheet.classId,
          termId: sheet.termId,
          schoolId: sheet.schoolId,
          status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
          finalPercentage: { not: null },
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNumber: true, gender: true },
          },
          subject: { select: { id: true, name: true } },
        },
      });

      const groupByGender = (genderFilter: string[]) => {
        const filtered = computedResults.filter((r) =>
          genderFilter.includes((r.student.gender || '').toUpperCase()),
        );
        const studentAverages = filtered.reduce(
          (acc, r) => {
            if (!acc[r.studentId]) {
              acc[r.studentId] = {
                studentId: r.studentId,
                firstName: r.student.firstName,
                lastName: r.student.lastName,
                studentName: `${r.student.firstName} ${r.student.lastName}`,
                admissionNumber: r.student.admissionNumber,
                totalPercentage: 0,
                count: 0,
              };
            }
            acc[r.studentId].totalPercentage += r.finalPercentage ?? 0;
            acc[r.studentId].count += 1;
            return acc;
          },
          {} as Record<string, any>,
        );

        return Object.values(studentAverages)
          .map((s: any) => ({
            ...s,
            averagePercentage: s.count > 0 ? parseFloat((s.totalPercentage / s.count).toFixed(2)) : 0,
          }))
          .sort((a: any, b: any) => b.averagePercentage - a.averagePercentage)
          .map((s: any, i: number) => ({ rank: i + 1, ...s }));
      };

      return {
        male: groupByGender(['MALE', 'M']),
        female: groupByGender(['FEMALE', 'F']),
      };
    }

    const rawRankings = await this.rankingService.computeClassRankings(sheet.classId, sheet.termId, sheet.schoolId);
    const rankingsList = Array.isArray(rawRankings) ? rawRankings : [];
    return {
      students: rankingsList.map((r: any) => ({
        studentId: r.studentId,
        firstName: r.firstName || (r.studentName ? r.studentName.split(' ')[0] : ''),
        lastName: r.lastName || (r.studentName ? r.studentName.split(' ').slice(1).join(' ') : ''),
        admissionNumber: r.admissionNumber || '',
        percentage: r.average || r.percentage || r.totalPercentage || 0,
        totalPercentage: r.average || r.percentage || r.totalPercentage || 0,
        average: r.average || r.percentage || r.totalPercentage || 0,
        grade: r.grade || null,
        rank: r.rank || 0,
        totalPoints: r.totalPoints || 0,
      })),
    };
  }

  async getAnalysis(sheetId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({
      where: { id: sheetId },
      select: { classId: true, termId: true, schoolId: true },
    });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    let classAnalytics: any = { subjectStats: [] };
    let atRiskData: any[] = [];
    try {
      [classAnalytics, atRiskData] = await Promise.all([
        this.resultAnalytics.getClassAnalytics(sheet.classId, sheet.termId, sheet.schoolId).catch(() => ({ subjectStats: [] })),
        this.resultAnalytics.getAtRiskStudents(sheet.classId, sheet.termId, sheet.schoolId).catch(() => []),
      ]);
    } catch (e) {
      this.logger.warn(`Analytics sub-calls failed: ${e.message}`);
    }

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId: sheet.classId,
        termId: sheet.termId,
        schoolId: sheet.schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        finalPercentage: { not: null },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
      },
    });

    const studentAverages = new Map<string, { studentId: string; firstName: string; lastName: string; admissionNumber: string; totalPercentage: number; count: number }>();
    for (const cr of computedResults) {
      const existing = studentAverages.get(cr.studentId);
      if (existing) {
        existing.totalPercentage += cr.finalPercentage ?? 0;
        existing.count += 1;
      } else {
        studentAverages.set(cr.studentId, {
          studentId: cr.studentId,
          firstName: cr.student.firstName,
          lastName: cr.student.lastName,
          admissionNumber: cr.student.admissionNumber,
          totalPercentage: cr.finalPercentage ?? 0,
          count: 1,
        });
      }
    }

    const students = Array.from(studentAverages.values()).map(s => ({
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      admissionNumber: s.admissionNumber,
      percentage: s.count > 0 ? parseFloat((s.totalPercentage / s.count).toFixed(2)) : 0,
      grade: null as string | null,
    }));

    students.forEach(s => {
      if (s.percentage >= 75) s.grade = 'A';
      else if (s.percentage >= 65) s.grade = 'B';
      else if (s.percentage >= 50) s.grade = 'C';
      else if (s.percentage >= 40) s.grade = 'D';
      else s.grade = 'E';
    });

    const overallScores = computedResults.map(r => r.finalPercentage ?? 0);
    const totalStudents = new Set(computedResults.map(r => r.studentId)).size;
    const overallAvg = overallScores.length > 0 ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length : 0;
    const passCount = overallScores.filter(s => s >= 50).length;
    const passRate = overallScores.length > 0 ? parseFloat(((passCount / overallScores.length) * 100).toFixed(2)) : 0;
    const distinctionCount = overallScores.filter(s => s >= 75).length;
    const distinctionRate = overallScores.length > 0 ? parseFloat(((distinctionCount / overallScores.length) * 100).toFixed(2)) : 0;

    const gradeDistribution: Record<string, number> = {};
    computedResults.forEach(r => {
      const grade = r.finalGrade || 'Unknown';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });

    const subjectAnalysis = (classAnalytics as any).subjectStats || [];

    const atRiskStudents = students.filter(s => s.percentage < 40).sort((a, b) => a.percentage - b.percentage);

    return {
      totalStudents,
      passRate,
      averagePercentage: parseFloat(overallAvg.toFixed(2)),
      distinctionRate,
      atRiskCount: atRiskStudents.length,
      gradeDistribution,
      subjectAnalysis,
      students,
      atRiskStudents,
    };
  }

  async getAuditLogs(
    schoolId: string,
    filters: { entityType?: string; entityId?: string; action?: string },
  ) {
    const where: any = { schoolId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.action) where.action = filters.action;

    return this.prisma.resultAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getMarkSchedule(sheetId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({
      where: { id: sheetId },
      select: { classId: true, termId: true, schoolId: true, academicYearId: true },
    });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId: sheet.classId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId: sheet.classId,
        academicYearId: sheet.academicYearId,
        status: 'ACTIVE',
      },
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            gender: true,
          },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    const students = enrollments.map((e) => e.student);
    const studentIds = students.map((s) => s.id);

    let computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId: sheet.classId,
        termId: sheet.termId,
        studentId: { in: studentIds },
      },
    });

    if (computedResults.length === 0 && studentIds.length > 0) {
      computedResults = await this.prisma.computedResult.findMany({
        where: {
          termId: sheet.termId,
          studentId: { in: studentIds },
        },
      });
    }

    const rawResults = await this.prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        termId: sheet.termId,
        schoolId: sheet.schoolId,
      },
      select: {
        studentId: true,
        subjectId: true,
        score: true,
        grade: true,
        remark: true,
      },
    });

    const rawResultMap = new Map<string, { score: number; grade: string | null; remark: string | null }>();
    for (const r of rawResults) {
      rawResultMap.set(`${r.studentId}::${r.subjectId}`, { score: r.score, grade: r.grade, remark: r.remark });
    }

    const schedule = students.map((student) => {
      const subjects = classSubjects.map((cs) => {
        const cr = computedResults.find(
          (r) => r.studentId === student.id && r.subjectId === cs.subjectId,
        );
        const raw = rawResultMap.get(`${student.id}::${cs.subjectId}`);
        const finalPercentage = cr?.finalPercentage ?? raw?.score ?? null;
        const points = cr?.points ?? (finalPercentage != null
          ? finalPercentage >= 75 ? 1
            : finalPercentage >= 65 ? 2
            : finalPercentage >= 50 ? 3
            : finalPercentage >= 40 ? 4
            : 5
          : null);
        const grade = cr?.finalGrade ?? raw?.grade ?? (finalPercentage != null
          ? finalPercentage >= 75 ? 'A'
            : finalPercentage >= 65 ? 'B'
            : finalPercentage >= 50 ? 'C'
            : finalPercentage >= 40 ? 'D'
            : 'E'
          : null);
        return {
          subjectId: cs.subjectId,
          subjectName: cs.subject.name,
          subjectCode: cs.subject.code,
          totalRawScore: cr?.totalRawScore ?? raw?.score ?? null,
          totalWeightedScore: cr?.totalWeightedScore ?? null,
          finalPercentage,
          finalGrade: grade,
          finalRemark: cr?.finalRemark ?? raw?.remark ?? null,
          points,
          gpa: cr?.gpa ?? null,
          classRank: cr?.classRank ?? null,
          subjectRank: cr?.subjectRank ?? null,
        };
      });

      const validSubjects = subjects.filter((s) => s.finalPercentage !== null);
      const totalPercentage = validSubjects.reduce((sum, s) => sum + s.finalPercentage!, 0);
      const average = validSubjects.length > 0
        ? parseFloat((totalPercentage / validSubjects.length).toFixed(2))
        : null;

      const sortedPoints = validSubjects
        .filter((s) => s.points != null)
        .sort((a, b) => (a.points ?? 99) - (b.points ?? 99));
      const bestSix = sortedPoints.slice(0, 6);
      const totalPoints = bestSix.length > 0
        ? bestSix.reduce((sum, s) => sum + (s.points ?? 0), 0)
        : 0;

      let grade: string | null = null;
      if (average != null) {
        if (average >= 75) grade = 'A';
        else if (average >= 65) grade = 'B';
        else if (average >= 50) grade = 'C';
        else if (average >= 40) grade = 'D';
        else grade = 'E';
      }

      return {
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          admissionNumber: student.admissionNumber,
          gender: student.gender,
        },
        subjects,
        average,
        grade,
        totalSubjects: validSubjects.length,
        totalPoints,
      };
    }).sort((a, b) => {
      if (a.totalPoints !== b.totalPoints) return a.totalPoints - b.totalPoints;
      if (b.average !== null && a.average !== null) return b.average - a.average;
      return 0;
    }).map((entry, index) => ({ ...entry, rank: index + 1 }));

    const className = await this.prisma.class.findUnique({
      where: { id: sheet.classId },
      select: { name: true },
    });

    const school = await this.prisma.school.findUnique({
      where: { id: sheet.schoolId },
      select: { name: true, address: true, phone: true, email: true },
    });

    return {
      sheetId,
      classId: sheet.classId,
      className: className?.name,
      termId: sheet.termId,
      schoolName: school?.name || '',
      schoolAddress: school?.address || '',
      schoolPhone: school?.phone || '',
      schoolEmail: school?.email || '',
      subjects: classSubjects.map((cs) => ({
        id: cs.subjectId,
        name: cs.subject.name,
        code: cs.subject.code,
      })),
      students: schedule,
    };
  }

  async generateMarkScheduleHtml(sheetId: string, schoolId: string): Promise<string> {
    const sheet = await this.prisma.resultSheet.findUnique({
      where: { id: sheetId },
      include: {
        class: { include: { classTeacher: { select: { firstName: true, lastName: true } } } },
        term: { include: { academicYear: { select: { name: true } } } },
      },
    });
    if (!sheet) throw new NotFoundException('Result sheet not found');

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const schedule = await this.getMarkSchedule(sheetId);

    const subjects = schedule.subjects || [];
    const students = schedule.students || [];

    const passThreshold = 50;

    const rows = students.map((s: any) => {
      const subjectCells = subjects.map((sub: any) => {
        const subResult = s.subjects?.find((sr: any) => sr.subjectId === sub.id);
        const pct = subResult?.finalPercentage;
        const passed = pct != null && pct >= passThreshold;
        const grade = subResult?.finalGrade || '-';
        const points = subResult?.points != null ? subResult.points : '-';
        return `<td style="text-align:center;padding:6px 8px;border:1px solid #e8ddd0;${pct == null ? 'background:#fffbeb;' : !passed ? 'background:#fef2f2;' : ''}">
          ${pct != null ? `<div style="font-weight:600;font-size:14px;color:${passed ? '#059669' : '#dc2626'}">${pct.toFixed(1)}%</div>
          <div style="font-size:11px;color:#6b7280">${grade} | ${points} pts</div>` : '<span style="color:#d1d5db">-</span>'}
        </td>`;
      });

      const validSubjects = s.subjects?.filter((sr: any) => sr.finalPercentage != null) || [];
      const avg = validSubjects.length > 0
        ? validSubjects.reduce((sum: number, sr: any) => sum + sr.finalPercentage, 0) / validSubjects.length
        : null;

      return `<tr>
        <td style="text-align:center;padding:6px 12px;border:1px solid #e8ddd0;font-weight:600;color:#5f4b3a">${s.rank || '-'}</td>
        <td style="padding:6px 12px;border:1px solid #e8ddd0;font-weight:600">${s.student?.firstName || ''} ${s.student?.lastName || ''}</td>
        <td style="padding:6px 12px;border:1px solid #e8ddd0;color:#6b7280;font-size:12px">${s.student?.admissionNumber || '-'}</td>
        <td style="padding:6px 12px;border:1px solid #e8ddd0;color:#6b7280;font-size:12px">${s.student?.gender || '-'}</td>
        ${subjectCells.join('')}
        <td style="text-align:center;padding:6px 12px;border:1px solid #e8ddd0;font-weight:600;${avg != null && avg >= passThreshold ? 'color:#059669' : avg != null ? 'color:#dc2626' : 'color:#d1d5db'}">
          ${avg != null ? `${avg.toFixed(1)}%` : '-'}
        </td>
        <td style="text-align:center;padding:6px 12px;border:1px solid #e8ddd0;font-weight:600">${s.totalPoints ?? 0}</td>
      </tr>`;
    }).join('');

    const subjectHeaders = subjects.map((sub: any) =>
      `<th style="text-align:center;padding:10px 8px;background:#5f4b3a;color:white;font-size:11px;text-transform:uppercase;border:1px solid #7a6b5a;min-width:80px">${sub.name}</th>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mark Schedule - ${sheet.class?.name || ''}</title>
  <style>
    @page { margin: 20mm; size: A4 landscape; }
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { margin: 0; padding: 20px; color: #1f2937; }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #5f4b3a; }
    .header h1 { margin: 0; font-size: 22px; color: #5f4b3a; }
    .header .school-name { font-size: 18px; font-weight: 700; }
    .header .details { font-size: 13px; color: #6b7280; margin-top: 6px; }
    .header .details span { margin: 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #5f4b3a; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; border: 1px solid #7a6b5a; position: sticky; top: 0; }
    td { padding: 8px 12px; border: 1px solid #e8ddd0; }
    tr:nth-child(even) { background: #faf7f4; }
    tr:hover { background: #f5efe8; }
    .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
    .signatures .sig { text-align: center; }
    .signatures .sig .line { width: 200px; border-top: 1px solid #1f2937; margin-top: 40px; padding-top: 8px; font-size: 12px; color: #6b7280; }
    .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 24px; background: #5f4b3a; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; z-index: 100; }
    @media print { .print-btn { display: none; } body { padding: 0; } }
    .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #9ca3af; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .badge-pass { background: #d1fae5; color: #059669; }
    .badge-fail { background: #fee2e2; color: #dc2626; }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()"><i class="fa fa-print"></i> Print / PDF</button>

  <div class="header">
    <div class="school-name">${school?.name || 'School Name'}</div>
    <div class="details">
      <span>Academic Year: ${sheet.term?.academicYear?.name || ''}</span>
      <span>Term: ${sheet.term?.name || ''}</span>
      <span>Class: ${sheet.class?.name || ''}</span>
      <span>Exam: ${sheet.examType || 'END_TERM'}</span>
      <span>Generated: ${new Date().toLocaleDateString()}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="min-width:40px;position:sticky;left:0;z-index:2">Rank</th>
        <th style="min-width:160px">Student Name</th>
        <th style="min-width:100px">Admission No.</th>
        <th style="min-width:60px">Gender</th>
        ${subjectHeaders}
        <th style="min-width:70px">Average</th>
        <th style="min-width:60px">Total Pts</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig">
      <div class="line">Class Teacher: ${sheet.class?.classTeacher ? `${sheet.class.classTeacher.firstName} ${sheet.class.classTeacher.lastName}` : '________________'}</div>
    </div>
    <div class="sig">
      <div class="line">Director: ${school?.name ? `${school.name} Director` : '________________'}</div>
    </div>
  </div>

  <div class="footer">
    <p>Smart Tech SaaS - Results Management System | Confidential</p>
  </div>

  <script>
    window.onload = function() { if (window.location.search.includes('print=true')) window.print(); };
  </script>
</body>
</html>`;

    return html;
  }

  async generateMarkSchedulePdf(sheetId: string, schoolId: string): Promise<Buffer> {
    const html = await this.generateMarkScheduleHtml(sheetId, schoolId);
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      });
      await browser.close();
      return Buffer.from(pdf);
    } catch {
      // Fallback: return HTML as buffer if puppeteer not available
      return Buffer.from(html, 'utf-8');
    }
  }

  async previewExcelUpload(
    schoolId: string,
    termId: string,
    classId: string,
    file: Express.Multer.File,
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new BadRequestException('Invalid term');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      throw new BadRequestException('Excel file is empty');
    }

    const subjects = await this.prisma.subject.findMany({
      where: { schoolId },
    });
    const subjectMap = new Map(
      subjects.map((s) => [s.name.toLowerCase(), { id: s.id, name: s.name }]),
    );

    const students = await this.prisma.student.findMany({
      where: { schoolId },
      select: { id: true, admissionNumber: true, firstName: true, lastName: true },
    });
    const studentMap = new Map(
      students.map((s) => [s.admissionNumber?.toLowerCase(), s]),
    );

    const entries: any[] = [];
    const errors: any[] = [];
    let rowNum = 0;

    for (const row of rows) {
      rowNum++;
      const admissionNumber = String(row['AdmissionNumber'] || '').trim();
      if (!admissionNumber) {
        errors.push({ row: rowNum, message: 'Missing AdmissionNumber' });
        continue;
      }

      const student = studentMap.get(admissionNumber.toLowerCase());
      if (!student) {
        errors.push({ row: rowNum, message: `Student not found: ${admissionNumber}` });
        continue;
      }

      const entry: any = {
        rowNumber: rowNum,
        admissionNumber,
        firstName: row['FirstName'] || student.firstName,
        lastName: row['LastName'] || student.lastName,
        studentId: student.id,
        scores: {},
      };

      for (const column in row) {
        const colLower = column.toLowerCase();
        if (['admissionnumber', 'firstname', 'lastname', 'class'].includes(colLower)) continue;

        const subject = subjectMap.get(colLower);
        if (!subject) {
          errors.push({ row: rowNum, message: `Unknown column: ${column}` });
          continue;
        }

        const val = row[column];
        const score = Number(val);
        if (val !== undefined && val !== '' && val !== null) {
          if (isNaN(score) || score < 0 || score > 100) {
            errors.push({ row: rowNum, message: `Invalid score '${val}' in ${column} (must be 0-100)` });
          } else {
            entry.scores[subject.id] = { subjectName: subject.name, score };
          }
        }
      }
      entries.push(entry);
    }

    return { entries, errors, totalRows: rows.length, validRows: entries.length };
  }

  async importExcelResults(
    userId: string,
    schoolId: string,
    termId: string,
    classId: string,
    examType: string,
    file: Express.Multer.File,
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new BadRequestException('Invalid term');
    }

    if (term.resultsLocked) {
      throw new BadRequestException('Results are locked for this term');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      throw new BadRequestException('Excel file is empty');
    }

    const subjects = await this.prisma.subject.findMany({
      where: { schoolId },
    });
    const subjectMap = new Map(
      subjects.map((s) => [s.name.toLowerCase(), s.id]),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Get or create the result sheet
    const currentAcYear = term.academicYearId;
    let resultSheet = await this.prisma.resultSheet.findFirst({
      where: { classId, termId, examType },
    });

    if (!resultSheet) {
      const enrollmentCount = await this.prisma.enrollment.count({
        where: { classId, academicYearId: currentAcYear, status: 'ACTIVE' },
      });
      resultSheet = await this.prisma.resultSheet.create({
        data: {
          schoolId,
          classId,
          termId,
          academicYearId: currentAcYear,
          examType,
          createdBy: userId,
          totalStudents: enrollmentCount,
        },
      });
    }

    for (const row of rows) {
      const admissionNumber = String(row['AdmissionNumber'] || '').trim();
      if (!admissionNumber) {
        skipped++;
        continue;
      }

      const student = await this.prisma.student.findFirst({
        where: { admissionNumber, schoolId },
      });

      if (!student) {
        errors.push(`Student not found: ${admissionNumber}`);
        skipped++;
        continue;
      }

      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          academicYearId: currentAcYear,
          status: 'ACTIVE',
        },
      });

      for (const column in row) {
        const colLower = column.toLowerCase();
        if (['admissionnumber', 'firstname', 'lastname', 'class'].includes(colLower)) continue;

        const subjectId = subjectMap.get(colLower);
        if (!subjectId) continue;

        const val = row[column];
        if (val === undefined || val === '' || val === null) continue;

        const score = Number(val);
        if (isNaN(score) || score < 0 || score > 100) {
          errors.push(`Invalid score for ${admissionNumber} in ${column}`);
          continue;
        }

        const gradeResult = await this.gradingEngine.computeGradeFull(
          score, enrollment?.classId || classId, subjectId, termId, schoolId,
        );

        const existing = await this.prisma.result.findFirst({
          where: { studentId: student.id, subjectId, termId },
        });

        if (existing) {
          await this.prisma.result.update({
            where: { id: existing.id },
            data: {
              score,
              grade: gradeResult.grade,
              remark: gradeResult.remark,
              teacherId: userId,
            },
          });
          updated++;
        } else {
          await this.prisma.result.create({
            data: {
              studentId: student.id,
              subjectId,
              termId,
              schoolId,
              teacherId: userId,
              score,
              grade: gradeResult.grade,
              remark: gradeResult.remark,
            },
          });
          created++;
        }
      }
    }

    // Audit log
    await this.prisma.resultAuditLog.create({
      data: {
        schoolId,
        action: 'IMPORTED',
        entityType: 'RESULT_SHEET',
        entityId: resultSheet.id,
        classId,
        termId,
        performedBy: userId,
        metadata: { created, updated, skipped, errors: errors.length },
      },
    });

    return {
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      totalRows: rows.length,
    };
  }

  async createOrGetSheet(data: {
    schoolId: string;
    classId: string;
    termId: string;
    academicYearId: string;
    examType?: string;
    title?: string;
    description?: string;
    createdBy: string;
  }) {
    const existing = await this.prisma.resultSheet.findUnique({
      where: {
        classId_termId_examType: {
          classId: data.classId,
          termId: data.termId,
          examType: data.examType || 'END_TERM',
        },
      },
    });

    if (existing) {
      return existing;
    }

    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const term = await this.prisma.term.findUnique({ where: { id: data.termId }, select: { academicYearId: true } });
      if (term) academicYearId = term.academicYearId;
    }

    const totalStudents = await this.prisma.enrollment.count({
      where: {
        classId: data.classId,
        academicYearId,
        status: 'ACTIVE',
      },
    });

    return this.prisma.resultSheet.create({
      data: {
        schoolId: data.schoolId,
        classId: data.classId,
        termId: data.termId,
        academicYearId,
        examType: data.examType || 'END_TERM',
        title: data.title,
        description: data.description,
        createdBy: data.createdBy,
        totalStudents,
      },
      include: {
        class: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
      },
    });
  }
}
