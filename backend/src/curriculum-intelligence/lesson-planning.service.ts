import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LessonPlanningService {
  private readonly logger = new Logger(LessonPlanningService.name);

  constructor(private prisma: PrismaService) {}

  async createLessonPlan(data: {
    title: string; subjectId: string; topicId?: string; subtopicId?: string;
    classId?: string; teacherId?: string; duration?: number; weekNumber?: number;
    termId?: string; academicYearId?: string; schoolId?: string;
  }) {
    return this.prisma.curriculumLessonPlan.create({
      data: { ...data, status: 'DRAFT', isGenerated: false },
      include: { activities: true },
    });
  }

  async generateFromCurriculum(data: {
    subjectId: string; topicId: string; classId?: string; teacherId?: string;
    duration?: number; weekNumber?: number; termId?: string; academicYearId?: string; schoolId?: string;
  }) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: data.topicId },
      include: { subtopics: true, competencies: true, learningOutcomes: true },
    });

    if (!topic) throw new Error(`Topic ${data.topicId} not found`);

    const lessonPlan = await this.prisma.curriculumLessonPlan.create({
      data: {
        title: `Lesson: ${topic.name}`,
        subjectId: data.subjectId,
        topicId: data.topicId,
        classId: data.classId,
        teacherId: data.teacherId,
        duration: data.duration || 40,
        weekNumber: data.weekNumber,
        termId: data.termId,
        academicYearId: data.academicYearId,
        schoolId: data.schoolId,
        status: 'DRAFT',
        isGenerated: true,
        objectives: JSON.stringify(topic.learningOutcomes.map(o => o.name)),
        materials: '[]',
        assessmentMethods: JSON.stringify(topic.competencies.map(c => ({ competency: c.name, method: c.bloomLevel === 'REMEMBER' ? 'Quiz' : 'Practical Task' }))),
      },
    });

    const activities = [
      { lessonPlanId: lessonPlan.id, title: 'Introduction', description: `Introduce ${topic.name}`, duration: 5, activityType: 'INTRODUCTION', sortOrder: 0, schoolId: data.schoolId },
      { lessonPlanId: lessonPlan.id, title: `Main: ${topic.name}`, description: topic.description || `Cover ${topic.name} and its sub-topics`, duration: (data.duration || 40) - 15, activityType: 'MAIN', sortOrder: 1, schoolId: data.schoolId },
      { lessonPlanId: lessonPlan.id, title: 'Assessment', description: 'Evaluate understanding through questions', duration: 5, activityType: 'ASSESSMENT', sortOrder: 2, schoolId: data.schoolId },
      { lessonPlanId: lessonPlan.id, title: 'Homework', description: `Practice exercises on ${topic.name}`, duration: 5, activityType: 'HOMEWORK', sortOrder: 3, schoolId: data.schoolId },
    ];

    for (const activity of activities) {
      await this.prisma.curriculumLessonPlanActivity.create({ data: activity });
    }

    return this.prisma.curriculumLessonPlan.findUnique({
      where: { id: lessonPlan.id },
      include: { activities: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async getLessonPlans(filters: { teacherId?: string; subjectId?: string; classId?: string }) {
    const where: any = {};
    if (filters.teacherId) where.teacherId = filters.teacherId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.classId) where.classId = filters.classId;
    return this.prisma.curriculumLessonPlan.findMany({
      where,
      include: { activities: { orderBy: { sortOrder: 'asc' } }, subject: true, topic: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLessonPlan(id: string) {
    return this.prisma.curriculumLessonPlan.findUnique({
      where: { id },
      include: { activities: { orderBy: { sortOrder: 'asc' } }, subject: true, topic: true, subtopic: true },
    });
  }

  async updateLessonPlan(id: string, data: any) {
    return this.prisma.curriculumLessonPlan.update({ where: { id }, data, include: { activities: true } });
  }
}
