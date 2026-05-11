import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdaptiveTestingService {
  constructor(private prisma: PrismaService) {}

  private readonly DEFAULT_DISCRIMINATION = 0.3;
  private readonly DEFAULT_GUESSING = 0.25;
  private readonly MIN_QUESTIONS = 5;
  private readonly MAX_QUESTIONS = 30;
  private readonly STOP_SE = 0.4;
  private readonly INITIAL_ABILITY = 0;

  async startSession(studentId: string, subjectId: string, schoolId: string) {
    const active = await this.prisma.adaptiveTestSession.findFirst({
      where: { studentId, subjectId, schoolId, status: 'IN_PROGRESS' },
    });

    if (active) {
      return { sessionId: active.id, message: 'Continuing existing session', existing: true };
    }

    const session = await this.prisma.adaptiveTestSession.create({
      data: { studentId, subjectId, schoolId },
    });

    return { sessionId: session.id, message: 'New session started' };
  }

  async getNextQuestion(sessionId: string, schoolId: string) {
    const session = await this.prisma.adaptiveTestSession.findUnique({
      where: { id: sessionId },
      include: { responses: true },
    });

    if (!session || session.schoolId !== schoolId) return { error: 'Session not found' };
    if (session.status !== 'IN_PROGRESS') return { error: 'Session already completed' };

    if (session.questionsAsked >= this.MAX_QUESTIONS) {
      await this.completeSession(session);
      return { completed: true, abilityEstimate: session.abilityEstimate };
    }

    const answeredIds = session.responses.map(r => r.questionId);

    const questions = await this.prisma.examQuestion.findMany({
      where: {
        exam: { subjectId: session.subjectId, schoolId },
        id: { notIn: answeredIds },
      },
      orderBy: { order: 'asc' },
    });

    if (!questions.length && answeredIds.length === 0) {
      return { error: 'No questions available for this subject' };
    }

    if (!questions.length) {
      await this.completeSession(session);
      return { completed: true, abilityEstimate: session.abilityEstimate };
    }

    if (session.questionsAsked < this.MIN_QUESTIONS) {
      const medium = questions.filter(q => {
        const diff = this.estimateDifficulty(q);
        return diff >= -1 && diff <= 1;
      });
      return this.pickQuestion(medium.length > 0 ? medium : questions, 0);
    }

    const bestQuestion = this.selectBestQuestion(questions, session.abilityEstimate);
    return this.pickQuestion([bestQuestion], session.questionsAsked);
  }

  async submitAnswer(
    sessionId: string,
    questionId: string,
    studentAnswer: string,
    responseTimeMs: number,
    schoolId: string,
  ) {
    const session = await this.prisma.adaptiveTestSession.findUnique({
      where: { id: sessionId },
      include: { responses: true },
    });

    if (!session || session.schoolId !== schoolId) return { error: 'Session not found' };

    const question = await this.prisma.examQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) return { error: 'Question not found' };

    const isCorrect = studentAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    const answeredCategories = session.responses.filter(r => r.questionId === questionId);

    if (answeredCategories.length > 0) {
      return { error: 'Question already answered' };
    }

    await this.prisma.adaptiveTestResponse.create({
      data: {
        sessionId,
        questionId,
        questionText: question.question,
        correctAnswer: question.correctAnswer,
        studentAnswer,
        isCorrect,
        difficulty: this.estimateDifficulty(question),
        discrimination: this.DEFAULT_DISCRIMINATION,
        guessed: false,
        responseTime: responseTimeMs,
      },
    });

    const allResponses = [
      ...session.responses,
      {
        id: 'new',
        questionId,
        isCorrect,
        difficulty: this.estimateDifficulty(question),
      },
    ];

    const newAbility = this.estimateAbility(
      allResponses.map(r => ({
        isCorrect: r.isCorrect,
        difficulty: r.difficulty,
      })),
    );

    const newSE = this.calculateSE(allResponses.length);

    await this.prisma.adaptiveTestSession.update({
      where: { id: sessionId },
      data: {
        abilityEstimate: newAbility,
        abilitySE: newSE,
        questionsAsked: session.questionsAsked + 1,
        status: newSE < this.STOP_SE ? 'COMPLETED' : 'IN_PROGRESS',
      },
    });

    const completed = newSE < this.STOP_SE || session.questionsAsked + 1 >= this.MAX_QUESTIONS;

    if (completed && newSE < this.STOP_SE) {
      return { completed: true, abilityEstimate: newAbility, se: newSE };
    }

    return {
      completed: false,
      isCorrect,
      abilityEstimate: Number(newAbility.toFixed(4)),
      se: Number(newSE.toFixed(4)),
      questionsRemaining: this.MAX_QUESTIONS - session.questionsAsked - 1,
    };
  }

  async getSessionResult(sessionId: string, schoolId: string) {
    const session = await this.prisma.adaptiveTestSession.findUnique({
      where: { id: sessionId },
      include: { responses: true, subject: true },
    });

    if (!session || session.schoolId !== schoolId) return { error: 'Session not found' };

    const correctCount = session.responses.filter(r => r.isCorrect).length;
    const totalQuestions = session.responses.length;

    const difficultyLevel = this.interpretAbility(session.abilityEstimate);

    return {
      subject: session.subject.name,
      questionsAnswered: totalQuestions,
      correctAnswers: correctCount,
      accuracy: totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(2)) : 0,
      abilityEstimate: Number(session.abilityEstimate.toFixed(4)),
      standardError: Number(session.abilitySE.toFixed(4)),
      difficultyLevel,
      proficiency: this.getProficiencyLabel(session.abilityEstimate),
      averageDifficulty: Number(
        (session.responses.reduce((s, r) => s + r.difficulty, 0) / (totalQuestions || 1)).toFixed(4),
      ),
      recommendations: this.getAdaptiveRecommendations(session.abilityEstimate, session.responses),
    };
  }

  private pickQuestion(questions: any[], asked: number) {
    const q = questions[Math.floor(Math.random() * questions.length)];
    return {
      questionId: q.id,
      questionText: q.question,
      questionType: q.questionType,
      options: q.options,
      maxScore: q.score,
      questionNumber: asked + 1,
    };
  }

  private estimateDifficulty(question: any): number {
    if (question.difficulty !== undefined && question.difficulty !== null) return question.difficulty;
    const score = question.score || 1;
    return -Math.log((score / 100) || 0.5);
  }

  private selectBestQuestion(questions: any[], currentAbility: number): any {
    return questions.reduce((best, q) => {
      const diff = this.estimateDifficulty(q);
      const info = this.informationFunction(diff, currentAbility, this.DEFAULT_DISCRIMINATION, this.DEFAULT_GUESSING);
      const bestInfo = best ? this.informationFunction(
        this.estimateDifficulty(best), currentAbility, this.DEFAULT_DISCRIMINATION, this.DEFAULT_GUESSING,
      ) : -1;
      return info > bestInfo ? q : best;
    }, questions[0]);
  }

  private informationFunction(difficulty: number, ability: number, discrimination: number, guessing: number): number {
    const a = discrimination;
    const b = difficulty;
    const c = guessing;
    const theta = ability;

    const p = c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
    const q = 1 - p;
    const numerator = (a ** 2) * ((p - c) ** 2) * q;
    const denominator = (p ** 2) * (1 - c) ** 2;

    return denominator > 0 ? numerator / denominator : 0;
  }

  private estimateAbility(responses: Array<{ isCorrect: boolean | null; difficulty: number }>): number {
    const correct = responses.filter(r => r.isCorrect).length;
    const total = responses.length;
    if (total === 0) return this.INITIAL_ABILITY;

    const avgDiff = responses.reduce((s, r) => s + r.difficulty, 0) / total;
    const proportion = correct / total;

    return (proportion - 0.5) * 4 + avgDiff * 0.5;
  }

  private calculateSE(n: number): number {
    if (n < this.MIN_QUESTIONS) return 2;
    return 1 / Math.sqrt(n) * 1.5;
  }

  private interpretAbility(ability: number): string {
    if (ability > 2) return 'VERY_HIGH';
    if (ability > 1) return 'HIGH';
    if (ability > -1) return 'AVERAGE';
    if (ability > -2) return 'LOW';
    return 'VERY_LOW';
  }

  private getProficiencyLabel(ability: number): string {
    if (ability > 2) return 'Advanced: Demonstrates deep understanding of complex concepts';
    if (ability > 1) return 'Proficient: Shows good understanding with minor gaps';
    if (ability > 0) return 'Developing: Foundational knowledge established';
    if (ability > -1) return 'Emerging: Basic concepts being acquired';
    return 'Beginning: Requires foundational support';
  }

  private async completeSession(session: any) {
    await this.prisma.adaptiveTestSession.update({
      where: { id: session.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  private getAdaptiveRecommendations(ability: number, responses: any[]): string[] {
    const recs: string[] = [];
    const correctRate = responses.filter(r => r.isCorrect).length / (responses.length || 1);

    if (ability < -1) {
      recs.push('Focus on building foundational concepts before advancing');
      recs.push('Consider remedial exercises and one-on-one support');
    } else if (ability < 0) {
      recs.push('Strengthen core understanding through structured practice');
      recs.push('Identify specific topic weaknesses for targeted improvement');
    } else if (ability < 1) {
      recs.push('Build on existing knowledge with application-based problems');
      recs.push('Challenge with increasingly complex scenarios');
    } else {
      recs.push('Provide enrichment materials and advanced problem sets');
      recs.push('Encourage peer tutoring to reinforce learning');
    }

    if (correctRate < 0.5) {
      recs.push('Review test-taking strategies and time management');
    }

    return recs;
  }
}
