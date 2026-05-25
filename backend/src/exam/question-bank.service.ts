import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuestionBankService {
  constructor(private prisma: PrismaService) {}

  async getAll(schoolId: string, filters?: {
    subjectId?: string; categoryId?: string; difficulty?: string;
    questionType?: string; search?: string; topic?: string;
  }) {
    const where: any = { schoolId };
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.difficulty) where.difficulty = filters.difficulty;
    if (filters?.questionType) where.questionType = filters.questionType;
    if (filters?.topic) where.topic = filters.topic;
    if (filters?.search) where.question = { contains: filters.search, mode: 'insensitive' };
    return this.prisma.questionBank.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200 });
  }

  async getById(id: string) {
    const q = await this.prisma.questionBank.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  async create(schoolId: string, data: any, userId: string) {
    return this.prisma.questionBank.create({
      data: { ...data, schoolId, createdById: userId },
    });
  }

  async update(id: string, data: any) {
    await this.getById(id);
    return this.prisma.questionBank.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.getById(id);
    await this.prisma.questionBank.delete({ where: { id } });
    return { success: true };
  }

  async importToExam(questionIds: string[], examId: string) {
    const questions = await this.prisma.questionBank.findMany({
      where: { id: { in: questionIds } },
    });
    const maxOrder = await this.prisma.examQuestion.count({ where: { examId } });
    return this.prisma.examQuestion.createMany({
      data: questions.map((q, i) => ({
        examId,
        question: q.question,
        questionType: q.questionType,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        score: q.score,
        difficulty: q.difficulty,
        competencyId: q.competencyId,
        topic: q.topic,
        tags: q.tags,
        order: maxOrder + i,
      })),
    });
  }

  async getCategories(schoolId: string, subjectId?: string) {
    const where: any = { schoolId };
    if (subjectId) where.subjectId = subjectId;
    return this.prisma.questionBankCategory.findMany({
      where,
      include: { _count: { select: { questions: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(schoolId: string, data: any) {
    return this.prisma.questionBankCategory.create({ data: { ...data, schoolId } });
  }

  async deleteCategory(id: string) {
    await this.prisma.questionBankCategory.delete({ where: { id } });
    return { success: true };
  }
}
