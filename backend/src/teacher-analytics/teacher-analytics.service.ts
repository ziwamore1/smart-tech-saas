import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ComputedResultStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StudentSubjectService } from '../student-subject/student-subject.service';
import { TeacherAnalyticsStatisticsService, TREND_SENSITIVITY } from './teacher-analytics-statistics.service';
import {
  AssignmentAnalytics,
  AssignmentRef,
  CompetencyAnalysis,
  GenderAnalysis,
  HistoricalPoint,
  StudentRiskSummary,
  TeacherContext,
  TeacherReportData,
  TeacherSummary,
  TeachingLoad,
  Trend,
} from './teacher-analytics.types';

const COMPUTED_STATUSES: ComputedResultStatus[] = ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'];

type ComputedResultRow = {
  studentId: string;
  subjectId: string;
  finalPercentage: number | null;
  finalGrade: string | null;
  points: number | null;
  isAbsent: boolean;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string | null;
    gender: string | null;
    photoUrl: string | null;
    status: string;
  } | null;
};

/**
 * Teacher Analysis & Teaching Intelligence engine.
 *
 * The engine is scoped strictly to the authenticated teacher's OWN teaching
 * assignments for the current academic year / term. Every figure is derived
 * from the same authoritative ComputedResult + legacy Result pipeline used by
 * the Results, Report-Card and Administrator Analytics modules — this module
 * never re-calculates authoritative grades; it aggregates the authoritative
 * percentages that already exist.
 */
@Injectable()
export class TeacherAnalyticsService {
  private readonly logger = new Logger(TeacherAnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private stats: TeacherAnalyticsStatisticsService,
    private studentSubjectService: StudentSubjectService,
  ) {}

  // -------------------------------------------------------------------------
  // Context & academic cycle resolution
  // -------------------------------------------------------------------------

  private isAnalyticsLeader(reqUser: any): boolean {
    const roles = Array.isArray(reqUser.roles) ? reqUser.roles : [];
    return roles.some((role: string) =>
      ['DIRECTOR', 'HEAD TEACHER', 'HEADTEACHER', 'DEPUTY HEAD', 'DEPUTY HEAD TEACHER', 'DEPUTYHEADTEACHER', 'DEPUTY'].includes(String(role).toUpperCase()),
    );
  }

  private assertAnalyticsLeader(reqUser: any) {
    if (!this.isAnalyticsLeader(reqUser)) {
      throw new ForbiddenException('Only Directors, Head Teachers, and Deputy Head Teachers can view other teachers.');
    }
  }

