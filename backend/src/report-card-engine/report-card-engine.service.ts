import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompositeSubjectService } from '../composite-subject/composite-subject.service';

@Injectable()
export class ReportCardEngineService {
  private readonly logger = new Logger(ReportCardEngineService.name);

  constructor(
    private prisma: PrismaService,
    private compositeSubjectService: CompositeSubjectService,
  ) {}

  async generateReportCardData(
    studentId: string,
    termId: string,
    schoolId: string,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            class: {
              include: {
                levelType: true,
              },
            },
            academicYear: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const enrollment = student.enrollments.find(e => true);
    if (!enrollment) {
      throw new NotFoundException('No active enrollment found');
    }

    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        studentId,
        termId,
        classId: enrollment.classId,
        status: { in: ['COMPUTED', 'VERIFIED', 'LOCKED'] },
      },
      include: {
        subject: true,
      },
      orderBy: [
        { subject: { name: 'asc' } },
      ],
    });

    const assessmentResults = await this.prisma.studentAssessmentResult.findMany({
      where: {
        studentId,
        termId,
        classId: enrollment.classId,
        status: { not: 'DRAFT' },
      },
      include: {
        assessmentDef: true,
        subject: true,
      },
      orderBy: [
        { subject: { name: 'asc' } },
        { assessmentDef: { sortOrder: 'asc' } },
      ],
    });

    const subjectBreakdown = computedResults.map(result => {
      const assessments = assessmentResults
        .filter(a => a.subjectId === result.subjectId)
        .map(a => ({
          name: a.assessmentDef.name,
          code: a.assessmentDef.code,
          rawScore: a.rawScore,
          maxScore: a.maxScore,
          percentage: a.percentage,
          grade: a.grade,
        }));

      return {
        subjectId: result.subjectId,
        subjectName: result.subject.name,
        subjectCode: result.subject.code,
        totalRawScore: result.totalRawScore,
        totalWeightedScore: result.totalWeightedScore,
        finalPercentage: result.finalPercentage,
        finalGrade: result.finalGrade,
        finalRemark: result.finalRemark,
        points: result.points,
        gpa: result.gpa,
        classRank: result.classRank,
        subjectRank: result.subjectRank,
        assessments,
      };
    });

    // Apply composite subject transformations
    const processedBreakdown = await this.applyCompositeTransform(
      subjectBreakdown, studentId, termId, classId, schoolId,
    );

    const termSummary = await this.prisma.termSummary.findFirst({
      where: { studentId, termId },
    });

    const attendance = await this.prisma.attendance.findMany({
      where: {
        studentId,
        date: {
          gte: term.startDate,
          lte: term.endDate,
        },
      },
    });

    const attendanceRate = attendance.length > 0
      ? (attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length / attendance.length) * 100
      : null;

    // Load curriculum rules for best-subject selection
    const schoolCurriculum = await this.prisma.schoolCurriculum.findFirst({
      where: { schoolId },
      include: {
        curriculumVersion: {
          include: {
            bestSubjectRules: true,
          },
        },
      },
    });

    const bestSubjectRule = schoolCurriculum?.curriculumVersion?.bestSubjectRules?.[0] ?? null;

    const mustIncludeIds = new Set((bestSubjectRule?.mustIncludeSubjectIds as string[]) ?? []);
    const excludeIds = new Set((bestSubjectRule?.excludeSubjectIds as string[]) ?? []);
    const priorityGroupIds = (bestSubjectRule?.priorityGroupIds as string[]) ?? [];
    const bestCount = bestSubjectRule?.count ?? 6;

    // Load performance categories for this curriculum
    const performanceCategories = await this.prisma.performanceCategory.findMany({
      where: {
        curriculumVersionId: schoolCurriculum?.curriculumVersionId ?? undefined,
      },
      orderBy: { minScore: 'desc' },
    });

    // Enrich subject breakdown with performance category
    const enrichedBreakdown = processedBreakdown.map(s => {
      const cat = performanceCategories.find(
        c => (c.minScore ?? 0) <= (s.finalPercentage ?? 0) && (!c.maxScore || c.maxScore >= (s.finalPercentage ?? 0)),
      ) ?? performanceCategories.find(c => !c.minScore && !c.maxScore);
      return { ...s, performanceCategory: cat ? { label: cat.label, color: cat.color } : null };
    });

    const getPerformanceCategory = (percentage: number | null) => {
      if (percentage == null) return null;
      const cat = performanceCategories.find(
        c => (c.minScore ?? 0) <= percentage && (!c.maxScore || c.maxScore >= percentage),
      );
      return cat ? { label: cat.label, color: cat.color } : null;
    };

    // Curriculum-aware best subjects:
    // 1. Must include mustIncludeSubjects (English, Math)
    // 2. Exclude excludeSubjects (SP1, SP2)
    // 3. Prefer subjects from priority groups
    // 4. Select up to bestCount
    let pool = [...enrichedBreakdown].filter(s => s.points !== null && !excludeIds.has(s.subjectId));

    const compulsory: typeof enrichedBreakdown = [];
    const remaining: typeof enrichedBreakdown = [];

    for (const s of pool) {
      if (mustIncludeIds.has(s.subjectId)) {
        compulsory.push(s);
      } else {
        remaining.push(s);
      }
    }

    // Sort remaining by points ascending (lower = better), then by priority group
    remaining.sort((a, b) => {
      const aPrio = priorityGroupIds.length > 0 && a.subjectId ? 0 : 1;
      const bPrio = priorityGroupIds.length > 0 && b.subjectId ? 0 : 1;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return (a.points ?? 99) - (b.points ?? 99);
    });

    const bestSubjects = [...compulsory, ...remaining].slice(0, bestCount);

    const totalPoints = bestSubjects.reduce((sum, s) => sum + (s.points ?? 0), 0);

    // Load division rules for classification
    const divisionRules = await this.prisma.divisionRule.findMany({
      where: {
        curriculumVersionId: schoolCurriculum?.curriculumVersionId ?? undefined,
        examStructureId: null,
      },
      orderBy: { maxScore: 'desc' },
    });

    const overallPct = termSummary?.overallPercentage ?? null;
    const division = overallPct != null
      ? divisionRules.find(r => r.minScore <= overallPct && r.maxScore >= overallPct) ?? null
      : null;

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        photoUrl: student.photoUrl,
      },
      class: {
        id: enrollment.classId,
        name: enrollment.class.name,
        level: enrollment.class.levelType?.name,
      },
      academicYear: {
        id: enrollment.academicYearId,
        name: enrollment.academicYear.name,
      },
      term: {
        id: termId,
        name: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
      },
      subjectBreakdown: enrichedBreakdown,
      bestSubjects,
      totalPoints,
      bestSubjectsAverage: bestSubjects.length > 0
        ? parseFloat((bestSubjects.reduce((sum, s) => sum + (s.finalPercentage ?? 0), 0) / bestSubjects.length).toFixed(2))
        : null,
      division: division ? {
        code: division.code,
        division: division.division,
        label: division.label,
        color: division.color,
      } : null,
      performanceCategory: getPerformanceCategory(overallPct),
      termSummary: termSummary ? {
        overallPercentage: termSummary.overallPercentage,
        overallGrade: termSummary.overallGrade,
        overallRemark: termSummary.overallRemark,
        gpa: termSummary.gpa,
        totalPoints: termSummary.totalPoints,
        classRank: termSummary.classRank,
        classSize: termSummary.classSize,
        percentile: termSummary.percentile,
        strengths: termSummary.strengths,
        weaknesses: termSummary.weaknesses,
        teacherRemarks: termSummary.teacherRemarks,
        aiInsights: termSummary.aiInsights,
      } : null,
      attendance: {
        totalDays: attendance.length,
        presentDays: attendance.filter(a => a.status === 'PRESENT').length,
        absentDays: attendance.filter(a => a.status === 'ABSENT').length,
        lateDays: attendance.filter(a => a.status === 'LATE').length,
        attendanceRate: attendanceRate ? parseFloat(attendanceRate.toFixed(2)) : null,
      },
      curriculum: {
        version: schoolCurriculum?.curriculumVersion?.name ?? null,
        bestSubjectRule: bestSubjectRule ? { name: bestSubjectRule.name, count: bestSubjectRule.count } : null,
      },
      generatedAt: new Date(),
    };
  }

  async generateBulkReportCards(
    classId: string,
    termId: string,
    schoolId: string,
  ) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const reportCards = [];

    for (const enrollment of enrollments) {
      try {
        const data = await this.generateReportCardData(
          enrollment.studentId,
          termId,
          schoolId,
        );
        reportCards.push(data);
      } catch (error) {
        this.logger.error(`Failed to generate report card for student ${enrollment.studentId}: ${error.message}`);
      }
    }

    this.logger.log(`Generated ${reportCards.length} report cards for class ${classId}, term ${termId}`);

    return reportCards;
  }

  async getRemarkTemplates(schoolId: string, type?: string) {
    return this.prisma.remark.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(type ? { type: type as any } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createRemark(schoolId: string, data: {
    type: string;
    text: string;
    gradeRange?: string;
    subjectId?: string;
    sortOrder?: number;
  }) {
    return this.prisma.remark.create({
      data: {
        schoolId,
        type: data.type as any,
        text: data.text,
        gradeRange: data.gradeRange,
        subjectId: data.subjectId,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async getReportCardStatus(classId: string, termId: string, schoolId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const termSummaries = await this.prisma.termSummary.findMany({
      where: {
        classId,
        termId,
        studentId: { in: enrollments.map(e => e.studentId) },
      },
    });

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        studentId: { in: enrollments.map(e => e.studentId) },
      },
    });

    const totalStudents = enrollments.length;
    const studentsWithSummary = new Set(termSummaries.map(t => t.studentId)).size;
    const studentsWithResults = new Set(computedResults.map(c => c.studentId)).size;

    return {
      classId,
      termId,
      totalStudents,
      studentsWithResults,
      studentsWithSummary,
      completionRate: totalStudents > 0 ? (studentsWithSummary / totalStudents) * 100 : 0,
      readyForPublication: studentsWithSummary === totalStudents,
    };
  }

  private async applyCompositeTransform(
    breakdown: any[],
    studentId: string,
    termId: string,
    classId: string,
    schoolId: string,
  ) {
    const composites = await this.compositeSubjectService.getCompositeResultsForStudent(
      studentId, termId, classId, schoolId,
    );
    if (composites.length === 0) return breakdown;

    const componentSubjectIds = new Set<string>();
    for (const comp of composites) {
      for (const c of comp.components) {
        componentSubjectIds.add(c.subjectId);
      }
    }

    const filtered = breakdown.filter(s => !componentSubjectIds.has(s.subjectId));

    for (const comp of composites) {
      filtered.push({
        subjectId: comp.composite.id,
        subjectName: comp.composite.name,
        subjectCode: comp.composite.code,
        totalRawScore: comp.finalPercentage,
        totalWeightedScore: null,
        finalPercentage: comp.finalPercentage,
        finalGrade: comp.finalGrade,
        finalRemark: null,
        points: null,
        gpa: null,
        classRank: null,
        subjectRank: null,
        assessments: [],
        isComposite: true,
        components: comp.components,
      });
    }

    return filtered;
  }
}
