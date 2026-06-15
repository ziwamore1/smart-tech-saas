import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
import { RankingService } from '../ranking-service/ranking.service';
import { ResultAnalyticsService } from '../result-analytics/result-analytics.service';
import { ReportCardEngineService } from '../report-card-engine/report-card-engine.service';
import { AssessmentEngineService } from '../assessment-engine/assessment-engine.service';
import { Prisma } from '@prisma/client';

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

    return this.prisma.resultSheet.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
      },
      orderBy: [{ term: { startDate: 'desc' } }, { class: { name: 'asc' } }],
    });
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

    const students = enrollments.map((e) => e.student);

    const computedResults = await this.prisma.computedResult.findMany({
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

    return {
      students: students.map((student) => ({
        ...student,
        results: computedResults.filter((r) => r.studentId === student.id),
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
          submittedBy: userId,
          submittedAt: new Date(),
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

      return { ...updated, computationSummary: computationResults };
    });
  }

  async publishSheet(id: string, userId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({ where: { id } });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    if (sheet.status !== 'VERIFIED') {
      throw new BadRequestException('Only verified sheets can be published');
    }

    return this.prisma.$transaction(async (tx) => {
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
          status: 'COMPUTED',
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

    return this.rankingService.computeClassRankings(sheet.classId, sheet.termId, sheet.schoolId);
  }

  async getAnalysis(sheetId: string) {
    const sheet = await this.prisma.resultSheet.findUnique({
      where: { id: sheetId },
      select: { classId: true, termId: true, schoolId: true },
    });

    if (!sheet) {
      throw new NotFoundException('Result sheet not found');
    }

    const [classAnalytics, atRiskStudents] = await Promise.all([
      this.resultAnalytics.getClassAnalytics(sheet.classId, sheet.termId, sheet.schoolId),
      this.resultAnalytics.getAtRiskStudents(sheet.classId, sheet.termId, sheet.schoolId),
    ]);

    return { ...classAnalytics, atRiskStudents };
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

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId: sheet.classId,
        termId: sheet.termId,
        studentId: { in: studentIds },
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      },
    });

    const schedule = students.map((student) => {
      const subjects = classSubjects.map((cs) => {
        const cr = computedResults.find(
          (r) => r.studentId === student.id && r.subjectId === cs.subjectId,
        );
        return {
          subjectId: cs.subjectId,
          subjectName: cs.subject.name,
          subjectCode: cs.subject.code,
          totalRawScore: cr?.totalRawScore ?? null,
          totalWeightedScore: cr?.totalWeightedScore ?? null,
          finalPercentage: cr?.finalPercentage ?? null,
          finalGrade: cr?.finalGrade ?? null,
          finalRemark: cr?.finalRemark ?? null,
          points: cr?.points ?? null,
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
        totalSubjects: validSubjects.length,
        totalPoints: validSubjects.reduce((sum, s) => sum + (s.points ?? 0), 0),
      };
    });

    const className = await this.prisma.class.findUnique({
      where: { id: sheet.classId },
      select: { name: true },
    });

    return {
      sheetId,
      classId: sheet.classId,
      className: className?.name,
      termId: sheet.termId,
      subjects: classSubjects.map((cs) => ({
        id: cs.subjectId,
        name: cs.subject.name,
        code: cs.subject.code,
      })),
      students: schedule,
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

    const totalStudents = await this.prisma.enrollment.count({
      where: {
        classId: data.classId,
        academicYearId: data.academicYearId,
        status: 'ACTIVE',
      },
    });

    return this.prisma.resultSheet.create({
      data: {
        schoolId: data.schoolId,
        classId: data.classId,
        termId: data.termId,
        academicYearId: data.academicYearId,
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
