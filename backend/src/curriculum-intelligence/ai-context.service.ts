import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiContextService {
  private readonly logger = new Logger(AiContextService.name);

  constructor(private prisma: PrismaService) {}

  async getCurriculumContext(schoolId: string, subjectId: string, topicId?: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        topics: {
          include: { subtopics: true, competencies: true, learningOutcomes: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const eocs = await this.prisma.elementOfConstruct.findMany({
      where: { subjectId },
      include: { competencies: true },
      orderBy: { sortOrder: 'asc' },
    });

    const assessmentObjectives = await this.prisma.assessmentObjective.findMany({
      where: { subjectId },
    });

    let currentTopic = null;
    if (topicId) {
      currentTopic = await this.prisma.topic.findUnique({
        where: { id: topicId },
        include: { subtopics: true, competencies: true, learningOutcomes: true },
      });
    }

    return {
      subject: { id: subject?.id, name: subject?.name, code: subject?.code },
      eocs: eocs.map(e => ({ id: e.id, name: e.name, description: e.description, competencies: e.competencies.map(c => c.name) })),
      assessmentObjectives: assessmentObjectives.map(a => ({ name: a.name, weight: a.weight })),
      topics: subject?.topics.map(t => ({
        id: t.id, name: t.name, subtopics: t.subtopics.map(s => s.name),
        competencies: t.competencies.map(c => c.name),
        outcomes: t.learningOutcomes.map(o => o.name),
      })) || [],
      currentTopic: currentTopic ? {
        name: currentTopic.name,
        subtopics: currentTopic.subtopics.map(s => ({ name: s.name, description: s.description })),
        competencies: currentTopic.competencies.map(c => ({ name: c.name, description: c.description, bloomLevel: c.bloomLevel })),
        outcomes: currentTopic.learningOutcomes.map(o => ({ name: o.name, bloomLevel: o.bloomLevel })),
      } : null,
    };
  }

  async enrichPromptWithCurriculum(body: { prompt: string; schoolId: string; subjectId?: string; topicId?: string; userRole?: string }) {
    let context = `Curriculum Context:\n`;

    if (body.subjectId) {
      const subjectTree = await this.getCurriculumContext(body.schoolId, body.subjectId, body.topicId);
      context += `Subject: ${subjectTree.subject?.name} (${subjectTree.subject?.code})\n`;
      
      if (subjectTree.eocs?.length) {
        context += `Elements of Construct: ${subjectTree.eocs.map(e => e.name).join(', ')}\n`;
      }
      if (subjectTree.currentTopic) {
        context += `Current Topic: ${subjectTree.currentTopic.name}\n`;
        if (subjectTree.currentTopic.subtopics?.length) {
          context += `Subtopics: ${subjectTree.currentTopic.subtopics.map(s => s.name).join(', ')}\n`;
        }
        if (subjectTree.currentTopic.competencies?.length) {
          context += `Competencies: ${subjectTree.currentTopic.competencies.map(c => `${c.name} (${c.bloomLevel || 'N/A'})`).join(', ')}\n`;
        }
      }
    }

    return {
      enrichedPrompt: `${context}\n\nUser Role: ${body.userRole || 'Unknown'}\n\nQuery: ${body.prompt}`,
      context,
      originalPrompt: body.prompt,
    };
  }
}
