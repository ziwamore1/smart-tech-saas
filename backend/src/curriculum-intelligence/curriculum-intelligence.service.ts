import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BloomLevel, QuestionType } from '@prisma/client';

@Injectable()
export class CurriculumIntelligenceService {
  private readonly logger = new Logger(CurriculumIntelligenceService.name);

  constructor(private prisma: PrismaService) {}

  // ===================== TOPICS =====================

  async createTopic(data: { name: string; code?: string; description?: string; sortOrder?: number; subjectId: string; academicStageId?: string; schoolId?: string }) {
    return this.prisma.topic.create({ data, include: { subtopics: true } });
  }

  async getTopics(subjectId?: string, academicStageId?: string) {
    const where: any = {};
    if (subjectId) where.subjectId = subjectId;
    if (academicStageId) where.academicStageId = academicStageId;
    return this.prisma.topic.findMany({
      where,
      include: {
        subtopics: { orderBy: { sortOrder: 'asc' } },
        competencies: true,
        learningOutcomes: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getTopic(id: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        subtopics: { orderBy: { sortOrder: 'asc' } },
        competencies: true,
        learningOutcomes: true,
        subject: true,
      },
    });
    if (!topic) throw new NotFoundException(`Topic ${id} not found`);
    return topic;
  }

  async updateTopic(id: string, data: any) {
    return this.prisma.topic.update({ where: { id }, data });
  }

  async deleteTopic(id: string) {
    return this.prisma.topic.delete({ where: { id } });
  }

  // ===================== SUBTOPICS =====================

  async createSubtopic(data: { name: string; code?: string; description?: string; sortOrder?: number; topicId: string; schoolId?: string }) {
    return this.prisma.subtopic.create({ data });
  }

  async getSubtopics(topicId: string) {
    return this.prisma.subtopic.findMany({
      where: { topicId },
      include: { competencies: true, learningOutcomes: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateSubtopic(id: string, data: any) {
    return this.prisma.subtopic.update({ where: { id }, data });
  }

  async deleteSubtopic(id: string) {
    return this.prisma.subtopic.delete({ where: { id } });
  }

  // ===================== COMPETENCIES =====================

  async createCompetency(data: { name: string; code?: string; description?: string; category?: string; bloomLevel?: BloomLevel; topicId?: string; subtopicId?: string; subjectId?: string; eocId?: string; schoolId?: string }) {
    return this.prisma.competency.create({ data });
  }

  async getCompetencies(filters: { subjectId?: string; topicId?: string; eocId?: string }) {
    const where: any = {};
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.topicId) where.topicId = filters.topicId;
    if (filters.eocId) where.eocId = filters.eocId;
    return this.prisma.competency.findMany({ where, orderBy: { name: 'asc' } });
  }

  async updateCompetency(id: string, data: any) {
    return this.prisma.competency.update({ where: { id }, data });
  }

  async deleteCompetency(id: string) {
    return this.prisma.competency.delete({ where: { id } });
  }

  // ===================== ELEMENTS OF CONSTRUCT =====================

  async createElementOfConstruct(data: { name: string; code?: string; description?: string; sortOrder?: number; subjectId: string; construct?: string; schoolId?: string }) {
    return this.prisma.elementOfConstruct.create({ data });
  }

  async getElementsOfConstruct(subjectId: string) {
    return this.prisma.elementOfConstruct.findMany({
      where: { subjectId },
      include: { competencies: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateElementOfConstruct(id: string, data: any) {
    return this.prisma.elementOfConstruct.update({ where: { id }, data });
  }

  async deleteElementOfConstruct(id: string) {
    return this.prisma.elementOfConstruct.delete({ where: { id } });
  }

  // ===================== LEARNING OUTCOMES =====================

  async createLearningOutcome(data: { name: string; code?: string; description?: string; bloomLevel?: BloomLevel; topicId?: string; subtopicId?: string; subjectId?: string; schoolId?: string }) {
    return this.prisma.learningOutcome.create({ data });
  }

  async getLearningOutcomes(filters: { subjectId?: string; topicId?: string }) {
    const where: any = {};
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.topicId) where.topicId = filters.topicId;
    return this.prisma.learningOutcome.findMany({ where, orderBy: { name: 'asc' } });
  }

  async updateLearningOutcome(id: string, data: any) {
    return this.prisma.learningOutcome.update({ where: { id }, data });
  }

  async deleteLearningOutcome(id: string) {
    return this.prisma.learningOutcome.delete({ where: { id } });
  }

  // ===================== ASSESSMENT OBJECTIVES =====================

  async createAssessmentObjective(data: { name: string; code?: string; description?: string; weight?: number; subjectId: string; schoolId?: string }) {
    return this.prisma.assessmentObjective.create({ data });
  }

  async getAssessmentObjectives(subjectId: string) {
    return this.prisma.assessmentObjective.findMany({ where: { subjectId }, orderBy: { name: 'asc' } });
  }

  async updateAssessmentObjective(id: string, data: any) {
    return this.prisma.assessmentObjective.update({ where: { id }, data });
  }

  async deleteAssessmentObjective(id: string) {
    return this.prisma.assessmentObjective.delete({ where: { id } });
  }

  // ===================== SYLLABUS DOCUMENTS =====================

  async createSyllabusDocument(data: { title: string; documentType: string; curriculum?: string; educationLevelId?: string; academicStageId?: string; filePath: string; fileSize?: number; fileType?: string; schoolId?: string }) {
    return this.prisma.syllabusDocument.create({ data });
  }

  async getSyllabusDocuments(filters: { documentType?: string; curriculum?: string; educationLevelId?: string }) {
    const where: any = {};
    if (filters.documentType) where.documentType = filters.documentType;
    if (filters.curriculum) where.curriculum = filters.curriculum;
    if (filters.educationLevelId) where.educationLevelId = filters.educationLevelId;
    return this.prisma.syllabusDocument.findMany({
      where,
      include: { subjects: { include: { subject: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSyllabusDocument(id: string) {
    const doc = await this.prisma.syllabusDocument.findUnique({
      where: { id },
      include: { subjects: { include: { subject: true } } },
    });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  async deleteSyllabusDocument(id: string) {
    return this.prisma.syllabusDocument.delete({ where: { id } });
  }

  // ===================== FULL SUBJECT TREE =====================

  async getFullSubjectTree(subjectId: string) {
    return this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        conversionRules: true,
        subjectGroupLinks: { include: { subjectGroup: true } },
        topics: {
          include: {
            subtopics: {
              include: {
                competencies: true,
                learningOutcomes: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
            competencies: true,
            learningOutcomes: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async getFullSubjectTreeByCode(code: string, schoolId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { name_schoolId: { name: code, schoolId } },
    });
    if (!subject) throw new NotFoundException(`Subject ${code} not found`);
    return this.getFullSubjectTree(subject.id);
  }

  // ===================== CURRICULUM COVERAGE =====================

  async markCoverage(data: { classId: string; subjectId: string; topicId: string; subtopicId?: string; teacherId?: string; termId?: string; percentage?: number; notes?: string; schoolId?: string }) {
    const subtopicId = data.subtopicId || '';
    const termId = data.termId || '';
    const existing = await this.prisma.curriculumCoverage.findFirst({
      where: { classId: data.classId, subjectId: data.subjectId, topicId: data.topicId, subtopicId, termId },
    });
    if (existing) {
      return this.prisma.curriculumCoverage.update({
        where: { id: existing.id },
        data: { isCovered: true, coverageDate: new Date(), percentage: data.percentage, notes: data.notes },
      });
    }
    return this.prisma.curriculumCoverage.create({
      data: { classId: data.classId, subjectId: data.subjectId, topicId: data.topicId, subtopicId, termId, teacherId: data.teacherId, schoolId: data.schoolId, isCovered: true, coverageDate: new Date(), percentage: data.percentage, notes: data.notes },
    });
  }

  async getCoverageReport(classId: string, subjectId: string, termId?: string) {
    const where: any = { classId, subjectId };
    if (termId) where.termId = termId;
    const covered = await this.prisma.curriculumCoverage.findMany({ where });
    const totalTopics = await this.prisma.topic.count({ where: { subjectId } });
    const coveredTopics = new Set(covered.filter(c => c.isCovered).map(c => c.topicId)).size;
    return {
      totalTopics,
      coveredTopics,
      coveragePercent: totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0,
      details: covered,
    };
  }
}
