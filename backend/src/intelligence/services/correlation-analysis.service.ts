import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CorrelationAnalysisService {
  constructor(private prisma: PrismaService) {}

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;
    const xMean = this.mean(x.slice(0, n));
    const yMean = this.mean(y.slice(0, n));
    const num = x.slice(0, n).reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0);
    const denX = x.slice(0, n).reduce((sum, xi) => sum + (xi - xMean) ** 2, 0);
    const denY = y.slice(0, n).reduce((sum, yi, i) => sum + (yi - yMean) ** 2, 0);
    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
  }

  private spearmanCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;
    const rank = (arr: number[]): number[] => {
      const sorted = [...arr].sort((a, b) => a - b);
      return arr.map(v => sorted.indexOf(v) + 1);
    };
    return this.pearsonCorrelation(rank(x.slice(0, n)), rank(y.slice(0, n)));
  }

  private interpretCorrelation(r: number): { strength: string; direction: string } {
    const abs = Math.abs(r);
    const direction = r >= 0 ? 'positive' : 'negative';
    let strength = 'none';
    if (abs >= 0.8) strength = 'very_strong';
    else if (abs >= 0.6) strength = 'strong';
    else if (abs >= 0.4) strength = 'moderate';
    else if (abs >= 0.2) strength = 'weak';
    else if (abs > 0) strength = 'very_weak';
    return { strength, direction };
  }

  async getSubjectCorrelation(schoolId: string, classId: string, termId: string) {
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId, classSubjects: { some: { classId } } },
    });

    if (subjects.length < 2) return { error: 'Need at least 2 subjects for correlation' };

    const students = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });
    const studentIds = students.map(s => s.studentId);

    const results = await this.prisma.result.findMany({
      where: { studentId: { in: studentIds }, termId, schoolId },
    });

    const matrix: Array<{ subject1: string; subject2: string; r: number; interpretation: any }> = [];
    for (let i = 0; i < subjects.length; i++) {
      for (let j = i + 1; j < subjects.length; j++) {
        const pairs = studentIds.map(sid => {
          const s1 = results.find(r => r.studentId === sid && r.subjectId === subjects[i].id);
          const s2 = results.find(r => r.studentId === sid && r.subjectId === subjects[j].id);
          return s1 && s2 ? { x: s1.score, y: s2.score } : null;
        }).filter(Boolean) as { x: number; y: number }[];

        if (pairs.length >= 3) {
          const x = pairs.map(p => p.x);
          const y = pairs.map(p => p.y);
          const r = this.pearsonCorrelation(x, y);
          matrix.push({
            subject1: subjects[i].name,
            subject2: subjects[j].name,
            r: Number(r.toFixed(4)),
            interpretation: this.interpretCorrelation(r),
          });
        }
      }
    }

    return {
      correlationMatrix: matrix,
      insights: this.generateCorrelationInsights(matrix),
    };
  }

  async getAttendancePerformanceCorrelation(schoolId: string, classId: string, termId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });
    const studentIds = enrollments.map(e => e.studentId);

    const [results, attendanceRecords] = await Promise.all([
      this.prisma.result.findMany({
        where: { studentId: { in: studentIds }, termId, schoolId },
      }),
      this.prisma.attendance.findMany({
        where: { studentId: { in: studentIds }, schoolId },
      }),
    ]);

    const studentData = studentIds.map(sid => {
      const studentResults = results.filter(r => r.studentId === sid);
      const studentAttendance = attendanceRecords.filter(a => a.studentId === sid);
      const avgScore = studentResults.length ? this.mean(studentResults.map(r => r.score)) : 0;
      const totalClasses = studentAttendance.length;
      const attended = studentAttendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attendanceRate = totalClasses ? (attended / totalClasses) * 100 : 0;
      return { studentId: sid, avgScore, attendanceRate };
    }).filter(d => d.avgScore > 0 && d.attendanceRate > 0);

    if (studentData.length < 3) return { error: 'Insufficient data for correlation' };

    const scores = studentData.map(d => d.avgScore);
    const rates = studentData.map(d => d.attendanceRate);
    const r = this.pearsonCorrelation(scores, rates);

    return {
      correlation: {
        r: Number(r.toFixed(4)),
        interpretation: this.interpretCorrelation(r),
        pairs: studentData.length,
      },
      scatterData: studentData.map(d => ({
        studentId: d.studentId,
        attendanceRate: Number(d.attendanceRate.toFixed(2)),
        averageScore: Number(d.avgScore.toFixed(2)),
      })),
      insight: r > 0.3
        ? 'Higher attendance correlates with better performance'
        : r < -0.3
          ? 'Lower attendance correlates with better performance (unexpected)'
          : 'No significant correlation between attendance and performance',
    };
  }

  async getTeacherEffectiveness(schoolId: string, termId: string) {
    const results = await this.prisma.result.findMany({
      where: { termId, schoolId },
      include: { teacher: true, subject: true },
    });

    const teacherMap = new Map<string, { teacherName: string; scores: number[]; subject: string }>();
    for (const r of results) {
      const existing = teacherMap.get(r.teacherId);
      if (existing) {
        existing.scores.push(r.score);
      } else {
        teacherMap.set(r.teacherId, {
          teacherName: `${r.teacher.firstName} ${r.teacher.lastName}`,
          scores: [r.score],
          subject: r.subject.name,
        });
      }
    }

    const allScores = results.map(r => r.score);
    const globalMean = this.mean(allScores);
    const globalSd = Math.sqrt(this.variance(allScores));

    return Array.from(teacherMap.entries()).map(([id, data]) => {
      const avg = this.mean(data.scores);
      const sd = Math.sqrt(this.variance(data.scores));
      return {
        teacherId: id,
        teacherName: data.teacherName,
        subject: data.subject,
        studentCount: data.scores.length,
        averageScore: Number(avg.toFixed(2)),
        stdDev: Number(sd.toFixed(2)),
        effectSize: Number(((avg - globalMean) / (globalSd || 1)).toFixed(4)),
        rating: this.rateTeacherEffectiveness(avg, globalMean, globalSd),
      };
    }).sort((a, b) => b.effectSize - a.effectSize);
  }

  async getSubjectClusters(schoolId: string, classId: string, termId: string) {
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId, classSubjects: { some: { classId } } },
    });

    const students = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const results = await this.prisma.result.findMany({
      where: { studentId: { in: students.map(s => s.studentId) }, termId, schoolId },
    });

    const matrix: Record<string, Record<string, number>> = {};
    for (const s1 of subjects) {
      for (const s2 of subjects) {
        if (s1.id === s2.id) continue;
        const pairs = students.map(s => {
          const r1 = results.find(r => r.studentId === s.studentId && r.subjectId === s1.id);
          const r2 = results.find(r => r.studentId === s.studentId && r.subjectId === s2.id);
          return r1 && r2 ? { x: r1.score, y: r2.score } : null;
        }).filter(Boolean) as { x: number; y: number }[];

        if (pairs.length >= 5) {
          if (!matrix[s1.name]) matrix[s1.name] = {};
          matrix[s1.name][s2.name] = Number(
            this.pearsonCorrelation(pairs.map(p => p.x), pairs.map(p => p.y)).toFixed(4),
          );
        }
      }
    }

    const clusterInsights: Array<{ group: string[]; avgCorrelation: number; interpretation: string }> = [];
    const subjectNames = subjects.map(s => s.name);
    for (let i = 0; i < subjectNames.length; i++) {
      for (let j = i + 1; j < subjectNames.length; j++) {
        const r = matrix[subjectNames[i]]?.[subjectNames[j]] || 0;
        if (Math.abs(r) > 0.6) {
          clusterInsights.push({
            group: [subjectNames[i], subjectNames[j]],
            avgCorrelation: r,
            interpretation: r > 0
              ? `Students who excel in ${subjectNames[i]} tend to excel in ${subjectNames[j]}`
              : `Students who excel in ${subjectNames[i]} tend to struggle in ${subjectNames[j]}`,
          });
        }
      }
    }

    return { correlationMatrix: matrix, strongClusters: clusterInsights };
  }

  private variance(values: number[]): number {
    const m = this.mean(values);
    return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  }

  private rateTeacherEffectiveness(avg: number, globalMean: number, globalSd: number): string {
    const diff = avg - globalMean;
    if (diff > globalSd * 0.5) return 'HIGH';
    if (diff > 0) return 'ABOVE_AVERAGE';
    if (diff > -globalSd * 0.5) return 'AVERAGE';
    return 'NEEDS_IMPROVEMENT';
  }

  private generateCorrelationInsights(matrix: Array<{ subject1: string; subject2: string; r: number; interpretation: any }>): string[] {
    const insights: string[] = [];
    const strong = matrix.filter(m => Math.abs(m.r) >= 0.6);
    for (const s of strong) {
      if (s.r > 0) {
        insights.push(`Strong positive correlation: ${s.subject1} ↔ ${s.subject2} (r=${s.r.toFixed(2)}). Students performing well in ${s.subject1} also excel in ${s.subject2}.`);
      } else {
        insights.push(`Strong negative correlation: ${s.subject1} ↔ ${s.subject2} (r=${s.r.toFixed(2)}). Higher performance in ${s.subject1} is associated with lower performance in ${s.subject2}.`);
      }
    }
    if (!strong.length) {
      insights.push('No strong correlations found between subjects. Performance patterns are subject-specific.');
    }
    return insights;
  }
}
