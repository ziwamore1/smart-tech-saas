import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from 'decimal.js';

export interface GradeResult {
  grade: string;
  remark: string;
  points?: number;
  gpa?: number;
}

export interface ComputeClassResultsDto {
  classId: string;
  subjectId: string;
  termId: string;
  schoolId: string;
}

@Injectable()
export class GradingEngineService {
  private readonly logger = new Logger(GradingEngineService.name);

  constructor(private prisma: PrismaService) {}

  async computeGrade(
    percentage: number,
    classId: string,
    subjectId: string,
    termId: string,
    schoolId: string,
  ): Promise<string | null> {
    // First check: new GradingSystem via class.gradingSystemId
    if (classId) {
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
        include: {
          gradingSystem: {
            include: { gradeScales: { orderBy: { minScore: 'asc' } } },
          },
        },
      });

      if (cls?.gradingSystem?.gradeScales?.length > 0) {
        const scale = cls.gradingSystem.gradeScales.find(
          s => percentage >= s.minScore && percentage <= s.maxScore,
        );
        if (scale) return scale.grade;
      }
    }

    // Fallback: old GradingPolicy via ClassGradingPolicy
    const policy = await this.getActiveGradingPolicy(classId, subjectId, termId, schoolId);

    if (!policy) {
      return this.getDefaultGradeForSchool(percentage, schoolId);
    }

    const scale = await this.prisma.gradingScale.findFirst({
      where: {
        policyId: policy.id,
        minScore: { lte: percentage },
        maxScore: { gte: percentage },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return scale?.grade || this.getDefaultGradeForSchool(percentage, schoolId);
  }

  async computeGradeFull(
    percentage: number,
    classId: string,
    subjectId: string,
    termId: string,
    schoolId: string,
  ): Promise<GradeResult> {
    // First check: new GradingSystem via class.gradingSystemId
    if (classId) {
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
        include: {
          gradingSystem: {
            include: { gradeScales: { orderBy: { minScore: 'asc' } } },
          },
        },
      });

      if (cls?.gradingSystem?.gradeScales?.length > 0) {
        const scale = cls.gradingSystem.gradeScales.find(
          s => percentage >= s.minScore && percentage <= s.maxScore,
        );
        if (scale) {
          return {
            grade: scale.grade,
            remark: scale.remark,
            points: scale.points ?? undefined,
            gpa: undefined,
          };
        }
      }
    }

    // Fallback: old GradingPolicy via ClassGradingPolicy
    const policy = await this.getActiveGradingPolicy(classId, subjectId, termId, schoolId);

    if (!policy) {
      const defaultGrade = this.getDefaultGradeForSchool(percentage, schoolId);
      return {
        grade: defaultGrade,
        remark: this.getDefaultRemarkForSchool(percentage, schoolId),
        points: this.getDefaultPointsForSchool(percentage, schoolId),
      };
    }

    const scale = await this.prisma.gradingScale.findFirst({
      where: {
        policyId: policy.id,
        minScore: { lte: percentage },
        maxScore: { gte: percentage },
      },
    });

    return {
      grade: scale?.grade || this.getDefaultGradeForSchool(percentage, schoolId),
      remark: scale?.remark || this.getDefaultRemarkForSchool(percentage, schoolId),
      points: scale?.points ?? undefined,
      gpa: scale?.gpa ?? undefined,
    };
  }

  async computeWeightedTotal(
    studentId: string,
    subjectId: string,
    termId: string,
    classId: string,
    schoolId: string,
  ): Promise<{
    totalRawScore: number | null;
    totalWeightedScore: number | null;
    finalPercentage: number | null;
    finalGrade: string | null;
    finalRemark: string | null;
    points: number | null;
    gpa: number | null;
  }> {
    const configs = await this.prisma.termAssessmentConfiguration.findMany({
      where: { classId, subjectId, termId },
      orderBy: { sequenceOrder: 'asc' },
    });

    if (configs.length === 0) {
      return {
        totalRawScore: null,
        totalWeightedScore: null,
        finalPercentage: null,
        finalGrade: null,
        finalRemark: null,
        points: null,
        gpa: null,
      };
    }

    const results = await this.prisma.studentAssessmentResult.findMany({
      where: {
        studentId,
        subjectId,
        termId,
        assessmentDefId: { in: configs.map(c => c.assessmentDefId) },
        status: { not: 'DRAFT' },
      },
    });

    let totalWeightedScore = new Decimal(0);
    let totalWeight = 0;
    let totalRawScore = new Decimal(0);
    let hasAllMandatory = true;

    for (const config of configs) {
      const result = results.find(r => r.assessmentDefId === config.assessmentDefId);

      if (config.mandatory && !result?.rawScore) {
        hasAllMandatory = false;
      }

      if (result?.rawScore !== null && result?.rawScore !== undefined) {
        const rawScore = new Decimal(result.rawScore);
        const maxScore = new Decimal(result.maxScore || config.maxScore);
        const weight = new Decimal(config.weightPercentage);

        const percentage = rawScore.div(maxScore).mul(100);
        const weightedContribution = percentage.mul(weight).div(100);

        totalWeightedScore = totalWeightedScore.add(weightedContribution);
        totalRawScore = totalRawScore.add(rawScore);
        totalWeight += config.weightPercentage;
      }
    }

    if (totalWeight === 0 || !hasAllMandatory) {
      return {
        totalRawScore: totalRawScore.toNumber(),
        totalWeightedScore: null,
        finalPercentage: null,
        finalGrade: null,
        finalRemark: null,
        points: null,
        gpa: null,
      };
    }

    const finalPercentage = totalWeightedScore.toNumber();
    const gradeResult = await this.computeGradeFull(
      finalPercentage,
      classId,
      subjectId,
      termId,
      schoolId,
    );

    return {
      totalRawScore: totalRawScore.toNumber(),
      totalWeightedScore: totalWeightedScore.toNumber(),
      finalPercentage,
      finalGrade: gradeResult.grade,
      finalRemark: gradeResult.remark,
      points: gradeResult.points ?? null,
      gpa: gradeResult.gpa ?? null,
    };
  }

  async computeAllClassResults(
    classId: string,
    subjectId: string,
    termId: string,
    schoolId: string,
  ): Promise<{
    computed: number;
    failed: number;
    results: any[];
  }> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const computed = [];
    const failed = [];

    for (const enrollment of enrollments) {
      try {
        const result = await this.computeWeightedTotal(
          enrollment.studentId,
          subjectId,
          termId,
          classId,
          schoolId,
        );

        const computedResult = await this.prisma.computedResult.upsert({
          where: {
            studentId_subjectId_termId: {
              studentId: enrollment.studentId,
              subjectId,
              termId,
            },
          },
          update: {
            ...result,
            status: 'COMPUTED',
            computedAt: new Date(),
          },
          create: {
            studentId: enrollment.studentId,
            subjectId,
            termId,
            classId,
            schoolId,
            ...result,
            status: 'COMPUTED',
            computedAt: new Date(),
          },
        });

        computed.push(computedResult);
      } catch (error) {
        this.logger.error(`Failed to compute result for student ${enrollment.studentId}: ${error.message}`);
        failed.push(enrollment.studentId);
      }
    }

    this.logger.log(`Computed ${computed.length} results for class ${classId}, subject ${subjectId}, term ${termId}`);

    return {
      computed: computed.length,
      failed: failed.length,
      results: computed,
    };
  }

  async computeTermSummary(
    studentId: string,
    termId: string,
    schoolId: string,
  ): Promise<any> {
    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        studentId,
        termId,
        status: 'COMPUTED',
      },
      include: {
        subject: true,
        class: true,
      },
    });

    if (computedResults.length === 0) {
      return null;
    }

    const institutionType = await this.getSchoolInstitutionType(schoolId);
    const isPrimary = institutionType === 'PRIMARY_SCHOOL';
    const passThreshold = isPrimary ? 35 : 50;

    const classId = computedResults[0].classId;
    const classSize = await this.prisma.enrollment.count({
      where: { classId, status: 'ACTIVE' },
    });

    const subjectsPassed = computedResults.filter(r => {
      const percentage = r.finalPercentage ?? 0;
      return percentage >= passThreshold;
    }).length;

    const subjectsFailed = computedResults.length - subjectsPassed;

    const avgPercentage = computedResults.reduce((sum, r) => sum + (r.finalPercentage ?? 0), 0) / computedResults.length;

    const overallGradeResult = await this.computeGradeFull(
      avgPercentage,
      classId,
      null,
      termId,
      schoolId,
    );

    const sortedByPercentage = [...computedResults].sort((a, b) => (b.finalPercentage ?? 0) - (a.finalPercentage ?? 0));
    const strengths = sortedByPercentage.slice(0, 3).map(r => r.subject.name);
    const weaknesses = sortedByPercentage.slice(-3).reverse().map(r => r.subject.name);

    const avgGpa = computedResults.some(r => r.gpa !== null)
      ? computedResults.reduce((sum, r) => sum + (r.gpa ?? 0), 0) / computedResults.filter(r => r.gpa !== null).length
      : null;

    const totalPoints = computedResults.reduce((sum, r) => sum + (r.points ?? 0), 0);

    return {
      studentId,
      termId,
      classId,
      schoolId,
      totalSubjects: computedResults.length,
      subjectsPassed,
      subjectsFailed,
      overallPercentage: parseFloat(avgPercentage.toFixed(2)),
      overallGrade: overallGradeResult.grade,
      overallRemark: overallGradeResult.remark,
      gpa: avgGpa ? parseFloat(avgGpa.toFixed(2)) : null,
      totalPoints: parseFloat(totalPoints.toFixed(2)),
      classSize,
      strengths,
      weaknesses,
      status: 'COMPUTED',
      computedAt: new Date(),
    };
  }

  async createGradingPolicy(schoolId: string, data: {
    name: string;
    code: string;
    description?: string;
    type?: string;
    isDefault?: boolean;
    scales: {
      minScore: number;
      maxScore: number;
      grade: string;
      remark: string;
      points?: number;
      gpa?: number;
      color?: string;
      sortOrder?: number;
    }[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.gradingPolicy.updateMany({
          where: { schoolId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const policy = await tx.gradingPolicy.create({
        data: {
          schoolId,
          name: data.name,
          code: data.code,
          description: data.description,
          type: data.type as any || 'PERCENTAGE',
          isDefault: data.isDefault ?? false,
        },
      });

      const scales = await Promise.all(
        data.scales.map(scale =>
          tx.gradingScale.create({
            data: {
              policyId: policy.id,
              minScore: scale.minScore,
              maxScore: scale.maxScore,
              grade: scale.grade,
              remark: scale.remark,
              points: scale.points,
              gpa: scale.gpa,
              color: scale.color,
              sortOrder: scale.sortOrder ?? 0,
            },
          }),
        ),
      );

      return { policy, scales };
    });
  }

  async getGradingPolicies(schoolId: string) {
    return this.prisma.gradingPolicy.findMany({
      where: { schoolId, active: true },
      include: {
        scales: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { isDefault: 'desc' },
    });
  }

  async getGradingPolicyById(id: string) {
    return this.prisma.gradingPolicy.findUnique({
      where: { id },
      include: {
        scales: { orderBy: { sortOrder: 'asc' } },
        classPolicies: {
          include: {
            class: { select: { id: true, name: true, code: true } },
            subject: { select: { id: true, name: true, code: true } },
            term: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async getClassTermReport(classId: string, termId: string, schoolId: string) {
    const computedResults = await this.prisma.computedResult.findMany({
      where: { classId, termId, schoolId, status: 'COMPUTED' },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentNumber: true },
        },
        subject: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [
        { student: { lastName: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });

    const enrollments = await this.prisma.enrollment.count({
      where: { classId, status: 'ACTIVE' },
    });

    const subjectAverages: Record<string, { count: number; total: number; name: string }> = {};
    for (const r of computedResults) {
      if (r.finalPercentage != null) {
        if (!subjectAverages[r.subjectId]) {
          subjectAverages[r.subjectId] = { count: 0, total: 0, name: r.subject.name };
        }
        subjectAverages[r.subjectId].count++;
        subjectAverages[r.subjectId].total += r.finalPercentage;
      }
    }

    const subjectSummary = Object.entries(subjectAverages).map(([id, data]) => ({
      subjectId: id,
      subjectName: data.name,
      averagePercentage: parseFloat((data.total / data.count).toFixed(2)),
      studentCount: data.count,
    }));

    const classAverage = computedResults.length > 0
      ? parseFloat((computedResults.reduce((s, r) => s + (r.finalPercentage ?? 0), 0) / computedResults.length).toFixed(2))
      : null;

    return {
      classId,
      termId,
      totalStudents: enrollments,
      studentsWithResults: computedResults.length
        ? [...new Set(computedResults.map(r => r.studentId))].length
        : 0,
      classAverage,
      subjectSummary,
      results: computedResults.map(r => ({
        studentId: r.studentId,
        studentName: `${r.student.firstName} ${r.student.lastName}`,
        studentNumber: r.student.studentNumber,
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        totalRawScore: r.totalRawScore,
        finalPercentage: r.finalPercentage,
        finalGrade: r.finalGrade,
        finalRemark: r.finalRemark,
        points: r.points,
        classRank: r.classRank,
        subjectRank: r.subjectRank,
      })),
    };
  }

  async assignGradingPolicy(data: {
    classId: string;
    subjectId?: string;
    termId?: string;
    policyId: string;
    schoolId: string;
  }) {
    return this.prisma.classGradingPolicy.upsert({
      where: {
        classId_subjectId_termId_policyId: {
          classId: data.classId,
          subjectId: data.subjectId || '',
          termId: data.termId || '',
          policyId: data.policyId,
        },
      },
      update: { policyId: data.policyId },
      create: {
        classId: data.classId,
        subjectId: data.subjectId,
        termId: data.termId,
        policyId: data.policyId,
        schoolId: data.schoolId,
      },
      include: {
        policy: {
          include: { scales: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  }

  async getActiveGradingPolicy(
    classId: string,
    subjectId: string | null,
    termId: string | null,
    schoolId: string,
  ) {
    const policies = await this.prisma.classGradingPolicy.findMany({
      where: {
        classId,
        schoolId,
        ...(subjectId ? { subjectId } : { subjectId: null }),
        ...(termId ? { termId } : { termId: null }),
      },
      include: { policy: true },
      orderBy: [
        { subjectId: 'desc' },
        { termId: 'desc' },
      ],
    });

    if (policies.length > 0) {
      return policies[0].policy;
    }

    return this.prisma.gradingPolicy.findFirst({
      where: {
        schoolId,
        isDefault: true,
        active: true,
      },
    });
  }

  async createPrimaryLowerPolicy(schoolId: string) {
    return this.createGradingPolicy(schoolId, {
      name: 'Primary Lower (Grades 1-4) - Competency Based',
      code: 'PRIMARY_LOWER',
      type: 'COMPETENCY',
      isDefault: false,
      scales: [
        { minScore: 80, maxScore: 100, grade: 'A', remark: 'Outstanding', points: 5, gpa: 4.0, sortOrder: 1 },
        { minScore: 65, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4, gpa: 3.5, sortOrder: 2 },
        { minScore: 50, maxScore: 64, grade: 'C', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
        { minScore: 35, maxScore: 49, grade: 'D', remark: 'Needs Improvement', points: 2, gpa: 2.0, sortOrder: 4 },
        { minScore: 0, maxScore: 34, grade: 'E', remark: 'Below Expectation', points: 1, gpa: 1.0, sortOrder: 5 },
      ],
    });
  }

  async createPrimaryUpperPolicy(schoolId: string) {
    return this.createGradingPolicy(schoolId, {
      name: 'Primary Upper (Grades 5-6) - Standard',
      code: 'PRIMARY_UPPER',
      type: 'PERCENTAGE',
      isDefault: false,
      scales: [
        { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5, gpa: 4.0, sortOrder: 1 },
        { minScore: 65, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4, gpa: 3.5, sortOrder: 2 },
        { minScore: 50, maxScore: 64, grade: 'C', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
        { minScore: 35, maxScore: 49, grade: 'D', remark: 'Pass', points: 2, gpa: 2.0, sortOrder: 4 },
        { minScore: 0, maxScore: 34, grade: 'F', remark: 'Fail', points: 1, gpa: 0, sortOrder: 5 },
      ],
    });
  }

  async createPrimaryDefaultPolicy(schoolId: string) {
    return this.createGradingPolicy(schoolId, {
      name: 'Primary School Default Grading',
      code: 'PRIMARY_DEFAULT',
      type: 'PERCENTAGE',
      isDefault: true,
      scales: [
        { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5, gpa: 4.0, sortOrder: 1 },
        { minScore: 65, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4, gpa: 3.5, sortOrder: 2 },
        { minScore: 50, maxScore: 64, grade: 'C', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
        { minScore: 35, maxScore: 49, grade: 'D', remark: 'Pass', points: 2, gpa: 2.0, sortOrder: 4 },
        { minScore: 0, maxScore: 34, grade: 'F', remark: 'Fail', points: 1, gpa: 0, sortOrder: 5 },
      ],
    });
  }

  async getSchoolInstitutionType(schoolId: string): Promise<string | null> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { institutionType: { select: { code: true } } },
    });
    return school?.institutionType?.code ?? null;
  }

  async createEczZambiaPolicy(schoolId: string) {
    return this.createGradingPolicy(schoolId, {
      name: 'ECZ Zambia Grading System',
      code: 'ECZ_ZM',
      type: 'ECZ_ZAMBIA',
      isDefault: true,
      scales: [
        { minScore: 75, maxScore: 100, grade: '1', remark: 'Distinction', points: 1, gpa: 4.0, sortOrder: 1 },
        { minScore: 70, maxScore: 74, grade: '2', remark: 'Distinction', points: 2, gpa: 3.75, sortOrder: 2 },
        { minScore: 65, maxScore: 69, grade: '3', remark: 'Merit', points: 3, gpa: 3.5, sortOrder: 3 },
        { minScore: 60, maxScore: 64, grade: '4', remark: 'Merit', points: 4, gpa: 3.25, sortOrder: 4 },
        { minScore: 55, maxScore: 59, grade: '5', remark: 'Credit', points: 5, gpa: 3.0, sortOrder: 5 },
        { minScore: 50, maxScore: 54, grade: '6', remark: 'Credit', points: 6, gpa: 2.75, sortOrder: 6 },
        { minScore: 45, maxScore: 49, grade: '7', remark: 'Satisfactory', points: 7, gpa: 2.5, sortOrder: 7 },
        { minScore: 40, maxScore: 44, grade: '8', remark: 'Satisfactory', points: 8, gpa: 2.0, sortOrder: 8 },
        { minScore: 0, maxScore: 39, grade: '9', remark: 'Unsatisfactory', points: 9, gpa: 0, sortOrder: 9 },
      ],
    });
  }

  async createEczCompetencyPolicy(schoolId: string) {
    return this.createGradingPolicy(schoolId, {
      name: 'ECZ Competency Based (Forms 1-4)',
      code: 'ECZ_COMPETENCY',
      type: 'COMPETENCY',
      isDefault: false,
      scales: [
        { minScore: 70, maxScore: 100, grade: '1', remark: 'Outstanding', points: 1, gpa: 4.0, sortOrder: 1 },
        { minScore: 60, maxScore: 69, grade: '2', remark: 'Advanced', points: 2, gpa: 3.5, sortOrder: 2 },
        { minScore: 50, maxScore: 59, grade: '3', remark: 'Basic', points: 3, gpa: 3.0, sortOrder: 3 },
        { minScore: 40, maxScore: 49, grade: '4', remark: 'Satisfactory', points: 4, gpa: 2.0, sortOrder: 4 },
        { minScore: 0, maxScore: 39, grade: '5', remark: 'Unsatisfactory', points: 5, gpa: 0, sortOrder: 5 },
      ],
    });
  }

  async createGpaPolicy(schoolId: string) {
    return this.createGradingPolicy(schoolId, {
      name: 'GPA Grading System',
      code: 'GPA_4.0',
      type: 'GPA',
      isDefault: false,
      scales: [
        { minScore: 90, maxScore: 100, grade: 'A', remark: 'Excellent', points: 4, gpa: 4.0, sortOrder: 1 },
        { minScore: 80, maxScore: 89, grade: 'B+', remark: 'Very Good', points: 3.5, gpa: 3.5, sortOrder: 2 },
        { minScore: 70, maxScore: 79, grade: 'B', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
        { minScore: 60, maxScore: 69, grade: 'C+', remark: 'Above Average', points: 2.5, gpa: 2.5, sortOrder: 4 },
        { minScore: 50, maxScore: 59, grade: 'C', remark: 'Average', points: 2, gpa: 2.0, sortOrder: 5 },
        { minScore: 40, maxScore: 49, grade: 'D', remark: 'Below Average', points: 1, gpa: 1.0, sortOrder: 6 },
        { minScore: 0, maxScore: 39, grade: 'F', remark: 'Fail', points: 0, gpa: 0, sortOrder: 7 },
      ],
    });
  }

  async createStandardPolicy(schoolId: string) {
    return this.createGradingPolicy(schoolId, {
      name: 'Standard Percentage System',
      code: 'STANDARD',
      type: 'PERCENTAGE',
      isDefault: false,
      scales: [
        { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5, sortOrder: 1 },
        { minScore: 70, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4, sortOrder: 2 },
        { minScore: 60, maxScore: 69, grade: 'C', remark: 'Good', points: 3, sortOrder: 3 },
        { minScore: 50, maxScore: 59, grade: 'D', remark: 'Satisfactory', points: 2, sortOrder: 4 },
        { minScore: 40, maxScore: 49, grade: 'E', remark: 'Pass', points: 1, sortOrder: 5 },
        { minScore: 0, maxScore: 39, grade: 'F', remark: 'Fail', points: 0, sortOrder: 6 },
      ],
    });
  }

  private institutionTypeCache = new Map<string, string | null>();

  private async getCachedInstitutionType(schoolId: string): Promise<string | null> {
    if (!this.institutionTypeCache.has(schoolId)) {
      const type = await this.getSchoolInstitutionType(schoolId);
      this.institutionTypeCache.set(schoolId, type);
    }
    return this.institutionTypeCache.get(schoolId);
  }

  async getDefaultGradeForSchool(percentage: number, schoolId: string): Promise<string> {
    const institutionType = await this.getCachedInstitutionType(schoolId);
    if (institutionType === 'PRIMARY_SCHOOL') {
      if (percentage >= 80) return 'A';
      if (percentage >= 65) return 'B';
      if (percentage >= 50) return 'C';
      if (percentage >= 35) return 'D';
      return 'E';
    }
    return this.getDefaultGrade(percentage);
  }

  async getDefaultRemarkForSchool(percentage: number, schoolId: string): Promise<string> {
    const institutionType = await this.getCachedInstitutionType(schoolId);
    if (institutionType === 'PRIMARY_SCHOOL') {
      if (percentage >= 80) return 'Excellent';
      if (percentage >= 65) return 'Very Good';
      if (percentage >= 50) return 'Good';
      if (percentage >= 35) return 'Pass';
      return 'Below Expectation';
    }
    return this.getDefaultRemark(percentage);
  }

  async getDefaultPointsForSchool(percentage: number, schoolId: string): Promise<number> {
    const institutionType = await this.getCachedInstitutionType(schoolId);
    if (institutionType === 'PRIMARY_SCHOOL') {
      if (percentage >= 80) return 5;
      if (percentage >= 65) return 4;
      if (percentage >= 50) return 3;
      if (percentage >= 35) return 2;
      return 1;
    }
    return this.getDefaultPoints(percentage);
  }

  private getDefaultGrade(percentage: number): string {
    if (percentage >= 75) return '1';
    if (percentage >= 70) return '2';
    if (percentage >= 65) return '3';
    if (percentage >= 60) return '4';
    if (percentage >= 55) return '5';
    if (percentage >= 50) return '6';
    if (percentage >= 45) return '7';
    if (percentage >= 40) return '8';
    return '9';
  }

  private getDefaultRemark(percentage: number): string {
    if (percentage >= 75) return 'Distinction';
    if (percentage >= 70) return 'Distinction';
    if (percentage >= 65) return 'Merit';
    if (percentage >= 60) return 'Merit';
    if (percentage >= 55) return 'Credit';
    if (percentage >= 50) return 'Credit';
    if (percentage >= 45) return 'Satisfactory';
    if (percentage >= 40) return 'Satisfactory';
    return 'Unsatisfactory';
  }

  private getDefaultPoints(percentage: number): number {
    if (percentage >= 75) return 1;
    if (percentage >= 70) return 2;
    if (percentage >= 65) return 3;
    if (percentage >= 60) return 4;
    if (percentage >= 55) return 5;
    if (percentage >= 50) return 6;
    if (percentage >= 45) return 7;
    if (percentage >= 40) return 8;
    return 9;
  }
}
