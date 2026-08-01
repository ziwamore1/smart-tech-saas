import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { StudentSubjectService } from '../student-subject/student-subject.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private studentSubjectService: StudentSubjectService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI initialized for analytics AI insights.');
    } else {
      this.logger.warn('OPENAI_API_KEY not configured. AI insights will use rule-based generation.');
    }
  }

  private async filterComputedResultsBySubjects(results: any[], classId: string) {
    if (!classId || results.length === 0) return results;
    const studentIds = [...new Set(results.map(r => r.studentId))];
    const subjectMap = await this.studentSubjectService.getClassSubjectsForStudents(studentIds, classId);
    return results.filter(r => {
      const validIds = subjectMap.get(r.studentId);
      return validIds ? validIds.includes(r.subjectId) : true;
    });
  }

  private async resolveLegacyScores(results: any[], termId: string, schoolId: string) {
    if (results.length === 0) return results;
    const studentIds = [...new Set(results.map(r => r.studentId))];
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
          if (r.points == null) {
            r.points = legacy.score >= 75 ? 1 : legacy.score >= 65 ? 2 : legacy.score >= 50 ? 3 : legacy.score >= 40 ? 4 : 5;
          }
        }
      }
    }
    return results;
  }

  // ECZ Grading System mapping
  private interpretECZ(score: number) {
    if (score >= 75) return { grade: '1', remark: 'Distinction' };
    if (score >= 70) return { grade: '2', remark: 'Distinction' };
    if (score >= 65) return { grade: '3', remark: 'Merit' };
    if (score >= 60) return { grade: '4', remark: 'Merit' };
    if (score >= 55) return { grade: '5', remark: 'Credit' };
    if (score >= 50) return { grade: '6', remark: 'Credit' };
    if (score >= 45) return { grade: '7', remark: 'Pass' };
    if (score >= 40) return { grade: '8', remark: 'Pass' };
    return { grade: '9', remark: 'Fail' };
  }

  async getClassPerformance(schoolId: string, classId: string, termId: string) {
    let results = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      },
      include: {
        student: { select: { id: true } },
      },
    });

    results = await this.resolveLegacyScores(results, termId, schoolId);
    results = results.filter(r => r.finalPercentage != null);

    results = await this.filterComputedResultsBySubjects(results, classId);

    if (results.length === 0) {
      return null;
    }

    const scores = results.map((r) => r.finalPercentage ?? 0);

    const total = scores.reduce((a, b) => a + b, 0);

    const average = total / scores.length;

    const highest = Math.max(...scores);

    const lowest = Math.min(...scores);

    const passCount = scores.filter((s) => s >= 50).length;

    const failCount = scores.filter((s) => s < 50).length;

    const passRate = (passCount / scores.length) * 100;

    const failRate = (failCount / scores.length) * 100;

    return {
      totalStudents: new Set(results.map((r) => r.studentId)).size,
      classAverage: average,
      highestScore: highest,
      lowestScore: lowest,
      passRate: Number(passRate.toFixed(2)),
      failRate: Number(failRate.toFixed(2)),
    };
  }
  // ----------------------
  // 1️⃣ Class Ranking
  // ----------------------
  async getClassRanking(
    schoolId: string,
    classId: string,
    termId: string,
    gradingSystem: 'ECZ' | 'GPA' = 'ECZ',
  ) {
    let computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      },
    });

    computedResults = await this.resolveLegacyScores(computedResults, termId, schoolId);
    computedResults = computedResults.filter(r => r.finalPercentage != null);

    computedResults = await this.filterComputedResultsBySubjects(computedResults, classId);

    if (!computedResults.length) return [];

    const studentMap = new Map<string, { totalPoints: number; totalPercentage: number; subjects: number; student: any }>();

    for (const r of computedResults) {
      const key = r.studentId;
      const existing = studentMap.get(key);
      if (existing) {
        existing.totalPoints += r.points ?? 0;
        existing.totalPercentage += r.finalPercentage ?? 0;
        existing.subjects += 1;
      } else {
        studentMap.set(key, {
          totalPoints: r.points ?? 0,
          totalPercentage: r.finalPercentage ?? 0,
          subjects: 1,
          student: r.student,
        });
      }
    }

    const ranking = Array.from(studentMap.values()).map((s) => ({
      studentId: s.student.id,
      name: `${s.student.firstName} ${s.student.lastName}`,
      admissionNumber: s.student.admissionNumber,
      totalPoints: s.totalPoints,
      average: Number((s.totalPercentage / s.subjects).toFixed(2)),
      subjects: s.subjects,
    }));

    ranking.sort((a, b) => b.totalPoints - a.totalPoints);

    let lastPoints: number | null = null;
    let position = 0;
    return ranking.map((s, i) => {
      if (s.totalPoints !== lastPoints) {
        position = i + 1;
        lastPoints = s.totalPoints;
      }
      return { position, ...s };
    });
  }
  // ----------------------
  // 2️⃣ Student Comment
  // ----------------------
  async generateStudentComment(
    schoolId: string,
    studentId: string,
    termId: string,
    gradingSystem: 'ECZ' | 'GPA' = 'ECZ',
  ) {
    const results = await this.prisma.computedResult.findMany({
      where: { studentId, termId, schoolId, student: { status: 'ACTIVE' }, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] } },
      include: { subject: { select: { name: true } } },
    });

    if (!results.length) return { comment: 'No results available.' };

    // Also try Result table for NULL finalPercentage
    const legacyResults = await this.prisma.result.findMany({
      where: { studentId, termId, schoolId, student: { status: 'ACTIVE' } },
      select: { subjectId: true, score: true },
    });
    const legacyMap = new Map<string, number>();
    for (const lr of legacyResults) {
      if (lr.score != null) legacyMap.set(lr.subjectId, lr.score);
    }

    // Build enriched results with resolved scores
    const enriched = results.map(r => ({
      ...r,
      resolvedScore: r.finalPercentage ?? legacyMap.get(r.subjectId) ?? null,
      subjectName: r.subject?.name ?? 'Unknown',
    }));
    const withScores = enriched.filter(r => r.resolvedScore != null);

    if (!withScores.length) return { comment: 'No results available.' };

    const scores = withScores.map(r => r.resolvedScore!).sort((a, b) => b - a);
    const average = gradingSystem === 'ECZ'
      ? scores.slice(0, 6).reduce((sum, s) => sum + s, 0) / Math.min(scores.length, 6)
      : scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const failedSubjects = withScores.filter(r => r.resolvedScore! < 50);
    const excellentSubjects = withScores.filter(r => r.resolvedScore! >= 75);
    const goodSubjects = withScores.filter(r => r.resolvedScore! >= 60 && r.resolvedScore! < 75);
    const fairSubjects = withScores.filter(r => r.resolvedScore! >= 50 && r.resolvedScore! < 60);
    const poorSubjects = withScores.filter(r => r.resolvedScore! < 50);

    // Sort by score descending
    withScores.sort((a, b) => (b.resolvedScore ?? 0) - (a.resolvedScore ?? 0));
    const bestSubject = withScores[0];
    const weakestSubject = withScores[withScores.length - 1];

    const teacherComment = this.generatePersonalizedTeacherComment(
      average, failedSubjects, excellentSubjects, goodSubjects, fairSubjects, poorSubjects,
      bestSubject, weakestSubject, withScores.length,
    );
    const headComment = this.generatePersonalizedHeadComment(
      average, failedSubjects, excellentSubjects, bestSubject, weakestSubject,
    );

    return {
      average: Number(average.toFixed(2)),
      failedSubjects: failedSubjects.length,
      teacherComment,
      headComment,
    };
  }

  private generatePersonalizedTeacherComment(
    average: number,
    failedSubjects: any[],
    excellentSubjects: any[],
    goodSubjects: any[],
    fairSubjects: any[],
    poorSubjects: any[],
    bestSubject: any,
    weakestSubject: any,
    totalSubjects: number,
  ) {
    const parts: string[] = [];

    if (average >= 75) {
      parts.push(`${bestSubject?.subjectName} (${bestSubject?.resolvedScore}%) was the standout subject.`);
    } else if (average >= 60) {
      parts.push(`${bestSubject?.subjectName} (${bestSubject?.resolvedScore}%) was the strongest subject.`);
    } else if (average >= 50) {
      parts.push(`${bestSubject?.subjectName} (${bestSubject?.resolvedScore}%) was the best-performed subject.`);
    }

    if (excellentSubjects.length > 0) {
      const names = excellentSubjects.map(s => s.subjectName).join(', ');
      if (excellentSubjects.length === 1) {
        parts.push(`${names} achieved an excellent result.`);
      } else {
        parts.push(`${names} achieved excellent results.`);
      }
    }

    if (goodSubjects.length > 0) {
      const names = goodSubjects.map(s => s.subjectName).join(', ');
      parts.push(`${names} performed well and should be encouraged to improve further.`);
    }

    if (fairSubjects.length > 0) {
      const names = fairSubjects.map(s => s.subjectName).join(', ');
      parts.push(`${names} need more attention to reach higher performance levels.`);
    }

    if (poorSubjects.length > 0) {
      const names = poorSubjects.map(s => s.subjectName).join(', ');
      if (poorSubjects.length <= 2) {
        parts.push(`${names} require(s) focused improvement through additional study and practice.`);
      } else {
        parts.push(`${names} require significant improvement. Additional support and supervision are strongly recommended.`);
      }
    }

    if (failedSubjects.length > 0 && failedSubjects.length >= totalSubjects * 0.5) {
      parts.push(`The student is struggling in more than half of the subjects and needs urgent academic intervention.`);
    } else if (failedSubjects.length >= 3) {
      parts.push(`Attention should be given to the ${failedSubjects.length} subject(s) below 50%.`);
    }

    if (parts.length === 0) {
      parts.push('Performance is satisfactory across all subjects. Continued effort will yield better results.');
    }

    return parts.join(' ');
  }

  private generatePersonalizedHeadComment(
    average: number,
    failedSubjects: any[],
    excellentSubjects: any[],
    bestSubject: any,
    weakestSubject: any,
  ) {
    const parts: string[] = [];

    if (average >= 80) {
      parts.push(`Outstanding performance with an average of ${average.toFixed(0)}%.`);
      if (bestSubject) parts.push(`Top result in ${bestSubject.subjectName} (${bestSubject.resolvedScore}%).`);
      parts.push('Keep aiming higher and maintain this excellent standard.');
    } else if (average >= 70) {
      parts.push(`Very good performance with an average of ${average.toFixed(0)}%.`);
      if (bestSubject) parts.push(`${bestSubject.subjectName} (${bestSubject.resolvedScore}%) is a clear strength.`);
      if (weakestSubject) parts.push(`Focus on improving ${weakestSubject.subjectName} (${weakestSubject.resolvedScore}%).`);
    } else if (average >= 60) {
      parts.push(`Good work with an average of ${average.toFixed(0)}%.`);
      if (weakestSubject) parts.push(`More effort is needed in ${weakestSubject.subjectName} (${weakestSubject.resolvedScore}%).`);
    } else if (average >= 50) {
      parts.push(`Fair performance with an average of ${average.toFixed(0)}%.`);
      if (weakestSubject) parts.push(`Serious improvement is required in ${weakestSubject.subjectName} (${weakestSubject.resolvedScore}%).`);
      parts.push('Greater effort and discipline are necessary.');
    } else {
      parts.push(`Academic performance needs serious improvement (average: ${average.toFixed(0)}%).`);
      if (failedSubjects.length > 0) {
        parts.push(`${failedSubjects.length} subject(s) scored below 50%.`);
      }
      parts.push('Close supervision and additional support are strongly recommended.');
    }

    return parts.join(' ');
  }
  async getSubjectPerformance(classId: string, termId: string) {
    let results = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        finalPercentage: { not: null },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      },
      include: {
        subject: true,
      },
    });

    results = await this.filterComputedResultsBySubjects(results, classId);

    const subjects: Record<string, any> = {};

    for (const r of results) {
      if (!subjects[r.subjectId]) {
        subjects[r.subjectId] = {
          subject: r.subject.name,
          subjectId: r.subjectId,
          total: 0,
          count: 0,
        };
      }

      subjects[r.subjectId].total += r.finalPercentage ?? 0;
      subjects[r.subjectId].count += 1;
    }

    return Object.values(subjects).map((s: any) => ({
      subject: s.subject,
      subjectId: s.subjectId,
      average: s.total / s.count,
    }));
  }
  async getGradeDistribution(classId: string, termId: string) {
    let results = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      },
    });

    results = await this.filterComputedResultsBySubjects(results, classId);

    const distribution: Record<string, number> = {};

    for (const r of results) {
      const grade = r.finalGrade || 'Unknown';

      if (!distribution[grade]) {
        distribution[grade] = 0;
      }

      distribution[grade]++;
    }

    return distribution;
  }
  async getGenderPerformance(classId: string, termId: string) {
    let results = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        finalPercentage: { not: null },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      },
      include: {
        student: { select: { id: true, gender: true } },
      },
    });

    results = await this.filterComputedResultsBySubjects(results, classId);

    const genderTotals: Record<string, any> = {};

    for (const r of results) {
      const gender = r.student?.gender ?? 'Unknown';

      if (!genderTotals[gender]) {
        genderTotals[gender] = { total: 0, count: 0 };
      }

      genderTotals[gender].total += r.finalPercentage ?? 0;
      genderTotals[gender].count++;
    }

    return Object.keys(genderTotals).map((g) => ({
      gender: g,
      average: genderTotals[g].total / genderTotals[g].count,
    }));
  }
  async getTeacherPerformance(schoolId: string, termId: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      select: { id: true, academicYearId: true, name: true },
    });
    if (!term) throw new NotFoundException('Term not found');

    // Teaching assignments for the term's academic year — a teacher's class+subject load
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { schoolId, academicYearId: term.academicYearId },
      include: {
        class: { select: { id: true, name: true, levelTypeId: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const userIds = [...new Set(assignments.map(a => a.teacherId))];
    const teacherRecords = await this.prisma.teacher.findMany({
      where: { schoolId, userId: { in: userIds } },
      include: { departmentRel: { select: { name: true } } },
    });
    const teacherRecordByUserId = new Map(teacherRecords.map(t => [t.userId, t]));

    const classIds = [...new Set(assignments.map(a => a.classId))];
    const subjectIds = [...new Set(assignments.map(a => a.subjectId))];

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId: { in: classIds },
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      select: { studentId: true, classId: true },
    });
    const studentIds = [...new Set(enrollments.map(e => e.studentId))];

    let computed = await this.prisma.computedResult.findMany({
      where: {
        schoolId,
        termId,
        subjectId: { in: subjectIds },
        studentId: { in: studentIds },
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
      },
      select: {
        studentId: true,
        subjectId: true,
        classId: true,
        finalPercentage: true,
        finalGrade: true,
        points: true,
        gpa: true,
      },
    });
    computed = await this.resolveLegacyScores(computed, termId, schoolId);
    computed = computed.filter(r => r.finalPercentage != null);

    // Index computed results by classId+subjectId so we can map them to assignments
    const studentsByClass = new Map<string, Set<string>>();
    for (const e of enrollments) {
      if (!studentsByClass.has(e.classId)) studentsByClass.set(e.classId, new Set());
      studentsByClass.get(e.classId)!.add(e.studentId);
    }

    const assignmentStats: Array<{
      teacherId: string;
      teacherName: string;
      department: string;
      teacherRecordId: string | null;
      classId: string;
      className: string;
      subjectId: string;
      subjectName: string;
      studentCount: number;
      average: number | null;
      passRate: number | null;
      totalPoints: number | null;
      gradeCounts: Record<string, number>;
    }> = [];

    for (const a of assignments) {
      const studentsInClass = studentsByClass.get(a.classId) || new Set<string>();
      const classResults = computed.filter(
        r => r.classId === a.classId && r.subjectId === a.subjectId && studentsInClass.has(r.studentId),
      );

      const scores = classResults.map(r => r.finalPercentage as number);
      const pass = scores.filter(s => s >= 50).length;
      const points = classResults.filter(r => r.points != null).reduce((sum, r) => sum + (r.points as number), 0);
      const gradeCounts: Record<string, number> = {};
      for (const r of classResults) {
        if (r.finalGrade) gradeCounts[r.finalGrade] = (gradeCounts[r.finalGrade] || 0) + 1;
      }

      const rec = teacherRecordByUserId.get(a.teacherId);
      assignmentStats.push({
        teacherId: a.teacherId,
        teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`.trim(),
        department: rec?.departmentRel?.name || rec?.department || '—',
        teacherRecordId: rec?.id || null,
        classId: a.classId,
        className: a.class.name,
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        studentCount: scores.length,
        average: scores.length ? Number((scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(2)) : null,
        passRate: scores.length ? Number(((pass / scores.length) * 100).toFixed(2)) : null,
        totalPoints: points,
        gradeCounts,
      });
    }

    // Group by teacher
    const byTeacher = new Map<string, typeof assignmentStats>();
    for (const stat of assignmentStats) {
      if (!byTeacher.has(stat.teacherId)) byTeacher.set(stat.teacherId, []);
      byTeacher.get(stat.teacherId)!.push(stat);
    }

    // Raw scores per class+subject for pass-rate rollups
    const rawScoresByKey = new Map<string, number[]>();
    for (const a of assignments) {
      const studentsInClass = studentsByClass.get(a.classId) || new Set<string>();
      const scores = computed
        .filter(r => r.classId === a.classId && r.subjectId === a.subjectId && studentsInClass.has(r.studentId))
        .map(r => r.finalPercentage as number);
      rawScoresByKey.set(`${a.classId}:${a.subjectId}`, scores);
    }

    const teachers = Array.from(byTeacher.entries()).map(([teacherId, rows]) => {
      const averages = rows.filter(r => r.average != null).map(r => r.average as number);
      const rawScores = rows.flatMap(r => rawScoresByKey.get(`${r.classId}:${r.subjectId}`) || []);
      const overallAverage = averages.length
        ? Number((averages.reduce((s, x) => s + x, 0) / averages.length).toFixed(2))
        : null;
      const passCount = rawScores.filter(s => s >= 50).length;
      const overallPassRate = rawScores.length
        ? Number(((passCount / rawScores.length) * 100).toFixed(2))
        : null;
      const studentIdsForTeacher = new Set<string>();
      for (const r of rows) {
        for (const sid of studentsByClass.get(r.classId) || []) studentIdsForTeacher.add(sid);
      }
      const totalPoints = rows.reduce((s, r) => s + (r.totalPoints || 0), 0);
      const subjectNames = [...new Set(rows.map(r => r.subjectName))];
      const className = [...new Set(rows.map(r => r.className))];

      return {
        teacherId,
        teacherName: rows[0].teacherName,
        department: rows[0].department,
        teacherRecordId: rows[0].teacherRecordId,
        classCount: className.length,
        subjectCount: subjectNames.length,
        studentCount: studentIdsForTeacher.size,
        subjects: subjectNames,
        classes: className,
        average: overallAverage,
        passRate: overallPassRate,
        totalPoints,
        perClass: rows,
        effectiveness: null as { score: number | null; rating: string; zScore: number | null } | null,
      };
    });

    // Effectiveness score (normalised 0–5 from z-score across teachers)
    const scored = teachers.filter(t => t.average != null).map(t => t.average as number);
    const globalMean = scored.length ? scored.reduce((s, x) => s + x, 0) / scored.length : 0;
    const globalSd = scored.length
      ? Math.sqrt(scored.reduce((s, x) => s + (x - globalMean) ** 2, 0) / scored.length)
      : 0;

    for (const t of teachers) {
      if (t.average == null) {
        t.effectiveness = { score: null, rating: 'NO_DATA', zScore: null };
        continue;
      }
      const zScore = globalSd ? (t.average - globalMean) / globalSd : 0;
      const score = Math.min(5, Math.max(1, Number((2.5 + zScore * 1.2).toFixed(2))));
      const rating =
        zScore > 0.8 ? 'EXCELLENT'
        : zScore > 0.3 ? 'HIGH'
        : zScore > -0.3 ? 'AVERAGE'
        : zScore > -0.8 ? 'BELOW_AVERAGE'
        : 'NEEDS_IMPROVEMENT';
      t.effectiveness = { score, rating, zScore: Number(zScore.toFixed(2)) };
    }

    teachers.sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

    return {
      term: { id: term.id, name: term.name },
      summary: {
        teacherCount: teachers.length,
        classCount: classIds.length,
        subjectCount: subjectIds.length,
        studentCount: studentIds.length,
        assignmentCount: assignments.length,
        averageEffectiveness: scored.length
          ? Number((teachers.filter(t => t.effectiveness?.score != null).reduce((s, t) => s + (t.effectiveness!.score as number), 0) / teachers.filter(t => t.effectiveness?.score != null).length).toFixed(2))
          : null,
      },
      teachers,
    };
  }

  // ----------------------
  // AI-Powered Insights (OpenAI with rule-based fallback)
  // ----------------------
  async getAiInsights(options: {
    schoolId: string;
    classId?: string;
    termId?: string;
    teacherId?: string;
  }) {
    const { schoolId, classId, termId, teacherId } = options;

    let context: any = { schoolId };
    let fallbackInsight: any = null;
    let scope: 'school' | 'class' | 'teacher' = 'school';

    if (termId) {
      const term = await this.prisma.term.findUnique({
        where: { id: termId },
        select: { id: true, name: true },
      });
      context.term = term?.name || null;
    }

    if (teacherId) {
      scope = 'teacher';
      const teacherPerf = await this.getTeacherPerformance(schoolId, termId);
      const teacher = teacherPerf.teachers.find((t) => t.teacherId === teacherId);
      if (teacher) {
        context.teacher = teacher;
        context.summary = teacherPerf.summary;
        fallbackInsight = this.buildTeacherInsight(teacher);
      }
    } else if (classId && termId) {
      scope = 'class';
      const [classPerf, subjectPerf, gradeDist, ranking] = await Promise.all([
        this.getClassPerformance(schoolId, classId, termId).catch(() => null),
        this.getSubjectPerformance(classId, termId).catch(() => []),
        this.getGradeDistribution(classId, termId).catch(() => []),
        this.getClassRanking(schoolId, classId, termId).catch(() => []),
      ]);
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
        select: { id: true, name: true },
      });
      context.class = { id: classId, name: cls?.name || 'Class', classPerformance: classPerf, subjectPerformance: subjectPerf, gradeDistribution: gradeDist, ranking };
      fallbackInsight = this.buildClassInsight(context.class);
    } else if (termId) {
      // School-wide overview
      const classes = await this.prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true },
      });
      const classPerformances = [];
      for (const c of classes.slice(0, 20)) {
        const perf = await this.getClassPerformance(schoolId, c.id, termId).catch(() => null);
        if (perf) classPerformances.push({ classId: c.id, className: c.name, ...perf });
      }
      context.classes = classPerformances;
      fallbackInsight = this.buildSchoolInsight(classPerformances);
    }

    const aiResult = await this.generateWithAi(context, scope, fallbackInsight);

    return {
      scope,
      termId: termId || null,
      classId: classId || null,
      teacherId: teacherId || null,
      aiUsed: aiResult.aiUsed,
      model: aiResult.model,
      insight: aiResult.content,
      fallback: fallbackInsight,
    };
  }

  private async generateWithAi(
    context: any,
    scope: 'school' | 'class' | 'teacher',
    fallback: any,
  ): Promise<{ aiUsed: boolean; model: string | null; content: any }> {
    if (!this.openai) {
      return { aiUsed: false, model: null, content: fallback };
    }

    const prompt = `You are an expert education data analyst for a Zambian school management system.
Based on the following computed student results data, produce a JSON object with these fields:
- "summary": 2-3 sentence plain-English overview
- "strengths": array of strings describing what is going well
- "weaknesses": array of strings describing areas of concern
- "recommendations": array of 3-5 specific, actionable recommendations

Scope: ${scope}
Data (JSON): ${JSON.stringify(context).slice(0, 12000)}

Respond with ONLY valid JSON, no markdown.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You output strictly valid JSON with no commentary.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 800,
      });
      const content = response.choices[0]?.message?.content || '';
      let parsed = fallback;
      try {
        const cleaned = content.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = fallback;
      }
      return { aiUsed: true, model: response.model || 'gpt-4o-mini', content: parsed };
    } catch (error) {
      this.logger.warn(`AI insight generation failed, using rule-based: ${error.message}`);
      return { aiUsed: false, model: null, content: fallback };
    }
  }

  private buildClassInsight(cls: any) {
    const perf = cls?.classPerformance;
    const subjectPerf = Array.isArray(cls?.subjectPerformance) ? cls.subjectPerformance : [];
    const ranking = Array.isArray(cls?.ranking) ? cls.ranking : [];

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    const sortedSubjects = [...subjectPerf]
      .map((s: any) => ({ subject: s.subject || s.name, average: Number(s.average ?? 0), passRate: Number(s.passRate ?? 0) }))
      .sort((a, b) => b.average - a.average);

    if (sortedSubjects.length > 0) {
      const top = sortedSubjects.slice(0, 3);
      const bottom = sortedSubjects.slice(-3).reverse();
      for (const t of top) {
        if (t.average >= 60) strengths.push(`${t.subject} is a strong subject with an average of ${t.average.toFixed(1)}%.`);
      }
      for (const b of bottom) {
        if (b.average < 55) weaknesses.push(`${b.subject} averages only ${b.average.toFixed(1)}% and needs intervention.`);
      }
    }

    if (perf) {
      if (perf.passRate >= 70) strengths.push(`Overall pass rate is strong at ${perf.passRate.toFixed(1)}%.`);
      else if (perf.passRate < 55) weaknesses.push(`Overall pass rate is only ${perf.passRate.toFixed(1)}%, below the 55% target.`);
    }

    if (ranking.length > 0) {
      const topStudent = ranking[0];
      const bottomStudent = ranking[ranking.length - 1];
      if (topStudent) strengths.push(`${topStudent.studentName || topStudent.name || 'The top student'} is leading the class.`);
      if (bottomStudent && ranking.length > 1) {
        weaknesses.push(`${bottomStudent.studentName || bottomStudent.name || 'The lowest performer'} requires targeted support.`);
      }
    }

    const summary = `Class ${cls?.name || ''} has ${perf?.totalStudents ?? '—'} students with a class average of ${perf?.classAverage != null ? perf.classAverage.toFixed(1) + '%' : '—'} and a pass rate of ${perf?.passRate != null ? perf.passRate.toFixed(1) + '%' : '—'}. ${strengths.length ? 'Key strengths: ' + strengths.join(' ') : ''} ${weaknesses.length ? 'Areas of concern: ' + weaknesses.join(' ') : ''}`.trim();

    return {
      summary,
      strengths,
      weaknesses,
      recommendations: [
        weaknesses.length ? `Prioritise targeted support in: ${weaknesses.map(w => w.split(' is')[0]).join(', ')}.` : 'Maintain current teaching strategies and continue tracking performance.',
        'Encourage peer tutoring between top and struggling students.',
        'Review assessment weightings for subjects with low pass rates.',
        'Schedule parent engagement for students flagged at-risk.',
      ],
    };
  }

  private buildTeacherInsight(teacher: any) {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (teacher.average != null) {
      if (teacher.average >= 60) strengths.push(`Average student score of ${teacher.average}% across ${teacher.subjectCount} subject(s).`);
      else if (teacher.average < 50) weaknesses.push(`Average student score of ${teacher.average}% is below the 50% threshold.`);
    }
    if (teacher.passRate != null) {
      if (teacher.passRate >= 70) strengths.push(`Pass rate of ${teacher.passRate}% indicates effective delivery.`);
      else weaknesses.push(`Pass rate of ${teacher.passRate}% needs improvement.`);
    }

    const lowSubjects = (teacher.perClass || [])
      .filter((r: any) => r.average != null && r.average < 50)
      .map((r: any) => `${r.subjectName} (${r.className})`);

    const strongSubjects = (teacher.perClass || [])
      .filter((r: any) => r.average != null && r.average >= 60)
      .map((r: any) => `${r.subjectName} (${r.className})`);

    if (strongSubjects.length) strengths.push(`Strong in: ${strongSubjects.join(', ')}.`);
    if (lowSubjects.length) weaknesses.push(`Needs support in: ${lowSubjects.join(', ')}.`);

    const rating = teacher.effectiveness?.rating || 'NO_DATA';
    const summary = `${teacher.teacherName} teaches ${teacher.classCount} class(es) and ${teacher.subjectCount} subject(s) to ${teacher.studentCount} student(s). ${rating === 'EXCELLENT' || rating === 'HIGH' ? 'Performance is above the school average.' : rating === 'NO_DATA' ? 'No computed results available yet for this teacher.' : 'Performance is at or below the school average and should be reviewed.'}`;

    return {
      summary,
      strengths,
      weaknesses,
      recommendations: lowSubjects.length
        ? [`Focus professional development on: ${lowSubjects.join(', ')}.`, 'Share best practices from stronger subject areas.', 'Review class-level results with the HOD.']
        : ['Continue current practices.', 'Mentor other teachers in your strongest subjects.', 'Maintain accurate assessment tracking to support analytics.'],
    };
  }

  private buildSchoolInsight(classPerformances: any[]) {
    const withData = classPerformances.filter((c) => c.classAverage != null);
    const averages = withData.map((c) => c.classAverage);
    const overallAverage = averages.length ? averages.reduce((s, x) => s + x, 0) / averages.length : null;
    const overallPass = withData.length
      ? withData.reduce((s, c) => s + (c.passRate || 0), 0) / withData.length
      : null;

    const strongClasses = withData.filter((c) => (c.passRate || 0) >= 70).map((c) => c.className);
    const weakClasses = withData.filter((c) => (c.passRate || 0) < 50).map((c) => c.className);

    return {
      summary: `School-wide average is ${overallAverage != null ? overallAverage.toFixed(1) + '%' : 'not available'} with a mean pass rate of ${overallPass != null ? overallPass.toFixed(1) + '%' : '—'} across ${withData.length} class(es).`,
      strengths: strongClasses.length ? [`Strong performing classes: ${strongClasses.join(', ')}.`] : ['No classes above the 70% pass-rate threshold yet.'],
      weaknesses: weakClasses.length ? [`Classes needing attention: ${weakClasses.join(', ')}.`] : [],
      recommendations: [
        weakClasses.length ? 'Direct intervention programmes at the weakest classes first.' : 'Sustain good practice in strong classes.',
        'Compare subject-level results across classes to find systemic gaps.',
        'Use teacher-performance analytics to allocate coaching resources.',
      ],
    };
  }
  async getDirectorDashboard(
    schoolId: string,
    classId: string,
    termId: string,
  ) {
    const gradeDistribution = await this.getGradeDistribution(classId, termId);

    const ranking = await this.getClassRanking(schoolId, classId, termId);

    const subjectPerformance = await this.getSubjectPerformance(
      classId,
      termId,
    );

    const genderPerformance = await this.getGenderPerformance(classId, termId);

    const topStudents = ranking.slice(0, 5);
    const bottomStudents = ranking.slice(-5);

    return {
      gradeDistribution,
      subjectPerformance,
      genderPerformance,
      ranking,
      topStudents,
      bottomStudents,
    };
  }
  // ----------------------
  // 3️⃣ Subject Heatmap
  // ----------------------
  async getSubjectHeatmap(classId: string, termId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      include: { student: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);

    const classRec = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true },
    });

    const assessments = await this.prisma.assessmentType.findMany({
      where: { termId },
      distinct: ['subjectId'],
      include: { subject: true },
    });
    const subjectIds = assessments.map((a) => a.subjectId);

    let results = await this.prisma.computedResult.findMany({
      where: {
        studentId: { in: studentIds },
        termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      },
      include: { subject: true, student: true },
    });

    results = await this.resolveLegacyScores(results, termId, classRec?.schoolId ?? '');
    results = results.filter(r => r.finalPercentage != null);

    const heatmap = enrollments.map((e) => {
      const row: Record<string, string> = {
        studentName: `${e.student.firstName} ${e.student.lastName}`,
      };
      for (const sid of subjectIds) {
        const r = results.find(
          (res) => res.studentId === e.studentId && res.subjectId === sid,
        );
        if (!r) {
          row[sid] = '⚪';
          continue;
        }

        const score = r.finalPercentage ?? 0;
        if (score >= 75) row[sid] = '🟢';
        else if (score >= 50) row[sid] = '🟡';
        else row[sid] = '🔴';
      }
      return row;
    });

    const subjects = assessments.map((a) => ({
      subjectId: a.subjectId,
      name: a.subject.name,
    }));
    return { heatmap, subjects };
  }

  // ----------------------
  // 4️⃣ AI Early Alerts
  // ----------------------
  async generatePerformanceAlerts(
    classId: string,
    termId: string,
    previousTermId?: string,
  ) {
    const classRec = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true },
    });
    const schoolId = classRec?.schoolId ?? '';

    let results = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      },
      include: { student: true, subject: true },
    });

    results = await this.resolveLegacyScores(results, termId, schoolId);
    results = results.filter(r => r.finalPercentage != null);

    const alerts: string[] = [];

    for (const r of results) {
      if ((r.finalPercentage ?? 0) < 50)
        alerts.push(
          `⚠ ${r.student.firstName} ${r.student.lastName} is failing ${r.subject.name}`,
        );
    }

    if (previousTermId) {
      const prevResults = await this.prisma.computedResult.findMany({
        where: {
          classId,
          termId: previousTermId,
          schoolId,
          status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
          isAbsent: false,
          student: { status: 'ACTIVE' },
        },
      });
      const prevMap = new Map(
        prevResults.map((r) => [`${r.studentId}_${r.subjectId}`, r.finalPercentage]),
      );
      for (const r of results) {
        const key = `${r.studentId}_${r.subjectId}`;
        const prevScore = prevMap.get(key) as number | undefined;
        const curScore = r.finalPercentage ?? 0;
        if (
          prevScore !== undefined &&
          prevScore - curScore >= prevScore * 0.25
        ) {
          alerts.push(
            `⚠ ${r.student.firstName} ${r.student.lastName} dropped ${(
              prevScore - curScore
            ).toFixed(0)} points in ${r.subject.name}`,
          );
        }
      }
    }

    const subjects = [...new Set(results.map((r) => r.subjectId))];
    for (const sid of subjects) {
      const subjectResults = results.filter((r) => r.subjectId === sid);
      const avg =
        subjectResults.reduce((sum, r) => sum + (r.finalPercentage ?? 0), 0) /
        subjectResults.length;
      if (avg < 50)
        alerts.push(
          `⚠ Class average in ${subjectResults[0].subject.name} dropped below 50%`,
        );
    }

    return alerts;
  }

  async getPieChartData(schoolId: string, classId?: string) {
    const where: any = {
      schoolId,
      status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      isAbsent: false,
      student: { status: 'ACTIVE' },
    };
    if (classId) {
      where.classId = classId;
    }

    let results = await this.prisma.computedResult.findMany({ where });

    const termIds = [...new Set(results.map(r => r.termId))];
    const termId = termIds[0] ?? '';
    results = await this.resolveLegacyScores(results, termId, schoolId);
    results = results.filter(r => r.finalPercentage != null);

    const gradeDistribution: Record<string, number> = {};

    for (const r of results) {
      const grade = r.finalGrade || 'Unknown';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    }

    const sortedGrades = Object.entries(gradeDistribution)
      .sort(([a], [b]) => a.localeCompare(b));

    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    return {
      labels: sortedGrades.map(([grade, count]) => `${grade} (${count})`),
      datasets: [
        {
          data: sortedGrades.map(([, count]) => count),
          backgroundColor: sortedGrades.map((_, i) => colors[i % colors.length]),
        },
      ],
    };
  }

  async getLineChartData(
    schoolId: string,
    classId: string,
    subjectId?: string,
  ) {
    const terms = await this.prisma.term.findMany({
      where: { academicYear: { schoolId } },
      orderBy: { startDate: 'asc' },
      include: { academicYear: true },
    });

    const dataPoints: Array<{ label: string; value: number }> = [];

    for (const term of terms) {
      const where: any = {
        schoolId,
        termId: term.id,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      };
      if (classId) where.classId = classId;
      if (subjectId) where.subjectId = subjectId;

      let results = await this.prisma.computedResult.findMany({ where });
      results = await this.resolveLegacyScores(results, term.id, schoolId);
      results = results.filter(r => r.finalPercentage != null);

      if (results.length > 0) {
        const avg =
          results.reduce((sum, r) => sum + (r.finalPercentage ?? 0), 0) / results.length;
        dataPoints.push({
          label: `${term.name} ${term.academicYear.name}`,
          value: Number(avg.toFixed(2)),
        });
      }
    }

    return {
      labels: dataPoints.map((d) => d.label),
      datasets: [
        {
          label: 'Average Score',
          data: dataPoints.map((d) => d.value),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }

  async getBarChartData(schoolId: string, classId: string, termId: string) {
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });

    const data: Array<{
      subject: string;
      average: number;
      highest: number;
      lowest: number;
    }> = [];

    for (const subject of subjects) {
      const where: any = {
        schoolId,
        termId,
        subjectId: subject.id,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      };
      if (classId) where.classId = classId;

      let results = await this.prisma.computedResult.findMany({ where });
      results = await this.resolveLegacyScores(results, termId, schoolId);
      results = results.filter(r => r.finalPercentage != null);

      if (results.length > 0) {
        const avg =
          results.reduce((sum, r) => sum + (r.finalPercentage ?? 0), 0) / results.length;
        data.push({
          subject: subject.name,
          average: Number(avg.toFixed(2)),
          highest: Math.max(...results.map((r) => r.finalPercentage ?? 0)),
          lowest: Math.min(...results.map((r) => r.finalPercentage ?? 0)),
        });
      }
    }

    return {
      labels: data.map((d) => d.subject),
      datasets: [
        {
          label: 'Average',
          data: data.map((d) => d.average),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Highest',
          data: data.map((d) => d.highest),
          backgroundColor: '#22c55e',
        },
        {
          label: 'Lowest',
          data: data.map((d) => d.lowest),
          backgroundColor: '#ef4444',
        },
      ],
    };
  }

  async getHistogramData(schoolId: string, classId: string, termId: string) {
    const where: any = {
      schoolId,
      termId,
      status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      isAbsent: false,
      student: { status: 'ACTIVE' },
    };
    if (classId) where.classId = classId;

    let results = await this.prisma.computedResult.findMany({ where });
    results = await this.resolveLegacyScores(results, termId, schoolId);
    results = results.filter(r => r.finalPercentage != null);

    const ranges = [
      { label: '0-10', min: 0, max: 10, count: 0 },
      { label: '11-20', min: 11, max: 20, count: 0 },
      { label: '21-30', min: 21, max: 30, count: 0 },
      { label: '31-40', min: 31, max: 40, count: 0 },
      { label: '41-50', min: 41, max: 50, count: 0 },
      { label: '51-60', min: 51, max: 60, count: 0 },
      { label: '61-70', min: 61, max: 70, count: 0 },
      { label: '71-80', min: 71, max: 80, count: 0 },
      { label: '81-90', min: 81, max: 90, count: 0 },
      { label: '91-100', min: 91, max: 100, count: 0 },
    ];

    for (const result of results) {
      const range = ranges.find(
        (r) => (result.finalPercentage ?? 0) >= r.min && (result.finalPercentage ?? 0) <= r.max,
      );
      if (range) range.count++;
    }

    return {
      labels: ranges.map((r) => r.label),
      datasets: [
        {
          label: 'Number of Students',
          data: ranges.map((r) => r.count),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        },
      ],
    };
  }

  async getStudentResultsStats(schoolId: string, termId: string) {
    if (!termId) {
      return {
        overview: { totalExams: 0, passedExams: 0, failedExams: 0, passRate: 0, averageScore: 0 },
        byGender: null,
        byClass: null,
        topPerformers: [],
        improvementAreas: [],
      };
    }

    let results = await this.prisma.computedResult.findMany({
      where: { schoolId, termId, student: { status: 'ACTIVE' }, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, finalPercentage: { not: null }, isAbsent: false },
      include: { student: { select: { id: true, firstName: true, lastName: true } }, subject: { select: { id: true, name: true } } },
    });

    const totalExams = results.length;
    const passedExams = results.filter((r) => (r.finalPercentage ?? 0) >= 50).length;
    const failedExams = totalExams - passedExams;
    const passRate = totalExams > 0 ? (passedExams / totalExams) * 100 : 0;

    const byGender = termId ? await this.getGenderPerformance('', termId) : null;
    const byClass = termId ? await this.getClassPerformance(schoolId, '', termId) : null;

    return {
      overview: {
        totalExams,
        passedExams,
        failedExams,
        passRate: Number(passRate.toFixed(2)),
        averageScore:
          totalExams > 0
            ? Number(
                (
                  results.reduce((sum, r) => sum + (r.finalPercentage ?? 0), 0) / totalExams
                ).toFixed(2),
              )
            : 0,
      },
      byGender,
      byClass: byClass
        ? {
            average: byClass.classAverage,
            passRate: byClass.passRate,
            totalStudents: byClass.totalStudents,
          }
        : null,
      topPerformers: await this.getTopPerformers(schoolId, termId),
      improvementAreas: await this.getImprovementAreas(schoolId, termId),
    };
  }

  private async getTopPerformers(schoolId: string, termId: string) {
    const results = await this.prisma.computedResult.findMany({
      where: { schoolId, termId, student: { status: 'ACTIVE' }, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, finalPercentage: { not: null }, isAbsent: false },
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
    });

    const studentAverages = new Map<
      string,
      { student: any; total: number; count: number }
    >();

    for (const r of results) {
      const existing = studentAverages.get(r.studentId);
      if (existing) {
        existing.total += r.finalPercentage ?? 0;
        existing.count++;
      } else {
        studentAverages.set(r.studentId, {
          student: r.student,
          total: r.finalPercentage ?? 0,
          count: 1,
        });
      }
    }

    return Array.from(studentAverages.values())
      .map((s) => ({
        studentId: s.student.id,
        name: `${s.student.firstName} ${s.student.lastName}`,
        average: Number((s.total / s.count).toFixed(2)),
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 10);
  }

  private async getImprovementAreas(schoolId: string, termId: string) {
    const results = await this.prisma.computedResult.findMany({
      where: { schoolId, termId, student: { status: 'ACTIVE' }, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, finalPercentage: { not: null }, isAbsent: false },
      include: { subject: { select: { id: true, name: true } } },
    });

    const subjectStats = new Map<
      string,
      { subject: any; total: number; count: number }
    >();

    for (const r of results) {
      const existing = subjectStats.get(r.subjectId);
      if (existing) {
        existing.total += r.finalPercentage ?? 0;
        existing.count++;
      } else {
        subjectStats.set(r.subjectId, {
          subject: r.subject,
          total: r.finalPercentage ?? 0,
          count: 1,
        });
      }
    }

    return Array.from(subjectStats.values())
      .map((s) => ({
        subjectId: s.subject.id,
        subject: s.subject.name,
        average: Number((s.total / s.count).toFixed(2)),
        passRate: Number(
          (
            (results.filter(
              (r) => r.subjectId === s.subject.id && (r.finalPercentage ?? 0) >= 50,
            ).length /
              s.count) *
            100
          ).toFixed(2),
        ),
      }))
      .filter((s) => s.average < 50 || s.passRate < 50)
      .sort((a, b) => a.average - a.average);
  }

  async getSubscriptionStats(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return { error: 'School not found' };
    }

    const students = await this.prisma.student.findMany({
      where: { schoolId },
      select: { id: true },
    });

    const totalStudents = students.length;

    const payments = await this.prisma.feePayment.groupBy({
      by: ['status'],
      where: { schoolId },
      _sum: { amount: true },
      _count: true,
    });

    const totalRevenue = payments.reduce(
      (sum, p) => sum + (p._sum.amount || 0),
      0,
    );
    const paidPayments = payments.find((p) => p.status === 'PAID');
    const pendingPayments = payments.find((p) => p.status === 'PENDING');

    const maxStudents = school.subscriptionTier === 'premium' ? 1000 :
                        school.subscriptionTier === 'standard' ? 500 : 200;

    return {
      subscription: {
        plan: school.subscriptionTier,
        status: school.subscriptionStatus,
        startDate: school.subscriptionStartDate,
        endDate: school.subscriptionEndDate,
        maxStudents: maxStudents,
      },
      students: {
        total: totalStudents,
        active: totalStudents,
        inactive: 0,
        utilizationRate: Number(((totalStudents / maxStudents) * 100).toFixed(2)),
      },
      payments: {
        totalRevenue,
        paidCount: paidPayments?._count || 0,
        pendingCount: pendingPayments?._count || 0,
        pendingAmount: pendingPayments?._sum.amount || 0,
        collectionRate:
          totalRevenue > 0
            ? Number(
                (
                  ((paidPayments?._sum.amount || 0) / totalRevenue) *
                  100
                ).toFixed(2),
              )
            : 0,
      },
      revenueHistory: [],
    };
  }

  async getDashboardCharts(schoolId: string) {
    const [pieData, studentStats, subscriptionStats] = await Promise.all([
      this.getPieChartData(schoolId),
      this.getStudentResultsStats(schoolId, ''),
      this.getSubscriptionStats(schoolId),
    ]);

    return {
      gradeDistribution: pieData,
      studentPerformance: studentStats,
      subscription: subscriptionStats,
    };
  }
}
