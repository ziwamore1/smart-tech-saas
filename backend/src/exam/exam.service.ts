import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExamMarkingService } from './exam-marking.service';

interface ExamCreateInput {
  title: string; description?: string; type?: string;
  classId: string; subjectId: string; termId: string; schoolId: string;
  duration: number; totalScore: number; passingScore?: number;
  instructions?: string; shuffleQuestions?: boolean; showResults?: boolean;
  maxAttempts?: number; allowReview?: boolean; randomizeOrder?: boolean;
  autoGrade?: boolean; markingKeyUrl?: string; answerKeyUrl?: string;
  startsAt: string; endsAt: string; scheduledAt?: string;
  templateId?: string; createdById?: string;
}

@Injectable()
export class ExamService {
  constructor(
    private prisma: PrismaService,
    private markingService: ExamMarkingService,
  ) {}

  async create(data: ExamCreateInput & { questions?: any[] }) {
    const exam = await this.prisma.exam.create({
      data: {
        title: data.title,
        description: data.description,
        type: (data.type as any) || 'EXAM',
        classId: data.classId,
        subjectId: data.subjectId,
        termId: data.termId,
        schoolId: data.schoolId,
        templateId: data.templateId,
        duration: data.duration,
        totalScore: data.totalScore,
        passingScore: data.passingScore || 50,
        instructions: data.instructions,
        shuffleQuestions: data.shuffleQuestions ?? false,
        showResults: data.showResults ?? true,
        maxAttempts: data.maxAttempts ?? 1,
        allowReview: data.allowReview ?? true,
        randomizeOrder: data.randomizeOrder ?? false,
        autoGrade: data.autoGrade ?? true,
        markingKeyUrl: data.markingKeyUrl,
        answerKeyUrl: data.answerKeyUrl,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
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
    classId?: string; subjectId?: string; termId?: string;
    type?: string; isPublished?: string; status?: string; search?: string;
  }) {
    const where: any = { schoolId };
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.termId) where.termId = filters.termId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.isPublished !== undefined) where.isPublished = filters.isPublished === 'true';
    if (filters?.search) where.title = { contains: filters.search, mode: 'insensitive' };

    return this.prisma.exam.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
        sections: { orderBy: { order: 'asc' } },
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
    autoGrade?: boolean;
    markingKeyUrl?: string;
    answerKeyUrl?: string;
    scheduledAt?: Date;
    startsAt?: Date;
    endsAt?: Date;
    isPublished?: boolean;
    status?: string;
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
        autoGrade: data.autoGrade,
        markingKeyUrl: data.markingKeyUrl,
        answerKeyUrl: data.answerKeyUrl,
        scheduledAt: data.scheduledAt,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        isPublished: data.isPublished,
        status: data.status,
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

  async startAttempt(examId: string, studentId: string, ipAddress?: string, userAgent?: string) {
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
      // If existing attempt timed out, auto-submit it and forbid a new one
      const elapsed = (now.getTime() - existing.startedAt.getTime()) / 1000;
      const maxDuration = exam.duration * 60;
      if (elapsed > maxDuration + 60) {
        await this.submitExam(existing.id);
        throw new ForbiddenException('Your previous attempt time has expired');
      }
      return existing;
    }

    return this.prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        ipAddress,
        userAgent,
      },
    });
  }

  async submitAnswer(attemptId: string, questionId: string, answer: string, timeSpent?: number) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.isSubmitted) throw new ForbiddenException('Exam already submitted');

    const question = await this.prisma.examQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    const isCorrect = answer?.toLowerCase() === (question.correctAnswer || '').toLowerCase();

    const existingAnswer = await this.prisma.examAnswer.findFirst({
      where: { attemptId, questionId },
    });

    const data: any = { answer, isCorrect, timeSpent };
    if (isCorrect) data.score = question.score;
    else data.score = 0;

    if (existingAnswer) {
      return this.prisma.examAnswer.update({ where: { id: existingAnswer.id }, data });
    }
    return this.prisma.examAnswer.create({ data: { attemptId, questionId, ...data } });
  }

  async submitExam(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { questions: true } },
        answers: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.isSubmitted) {
      throw new ForbiddenException('Exam already submitted');
    }

    // Server-side timer enforcement
    const exam = attempt.exam;
    const now = new Date();
    if (now > exam.endsAt) {
      throw new ForbiddenException('Exam has ended');
    }
    const elapsed = (now.getTime() - attempt.startedAt.getTime()) / 1000;
    const maxDurationSec = exam.duration * 60;
    if (elapsed > maxDurationSec + 60) {
      throw new ForbiddenException('Time limit exceeded');
    }

    // Auto-grade questions on submission if autoGrade is enabled
    if (exam.autoGrade) {
      await this.markingService.autoMarkSubmission(attemptId, exam.schoolId);
    }

    // Re-fetch with graded scores
    const gradedAttempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true, exam: true },
    });

    const totalScore = gradedAttempt.answers.reduce((sum, a) => sum + (a.score || 0), 0);
    const totalPossible = exam.questions.reduce((sum, q) => sum + q.score, 0);
    const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100 * 100) / 100 : 0;
    const grade = await this.markingService.getGradeFromScale(percentage, exam.schoolId);

    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        isSubmitted: true,
        submittedAt: now,
        score: totalScore,
        totalScore: totalPossible,
        percentage,
        grade,
      },
    });

    // Record results in the Result model for MID_TERM / END_TERM exam types
    if (['MID_TERM', 'END_TERM', 'TEST', 'EXAM'].includes(exam.type)) {
      await this.recordExamResult(attempt.studentId, exam, totalScore, totalPossible, grade);
    }

    return this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        exam: { select: { id: true, title: true, type: true, totalScore: true, passingScore: true } },
      },
    });
  }

  private async recordExamResult(studentId: string, exam: any, score: number, totalPossible: number, grade: string) {
    try {
      const percentage = totalPossible > 0 ? score / totalPossible : 0;

      await this.prisma.result.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId,
            subjectId: exam.subjectId,
            termId: exam.termId,
          },
        },
        update: {
          score: percentage * 100,
          grade,
          teacherId: exam.createdById || 'system',
          updatedAt: new Date(),
        },
        create: {
          studentId,
          subjectId: exam.subjectId,
          termId: exam.termId,
          schoolId: exam.schoolId,
          score: percentage * 100,
          grade,
          teacherId: exam.createdById || 'system',
        },
      });
    } catch (e) {
      // Log but don't fail the submission if result recording has a unique constraint issue
      console.error('Failed to record exam result:', e);
    }
  }

  async updateExamAnswer(attemptId: string, questionId: string, data: { score?: number; isCorrect?: boolean; feedback?: string }) {
    const answer = await this.prisma.examAnswer.findFirst({
      where: { attemptId, questionId },
    });
    if (!answer) throw new NotFoundException('Answer not found');

    return this.prisma.examAnswer.update({
      where: { id: answer.id },
      data,
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

  // ===== Sections =====
  async addSection(examId: string, data: any) {
    const maxOrder = await this.prisma.examSection.count({ where: { examId } });
    return this.prisma.examSection.create({
      data: { examId, ...data, order: data.order ?? maxOrder },
    });
  }

  async getSections(examId: string) {
    return this.prisma.examSection.findMany({
      where: { examId },
      include: { questions: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
  }

  async updateSection(sectionId: string, data: any) {
    return this.prisma.examSection.update({ where: { id: sectionId }, data });
  }

  async deleteSection(sectionId: string) {
    await this.prisma.examSection.delete({ where: { id: sectionId } });
    return { success: true };
  }

  async reorderQuestions(examId: string, order: { id: string; order: number }[]) {
    for (const item of order) {
      await this.prisma.examQuestion.update({
        where: { id: item.id },
        data: { order: item.order },
      });
    }
    return { success: true };
  }

  // ===== Preview =====
  async getPreview(examId: string) {
    return this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { questions: { orderBy: { order: 'asc' } } },
        },
        questions: { orderBy: { order: 'asc' } },
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
      },
    });
  }

  async renderPreviewHtml(examId: string) {
    const exam = await this.getPreview(examId);
    if (!exam) throw new NotFoundException('Exam not found');

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
        .exam-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a365d; padding-bottom: 20px; }
        .exam-header h1 { color: #1a365d; margin: 0 0 8px; }
        .exam-meta { display: flex; justify-content: center; gap: 20px; font-size: 14px; color: #666; }
        .instructions { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #3b82f6; }
        .section { margin-bottom: 32px; }
        .section h2 { color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        .question { margin-bottom: 20px; padding: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
        .question-text { font-size: 15px; margin-bottom: 12px; line-height: 1.6; }
        .question-marks { color: #3b82f6; font-weight: 600; font-size: 13px; }
        .option { padding: 8px 12px; margin: 4px 0; border: 1px solid #e2e8f0; border-radius: 6px; }
        .page-break { page-break-after: always; border-bottom: 1px dashed #ccc; margin: 20px 0; }
        @media print { body { padding: 0; } .page-break { page-break-after: always; } }
      </style>
      <script>window.MathJax = { tex: { inlineMath: [['$','$'],['\\\\(','\\\\)']] } };</script>
      <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" async></script>
      </head><body>`;

    html += `<div class="exam-header">
      <h1>${exam.title}</h1>
      <p style="color:#666;margin:4px 0">${exam.subject?.name || ''} | ${exam.class?.name || ''} | ${exam.term?.name || ''}</p>
      <div class="exam-meta">
        <span>Duration: ${exam.duration} min</span>
        <span>Total: ${exam.totalScore} marks</span>
        <span>Passing: ${exam.passingScore} marks</span>
      </div>
    </div>`;

    if (exam.instructions) {
      html += `<div class="instructions"><strong>Instructions:</strong><br>${exam.instructions}</div>`;
    }

    if (exam.sections && exam.sections.length > 0) {
      for (const section of exam.sections) {
        html += `<div class="section"><h2>${section.title}</h2>`;
        if (section.description) html += `<p style="color:#666">${section.description}</p>`;
        const qs = (section as any).questions || [];
        for (const q of qs) {
          html += this.renderQuestionHtml(q);
        }
        html += `</div>`;
      }
    } else {
      for (const q of exam.questions) {
        html += this.renderQuestionHtml(q);
      }
    }

    html += `</body></html>`;
    return { html };
  }

  private renderQuestionHtml(q: any): string {
    let html = `<div class="question">
      <div class="question-text">${q.question} <span class="question-marks">[${q.score} marks]</span></div>`;
    if (q.options && Array.isArray(q.options)) {
      for (const opt of q.options) {
        html += `<div class="option">${opt}</div>`;
      }
    }
    html += `</div>`;
    return html;
  }

  // ===== Template Application =====
  async applyTemplate(examId: string, templateId: string) {
    const template = await this.prisma.examTemplate.findUnique({
      where: { id: templateId },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Template not found');

    await this.prisma.exam.update({
      where: { id: examId },
      data: {
        templateId,
        instructions: template.instructions || undefined,
        duration: template.duration,
        totalScore: template.totalMarks,
      },
    });

    await this.prisma.examSection.deleteMany({ where: { examId } });
    for (const s of template.sections) {
      await this.prisma.examSection.create({
        data: {
          examId,
          title: s.title,
          description: s.description,
          instructions: s.instructions,
          type: s.type,
          totalMarks: s.totalMarks,
          order: s.order,
        },
      });
    }
    return { success: true };
  }

  // ===== Attempts =====
  async getAttempt(attemptId: string) {
    const a = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        exam: {
          include: {
            questions: { orderBy: { order: 'asc' } },
            sections: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!a) throw new NotFoundException('Attempt not found');
    return a;
  }

  async getAttemptsForMarking(examId: string) {
    return this.prisma.examAttempt.findMany({
      where: { examId, isSubmitted: true, isGraded: false },
    });
  }

}
