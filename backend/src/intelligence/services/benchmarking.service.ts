import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BenchmarkingService {
  constructor(private prisma: PrismaService) {}

  async compareWithNational(schoolId: string, subjectId: string, termId: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term) return { error: 'Term not found' };

    const schoolResults = await this.prisma.result.findMany({
      where: { schoolId, subjectId, termId },
    });

    if (!schoolResults.length) return { error: 'No results for this subject/term' };

    const schoolAvg = schoolResults.reduce((a, b) => a + b.score, 0) / schoolResults.length;
    const schoolPassRate = (schoolResults.filter(r => r.score >= 50).length / schoolResults.length) * 100;

    const benchmarks = await this.prisma.nationalBenchmark.findMany({
      where: { subjectId },
      orderBy: { year: 'desc' },
    });

    const latest = benchmarks[0] || null;

    if (!latest) {
      return {
        subjectId,
        school: {
          average: Number(schoolAvg.toFixed(2)),
          passRate: Number(schoolPassRate.toFixed(2)),
          studentCount: schoolResults.length,
          stdDev: this.stdDev(schoolResults.map(r => r.score)),
        },
        benchmark: null,
        comparison: null,
        message: 'No national benchmark data available. Add benchmarks via the benchmarks endpoint.',
      };
    }

    const diff = schoolAvg - latest.average;
    const pctAbove = ((diff / latest.average) * 100);

    return {
      subjectId,
      school: {
        average: Number(schoolAvg.toFixed(2)),
        passRate: Number(schoolPassRate.toFixed(2)),
        studentCount: schoolResults.length,
        stdDev: Number(this.stdDev(schoolResults.map(r => r.score)).toFixed(2)),
      },
      benchmark: {
        nationalAverage: latest.average,
        nationalPassRate: latest.passRate,
        nationalStdDev: latest.stdDev,
        year: latest.year,
        source: latest.source,
        region: latest.region,
      },
      comparison: {
        gap: Number(diff.toFixed(2)),
        percentageAbove: Number(pctAbove.toFixed(2)),
        aboveNational: diff > 0,
        performanceLevel: this.ratePerformance(diff, latest.stdDev || 0),
        percentileRank: this.estimatePercentile(schoolAvg, latest.average, latest.stdDev || 15),
      },
    };
  }

  async getMultiSubjectBenchmark(schoolId: string, classId: string, termId: string) {
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId, classSubjects: { some: { classId } } },
    });

    const results = [];
    for (const subject of subjects) {
      const comparison = await this.compareWithNational(schoolId, subject.id, termId);
      if (!comparison.error) {
        results.push({
          subject: subject.name,
          subjectId: subject.id,
          schoolAverage: comparison.school?.average,
          nationalAverage: comparison.benchmark?.nationalAverage,
          gap: comparison.comparison?.gap,
          performanceLevel: comparison.comparison?.performanceLevel,
        });
      }
    }

    const above = results.filter(r => r.gap > 0).length;
    const below = results.filter(r => r.gap < 0).length;

    return {
      subjects: results.sort((a, b) => (b.gap || 0) - (a.gap || 0)),
      summary: {
        totalSubjects: results.length,
        aboveNational: above,
        belowNational: below,
        overall: above >= below ? 'ABOVE_NATIONAL' : 'BELOW_NATIONAL',
      },
    };
  }

  async addBenchmark(
    subjectId: string,
    year: number,
    average: number,
    options?: {
      stdDev?: number; passRate?: number; median?: number;
      schoolType?: string; region?: string; source?: string; termName?: string;
    },
  ) {
    const existing = await this.prisma.nationalBenchmark.findFirst({
      where: { subjectId, year, termName: options?.termName || null },
    });

    if (existing) {
      return this.prisma.nationalBenchmark.update({
        where: { id: existing.id },
        data: {
          average,
          stdDev: options?.stdDev,
          passRate: options?.passRate,
          median: options?.median,
          schoolType: options?.schoolType,
          region: options?.region,
          source: options?.source,
        },
      });
    }

    return this.prisma.nationalBenchmark.create({
      data: {
        subjectId,
        year,
        termName: options?.termName,
        average,
        stdDev: options?.stdDev,
        passRate: options?.passRate,
        median: options?.median,
        schoolType: options?.schoolType,
        region: options?.region,
        source: options?.source,
      },
    });
  }

  async getBenchmarkTrends(subjectId: string) {
    const benchmarks = await this.prisma.nationalBenchmark.findMany({
      where: { subjectId },
      orderBy: { year: 'asc' },
    });

    if (!benchmarks.length) return { error: 'No benchmark data' };

    const years = benchmarks.map(b => b.year);
    const averages = benchmarks.map(b => b.average);
    const changes: number[] = [];
    for (let i = 1; i < averages.length; i++) {
      changes.push(Number(((averages[i] - averages[i - 1]) / averages[i - 1] * 100).toFixed(2)));
    }

    return {
      subjectId,
      trends: benchmarks.map(b => ({
        year: b.year,
        average: b.average,
        passRate: b.passRate,
        stdDev: b.stdDev,
        source: b.source,
      })),
      yearOverYearChange: changes,
      overallDirection: changes.filter(c => c > 0).length > changes.filter(c => c < 0).length ? 'IMPROVING' : 'DECLINING',
    };
  }

  async getSchoolBenchmarkDashboard(schoolId: string, termId: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term) return { error: 'Term not found' };

    const subjects = await this.prisma.subject.findMany({ where: { schoolId } });
    const results = [];

    for (const subject of subjects) {
      const comp = await this.compareWithNational(schoolId, subject.id, termId);
      if (!comp.error) {
        results.push({
          subject: subject.name,
          schoolAverage: comp.school?.average,
          nationalAverage: comp.benchmark?.nationalAverage,
          gap: comp.comparison?.gap,
          percentileRank: comp.comparison?.percentileRank,
        });
      }
    }

    const avgGap = results.reduce((s, r) => s + (r.gap || 0), 0) / (results.length || 1);

    return {
      term: `${term.name} ${term.academicYear.name}`,
      totalSubjects: results.length,
      averageGap: Number(avgGap.toFixed(2)),
      overallRating: avgGap > 5 ? 'EXCELLENT' : avgGap > 0 ? 'GOOD' : avgGap > -5 ? 'FAIR' : 'NEEDS_IMPROVEMENT',
      subjectComparisons: results.sort((a, b) => (b.gap || 0) - (a.gap || 0)),
      recommendations: this.generateBenchmarkRecommendations(results),
    };
  }

  private stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const m = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
  }

  private ratePerformance(diff: number, nationalStdDev: number): string {
    const ratio = nationalStdDev > 0 ? diff / nationalStdDev : diff / 10;
    if (ratio > 1) return 'WELL_ABOVE_NATIONAL';
    if (ratio > 0.25) return 'ABOVE_NATIONAL';
    if (ratio > -0.25) return 'AT_NATIONAL';
    if (ratio > -1) return 'BELOW_NATIONAL';
    return 'WELL_BELOW_NATIONAL';
  }

  private estimatePercentile(schoolAvg: number, nationalAvg: number, stdDev: number): number {
    const z = (schoolAvg - nationalAvg) / stdDev;
    return Math.round(this.normalCDF(z) * 100);
  }

  private normalCDF(x: number): number {
    const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + p * x);
    let y = 1 - (((((a[4] * t + a[3]) * t + a[2]) * t + a[1]) * t + a[0]) * t * Math.exp(-x * x));
    return 0.5 * (1 + sign * y);
  }

  private generateBenchmarkRecommendations(results: any[]): string[] {
    const recs: string[] = [];
    const below = results.filter(r => r.gap < -5);
    const above = results.filter(r => r.gap > 5);

    if (below.length > 0) {
      recs.push(`Priority improvement needed in: ${below.map(r => r.subject).join(', ')}. These subjects are significantly below national averages.`);
    }
    if (above.length > 0) {
      recs.push(`Strong performance in: ${above.map(r => r.subject).join(', ')}. Consider sharing best practices from these subjects.`);
    }
    if (recs.length === 0) {
      recs.push('School performance is aligned with national averages across all subjects.');
    }
    return recs;
  }
}
