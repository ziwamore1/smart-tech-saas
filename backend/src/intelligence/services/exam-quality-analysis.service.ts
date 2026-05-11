import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExamQualityAnalysisService {
  constructor(private prisma: PrismaService) {}

  async analyzeExamQuality(schoolId: string, examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId, schoolId },
      include: {
        questions: { orderBy: { order: 'asc' } },
        attempts: {
          where: { isSubmitted: true },
          include: { answers: true, student: true },
        },
      },
    });

    if (!exam) return { error: 'Exam not found' };

    const analysis = {
      examId: exam.id,
      title: exam.title,
      type: exam.type,
      subject: exam.subjectId,
    };

    const results = await this.prisma.result.findMany({
      where: { schoolId, subjectId: exam.subjectId },
      orderBy: { createdAt: 'desc' },
    });

    const qualityIndicators = {
      difficulty: this.analyzeDifficulty(exam),
      discrimination: this.analyzeDiscrimination(exam),
      reliability: this.analyzeReliability(exam),
      grading: await this.analyzeGrading(exam, schoolId),
      timing: this.analyzeTiming(exam),
      coverage: this.analyzeCoverage(exam),
      scoreDistribution: this.analyzeScoreDistribution(exam),
    };

    const overallScore = this.calculateOverallQuality(qualityIndicators);

    return {
      ...analysis,
      qualityIndicators,
      overallQuality: {
        score: overallScore,
        rating: this.rateQuality(overallScore),
        recommendations: this.generateQualityRecommendations(qualityIndicators, exam),
      },
      historicalContext: results.length > 0 ? this.getHistoricalContext(results) : null,
    };
  }

  async compareExamsBySubject(schoolId: string, subjectId: string) {
    const exams = await this.prisma.exam.findMany({
      where: { schoolId, subjectId },
      include: {
        questions: true,
        attempts: { where: { isSubmitted: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const comparison = exams
      .filter(e => e.attempts.length >= 3)
      .map(e => {
        const scores = e.attempts.map(a => a.score || 0);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const passRate = (scores.filter(s => s >= 50).length / scores.length) * 100;
        const difficulty = e.questions.length > 0
          ? (avg / (e.totalScore || 100)) * 100
          : 0;

        return {
          examId: e.id,
          title: e.title,
          type: e.type,
          date: e.startsAt,
          studentCount: e.attempts.length,
          averageScore: Number(avg.toFixed(2)),
          passRate: Number(passRate.toFixed(2)),
          difficulty: Number(difficulty.toFixed(2)),
          questionCount: e.questions.length,
        };
      });

    const avgScores = comparison.map(c => c.averageScore);
    const overallAvg = avgScores.reduce((a, b) => a + b, 0) / avgScores.length;

    return {
      subjectId,
      exams: comparison,
      trend: {
        direction: this.getTrendDirection(comparison.map(c => c.averageScore)),
        consistency: this.getConsistency(avgScores),
        averageDifficulty: Number(comparison.reduce((s, c) => s + c.difficulty, 0) / (comparison.length || 1)).toFixed(2),
      },
    };
  }

  async detectGradeInflation(schoolId: string, subjectId: string) {
    const exams = await this.prisma.exam.findMany({
      where: { schoolId, subjectId },
      include: {
        attempts: { where: { isSubmitted: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    const termResults = await this.prisma.result.findMany({
      where: { schoolId, subjectId },
      include: { term: { include: { academicYear: true } } },
      orderBy: { term: { startDate: 'asc' } },
    });

    const grades = ['A', 'B', 'C', 'D', 'F'];
    const gradePoints: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

    const termGPA: Array<{ term: string; gpa: number; avgScore: number; aGradePct: number }> = [];
    const termGroups = new Map<string, { scores: number[]; grades: string[] }>();

    for (const r of termResults) {
      const key = `${r.term.name} ${r.term.academicYear?.name || ''}`;
      if (!termGroups.has(key)) termGroups.set(key, { scores: [], grades: [] });
      termGroups.get(key)!.scores.push(r.score);
      if (r.grade) termGroups.get(key)!.grades.push(r.grade);
    }

    for (const [term, data] of termGroups) {
      const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const gpa = data.grades.reduce((sum, g) => sum + (gradePoints[g] || 0), 0) / (data.grades.length || 1);
      const aCount = data.grades.filter(g => g === 'A').length;
      termGPA.push({
        term,
        gpa: Number(gpa.toFixed(2)),
        avgScore: Number(avgScore.toFixed(2)),
        aGradePct: Number(((aCount / (data.grades.length || 1)) * 100).toFixed(2)),
      });
    }

    if (termGPA.length < 2) return { error: 'Need at least 2 terms for inflation analysis' };

    const first = termGPA[0];
    const last = termGPA[termGPA.length - 1];
    const gpaChange = last.gpa - first.gpa;
    const scoreChange = last.avgScore - first.avgScore;

    const inflationIndicators: string[] = [];
    if (gpaChange > 0.3 && scoreChange < 5) inflationIndicators.push('GPA increased without corresponding score improvement');
    if (last.aGradePct - first.aGradePct > 10) inflationIndicators.push('A-grade percentage increased significantly');
    if (gpaChange > 0.5) inflationIndicators.push('Overall GPA increase exceeds expected improvement range');

    return {
      subjectId,
      termData: termGPA,
      inflationAnalysis: {
        gpaTrend: gpaChange > 0.1 ? 'INCREASING' : gpaChange < -0.1 ? 'DECREASING' : 'STABLE',
        gpaChange: Number(gpaChange.toFixed(2)),
        scoreChange: Number(scoreChange.toFixed(2)),
        inflationDetected: inflationIndicators.length > 0,
        indicators: inflationIndicators,
        confidence: inflationIndicators.length >= 2 ? 'HIGH' : inflationIndicators.length === 1 ? 'MODERATE' : 'LOW',
      },
      recommendations: inflationIndicators.length > 0
        ? ['Review grading standards and consistency across terms', 'Consider standardizing grade boundaries', 'Audit a sample of graded papers for consistency']
        : ['Grading appears consistent across terms', 'Continue current grading practices'],
    };
  }

  async getExamBlueprintQuality(schoolId: string, examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true },
    });

    if (!exam || exam.schoolId !== schoolId) return { error: 'Exam not found' };

    const questionTypes = exam.questions.reduce<Record<string, number>>((acc, q) => {
      acc[q.questionType] = (acc[q.questionType] || 0) + 1;
      return acc;
    }, {});

    const maxScores = exam.questions.map(q => q.score);
    const difficultyLevels = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY', 'WORD_DOCUMENT', 'FILE_UPLOAD'];

    return {
      examId: exam.id,
      title: exam.title,
      totalQuestions: exam.questions.length,
      totalScore: exam.totalScore,
      questionTypeMix: Object.entries(questionTypes).map(([type, count]) => ({
        type,
        count,
        percentage: Number(((count / exam.questions.length) * 100).toFixed(2)),
      })),
      scoreDistribution: {
        minScore: Math.min(...maxScores),
        maxScore: Math.max(...maxScores),
        averageScore: Number((maxScores.reduce((a, b) => a + b, 0) / maxScores.length).toFixed(2)),
        totalPossible: exam.totalScore,
      },
      bloomLevelBreakdown: this.estimateBloomLevels(exam.questions),
      qualityScore: this.rateBlueprintQuality(exam),
      recommendations: this.getBlueprintRecommendations(exam, questionTypes),
    };
  }

  private analyzeDifficulty(exam: any): { score: number; label: string; detail: string } {
    if (!exam.attempts.length) return { score: 0, label: 'NO_DATA', detail: 'No attempts to analyze' };
    const scores = exam.attempts.map((a: any) => a.score || 0);
    const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    const pctCorrect = exam.totalScore > 0 ? (avg / exam.totalScore) * 100 : 0;

    let label: string;
    let detail: string;
    if (pctCorrect < 30) { label = 'VERY_DIFFICULT'; detail = 'Exam is very difficult. Most students scored below 30%.'; }
    else if (pctCorrect < 50) { label = 'DIFFICULT'; detail = 'Exam is difficult. Consider reviewing question difficulty.'; }
    else if (pctCorrect < 70) { label = 'MODERATE'; detail = 'Exam difficulty is appropriate.'; }
    else if (pctCorrect < 85) { label = 'EASY'; detail = 'Exam is relatively easy. Consider adding challenging questions.'; }
    else { label = 'VERY_EASY'; detail = 'Exam is very easy. Most students scored above 85%.'; }

    return { score: Number((50 - Math.abs(pctCorrect - 50) + 50).toFixed(2)), label, detail };
  }

  private analyzeDiscrimination(exam: any): { score: number; label: string; detail: string } {
    if (exam.attempts.length < 4) return { score: 0, label: 'INSUFFICIENT_DATA', detail: 'Need at least 4 attempts' };
    const scores = exam.attempts.map((a: any) => a.score || 0).sort((a: number, b: number) => b - a);
    const top = Math.max(1, Math.floor(scores.length * 0.27));
    const topAvg = scores.slice(0, top).reduce((a: number, b: number) => a + b, 0) / top;
    const bottomAvg = scores.slice(-top).reduce((a: number, b: number) => a + b, 0) / top;
    const diff = (topAvg - bottomAvg) / (exam.totalScore || 1);

    let label: string;
    if (diff >= 0.4) { label = 'EXCELLENT'; }
    else if (diff >= 0.3) { label = 'GOOD'; }
    else if (diff >= 0.2) { label = 'FAIR'; }
    else { label = 'POOR'; }

    return {
      score: Number(Math.min(100, diff * 100 + 20).toFixed(2)),
      label,
      detail: label === 'POOR' ? 'Exam does not effectively differentiate between high and low performers.' : 'Exam effectively differentiates student performance levels.',
    };
  }

  private analyzeReliability(exam: any): { score: number; label: string; detail: string } {
    if (exam.attempts.length < 5 || exam.questions.length < 5) {
      return { score: 0, label: 'INSUFFICIENT_DATA', detail: 'Need at least 5 attempts and 5 questions' };
    }

    const itemScores: number[][] = exam.questions.map((q: any) =>
      exam.attempts.map((a: any) => {
        const answer = a.answers.find((ans: any) => ans.questionId === q.id);
        return answer?.isCorrect ? 1 : 0;
      }),
    );

    const itemVars = itemScores.map((items: number[]) => {
      const m = items.reduce((a: number, b: number) => a + b, 0) / items.length;
      return items.reduce((s: number, v: number) => s + (v - m) ** 2, 0) / items.length;
    });

    const totalScores = exam.attempts.map((a: any) => a.answers.filter((ans: any) => ans.isCorrect).length);
    const tMean = totalScores.reduce((a: number, b: number) => a + b, 0) / totalScores.length;
    const tVar = totalScores.reduce((s: number, v: number) => s + (v - tMean) ** 2, 0) / totalScores.length;
    const k = exam.questions.length;
    const alpha = tVar > 0 ? (k / (k - 1)) * (1 - itemVars.reduce((a: number, b: number) => a + b, 0) / tVar) : 0;

    let label: string;
    if (alpha >= 0.9) { label = 'EXCELLENT'; }
    else if (alpha >= 0.8) { label = 'GOOD'; }
    else if (alpha >= 0.7) { label = 'ACCEPTABLE'; }
    else { label = 'NEEDS_IMPROVEMENT'; }

    return {
      score: Number((alpha * 100).toFixed(2)),
      label,
      detail: label === 'NEEDS_IMPROVEMENT' ? 'Internal consistency is low. Review question quality.' : 'Internal consistency is acceptable.',
    };
  }

  private async analyzeGrading(exam: any, schoolId: string) {
    const system = await this.prisma.gradingSystem.findFirst({
      where: { schoolId, isDefault: true },
      include: { gradeScales: true },
    });

    if (!system) return { score: 50, label: 'NO_GRADING_SYSTEM', detail: 'No grading system configured' };

    const scores = exam.attempts.map((a: any) => a.score || 0);
    const gradeDist: Record<string, number> = {};
    for (const s of scores) {
      const scale = system.gradeScales.find((gs: any) => s >= gs.minScore && s <= gs.maxScore);
      const grade = scale?.grade || 'N/A';
      gradeDist[grade] = (gradeDist[grade] || 0) + 1;
    }

    const total = scores.length;
    const dist = Object.entries(gradeDist).map(([grade, count]) => ({
      grade,
      count,
      percentage: Number(((count / total) * 100).toFixed(2)),
    }));

    const topGrades = dist.filter(d => ['A', '1', '2'].includes(d.grade)).reduce((s, d) => s + d.percentage, 0);
    const failGrades = dist.filter(d => ['F', '9'].includes(d.grade)).reduce((s, d) => s + d.percentage, 0);

    const isBalanced = topGrades < 40 && failGrades < 20;
    return {
      score: isBalanced ? 80 : topGrades > 50 ? 40 : 60,
      label: isBalanced ? 'BALANCED' : topGrades > 50 ? 'LENIENT' : 'STRICT',
      detail: isBalanced ? 'Grade distribution is balanced.' : topGrades > 50 ? 'Grade distribution skews high.' : 'Grade distribution skews low.',
      gradeDistribution: dist,
    };
  }

  private analyzeTiming(exam: any) {
    if (!exam.attempts.length) return { score: 50, label: 'NO_DATA', detail: 'No timing data available' };

    const durations = exam.attempts
      .filter((a: any) => a.submittedAt && a.startedAt)
      .map((a: any) => (new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime()) / 60000);

    if (!durations.length) return { score: 50, label: 'NO_DATA', detail: 'No timing data' };

    const avgDuration = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
    const ratio = avgDuration / exam.duration;

    let label: string;
    if (ratio > 0.9) { label = 'TIGHT'; }
    else if (ratio > 0.6) { label = 'APPROPRIATE'; }
    else { label = 'AMPLE'; }

    return {
      score: Number((ratio * 100).toFixed(2)),
      label,
      detail: label === 'TIGHT' ? 'Students used most of the allotted time.' : label === 'APPROPRIATE' ? 'Time allocation is appropriate.' : 'Students completed well within time limits.',
      averageDuration: Number(avgDuration.toFixed(1)),
      durationMinutes: exam.duration,
      utilizationRate: Number((ratio * 100).toFixed(2)),
    };
  }

  private analyzeCoverage(exam: any) {
    if (!exam.questions.length) return { score: 0, label: 'NO_QUESTIONS', detail: 'No questions in exam' };
    return {
      score: 75,
      label: 'ADEQUATE',
      detail: `${exam.questions.length} questions covering the subject area.`,
      questionCount: exam.questions.length,
    };
  }

  private analyzeScoreDistribution(exam: any) {
    if (exam.attempts.length < 3) return { score: 0, label: 'INSUFFICIENT_DATA', detail: 'Need more attempts' };
    const scores = exam.attempts.map((a: any) => a.score || 0).sort((a: number, b: number) => a - b);
    const n = scores.length;
    const mean = scores.reduce((a: number, b: number) => a + b, 0) / n;
    const sd = Math.sqrt(scores.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / n);
    const skew = n > 2 ? scores.reduce((s: number, v: number) => s + ((v - mean) / (sd || 1)) ** 3, 0) / n : 0;

    return {
      score: Number((50 - Math.abs(skew) * 10 + 50).toFixed(2)),
      label: Math.abs(skew) < 0.5 ? 'NORMAL' : skew > 0 ? 'RIGHT_SKEWED' : 'LEFT_SKEWED',
      detail: Math.abs(skew) < 0.5 ? 'Scores are normally distributed.' : 'Score distribution shows skew.',
      skewness: Number(skew.toFixed(4)),
      mean: Number(mean.toFixed(2)),
      stdDev: Number(sd.toFixed(2)),
    };
  }

  private calculateOverallQuality(indicators: any): number {
    const weights = { difficulty: 0.2, discrimination: 0.25, reliability: 0.3, grading: 0.1, timing: 0.05, coverage: 0.05, scoreDistribution: 0.05 };
    let total = 0;
    for (const [key, weight] of Object.entries(weights)) {
      total += (indicators[key]?.score || 0) * weight;
    }
    return Number(total.toFixed(2));
  }

  private rateQuality(score: number): string {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 50) return 'FAIR';
    return 'POOR';
  }

  private generateQualityRecommendations(indicators: any, exam: any): string[] {
    const recs: string[] = [];
    if (indicators.difficulty.label === 'VERY_DIFFICULT' || indicators.difficulty.label === 'DIFFICULT') {
      recs.push('Review and adjust question difficulty. Consider adding easier questions to balance the exam.');
    }
    if (indicators.discrimination.label === 'POOR') {
      recs.push('Improve question discrimination. Remove or revise questions that do not differentiate performers.');
    }
    if (indicators.reliability.label === 'NEEDS_IMPROVEMENT') {
      recs.push('Improve exam reliability. Increase question count and review item quality.');
    }
    if (indicators.grading.label === 'LENIENT') {
      recs.push('Grade distribution is skewed high. Review grading standards and difficulty.');
    }
    if (indicators.timing.label === 'TIGHT') {
      recs.push('Consider extending exam duration or reducing question count.');
    }
    if (recs.length === 0) recs.push('Exam quality is satisfactory. Continue current practices.');
    return recs;
  }

  private getTrendDirection(scores: number[]): string {
    if (scores.length < 2) return 'INSUFFICIENT';
    const last = scores.slice(-3);
    if (last.length < 2) return 'STABLE';
    const change = last[last.length - 1] - last[0];
    if (change > 3) return 'IMPROVING';
    if (change < -3) return 'DECLINING';
    return 'STABLE';
  }

  private getConsistency(scores: number[]): string {
    if (scores.length < 2) return 'UNKNOWN';
    const cv = Math.sqrt(scores.reduce((s, v) => s + (v - scores.reduce((a, b) => a + b, 0) / scores.length) ** 2, 0) / scores.length) / (scores.reduce((a, b) => a + b, 0) / scores.length);
    return cv < 0.1 ? 'CONSISTENT' : cv < 0.2 ? 'MODERATE' : 'VARIABLE';
  }

  private getHistoricalContext(results: any[]) {
    const allScores = results.map(r => r.score);
    const avg = allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length;
    const sd = Math.sqrt(allScores.reduce((s: number, v: number) => s + (v - avg) ** 2, 0) / allScores.length);
    return {
      totalResults: results.length,
      historicalAverage: Number(avg.toFixed(2)),
      historicalStdDev: Number(sd.toFixed(2)),
    };
  }

  private estimateBloomLevels(questions: any[]): Array<{ level: string; count: number; percentage: number }> {
    const bloomKeywords: Record<string, RegExp[]> = {
      REMEMBER: [/define/i, /list/i, /name/i, /identify/i, /recall/i, /state/i],
      UNDERSTAND: [/explain/i, /describe/i, /interpret/i, /summarize/i, /classify/i, /compare/i],
      APPLY: [/solve/i, /use/i, /implement/i, /demonstrate/i, /calculate/i, /show/i],
      ANALYZE: [/analyze/i, /differentiate/i, /distinguish/i, /examine/i, /contrast/i, /investigate/i],
      EVALUATE: [/evaluate/i, /justify/i, /assess/i, /critique/i, /defend/i, /judge/i],
      CREATE: [/create/i, /design/i, /develop/i, /construct/i, /propose/i, /plan/i],
    };

    const counts: Record<string, number> = { REMEMBER: 0, UNDERSTAND: 0, APPLY: 0, ANALYZE: 0, EVALUATE: 0, CREATE: 0 };

    for (const q of questions) {
      let assigned = false;
      for (const [level, patterns] of Object.entries(bloomKeywords)) {
        if (patterns.some(p => p.test(q.question))) {
          counts[level]++;
          assigned = true;
          break;
        }
      }
      if (!assigned) counts['REMEMBER']++;
    }

    const total = questions.length || 1;
    return Object.entries(counts).map(([level, count]) => ({
      level,
      count,
      percentage: Number(((count / total) * 100).toFixed(2)),
    }));
  }

  private rateBlueprintQuality(exam: any): number {
    let score = 50;
    if (exam.questions.length >= 10) score += 15;
    if (exam.questions.length >= 20) score += 10;
    if (exam.duration >= 30) score += 10;
    if (exam.totalScore > 0) score += 5;
    const types = new Set(exam.questions.map((q: any) => q.questionType)).size;
    if (types >= 2) score += 10;
    return Math.min(100, score);
  }

  private getBlueprintRecommendations(exam: any, questionTypes: Record<string, number>): string[] {
    const recs: string[] = [];
    if (exam.questions.length < 10) recs.push('Increase question count for better content coverage.');
    const types = Object.keys(questionTypes).length;
    if (types < 2) recs.push('Include a mix of question types (MCQ, short answer, essay) for comprehensive assessment.');
    return recs.length > 0 ? recs : ['Blueprint quality is satisfactory.'];
  }
}
