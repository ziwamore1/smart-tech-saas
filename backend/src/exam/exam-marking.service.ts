import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// NLP & ML
import * as natural from 'natural';
import nlp from 'compromise';
import stringSimilarity from 'string-similarity';
import { Matrix, inverse, solve } from 'ml-matrix';
import { PolynomialRegression } from 'ml-regression';

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

@Injectable()
export class ExamMarkingService {
  constructor(private prisma: PrismaService) {}

  private AUTO_GRADABLE_TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANK', 'SHORT_ANSWER', 'ORDERING', 'MATCHING'];

  isAutoGradable(questionType: string): boolean {
    return this.AUTO_GRADABLE_TYPES.includes(questionType);
  }

  async autoMarkAttempt(attemptId: string, schoolId?: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        exam: { include: { questions: true } },
      },
    });
    if (!attempt) return null;

    const questions = attempt.exam.questions;
    let totalScore = 0;
    let negativeScore = 0;

    for (const answer of attempt.answers) {
      const question = questions.find(q => q.id === answer.questionId);
      if (!question) continue;
      if (!question.correctAnswer) continue;

      const result = this.checkAnswer(question, answer.answer || '');
      const earned = result.isCorrect ? question.score : 0;
      const penalty = !result.isCorrect && question.negativeMarking > 0 ? question.negativeMarking : 0;

      await this.prisma.examAnswer.update({
        where: { id: answer.id },
        data: {
          isCorrect: result.isCorrect,
          score: earned - penalty,
          maxScore: question.score,
          feedback: result.feedback || null,
        },
      });

      totalScore += earned;
      negativeScore += penalty;
    }

    const percentage = attempt.exam.totalScore > 0
      ? Math.round((totalScore / attempt.exam.totalScore) * 100 * 100) / 100
      : 0;

    const grade = schoolId
      ? await this.getGradeFromScale(percentage, schoolId, attempt.exam.classId)
      : this.calculateGrade(percentage);

    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        score: totalScore,
        totalScore: attempt.exam.totalScore,
        percentage,
        grade,
        negativeScore,
        isGraded: true,
        gradedAt: new Date(),
      },
    });
  }

  async autoMarkSubmission(attemptId: string, schoolId?: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        exam: { include: { questions: true } },
      },
    });
    if (!attempt) return null;

    const questions = attempt.exam.questions;
    let totalScore = 0;
    let negativeScore = 0;
    let pendingReview = false;

    for (const answer of attempt.answers) {
      const question = questions.find(q => q.id === answer.questionId);
      if (!question) continue;

      if (!this.isAutoGradable(question.questionType) || !question.correctAnswer) {
        pendingReview = true;
        await this.prisma.examAnswer.update({
          where: { id: answer.id },
          data: { maxScore: question.score },
        });
        continue;
      }

      const result = this.checkAnswer(question, answer.answer || '');
      const earned = result.isCorrect ? question.score : 0;
      const penalty = !result.isCorrect && question.negativeMarking > 0 ? question.negativeMarking : 0;

      await this.prisma.examAnswer.update({
        where: { id: answer.id },
        data: {
          isCorrect: result.isCorrect,
          score: earned - penalty,
          maxScore: question.score,
          feedback: result.feedback || null,
        },
      });

      totalScore += earned;
      negativeScore += penalty;
    }

    const percentage = attempt.exam.totalScore > 0
      ? Math.round((totalScore / attempt.exam.totalScore) * 100 * 100) / 100
      : 0;

    const grade = schoolId
      ? await this.getGradeFromScale(percentage, schoolId, attempt.exam.classId)
      : this.calculateGrade(percentage);

    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        score: totalScore,
        totalScore: attempt.exam.totalScore,
        percentage,
        grade,
        negativeScore,
        isGraded: !pendingReview,
        gradedAt: pendingReview ? undefined : new Date(),
      },
    });
  }

  private checkAnswer(question: any, studentAnswer: string): { isCorrect: boolean; confidence: number; feedback?: string } {
    const correct = (question.correctAnswer || '').trim();
    const answer = studentAnswer.trim();

    switch (question.questionType) {
      case 'MULTIPLE_CHOICE':
      case 'TRUE_FALSE':
        return this.exactMatch(correct, answer);

      case 'SHORT_ANSWER':
        return this.nlpMatch(correct, answer, 0.6);

      case 'ESSAY':
        return this.essayMatch(correct, answer);

      case 'FILL_IN_BLANK':
        return this.exactMatch(correct, answer);

      case 'ORDERING':
        return this.jsonCompare(correct, answer, 'ordering');

      case 'MATCHING':
        return this.jsonCompare(correct, answer, 'matching');

      default:
        return { isCorrect: false, confidence: 0, feedback: 'Unsupported question type' };
    }
  }

  private exactMatch(correct: string, answer: string): { isCorrect: boolean; confidence: number } {
    return {
      isCorrect: answer.toLowerCase() === correct.toLowerCase(),
      confidence: answer.toLowerCase() === correct.toLowerCase() ? 1 : 0,
    };
  }

  private nlpMatch(correct: string, answer: string, threshold: number = 0.6): { isCorrect: boolean; confidence: number; feedback?: string } {
    const c = correct.toLowerCase();
    const a = answer.toLowerCase();

    // Exact match
    if (a === c) return { isCorrect: true, confidence: 1 };

    // Stemmed comparison
    const correctStem = stemmer.stem(c);
    const answerStem = stemmer.stem(a);
    if (correctStem === answerStem) return { isCorrect: true, confidence: 0.95 };

    // Token overlap
    const correctTokens = new Set(tokenizer.tokenize(c) || []);
    const answerTokens = new Set(tokenizer.tokenize(a) || []);
    if (correctTokens.size > 0) {
      let overlap = 0;
      for (const t of answerTokens) if (correctTokens.has(t)) overlap++;
      const jaccard = overlap / (correctTokens.size + answerTokens.size - overlap);
      if (jaccard >= 0.8) return { isCorrect: true, confidence: Math.round(jaccard * 100) / 100 };
    }

    // String similarity (Levenshtein-based)
    const sim = stringSimilarity.compareTwoStrings(c, a);
    if (sim >= threshold) {
      return { isCorrect: true, confidence: Math.round(sim * 100) / 100 };
    }

    // Compromise NLP: check if key entities overlap
    const correctDoc = nlp(correct);
    const answerDoc = nlp(answer);
    const correctNouns = correctDoc.nouns().out('array') as string[];
    const answerNouns = answerDoc.nouns().out('array') as string[];
    if (correctNouns.length > 0 && answerNouns.length > 0) {
      const nounOverlap = correctNouns.filter(n =>
        answerNouns.some(a => a.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(a.toLowerCase()))
      ).length;
      if (nounOverlap / correctNouns.length >= 0.7) {
        return { isCorrect: true, confidence: 0.7 };
      }
    }

    return { isCorrect: false, confidence: Math.round(sim * 100) / 100, feedback: `Expected: "${correct}"` };
  }

  private essayMatch(correct: string, answer: string): { isCorrect: boolean; confidence: number; feedback?: string } {
    const c = correct.toLowerCase();
    const a = answer.toLowerCase();

    // Keyword extraction from rubric
    const correctTokens = tokenizer.tokenize(c) || [];
    const answerTokens = tokenizer.tokenize(a) || [];
    if (correctTokens.length === 0 || answerTokens.length === 0) {
      return { isCorrect: false, confidence: 0, feedback: 'Insufficient content to evaluate' };
    }

    // Stemmed keyword matching
    const correctStems = new Set(correctTokens.map(t => stemmer.stem(t)));
    const answerStems = new Set(answerTokens.map(t => stemmer.stem(t)));
    let matchedStems = 0;
    for (const s of answerStems) if (correctStems.has(s)) matchedStems++;
    const keywordScore = matchedStems / correctStems.size;

    // String similarity
    const sim = stringSimilarity.compareTwoStrings(c, a);

    // Noun/phrase overlap via compromise
    const correctPhrases = nlp(correct).match('*').out('array') as string[];
    const answerPhrases = nlp(answer).match('*').out('array') as string[];
    const phraseOverlap = correctPhrases.filter(p =>
      answerPhrases.some(ap => ap.toLowerCase().includes(p.toLowerCase()))
    ).length;
    const phraseScore = correctPhrases.length > 0 ? phraseOverlap / correctPhrases.length : 0;

    // Combined score
    const combined = (keywordScore * 0.5) + (sim * 0.25) + (phraseScore * 0.25);
    const isCorrect = combined >= 0.4;
    const confidence = Math.round(combined * 100) / 100;

    return {
      isCorrect,
      confidence,
      feedback: isCorrect
        ? `Keyword coverage: ${Math.round(keywordScore * 100)}%, Content similarity: ${Math.round(sim * 100)}%`
        : `Low keyword coverage (${Math.round(keywordScore * 100)}%). Review expected key points.`,
    };
  }

  private jsonCompare(correct: string, answer: string, type: string): { isCorrect: boolean; confidence: number } {
    try {
      const correctParsed = JSON.parse(correct);
      const answerParsed = JSON.parse(answer);
      const isCorrect = JSON.stringify(correctParsed) === JSON.stringify(answerParsed);
      return { isCorrect, confidence: isCorrect ? 1 : 0 };
    } catch {
      return { isCorrect: false, confidence: 0 };
    }
  }

  async getGradeFromScale(score: number, schoolId: string, classId?: string): Promise<string> {
    const codeToName: Record<string, string> = {
      PRIMARY_ECZ: 'Primary Grading System',
      GRADE7_ECZ: 'ECZ Grade 7 Grading System',
      SECONDARY_ECZ: 'ECZ Secondary Grading System',
      FORMS_ECZ: 'ECZ Forms Grading System',
      COLLEGE_GPA: 'College GPA Grading System',
      UNIVERSITY_CGPA: 'University CGPA Grading System',
    };

    let system: any;

    // Level 1: Check class-level grading system
    if (classId) {
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
        select: { gradingSystemId: true },
      });
      if (cls?.gradingSystemId) {
        system = await this.prisma.gradingSystem.findUnique({
          where: { id: cls.gradingSystemId },
          include: { gradeScales: true },
        });
      }
    }

    // Level 2: Check school's default grading system (isDefault = true)
    system ??= await this.prisma.gradingSystem.findFirst({
      where: { schoolId, isDefault: true },
      include: { gradeScales: true },
    });

    // Level 3: Check SchoolSetting.gradingSystem code mapping
    if (!system) {
      const schoolSetting = await this.prisma.schoolSetting.findUnique({
        where: { schoolId },
      });
      const preferredName = schoolSetting?.gradingSystem
        ? codeToName[schoolSetting.gradingSystem]
        : undefined;
      system = preferredName
        ? await this.prisma.gradingSystem.findFirst({
            where: { schoolId, name: preferredName },
            include: { gradeScales: true },
          })
        : undefined;
    }

    // Level 4: Any grading system for the school
    system ??= await this.prisma.gradingSystem.findFirst({
      where: { schoolId },
      include: { gradeScales: true },
    });

    if (system) {
      const scale = system.gradeScales.find(
        (s) => score >= s.minScore && score < s.maxScore + 1,
      );
      if (scale) return scale.grade;
    }

    return 'N/A';
  }

  async computeExamStats(examId: string) {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId, isSubmitted: true },
      include: { answers: true },
    });

    const scores = attempts.map(a => a.score || 0);
    const percentages = attempts.map(a => a.percentage || 0);
    const n = scores.length;

    if (n === 0) return { totalAttempts: 0, message: 'No attempts recorded' };

    // Basic stats
    const avg = scores.reduce((a, b) => a + b, 0) / n;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const variance = scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const passCount = attempts.filter(a => (a.percentage || 0) >= 50).length;

    // Item analysis: per-question difficulty & discrimination
    const questionMap = new Map<string, { total: number; correct: number }>();
    for (const attempt of attempts) {
      for (const ans of attempt.answers) {
        if (!questionMap.has(ans.questionId)) questionMap.set(ans.questionId, { total: 0, correct: 0 });
        const q = questionMap.get(ans.questionId)!;
        q.total++;
        if (ans.isCorrect) q.correct++;
      }
    }

    const itemAnalysis: any[] = [];
    const topThird = sorted.slice(Math.floor(n * 2 / 3));
    const bottomThird = sorted.slice(0, Math.ceil(n / 3));
    const topIds = new Set(attempts.filter(a => topThird.includes(a.score || 0)).map(a => a.id));
    const bottomIds = new Set(attempts.filter(a => bottomThird.includes(a.score || 0)).map(a => a.id));

    for (const [qId, stats] of questionMap) {
      const difficulty = stats.total > 0 ? stats.correct / stats.total : 0;
      const topCorrect = attempts.filter(a => topIds.has(a.id))
        .flatMap(a => a.answers).filter(a => a.questionId === qId && a.isCorrect).length;
      const bottomCorrect = attempts.filter(a => bottomIds.has(a.id))
        .flatMap(a => a.answers).filter(a => a.questionId === qId && a.isCorrect).length;
      const topN = attempts.filter(a => topIds.has(a.id)).length;
      const bottomN = attempts.filter(a => bottomIds.has(a.id)).length;
      const discrimination = topN > 0 && bottomN > 0
        ? (topCorrect / topN) - (bottomCorrect / bottomN)
        : 0;

      itemAnalysis.push({
        questionId: qId,
        difficulty: Math.round(difficulty * 100) / 100,
        discriminationIndex: Math.round(discrimination * 100) / 100,
        correctCount: stats.correct,
        totalResponses: stats.total,
      });
    }

    // ML: Grade distribution prediction using polynomial regression
    let gradePrediction: any = null;
    if (n >= 5) {
      try {
        const x = Array.from({ length: n }, (_, i) => [i]);
        const y = percentages;
        const regression = new PolynomialRegression(x, y, 2);
        const predictedNext = regression.predict([[n]]);
        gradePrediction = {
          currentAverage: Math.round(avg * 100) / 100,
          predictedNextAverage: Math.round(predictedNext[1] * 100) / 100,
          trend: predictedNext[1] > avg ? 'improving' : 'declining',
          reliability: n >= 10 ? 'high' : 'medium',
        };
      } catch { /* insufficient data for model */ }
    }

    return {
      totalAttempts: n,
      averageScore: Math.round(avg * 100) / 100,
      medianScore: Math.round(median * 100) / 100,
      highestScore: Math.round(sorted[n - 1] * 100) / 100,
      lowestScore: Math.round(sorted[0] * 100) / 100,
      stdDeviation: Math.round(stdDev * 100) / 100,
      passCount,
      failCount: n - passCount,
      passRate: Math.round((passCount / n) * 10000) / 100,
      itemAnalysis,
      gradePrediction,
    };
  }

  async batchAutoMark(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { schoolId: true },
    });
    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId, isSubmitted: true, isGraded: false },
    });
    const results: any[] = [];
    for (const a of attempts) {
      results.push(await this.autoMarkAttempt(a.id, exam?.schoolId));
    }
    return { graded: results.length, results };
  }
}
