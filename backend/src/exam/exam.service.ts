import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExamService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    title: string;
    description?: string;
    type?: string;
    classId: string;
    subjectId: string;
    termId: string;
    schoolId: string;
    duration: number;
    totalScore: number;
    passingScore?: number;
    scheduledAt?: Date;
    startsAt: Date;
    endsAt: Date;
    createdById?: string;
    questions?: Array<{
      question: string;
      questionType?: string;
      options?: any;
      correctAnswer: string;
      explanation?: string;
      score: number;
      order: number;
    }>;
  }) {
    const exam = await this.prisma.exam.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type as any || 'EXAM',
        classId: data.classId,
        subjectId: data.subjectId,
        termId: data.termId,
        schoolId: data.schoolId,
        duration: data.duration,
        totalScore: data.totalScore,
        passingScore: data.passingScore || 50,
        scheduledAt: data.scheduledAt,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        createdById: data.createdById,
      },
    });

    if (data.questions && data.questions.length > 0) {
      await this.prisma.examQuestion.createMany({
        data: data.questions.map((q, index) => ({
          examId: exam.id,
          question: q.question,
          questionType: q.questionType as any || 'MULTIPLE_CHOICE',
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          score: q.score,
          order: q.order ?? index,
        })),
      });
    }

    return this.getById(exam.id);
  }

  async getById(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        questions: { orderBy: { order: 'asc' } },
        _count: { select: { attempts: true } },
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    return exam;
  }

  async getAll(schoolId: string, filters?: {
    classId?: string;
    subjectId?: string;
    termId?: string;
    type?: string;
    isPublished?: boolean;
  }) {
    const where: any = { schoolId };
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.termId) where.termId = filters.termId;
    if (filters?.type) where.type = filters.type;
    if (filters?.isPublished !== undefined) where.isPublished = filters.isPublished;

    return this.prisma.exam.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: {
    title?: string;
    description?: string;
    type?: string;
    duration?: number;
    totalScore?: number;
    passingScore?: number;
    scheduledAt?: Date;
    startsAt?: Date;
    endsAt?: Date;
    isPublished?: boolean;
  }) {
    await this.getById(id);

    return this.prisma.exam.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        type: data.type as any,
        duration: data.duration,
        totalScore: data.totalScore,
        passingScore: data.passingScore,
        scheduledAt: data.scheduledAt,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        isPublished: data.isPublished,
      },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    await this.prisma.exam.delete({ where: { id } });
    return { success: true };
  }

  async addQuestion(examId: string, data: {
    question: string;
    questionType?: string;
    options?: any;
    correctAnswer: string;
    explanation?: string;
    score: number;
    order?: number;
    attachmentUrl?: string;
  }) {
    await this.getById(examId);

    const count = await this.prisma.examQuestion.count({ where: { examId } });

    return this.prisma.examQuestion.create({
      data: {
        examId,
        question: data.question,
        questionType: data.questionType as any || 'MULTIPLE_CHOICE',
        options: data.options || [],
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        score: data.score,
        order: data.order ?? count,
        attachmentUrl: data.attachmentUrl,
      },
    });
  }

  async updateQuestion(questionId: string, data: {
    question?: string;
    questionType?: string;
    options?: any;
    correctAnswer?: string;
    explanation?: string;
    score?: number;
  }) {
    const question = await this.prisma.examQuestion.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const updateData: any = { ...data };
    if (data.questionType) {
      updateData.questionType = data.questionType as any;
    }

    return this.prisma.examQuestion.update({
      where: { id: questionId },
      data: updateData,
    });
  }

  async deleteQuestion(questionId: string) {
    await this.prisma.examQuestion.delete({ where: { id: questionId } });
    return { success: true };
  }

  async startAttempt(examId: string, studentId: string) {
    const exam = await this.getById(examId);
    
    if (!exam.isPublished) {
      throw new ForbiddenException('Exam is not published');
    }

    const now = new Date();
    if (now < exam.startsAt) {
      throw new ForbiddenException('Exam has not started yet');
    }
    if (now > exam.endsAt) {
      throw new ForbiddenException('Exam has ended');
    }

    const existing = await this.prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });

    if (existing && existing.isSubmitted) {
      throw new ForbiddenException('You have already submitted this exam');
    }

    if (existing) {
      return existing;
    }

    return this.prisma.examAttempt.create({
      data: {
        examId,
        studentId,
      },
    });
  }

  async submitAnswer(attemptId: string, questionId: string, answer: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.isSubmitted) {
      throw new ForbiddenException('Exam already submitted');
    }

    const question = await this.prisma.examQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const isCorrect = answer.toLowerCase() === question.correctAnswer.toLowerCase();

    const existingAnswer = await this.prisma.examAnswer.findFirst({
      where: { attemptId, questionId },
    });

    if (existingAnswer) {
      return this.prisma.examAnswer.update({
        where: { id: existingAnswer.id },
        data: { answer, isCorrect, score: isCorrect ? question.score : 0 },
      });
    }

    return this.prisma.examAnswer.create({
      data: {
        attemptId,
        questionId,
        answer,
        isCorrect,
        score: isCorrect ? question.score : 0,
      },
    });
  }

  async submitExam(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        answers: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.isSubmitted) {
      throw new ForbiddenException('Exam already submitted');
    }

    const totalScore = attempt.answers.reduce((sum, a) => sum + (a.score || 0), 0);
    const isPassed = totalScore >= attempt.exam.passingScore;

    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        isSubmitted: true,
        submittedAt: new Date(),
        score: totalScore,
      },
      include: {
        answers: true,
        exam: { select: { title: true, passingScore: true } },
      },
    });
  }

  async getStudentResults(studentId: string, filters?: {
    examId?: string;
    classId?: string;
    termId?: string;
  }) {
    const where: any = { studentId };
    if (filters?.examId) where.examId = filters.examId;
    if (filters?.classId) where.exam = { classId: filters.classId };
    if (filters?.termId) where.exam = { ...where.exam, termId: filters.termId };

    return this.prisma.examAttempt.findMany({
      where,
      include: {
        exam: {
          include: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getExamResults(examId: string) {
    const exam = await this.getById(examId);

    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId, isSubmitted: true },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
      },
    });

    const scores = attempts.map(a => a.score || 0);
    const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highest = scores.length > 0 ? Math.max(...scores) : 0;
    const lowest = scores.length > 0 ? Math.min(...scores) : 0;
    const passed = attempts.filter(a => (a.score || 0) >= exam.passingScore).length;

    return {
      exam,
      statistics: {
        totalAttempts: attempts.length,
        averageScore: Math.round(average * 100) / 100,
        highestScore: highest,
        lowestScore: lowest,
        passRate: attempts.length > 0 ? Math.round((passed / attempts.length) * 100 * 100) / 100 : 0,
      },
      attempts,
    };
  }
}
