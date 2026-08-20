import { Injectable, NotFoundException, BadRequestException, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
import { RankingService } from '../ranking-service/ranking.service';
import { ResultAnalyticsService } from '../result-analytics/result-analytics.service';
import { ReportCardEngineService } from '../report-card-engine/report-card-engine.service';
import { AssessmentEngineService } from '../assessment-engine/assessment-engine.service';
import { ResultsSmsService } from '../results-sms/results-sms.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';
import { PushNotificationService } from '../push-notification/push-notification.service';
import { CompositeSubjectService } from '../composite-subject/composite-subject.service';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { normalizeExamType } from '../common/utils/exam-type.util';

type AnalysisBand = {
  labels: string[];
  points: number[];
  description: string;
};

function normaliseGrade(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase();
}

function analysisBands(systemName: string): { quality: AnalysisBand; quantity: AnalysisBand } {
  const name = systemName.toLowerCase();
  if (name.includes('grade 7')) {
    return {
      quality: { labels: ['ONE', 'TWO', 'THREE'], points: [1, 2, 3], description: 'Grades One to Three' },
      quantity: { labels: ['ONE', 'TWO', 'THREE', 'FOUR'], points: [1, 2, 3, 4], description: 'Grades One to Four' },
    };
  }
  if (name.includes('secondary')) {
    return {
      quality: { labels: ['1', '2', '3', '4', '5', '6'], points: [1, 2, 3, 4, 5, 6], description: 'Grades/Points 1 to 6' },
      quantity: { labels: ['1', '2', '3', '4', '5', '6', '7', '8'], points: [1, 2, 3, 4, 5, 6, 7, 8], description: 'Grades/Points 1 to 8' },
    };
  }
  if (name.includes('forms')) {
    return {
      quality: { labels: ['1', '2', '3'], points: [1, 2, 3], description: 'Grades/Points 1 to 3' },
      quantity: { labels: ['1', '2', '3', '4'], points: [1, 2, 3, 4], description: 'Grades/Points 1 to 4' },
    };
  }
  if (name.includes('university')) {
    return {
      quality: { labels: ['A+', 'A', 'B+', 'B'], points: [4.5, 4, 3.5, 3], description: 'A+ to B (CGPA quality band)' },
      quantity: { labels: ['A+', 'A', 'B+', 'B', 'C+', 'C'], points: [4.5, 4, 3.5, 3, 2.5, 2], description: 'A+ to C (CGPA quantity band)' },
    };
  }
  if (name.includes('college')) {
    return {
      quality: { labels: ['A', 'B'], points: [4, 3], description: 'Grades A to B' },
      quantity: { labels: ['A', 'B', 'C'], points: [4, 3, 2], description: 'Grades A to C' },
    };
  }
  return {
    quality: { labels: ['A', 'B', 'C', 'D'], points: [5, 4, 3, 2], description: 'Grades/Points A=5 to D=2' },
    quantity: { labels: ['A', 'B', 'C', 'D', 'E'], points: [5, 4, 3, 2, 1], description: 'Grades/Points A=5 to E=1' },
  };
}

function bandIncludes(band: AnalysisBand, grade: string | null, points: number | null): boolean {
  const gradeMatch = grade ? band.labels.includes(normaliseGrade(grade)) : false;
  const pointMatch = points != null && band.points.some(point => Math.abs(point - points) < 0.01);
  return gradeMatch || pointMatch;
}

function percentageScale(percentage: number | null, scales: any[]): any | null {
  if (percentage == null) return null;
  return scales.find(scale => percentage >= scale.minScore && percentage <= scale.maxScore) || null;
}

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
    private compositeSubjectService: CompositeSubjectService,
    @Optional() @Inject(forwardRef(() => ResultsSmsService))
    private resultsSmsService?: ResultsSmsService,
    private schoolEvents?: SchoolEventsGateway,
    private pushNotification?: PushNotificationService,
  ) {}

  private computingKeys = new Set<string>();

  private ensureComputedResults(classId: string, termId: string, schoolId: string): void {
    const key = `${classId}:${termId}:${schoolId}`;
    if (this.computingKeys.has(key)) return;
    this.computingKeys.add(key);

    const activeWhere: Prisma.ComputedResultWhereInput = { classId, termId, schoolId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, student: { status: 'ACTIVE' } };

    Promise.all([
      this.prisma.computedResult.count({ where: activeWhere }),
      this.prisma.computedResult.findFirst({
        where: { ...activeWhere, finalPercentage: null },
        select: { id: true },
      }),
    ]).then(([count, missingScoreRow]) => {
      if (count > 0 && !missingScoreRow) { this.computingKeys.delete(key); return; }
      return this.prisma.classSubject.findMany({ where: { classId }, select: { subjectId: true } });
    }).then(classSubjects => {
      if (!classSubjects || classSubjects.length === 0) { this.computingKeys.delete(key); return; }
      this.logger.log(`Auto-computing results for class ${classId}, term ${termId} (${classSubjects.length} subjects)`);
      return Promise.allSettled(
        classSubjects.map(cs =>
          this.gradingEngine.computeAllClassResults(classId, cs.subjectId, termId, schoolId)
            .catch(err => this.logger.warn(`Auto-compute failed for subject ${cs.subjectId}: ${err.message}`))
        ),
      );
    }).then(() => {
      this.computingKeys.delete(key);
      this.logger.log(`Auto-compute complete for class ${classId}, term ${termId}`);
    }).catch(err => {
      this.computingKeys.delete(key);
      this.logger.warn(`Auto-compute failed: ${err.message}`);
    });
  }

  async getResultSheets(
    schoolId: string,
    filters: { status?: string; classId?: string; termId?: string; examType?: string },
  ) {
    const targetTermId = filters.termId;
    const examType = normalizeExamType(filters.examType);

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
                where: { classId: cls.id, academicYearId: currentYear.id, status: 'ACTIVE', student: { status: 'ACTIVE' } },
              });
              const enteredStudents = await this.prisma.result.groupBy({
                by: ['studentId'],
                where: { schoolId, termId, student: { enrollments: { some: { classId: cls.id, academicYearId: currentYear.id, status: 'ACTIVE' } }, status: 'ACTIVE' } },
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
                  enteredCount: enteredStudents.length,
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
    if (filters.examType) where.examType = normalizeExamType(filters.examType);

    let sheets = await this.prisma.resultSheet.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, classTeacher: { select: { firstName: true, lastName: true } } } },
        term: { select: { id: true, name: true, academicYear: { select: { name: true } } } },
        school: { select: { id: true, name: true, address: true, phone: true, email: true } },
      },
      orderBy: [{ term: { startDate: 'desc' } }, { class: { name: 'asc' } }],
    });

    // Recalculate live counts for each sheet to fix stale 0s
    for (const sheet of sheets) {
      const termRecord = sheet.term as any;
      const ayId = sheet.academicYearId || termRecord?.academicYear?.id;
      if (!ayId) continue;

      const liveTotal = await this.prisma.enrollment.count({
        where: { classId: sheet.classId, academicYearId: ayId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      });
      const liveEntered = await this.prisma.result.groupBy({
        by: ['studentId'],
        where: { schoolId, termId: sheet.termId, student: { enrollments: { some: { classId: sheet.classId, academicYearId: ayId, status: 'ACTIVE' } }, status: 'ACTIVE' } },
      });
      const liveEnteredCount = liveEntered.length;

      if ((sheet as any).totalStudents !== liveTotal || (sheet as any).enteredCount !== liveEnteredCount) {
        await this.prisma.resultSheet.update({
          where: { id: sheet.id },
          data: { totalStudents: liveTotal, enteredCount: liveEnteredCount },
        });
        (sheet as any).totalStudents = liveTotal;
        (sheet as any).enteredCount = liveEnteredCount;
      }
    }

    // Auto-create sheet if none exists for the requested class+term
    if (sheets.length === 0 && filters.classId && targetTermId) {
      const term = await this.prisma.term.findUnique({
        where: { id: targetTermId },
        include: { academicYear: { select: { id: true } } },
      });
      if (term && term.academicYear) {
        const totalStudents = await this.prisma.enrollment.count({
          where: { classId: filters.classId, academicYearId: term.academicYear.id, status: 'ACTIVE', student: { status: 'ACTIVE' } },
        });
        const enteredStudents = await this.prisma.result.groupBy({
          by: ['studentId'],
          where: { schoolId, termId: targetTermId, student: { enrollments: { some: { classId: filters.classId, academicYearId: term.academicYear.id, status: 'ACTIVE' } }, status: 'ACTIVE' } },
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
            enteredCount: enteredStudents.length,
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
        student: { status: 'ACTIVE' },
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
          student: { status: 'ACTIVE' },
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
        student: { status: 'ACTIVE' },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ studentId: 'asc' }, { subject: { name: 'asc' } }],
    });

    if (computedResults.length === 0 && students.length > 0) {
      computedResults = await this.prisma.computedResult.findMany({
        where: {
          studentId: { in: students.map((s) => s.id) },
          termId: sheet.termId,
          student: { status: 'ACTIVE' },
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
        student: { status: 'ACTIVE' },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    const rawResultMap = new Map<string, { score: number; grade: string | null; remark: string | null; subjectId: string; subject?: any }>();
    for (const r of rawResults) {
      rawResultMap.set(`${r.studentId}::${r.subjectId}`, {
        score: r.score, grade: r.grade, remark: r.remark, subjectId: r.subjectId, subject: r.subject,
      });
    }

    const componentResults = await this.prisma.studentAssessmentResult.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        classId: sheet.classId,
        termId: sheet.termId,
        OR: [{ rawScore: { not: null } }, { isAbsent: true }],
        student: { status: 'ACTIVE' },
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    // Collect all assessment configurations needed to aggregate component scores
    const configSubjectIds = [...new Set(componentResults.map(c => c.subjectId))];
    const configs = configSubjectIds.length > 0
      ? await this.prisma.termAssessmentConfiguration.findMany({
          where: {
            classId: sheet.classId,
            termId: sheet.termId,
            subjectId: { in: configSubjectIds },
          },
        })
      : [];
    const configMap = new Map<string, { assessmentDefId: string; maxScore: number; weightPercentage: number }[]>();
    for (const cfg of configs) {
      const arr = configMap.get(cfg.subjectId) || [];
      arr.push({ assessmentDefId: cfg.assessmentDefId, maxScore: cfg.maxScore, weightPercentage: cfg.weightPercentage });
      configMap.set(cfg.subjectId, arr);
    }

    // Aggregate all component results per student+subject into a weighted percentage
    const componentAggMap = new Map<string, any>();
    for (const result of componentResults) {
      const key = `${result.studentId}::${result.subjectId}`;
      const existing = componentAggMap.get(key);
      if (!existing) {
        componentAggMap.set(key, {
          studentId: result.studentId,
          subjectId: result.subjectId,
          subject: result.subject,
          entries: [result],
        });
      } else {
        existing.entries.push(result);
      }
    }

    // Clean up phantom ComputedResult records that have null finalPercentage
    // and no raw scores. These were created by earlier syncComputedResult runs
    // that found no component data but still upserted a PENDING record.
    const phantomIds = computedResults
      .filter(cr => cr.finalPercentage == null && cr.totalRawScore === 0)
      .map(cr => cr.id);
    if (phantomIds.length > 0) {
      this.prisma.computedResult.deleteMany({ where: { id: { in: phantomIds } } }).catch(() => {});
    }

    return {
      students: students.map((student) => {
        const crSubjects = new Set(
          computedResults
            .filter((r) => r.studentId === student.id && (r.finalPercentage != null || r.totalRawScore > 0))
            .map((r) => r.subjectId)
        );
        const crResults = computedResults
          .filter((r) => r.studentId === student.id && (r.finalPercentage != null || r.totalRawScore > 0))
          .map((cr) => {
          const raw = rawResultMap.get(`${cr.studentId}::${cr.subjectId}`);
          return {
            ...cr,
            score: cr.finalPercentage ?? cr.totalRawScore ?? raw?.score ?? null,
            grade: cr.finalGrade ?? raw?.grade ?? null,
            remark: cr.finalRemark ?? raw?.remark ?? null,
          };
        });
        const extraRawResults: any[] = [];
        for (const [key, raw] of rawResultMap) {
          if (key.startsWith(`${student.id}::`) && !crSubjects.has(raw.subjectId)) {
            extraRawResults.push({
              studentId: student.id,
              subjectId: raw.subjectId,
              subject: raw.subject,
              totalRawScore: raw.score,
              totalMaxScore: 100,
              finalPercentage: raw.score,
              finalGrade: raw.grade,
              finalRemark: raw.remark,
              score: raw.score,
              grade: raw.grade,
              remark: raw.remark,
            });
          }
        }
        for (const [key, agg] of componentAggMap) {
          if (!key.startsWith(`${student.id}::`) || crSubjects.has(agg.subjectId) || rawResultMap.has(key)) continue;
          const subjectConfigs = configMap.get(agg.subjectId) || [];
          let totalWeighted = 0;
          let totalWeight = 0;
          for (const entry of agg.entries) {
            if (entry.isAbsent) continue;
            const cfg = subjectConfigs.find(c => c.assessmentDefId === entry.assessmentDefId);
            const maxScore = cfg?.maxScore || entry.maxScore || 100;
            const weight = cfg?.weightPercentage || 0;
            if (entry.rawScore != null && weight > 0) {
              const pct = (entry.rawScore / maxScore) * 100;
              totalWeighted += pct * (weight / 100);
              totalWeight += weight;
            }
          }
          const aggregatedPct = totalWeight > 0
            ? parseFloat(((totalWeighted / totalWeight) * 100).toFixed(2))
            : null;
          extraRawResults.push({
            studentId: student.id,
            subjectId: agg.subjectId,
            subject: agg.subject,
            finalPercentage: aggregatedPct,
            score: aggregatedPct,
            totalRawScore: agg.entries.reduce((s: number, e: any) => s + (e.rawScore ?? 0), 0),
            grade: agg.entries[0]?.grade ?? null,
            remark: agg.entries[0]?.remarks ?? null,
          });
        }
        return { ...student, results: [...crResults, ...extraRawResults] };
      }),
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
      where: { classId: sheet.classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
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
            student: { status: 'ACTIVE' },
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

    const computationResults: { subjectId: string; computed: number; failed: number; error?: string }[] = [];
    for (const cs of classSubjects) {
      try {
        const result = await this.gradingEngine.computeAllClassResults(
          sheet.classId,
          cs.subjectId,
          sheet.termId,
          sheet.schoolId,
        );
        computationResults.push({ subjectId: cs.subjectId, ...result });
      } catch (error: any) {
        this.logger.error(`Verification compute failed for subject ${cs.subjectId}: ${error.message}`);
      computationResults.push({ subjectId: cs.subjectId, computed: 0, failed: 0, error: error.message });
      }
    }

    // Recompute all composite subjects for this class/term
    const compositeResults = await this.compositeSubjectService.recomputeAllCompositesForClass(sheet.classId, sheet.termId, sheet.schoolId).catch(e => {
      this.logger.warn(`Composite recompute failed during verify: ${e.message}`);
      return [];
    });

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
          student: { status: 'ACTIVE' },
        },
        data: { status: 'VERIFIED' },
      });

      await tx.resultAuditLog.create({
        data: {
          schoolId: sheet.schoolId,
          action: 'VERIFIED',
          entityType: 'RESULT_SHEET',
          entityId: id,
          classId: sheet.classId,
          termId: sheet.termId,
          performedBy: userId,
        },
      });

      return {
        ...updated,
        computationResults,
        compositeResults: compositeResults.length > 0 ? compositeResults : undefined,
      };
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
          student: { status: 'ACTIVE' },
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

    if (this.schoolEvents) {
      this.schoolEvents.emitResultsPublished(sheet.schoolId, {
        classId: sheet.classId,
        termId: sheet.termId,
        publishedBy: userId,
      });
    }

    if (this.pushNotification) {
      try {
        const [termInfo, classInfo, enrollments] = await Promise.all([
          this.prisma.term.findUnique({ where: { id: sheet.termId }, select: { name: true, academicYearId: true } }),
          this.prisma.class.findUnique({ where: { id: sheet.classId }, select: { name: true } }),
          this.prisma.enrollment.findMany({
            where: {
              classId: sheet.classId,
              status: 'ACTIVE',
            },
            include: {
              student: {
                include: {
                  user: { select: { id: true } },
                  parents: { include: { parent: { select: { email: true } } } },
                },
              },
            },
          }),
        ]);
        const termName = termInfo?.name || '';
        const className = classInfo?.name || '';
        const baseData = { type: 'result_published', classId: sheet.classId, termId: sheet.termId };

        const parentTargets: { userId: string; childName: string; studentId: string }[] = [];
          for (const enrollment of enrollments) {
            const student = enrollment.student;
            // Some legacy student records have the User -> Student foreign key
            // but the inverse relation is not populated consistently. Resolve
            // by studentId as a fallback so student accounts are not skipped.
            const studentUserId = student?.user?.id || (await this.prisma.user.findUnique({
              where: { studentId: student.id },
              select: { id: true },
            }))?.id;
            if (studentUserId) {
              await this.pushNotification.sendToUser(studentUserId, {
                title: 'Results Published',
                body: `Your results for ${className}${termName ? ' - ' + termName : ''} are now available.`,
                data: baseData,
            });
          }
          for (const link of student?.parents || []) {
            if (link.parent?.email) {
              const parentUser = await this.prisma.user.findFirst({
                where: { email: link.parent.email },
                select: { id: true },
              });
              if (parentUser) {
                parentTargets.push({
                  userId: parentUser.id,
                  childName: `${student.firstName} ${student.lastName}`,
                  studentId: student.id,
                });
              }
            }
          }
        }

        for (const target of parentTargets) {
          await this.pushNotification.sendToUser(target.userId, {
            title: `${target.childName}'s Results Published`,
            body: `Results for ${className}${termName ? ' - ' + termName : ''} are now available.`,
            data: { ...baseData, studentId: target.studentId },
          });
        }

        await this.pushNotification.sendByRole(
          'Director',
          {
            title: 'Results Published',
            body: `Results for ${className}${termName ? ' - ' + termName : ''} were published.`,
            data: baseData,
          },
          sheet.schoolId,
        );
      } catch (error: any) {
        this.logger.error(`[Results Published Notification] Failed: ${error.message}`);
      }
    }

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
          student: { status: 'ACTIVE' },
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
          student: { status: 'ACTIVE' },
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

    this.ensureComputedResults(sheet.classId, sheet.termId, sheet.schoolId);

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
      let computedResults = await this.prisma.computedResult.findMany({
        where: {
          classId: sheet.classId,
          termId: sheet.termId,
          schoolId: sheet.schoolId,
          status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
          student: { status: 'ACTIVE' },
        },
        select: {
          studentId: true,
          finalPercentage: true,
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNumber: true, gender: true },
          },
        },
      });

      if (computedResults.length === 0) {
        return { male: [], female: [] };
      }

      const groupByGender = (genderFilter: string[]) => {
        const filtered = computedResults.filter((r) =>
          genderFilter.includes((r.student.gender || '').trim().toUpperCase()),
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
        gender: r.gender || null,
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

    this.ensureComputedResults(sheet.classId, sheet.termId, sheet.schoolId);

    const classRecord = await this.prisma.class.findUnique({
      where: { id: sheet.classId },
      select: {
        id: true,
        name: true,
        gradingSystem: { select: { id: true, name: true, gradeScales: true } },
      },
    });
    const configuredSystem = classRecord?.gradingSystem || await this.prisma.gradingSystem.findFirst({
      where: { schoolId: sheet.schoolId, isDefault: true },
      select: { id: true, name: true, gradeScales: true },
    });
    const systemName = configuredSystem?.name || 'Primary Grading System';
    const scales = configuredSystem?.gradeScales || [];
    const bands = analysisBands(systemName);
    const gradingProfile = {
      systemId: configuredSystem?.id || null,
      systemName,
      source: classRecord?.gradingSystem ? 'CLASS' : configuredSystem ? 'SCHOOL_DEFAULT' : 'FALLBACK',
      quality: bands.quality,
      quantity: bands.quantity,
    };

    const emptyAnalysis = {
      totalStudents: 0,
      passRate: 0,
      averagePercentage: 0,
      distinctionRate: 0,
      atRiskCount: 0,
      gradeDistribution: {},
      subjectAnalysis: [],
      students: [],
      atRiskStudents: [],
      gradingProfile,
      quality: { passed: 0, total: 0, rate: 0, failed: 0, label: bands.quality.description },
      quantity: { passed: 0, total: 0, rate: 0, failed: 0, label: bands.quantity.description },
      qualityStudentRate: 0,
      quantityStudentRate: 0,
    };

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId: sheet.classId,
        termId: sheet.termId,
        schoolId: sheet.schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        student: { status: 'ACTIVE' },
      },
      select: {
        studentId: true,
        subjectId: true,
        finalPercentage: true,
        finalGrade: true,
        finalRemark: true,
        points: true,
        totalRawScore: true,
        isAbsent: true,
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true, gender: true },
        },
        subject: {
          select: { id: true, name: true },
        },
      },
    });

    if (computedResults.length === 0) {
      this.logger.warn(`No computed results for class ${sheet.classId}, term ${sheet.termId}`);
      return emptyAnalysis;
    }

    const studentIds = [...new Set(computedResults.map(r => r.studentId))];
    const subjectIds = [...new Set(computedResults.map(r => r.subjectId).filter(Boolean))];

    const rawResults = await this.prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        subjectId: { in: subjectIds },
        termId: sheet.termId,
        schoolId: sheet.schoolId,
        student: { status: 'ACTIVE' },
      },
      select: {
        studentId: true,
        subjectId: true,
        score: true,
      },
    });

    const rawScoreMap = new Map<string, number>();
    for (const r of rawResults) {
      if (r.score != null) {
        rawScoreMap.set(`${r.studentId}::${r.subjectId}`, r.score);
      }
    }

    const records = computedResults.map(cr => {
      let effectivePercentage = cr.finalPercentage;
      if (effectivePercentage == null || effectivePercentage === 0) {
        const rawScore = cr.subjectId ? rawScoreMap.get(`${cr.studentId}::${cr.subjectId}`) : undefined;
        if (rawScore != null) {
          effectivePercentage = rawScore;
        }
      }

      const scale = percentageScale(effectivePercentage, scales);
      const grade = scale?.grade || cr.finalGrade || null;
      const points = scale?.points ?? cr.points ?? null;
      return {
        ...cr,
        effectivePercentage,
        grade,
        points,
        qualityPassed: !cr.isAbsent && bandIncludes(bands.quality, grade, points),
        quantityPassed: !cr.isAbsent && bandIncludes(bands.quantity, grade, points),
      };
    });

    const studentAverages = new Map<string, any>();
    for (const cr of records) {
      const existing = studentAverages.get(cr.studentId) || {
        studentId: cr.studentId,
        firstName: cr.student.firstName,
        lastName: cr.student.lastName,
        admissionNumber: cr.student.admissionNumber,
        gender: (cr.student as any).gender ?? null,
        totalPercentage: 0,
        count: 0,
        qualityPassed: 0,
        quantityPassed: 0,
        gradedCount: 0,
        qualitySubjects: 0,
        quantitySubjects: 0,
      };
      if (cr.effectivePercentage != null && !cr.isAbsent) {
        existing.totalPercentage += cr.effectivePercentage;
        existing.count += 1;
        existing.gradedCount += 1;
        existing.qualityPassed += cr.qualityPassed ? 1 : 0;
        existing.quantityPassed += cr.quantityPassed ? 1 : 0;
      }
      studentAverages.set(cr.studentId, existing);
    }

    const students = Array.from(studentAverages.values()).map(s => ({
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      admissionNumber: s.admissionNumber,
      gender: s.gender,
      percentage: s.count > 0 ? parseFloat((s.totalPercentage / s.count).toFixed(2)) : 0,
      grade: percentageScale(s.count > 0 ? s.totalPercentage / s.count : null, scales)?.grade || null,
      qualitySubjects: s.qualityPassed,
      quantitySubjects: s.quantityPassed,
      subjectCount: s.gradedCount,
      qualityPassed: s.gradedCount > 0 && s.qualityPassed === s.gradedCount,
      quantityPassed: s.gradedCount > 0 && s.quantityPassed === s.gradedCount,
    }));

    const validRecords = records.filter(r => r.effectivePercentage != null && !r.isAbsent);
    const overallScores = validRecords.map(r => r.effectivePercentage as number);
    const totalStudents = studentAverages.size;
    const overallAvg = overallScores.length > 0 ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length : 0;
    const qualityPassed = validRecords.filter(r => r.qualityPassed).length;
    const quantityPassed = validRecords.filter(r => r.quantityPassed).length;
    const qualityStudentCount = students.filter(s => s.qualityPassed).length;
    const quantityStudentCount = students.filter(s => s.quantityPassed).length;
    const qualityRate = validRecords.length > 0 ? parseFloat(((qualityPassed / validRecords.length) * 100).toFixed(2)) : 0;
    const quantityRate = validRecords.length > 0 ? parseFloat(((quantityPassed / validRecords.length) * 100).toFixed(2)) : 0;
    const qualityStudentRate = totalStudents > 0 ? parseFloat(((qualityStudentCount / totalStudents) * 100).toFixed(2)) : 0;
    const quantityStudentRate = totalStudents > 0 ? parseFloat(((quantityStudentCount / totalStudents) * 100).toFixed(2)) : 0;

    const gradeDistribution: Record<string, number> = {};
    students.forEach(student => {
      const grade = student.grade || 'Unknown';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });

    const subjectAnalytics = records.reduce((acc: Record<string, any>, result) => {
      if (!acc[result.subjectId]) {
        acc[result.subjectId] = { subjectId: result.subjectId, subjectName: result.subject.name, records: [] };
      }
      acc[result.subjectId].records.push(result);
      return acc;
    }, {});

    const subjectAnalysis = Object.values(subjectAnalytics).map((subject: any) => {
      const subjectRecords = subject.records.filter((r: any) => r.effectivePercentage != null && !r.isAbsent);
      const scores = subjectRecords.map((r: any) => r.effectivePercentage).sort((a: number, b: number) => a - b);
      const total = scores.length;
      const sum = scores.reduce((a: number, b: number) => a + b, 0);
      const avg = total > 0 ? sum / total : 0;
      const min = scores[0] ?? 0;
      const max = scores[total - 1] ?? 0;
      const qualityCount = subjectRecords.filter((r: any) => r.qualityPassed).length;
      const quantityCount = subjectRecords.filter((r: any) => r.quantityPassed).length;
      const passRate = total > 0 ? (quantityCount / total) * 100 : 0;
      const qualityRate = total > 0 ? (qualityCount / total) * 100 : 0;
      return {
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        totalStudents: total,
        average: parseFloat(avg.toFixed(2)),
        highest: parseFloat(max.toFixed(2)),
        lowest: parseFloat(min.toFixed(2)),
        passRate: parseFloat(passRate.toFixed(2)),
        distinctionRate: parseFloat(qualityRate.toFixed(2)),
        qualityPassRate: parseFloat(qualityRate.toFixed(2)),
        quantityPassRate: parseFloat(passRate.toFixed(2)),
        qualityPassed: qualityCount,
        quantityPassed: quantityCount,
        gradedCount: total,
      };
    });

    const atRiskStudents = students.filter(s => !s.quantityPassed).sort((a, b) => a.percentage - b.percentage);

    // Gender-based stats
    const isMale = (g: string | null) => g && ['MALE', 'M'].includes(g.trim().toUpperCase());
    const isFemale = (g: string | null) => g && ['FEMALE', 'F'].includes(g.trim().toUpperCase());
    const maleStudents = students.filter(s => isMale(s.gender));
    const femaleStudents = students.filter(s => isFemale(s.gender));
    const malePassCount = maleStudents.filter(s => s.quantityPassed).length;
    const femalePassCount = femaleStudents.filter(s => s.quantityPassed).length;
    const malePassRate = maleStudents.length > 0 ? parseFloat(((malePassCount / maleStudents.length) * 100).toFixed(2)) : 0;
    const femalePassRate = femaleStudents.length > 0 ? parseFloat(((femalePassCount / femaleStudents.length) * 100).toFixed(2)) : 0;
    const maleAverage = maleStudents.length > 0 ? parseFloat((maleStudents.reduce((sum, s) => sum + s.percentage, 0) / maleStudents.length).toFixed(2)) : 0;
    const femaleAverage = femaleStudents.length > 0 ? parseFloat((femaleStudents.reduce((sum, s) => sum + s.percentage, 0) / femaleStudents.length).toFixed(2)) : 0;

    // Gender-based subject stats
    const subjectGenderAnalysis = Object.values(subjectAnalytics).map((subject: any) => {
      const maleScores: number[] = [];
      const femaleScores: number[] = [];
      records
        .filter(r => r.subjectId === subject.subjectId)
        .forEach(r => {
          const score = r.effectivePercentage ?? 0;
          const gender = (r.student as any).gender;
          const gNorm = gender ? gender.trim().toUpperCase() : '';
          if (gNorm === 'MALE' || gNorm === 'M') maleScores.push(score);
          else if (gNorm === 'FEMALE' || gNorm === 'F') femaleScores.push(score);
        });
      return {
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        maleCount: maleScores.length,
        femaleCount: femaleScores.length,
        maleAverage: maleScores.length > 0 ? parseFloat((maleScores.reduce((a, b) => a + b, 0) / maleScores.length).toFixed(2)) : 0,
        femaleAverage: femaleScores.length > 0 ? parseFloat((femaleScores.reduce((a, b) => a + b, 0) / femaleScores.length).toFixed(2)) : 0,
           malePassRate: maleScores.length > 0 ? parseFloat(((subject.records.filter((r: any) => r.qualityPassed && ['MALE', 'M'].includes(String(r.student.gender || '').toUpperCase())).length / maleScores.length) * 100).toFixed(2)) : 0,
           femalePassRate: femaleScores.length > 0 ? parseFloat(((subject.records.filter((r: any) => r.qualityPassed && ['FEMALE', 'F'].includes(String(r.student.gender || '').toUpperCase())).length / femaleScores.length) * 100).toFixed(2)) : 0,
           maleQualityPassRate: maleScores.length > 0 ? parseFloat(((subject.records.filter((r: any) => r.qualityPassed && ['MALE', 'M'].includes(String(r.student.gender || '').toUpperCase())).length / maleScores.length) * 100).toFixed(2)) : 0,
           femaleQualityPassRate: femaleScores.length > 0 ? parseFloat(((subject.records.filter((r: any) => r.qualityPassed && ['FEMALE', 'F'].includes(String(r.student.gender || '').toUpperCase())).length / femaleScores.length) * 100).toFixed(2)) : 0,
        };
      });

    return {
      totalStudents,
       passRate: quantityRate,
       averagePercentage: parseFloat(overallAvg.toFixed(2)),
       distinctionRate: qualityRate,
      atRiskCount: atRiskStudents.length,
      gradeDistribution,
      subjectAnalysis,
      students,
      atRiskStudents,
      genderStats: {
        maleCount: maleStudents.length,
        femaleCount: femaleStudents.length,
        malePassRate,
        femalePassRate,
        maleAverage,
        femaleAverage,
      },
       subjectGenderAnalysis,
       gradingProfile,
       quality: { passed: qualityPassed, total: validRecords.length, rate: qualityRate, failed: validRecords.length - qualityPassed, label: bands.quality.description },
       quantity: { passed: quantityPassed, total: validRecords.length, rate: quantityRate, failed: validRecords.length - quantityPassed, label: bands.quantity.description },
       qualityStudentRate,
       quantityStudentRate,
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
        student: { status: 'ACTIVE' },
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
        student: { status: 'ACTIVE' },
      },
    });

    if (computedResults.length === 0 && studentIds.length > 0) {
      computedResults = await this.prisma.computedResult.findMany({
        where: {
          termId: sheet.termId,
          studentId: { in: studentIds },
          student: { status: 'ACTIVE' },
        },
      });
    }

    const rawResults = await this.prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        termId: sheet.termId,
        schoolId: sheet.schoolId,
        student: { status: 'ACTIVE' },
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
        return `<td style="text-align:center;padding:6px 8px;border:1px solid #c4b5a3;${pct == null ? 'background:#fffbeb;' : !passed ? 'background:#fef2f2;' : ''}">
          ${pct != null ? `<div style="font-weight:700;font-size:13px;color:${passed ? '#047857' : '#b91c1c'}">${pct.toFixed(1)}%</div>
          <div style="font-size:12px;color:#374151">${grade} | ${points} pts</div>` : '<span style="color:#9ca3af">-</span>'}
        </td>`;
      });

      const validSubjects = s.subjects?.filter((sr: any) => sr.finalPercentage != null) || [];
      const avg = validSubjects.length > 0
        ? validSubjects.reduce((sum: number, sr: any) => sum + sr.finalPercentage, 0) / validSubjects.length
        : null;

      return `<tr>
        <td style="text-align:center;padding:6px 12px;border:1px solid #c4b5a3;font-weight:700;color:#3d2f24">${s.rank || '-'}</td>
        <td style="padding:6px 12px;border:1px solid #c4b5a3;font-weight:700">${s.student?.firstName || ''} ${s.student?.lastName || ''}</td>
        <td style="padding:6px 12px;border:1px solid #c4b5a3;color:#374151;font-size:12px">${s.student?.admissionNumber || '-'}</td>
        <td style="padding:6px 12px;border:1px solid #c4b5a3;color:#374151;font-size:12px">${s.student?.gender || '-'}</td>
        ${subjectCells.join('')}
        <td style="text-align:center;padding:6px 12px;border:1px solid #c4b5a3;font-weight:700;${avg != null && avg >= passThreshold ? 'color:#047857' : avg != null ? 'color:#b91c1c' : 'color:#9ca3af'}">
          ${avg != null ? `${avg.toFixed(1)}%` : '-'}
        </td>
        <td style="text-align:center;padding:6px 12px;border:1px solid #c4b5a3;font-weight:700">${s.totalPoints ?? 0}</td>
      </tr>`;
    }).join('');

    const subjectHeaders = subjects.map((sub: any) =>
      `<th style="text-align:center;padding:10px 8px;background:#4b3b2e;color:white;font-size:12px;font-weight:700;text-transform:uppercase;border:1px solid #2f241b;min-width:80px">${sub.name}</th>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mark Schedule - ${sheet.class?.name || ''}</title>
  <style>
    @page { margin: 20mm; size: A4 landscape; }
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { margin: 0; padding: 20px; color: #111827; font-size: 13px; }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #4b3b2e; }
    .header h1 { margin: 0; font-size: 22px; color: #4b3b2e; }
    .header .school-name { font-size: 18px; font-weight: 700; }
    .header .details { font-size: 14px; color: #374151; margin-top: 6px; font-weight: 600; }
    .header .details span { margin: 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #4b3b2e; color: white; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; border: 1px solid #2f241b; position: sticky; top: 0; }
    td { padding: 8px 12px; border: 1px solid #c4b5a3; }
    tr:nth-child(even) { background: #f5efe8; }
    tr:hover { background: #ede3d8; }
    .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
    .signatures .sig { text-align: center; }
    .signatures .sig .line { width: 200px; border-top: 1px solid #111827; margin-top: 40px; padding-top: 8px; font-size: 13px; color: #374151; font-weight: 600; }
    .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 24px; background: #4b3b2e; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; z-index: 100; }
    @media print { .print-btn { display: none; } body { padding: 0; } }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #4b5563; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; }
    .badge-pass { background: #d1fae5; color: #047857; }
    .badge-fail { background: #fee2e2; color: #b91c1c; }
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
      where: { schoolId, status: 'ACTIVE' },
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
    const normalisedExamType = normalizeExamType(examType);
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
      where: { classId, termId, examType: normalisedExamType },
    });

    if (!resultSheet) {
      const enrollmentCount = await this.prisma.enrollment.count({
        where: { classId, academicYearId: currentAcYear, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      });
      resultSheet = await this.prisma.resultSheet.create({
        data: {
          schoolId,
          classId,
          termId,
          academicYearId: currentAcYear,
          examType: normalisedExamType,
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
        where: { admissionNumber, schoolId, status: 'ACTIVE' },
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
          student: { status: 'ACTIVE' },
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
          where: { studentId: student.id, subjectId, termId, student: { status: 'ACTIVE' } },
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

    this.ensureComputedResults(classId, termId, schoolId);

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
    const examType = normalizeExamType(data.examType);
    const existing = await this.prisma.resultSheet.findUnique({
      where: {
        classId_termId_examType: {
          classId: data.classId,
          termId: data.termId,
          examType,
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
        student: { status: 'ACTIVE' },
      },
    });

    return this.prisma.resultSheet.create({
      data: {
        schoolId: data.schoolId,
        classId: data.classId,
        termId: data.termId,
        academicYearId,
        examType,
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
