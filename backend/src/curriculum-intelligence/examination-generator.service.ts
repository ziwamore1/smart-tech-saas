import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BloomLevel, QuestionType } from '@prisma/client';

@Injectable()
export class ExaminationGeneratorService {
  private readonly logger = new Logger(ExaminationGeneratorService.name);

  constructor(private prisma: PrismaService) {}

  async generateQuestions(params: {
    subjectId: string; topicId?: string; questionType: QuestionType; count?: number;
    bloomLevel?: BloomLevel; difficulty?: string; eocId?: string; totalMarks?: number;
  }) {
    const count = params.count || 5;
    const questions: any[] = [];

    const competencies = await this.prisma.competency.findMany({
      where: {
        subjectId: params.subjectId,
        ...(params.topicId ? { topicId: params.topicId } : {}),
        ...(params.eocId ? { eocId: params.eocId } : {}),
        ...(params.bloomLevel ? { bloomLevel: params.bloomLevel } : {}),
      },
      include: {
        topic: true,
        subtopic: true,
        eoc: true,
      },
      take: count,
    });

    for (const comp of competencies) {
      questions.push({
        type: params.questionType,
        competency: comp.name,
        bloomLevel: comp.bloomLevel || 'APPLY',
        topic: comp.topic?.name || null,
        subtopic: comp.subtopic?.name || null,
        eoc: comp.eoc?.name || null,
        marks: params.totalMarks ? Math.round(params.totalMarks / competencies.length) : 5,
        instructions: `Based on competency: ${comp.name}. ${comp.description || ''}`,
      });
    }

    return {
      subjectId: params.subjectId,
      questionType: params.questionType,
      count: questions.length,
      questions,
      metadata: {
        bloomDistribution: this.getBloomDistribution(questions),
        totalMarks: questions.reduce((s, q) => s + q.marks, 0),
      },
    };
  }

  async generateExamPaper(params: {
    subjectId: string; academicStageId: string; totalMarks?: number;
    includeEocs?: string[]; includeTopics?: string[]; difficultyDistribution?: any;
  }) {
    const totalMarks = params.totalMarks || 100;
    const eocs = await this.prisma.elementOfConstruct.findMany({
      where: {
        subjectId: params.subjectId,
        ...(params.includeEocs?.length ? { id: { in: params.includeEocs } } : {}),
      },
      include: { competencies: { include: { topic: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    const examStructure = await this.prisma.examStructure.findFirst({
      where: { academicStageId: params.academicStageId },
      include: { components: true },
    });

    const marksPerEoc = totalMarks / (eocs.length || 1);
    const sections = eocs.map((eoc, i) => ({
      section: i + 1,
      eoc: eoc.name,
      totalMarks: Math.round(marksPerEoc),
      questions: (eoc.competencies || []).slice(0, 3).map((comp, j) => ({
        questionNumber: j + 1,
        type: j === 0 ? 'MCQ' : j === 1 ? 'SHORT_ANSWER' : 'STRUCTURED',
        competency: comp.name,
        bloomLevel: comp.bloomLevel || 'APPLY',
        topic: comp.topic?.name || null,
        marks: Math.round(marksPerEoc / Math.min(eoc.competencies.length, 3)),
      })),
    }));

    return {
      subjectId: params.subjectId,
      academicStageId: params.academicStageId,
      totalMarks,
      examStructure: examStructure ? { name: examStructure.name, components: examStructure.components } : null,
      sections,
      metadata: {
        totalSections: sections.length,
        totalQuestions: sections.reduce((s, sec) => s + sec.questions.length, 0),
        bloomDistribution: this.getBloomDistribution(sections.flatMap(s => s.questions)),
      },
    };
  }

  private getBloomDistribution(questions: any[]) {
    const dist: Record<string, number> = {};
    for (const q of questions) {
      const level = q.bloomLevel || 'APPLY';
      dist[level] = (dist[level] || 0) + 1;
    }
    return dist;
  }
}
