import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Grade7EngineService } from '../curriculum-service/grade7-engine.service';

@Injectable()
export class Grade7EczService {
  private readonly logger = new Logger(Grade7EczService.name);

  constructor(
    private prisma: PrismaService,
    private grade7Engine: Grade7EngineService,
  ) {}

  async getSchoolGrade7Classes(schoolId: string) {
    return this.prisma.class.findMany({
      where: {
        schoolId,
        OR: [
          { name: { contains: '7', mode: 'insensitive' } },
          { levelType: { name: { contains: '7', mode: 'insensitive' } } },
        ],
      },
      include: {
        levelType: true,
        _count: { select: { enrollments: { where: { status: 'ACTIVE', student: { status: 'ACTIVE' } } } } },
      },
    });
  }

  async createGrade7MockExam(data: {
    schoolId: string;
    classId: string;
    termId: string;
    subjectId: string;
    title: string;
    paperType: 'SP1' | 'SP2' | 'MOCK';
    duration: number;
    totalScore: number;
    instructions?: string;
    questions?: any[];
    createdById?: string;
  }) {
    const examTypeMap = { SP1: 'SP1' as const, SP2: 'SP2' as const, MOCK: 'MOCK' as const };

    const exam = await this.prisma.exam.create({
      data: {
        title: data.title,
        type: examTypeMap[data.paperType],
        classId: data.classId,
        subjectId: data.subjectId,
        termId: data.termId,
        schoolId: data.schoolId,
        duration: data.duration,
        totalScore: data.totalScore,
        passingScore: 0,
        instructions: data.instructions,
        isPublished: true,
        status: 'published',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdById: data.createdById,
        questions: data.questions
          ? { create: data.questions.map((q, i) => ({ ...q, order: q.order ?? i })) }
          : undefined,
      },
      include: { questions: { orderBy: { order: 'asc' } }, subject: true },
    });

    return exam;
  }

