import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AiContextService {
  constructor(private prisma: PrismaService) {}

  async getStudentContext(studentId: string, schoolId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { academicYear: { schoolId, isCurrent: true } },
          include: { class: { include: { levelType: true } } },
        },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!student) return null;

    const classId = student.enrollments[0]?.classId;
    const levelType = student.enrollments[0]?.class?.levelType;
    const currentTerm = await this.prisma.term.findFirst({
      where: { academicYear: { schoolId, isCurrent: true }, isCurrent: true },
    });

    const [results, attendance, weaknesses, competency, growth] = await Promise.all([
      this.getRecentResults(studentId, currentTerm?.id),
      this.getAttendanceRate(studentId, currentTerm?.id),
      this.getWeakAreas(studentId, schoolId),
      this.getCompetencyScores(studentId, currentTerm?.id),
      this.getGrowthRecord(studentId, currentTerm?.id),
    ]);

    return {
      studentId: student.id,
      name: `${student.firstName} ${student.lastName}`,
      grade: levelType?.name || null,
      classId,
      className: student.enrollments[0]?.class?.name || null,
      currentPerformance: {
        average: results.average,
        subjectCount: results.subjectCount,
        weakAreas: weaknesses,
        topSubjects: results.topSubjects,
      },
      attendance,
      competency,
      growth,
      recentResults: results.scores,
    };
  }

  async getTeacherContext(userId: string, schoolId: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { userId } });
    if (!teacher) return null;

    const currentTerm = await this.prisma.term.findFirst({
      where: { academicYear: { schoolId, isCurrent: true }, isCurrent: true },
    });

    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId: userId, academicYear: { schoolId, isCurrent: true } },
      include: { class: true, subject: true },
    });

    const classes = assignments.reduce((acc: any[], ta) => {
      const existing = acc.find(c => c.classId === ta.classId);
      if (existing) {
        existing.subjects.push(ta.subject.name);
      } else {
        acc.push({ classId: ta.classId, className: ta.class.name, subjects: [ta.subject.name] });
      }
      return acc;
    }, []);

    const classAnalytics = await Promise.all(
      classes.map(async (c: any) => {
        const students = await this.prisma.enrollment.findMany({
          where: { classId: c.classId, academicYear: { schoolId, isCurrent: true } },
          select: { studentId: true },
        });
        const studentIds = students.map(s => s.studentId);
        const results = await this.prisma.result.findMany({
          where: { studentId: { in: studentIds }, termId: currentTerm?.id },
          select: { score: true, subject: { select: { name: true } } },
        });
        const avg = results.length > 0
          ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length * 10) / 10
          : null;
        return { className: c.className, subjects: c.subjects, studentCount: studentIds.length, averageScore: avg };
      }),
    );

    return { teacherId: teacher.id, employeeNo: teacher.employeeNo, classes: classAnalytics };
  }

  async getParentContext(userId: string, schoolId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const parent = user?.email
      ? await this.prisma.parent.findFirst({ where: { email: user.email } })
      : null;
    if (!parent) return null;

    const children = await this.prisma.parentStudent.findMany({
      where: { parentId: parent.id },
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
    });

    const childrenData = await Promise.all(
      children.map(async (ps) => {
        const ctx = await this.getStudentContext(ps.student.id, schoolId);
        return ctx ? { ...ctx, admissionNumber: ps.student.admissionNumber } : null;
      }),
    );

    return { parentId: parent.id, children: childrenData.filter(Boolean) };
  }

  async getDirectorContext(schoolId: string) {
    const currentTerm = await this.prisma.term.findFirst({
      where: { academicYear: { schoolId, isCurrent: true }, isCurrent: true },
    });

    const [totalStudents, totalTeachers, totalClasses, classPerformance] = await Promise.all([
      this.prisma.student.count({ where: { schoolId } }),
      this.prisma.teacher.count({ where: { schoolId } }),
      this.prisma.class.count({ where: { schoolId } }),
      this.getClassPerformanceSummary(schoolId, currentTerm?.id),
    ]);

    return {
      schoolStats: { totalStudents, totalTeachers, totalClasses },
      classPerformance,
      currentTerm: currentTerm?.name || null,
    };
  }

  private async getRecentResults(studentId: string, termId?: string) {
    if (!termId) return { average: null, subjectCount: 0, topSubjects: [], scores: [] };
    const results = await this.prisma.result.findMany({
      where: { studentId, termId },
      include: { subject: { select: { name: true } } },
    });
    const scores = results.map(r => ({ subject: r.subject.name, score: r.score, grade: r.grade }));
    const average = scores.length > 0
      ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length * 10) / 10
      : null;
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    return {
      average,
      subjectCount: scores.length,
      topSubjects: sorted.slice(0, 3).map(s => s.subject),
      scores: sorted.slice(0, 5),
    };
  }

  private async getAttendanceRate(studentId: string, termId?: string): Promise<{ rate: number; total: number; present: number }> {
    const where: any = { studentId };
    if (termId) {
      const term = await this.prisma.term.findUnique({ where: { id: termId } });
      if (term) where.date = { gte: term.startDate, lte: term.endDate };
    }
    const records = await this.prisma.attendance.findMany({ where });
    const total = records.length;
    if (total === 0) return { rate: 100, total: 0, present: 0 };
    const present = records.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    return { rate: Math.round((present / total) * 100), total, present };
  }

  private async getWeakAreas(studentId: string, schoolId: string): Promise<string[]> {
    const results = await this.prisma.result.findMany({
      where: { studentId },
      include: { subject: { select: { name: true } } },
      orderBy: { score: 'asc' },
      take: 5,
    });
    return results.filter(r => r.score < 50).map(r => r.subject.name);
  }

  private async getCompetencyScores(studentId: string, termId?: string) {
    if (!termId) return [];
    const scores = await this.prisma.competencyScore.findMany({
      where: { studentId, termId },
      include: { learningArea: { select: { name: true, subject: { select: { name: true } } } } },
    });
    return scores.map(s => ({
      subject: s.learningArea.subject.name,
      area: s.learningArea.name,
      score: s.score,
    }));
  }

  private async getGrowthRecord(studentId: string, termId?: string) {
    if (!termId) return null;
    const record = await this.prisma.studentGrowthRecord.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });
    return record
      ? { gpa: record.gpa, percentile: record.percentile, classRank: record.classRank, growthRate: record.growthRate, status: record.status }
      : null;
  }

  private async getClassPerformanceSummary(schoolId: string, termId?: string) {
    const classes = await this.prisma.class.findMany({ where: { schoolId } });
    return Promise.all(classes.map(async (c) => {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { classId: c.id, academicYear: { schoolId, isCurrent: true } },
        select: { studentId: true },
      });
      const studentIds = enrollments.map(e => e.studentId);
      if (studentIds.length === 0) return { className: c.name, studentCount: 0, averageScore: null };

      const results = await this.prisma.result.findMany({
        where: { studentId: { in: studentIds }, termId },
        select: { score: true },
      });
      const avg = results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length * 10) / 10
        : null;
      return { className: c.name, studentCount: studentIds.length, averageScore: avg };
    }));
  }
}
