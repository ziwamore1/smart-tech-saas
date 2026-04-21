import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LessonPlanService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, filters?: { classId?: string; subjectId?: string; status?: string }) {
    const where: any = { schoolId };
    
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.status) where.status = filters.status;

    return this.prisma.lessonPlan.findMany({
      where,
      include: {
        class: true,
        subject: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { weekStart: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const lessonPlan = await this.prisma.lessonPlan.findFirst({
      where: { id, schoolId },
      include: {
        class: true,
        subject: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!lessonPlan) {
      throw new NotFoundException('Lesson plan not found');
    }

    return lessonPlan;
  }

  async create(data: {
    title: string;
    description?: string;
    classId: string;
    subjectId: string;
    weekStart: Date;
    weekEnd: Date;
    objectives?: string[];
    materials?: string;
    procedures?: string;
    assessment?: string;
    notes?: string;
    attachments?: any[];
    status?: string;
  }, schoolId: string, createdById: string) {
    return this.prisma.lessonPlan.create({
      data: {
        ...data,
        schoolId,
        createdById,
      },
    });
  }

  async update(id: string, data: {
    title?: string;
    description?: string;
    classId?: string;
    subjectId?: string;
    weekStart?: Date;
    weekEnd?: Date;
    objectives?: string[];
    materials?: string;
    procedures?: string;
    assessment?: string;
    notes?: string;
    attachments?: any[];
    status?: string;
  }, schoolId: string) {
    await this.findOne(id, schoolId);

    return this.prisma.lessonPlan.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, schoolId: string) {
    await this.findOne(id, schoolId);

    return this.prisma.lessonPlan.delete({
      where: { id },
    });
  }

  async getWeeklyPlans(schoolId: string, weekStart: Date) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return this.prisma.lessonPlan.findMany({
      where: {
        schoolId,
        weekStart: { gte: weekStart },
        weekEnd: { lt: weekEnd },
      },
      include: {
        class: true,
        subject: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { weekStart: 'asc' },
    });
  }
}