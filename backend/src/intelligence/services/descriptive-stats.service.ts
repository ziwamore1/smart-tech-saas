import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DescriptiveStatsService {
  constructor(private prisma: PrismaService) {}

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private mode(values: number[]): number[] {
    const freq = new Map<number, number>();
    values.forEach(v => freq.set(v, (freq.get(v) || 0) + 1));
    const maxFreq = Math.max(...freq.values());
    return Array.from(freq.entries())
      .filter(([, f]) => f === maxFreq)
      .map(([v]) => v);
  }

  private variance(values: number[]): number {
    const m = this.mean(values);
    return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  }

  private stdDev(values: number[]): number {
    return Math.sqrt(this.variance(values));
  }

  private quartiles(values: number[]): { q1: number; q2: number; q3: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const q2 = this.median(sorted);
    const lower = sorted.slice(0, Math.floor(sorted.length / 2));
    const upper = sorted.slice(Math.ceil(sorted.length / 2));
    return { q1: this.median(lower), q2, q3: this.median(upper) };
  }

  private percentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
  }

  private zScore(value: number, mean: number, sd: number): number {
    return sd === 0 ? 0 : (value - mean) / sd;
  }

  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  async getStudentStats(schoolId: string, studentId: string) {
    const results = await this.prisma.result.findMany({
      where: { studentId, schoolId },
      include: { subject: true, term: { include: { academicYear: true } } },
    });

    if (!results.length) {
      return { error: 'No results found for this student' };
    }

    const scores = results.map(r => r.score);
    const avg = this.mean(scores);
    const sd = this.stdDev(scores);

    const allSchoolResults = await this.prisma.result.findMany({
      where: { schoolId },
    });
    const schoolMean = this.mean(allSchoolResults.map(r => r.score));
    const schoolSd = this.stdDev(allSchoolResults.map(r => r.score));
    const z = this.zScore(avg, schoolMean, schoolSd);

    return {
      studentId,
      descriptiveStats: {
        mean: Number(avg.toFixed(2)),
        median: Number(this.median(scores).toFixed(2)),
        mode: this.mode(scores),
        stdDev: Number(sd.toFixed(2)),
        variance: Number(this.variance(scores).toFixed(2)),
        quartiles: this.quartiles(scores),
        min: Math.min(...scores),
        max: Math.max(...scores),
        range: Math.max(...scores) - Math.min(...scores),
        count: scores.length,
      },
      comparativeStats: {
        schoolMean: Number(schoolMean.toFixed(2)),
        schoolStdDev: Number(schoolSd.toFixed(2)),
        studentMean: Number(avg.toFixed(2)),
        zScore: Number(z.toFixed(4)),
        percentile: Number((this.normalCDF(z) * 100).toFixed(2)),
        interpretation: this.interpretZScore(z),
      },
      subjectBreakdown: results.map(r => {
        const subjScores = results
          .filter(res => res.studentId === studentId)
          .map(res => res.score);
        const subjMean = this.mean(subjScores);
        return {
          subject: r.subject.name,
          score: r.score,
          deviation: Number((r.score - subjMean).toFixed(2)),
          grade: r.grade,
        };
      }),
    };
  }

  async getClassStats(schoolId: string, classId: string, termId: string) {
    const results = await this.prisma.result.findMany({
      where: {
        termId,
        schoolId,
        student: { enrollments: { some: { classId, status: 'ACTIVE' } } },
      },
      include: { student: true, subject: true },
    });

    if (!results.length) return { error: 'No results found' };

    const scores = results.map(r => r.score);
    const q = this.quartiles(scores);

    const bySubject: Record<string, number[]> = {};
    for (const r of results) {
      if (!bySubject[r.subjectId]) bySubject[r.subjectId] = [];
      bySubject[r.subjectId].push(r.score);
    }

    return {
      classStats: {
        mean: Number(this.mean(scores).toFixed(2)),
        median: Number(this.median(scores).toFixed(2)),
        stdDev: Number(this.stdDev(scores).toFixed(2)),
        variance: Number(this.variance(scores).toFixed(2)),
        q1: Number(q.q1.toFixed(2)),
        q3: Number(q.q3.toFixed(2)),
        iqr: Number((q.q3 - q.q1).toFixed(2)),
        min: Math.min(...scores),
        max: Math.max(...scores),
        range: Math.max(...scores) - Math.min(...scores),
        count: scores.length,
      },
      distribution: {
        p10: Number(this.percentile([...scores].sort((a, b) => a - b), 10).toFixed(2)),
        p25: Number(q.q1.toFixed(2)),
        p50: Number(q.q2.toFixed(2)),
        p75: Number(q.q3.toFixed(2)),
        p90: Number(this.percentile([...scores].sort((a, b) => a - b), 90).toFixed(2)),
      },
      subjectStats: Object.entries(bySubject).map(([subjectId, subjScores]) => ({
        subjectId,
        subjectName: results.find(r => r.subjectId === subjectId)?.subject.name,
        mean: Number(this.mean(subjScores).toFixed(2)),
        median: Number(this.median(subjScores).toFixed(2)),
        stdDev: Number(this.stdDev(subjScores).toFixed(2)),
        min: Math.min(...subjScores),
        max: Math.max(...subjScores),
      })),
      outliers: this.detectOutliers(scores).map(idx => ({
        student: results[idx].student,
        score: results[idx].score,
        subject: results[idx].subject.name,
      })),
    };
  }

  async getSchoolStats(schoolId: string, termId?: string) {
    const where: any = { schoolId };
    if (termId) where.termId = termId;

    const results = await this.prisma.result.findMany({
      where,
      include: { student: true, subject: true },
    });

    if (!results.length) return { error: 'No results found' };

    const scores = results.map(r => r.score);
    const q = this.quartiles(scores);
    const sorted = [...scores].sort((a, b) => a - b);

    const bySubject: Record<string, number[]> = {};
    for (const r of results) {
      if (!bySubject[r.subjectId]) bySubject[r.subjectId] = [];
      bySubject[r.subjectId].push(r.score);
    }

    return {
      schoolStats: {
        mean: Number(this.mean(scores).toFixed(2)),
        median: Number(this.median(scores).toFixed(2)),
        stdDev: Number(this.stdDev(scores).toFixed(2)),
        variance: Number(this.variance(scores).toFixed(2)),
        q1: Number(q.q1.toFixed(2)),
        q3: Number(q.q3.toFixed(2)),
        iqr: Number((q.q3 - q.q1).toFixed(2)),
        min: Math.min(...scores),
        max: Math.max(...scores),
        range: Math.max(...scores) - Math.min(...scores),
        count: scores.length,
        studentCount: new Set(results.map(r => r.studentId)).size,
      },
      distribution: {
        p10: Number(this.percentile(sorted, 10).toFixed(2)),
        p25: Number(q.q1.toFixed(2)),
        p50: Number(q.q2.toFixed(2)),
        p75: Number(q.q3.toFixed(2)),
        p90: Number(this.percentile(sorted, 90).toFixed(2)),
      },
      subjectStats: Object.entries(bySubject).map(([subjectId, subjScores]) => ({
        subjectId,
        subjectName: results.find(r => r.subjectId === subjectId)?.subject.name,
        mean: Number(this.mean(subjScores).toFixed(2)),
        median: Number(this.median(subjScores).toFixed(2)),
        stdDev: Number(this.stdDev(subjScores).toFixed(2)),
        min: Math.min(...subjScores),
        max: Math.max(...subjScores),
      })),
    };
  }

  async getZScoreAnalysis(schoolId: string, classId: string, termId: string) {
    const results = await this.prisma.result.findMany({
      where: {
        termId,
        schoolId,
        student: { enrollments: { some: { classId, status: 'ACTIVE' } } },
      },
      include: { student: true, subject: true },
    });

    if (!results.length) return { error: 'No results found' };

    const allScores = results.map(r => r.score);
    const globalMean = this.mean(allScores);
    const globalSd = this.stdDev(allScores);

    const studentAvgMap = new Map<string, { student: typeof results[0]['student']; scores: number[] }>();
    for (const r of results) {
      const entry = studentAvgMap.get(r.studentId) || { student: r.student, scores: [] };
      entry.scores.push(r.score);
      studentAvgMap.set(r.studentId, entry);
    }

    return Array.from(studentAvgMap.entries()).map(([id, data]) => {
      const avg = this.mean(data.scores);
      const z = this.zScore(avg, globalMean, globalSd);
      return {
        studentId: id,
        studentName: `${data.student.firstName} ${data.student.lastName}`,
        average: Number(avg.toFixed(2)),
        zScore: Number(z.toFixed(4)),
        percentile: Number((this.normalCDF(z) * 100).toFixed(2)),
        classification: this.classifyByZScore(z),
      };
    }).sort((a, b) => a.zScore - b.zScore);
  }

  async getHistogram(schoolId: string, classId: string, termId: string, bins: number = 10) {
    const results = await this.prisma.result.findMany({
      where: {
        termId,
        schoolId,
        student: { enrollments: { some: { classId, status: 'ACTIVE' } } },
      },
    });

    if (!results.length) return { error: 'No results found' };

    const scores = results.map(r => r.score);
    const min = 0;
    const max = 100;
    const binWidth = (max - min) / bins;
    const histogram = Array.from({ length: bins }, (_, i) => ({
      range: `${Math.round(min + i * binWidth)}-${Math.round(min + (i + 1) * binWidth)}`,
      count: 0,
      percentage: 0,
    }));

    for (const s of scores) {
      const binIndex = Math.min(Math.floor((s - min) / binWidth), bins - 1);
      histogram[binIndex].count++;
    }

    const total = scores.length;
    for (const bin of histogram) {
      bin.percentage = Number(((bin.count / total) * 100).toFixed(2));
    }

    const m = this.mean(scores);
    const sd = this.stdDev(scores);
    const curveData = histogram.map((bin, i) => {
      const binMid = min + (i + 0.5) * binWidth;
      const pdf = (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((binMid - m) / sd) ** 2);
      return { x: Number(binMid.toFixed(2)), density: Number((pdf * binWidth * total).toFixed(2)) };
    });

    return { histogram, normalCurve: curveData, mean: m, stdDev: sd, total };
  }

  private detectOutliers(values: number[]): number[] {
    const q = this.quartiles(values);
    const iqr = q.q3 - q.q1;
    const lower = q.q1 - 1.5 * iqr;
    const upper = q.q3 + 1.5 * iqr;
    return values.reduce<number[]>((acc, v, i) => {
      if (v < lower || v > upper) acc.push(i);
      return acc;
    }, []);
  }

  private interpretZScore(z: number): string {
    if (z > 2) return 'Exceptional performance significantly above average';
    if (z > 1) return 'Above average performance';
    if (z > -1) return 'Average performance within expected range';
    if (z > -2) return 'Below average performance requiring attention';
    return 'Critically below average performance requiring intervention';
  }

  private classifyByZScore(z: number): string {
    if (z >= 2) return 'EXCELLENT';
    if (z >= 1) return 'ABOVE_AVERAGE';
    if (z >= -1) return 'AVERAGE';
    if (z >= -2) return 'BELOW_AVERAGE';
    return 'CRITICAL';
  }
}
