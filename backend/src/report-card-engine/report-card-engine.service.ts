import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportCardEngineService {
  private readonly logger = new Logger(ReportCardEngineService.name);

  constructor(private prisma: PrismaService) {}

  async generateReportCardData(
    studentId: string,
    termId: string,
    schoolId: string,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            class: {
              include: {
                levelType: true,
              },
            },
            academicYear: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const enrollment = student.enrollments.find(e => true);
    if (!enrollment) {
      throw new NotFoundException('No active enrollment found');
    }

    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        studentId,
        termId,
        classId: enrollment.classId,
        status: { in: ['COMPUTED', 'VERIFIED', 'LOCKED'] },
      },
      include: {
        subject: true,
      },
      orderBy: [
        { subject: { name: 'asc' } },
      ],
    });

    const assessmentResults = await this.prisma.studentAssessmentResult.findMany({
      where: {
        studentId,
        termId,
        classId: enrollment.classId,
        status: { not: 'DRAFT' },
      },
      include: {
        assessmentDef: true,
        subject: true,
      },
      orderBy: [
        { subject: { name: 'asc' } },
        { assessmentDef: { sortOrder: 'asc' } },
      ],
    });

    const subjectBreakdown = computedResults.map(result => {
      const assessments = assessmentResults
        .filter(a => a.subjectId === result.subjectId)
        .map(a => ({
          name: a.assessmentDef.name,
          code: a.assessmentDef.code,
          rawScore: a.rawScore,
          maxScore: a.maxScore,
          percentage: a.percentage,
          grade: a.grade,
        }));

      return {
        subjectId: result.subjectId,
        subjectName: result.subject.name,
        subjectCode: result.subject.code,
        totalRawScore: result.totalRawScore,
        totalWeightedScore: result.totalWeightedScore,
        finalPercentage: result.finalPercentage,
        finalGrade: result.finalGrade,
        finalRemark: result.finalRemark,
        points: result.points,
        gpa: result.gpa,
        classRank: result.classRank,
        subjectRank: result.subjectRank,
        assessments,
      };
    });

    const termSummary = await this.prisma.termSummary.findFirst({
      where: { studentId, termId },
    });

    const attendance = await this.prisma.attendance.findMany({
      where: {
        studentId,
        date: {
          gte: term.startDate,
          lte: term.endDate,
        },
      },
    });

    const attendanceRate = attendance.length > 0
      ? (attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length / attendance.length) * 100
      : null;

    const bestSix = [...subjectBreakdown]
      .filter(s => s.points !== null)
      .sort((a, b) => (a.points ?? 99) - (b.points ?? 99))
      .slice(0, 6);

    const totalPoints = bestSix.reduce((sum, s) => sum + (s.points ?? 0), 0);

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        photoUrl: student.photoUrl,
      },
      class: {
        id: enrollment.classId,
        name: enrollment.class.name,
        level: enrollment.class.levelType?.name,
      },
      academicYear: {
        id: enrollment.academicYearId,
        name: enrollment.academicYear.name,
      },
      term: {
        id: termId,
        name: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
      },
      subjectBreakdown,
      bestSix,
      totalPoints,
      bestSixAverage: bestSix.length > 0
        ? parseFloat((bestSix.reduce((sum, s) => sum + (s.finalPercentage ?? 0), 0) / bestSix.length).toFixed(2))
        : null,
      termSummary: termSummary ? {
        overallPercentage: termSummary.overallPercentage,
        overallGrade: termSummary.overallGrade,
        overallRemark: termSummary.overallRemark,
        gpa: termSummary.gpa,
        totalPoints: termSummary.totalPoints,
        classRank: termSummary.classRank,
        classSize: termSummary.classSize,
        percentile: termSummary.percentile,
        strengths: termSummary.strengths,
        weaknesses: termSummary.weaknesses,
        teacherRemarks: termSummary.teacherRemarks,
        aiInsights: termSummary.aiInsights,
      } : null,
      attendance: {
        totalDays: attendance.length,
        presentDays: attendance.filter(a => a.status === 'PRESENT').length,
        absentDays: attendance.filter(a => a.status === 'ABSENT').length,
        lateDays: attendance.filter(a => a.status === 'LATE').length,
        attendanceRate: attendanceRate ? parseFloat(attendanceRate.toFixed(2)) : null,
      },
      generatedAt: new Date(),
    };
  }

  async generateBulkReportCards(
    classId: string,
    termId: string,
    schoolId: string,
  ) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const reportCards = [];

    for (const enrollment of enrollments) {
      try {
        const data = await this.generateReportCardData(
          enrollment.studentId,
          termId,
          schoolId,
        );
        reportCards.push(data);
      } catch (error) {
        this.logger.error(`Failed to generate report card for student ${enrollment.studentId}: ${error.message}`);
      }
    }

    this.logger.log(`Generated ${reportCards.length} report cards for class ${classId}, term ${termId}`);

    return reportCards;
  }

  async getRemarkTemplates(schoolId: string, type?: string) {
    return this.prisma.remark.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(type ? { type: type as any } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createRemark(schoolId: string, data: {
    type: string;
    text: string;
    gradeRange?: string;
    subjectId?: string;
    sortOrder?: number;
  }) {
    return this.prisma.remark.create({
      data: {
        schoolId,
        type: data.type as any,
        text: data.text,
        gradeRange: data.gradeRange,
        subjectId: data.subjectId,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async getReportCardStatus(classId: string, termId: string, schoolId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const termSummaries = await this.prisma.termSummary.findMany({
      where: {
        classId,
        termId,
        studentId: { in: enrollments.map(e => e.studentId) },
      },
    });

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        studentId: { in: enrollments.map(e => e.studentId) },
      },
    });

    const totalStudents = enrollments.length;
    const studentsWithSummary = new Set(termSummaries.map(t => t.studentId)).size;
    const studentsWithResults = new Set(computedResults.map(c => c.studentId)).size;

    return {
      classId,
      termId,
      totalStudents,
      studentsWithResults,
      studentsWithSummary,
      completionRate: totalStudents > 0 ? (studentsWithSummary / totalStudents) * 100 : 0,
      readyForPublication: studentsWithSummary === totalStudents,
    };
  }
}
