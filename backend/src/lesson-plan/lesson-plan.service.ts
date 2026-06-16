import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { UpdateLessonPlanDto } from './dto/update-lesson-plan.dto';

const DEFAULT_SECTION_TYPES = [
  { type: 'objectives', title: 'Learning Objectives', defaultContent: '<p>By the end of this lesson, students will be able to...</p>' },
  { type: 'materials', title: 'Materials Needed', defaultContent: '<ul><li>Textbook</li><li>Worksheet</li></ul>' },
  { type: 'procedures', title: 'Procedures', defaultContent: '<ol><li>Introduction (5 min)</li><li>Main Activity (20 min)</li><li>Guided Practice (10 min)</li><li>Independent Work (10 min)</li><li>Closure (5 min)</li></ol>' },
  { type: 'assessment', title: 'Assessment', defaultContent: '<p>How will learning be assessed?</p>' },
  { type: 'notes', title: 'Notes', defaultContent: '<p>Additional notes...</p>' },
  { type: 'homework', title: 'Homework', defaultContent: '<p>Assign homework here...</p>' },
  { type: 'differentiation', title: 'Differentiation', defaultContent: '<p>Support for different learning needs...</p>' },
];

@Injectable()
export class LessonPlanService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, filters?: {
    classId?: string; subjectId?: string; status?: string;
    search?: string; weekStart?: string; weekEnd?: string; tag?: string;
  }) {
    const where: any = { schoolId };

    if (filters?.classId) where.classId = filters.classId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.status) where.status = filters.status;
    if (filters?.tag) where.tags = { has: filters.tag };

    if (filters?.weekStart || filters?.weekEnd) {
      where.weekStart = {};
      if (filters.weekStart) where.weekStart.gte = new Date(filters.weekStart);
      if (filters.weekEnd) where.weekStart.lte = new Date(filters.weekEnd);
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.lessonPlan.findMany({
      where,
      include: {
        class: true,
        subject: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
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
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!lessonPlan) {
      throw new NotFoundException('Lesson plan not found');
    }

    return lessonPlan;
  }

  async create(dto: CreateLessonPlanDto, schoolId: string, createdById: string) {
    const data: any = {
      title: dto.title,
      description: dto.description,
      classId: dto.classId,
      subjectId: dto.subjectId,
      weekStart: new Date(dto.weekStart),
      weekEnd: new Date(dto.weekEnd),
      objectives: dto.objectives || [],
      materials: dto.materials,
      procedures: dto.procedures,
      assessment: dto.assessment,
      notes: dto.notes,
      tags: dto.tags || [],
      attachments: dto.attachments || [],
      status: dto.status || 'draft',
      schoolId,
      createdById,
    };

    if (dto.content) {
      data.content = dto.content;
    } else {
      data.content = this.buildDefaultContent(data);
    }

    if (dto.config) {
      data.config = dto.config;
    } else {
      data.config = { defaultSectionTypes: DEFAULT_SECTION_TYPES.map(s => s.type), customSections: true, allowReordering: true, showSectionTitles: true };
    }

    return this.prisma.lessonPlan.create({ data });
  }

  async update(id: string, dto: UpdateLessonPlanDto, schoolId: string) {
    await this.findOne(id, schoolId);

    const data: any = {};
    const fields = ['title', 'description', 'classId', 'subjectId', 'materials', 'procedures', 'assessment', 'notes', 'status'] as const;
    for (const f of fields) {
      if (dto[f] !== undefined) data[f] = dto[f];
    }
    if (dto.weekStart !== undefined) data.weekStart = new Date(dto.weekStart);
    if (dto.weekEnd !== undefined) data.weekEnd = new Date(dto.weekEnd);
    if (dto.objectives !== undefined) data.objectives = dto.objectives;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.attachments !== undefined) data.attachments = dto.attachments;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.config !== undefined) data.config = dto.config;

    return this.prisma.lessonPlan.update({
      where: { id },
      data,
      include: {
        class: true,
        subject: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async delete(id: string, schoolId: string) {
    await this.findOne(id, schoolId);
    return this.prisma.lessonPlan.delete({ where: { id } });
  }

  async getWeeklyPlans(schoolId: string, weekStart: Date) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return this.prisma.lessonPlan.findMany({
      where: { schoolId, weekStart: { gte: weekStart }, weekEnd: { lt: weekEnd } },
      include: {
        class: true,
        subject: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { weekStart: 'asc' },
    });
  }

  private buildDefaultContent(data: any): any[] {
    const sections: any[] = [];
    DEFAULT_SECTION_TYPES.forEach((def, i) => {
      let content = def.defaultContent;
      if (def.type === 'objectives' && data.objectives?.length) {
        content = `<ul>${data.objectives.map((o: string) => `<li>${o}</li>`).join('')}</ul>`;
      } else if (def.type === 'materials' && data.materials) {
        content = `<p>${data.materials}</p>`;
      } else if (def.type === 'procedures' && data.procedures) {
        content = `<p>${data.procedures}</p>`;
      } else if (def.type === 'assessment' && data.assessment) {
        content = `<p>${data.assessment}</p>`;
      } else if (def.type === 'notes' && data.notes) {
        content = `<p>${data.notes}</p>`;
      }
      sections.push({ id: `sec-${i}`, type: def.type, title: def.title, content, order: i });
    });
    return sections;
  }
}
