import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(private prisma: PrismaService) {}

  async computeClassRankings(classId: string, termId: string, schoolId: string) {
    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: 'COMPUTED',
        finalPercentage: { not: null },
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
      },
    });

    const sortedByPercentage = [...computedResults]
      .filter(r => r.finalPercentage !== null)
      .sort((a, b) => (b.finalPercentage ?? 0) - (a.finalPercentage ?? 0));

    const rankings = sortedByPercentage.map((result, index) => ({
      studentId: result.studentId,
      studentName: `${result.student.firstName} ${result.student.lastName}`,
      admissionNumber: result.student.admissionNumber,
      percentage: result.finalPercentage,
      grade: result.finalGrade,
      rank: index + 1,
    }));

    await this.prisma.$transaction(
      rankings.map(ranking =>
        this.prisma.computedResult.update({
          where: {
            studentId_subjectId_termId: {
              studentId: ranking.studentId,
              subjectId: computedResults[0].subjectId,
              termId,
            },
          },
          data: { classRank: ranking.rank },
        }),
      ),
    );

    this.logger.log(`Computed rankings for ${rankings.length} students in class ${classId}, term ${termId}`);

    return rankings;
  }

  async computeSubjectRankings(subjectId: string, termId: string, classId: string, schoolId: string) {
    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        subjectId,
        termId,
        classId,
        schoolId,
        status: 'COMPUTED',
        finalPercentage: { not: null },
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
      },
      orderBy: { finalPercentage: 'desc' },
    });

    const rankings = computedResults.map((result, index) => ({
      studentId: result.studentId,
      studentName: `${result.student.firstName} ${result.student.lastName}`,
      admissionNumber: result.student.admissionNumber,
      percentage: result.finalPercentage,
      grade: result.finalGrade,
      subjectRank: index + 1,
    }));

    await this.prisma.$transaction(
      rankings.map(ranking =>
        this.prisma.computedResult.updateMany({
          where: {
            studentId: ranking.studentId,
            subjectId,
            termId,
          },
          data: { subjectRank: ranking.subjectRank },
        }),
      ),
    );

    return rankings;
  }

  async getStudentRankings(studentId: string, termId: string) {
    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        studentId,
        termId,
        status: 'COMPUTED',
      },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    });

    return computedResults.map(result => ({
      subjectId: result.subjectId,
      subjectName: result.subject.name,
      className: result.class.name,
      percentage: result.finalPercentage,
      grade: result.finalGrade,
      classRank: result.classRank,
      subjectRank: result.subjectRank,
      points: result.points,
      gpa: result.gpa,
    }));
  }

  async getTopPerformers(classId: string, termId: string, limit = 10) {
    const computedResults = await this.prisma.computedResult.groupBy({
      by: ['studentId'],
      where: {
        classId,
        termId,
        status: 'COMPUTED',
        finalPercentage: { not: null },
      },
      _avg: {
        finalPercentage: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _avg: {
          finalPercentage: 'desc',
        },
      },
      take: limit,
    });

    const studentIds = computedResults.map(r => r.studentId);
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
      },
    });

    const studentMap = new Map(students.map(s => [s.id, s]));

    return computedResults.map((result, index) => {
      const student = studentMap.get(result.studentId);
      return {
        rank: index + 1,
        studentId: result.studentId,
        studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
        admissionNumber: student?.admissionNumber,
        averagePercentage: parseFloat(result._avg.finalPercentage?.toFixed(2) ?? '0'),
        subjectCount: result._count.id,
      };
    });
  }

  async computePercentileRanks(classId: string, termId: string, schoolId: string) {
    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: 'COMPUTED',
        finalPercentage: { not: null },
      },
      select: {
        studentId: true,
        finalPercentage: true,
      },
    });

    const sorted = [...computedResults].sort((a, b) => (a.finalPercentage ?? 0) - (b.finalPercentage ?? 0));
    const total = sorted.length;

    const percentileMap = new Map<string, number>();

    sorted.forEach((result, index) => {
      const percentile = (index / total) * 100;
      percentileMap.set(result.studentId, parseFloat(percentile.toFixed(2)));
    });

    return percentileMap;
  }
}
