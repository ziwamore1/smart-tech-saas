import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SbaManagementService {
  private readonly logger = new Logger(SbaManagementService.name);

  constructor(private prisma: PrismaService) {}

  async createSbaTask(data: {
    title: string; description?: string; taskNumber: number; subjectId: string;
    academicStageId?: string; termId?: string; maxMarks?: number; weight?: number;
    competencyId?: string; eocId?: string; dueDate?: string; schoolId?: string;
  }) {
    return this.prisma.sbaTask.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async getSbaTasks(filters: { subjectId?: string; academicStageId?: string }) {
    const where: any = {};
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.academicStageId) where.academicStageId = filters.academicStageId;
    return this.prisma.sbaTask.findMany({
      where,
      include: { competency: true, eoc: true, subject: true },
      orderBy: { taskNumber: 'asc' },
    });
  }

  async generateSbaTemplate(subjectId: string, academicStageId?: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: { topics: { include: { competencies: true } } },
    });

    const documentSubject = await this.prisma.syllabusDocumentSubject.findFirst({
      where: { subjectId },
    });

    const sbaTasks = (subject?.topics || []).slice(0, documentSubject?.sbaTasks || 10).map((topic, i) => ({
      taskNumber: i + 1,
      title: `${topic.name} Assessment Task`,
      subjectId,
      academicStageId,
      maxMarks: 20,
      weight: Math.round(100 / Math.min(subject?.topics.length || 10, documentSubject?.sbaTasks || 10)),
      competencyId: topic.competencies[0]?.id || null,
    }));

    return {
      subject: subject?.name,
      totalTasks: sbaTasks.length,
      template: sbaTasks,
      sbaWeight: documentSubject?.sbaWeight || 30,
      examWeight: documentSubject?.examWeight || 70,
    };
  }
}
