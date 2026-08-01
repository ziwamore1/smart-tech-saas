import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompositeSubjectService } from '../composite-subject/composite-subject.service';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
import { StudentSubjectService } from '../student-subject/student-subject.service';

@Injectable()
export class ReportCardEngineService {
  private readonly logger = new Logger(ReportCardEngineService.name);

  constructor(
    private prisma: PrismaService,
    private compositeSubjectService: CompositeSubjectService,
    private gradingEngine: GradingEngineService,
    private studentSubjectService: StudentSubjectService,
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
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        student: { status: 'ACTIVE' },
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

    // Filter by student's assigned subjects
    const validSubjectIds = await this.studentSubjectService.getClassSubjectsForStudent(studentId, enrollment.classId);
    const filteredComputedResults = computedResults.filter(r => validSubjectIds.includes(r.subjectId));
    const filteredAssessmentResults = assessmentResults.filter(r => validSubjectIds.includes(r.subjectId));

    // Fallback: read from Result table for subjects where ComputedResult has NULL scores
    const legacyResults = await this.prisma.result.findMany({
      where: {
        studentId,
        termId,
        schoolId,
        student: { status: 'ACTIVE' },
      },
      include: { subject: true },
    });
    const legacyResultMap = new Map<string, typeof legacyResults[0]>();
    for (const r of legacyResults) {
      legacyResultMap.set(r.subjectId, r);
    }

    const subjectBreakdown: any[] = [];
    for (const result of filteredComputedResults) {
      const assessments = filteredAssessmentResults
        .filter(a => a.subjectId === result.subjectId)
        .map(a => ({
          name: a.assessmentDef.name,
          code: a.assessmentDef.code,
          rawScore: a.rawScore,
          maxScore: a.maxScore,
          percentage: a.percentage,
          grade: a.grade,
        }));

      // If ComputedResult has NULL scores, fall back to Result table
      let totalRawScore = result.totalRawScore;
      let finalPercentage = result.finalPercentage;
      let finalGrade = result.finalGrade;
      let finalRemark = result.finalRemark;
      let points = result.points;
      let gpa = result.gpa;

      if (finalPercentage == null) {
        const legacy = legacyResultMap.get(result.subjectId);
        if (legacy && legacy.score != null) {
          totalRawScore = legacy.score;
          finalPercentage = legacy.score;
          finalGrade = legacy.grade ?? null;
          finalRemark = legacy.remark ?? null;
        }
      }

      // Compute points from grading engine if not available
      if (points == null && finalPercentage != null) {
        try {
          const gradeResult = await this.gradingEngine.computeGradeFull(
            finalPercentage, enrollment.classId, result.subjectId, termId, schoolId,
          );
          points = gradeResult.points ?? null;
          gpa = gradeResult.gpa ?? null;
          if (!finalGrade && gradeResult.grade) finalGrade = gradeResult.grade;
          if (!finalRemark && gradeResult.remark) finalRemark = gradeResult.remark;
        } catch {
          // Grading engine failed, use inline fallback
          if (finalPercentage >= 75) { points = 1; finalGrade = finalGrade ?? 'A'; }
          else if (finalPercentage >= 65) { points = 2; finalGrade = finalGrade ?? 'B'; }
          else if (finalPercentage >= 50) { points = 3; finalGrade = finalGrade ?? 'C'; }
          else if (finalPercentage >= 40) { points = 4; finalGrade = finalGrade ?? 'D'; }
          else { points = 5; finalGrade = finalGrade ?? 'E'; }
        }
      }

      subjectBreakdown.push({
        subjectId: result.subjectId,
        subjectName: result.subject.name,
        subjectCode: result.subject.code,
        totalRawScore,
        totalWeightedScore: result.totalWeightedScore,
        finalPercentage,
        finalGrade,
        finalRemark,
        points,
        gpa,
        classRank: result.classRank,
        subjectRank: result.subjectRank,
        assessments,
      });
    }

    // Fallback: include subjects present only in the Result table (e.g. Excel-imported results)
    const coveredSubjectIds = new Set(subjectBreakdown.map((s) => s.subjectId));
    for (const legacy of legacyResults) {
      if (legacy.score == null || coveredSubjectIds.has(legacy.subjectId)) continue;

      let legacyGrade = legacy.grade ?? null;
      let legacyRemark = legacy.remark ?? null;
      let legacyPoints: number | null = null;
      let legacyGpa: number | null = null;

      try {
        const gradeResult = await this.gradingEngine.computeGradeFull(
          legacy.score, enrollment.classId, legacy.subjectId, termId, schoolId,
        );
        legacyPoints = gradeResult.points ?? null;
        legacyGpa = gradeResult.gpa ?? null;
        if (!legacyGrade && gradeResult.grade) legacyGrade = gradeResult.grade;
        if (!legacyRemark && gradeResult.remark) legacyRemark = gradeResult.remark;
      } catch {
        if (legacy.score >= 75) { legacyPoints = 1; legacyGrade = legacyGrade ?? 'A'; }
        else if (legacy.score >= 65) { legacyPoints = 2; legacyGrade = legacyGrade ?? 'B'; }
        else if (legacy.score >= 50) { legacyPoints = 3; legacyGrade = legacyGrade ?? 'C'; }
        else if (legacy.score >= 40) { legacyPoints = 4; legacyGrade = legacyGrade ?? 'D'; }
        else { legacyPoints = 5; legacyGrade = legacyGrade ?? 'E'; }
      }

      subjectBreakdown.push({
        subjectId: legacy.subjectId,
        subjectName: legacy.subject.name,
        subjectCode: legacy.subject.code,
        totalRawScore: legacy.score,
        totalWeightedScore: legacy.score,
        finalPercentage: legacy.score,
        finalGrade: legacyGrade,
        finalRemark: legacyRemark,
        points: legacyPoints,
        gpa: legacyGpa,
        classRank: null,
        subjectRank: null,
        assessments: [],
      });
    }

    // Apply composite subject transformations
    const processedBreakdown = await this.applyCompositeTransform(
      subjectBreakdown, studentId, termId, enrollment.classId, schoolId,
    );

    // --- Compute class rank on-the-fly from all students' average percentages ---
    const allStudentResults = await this.prisma.computedResult.findMany({
      where: { termId, classId: enrollment.classId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, student: { status: 'ACTIVE' } },
      select: { studentId: true, finalPercentage: true },
    });
    // Also get Result table fallback for students with NULL finalPercentage
    const allLegacyResults = await this.prisma.result.findMany({
      where: { termId, schoolId, student: { status: 'ACTIVE' } },
      select: { studentId: true, score: true },
    });
    const allLegacyMap = new Map<string, number[]>();
    for (const lr of allLegacyResults) {
      if (lr.score != null) {
        const arr = allLegacyMap.get(lr.studentId) ?? [];
        arr.push(lr.score);
        allLegacyMap.set(lr.studentId, arr);
      }
    }

    // Compute per-student average across all subjects
    const studentAvgMap = new Map<string, { total: number; count: number }>();
    for (const sr of allStudentResults) {
      const key = sr.studentId;
      const existing = studentAvgMap.get(key) ?? { total: 0, count: 0 };
      if (sr.finalPercentage != null) {
        existing.total += sr.finalPercentage;
        existing.count += 1;
      }
      studentAvgMap.set(key, existing);
    }
    // Fill in NULL scores from legacy for students missing data
    for (const [sid, scores] of allLegacyMap.entries()) {
      const existing = studentAvgMap.get(sid) ?? { total: 0, count: 0 };
      if (existing.count === 0 && scores.length > 0) {
        existing.total = scores.reduce((a, b) => a + b, 0);
        existing.count = scores.length;
        studentAvgMap.set(sid, existing);
      }
    }

    const rankedStudents = Array.from(studentAvgMap.entries())
      .map(([sid, data]) => ({
        studentId: sid,
        average: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => b.average - a.average);

    let computedClassRank: number | null = null;
    let computedClassSize = rankedStudents.length;
    let lastRankAvg: number | null = null;
    let lastRank = 0;
    for (let i = 0; i < rankedStudents.length; i++) {
      const s = rankedStudents[i];
      if (lastRankAvg === null || Math.abs(s.average - lastRankAvg) > 0.001) {
        lastRank = i + 1;
        lastRankAvg = s.average;
      }
      if (s.studentId === studentId) {
        computedClassRank = lastRank;
        break;
      }
    }
    // Percentile (1-100)
    const computedPercentile = computedClassRank != null && computedClassSize > 0
      ? Math.round(((computedClassSize - computedClassRank) / computedClassSize) * 100)
      : null;

    // Read TermSummary if available (may have additional data)
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

    // Load performance categories for this curriculum (fallback: all categories for school, then built-in defaults)
    let performanceCategories = await this.prisma.performanceCategory.findMany({
      where: {
        curriculumVersionId: schoolCurriculum?.curriculumVersionId ?? undefined,
      },
      orderBy: { minScore: 'desc' },
    });
    if (performanceCategories.length === 0) {
      performanceCategories = await this.prisma.performanceCategory.findMany({
        where: { schoolId },
        orderBy: { minScore: 'desc' },
      });
    }
    // Built-in default categories when DB has none
    const defaultCategories = [
      { minScore: 80, maxScore: 100, label: 'Excellent', color: '#10b981' },
      { minScore: 70, maxScore: 79.99, label: 'Very Good', color: '#22c55e' },
      { minScore: 60, maxScore: 69.99, label: 'Good', color: '#3b82f6' },
      { minScore: 50, maxScore: 59.99, label: 'Average', color: '#f59e0b' },
      { minScore: 40, maxScore: 49.99, label: 'Below Average', color: '#f97316' },
      { minScore: 0, maxScore: 39.99, label: 'Poor', color: '#ef4444' },
    ];
    const effectiveCategories = performanceCategories.length > 0
      ? performanceCategories
      : defaultCategories;

    // Enrich subject breakdown with performance category
    const enrichedBreakdown = processedBreakdown.map(s => {
      const pct = s.finalPercentage ?? 0;
      const cat = effectiveCategories.find(
        c => pct >= (c.minScore ?? 0) && (c.maxScore == null || pct <= c.maxScore),
      ) ?? effectiveCategories.find(c => c.minScore == null && c.maxScore == null);
      return { ...s, performanceCategory: cat ? { label: cat.label, color: cat.color } : null };
    });

    // --- Real strengths/weaknesses from subject breakdown ---
    const sortedSubjects = [...enrichedBreakdown]
      .filter(s => s.finalPercentage != null)
      .sort((a, b) => (b.finalPercentage ?? 0) - (a.finalPercentage ?? 0));
    const topSubjects = sortedSubjects.slice(0, 3);
    const bottomSubjects = sortedSubjects.slice(-3).reverse();

    // --- Overall average from subject breakdown ---
    const subjectsWithScores = enrichedBreakdown.filter(s => s.finalPercentage != null);
    const computedOverallPct = subjectsWithScores.length > 0
      ? parseFloat((subjectsWithScores.reduce((sum, s) => sum + (s.finalPercentage ?? 0), 0) / subjectsWithScores.length).toFixed(2))
      : null;

    const overallPct = termSummary?.overallPercentage ?? computedOverallPct;

    // --- Compute real parent analytics ---
    const strengths = topSubjects.map(s => `${s.subjectName} (${s.finalPercentage}% - ${s.finalGrade ?? 'N/A'})`);
    const weaknesses = bottomSubjects.map(s => `${s.subjectName} (${s.finalPercentage}% - ${s.finalGrade ?? 'N/A'})`);

    // Generate real insights based on actual performance
    const passedCount = subjectsWithScores.filter(s => (s.finalPercentage ?? 0) >= 50).length;
    const failedCount = subjectsWithScores.length - passedCount;
    const highestSubject = topSubjects[0];
    const lowestSubject = bottomSubjects[0];
    const avgScore = overallPct ?? 0;

    const insightsList: string[] = [];
    if (highestSubject) {
      insightsList.push(`${student.firstName} performed best in ${highestSubject.subjectName} with ${highestSubject.finalPercentage}% (${highestSubject.finalGrade}).`);
    }
    if (lowestSubject && lowestSubject.subjectId !== highestSubject?.subjectId) {
      insightsList.push(`${lowestSubject.subjectName} is the weakest area at ${lowestSubject.finalPercentage}% (${lowestSubject.finalGrade}). Focus should be placed on improving this subject.`);
    }
    if (failedCount > 0) {
      insightsList.push(`${failedCount} of ${subjectsWithScores.length} subject(s) scored below 50%. Additional attention is needed in ${bottomSubjects.map(s => s.subjectName).join(', ')}.`);
    }
    if (avgScore >= 75) {
      insightsList.push(`Overall performance is excellent with an average of ${avgScore}%. Continue the good work.`);
    } else if (avgScore >= 60) {
      insightsList.push(`Overall performance is good with an average of ${avgScore}%. With more effort, results can improve further.`);
    } else if (avgScore >= 50) {
      insightsList.push(`Overall average is ${avgScore}%. More study time and focused preparation are recommended.`);
    } else {
      insightsList.push(`Overall average is ${avgScore}%. Serious academic improvement is needed across multiple subjects.`);
    }

    const computedStrengths = termSummary?.strengths ?? (strengths.length > 0 ? strengths : null);
    const computedWeaknesses = termSummary?.weaknesses ?? (weaknesses.length > 0 ? weaknesses : null);
    const computedInsights = termSummary?.aiInsights ?? (insightsList.length > 0 ? insightsList : null);

    const getPerformanceCategory = (percentage: number | null) => {
      if (percentage == null) return null;
      const cat = effectiveCategories.find(
        c => percentage >= (c.minScore ?? 0) && (c.maxScore == null || percentage <= c.maxScore),
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
      termSummary: {
        overallPercentage: termSummary?.overallPercentage ?? computedOverallPct,
        overallGrade: termSummary?.overallGrade ?? null,
        overallRemark: termSummary?.overallRemark ?? null,
        gpa: termSummary?.gpa ?? null,
        totalPoints: termSummary?.totalPoints ?? totalPoints,
        classRank: termSummary?.classRank ?? computedClassRank,
        classSize: termSummary?.classSize ?? computedClassSize,
        percentile: termSummary?.percentile ?? computedPercentile,
        strengths: computedStrengths,
        weaknesses: computedWeaknesses,
        teacherRemarks: termSummary?.teacherRemarks ?? null,
        aiInsights: computedInsights,
      },
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
      where: { classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
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
      where: { classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
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
        student: { status: 'ACTIVE' },
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

  /**
   * Get mid-term / previous term comparison data for a student
   */
  async getMidTermComparison(studentId: string, currentTermId: string, schoolId: string) {
    const currentTerm = await this.prisma.term.findUnique({
      where: { id: currentTermId },
      include: { academicYear: true },
    });
    if (!currentTerm) return null;

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: { where: { status: 'ACTIVE' }, include: { class: true } },
      },
    });
    if (!student) return null;

    const enrollment = student.enrollments[0];
    if (!enrollment) return null;

    // Find the previous term in the same academic year or the last term of the previous year
    const allTerms = await this.prisma.term.findMany({
      where: { academicYearId: currentTerm.academicYearId },
      orderBy: { startDate: 'asc' },
    });

    const currentIdx = allTerms.findIndex(t => t.id === currentTermId);
    if (currentIdx <= 0) return null; // No previous term

    const previousTerm = allTerms[currentIdx - 1];
    if (!previousTerm) return null;

    // Get previous term's term summary
    const prevSummary = await this.prisma.termSummary.findFirst({
      where: { studentId, termId: previousTerm.id },
    });
    if (!prevSummary) return null;

    // Get current term's term summary
    const currSummary = await this.prisma.termSummary.findFirst({
      where: { studentId, termId: currentTermId },
    });

    // Get subject-level comparison
    const prevResults = await this.prisma.computedResult.findMany({
      where: { studentId, termId: previousTerm.id, classId: enrollment.classId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, student: { status: 'ACTIVE' } },
      include: { subject: true },
    });

    const currResults = await this.prisma.computedResult.findMany({
      where: { studentId, termId: currentTermId, classId: enrollment.classId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, student: { status: 'ACTIVE' } },
      include: { subject: true },
    });

    const subjectComparisons = currResults.map(curr => {
      const prev = prevResults.find(p => p.subjectId === curr.subjectId);
      return {
        subjectName: curr.subject.name,
        previousPercentage: prev?.finalPercentage ?? null,
        currentPercentage: curr.finalPercentage ?? null,
      };
    }).filter(sc => sc.previousPercentage !== null || sc.currentPercentage !== null);

    // Previous term attendance
    const prevAttendance = await this.prisma.attendance.findMany({
      where: {
        studentId,
        date: { gte: previousTerm.startDate, lte: previousTerm.endDate },
      },
    });
    const prevAttendanceRate = prevAttendance.length > 0
      ? (prevAttendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length / prevAttendance.length) * 100
      : null;

    return {
      termName: previousTerm.name,
      overallPercentage: prevSummary.overallPercentage,
      overallGrade: prevSummary.overallGrade,
      classRank: prevSummary.classRank,
      classSize: prevSummary.classSize,
      attendanceRate: prevAttendanceRate ? parseFloat(prevAttendanceRate.toFixed(2)) : null,
      subjectComparisons,
    };
  }

  /**
   * Get class average comparison data for a student (student score vs class average per subject)
   */
  async getClassComparison(studentId: string, termId: string, classId: string) {
    const studentResults = await this.prisma.computedResult.findMany({
      where: { studentId, termId, classId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, student: { status: 'ACTIVE' } },
      include: { subject: true },
    });

    const classResults = await this.prisma.computedResult.findMany({
      where: { termId, classId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, student: { status: 'ACTIVE' } },
      include: { subject: true },
    });

    // Fallback: load Result table for students with NULL finalPercentage
    const allStudentIds = [...new Set(classResults.map(r => r.studentId))];
    const legacyResults = await this.prisma.result.findMany({
      where: { termId, studentId: { in: allStudentIds }, student: { status: 'ACTIVE' } },
      select: { studentId: true, subjectId: true, score: true },
    });
    const legacyScoreMap = new Map<string, number>();
    for (const lr of legacyResults) {
      if (lr.score != null) {
        legacyScoreMap.set(`${lr.studentId}_${lr.subjectId}`, lr.score);
      }
    }

    const getScore = (r: { studentId: string; subjectId: string; finalPercentage: number | null }) => {
      if (r.finalPercentage != null) return r.finalPercentage;
      return legacyScoreMap.get(`${r.studentId}_${r.subjectId}`) ?? 0;
    };

    const comparison = studentResults.map(sr => {
      const subjectResults = classResults.filter(cr => cr.subjectId === sr.subjectId);
      const scores = subjectResults.map(r => getScore(r));
      const classAvg = scores.length > 0
        ? parseFloat((scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(1))
        : 0;

      return {
        subjectName: sr.subject.name,
        studentScore: getScore(sr),
        classAverage: classAvg,
      };
    });

    return comparison;
  }

  /**
   * Get class-level statistics for charts
   */
  async getClassStatistics(termId: string, classId: string, schoolId?: string) {
    const results = await this.prisma.computedResult.findMany({
      where: { termId, classId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, student: { status: 'ACTIVE' } },
    });

    if (results.length === 0) return null;

    const percentages = results.map(r => r.finalPercentage ?? 0).filter(p => p > 0);
    const classAverage = percentages.length > 0
      ? parseFloat((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1))
      : null;
    const highestScore = percentages.length > 0 ? Math.max(...percentages) : null;
    const lowestScore = percentages.length > 0 ? Math.min(...percentages) : null;

    // Resolve the class's grading system
    let gradingSystem: any = null;
    if (classId) {
      const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { gradingSystemId: true } });
      if (cls?.gradingSystemId) {
        gradingSystem = await this.prisma.gradingSystem.findUnique({ where: { id: cls.gradingSystemId }, include: { gradeScales: true } });
      }
    }
    if (!gradingSystem && schoolId) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId, isDefault: true },
        include: { gradeScales: true },
      });
    }
    if (!gradingSystem && schoolId) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId },
        include: { gradeScales: true },
      });
    }

    const scales = gradingSystem?.gradeScales ?? [];

    // Grade distribution for pie chart — use the actual grading system scales
    const gradeColors: Record<string, string> = {
      'A+': '#10b981', 'A': '#10b981', 'A-': '#22c55e',
      'B+': '#3b82f6', 'B': '#3b82f6', 'B-': '#60a5fa',
      'C+': '#f59e0b', 'C': '#f59e0b', 'C-': '#fbbf24',
      'D': '#f97316', 'D+': '#f97316',
      'E': '#ef4444', 'F': '#ef4444',
      'Distinction': '#10b981', 'Merit': '#3b82f6', 'Credit': '#f59e0b',
      'Pass': '#f97316', 'Fail': '#ef4444',
    };

    const grades: Record<string, { count: number; color: string }> = {};

    for (const r of results) {
      if (r.finalGrade) {
        const g = r.finalGrade;
        if (!grades[g]) grades[g] = { count: 0, color: gradeColors[g] || '#6b7280' };
        grades[g].count++;
      }
    }

    const totalGraded = Object.values(grades).reduce((sum, g) => sum + g.count, 0);
    let angleAccum = 0;
    const gradeDistribution = Object.entries(grades).map(([grade, data]) => {
      const pct = totalGraded > 0 ? Math.round((data.count / totalGraded) * 100) : 0;
      const startAngle = angleAccum;
      const sweepAngle = (data.count / Math.max(totalGraded, 1)) * 360;
      angleAccum += sweepAngle;
      return { grade, count: data.count, color: data.color, percentage: pct, startAngle: Math.round(startAngle), endAngle: Math.round(angleAccum) };
    });

    // Histogram: use grading system grade scales as buckets so bars align with graded results
    let buckets: { label: string; min: number; max: number; count: number; color: string; grade: string }[] = [];

    if (scales.length > 0) {
      // Sort scales descending by minScore so highest grade is first
      const sorted = [...scales].sort((a, b) => (b.minScore ?? 0) - (a.minScore ?? 0));
      buckets = sorted.map(s => ({
        label: s.maxScore != null ? `${s.grade} (${s.minScore ?? 0}-${s.maxScore})` : s.grade,
        min: s.minScore ?? 0,
        max: s.maxScore ?? 100,
        count: 0,
        color: gradeColors[s.grade] || s.color || '#6b7280',
        grade: s.grade,
      }));
    } else {
      // Fallback: standard ECZ secondary grading buckets
      buckets = [
        { label: 'A (80-100)', min: 80, max: 100, count: 0, color: '#10b981', grade: 'A' },
        { label: 'B (70-79)', min: 70, max: 79, count: 0, color: '#3b82f6', grade: 'B' },
        { label: 'C (60-69)', min: 60, max: 69, count: 0, color: '#f59e0b', grade: 'C' },
        { label: 'D (50-59)', min: 50, max: 59, count: 0, color: '#f97316', grade: 'D' },
        { label: 'E (40-49)', min: 40, max: 49, count: 0, color: '#fb923c', grade: 'E' },
        { label: 'F (0-39)', min: 0, max: 39, count: 0, color: '#ef4444', grade: 'F' },
      ];
    }

    for (const p of percentages) {
      const bucket = buckets.find(b => p >= b.min && p <= b.max);
      if (bucket) bucket.count++;
    }

    const maxCount = Math.max(...buckets.map(b => b.count), 1);
    const histogramData = buckets.map(b => ({
      label: b.label,
      grade: b.grade,
      count: b.count,
      color: b.color,
      barHeight: Math.max(2, Math.round((b.count / maxCount) * 55)),
    }));

    return {
      classAverage,
      highestScore,
      lowestScore,
      totalStudents: new Set(results.map(r => r.studentId)).size,
      totalResults: results.length,
      gradeDistribution,
      histogramData,
    };
  }

  /**
   * Get grading legend for the school
   */
  async getGradingLegend(schoolId: string, classId?: string) {
    let gradingSystem: any = null;

    if (classId) {
      const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { gradingSystemId: true } });
      if (cls?.gradingSystemId) {
        gradingSystem = await this.prisma.gradingSystem.findUnique({ where: { id: cls.gradingSystemId }, include: { gradeScales: true } });
      }
    }

    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId, isDefault: true },
        include: { gradeScales: true },
      });
    }

    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId },
        include: { gradeScales: true },
      });
    }

    if (!gradingSystem?.gradeScales?.length) {
      // Fallback: ECZ secondary grading
      return [
        { grade: 'A', range: '80-100', label: 'Distinction', color: '#10b981' },
        { grade: 'B', range: '70-79', label: 'Merit', color: '#3b82f6' },
        { grade: 'C', range: '60-69', label: 'Credit', color: '#f59e0b' },
        { grade: 'D', range: '50-59', label: 'Pass', color: '#f97316' },
        { grade: 'E', range: '40-49', label: 'Marginal Pass', color: '#fb923c' },
        { grade: 'F', range: '0-39', label: 'Fail', color: '#ef4444' },
      ];
    }

    const gradeColors: Record<string, string> = {
      'A+': '#10b981', 'A': '#10b981', 'A-': '#22c55e',
      'B+': '#3b82f6', 'B': '#3b82f6', 'B-': '#60a5fa',
      'C+': '#f59e0b', 'C': '#f59e0b', 'C-': '#fbbf24',
      'D': '#f97316', 'D+': '#f97316',
      'E': '#ef4444', 'F': '#ef4444',
    };

    return gradingSystem.gradeScales
      .sort((a: any, b: any) => (b.minScore ?? 0) - (a.minScore ?? 0))
      .map((scale: any) => ({
        grade: scale.grade,
        range: `${scale.minScore ?? 0}-${scale.maxScore ?? 100}`,
        label: scale.label || scale.grade,
        color: gradeColors[scale.grade] || '#6b7280',
      }));
  }
}
