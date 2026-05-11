import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TrendAnalysisService {
  constructor(private prisma: PrismaService) {}

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  async getStudentGrowthTrajectory(schoolId: string, studentId: string) {
    const results = await this.prisma.result.findMany({
      where: { studentId, schoolId },
      include: { term: { include: { academicYear: true } }, subject: true },
      orderBy: [{ term: { academicYear: { startDate: 'asc' } } }, { term: { startDate: 'asc' } }],
    });

    if (!results.length) return { error: 'No results found' };

    const termMap = new Map<string, { termName: string; scores: number[]; subjects: any[] }>();
    for (const r of results) {
      const key = r.termId;
      const existing = termMap.get(key) || {
        termName: `${r.term.name} ${r.term.academicYear.name}`,
        scores: [],
        subjects: [],
      };
      existing.scores.push(r.score);
      existing.subjects.push({ subject: r.subject.name, score: r.score });
      termMap.set(key, existing);
    }

    const terms = Array.from(termMap.entries()).map(([id, t]) => ({
      termId: id,
      termName: t.termName,
      average: Number(this.mean(t.scores).toFixed(2)),
      subjects: t.subjects,
    }));

    const averages = terms.map(t => t.average);
    const growthRates: number[] = [];
    for (let i = 1; i < averages.length; i++) {
      growthRates.push(Number(((averages[i] - averages[i - 1]) / averages[i - 1] * 100).toFixed(2)));
    }

    const direction = this.determineDirection(averages);
    const regression = this.linearRegression(Array.from({ length: averages.length }, (_, i) => i), averages);

    return {
      studentId,
      trajectory: terms,
      growthRates,
      overallTrend: {
        direction,
        slope: Number(regression.slope.toFixed(4)),
        intercept: Number(regression.intercept.toFixed(2)),
        rSquared: Number(regression.rSquared.toFixed(4)),
        interpretation: this.interpretTrend(direction, regression.slope),
      },
      classification: this.classifyTrajectory(averages, growthRates),
    };
  }

  async getSubjectTrend(schoolId: string, classId: string, subjectId: string) {
    const terms = await this.prisma.term.findMany({
      where: { academicYear: { schoolId } },
      orderBy: [{ academicYear: { startDate: 'asc' } }, { startDate: 'asc' }],
      include: { academicYear: true },
    });

    const dataPoints = [];
    for (const term of terms) {
      const results = await this.prisma.result.findMany({
        where: {
          termId: term.id,
          subjectId,
          schoolId,
          student: { enrollments: { some: { classId, status: 'ACTIVE' } } },
        },
      });
      if (results.length) {
        const avg = this.mean(results.map(r => r.score));
        dataPoints.push({
          termId: term.id,
          termName: `${term.name} ${term.academicYear.name}`,
          average: Number(avg.toFixed(2)),
          studentCount: results.length,
        });
      }
    }

    const averages = dataPoints.map(d => d.average);
    const indices = Array.from({ length: averages.length }, (_, i) => i);
    const regression = this.linearRegression(indices, averages);

    let classification = 'STABLE';
    if (regression.slope > 2) classification = 'IMPROVING_FAST';
    else if (regression.slope > 0.5) classification = 'IMPROVING';
    else if (regression.slope < -2) classification = 'DECLINING_FAST';
    else if (regression.slope < -0.5) classification = 'DECLINING';

    return {
      subjectId,
      dataPoints,
      trend: {
        slope: Number(regression.slope.toFixed(4)),
        intercept: Number(regression.intercept.toFixed(2)),
        rSquared: Number(regression.rSquared.toFixed(4)),
        classification,
        predictedNext: averages.length > 0
          ? Number((regression.slope * averages.length + regression.intercept).toFixed(2))
          : null,
      },
      movingAverage: this.movingAverage(averages, 3),
    };
  }

  async getClassComparisonTrend(schoolId: string, classId: string) {
    const terms = await this.prisma.term.findMany({
      where: { academicYear: { schoolId } },
      orderBy: [{ academicYear: { startDate: 'asc' } }, { startDate: 'asc' }],
      include: { academicYear: true },
    });

    const subjects = await this.prisma.subject.findMany({
      where: { schoolId, classSubjects: { some: { classId } } },
    });

    const trendData = [];
    for (const subject of subjects) {
      const dataPoints = [];
      for (const term of terms) {
        const results = await this.prisma.result.findMany({
          where: {
            termId: term.id,
            subjectId: subject.id,
            schoolId,
            student: { enrollments: { some: { classId, status: 'ACTIVE' } } },
          },
        });
        if (results.length) {
          dataPoints.push({
            termName: `${term.name} ${term.academicYear.name}`,
            average: Number(this.mean(results.map(r => r.score)).toFixed(2)),
          });
        }
      }
      if (dataPoints.length >= 2) {
        const averages = dataPoints.map(d => d.average);
        const indices = Array.from({ length: averages.length }, (_, i) => i);
        const regression = this.linearRegression(indices, averages);
        trendData.push({
          subjectId: subject.id,
          subjectName: subject.name,
          dataPoints,
          slope: Number(regression.slope.toFixed(4)),
          direction: regression.slope > 0 ? 'up' : 'down',
        });
      }
    }

    return trendData;
  }

  async getLongitudinalStudentReport(schoolId: string, studentId: string) {
    const [trajectory, records] = await Promise.all([
      this.getStudentGrowthTrajectory(schoolId, studentId),
      this.prisma.studentGrowthRecord.findMany({
        where: { studentId, schoolId },
        orderBy: { term: { startDate: 'asc' } },
        include: { term: { include: { academicYear: true } } },
      }),
    ]);

    const results = await this.prisma.result.findMany({
      where: { studentId, schoolId },
      include: { subject: true, term: { include: { academicYear: true } } },
      orderBy: [{ term: { academicYear: { startDate: 'asc' } } }, { term: { startDate: 'asc' } }],
    });

    const subjectProgress: Record<string, { subjectName: string; scores: { term: string; score: number }[] }> = {};
    for (const r of results) {
      if (!subjectProgress[r.subjectId]) {
        subjectProgress[r.subjectId] = { subjectName: r.subject.name, scores: [] };
      }
      subjectProgress[r.subjectId].scores.push({
        term: `${r.term.name} ${r.term.academicYear.name}`,
        score: r.score,
      });
    }

    return {
      studentId,
      trajectory,
      growthRecords: records,
      subjectProgress: Object.values(subjectProgress),
      summary: this.generateLongitudinalSummary(trajectory, records),
    };
  }

  private linearRegression(x: number[], y: number[]) {
    const n = x.length;
    const xMean = this.mean(x);
    const yMean = this.mean(y);
    const num = x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0);
    const den = x.reduce((sum, xi) => sum + (xi - xMean) ** 2, 0);
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;

    const yPred = x.map(xi => slope * xi + intercept);
    const ssRes = y.reduce((sum, yi, i) => sum + (yi - yPred[i]) ** 2, 0);
    const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return { slope, intercept, rSquared };
  }

  private movingAverage(values: number[], window: number): number[] {
    if (values.length < window) return [];
    const result: number[] = [];
    for (let i = window - 1; i < values.length; i++) {
      const slice = values.slice(i - window + 1, i + 1);
      result.push(Number(this.mean(slice).toFixed(2)));
    }
    return result;
  }

  private determineDirection(values: number[]): string {
    if (values.length < 2) return 'insufficient_data';
    const first = values[0];
    const last = values[values.length - 1];
    const pctChange = ((last - first) / first) * 100;
    if (pctChange > 10) return 'strong_upward';
    if (pctChange > 3) return 'upward';
    if (pctChange < -10) return 'strong_downward';
    if (pctChange < -3) return 'downward';
    return 'stable';
  }

  private interpretTrend(direction: string, slope: number): string {
    switch (direction) {
      case 'strong_upward': return 'Student is showing strong and consistent improvement';
      case 'upward': return 'Student is gradually improving';
      case 'stable': return 'Student performance is stable with no significant change';
      case 'downward': return 'Student performance is declining and needs attention';
      case 'strong_downward': return 'Student performance is critically declining and requires urgent intervention';
      default: return 'Insufficient data to determine trend';
    }
  }

  private classifyTrajectory(averages: number[], growthRates: number[]): string {
    if (averages.length < 2) return 'INSUFFICIENT_DATA';
    const recentGrowth = growthRates.slice(-2);
    const avgRecentGrowth = this.mean(recentGrowth);
    const current = averages[averages.length - 1];

    if (current >= 80 && avgRecentGrowth >= 0) return 'EXCELLENT';
    if (avgRecentGrowth > 5) return 'IMPROVING_FAST';
    if (avgRecentGrowth > 0) return 'IMPROVING';
    if (avgRecentGrowth > -5) return 'STABLE';
    if (avgRecentGrowth > -10) return 'DECLINING';
    return 'CRITICAL';
  }

  private generateLongitudinalSummary(trajectory: any, records: any[]): string {
    if ('error' in trajectory) return 'Insufficient data for longitudinal analysis';
    const trend = trajectory.overallTrend;
    const terms = trajectory.trajectory?.length || 0;
    return `Tracked across ${terms} terms. ${trend.interpretation}. Growth rate: ${trend.slope > 0 ? '+' : ''}${trend.slope.toFixed(2)}% per term.`;
  }
}
