import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

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
    const results = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        finalPercentage: { not: null },
        isAbsent: false,
      },
      include: {
        student: { select: { id: true } },
      },
    });

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
    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        finalPercentage: { not: null },
        isAbsent: false,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      },
    });

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
      where: { studentId, termId, schoolId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] } },
      include: { subject: { select: { name: true } } },
    });

    if (!results.length) return { comment: 'No results available.' };

    // Also try Result table for NULL finalPercentage
    const legacyResults = await this.prisma.result.findMany({
      where: { studentId, termId, schoolId },
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
    const results = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        finalPercentage: { not: null },
        isAbsent: false,
      },
      include: {
        subject: true,
      },
    });

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
    const results = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
      },
    });

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
    const results = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        finalPercentage: { not: null },
        isAbsent: false,
      },
      include: {
        student: { select: { id: true, gender: true } },
      },
    });

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
    const results = await this.prisma.result.findMany({
      where: { termId, schoolId },
      include: {
        teacher: true,
        subject: true,
      },
    });

    const teachers: Record<string, any> = {};

    for (const r of results) {
      if (!teachers[r.teacherId]) {
        teachers[r.teacherId] = {
          teacherId: r.teacherId,
          teacher: `${r.teacher.firstName} ${r.teacher.lastName}`,
          total: 0,
          count: 0,
        };
      }

      teachers[r.teacherId].total += r.score;
      teachers[r.teacherId].count++;
    }

    return Object.values(teachers).map((t: any) => ({
      teacherId: t.teacherId,
      teacher: t.teacher,
      count: t.count,
      average: t.total / t.count,
    }));
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
      where: { classId, status: 'ACTIVE' },
      include: { student: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);

    const assessments = await this.prisma.assessmentType.findMany({
      where: { termId },
      distinct: ['subjectId'],
      include: { subject: true },
    });
    const subjectIds = assessments.map((a) => a.subjectId);

    const results = await this.prisma.result.findMany({
      where: { studentId: { in: studentIds }, termId },
      include: { subject: true, student: true },
    });

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

        const score = r.score;
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
    const results = await this.prisma.result.findMany({
      where: { student: { enrollments: { some: { classId } } }, termId },
      include: { student: true, subject: true },
    });

    const alerts: string[] = [];

    for (const r of results) {
      if (r.score < 50)
        alerts.push(
          `⚠ ${r.student.firstName} ${r.student.lastName} is failing ${r.subject.name}`,
        );
    }

    if (previousTermId) {
      const prevResults = await this.prisma.result.findMany({
        where: {
          student: { enrollments: { some: { classId } } },
          termId: previousTermId,
        },
      });
      const prevMap = new Map(
        prevResults.map((r) => [`${r.studentId}_${r.subjectId}`, r.score]),
      );
      for (const r of results) {
        const key = `${r.studentId}_${r.subjectId}`;
        const prevScore = prevMap.get(key) as number | undefined;
        if (
          prevScore !== undefined &&
          prevScore - r.score >= prevScore * 0.25
        ) {
          alerts.push(
            `⚠ ${r.student.firstName} ${r.student.lastName} dropped ${(
              prevScore - r.score
            ).toFixed(0)} points in ${r.subject.name}`,
          );
        }
      }
    }

    const subjects = [...new Set(results.map((r) => r.subjectId))];
    for (const sid of subjects) {
      const subjectResults = results.filter((r) => r.subjectId === sid);
      const avg =
        subjectResults.reduce((sum, r) => sum + r.score, 0) /
        subjectResults.length;
      if (avg < 50)
        alerts.push(
          `⚠ Class average in ${subjectResults[0].subject.name} dropped below 50%`,
        );
    }

    return alerts;
  }

  async getPieChartData(schoolId: string, classId?: string) {
    const where: any = { schoolId };
    if (classId) {
      where.student = { enrollments: { some: { classId } } };
    }

    const results = await this.prisma.result.findMany({ where });

    const gradeDistribution: Record<string, number> = {};

    for (const r of results) {
      const grade = r.grade || 'Unknown';
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
        student: { enrollments: { some: { classId } } },
      };
      if (subjectId) where.subjectId = subjectId;

      const results = await this.prisma.result.findMany({ where });
      if (results.length > 0) {
        const avg =
          results.reduce((sum, r) => sum + r.score, 0) / results.length;
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
      const results = await this.prisma.result.findMany({
        where: {
          schoolId,
          termId,
          subjectId: subject.id,
          student: { enrollments: { some: { classId } } },
        },
      });

      if (results.length > 0) {
        const avg =
          results.reduce((sum, r) => sum + r.score, 0) / results.length;
        data.push({
          subject: subject.name,
          average: Number(avg.toFixed(2)),
          highest: Math.max(...results.map((r) => r.score)),
          lowest: Math.min(...results.map((r) => r.score)),
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
    const results = await this.prisma.result.findMany({
      where: {
        schoolId,
        termId,
        student: { enrollments: { some: { classId } } },
      },
    });

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
        (r) => result.score >= r.min && result.score <= r.max,
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

    const results = await this.prisma.computedResult.findMany({
      where: { schoolId, termId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, finalPercentage: { not: null }, isAbsent: false },
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
      where: { schoolId, termId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, finalPercentage: { not: null }, isAbsent: false },
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
      where: { schoolId, termId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] }, finalPercentage: { not: null }, isAbsent: false },
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
