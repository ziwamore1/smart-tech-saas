import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExaminationGeneratorService } from './examination-generator.service';

interface CompetencyInfo {
  id: string;
  name: string;
  bloomLevel: string;
  topicId: string;
  topicName: string;
  eocId?: string;
  eocName?: string;
}

interface CurriculumContext {
  competencies: CompetencyInfo[];
  topics: Array<{ id: string; name: string }>;
  eocs: Array<{ id: string; name: string }>;
}

interface CompetencyMastery {
  competencyId: string;
  competencyName: string;
  bloomLevel: string;
  topicName: string;
  correct: number;
  total: number;
  percentage: number;
  masteryLevel: 'mastered' | 'developing' | 'not_yet';
}

@Injectable()
export class CieAdaptiveService {
  private readonly logger = new Logger(CieAdaptiveService.name);

  constructor(
    private prisma: PrismaService,
    private examGenerator: ExaminationGeneratorService,
  ) {}

  async getCurriculumContext(subjectId: string): Promise<CurriculumContext> {
    const competencies = await this.prisma.competency.findMany({
      where: { subjectId },
      include: {
        topic: { select: { id: true, name: true } },
        eoc: { select: { id: true, name: true } },
      },
      orderBy: { bloomLevel: 'asc' },
    });

    const topics = await this.prisma.topic.findMany({
      where: { subjectId },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });

    const eocs = await this.prisma.elementOfConstruct.findMany({
      where: { subjectId },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      competencies: competencies.map(c => ({
        id: c.id,
        name: c.name,
        bloomLevel: c.bloomLevel,
        topicId: c.topic?.id || '',
        topicName: c.topic?.name || '',
        eocId: c.eoc?.id,
        eocName: c.eoc?.name,
      })),
      topics: topics.map(t => ({ id: t.id, name: t.name })),
      eocs: eocs.map(e => ({ id: e.id, name: e.name })),
    };
  }

  async getQuestionsForAdaptiveTest(
    subjectId: string,
    schoolId: string,
    options: {
      competencyIds?: string[];
      bloomLevels?: string[];
      difficulty?: string;
      excludeIds: string[];
      limit?: number;
    },
  ) {
    const { competencyIds, difficulty, excludeIds, limit = 10 } = options;
    const questions: any[] = [];

    const qbWhere: any = { subjectId, schoolId, isPublic: true };
    if (competencyIds?.length) qbWhere.competencyId = { in: competencyIds };
    if (difficulty) qbWhere.difficulty = difficulty;
    if (excludeIds.length) qbWhere.id = { notIn: excludeIds };

    const qbQuestions = await this.prisma.questionBank.findMany({
      where: qbWhere,
      take: limit,
      orderBy: { usageCount: 'asc' },
    });

    for (const q of qbQuestions) {
      questions.push({
        id: q.id,
        source: 'question_bank',
        question: q.question,
        questionType: q.questionType,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: this.mapDifficultyLevel(q.difficulty),
        score: q.score,
        competencyId: q.competencyId,
        topic: q.topic,
        explanation: q.explanation,
      });
    }

    if (questions.length >= limit) return questions.slice(0, limit);

    const remaining = limit - questions.length;
    const eqWhere: any = { exam: { subjectId, schoolId } };
    if (competencyIds?.length) eqWhere.competencyId = { in: competencyIds };
    if (difficulty) eqWhere.difficulty = difficulty;

    const eqIds = await this.prisma.examQuestion.findMany({
      where: eqWhere,
      take: remaining,
      orderBy: { order: 'asc' },
      select: { id: true },
    });

    const eqIdList = eqIds.map(e => e.id).filter(id => !excludeIds.includes(id));
    if (eqIdList.length > 0) {
      const examQuestions = await this.prisma.examQuestion.findMany({
        where: { id: { in: eqIdList.slice(0, remaining) } },
      });

      for (const q of examQuestions) {
        questions.push({
          id: q.id,
          source: 'exam_question',
          question: q.question,
          questionType: q.questionType,
          options: q.options,
          correctAnswer: q.correctAnswer,
          difficulty: this.mapDifficultyLevel(q.difficulty),
          score: q.score,
          competencyId: q.competencyId,
          topic: q.topic,
          explanation: q.explanation,
        });
      }
    }

    return questions.slice(0, limit);
  }

  async findQuestionsByCompetencies(
    subjectId: string,
    schoolId: string,
    competencyIds: string[],
    excludeIds: string[],
    limit: number = 5,
  ) {
    return this.getQuestionsForAdaptiveTest(subjectId, schoolId, {
      competencyIds,
      excludeIds,
      limit,
    });
  }

  async getCompetencyForQuestion(questionId: string, source: string): Promise<string | null> {
    if (source === 'question_bank') {
      const q = await this.prisma.questionBank.findUnique({
        where: { id: questionId },
        select: { competencyId: true },
      });
      return q?.competencyId || null;
    }
    if (source === 'exam_question') {
      const q = await this.prisma.examQuestion.findUnique({
        where: { id: questionId },
        select: { competencyId: true },
      });
      return q?.competencyId || null;
    }
    return null;
  }

  buildCompetencyMasteryMap(competencies: CompetencyInfo[]): Map<string, { correct: number; total: number }> {
    const map = new Map<string, { correct: number; total: number }>();
    for (const c of competencies) {
      map.set(c.id, { correct: 0, total: 0 });
    }
    return map;
  }

  analyzeCompetencyMastery(
    responses: Array<{ isCorrect: boolean | null; competencyId?: string | null; difficulty: number }>,
    competencies: CompetencyInfo[],
  ): CompetencyMastery[] {
    const compMap = this.buildCompetencyMasteryMap(competencies);

    for (const r of responses) {
      if (r.isCorrect === null) continue;
      const cid = r.competencyId;
      if (!cid || !compMap.has(cid)) continue;
      const stats = compMap.get(cid)!;
      stats.total++;
      if (r.isCorrect) stats.correct++;
    }

    const results: CompetencyMastery[] = [];
    for (const c of competencies) {
      const stats = compMap.get(c.id) || { correct: 0, total: 0 };
      const percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      let masteryLevel: 'mastered' | 'developing' | 'not_yet';
      if (stats.total === 0) {
        masteryLevel = 'not_yet';
      } else if (percentage >= 80) {
        masteryLevel = 'mastered';
      } else if (percentage >= 50) {
        masteryLevel = 'developing';
      } else {
        masteryLevel = 'not_yet';
      }

      results.push({
        competencyId: c.id,
        competencyName: c.name,
        bloomLevel: c.bloomLevel,
        topicName: c.topicName,
        correct: stats.correct,
        total: stats.total,
        percentage: Math.round(percentage * 10) / 10,
        masteryLevel,
      });
    }

    return results.sort((a, b) => a.percentage - b.percentage);
  }

  generateCurriculumRecommendations(
    competencyMastery: CompetencyMastery[],
    ability: number,
  ): string[] {
    const recommendations: string[] = [];

    const weak = competencyMastery
      .filter(c => c.masteryLevel === 'not_yet' && c.total > 0)
      .slice(0, 3);

    const notTested = competencyMastery
      .filter(c => c.total === 0)
      .slice(0, 3);

    if (weak.length > 0) {
      const weakTopics = [...new Set(weak.map(c => c.topicName).filter(Boolean))];
      const weakComps = weak.map(c => c.competencyName).join(', ');
      recommendations.push(`Strengthen: ${weakComps}. These competencies need more practice.`);
      if (weakTopics.length > 0) {
        recommendations.push(`Review topics: ${weakTopics.join(', ')} to build foundational understanding.`);
      }
    }

    if (notTested.length > 0) {
      const untested = notTested.map(c => c.competencyName).join(', ');
      recommendations.push(`Untested areas: ${untested}. Schedule focused assessment.`);
    }

    if (ability < -1) {
      recommendations.push('Student struggling significantly. Recommend remediation and simpler practice questions.');
    } else if (ability > 1.5) {
      recommendations.push('Student excelling. Introduce advanced topics and challenge questions.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue practicing to maintain current performance level.');
    }

    return recommendations;
  }

  generateBloomLevelBreakdown(
    responses: Array<{ isCorrect: boolean | null; competencyId?: string | null }>,
    competencies: CompetencyInfo[],
  ) {
    const compMap = new Map(competencies.map(c => [c.id, c]));
    const bloomStats = new Map<string, { correct: number; total: number }>();

    for (const r of responses) {
      if (r.isCorrect === null || !r.competencyId) continue;
      const comp = compMap.get(r.competencyId);
      if (!comp) continue;
      const level = comp.bloomLevel || 'UNKNOWN';
      if (!bloomStats.has(level)) bloomStats.set(level, { correct: 0, total: 0 });
      const stats = bloomStats.get(level)!;
      stats.total++;
      if (r.isCorrect) stats.correct++;
    }

    return Array.from(bloomStats.entries()).map(([level, stats]) => ({
      bloomLevel: level,
      correct: stats.correct,
      total: stats.total,
      percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 1000) / 10 : 0,
    }));
  }

  private mapDifficultyLevel(difficulty: string): number {
    const map: Record<string, number> = {
      EASY: -1.5,
      MEDIUM: 0,
      HARD: 1.5,
      ADVANCED: 2.5,
    };
    return map[difficulty] ?? 0;
  }
}
