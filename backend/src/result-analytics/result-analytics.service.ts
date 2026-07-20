import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResultAnalyticsService {
  private readonly logger = new Logger(ResultAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async getClassAnalytics(classId: string, termId: string, schoolId: string) {
    let computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      },
      include: {
        subject: { select: { id: true, name: true } },
      },
    });

    if (computedResults.length === 0) {
      computedResults = await this.prisma.computedResult.findMany({
        where: {
          termId,
          schoolId,
          status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        },
        include: {
          subject: { select: { id: true, name: true } },
        },
      });
    }

    const subjectAnalytics = computedResults.reduce((acc, result) => {
      if (!acc[result.subjectId]) {
        acc[result.subjectId] = {
          subjectId: result.subjectId,
          subjectName: result.subject.name,
          scores: [],
        };
      }
      acc[result.subjectId].scores.push(result.finalPercentage ?? 0);
      return acc;
    }, {} as Record<string, any>);

    const subjectStats = Object.values(subjectAnalytics).map((subject: any) => {
      const scores = subject.scores.sort((a: number, b: number) => a - b);
      const total = scores.length;
      const sum = scores.reduce((a: number, b: number) => a + b, 0);
      const avg = sum / total;
      const median = total % 2 === 0
        ? (scores[total / 2 - 1] + scores[total / 2]) / 2
        : scores[Math.floor(total / 2)];
      const min = scores[0];
      const max = scores[total - 1];
      const variance = scores.reduce((acc: number, score: number) => acc + Math.pow(score - avg, 2), 0) / total;
      const stdDev = Math.sqrt(variance);
      const passRate = (scores.filter((s: number) => s >= 50).length / total) * 100;
      const distinctionRate = (scores.filter((s: number) => s >= 75).length / total) * 100;

      return {
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        totalStudents: total,
        average: parseFloat(avg.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(2)),
        passRate: parseFloat(passRate.toFixed(2)),
        distinctionRate: parseFloat(distinctionRate.toFixed(2)),
      };
    });

    const overallScores = computedResults.map(r => r.finalPercentage ?? 0);
    const overallAvg = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;

    const gradeDistribution = computedResults.reduce((acc, result) => {
      const grade = result.finalGrade || 'Unknown';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    await this.saveAnalytics(classId, termId, schoolId, {
      classAverage: parseFloat(overallAvg.toFixed(2)),
      subjectStats,
      gradeDistribution,
      totalStudents: new Set(computedResults.map(r => r.studentId)).size,
    });

    return {
      classId,
      termId,
      classAverage: parseFloat(overallAvg.toFixed(2)),
      subjectStats,
      gradeDistribution,
      totalStudents: new Set(computedResults.map(r => r.studentId)).size,
    };
  }

  async getTeacherAnalytics(teacherId: string, schoolId: string, termId?: string) {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId, schoolId },
      include: { class: true, subject: true },
    });

    const teacherStats = [];

    for (const assignment of assignments) {
      const whereClause: any = {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      };

      if (termId) {
        whereClause.termId = termId;
      }

      const results = await this.prisma.computedResult.findMany({
        where: whereClause,
      });

      if (results.length === 0) continue;

      const avgPercentage = results.reduce((sum, r) => sum + (r.finalPercentage ?? 0), 0) / results.length;
      const passRate = (results.filter(r => (r.finalPercentage ?? 0) >= 50).length / results.length) * 100;

      teacherStats.push({
        classId: assignment.classId,
        className: assignment.class.name,
        subjectId: assignment.subjectId,
        subjectName: assignment.subject.name,
        studentCount: results.length,
        averagePercentage: parseFloat(avgPercentage.toFixed(2)),
        passRate: parseFloat(passRate.toFixed(2)),
      });
    }

    return teacherStats;
  }

  async getStudentTrendAnalysis(studentId: string, schoolId: string) {
    const longitudinalRecords = await this.prisma.longitudinalRecord.findMany({
      where: { studentId, schoolId },
      include: {
        term: {
          select: { id: true, name: true, startDate: true },
          include: { academicYear: { select: { name: true } } },
        },
      },
      orderBy: { term: { startDate: 'asc' } },
    });

    const subjectTrends = longitudinalRecords.reduce((acc, record) => {
      if (!acc[record.subjectId]) {
        acc[record.subjectId] = {
          subjectId: record.subjectId,
          dataPoints: [],
        };
      }
      acc[record.subjectId].dataPoints.push({
        term: record.term.name,
        academicYear: record.term.academicYear.name,
        percentage: record.percentage,
        grade: record.grade,
        rank: record.rank,
      });
      return acc;
    }, {} as Record<string, any>);

    const trends = Object.values(subjectTrends).map((subject: any) => {
      const dataPoints = subject.dataPoints.filter((d: any) => d.percentage !== null);
      if (dataPoints.length < 2) {
        return { ...subject, trend: 'INSUFFICIENT_DATA', dataPoints };
      }

      const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
      const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

      const firstAvg = firstHalf.reduce((sum: number, d: any) => sum + d.percentage, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum: number, d: any) => sum + d.percentage, 0) / secondHalf.length;

      const change = secondAvg - firstAvg;
      const trend = change > 5 ? 'IMPROVING' : change < -5 ? 'DECLINING' : 'STABLE';

      return { ...subject, trend, change: parseFloat(change.toFixed(2)), dataPoints };
    });

    return {
      studentId,
      trends,
      totalTerms: longitudinalRecords.length,
    };
  }

  async getAtRiskStudents(classId: string, termId: string, schoolId: string) {
    let computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
        subject: { select: { name: true } },
      },
    });

    if (computedResults.length === 0) {
      computedResults = await this.prisma.computedResult.findMany({
        where: {
          termId,
          schoolId,
          status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
            },
          },
          subject: { select: { name: true } },
        },
      });
    }

    const studentPerformance = computedResults.reduce((acc, result) => {
      if (!acc[result.studentId]) {
        acc[result.studentId] = {
          studentId: result.studentId,
          studentName: `${result.student.firstName} ${result.student.lastName}`,
          admissionNumber: result.student.admissionNumber,
          subjects: [],
        };
      }
      acc[result.studentId].subjects.push({
        subjectName: result.subject.name,
        percentage: result.finalPercentage,
        grade: result.finalGrade,
        points: result.points,
      });
      return acc;
    }, {} as Record<string, any>);

    const atRisk = Object.values(studentPerformance)
      .map((student: any) => {
        const failingSubjects = student.subjects.filter((s: any) => {
          if (s.points !== null && s.points !== undefined) {
            return s.points >= 8;
          }
          return (s.percentage ?? 0) < 40;
        });
        const avgPercentage = student.subjects.reduce((sum: number, s: any) => sum + (s.percentage ?? 0), 0) / student.subjects.length;

        return {
          ...student,
          failingSubjects: failingSubjects.map((s: any) => s.subjectName),
          failingCount: failingSubjects.length,
          avgPercentage: parseFloat(avgPercentage.toFixed(2)),
          riskLevel: failingSubjects.length >= 3 ? 'HIGH' : failingSubjects.length >= 1 ? 'MEDIUM' : 'LOW',
        };
      })
      .filter((student: any) => student.riskLevel !== 'LOW')
      .sort((a: any, b: any) => b.failingCount - a.failingCount);

    return atRisk;
  }

  async getSchoolPerformanceOverview(schoolId: string, termId?: string) {
    const whereClause: any = { schoolId, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] } };
    if (termId) {
      whereClause.termId = termId;
    }

    const computedResults = await this.prisma.computedResult.findMany({
      where: whereClause,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
      },
    });

    const classPerformance = computedResults.reduce((acc, result) => {
      if (!acc[result.classId]) {
        acc[result.classId] = {
          classId: result.classId,
          className: result.class.name,
          scores: [],
        };
      }
      acc[result.classId].scores.push(result.finalPercentage ?? 0);
      return acc;
    }, {} as Record<string, any>);

    const classStats = Object.values(classPerformance).map((cls: any) => {
      const avg = cls.scores.reduce((a: number, b: number) => a + b, 0) / cls.scores.length;
      const passRate = (cls.scores.filter((s: number) => s >= 50).length / cls.scores.length) * 100;

      return {
        classId: cls.classId,
        className: cls.className,
        averagePercentage: parseFloat(avg.toFixed(2)),
        passRate: parseFloat(passRate.toFixed(2)),
        studentCount: cls.scores.length,
      };
    });

    return {
      schoolId,
      termId,
      totalResults: computedResults.length,
      classStats,
      overallAverage: classStats.length > 0
        ? parseFloat((classStats.reduce((sum: number, c: any) => sum + c.averagePercentage, 0) / classStats.length).toFixed(2))
        : 0,
    };
  }

  private async saveAnalytics(classId: string, termId: string, schoolId: string, data: any) {
    const metrics = [
      { type: 'CLASS_AVERAGE', name: 'Class Average', value: data.classAverage },
      { type: 'PASS_RATE', name: 'Pass Rate', value: data.subjectStats?.reduce((sum: number, s: any) => sum + s.passRate, 0) / (data.subjectStats?.length || 1) },
    ];

    for (const metric of metrics) {
      await this.prisma.assessmentAnalytics.create({
        data: {
          schoolId,
          classId,
          termId,
          metricType: metric.type as any,
          metricName: metric.name,
          metricValue: metric.value,
          metadata: data,
        },
      });
    }
  }
}
