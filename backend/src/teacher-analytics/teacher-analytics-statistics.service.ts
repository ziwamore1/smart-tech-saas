import { Injectable } from '@nestjs/common';
import {
  DistributionBand,
  GenderAnalysis,
  GradeDistribution,
  ScoreStats,
  Trend,
} from './teacher-analytics.types';

// ---------------------------------------------------------------------------
// Deterministic statistical helpers shared by the Teacher Analytics engine.
// All values are derived from the same authoritative computed results and use
// the same pass thresholds as the Results / Administrator Analytics modules.
// ---------------------------------------------------------------------------

export const PASS_THRESHOLD = 50;
export const DISTINCTION_THRESHOLD = 75;
export const AT_RISK_AVERAGE_THRESHOLD = 40;
export const TREND_SENSITIVITY = 3; // percentage points required to call a move meaningful

@Injectable()
export class TeacherAnalyticsStatisticsService {
  mean(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  sorted(values: number[]): number[] {
    return [...values].sort((a, b) => a - b);
  }

  median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = this.sorted(values);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  min(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.min(...values);
  }

  max(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.max(...values);
  }

  stdDev(values: number[], meanValue?: number | null): number | null {
    if (values.length === 0) return null;
    const meanVal = meanValue ?? this.mean(values) ?? 0;
    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - meanVal, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  percentile(sortedValues: number[], p: number): number | null {
    if (sortedValues.length === 0) return null;
    const idx = (sortedValues.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sortedValues[lower];
    return (sortedValues[lower] + sortedValues[upper]) / 2;
  }

  zScores(values: number[]): number[] {
    const meanVal = this.mean(values);
    const sd = this.stdDev(values, meanVal);
    if (meanVal == null || sd == null || sd === 0) return values.map(() => 0);
    return values.map((v) => (v - meanVal) / sd);
  }

  percentileRankFor(value: number, sortedValues: number[]): number | null {
    if (sortedValues.length === 0) return null;
    const below = sortedValues.filter((v) => v < value).length;
    return (below / sortedValues.length) * 100;
  }

  passRate(values: number[]): number | null {
    if (values.length === 0) return null;
    return (values.filter((v) => v >= PASS_THRESHOLD).length / values.length) * 100;
  }

  failRate(values: number[]): number | null {
    if (values.length === 0) return null;
    return (values.filter((v) => v < PASS_THRESHOLD).length / values.length) * 100;
  }

  distinctionRate(values: number[]): number | null {
    if (values.length === 0) return null;
    return (values.filter((v) => v >= DISTINCTION_THRESHOLD).length / values.length) * 100;
  }

  creditRate(values: number[]): number | null {
    if (values.length === 0) return null;
    return (
      (values.filter((v) => v >= PASS_THRESHOLD && v < DISTINCTION_THRESHOLD).length /
        values.length) *
      100
    );
  }

  scoreStats(values: number[]): ScoreStats {
    const meanValue = this.mean(values);
    return {
      count: values.length,
      average: this.round2(meanValue),
      median: this.round2(this.median(values)),
      highest: this.round2(this.max(values)),
      lowest: this.round2(this.min(values)),
      stdDev: this.round2(this.stdDev(values, meanValue)),
      passRate: this.round2(this.passRate(values)),
      failRate: this.round2(this.failRate(values)),
      distinctionRate: this.round2(this.distinctionRate(values)),
      creditRate: this.round2(this.creditRate(values)),
    };
  }

  distribution(values: number[]): DistributionBand[] {
    const bands: DistributionBand[] = [
      { label: '0-39%', min: 0, max: 39, count: 0, percentage: null },
      { label: '40-49%', min: 40, max: 49, count: 0, percentage: null },
      { label: '50-59%', min: 50, max: 59, count: 0, percentage: null },
      { label: '60-69%', min: 60, max: 69, count: 0, percentage: null },
      { label: '70-74%', min: 70, max: 74, count: 0, percentage: null },
      { label: '75-100%', min: 75, max: 100, count: 0, percentage: null },
    ];
    for (const v of values) {
      const band = bands.find((b) => v >= b.min && v <= b.max);
      if (band) band.count++;
    }
    for (const band of bands) {
      band.percentage = values.length ? this.round2((band.count / values.length) * 100) : null;
    }
    return bands;
  }

  gradeDistribution(values: Array<{ score: number | null; grade: string | null }>): GradeDistribution[] {
    const map = new Map<string, number>();
    for (const v of values) {
      const grade = v.grade || '(None)';
      map.set(grade, (map.get(grade) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([grade, count]) => ({
        grade,
        count,
        percentage: values.length ? this.round2((count / values.length) * 100) : null,
      }))
      .sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }));
  }

  trendLabel(delta: number | null): Trend {
    if (delta == null) return 'INSUFFICIENT_DATA';
    if (delta > TREND_SENSITIVITY) return 'IMPROVING';
    if (delta < -TREND_SENSITIVITY) return 'DECLINING';
    return 'STABLE';
  }

  genderGap(
    femaleAverage: number | null,
    maleAverage: number | null,
    femalePass: number | null,
    malePass: number | null,
  ): GenderAnalysis['gap'] {
    if (femaleAverage == null || maleAverage == null) {
      return { averageGap: null, passRateGap: null, classification: 'INSUFFICIENT_DATA', interpretation: null };
    }
    const averageGap = this.round2(maleAverage - femaleAverage);
    const passRateGap =
      femalePass != null && malePass != null ? this.round2(malePass - femalePass) : null;
    const avgGapAbs = Math.abs(averageGap);
    const classification =
      avgGapAbs <= 3
        ? 'NEGLIGIBLE_GAP'
        : avgGapAbs > 8
          ? 'SIGNIFICANT_GAP'
          : averageGap < 0
            ? 'FEMALE_ADVANTAGE'
            : 'MALE_ADVANTAGE';

    let interpretation: string | null;
    if (classification === 'NEGLIGIBLE_GAP') {
      interpretation = 'Male and female learners are performing at a comparable level. This suggests no material gender-linked gap in this class/subject.';
    } else if (classification === 'SIGNIFICANT_GAP') {
      const leader = averageGap < 0 ? 'female' : 'male';
      const leaderAvg = averageGap < 0 ? femaleAverage : maleAverage;
      interpretation = `A significant gap between gender groups exists: ${leader} learners average ${leaderAvg.toFixed(1)}%. This is a performance observation that warrants investigation into instructional support and engagement patterns — not an assumption about ability.`;
    } else {
      const leader = averageGap < 0 ? 'Female' : 'Male';
      interpretation = `${leader} learners hold a modest (${avgGapAbs.toFixed(1)} point) lead in average score. The gap is small enough to target with differentiated support for the lower-performing group.`;
    }

    return { averageGap, passRateGap, classification, interpretation };
  }

  qualityQuantity(
    participationRate: number | null,
    qualityRate: number | null,
  ): { quadrant: string; qualityScore: number | null; quantityScore: number | null; label: string } {
    const quadrants: Record<string, { quadrant: string; label: string }> = {
      HIGH_QUANTITY_HIGH_QUALITY: {
        quadrant: 'HIGH_QUANTITY_HIGH_QUALITY',
        label: 'Large assessment coverage with strong outcomes — the class is engaged and performing well.',
      },
      HIGH_QUANTITY_LOW_QUALITY: {
        quadrant: 'HIGH_QUANTITY_LOW_QUALITY',
        label: 'Many learners were assessed but outcomes are weak — the problem is instructional quality, not participation.',
      },
      LOW_QUANTITY_HIGH_QUALITY: {
        quadrant: 'LOW_QUANTITY_HIGH_QUALITY',
        label: 'The learners who were assessed performed well, but many did not participate — participation should be improved.',
      },
      LOW_QUANTITY_LOW_QUALITY: {
        quadrant: 'LOW_QUANTITY_LOW_QUALITY',
        label: 'Low participation combined with weak outcomes — both engagement and instruction need attention.',
      },
    };
    if (participationRate == null || qualityRate == null) {
      return { quadrant: 'LOW_QUANTITY_LOW_QUALITY', qualityScore: qualityRate, quantityScore: participationRate, label: 'Insufficient data to classify quantity vs quality.' };
    }
    const highQuantity = participationRate >= 75;
    const highQuality = qualityRate >= 60;
    const key = `${highQuantity ? 'HIGH' : 'LOW'}_QUANTITY_${highQuality ? 'HIGH' : 'LOW'}_QUALITY`;
    return {
      quadrant: key as any,
      qualityScore: this.round2(qualityRate),
      quantityScore: this.round2(participationRate),
      label: quadrants[key].label,
    };
  }

  round(value: number, decimals = 2): number {
    return Number(value.toFixed(decimals));
  }

  round2(value: number | null): number | null {
    return value == null ? null : Number(value.toFixed(2));
  }
}