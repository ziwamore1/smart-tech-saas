import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PsychometricAnalysisService {
  constructor(private prisma: PrismaService) {}

  async getItemAnalysis(schoolId: string, examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId, schoolId },
      include: {
        questions: { orderBy: { order: 'asc' } },
        attempts: {
          where: { isSubmitted: true },
          include: { answers: true },
        },
      },
    });

    if (!exam) return { error: 'Exam not found' };
    if (!exam.attempts.length) return { error: 'No submitted attempts' };

    const totalStudents = exam.attempts.length;
    const totalScore = exam.totalScore || 100;
    const scores = exam.attempts.map(a => a.score || 0).sort((a, b) => b - a);

    const top27 = scores.slice(0, Math.max(1, Math.ceil(totalStudents * 0.27)));
    const bottom27 = scores.slice(-Math.max(1, Math.ceil(totalStudents * 0.27)));
    const topThreshold = top27[top27.length - 1] || 0;
    const bottomThreshold = bottom27[0] || 0;

    const itemAnalysis = exam.questions.map(q => {
      const answers = exam.attempts.map(a =>
        a.answers.find(ans => ans.questionId === q.id),
      ).filter(Boolean);

      const correctCount = answers.filter(a => a.isCorrect).length;
      const difficulty = answers.length > 0 ? correctCount / answers.length : 0;

      const topCorrect = answers.filter(a => {
        const attempt = exam.attempts.find(at => at.id === a.attemptId);
        return attempt && (attempt.score || 0) >= topThreshold && a.isCorrect;
      }).length;

      const bottomCorrect = answers.filter(a => {
        const attempt = exam.attempts.find(at => at.id === a.attemptId);
        return attempt && (attempt.score || 0) <= bottomThreshold && a.isCorrect;
      }).length;

      const topCount = answers.filter(a => {
        const attempt = exam.attempts.find(at => at.id === a.attemptId);
        return attempt && (attempt.score || 0) >= topThreshold;
      }).length;

      const bottomCount = answers.filter(a => {
        const attempt = exam.attempts.find(at => at.id === a.attemptId);
        return attempt && (attempt.score || 0) <= bottomThreshold;
      }).length;

      const discrimination = topCount > 0 && bottomCount > 0
        ? (topCorrect / topCount) - (bottomCorrect / bottomCount)
        : 0;

      const pointBiserial = this.pointBiserialCorrelation(
        answers.map(a => a.isCorrect ? 1 : 0),
        answers.map(a => {
          const attempt = exam.attempts.find(at => at.id === a.attemptId);
          return attempt ? (attempt.score || 0) : 0;
        }),
      );

      return {
        questionId: q.id,
        questionNumber: q.order,
        questionType: q.questionType,
        difficulty: Number(difficulty.toFixed(4)),
        difficultyLabel: this.labelDifficulty(difficulty),
        discrimination: Number(discrimination.toFixed(4)),
        discriminationLabel: this.labelDiscrimination(discrimination),
        pointBiserial: Number(pointBiserial.toFixed(4)),
        correctCount,
        totalResponses: answers.length,
        maxScore: q.score,
      };
    });

    const reliability = this.cronbachAlpha(exam.questions, exam.attempts);

    return {
      examId: exam.title,
      examType: exam.type,
      totalStudents,
      totalQuestions: exam.questions.length,
      averageScore: Number((scores.reduce((a, b) => a + b, 0) / totalStudents).toFixed(2)),
      reliability: {
        cronbachAlpha: Number(reliability.toFixed(4)),
        quality: this.rateReliability(reliability),
      },
      items: itemAnalysis,
      summary: {
        averageDifficulty: Number((itemAnalysis.reduce((s, i) => s + i.difficulty, 0) / itemAnalysis.length).toFixed(4)),
        averageDiscrimination: Number((itemAnalysis.reduce((s, i) => s + i.discrimination, 0) / itemAnalysis.length).toFixed(4)),
        difficultQuestions: itemAnalysis.filter(i => i.difficulty < 0.3).length,
        easyQuestions: itemAnalysis.filter(i => i.difficulty > 0.85).length,
        poorDiscrimination: itemAnalysis.filter(i => i.discrimination < 0.2).length,
        goodDiscrimination: itemAnalysis.filter(i => i.discrimination >= 0.3).length,
      },
      recommendations: this.generatePsychometricRecommendations(itemAnalysis, reliability),
    };
  }

  async getExamReliability(schoolId: string, examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId, schoolId },
      include: {
        questions: true,
        attempts: {
          where: { isSubmitted: true },
          include: { answers: true },
        },
      },
    });

    if (!exam) return { error: 'Exam not found' };

    const alpha = this.cronbachAlpha(exam.questions, exam.attempts);
    const splitHalf = this.splitHalfReliability(exam.questions, exam.attempts);

    return {
      examId: exam.title,
      cronbachAlpha: Number(alpha.toFixed(4)),
      splitHalfReliability: Number(splitHalf.toFixed(4)),
      quality: this.rateReliability(alpha),
      interpretation: this.interpretReliability(alpha),
      studentCount: exam.attempts.length,
      questionCount: exam.questions.length,
    };
  }

  async getDifficultyDistribution(schoolId: string, examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId, schoolId },
      include: {
        questions: true,
        attempts: {
          where: { isSubmitted: true },
          include: { answers: true },
        },
      },
    });

    if (!exam) return { error: 'Exam not found' };

    const itemDifficulties = exam.questions.map(q => {
      const answers = exam.attempts.flatMap(a =>
        a.answers.filter(ans => ans.questionId === q.id),
      );
      const correct = answers.filter(a => a.isCorrect).length;
      return {
        questionId: q.id,
        questionNumber: q.order,
        difficulty: answers.length > 0 ? correct / answers.length : 0,
        discrimination: 0,
      };
    });

    const bands = [
      { label: 'Very Hard (0-0.2)', min: 0, max: 0.2, count: 0 },
      { label: 'Hard (0.2-0.4)', min: 0.2, max: 0.4, count: 0 },
      { label: 'Moderate (0.4-0.6)', min: 0.4, max: 0.6, count: 0 },
      { label: 'Easy (0.6-0.8)', min: 0.6, max: 0.8, count: 0 },
      { label: 'Very Easy (0.8-1.0)', min: 0.8, max: 1.0, count: 0 },
    ];

    for (const item of itemDifficulties) {
      const band = bands.find(b => item.difficulty >= b.min && item.difficulty <= b.max);
      if (band) band.count++;
    }

    const avgDifficulty = itemDifficulties.reduce((s, i) => s + i.difficulty, 0) / itemDifficulties.length;

    return {
      examId: exam.title,
      totalQuestions: exam.questions.length,
      averageDifficulty: Number(avgDifficulty.toFixed(4)),
      distribution: bands,
      assessment: avgDifficulty < 0.3 ? 'DIFFICULT' : avgDifficulty < 0.5 ? 'MODERATELY_DIFFICULT' : avgDifficulty < 0.7 ? 'MODERATELY_EASY' : 'EASY',
      recommendation: avgDifficulty < 0.3
        ? 'Exam may be too difficult. Consider reviewing questions and adjusting difficulty.'
        : avgDifficulty > 0.8
          ? 'Exam may be too easy. Consider adding more challenging questions.'
          : 'Difficulty distribution is reasonable.',
    };
  }

  async getScoreDistributionAnalysis(schoolId: string, examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId, schoolId },
      include: {
        attempts: {
          where: { isSubmitted: true },
          include: { student: true },
        },
      },
    });

    if (!exam) return { error: 'Exam not found' };

    const scores = exam.attempts.map(a => a.score || 0).sort((a, b) => a - b);
    const n = scores.length;
    if (n < 2) return { error: 'Need at least 2 attempts' };

    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    const skewness = scores.reduce((s, v) => s + ((v - mean) / sd) ** 3, 0) / n;
    const kurtosis = scores.reduce((s, v) => s + ((v - mean) / sd) ** 4, 0) / n - 3;

    const percentile = (p: number) => {
      const idx = Math.ceil((p / 100) * n) - 1;
      return scores[Math.max(0, Math.min(idx, n - 1))];
    };

    return {
      examId: exam.title,
      statistics: {
        mean: Number(mean.toFixed(2)),
        median: Number(this.median(scores).toFixed(2)),
        mode: this.mode(scores),
        stdDev: Number(sd.toFixed(2)),
        variance: Number(sd ** 2).toFixed(2),
        skewness: Number(skewness.toFixed(4)),
        kurtosis: Number(kurtosis.toFixed(4)),
        min: scores[0],
        max: scores[n - 1],
        range: scores[n - 1] - scores[0],
      },
      percentiles: {
        p10: percentile(10),
        p25: percentile(25),
        p50: percentile(50),
        p75: percentile(75),
        p90: percentile(90),
      },
      distribution: {
        shape: skewness > 0.5 ? 'SKEWED_RIGHT' : skewness < -0.5 ? 'SKEWED_LEFT' : 'SYMMETRIC',
        interpretation: skewness > 0.5
          ? 'Most students scored below average, exam may be difficult'
          : skewness < -0.5
            ? 'Most students scored above average, exam may be easy'
            : 'Scores are normally distributed',
        tailRisk: kurtosis > 1 ? 'Heavy tails - possible outlier performance' : 'Normal tails',
      },
    };
  }

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
    const max = Math.max(...freq.values());
    return Array.from(freq.entries()).filter(([, f]) => f === max).map(([v]) => v);
  }

  private cronbachAlpha(questions: any[], attempts: any[]): number {
    if (attempts.length < 2 || questions.length < 2) return 0;

    const itemScores: number[][] = questions.map(q =>
      attempts.map(a => {
        const answer = a.answers.find((ans: any) => ans.questionId === q.id);
        return answer?.isCorrect ? 1 : 0;
      }),
    );

    const itemVariances = itemScores.map(items => {
      const m = items.reduce((s, v) => s + v, 0) / items.length;
      return items.reduce((s, v) => s + (v - m) ** 2, 0) / items.length;
    });

    const totalVariance = attempts.map(a => {
      const correct = a.answers.filter((ans: any) => ans.isCorrect).length;
      return correct;
    });

    const tvMean = totalVariance.reduce((s, v) => s + v, 0) / totalVariance.length;
    const tvVar = totalVariance.reduce((s, v) => s + (v - tvMean) ** 2, 0) / totalVariance.length;

    const k = questions.length;
    const sumVar = itemVariances.reduce((s, v) => s + v, 0);

    if (tvVar === 0) return 0;
    return (k / (k - 1)) * (1 - sumVar / tvVar);
  }

  private splitHalfReliability(questions: any[], attempts: any[]): number {
    if (attempts.length < 2) return 0;

    const odd: number[] = [];
    const even: number[] = [];

    for (const attempt of attempts) {
      let oddScore = 0;
      let evenScore = 0;
      for (const answer of attempt.answers) {
        const q = questions.find((q: any) => q.id === answer.questionId);
        if (q && answer.isCorrect) {
          if (q.order % 2 === 0) evenScore += q.score;
          else oddScore += q.score;
        }
      }
      odd.push(oddScore);
      even.push(evenScore);
    }

    const r = this.pearsonCorrelation(odd, even);
    return (2 * r) / (1 + r);
  }

  private pointBiserialCorrelation(binary: number[], continuous: number[]): number {
    const n = Math.min(binary.length, continuous.length);
    if (n < 3) return 0;

    const p = binary.filter(b => b === 1).length / n;
    const q = 1 - p;

    const m1 = continuous.filter((_, i) => binary[i] === 1).reduce((s, v) => s + v, 0) / (p * n || 1);
    const m0 = continuous.filter((_, i) => binary[i] === 0).reduce((s, v) => s + v, 0) / (q * n || 1);
    const sd = Math.sqrt(continuous.reduce((s, v, i) => s + (v - continuous.reduce((a, b) => a + b, 0) / n) ** 2, 0) / n);

    return sd > 0 ? ((m1 - m0) / sd) * Math.sqrt(p * q) : 0;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    const num = x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0);
    const den = Math.sqrt(x.reduce((sum, xi) => sum + (xi - xMean) ** 2, 0) * y.reduce((sum, yi, i) => sum + (yi - yMean) ** 2, 0));
    return den === 0 ? 0 : num / den;
  }

  private labelDifficulty(d: number): string {
    if (d < 0.2) return 'VERY_HARD';
    if (d < 0.4) return 'HARD';
    if (d < 0.6) return 'MODERATE';
    if (d < 0.8) return 'EASY';
    return 'VERY_EASY';
  }

  private labelDiscrimination(d: number): string {
    if (d >= 0.4) return 'EXCELLENT';
    if (d >= 0.3) return 'GOOD';
    if (d >= 0.2) return 'FAIR';
    return 'POOR';
  }

  private rateReliability(alpha: number): string {
    if (alpha >= 0.9) return 'EXCELLENT';
    if (alpha >= 0.8) return 'GOOD';
    if (alpha >= 0.7) return 'ACCEPTABLE';
    if (alpha >= 0.6) return 'QUESTIONABLE';
    return 'POOR';
  }

  private interpretReliability(alpha: number): string {
    if (alpha >= 0.9) return 'The exam has excellent internal consistency. Scores are highly reliable.';
    if (alpha >= 0.8) return 'The exam has good internal consistency. Scores are reliable.';
    if (alpha >= 0.7) return 'The exam has acceptable internal consistency. Some items may need review.';
    if (alpha >= 0.6) return 'The exam has questionable internal consistency. Consider reviewing poorly performing items.';
    return 'The exam has poor internal consistency. Significant revision needed.';
  }

  private generatePsychometricRecommendations(items: any[], reliability: number): string[] {
    const recs: string[] = [];
    const poorItems = items.filter(i => i.discrimination < 0.2);
    const veryHard = items.filter(i => i.difficulty < 0.2);
    const veryEasy = items.filter(i => i.difficulty > 0.85);

    if (poorItems.length > 0) {
      recs.push(`Review ${poorItems.length} items with poor discrimination (Q#${poorItems.map(i => i.questionNumber).join(', ')}). These items don't effectively differentiate between high and low performers.`);
    }
    if (veryHard.length > 0) {
      recs.push(`${veryHard.length} items are very difficult (Q#${veryHard.map(i => i.questionNumber).join(', ')}). Consider adjusting difficulty or providing partial credit.`);
    }
    if (veryEasy.length > 0) {
      recs.push(`${veryEasy.length} items are very easy (Q#${veryEasy.map(i => i.questionNumber).join(', ')}). All students answered these correctly.`);
    }
    if (reliability < 0.7) {
      recs.push(`Overall reliability (${reliability.toFixed(2)}) is below acceptable threshold. Systematic review of exam design is recommended.`);
    }
    if (recs.length === 0) {
      recs.push('Exam demonstrates good psychometric properties across all items.');
    }
    return recs;
  }
}