  async getMockExams(schoolId: string, classId?: string) {
    const where: any = { schoolId, type: { in: ['SP1', 'SP2', 'MOCK'] } };
    if (classId) where.classId = classId;
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

  async getMockExamResults(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { subject: true, class: true, term: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId, isSubmitted: true },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
        answers: true,
      },
      orderBy: { score: 'desc' },
    });

    const scores = attempts.map(a => a.score || 0);
    return {
      exam,
      statistics: {
        totalAttempts: attempts.length,
        averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        highestScore: scores.length > 0 ? Math.max(...scores) : 0,
        lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      },
      attempts: attempts.map(a => ({
        id: a.id,
        studentId: a.studentId,
        studentName: `${a.student.firstName} ${a.student.lastName}`,
        studentNumber: a.student.studentNumber,
        score: a.score,
        percentage: a.percentage,
        grade: a.grade,
        submittedAt: a.submittedAt,
        answersCount: a.answers.length,
      })),
    };
  }

  async enterGrade7Score(data: {
    schoolId: string;
    examId: string;
    studentId: string;
    score: number;
    totalScore?: number;
    gradedBy?: string;
  }) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: data.examId },
      include: { subject: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (!['SP1', 'SP2', 'MOCK'].includes(exam.type)) {
      throw new BadRequestException('Exam must be SP1, SP2, or MOCK type');
    }

    const percentage = data.totalScore
      ? Math.round((data.score / data.totalScore) * 100)
      : Math.round((data.score / exam.totalScore) * 100);

    const attempt = await this.prisma.examAttempt.upsert({
      where: { examId_studentId: { examId: data.examId, studentId: data.studentId } },
      create: {
        examId: data.examId,
        studentId: data.studentId,
        score: data.score,
        totalScore: data.totalScore || exam.totalScore,
        percentage,
        isSubmitted: true,
        submittedAt: new Date(),
        startedAt: new Date(),
      },
      update: {
        score: data.score,
        totalScore: data.totalScore || exam.totalScore,
        percentage,
        isSubmitted: true,
        submittedAt: new Date(),
      },
    });

    await this.syncAttemptToResult(data.schoolId, exam, attempt);

    return attempt;
  }

  async enterBulkGrade7Scores(data: {
    schoolId: string;
    examId: string;
    scores: Array<{ studentId: string; score: number }>;
    gradedBy?: string;
  }) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: data.examId },
      include: { subject: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const results = [];
    for (const entry of data.scores) {
      const percentage = Math.round((entry.score / exam.totalScore) * 100);
      const attempt = await this.prisma.examAttempt.upsert({
        where: { examId_studentId: { examId: data.examId, studentId: entry.studentId } },
        create: {
          examId: data.examId,
          studentId: entry.studentId,
          score: entry.score,
          totalScore: exam.totalScore,
          percentage,
          isSubmitted: true,
          submittedAt: new Date(),
          startedAt: new Date(),
        },
        update: {
          score: entry.score,
          percentage,
          isSubmitted: true,
        },
      });
      await this.syncAttemptToResult(data.schoolId, exam, attempt);
      results.push(attempt);
    }

    return results;
  }

  private async syncAttemptToResult(schoolId: string, exam: any, attempt: any) {
    const teacherId = attempt.gradedById || exam.createdById || 'system';
    const score = attempt.score || 0;

    return this.prisma.result.upsert({
      where: {
        studentId_subjectId_termId: {
          studentId: attempt.studentId,
          subjectId: exam.subjectId,
          termId: exam.termId,
        },
      },
      create: {
        studentId: attempt.studentId,
        subjectId: exam.subjectId,
        termId: exam.termId,
        teacherId,
        schoolId,
        score,
      },
      update: { score },
    });
  }

  async syncExamAttemptsToResult(studentId: string, termId: string) {
    const attempts = await this.prisma.examAttempt.findMany({
      where: {
        studentId,
        isSubmitted: true,
        exam: { type: { in: ['SP1', 'SP2', 'MOCK'] }, termId },
      },
      include: { exam: { include: { subject: true } } },
    });

    if (attempts.length === 0) return { synced: 0 };

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    let synced = 0;
    for (const attempt of attempts) {
      if (!attempt.exam.subjectId) continue;
      await this.prisma.result.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId,
            subjectId: attempt.exam.subjectId,
            termId,
          },
        },
        create: {
          studentId,
          subjectId: attempt.exam.subjectId,
          termId,
          teacherId: attempt.exam.createdById || 'system',
          schoolId: student.schoolId,
          score: attempt.score || 0,
        },
        update: { score: attempt.score || 0 },
      });
      synced++;
    }

    return { synced };
  }

  async computeGrade7FromExams(classId: string, termId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      include: { student: true },
    });

    if (enrollments.length === 0) {
      throw new NotFoundException('No active enrollments found for this class');
    }

    const results = [];
    const errors = [];

    for (const enrollment of enrollments) {
      try {
        await this.syncExamAttemptsToResult(enrollment.student.id, termId);
        const computation = await this.grade7Engine.computeGrade7Result(
          enrollment.student.id,
          termId,
        );
        await this.grade7Engine.saveGrade7Result(enrollment.student.id, termId, computation);
        results.push(computation);
      } catch (err: any) {
        errors.push({
          studentId: enrollment.student.id,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          error: err.message,
        });
      }
    }

    return {
      total: enrollments.length,
      computed: results.length,
      errors,
      results,
    };
  }

  async getGrade7Results(classId: string, termId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      select: { studentId: true },
    });

    return this.prisma.grade7Result.findMany({
      where: {
        studentId: { in: enrollments.map(e => e.studentId) },
        termId,
        student: { status: 'ACTIVE' },
      },
      include: { student: true, term: true, examStructure: true },
      orderBy: { finalAggregate: 'desc' },
    });
  }

  async rankGrade7Results(schoolId: string, termId: string) {
    return this.grade7Engine.rankGrade7Results(schoolId, termId);
  }

  async getSelectionPrediction(classId: string, termId: string) {
    const results = await this.prisma.grade7Result.findMany({
      where: {
        termId,
        student: { status: 'ACTIVE', enrollments: { some: { classId, status: 'ACTIVE' } } },
      },
      include: { student: true },
      orderBy: { finalAggregate: 'desc' },
    });

    const eligibleForForm1 = results.filter(r =>
      r.division && ['Division 1', 'Division 2', 'Division 3'].includes(r.division),
    );
    const borderline = results.filter(r =>
      r.division === 'Division 4' && (r.finalAggregate || 0) >= 500,
    );
    const atRisk = results.filter(r =>
      !r.division || r.division === 'Unclassified' || (r.finalAggregate || 0) < 500,
    );

    return {
      totalStudents: results.length,
      eligibleForForm1: eligibleForForm1.length,
      borderline: borderline.length,
      atRisk: atRisk.length,
      averageAggregate: results.length > 0
        ? results.reduce((s, r) => s + (r.finalAggregate || 0), 0) / results.length
        : 0,
      divisionBreakdown: [
        { division: 'Division 1', count: results.filter(r => r.division === 'Division 1').length },
        { division: 'Division 2', count: results.filter(r => r.division === 'Division 2').length },
        { division: 'Division 3', count: results.filter(r => r.division === 'Division 3').length },
        { division: 'Division 4', count: results.filter(r => r.division === 'Division 4').length },
        { division: 'Unclassified', count: results.filter(r => r.division === 'Unclassified' || !r.division).length },
      ],
      studentPredictions: results.map(r => ({
        studentId: r.studentId,
        studentName: `${r.student.firstName} ${r.student.lastName}`,
        studentNumber: r.student.studentNumber,
        finalAggregate: r.finalAggregate,
        division: r.division,
        performanceCategory: r.performanceCategory,
        schoolRank: r.schoolRank,
        prediction: ['Division 1', 'Division 2', 'Division 3'].includes(r.division || '')
          ? 'Likely to be selected'
          : r.division === 'Division 4'
            ? 'Borderline - may need supplementary'
            : 'At risk - intervention required',
      })),
    };
  }
}
