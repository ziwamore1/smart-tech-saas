import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExamTemplateService {
  constructor(private prisma: PrismaService) {}

  async getAll(schoolId: string, subjectId?: string) {
    const where: any = { schoolId };
    if (subjectId) where.subjectId = subjectId;
    return this.prisma.examTemplate.findMany({
      where,
      include: { sections: { orderBy: { order: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getById(id: string) {
    const t = await this.prisma.examTemplate.findUnique({
      where: { id },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
    if (!t) throw new NotFoundException('Exam template not found');
    return t;
  }

  async create(schoolId: string, data: any, userId: string) {
    const { sections, ...rest } = data;
    return this.prisma.examTemplate.create({
      data: {
        ...rest,
        schoolId,
        createdById: userId,
        sections: {
          create: (sections || []).map((s: any, i: number) => ({ ...s, order: s.order ?? i })),
        },
      },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
  }

  async update(id: string, data: any) {
    const { sections, ...rest } = data;
    const existing = await this.getById(id);
    if (sections) {
      await this.prisma.examTemplateSection.deleteMany({ where: { templateId: id } });
      await this.prisma.examTemplateSection.createMany({
        data: sections.map((s: any, i: number) => ({
          templateId: id,
          title: s.title,
          description: s.description,
          instructions: s.instructions,
          type: s.type || 'OBJECTIVE',
          totalMarks: s.totalMarks || 0,
          order: s.order ?? i,
          questionCount: s.questionCount,
        })),
      });
    }
    return this.prisma.examTemplate.update({
      where: { id },
      data: rest,
      include: { sections: { orderBy: { order: 'asc' } } },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    await this.prisma.examTemplate.delete({ where: { id } });
    return { success: true };
  }
}