  async resolveContext(reqUser: any, targetUserId = reqUser.id): Promise<TeacherContext> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId: targetUserId },
      include: {
        user: { select: { firstName: true, lastName: true, photoUrl: true } },
        departmentRel: { select: { name: true } },
      },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher profile not found for the current user');
    }
    if (targetUserId !== reqUser.id) {
      this.assertAnalyticsLeader(reqUser);
      if (reqUser.schoolId && teacher.schoolId !== reqUser.schoolId) {
        throw new ForbiddenException('You can only view teachers in your school.');
      }
    }
    const roles = Array.isArray(reqUser.roles) ? reqUser.roles : [];
    const isDirector = roles.some((r: string) =>
      ['DIRECTOR', 'HEAD TEACHER', 'DEPUTY', 'DEPUTY DIRECTOR', 'SUPERADMIN'].includes(
        String(r).toUpperCase(),
      ),
    );
    return {
      userId: targetUserId,
      schoolId: teacher.schoolId,
      teacherRecordId: teacher.id,
      teacherName: [teacher.user?.firstName, teacher.user?.lastName].filter(Boolean).join(' ').trim() || 'Teacher',
      teacherPhoto: teacher.user?.photoUrl || teacher.photoUrl || null,
      department: teacher.departmentRel?.name || teacher.department || null,
      roles,
      isDirector,
    };
  }

  async assertTeacherAccessible(reqUser: any, targetUserId: string, termId?: string) {
    this.assertAnalyticsLeader(reqUser);
    const context = await this.resolveContext(reqUser, targetUserId);
    const cycle = await this.resolveAcademicCycle(context.schoolId, termId);
    const assignments = cycle.year?.id
      ? await this.getAssignments(targetUserId, context.schoolId, cycle.year.id)
      : [];
    if (assignments.length === 0) {
      throw new ForbiddenException('The selected teacher has no teaching assignments for this academic year.');
    }
    return context;
  }

  async getAvailableTeachers(reqUser: any, termId?: string) {
    this.assertAnalyticsLeader(reqUser);
    if (!reqUser.schoolId) return [];
    const cycle = await this.resolveAcademicCycle(reqUser.schoolId, termId);
    if (!cycle.year?.id) return [];

    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { schoolId: reqUser.schoolId, academicYearId: cycle.year.id },
      select: { teacherId: true },
      distinct: ['teacherId'],
    });
    const teacherIds = assignments.map((assignment) => assignment.teacherId);
    if (teacherIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    const counts = await this.prisma.teachingAssignment.groupBy({
      by: ['teacherId'],
      where: { schoolId: reqUser.schoolId, academicYearId: cycle.year.id },
      _count: { _all: true },
    });
    const countByTeacher = new Map(counts.map((row) => [row.teacherId, row._count._all]));
    return users.map((user) => ({
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
      email: user.email,
      assignmentCount: countByTeacher.get(user.id) || 0,
    }));
  }

  async getOverviewForTeacher(reqUser: any, targetUserId: string, termId?: string) {
    await this.assertTeacherAccessible(reqUser, targetUserId, termId);
    return this.getOverview({ ...reqUser, id: targetUserId }, termId);
  }

  async resolveAcademicCycle(schoolId: string, termId?: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      orderBy: { startDate: 'desc' },
    });
    const fallbackYear =
      year ||
      (await this.prisma.academicYear.findFirst({
        where: { schoolId },
        orderBy: { startDate: 'desc' },
      }));

    let term = termId
      ? await this.prisma.term.findUnique({
          where: { id: termId },
          include: { academicYear: true },
        })
      : await this.prisma.term.findFirst({
          where: { academicYearId: fallbackYear?.id, isCurrent: true },
          include: { academicYear: true },
        });

    if (!term && fallbackYear) {
      term = await this.prisma.term.findFirst({
        where: { academicYearId: fallbackYear.id },
        orderBy: { startDate: 'desc' },
        include: { academicYear: true },
      });
    }
    if (!term) {
      term = await this.prisma.term.findFirst({
        where: { academicYear: { schoolId } },
        orderBy: { startDate: 'desc' },
        include: { academicYear: true },
      });
    }

    return { year: term?.academicYear || fallbackYear || year, term };
  }

  // -------------------------------------------------------------------------
  // Assignment resolution (authorization boundary)
  // -------------------------------------------------------------------------

  async getAssignments(userId: string, schoolId: string, academicYearId?: string): Promise<AssignmentRef[]> {
    const records = await this.prisma.teachingAssignment.findMany({
      where: {
        teacherId: userId,
        schoolId,
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: {
        class: { include: { levelType: { select: { name: true } } } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ class: { name: 'asc' } }, { subject: { name: 'asc' } }],
    });
    return records.map((a) => ({
      id: a.id,
      teacherId: a.teacherId,
      classId: a.classId,
      subjectId: a.subjectId,
      academicYearId: a.academicYearId,
      className: a.class.name,
      subjectName: a.subject.name,
      subjectCode: a.subject.code,
      levelTypeName: a.class.levelType?.name || null,
      schoolId,
    }));
  }

  private toAssignmentRef(a: AssignmentRef | AssignmentAnalytics): AssignmentRef {
    return {
      id: 'id' in a ? a.id : a.assignmentId,
      teacherId: 'teacherId' in a ? a.teacherId : '',
      classId: a.classId,
      subjectId: a.subjectId,
      academicYearId: 'academicYearId' in a ? a.academicYearId : '',
      className: a.className,
      subjectName: a.subjectName,
      subjectCode: 'subjectCode' in a ? a.subjectCode : null,
      levelTypeName: 'levelTypeName' in a ? a.levelTypeName : null,
      schoolId: 'schoolId' in a ? a.schoolId : '',
    };
  }

  // -------------------------------------------------------------------------
  // Authoritative result loading (same pipeline as Results / Admin analytics)
  // -------------------------------------------------------------------------

  private async resolveLegacyScores(results: any[], termId: string, schoolId: string) {
    if (results.length === 0) return results;
    const studentIds = [...new Set(results.map((r) => r.studentId))];
    const legacyResults = await this.prisma.result.findMany({
      where: { studentId: { in: studentIds }, termId, schoolId, student: { status: 'ACTIVE' } },
      select: { studentId: true, subjectId: true, score: true, grade: true },
    });
    const legacyMap = new Map<string, { score: number; grade: string | null }>();
    for (const lr of legacyResults) {
      legacyMap.set(`${lr.studentId}:${lr.subjectId}`, { score: lr.score, grade: lr.grade });
    }
    for (const r of results) {
      if (r.finalPercentage == null) {
        const legacy = legacyMap.get(`${r.studentId}:${r.subjectId}`);
        if (legacy) {
          r.finalPercentage = legacy.score;
          if (r.finalGrade == null) r.finalGrade = legacy.grade;
        }
      }
    }
    return results;
  }

  private async filterByStudentSubjects(results: any[], classId: string) {
    if (!classId || results.length === 0) return results;
    const studentIds = [...new Set(results.map((r) => r.studentId))];
    const subjectMap = await this.studentSubjectService.getClassSubjectsForStudents(studentIds, classId);
    return results.filter((r) => {
      const validIds = subjectMap.get(r.studentId);
      return validIds ? validIds.includes(r.subjectId) : true;
    });
  }

  private async loadResultsForAssignment(
    assignment: AssignmentRef,
    termId: string,
    schoolId: string,
  ): Promise<ComputedResultRow[]> {
    let results = (await this.prisma.computedResult.findMany({
      where: {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        termId,
        schoolId,
        status: { in: COMPUTED_STATUSES },
        student: { status: 'ACTIVE' },
      },
      select: {
        studentId: true,
        subjectId: true,
        finalPercentage: true,
        finalGrade: true,
        points: true,
        isAbsent: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            gender: true,
            photoUrl: true,
            status: true,
          },
        },
      },
    })) as ComputedResultRow[];

    results = await this.resolveLegacyScores(results, termId, schoolId);
    return this.filterByStudentSubjects(results, assignment.classId);
  }

  private async loadPreviousTermResults(
    assignment: AssignmentRef,
    currentTermId: string,
    currentTermStart: Date,
    schoolId: string,
  ) {
    const previousTerm = await this.prisma.term.findFirst({
      where: {
        academicYear: { schoolId },
        startDate: { lt: currentTermStart },
      },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true, startDate: true },
    });
    if (!previousTerm || previousTerm.id === currentTermId) {
      return { term: null, results: [] };
    }
    const rows = await this.loadResultsForAssignment(assignment, previousTerm.id, schoolId);
    return { term: previousTerm, results: rows };
  }

  // -------------------------------------------------------------------------
  // Per-assignment analytics
  // -------------------------------------------------------------------------

  async buildAssignmentAnalytics(
    assignment: AssignmentRef,
    termId: string,
    termName: string,
    termStart: Date,
    academicYearName: string,
    schoolId: string,
  ): Promise<AssignmentAnalytics> {
    const results = await this.loadResultsForAssignment(assignment, termId, schoolId);
    const participated = results.filter((r) => !r.isAbsent);
    const scores = participated.map((r) => r.finalPercentage).filter((p): p is number => p != null);
    const enrolledStudents = await this.prisma.enrollment.count({
      where: { classId: assignment.classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
    });

    const participationRate =
      enrolledStudents > 0 ? (participated.length / enrolledStudents) * 100 : null;

    // Gender breakdown
    const femaleScores = participated
      .filter((r) => r.student?.gender?.toLowerCase() === 'female')
      .map((r) => r.finalPercentage)
      .filter((p): p is number => p != null);
    const maleScores = participated
      .filter((r) => r.student?.gender?.toLowerCase() === 'male')
      .map((r) => r.finalPercentage)
      .filter((p): p is number => p != null);
    const gender: GenderAnalysis = {
      available: femaleScores.length + maleScores.length > 0,
      female: { ...this.stats.scoreStats(femaleScores), count: femaleScores.length },
      male: { ...this.stats.scoreStats(maleScores), count: maleScores.length },
      unknown: {
        count: participated.filter(
          (r) =>
            !r.student?.gender ||
            (r.student?.gender?.toLowerCase() !== 'female' && r.student?.gender?.toLowerCase() !== 'male'),
        ).length,
      },
      gap: this.stats.genderGap(
        this.stats.mean(femaleScores),
        this.stats.mean(maleScores),
        this.stats.passRate(femaleScores),
        this.stats.passRate(maleScores),
      ),
    };

    // Improvement / decline vs previous term
    const { term: prevTerm, results: prevResults } = await this.loadPreviousTermResults(
      assignment,
      termId,
      termStart,
      schoolId,
    );
    const prevScoresByStudent = new Map<string, number>();
    for (const r of prevResults) {
      if (r.finalPercentage != null) prevScoresByStudent.set(r.studentId, r.finalPercentage);
    }
    const improvingStudents: string[] = [];
    const decliningStudents: string[] = [];
    const deltas: number[] = [];
    for (const r of participated) {
      if (r.finalPercentage == null) continue;
      const prev = prevScoresByStudent.get(r.studentId);
      if (prev == null) continue;
      const delta = r.finalPercentage - prev;
      deltas.push(delta);
      if (delta > TREND_SENSITIVITY) improvingStudents.push(r.studentId);
      else if (delta < -TREND_SENSITIVITY) decliningStudents.push(r.studentId);
    }
    const avgDelta = deltas.length ? this.stats.mean(deltas) : null;
    const trend: Trend = this.stats.trendLabel(avgDelta);

    // Competency/coverage evidence available from per-student term summaries
    const studentIds = participated.map((r) => r.studentId);
    const termSummaries = await this.prisma.termSummary.findMany({
      where: { termId, studentId: { in: studentIds }, classId: assignment.classId },
      select: { studentId: true, competencyScores: true },
    });
    const competencyDataPresent = termSummaries.some(
      (t) => t.competencyScores && Object.keys(t.competencyScores as object).length > 0,
    );

    const qualityRate = participated.length
      ? (scores.filter((s) => s >= 50).length / scores.length) * 100
      : null;

    return {
      assignmentId: assignment.id,
      classId: assignment.classId,
      className: assignment.className,
      subjectId: assignment.subjectId,
      subjectName: assignment.subjectName,
      termId,
      termName,
      academicYearName,
      enrolledStudents,
      assessedStudents: participated.length,
      assessmentsAnalysed: scores.length,
      participationRate: this.stats.round2(participationRate),
      stats: this.stats.scoreStats(scores),
      distribution: this.stats.distribution(scores),
      gradeDistribution: this.stats.gradeDistribution(
        participated.map((r) => ({ score: r.finalPercentage, grade: r.finalGrade })),
      ),
      gender,
      qualityQuantity: this.stats.qualityQuantity(participationRate, qualityRate),
      improvingStudents,
      decliningStudents,
      trend,
      trendDelta: this.stats.round2(avgDelta),
      atRiskCount: scores.filter((s) => s < 50).length,
      assessmentCompletion: this.stats.round2(participationRate),
    } as AssignmentAnalytics;
  }

  async getAssignmentsAnalytics(
    contextUserId: string,
    schoolId: string,
    term: { id: string; name: string; startDate: Date },
    academicYearName: string,
  ): Promise<AssignmentAnalytics[]> {
    const termRecord = await this.prisma.term.findUnique({
      where: { id: term.id },
      include: { academicYear: true },
    });
    const assignments = await this.getAssignments(contextUserId, schoolId, termRecord?.academicYearId);
    const out: AssignmentAnalytics[] = [];
    for (const assignment of assignments) {
      try {
        out.push(
          await this.buildAssignmentAnalytics(
            assignment,
            term.id,
            term.name,
            term.startDate,
            termRecord?.academicYear?.name || academicYearName,
            schoolId,
          ),
        );
      } catch (err) {
        this.logger.warn(
          `Assignment analytics failed for ${assignment.className}/${assignment.subjectName}: ${(err as Error).message}`,
        );
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Teacher summary
  // -------------------------------------------------------------------------

  async buildTeacherSummary(
    context: TeacherContext,
    assignmentAnalytics: AssignmentAnalytics[],
    term: { id: string; name: string } | null,
    academicYearName: string | null,
  ): Promise<TeacherSummary> {
    const withData = assignmentAnalytics.filter((a) => a.stats.count > 0);

    const weightedAverage =
      withData.length > 0
        ? this.stats.round2(
            withData.reduce((sum, a) => sum + (a.stats.average ?? 0), 0) / withData.length,
          )
        : null;

    const passRates = withData.map((a) => a.stats.passRate).filter((p): p is number => p != null);
    const overallPassRate =
      passRates.length > 0
        ? this.stats.round2(passRates.reduce((a, b) => a + b, 0) / passRates.length)
        : null;

    // Strongest / weakest subject (average of its class averages)
    const bySubject = new Map<string, { subjectName: string; averages: number[] }>();
    for (const a of withData) {
      if (!bySubject.has(a.subjectId)) {
        bySubject.set(a.subjectId, { subjectName: a.subjectName, averages: [] });
      }
      if (a.stats.average != null) bySubject.get(a.subjectId)!.averages.push(a.stats.average);
    }
    let strongestSubject: { subjectName: string; average: number | null } | null = null;
    let weakestSubject: { subjectName: string; average: number | null } | null = null;
    for (const entry of bySubject.values()) {
      const avg = entry.averages.length ? this.stats.mean(entry.averages) : null;
      if (avg == null) continue;
      if (!strongestSubject || avg > (strongestSubject.average ?? 0)) {
        strongestSubject = { subjectName: entry.subjectName, average: this.stats.round2(avg) };
      }
      if (!weakestSubject || avg < (weakestSubject.average ?? 0)) {
        weakestSubject = { subjectName: entry.subjectName, average: this.stats.round2(avg) };
      }
    }

    const scored = assignmentAnalytics.filter((a) => a.stats.average != null);
    const highest = scored.length
      ? scored.reduce((max, a) => (a.stats.average! > (max.stats.average ?? 0) ? a : max), scored[0])
      : null;
    const lowest = scored.length
      ? scored.reduce((min, a) => (a.stats.average! < (min.stats.average ?? 0) ? a : min), scored[0])
      : null;

    const improvingStudents = new Set<string>();
    const decliningStudents = new Set<string>();
    for (const a of assignmentAnalytics) {
      a.improvingStudents.forEach((id) => improvingStudents.add(id));
      a.decliningStudents.forEach((id) => decliningStudents.add(id));
    }

    const gaps = assignmentAnalytics
      .filter((a) => a.gender.available && a.gender.gap.averageGap != null)
      .map((a) => a.gender.gap.averageGap as number);
    const genderGap = gaps.length > 0 ? this.stats.round2(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
    const femaleAverages = assignmentAnalytics
      .filter((a) => a.gender.available && a.gender.female.average != null)
      .map((a) => a.gender.female.average as number);
    const maleAverages = assignmentAnalytics
      .filter((a) => a.gender.available && a.gender.male.average != null)
      .map((a) => a.gender.male.average as number);
    const genderGapClassification = genderGap != null
      ? this.stats.genderGap(
          this.stats.mean(femaleAverages),
          this.stats.mean(maleAverages),
          null,
          null,
        ).classification
      : 'INSUFFICIENT_DATA';

    const totalAssessed = assignmentAnalytics.reduce((sum, a) => sum + a.stats.count, 0);
    const performanceIndicators = {
      improvingRatio: this.stats.round2(totalAssessed ? improvingStudents.size / totalAssessed : null),
      decliningRatio: this.stats.round2(totalAssessed ? decliningStudents.size / totalAssessed : null),
      highPerformers: assignmentAnalytics.reduce(
        (sum, a) => sum + (a.distribution.find((d) => d.label === '75-100%')?.count || 0),
        0,
      ),
      lowPerformers: assignmentAnalytics.reduce(
        (sum, a) => sum + (a.distribution.find((d) => d.label === '0-39%')?.count || 0),
        0,
      ),
    };

    return {
      teacher: context,
      academicYear: academicYearName,
      term,
      examType: 'END_TERM',
      assignments: [],
      classesCount: new Set(assignmentAnalytics.map((a) => a.classId)).size,
      subjectsCount: new Set(assignmentAnalytics.map((a) => a.subjectId)).size,
      totalStudentsTaught: assignmentAnalytics.reduce((sum, a) => sum + a.enrolledStudents, 0),
      assessmentsAnalysed: assignmentAnalytics.reduce((sum, a) => sum + a.stats.count, 0),
      overallAverage: weightedAverage,
      overallPassRate,
      highestClassAverage: highest
        ? { className: highest.className, subjectName: highest.subjectName, average: highest.stats.average as number }
        : null,
      lowestClassAverage: lowest
        ? { className: lowest.className, subjectName: lowest.subjectName, average: lowest.stats.average as number }
        : null,
      strongestSubject,
      weakestSubject,
      strongestCompetency: null,
      weakestCompetency: null,
      studentsRequiringIntervention: assignmentAnalytics.reduce((sum, a) => sum + a.atRiskCount, 0),
      studentsAtRisk: assignmentAnalytics.reduce(
        (sum, a) => sum + (a.distribution.find((d) => d.label === '0-39%')?.count || 0),
        0,
      ),
      genderGap,
      genderGapClassification,
      performanceIndicators,
      lastUpdated: new Date().toISOString(),
      dataPeriod: term ? `${term.name} ${academicYearName || ''}`.trim() : 'No active term',
    };
  }

  // -------------------------------------------------------------------------
  // Class / subject / historical aggregates
  // -------------------------------------------------------------------------

  async getClassAnalytics(
    context: TeacherContext,
    term: { id: string; name: string; startDate: Date },
    academicYearName: string,
  ) {
    const analytics = await this.getAssignmentsAnalytics(context.userId, context.schoolId, term, academicYearName);
    const byClass = new Map<string, AssignmentAnalytics[]>();
    for (const a of analytics) {
      if (!byClass.has(a.classId)) byClass.set(a.classId, []);
      byClass.get(a.classId)!.push(a);
    }
    return Array.from(byClass.entries()).map(([classId, rows]) => {
      const averages = rows.map((r) => r.stats.average).filter((v): v is number => v != null);
      const passRates = rows.map((r) => r.stats.passRate).filter((v): v is number => v != null);
      const gapValues = rows.map((r) => r.gender.gap.averageGap).filter((v): v is number => v != null);
      return {
        classId,
        className: rows[0].className,
        subjects: rows.map((r) => r.subjectName),
        studentCount: rows.reduce((sum, r) => sum + r.enrolledStudents, 0),
        average: averages.length ? this.stats.round2(this.stats.mean(averages)) : null,
        passRate: passRates.length ? this.stats.round2(this.stats.mean(passRates)) : null,
        trend: this.stats.trendLabel(
          rows.reduce((sum, r) => sum + (r.trendDelta ?? 0), 0) / (rows.length || 1),
        ),
        genderGap: gapValues.length ? this.stats.round2(this.stats.mean(gapValues)) : null,
        assignmentDetails: rows,
      };
    });
  }

  async getSubjectAnalytics(
    context: TeacherContext,
    term: { id: string; name: string; startDate: Date },
    academicYearName: string,
  ) {
    const analytics = await this.getAssignmentsAnalytics(context.userId, context.schoolId, term, academicYearName);
    const bySubject = new Map<string, AssignmentAnalytics[]>();
    for (const a of analytics) {
      if (!bySubject.has(a.subjectId)) bySubject.set(a.subjectId, []);
      bySubject.get(a.subjectId)!.push(a);
    }
    return Array.from(bySubject.entries()).map(([subjectId, rows]) => {
      const averages = rows.map((r) => r.stats.average).filter((v): v is number => v != null);
      const passRates = rows.map((r) => r.stats.passRate).filter((v): v is number => v != null);
      const sorted = [...rows].sort((a, b) => (b.stats.average ?? 0) - (a.stats.average ?? 0));
      return {
        subjectId,
        subjectName: rows[0].subjectName,
        classesCount: rows.length,
        totalLearners: rows.reduce((sum, r) => sum + r.enrolledStudents, 0),
        overallAverage: averages.length ? this.stats.round2(this.stats.mean(averages)) : null,
        overallPassRate: passRates.length ? this.stats.round2(this.stats.mean(passRates)) : null,
        highestPerformingClass: sorted[0]
          ? { className: sorted[0].className, average: sorted[0].stats.average }
          : null,
        lowestPerformingClass: sorted.length
          ? { className: sorted[sorted.length - 1].className, average: sorted[sorted.length - 1].stats.average }
          : null,
        classBreakdown: rows.map((r) => ({
          className: r.className,
          average: r.stats.average,
          passRate: r.stats.passRate,
          studentCount: r.stats.count,
        })),
      };
    });
  }

  async getHistoricalPoints(
    context: TeacherContext,
    term: { id: string },
    schoolId: string,
  ): Promise<HistoricalPoint[]> {
    const termRecord = await this.prisma.term.findUnique({
      where: { id: term.id },
      include: { academicYear: true },
    });
    if (!termRecord) return [];
    const assignments = await this.getAssignments(context.userId, schoolId, termRecord.academicYearId);
    if (assignments.length === 0) return [];

    const terms = await this.prisma.term.findMany({
      where: { academicYearId: termRecord.academicYearId },
      orderBy: { startDate: 'asc' },
      select: { id: true, name: true, startDate: true, academicYear: { select: { name: true } } },
    });

    const points: HistoricalPoint[] = [];
    for (const t of terms) {
      const perAssignment = await Promise.all(
        assignments.map(async (a) => {
          const rows = await this.loadResultsForAssignment(a, t.id, schoolId);
          const scores = rows
            .filter((r) => !r.isAbsent && r.finalPercentage != null)
            .map((r) => r.finalPercentage as number);
          return { avg: this.stats.mean(scores), pass: this.stats.passRate(scores), count: scores.length };
        }),
      );
      const withData = perAssignment.filter((p) => p.count > 0);
      if (withData.length === 0) continue;
      points.push({
        termId: t.id,
        termName: t.name,
        academicYearName: t.academicYear.name,
        average: this.stats.round2(withData.reduce((s, p) => s + (p.avg ?? 0), 0) / withData.length),
        passRate: this.stats.round2(withData.reduce((s, p) => s + (p.pass ?? 0), 0) / withData.length),
        count: withData.reduce((s, p) => s + p.count, 0),
        isCurrent: t.id === term.id,
      });
    }
    return points;
  }

  // -------------------------------------------------------------------------
  // Competency analysis
  // -------------------------------------------------------------------------

  async getCompetencyAnalysis(
    context: TeacherContext,
    term: { id: string },
    academicYearName: string,
  ): Promise<CompetencyAnalysis> {
    const analytics = await this.getAssignmentsAnalytics(context.userId, context.schoolId, term as any, academicYearName);
    const rows: CompetencyAnalysis['classCompetency'] = [];
    for (const a of analytics) {
      const summaries = await this.prisma.termSummary.findMany({
        where: { termId: term.id, classId: a.classId },
        select: { studentId: true, competencyScores: true },
      });
      for (const s of summaries) {
        const data = s.competencyScores as Record<string, number> | null;
        if (!data || typeof data !== 'object') continue;
        for (const [name, value] of Object.entries(data)) {
          if (typeof value !== 'number') continue;
          rows.push({
            classId: a.classId,
            className: a.className,
            subjectId: a.subjectId,
            subjectName: a.subjectName,
            competencyName: name,
            averageMastery: this.stats.round2(value),
            affectedStudents: 1,
            affectedPercentage: a.enrolledStudents ? this.stats.round2((1 / a.enrolledStudents) * 100) : null,
            trend: 'INSUFFICIENT_DATA' as const,
            status: value >= 75 ? 'MASTERED' : value >= 50 ? 'DEVELOPING' : value >= 40 ? 'WEAK' : 'CRITICAL',
          });
        }
      }
    }

    if (rows.length === 0) {
      return {
        available: false,
        source: null,
        dataRequired:
          'Competency-level scores are not yet recorded for these classes. Record learning-area or competency assessments so mastery analysis can be produced for each competency/topic.',
        classCompetency: [],
        weakestCompetency: null,
        strongestCompetency: null,
      };
    }

    const grouped = new Map<string, CompetencyAnalysis['classCompetency']>();
    for (const r of rows) {
      const key = `${r.subjectId}:${r.competencyName}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }
    const classCompetency = Array.from(grouped.entries()).map(([, list]) => {
      const avg = this.stats.mean(list.map((l) => l.averageMastery ?? 0));
      return {
        ...list[0],
        averageMastery: this.stats.round2(avg),
        affectedStudents: list.length,
        status:
          (avg ?? 0) >= 75
            ? ('MASTERED' as const)
            : (avg ?? 0) >= 50
              ? ('DEVELOPING' as const)
              : (avg ?? 0) >= 40
                ? ('WEAK' as const)
                : ('CRITICAL' as const),
      };
    });

    const sorted = [...classCompetency].sort((a, b) => (b.averageMastery ?? 0) - (a.averageMastery ?? 0));
    return {
      available: true,
      source: 'term-summary-competency-scores',
      dataRequired: null,
      classCompetency,
      weakestCompetency: sorted.length ? { name: sorted[sorted.length - 1].competencyName, averageMastery: sorted[sorted.length - 1].averageMastery, className: sorted[sorted.length - 1].className } : null,
      strongestCompetency: sorted.length ? { name: sorted[0].competencyName, averageMastery: sorted[0].averageMastery, className: sorted[0].className } : null,
    };
  }

  // -------------------------------------------------------------------------
  // Student risk engine
  // -------------------------------------------------------------------------

  async getStudentsAtRisk(
    context: TeacherContext,
    term: { id: string; name: string; startDate: Date },
    academicYearName: string,
  ): Promise<StudentRiskSummary[]> {
    const analytics = await this.getAssignmentsAnalytics(context.userId, context.schoolId, term, academicYearName);
    const out: StudentRiskSummary[] = [];
    const seen = new Map<string, StudentRiskSummary>();

    for (const a of analytics) {
      const ref = this.toAssignmentRef(a);
      const results = await this.loadResultsForAssignment(ref, term.id, context.schoolId);
      const prev = await this.loadPreviousTermResults(ref, term.id, term.startDate, context.schoolId);
      const prevMap = new Map<string, number>();
      for (const r of prev.results) {
        if (r.finalPercentage != null) prevMap.set(r.studentId, r.finalPercentage);
      }

      for (const r of results) {
        if (r.isAbsent || r.finalPercentage == null) continue;
        const studentId = r.studentId;
        const score = r.finalPercentage;
        const prevScore = prevMap.get(studentId);
        const delta = prevScore != null ? score - prevScore : null;
        const priorFailed = prevScore != null && prevScore < 50;

        const flags: string[] = [];
        let riskLevel: StudentRiskSummary['riskLevel'] = 'STABLE';
        if (score < 40) {
          riskLevel = 'HIGH';
          flags.push('failure below 40%');
        } else if (score < 50) {
          riskLevel = score < 50 && delta != null && delta < -10 ? 'HIGH' : 'MODERATE';
          flags.push('below the pass threshold');
        }
        if (delta != null && delta < -10) {
          if (riskLevel !== 'HIGH') riskLevel = 'MODERATE';
          flags.push(`decline of ${Math.abs(delta).toFixed(0)} points`);
        }
        if (priorFailed && score < 50) {
          riskLevel = 'HIGH';
          flags.push('repeated failure');
        }
        if (riskLevel === 'STABLE') {
          // only report learners who actually require attention
          continue;
        }

        const existing = seen.get(studentId);
        if (existing) {
          if (delta != null && existing.trendDelta == null) {
            existing.trendDelta = this.stats.round2(delta);
            existing.trend = this.stats.trendLabel(delta);
          }
          if (score > (existing.currentAverage ?? 0)) existing.currentAverage = this.stats.round2(score);
          for (const f of flags) if (!existing.flags.includes(f)) existing.flags.push(f);
          if (riskLevel === 'HIGH') existing.riskLevel = 'HIGH';
          else if (existing.riskLevel !== 'HIGH' && riskLevel === 'MODERATE') existing.riskLevel = 'MODERATE';
          continue;
        }

        const summary: StudentRiskSummary = {
          studentId,
          studentName: r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Student',
          admissionNumber: r.student?.admissionNumber || null,
          className: a.className,
          gender: r.student?.gender || null,
          photoUrl: r.student?.photoUrl || null,
          currentAverage: this.stats.round2(score),
          passFailStatus: score < 50 ? 'FAIL' : 'PASS',
          weakestCompetency: null,
          trend: delta != null ? this.stats.trendLabel(delta) : 'INSUFFICIENT_DATA',
          trendDelta: delta != null ? this.stats.round2(delta) : null,
          attendanceRate: null,
          riskLevel,
          flags,
          recommendedIntervention: this.recommendedInterventionFor(a.subjectName, score, flags),
        };
        seen.set(studentId, summary);
        out.push(summary);
      }
    }

    const rank = { HIGH: 0, MODERATE: 1, STABLE: 2 } as const;
    return out.sort(
      (x, y) => rank[x.riskLevel] - rank[y.riskLevel] || (y.currentAverage ?? 0) - (x.currentAverage ?? 0),
    );
  }

  private recommendedInterventionFor(subjectName: string, score: number, flags: string[]): string {
    const subjectLower = subjectName.toLowerCase();
    const base =
      score < 40
        ? 'small-group remedial sessions with targeted diagnostic activities'
        : 'focused practice with worked examples and regular retrieval checks';
    if (/math|physics|chemistry|science|biology/.test(subjectLower)) {
      return `Provide ${base}; use diagnostic exercises and step-by-step worked examples before independent practice. Re-assess within two weeks.`;
    }
    if (/english|language|literature/.test(subjectLower)) {
      return `Provide ${base}; prioritise vocabulary development, reading comprehension and structured writing practice. Re-assess within two weeks.`;
    }
    return `Provide ${base} with concept mapping and structured revision. Re-assess within two weeks and compare against the current baseline.`;
  }

  // -------------------------------------------------------------------------
  // Teaching load
  // -------------------------------------------------------------------------

  async getTeachingLoad(
    context: TeacherContext,
    termId: string,
    academicYearId?: string,
  ): Promise<TeachingLoad> {
    const assignments = await this.getAssignments(context.userId, context.schoolId, academicYearId);
    const assessmentsPerClass: TeachingLoad['assessmentsPerClass'] = [];
    let totalStudents = 0;
    let totalAssessments = 0;
    for (const a of assignments) {
      const rows = await this.prisma.computedResult.findMany({
        where: {
          classId: a.classId,
          subjectId: a.subjectId,
          termId,
          schoolId: context.schoolId,
          status: { in: COMPUTED_STATUSES },
          student: { status: 'ACTIVE' },
        },
        select: { id: true },
      });
      const enrolled = await this.prisma.enrollment.count({
        where: { classId: a.classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      });
      totalStudents += enrolled;
      totalAssessments += rows.length;
      assessmentsPerClass.push({
        className: a.className,
        subjectName: a.subjectName,
        expected: enrolled,
        entered: rows.length,
      });
    }
    const expectedTotal = assessmentsPerClass.reduce((s, p) => s + p.expected, 0);
    return {
      subjectsTaught: [...new Set(assignments.map((a) => a.subjectName))],
      classesTaught: [...new Set(assignments.map((a) => a.className))],
      totalStudents,
      totalAssessments,
      competencyCoverage: null,
      resultCompletion: expectedTotal
        ? this.stats.round2((assessmentsPerClass.reduce((s, p) => s + p.entered, 0) / expectedTotal) * 100)
        : null,
      assessmentsPerClass,
    };
  }

  // -------------------------------------------------------------------------
  // Attendance + performance correlation
  // -------------------------------------------------------------------------

  async getAttendanceCorrelation(
    context: TeacherContext,
    term: { id: string; startDate: Date; endDate?: Date | null },
  ) {
    const analytics = await this.getAssignmentsAnalytics(context.userId, context.schoolId, term as any, '');
    const studentRates = new Map<string, { rate: number; score: number }>();
    for (const a of analytics) {
      const ref = this.toAssignmentRef(a);
      const results = await this.loadResultsForAssignment(ref, term.id, context.schoolId);
      const participants = results.filter((r) => !r.isAbsent);
      const studentsWithScores = participants.filter((r) => r.finalPercentage != null).map((r) => r.studentId);
      if (studentsWithScores.length === 0) continue;

      const attendances = await this.prisma.attendance.findMany({
        where: {
          studentId: { in: studentsWithScores },
          date: term.startDate
            ? {
                gte: new Date(term.startDate),
                ...(term.endDate ? { lte: new Date(term.endDate) } : {}),
              }
            : undefined,
        },
        select: { studentId: true, status: true },
      });
      const counts = new Map<string, { total: number; present: number }>();
      for (const at of attendances) {
        if (!counts.has(at.studentId)) counts.set(at.studentId, { total: 0, present: 0 });
        const c = counts.get(at.studentId)!;
        c.total++;
        if (['PRESENT', 'LATE', 'ACTIVITY', 'PARTIAL_ATTENDANCE'].includes(at.status)) c.present++;
      }
      for (const r of participants) {
        if (r.finalPercentage == null) continue;
        const c = counts.get(r.studentId);
        if (!c || c.total === 0) continue;
        const rate = (c.present / c.total) * 100;
        const existing = studentRates.get(r.studentId);
        studentRates.set(r.studentId, {
          rate: existing ? (existing.rate + rate) / 2 : rate,
          score: existing ? Math.max(existing.score, r.finalPercentage) : r.finalPercentage,
        });
      }
    }

    const pairs = Array.from(studentRates.values());
    if (pairs.length < 3) {
      return {
        available: false,
        dataRequired:
          'At least 3 students with both attendance records and results are needed to examine an attendance–performance relationship.',
        correlation: null,
        sampleSize: pairs.length,
        highAttendanceAverage: null,
        lowAttendanceAverage: null,
        interpretation: null,
      };
    }

    const meanRate = this.stats.mean(pairs.map((p) => p.rate)) ?? 0;
    const meanScore = this.stats.mean(pairs.map((p) => p.score)) ?? 0;
    const cov = pairs.reduce((s, p) => s + (p.rate - meanRate) * (p.score - meanScore), 0);
    const sdRate = this.stats.stdDev(pairs.map((p) => p.rate)) ?? 1;
    const sdScore = this.stats.stdDev(pairs.map((p) => p.score)) ?? 1;
    const correlation = sdRate > 0 && sdScore > 0 ? cov / (pairs.length * sdRate * sdScore) : null;

    const sortedRates = [...pairs.map((p) => p.rate)].sort((a, b) => a - b);
    const cut = Math.max(1, Math.floor(pairs.length / 3));
    const lowGroup = pairs.filter((p) => p.rate <= sortedRates[cut - 1]);
    const highGroup = pairs.filter((p) => p.rate >= sortedRates[sortedRates.length - cut]);

    return {
      available: true,
      dataRequired: null,
      correlation: correlation != null ? this.stats.round(correlation, 3) : null,
      sampleSize: pairs.length,
      highAttendanceAverage: this.stats.round2(this.stats.mean(highGroup.map((p) => p.score))),
      lowAttendanceAverage: this.stats.round2(this.stats.mean(lowGroup.map((p) => p.score))),
      interpretation:
        correlation == null
          ? 'The attendance–performance relationship could not be quantified for this cohort.'
          : correlation > 0.15
            ? 'Students with lower attendance also show lower average performance in this cohort. This is a correlated observation, not evidence of causation.'
            : correlation < -0.15
              ? 'The relationship between attendance and performance appears weak or inverted in this cohort — performance is not tightly linked to attendance for the students assessed.'
              : 'No meaningful attendance–performance relationship was detected for this cohort.',
    };
  }

  // -------------------------------------------------------------------------
  // Consolidated overview
  // -------------------------------------------------------------------------

  async getOverview(reqUser: any, termId?: string) {
    const context = await this.resolveContext(reqUser);
    const cycle = await this.resolveAcademicCycle(context.schoolId, termId);
    if (!cycle.term) {
      return {
        context,
        summary: null,
        assignments: [],
        classes: [],
        subjects: [],
        competency: {
          available: false,
          source: null,
          dataRequired: 'No active term. Set a current academic year and term.',
          classCompetency: [],
          weakestCompetency: null,
          strongestCompetency: null,
        },
        atRisk: [],
        trends: [],
        attendance: { available: false, dataRequired: 'No active term.' },
        load: null,
        lastUpdated: new Date().toISOString(),
      };
    }
    const term = cycle.term;
    const yearName = term.academicYear?.name || '';
    const assignments = await this.getAssignmentsAnalytics(context.userId, context.schoolId, term, yearName);
    const summary = await this.buildTeacherSummary(
      context,
      assignments,
      { id: term.id, name: term.name },
      yearName,
    );
    summary.assignments = await this.getAssignments(context.userId, context.schoolId, term.academicYearId);

    const [classes, subjects, competency, atRisk, trends, attendance, load] = await Promise.all([
      this.getClassAnalytics(context, term, yearName),
      this.getSubjectAnalytics(context, term, yearName),
      this.getCompetencyAnalysis(context, term, yearName),
      this.getStudentsAtRisk(context, term, yearName),
      this.getHistoricalPoints(context, { id: term.id }, context.schoolId),
      this.getAttendanceCorrelation(context, term),
      this.getTeachingLoad(context, term.id, term.academicYearId),
    ]);
    summary.strongestCompetency = competency.strongestCompetency?.name || null;
    summary.weakestCompetency = competency.weakestCompetency?.name || null;
    summary.studentsRequiringIntervention = atRisk.filter((s) => s.riskLevel !== 'STABLE').length;
    summary.studentsAtRisk = atRisk.filter((s) => s.riskLevel === 'HIGH').length;

    return {
      context,
      summary,
      assignments,
      classes,
      subjects,
      competency,
      atRisk,
      trends,
      attendance,
      load,
      lastUpdated: summary.lastUpdated,
    };
  }

  // -------------------------------------------------------------------------
  // Report data (used by report engine + template placeholder system)
  // -------------------------------------------------------------------------

  async getReportData(reqUser: any, opts?: { termId?: string; examType?: string }): Promise<TeacherReportData> {
    const context = await this.resolveContext(reqUser);
    const cycle = await this.resolveAcademicCycle(context.schoolId, opts?.termId);
    const term = cycle.term;
    const school = await this.prisma.school.findUnique({ where: { id: context.schoolId } });

    const overview = term ? await this.getOverview(reqUser, term.id) : null;
    const assignments = term
      ? await this.getAssignmentsAnalytics(context.userId, context.schoolId, term as any, term.academicYear?.name || '')
      : [];

    const schoolName = school?.name || 'School';
    const placeholders = {
      '{{teacher_name}}': context.teacherName,
      '{{teacher_photo}}': context.teacherPhoto || '',
      '{{school_name}}': schoolName,
      '{{school_logo}}': school?.logoUrl || school?.logo || '',
      '{{department}}': context.department || '—',
      '{{academic_year}}': term?.academicYear?.name || '—',
      '{{term}}': term?.name || '—',
      '{{exam_type}}': opts?.examType || 'END_TERM',
      '{{subjects_taught}}':
        Array.from(new Set(assignments.map((a) => a.subjectName))).join(', ') || '—',
      '{{classes_taught}}': Array.from(new Set(assignments.map((a) => a.className))).join(', ') || '—',
      '{{student_count}}': String(overview?.summary?.totalStudentsTaught ?? 0),
      '{{overall_average}}':
        overview?.summary?.overallAverage != null ? `${overview.summary.overallAverage}%` : 'Insufficient data',
      '{{overall_pass_rate}}':
        overview?.summary?.overallPassRate != null ? `${overview.summary.overallPassRate}%` : 'Insufficient data',
      '{{gender_gap}}': overview?.summary?.genderGap != null ? String(overview.summary.genderGap) : 'Insufficient data',
      '{{at_risk_students}}': String(overview?.summary?.studentsAtRisk ?? 0),
      '{{strongest_subject}}': overview?.summary?.strongestSubject?.subjectName || '—',
      '{{weakest_subject}}': overview?.summary?.weakestSubject?.subjectName || '—',
      '{{strongest_competency}}': overview?.summary?.strongestCompetency || '—',
      '{{weakest_competency}}': overview?.summary?.weakestCompetency || '—',
    };

    return {
      header: {
        schoolName,
        schoolLogo: school?.logoUrl || school?.logo || null,
        schoolAddress:
          [school?.address, [school?.district, school?.province].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(', ') || null,
        schoolContact: [school?.phone, school?.email].filter(Boolean).join(' | ') || null,
        title: 'INDIVIDUAL TEACHER TEACHING ANALYSIS & INTELLIGENCE REPORT',
        teacherName: context.teacherName,
        teacherPhoto: context.teacherPhoto,
        department: context.department,
        academicYear: term?.academicYear?.name || null,
        term: term?.name || null,
        examType: opts?.examType || 'END_TERM',
        generatedDate: new Date().toISOString(),
      },
      summary:
        overview?.summary ||
        (await this.buildTeacherSummary(
          context,
          [],
          term ? { id: term.id, name: term.name } : null,
          term?.academicYear?.name || null,
        )),
      assignments,
      competency: overview?.competency || {
        available: false,
        source: null,
        dataRequired: 'No competency data available.',
        classCompetency: [],
        weakestCompetency: null,
        strongestCompetency: null,
      },
      atRisk: overview?.atRisk || [],
      insights: {
        aiUsed: false,
        model: null,
        generatedAt: new Date().toISOString(),
        scope: 'teacher',
        whatIsHappening: '',
        whereIsTheProblem: '',
        howSerious: null,
        whichLearnersAreAffected: [],
        whatMayBeContributing: [],
        supportingEvidence: [],
        recommendedNextSteps: [],
        howToMeasureProgress: [],
        actionPlan: [],
        strengths: [],
        factCheck: [],
      },
      placeholders,
      collectionPlaceholders: {
        classes: overview?.classes || [],
        subjects: overview?.subjects || [],
        competencies: overview?.competency?.classCompetency || [],
        students: overview?.atRisk || [],
      },
    };
  }
}
