import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolActivityService } from '../common/services/school-activity.service';
import { ActivityEventType, ActivityCategory, ActivitySeverity } from '../common/types/activity-event.types';

@Injectable()
export class HomeworkService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly activityService?: SchoolActivityService,
  ) {}

  async getAll(schoolId: string, filters: {
    classId?: string;
    subjectId?: string;
    dueDate?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { classId, subjectId, dueDate, startDate, endDate } = filters;

    return this.prisma.homework.findMany({
      where: {
        schoolId,
        classId,
        subjectId,
        dueDate: startDate && endDate ? {
          gte: new Date(startDate),
          lte: new Date(endDate),
        } : dueDate ? new Date(dueDate) : undefined,
      },
      include: {
        class: true,
        subject: true,
        createdBy: {
          select: { firstName: true, lastName: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getById(id: string) {
    const homework = await this.prisma.homework.findUnique({
      where: { id },
      include: {
        class: true,
        subject: true,
        createdBy: {
          select: { firstName: true, lastName: true },
        },
        submissions: {
          include: {
            student: {
              select: { firstName: true, lastName: true, admissionNumber: true },
            },
          },
        },
      },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found');
    }

    return homework;
  }

  async getByStudent(studentId: string, includeCompleted?: boolean) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId, status: 'ACTIVE' },
      select: { classId: true },
    });

    const classIds = enrollments.map(e => e.classId);

    const submissions = await this.prisma.homeworkSubmission.findMany({
      where: { studentId },
      select: { homeworkId: true },
    });

    const submittedIds = submissions.map(s => s.homeworkId);

    const homeworks = await this.prisma.homework.findMany({
      where: {
        classId: { in: classIds },
        ...(includeCompleted ? {} : { id: { notIn: submittedIds } }),
      },
      include: {
        class: true,
        subject: true,
        submissions: {
          where: { studentId },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return homeworks;
  }

  async getByClass(classId: string, subjectId?: string) {
    return this.prisma.homework.findMany({
      where: { classId, subjectId },
      include: {
        class: true,
        subject: true,
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getBySlot(slotId: string) {
    return this.prisma.homework.findMany({
      where: { slotId },
      include: {
        class: true,
        subject: true,
        _count: {
          select: { submissions: true },
        },
      },
    });
  }

  async create(data: {
    title: string;
    description?: string;
    slotId?: string;
    classId: string;
    subjectId: string;
    dueDate: string;
    maxScore?: number;
    attachments?: string[];
    schoolId: string;
    createdById?: string;
  }) {
    const created = await this.prisma.homework.create({
      data: {
        title: data.title,
        description: data.description,
        slotId: data.slotId,
        classId: data.classId,
        subjectId: data.subjectId,
        dueDate: new Date(data.dueDate),
        maxScore: data.maxScore,
        attachments: data.attachments || [],
        schoolId: data.schoolId,
        createdById: data.createdById,
      },
      include: {
        class: true,
        subject: true,
      },
    });

    this.activityService?.publish({
      type: ActivityEventType.ASSIGNMENT_CREATED,
      category: ActivityCategory.ASSIGNMENTS,
      severity: ActivitySeverity.INFO,
      schoolId: data.schoolId,
      userId: data.createdById,
      title: 'Assignment created',
      description: `"${data.title}" assigned to class`,
      metadata: { homeworkId: created.id, classId: data.classId, subjectId: data.subjectId, title: data.title },
    });

    return created;
  }

  async update(id: string, data: {
    title?: string;
    description?: string;
    dueDate?: string;
    maxScore?: number;
    attachments?: string[];
  }) {
    return this.prisma.homework.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.homework.delete({
      where: { id },
    });
  }

  async submit(homeworkId: string, studentId: string, data: {
    submission?: string;
    attachments?: string[];
  }) {
    return this.prisma.homeworkSubmission.upsert({
      where: {
        homeworkId_studentId: { homeworkId, studentId },
      },
      update: {
        submission: data.submission,
        attachments: data.attachments || [],
      },
      create: {
        homeworkId,
        studentId,
        submission: data.submission,
        attachments: data.attachments || [],
      },
    });
  }

  async grade(submissionId: string, data: { score: number; feedback?: string }) {
    const submission = await this.prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
      include: { homework: { select: { schoolId: true } } },
    });

    const result = await this.prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        score: data.score,
        feedback: data.feedback,
        gradedAt: new Date(),
      },
    });

    this.activityService?.publish({
      type: ActivityEventType.ASSIGNMENT_GRADED,
      category: ActivityCategory.ASSIGNMENTS,
      severity: ActivitySeverity.SUCCESS,
      schoolId: submission?.homework?.schoolId || '',
      title: 'Assignment graded',
      description: `Submission graded with score ${data.score}`,
      metadata: { submissionId, score: data.score },
    });

    return result;
  }

  async getSubmissions(homeworkId: string) {
    return this.prisma.homeworkSubmission.findMany({
      where: { homeworkId },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
      },
    });
  }

  async getMySubmission(homeworkId: string, studentId: string) {
    return this.prisma.homeworkSubmission.findUnique({
      where: {
        homeworkId_studentId: { homeworkId, studentId },
      },
    });
  }

  async getCalendar(schoolId: string, startDate: string, endDate: string, classId?: string) {
    return this.prisma.homework.findMany({
      where: {
        schoolId,
        classId,
        dueDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        class: true,
        subject: true,
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }
}
