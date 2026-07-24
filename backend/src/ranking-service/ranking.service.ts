import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(private prisma: PrismaService) {}

  async computeClassRankings(classId: string, termId: string, schoolId: string) {
    let computedResults = await this.prisma.computedResult.findMany({
      where: {
        classId,
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      },
      select: {
        studentId: true,
        subjectId: true,
        finalPercentage: true,
        points: true,
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

    // No fallback — return empty if no computed results for this class
    if (computedResults.length === 0) {
      this.logger.warn(`No computed results found for class ${classId}, term ${termId}`);
      return [];
    }

    const studentIds = [...new Set(computedResults.map(r => r.studentId))];
    const subjectIds = [...new Set(computedResults.map(r => r.subjectId).filter(Boolean))];

    const rawResults = await this.prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        subjectId: { in: subjectIds },
        termId,
        schoolId,
      },
      select: {
        studentId: true,
        subjectId: true,
        score: true,
      },
    });

    const rawScoreMap = new Map<string, number>();
    for (const r of rawResults) {
      if (r.score != null) {
        rawScoreMap.set(`${r.studentId}::${r.subjectId}`, r.score);
      }
    }

    const studentMap = new Map<string, {
      studentId: string;
      firstName: string;
      lastName: string;
      admissionNumber: string;
      totalPercentage: number;
      subjectCount: number;
      points: number[];
    }>();

    for (const r of computedResults) {
      const existing = studentMap.get(r.studentId);

      let effectivePercentage = r.finalPercentage;
      if (effectivePercentage == null || effectivePercentage === 0) {
        const rawScore = r.subjectId ? rawScoreMap.get(`${r.studentId}::${r.subjectId}`) : undefined;
        if (rawScore != null) {
          effectivePercentage = rawScore;
        }
      }

      const points = r.points ?? (effectivePercentage != null
        ? effectivePercentage >= 75 ? 1
          : effectivePercentage >= 65 ? 2
          : effectivePercentage >= 50 ? 3
          : effectivePercentage >= 40 ? 4
          : 5
        : 0);
      if (existing) {
        existing.totalPercentage += effectivePercentage ?? 0;
        existing.subjectCount += 1;
        if (points > 0) existing.points.push(points);
      } else {
        studentMap.set(r.studentId, {
          studentId: r.studentId,
          firstName: r.student.firstName,
          lastName: r.student.lastName,
          admissionNumber: r.student.admissionNumber,
          totalPercentage: effectivePercentage ?? 0,
          subjectCount: 1,
          points: points > 0 ? [points] : [],
        });
      }
    }

    const studentList = Array.from(studentMap.values()).map(s => {
      const avg = s.subjectCount > 0 ? s.totalPercentage / s.subjectCount : 0;
      const sortedPoints = [...s.points].sort((a, b) => a - b);
      const bestSix = sortedPoints.slice(0, 6);
      const totalPoints = bestSix.length > 0 ? bestSix.reduce((sum, p) => sum + p, 0) : 0;
      let grade = 'E';
      if (avg >= 75) grade = 'A';
      else if (avg >= 65) grade = 'B';
      else if (avg >= 50) grade = 'C';
      else if (avg >= 40) grade = 'D';
      return {
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNumber: s.admissionNumber,
        average: parseFloat(avg.toFixed(2)),
        totalPercentage: parseFloat(avg.toFixed(2)),
        percentage: parseFloat(avg.toFixed(2)),
        grade,
        totalPoints,
        subjectCount: s.subjectCount,
      };
    });

    studentList.sort((a, b) => {
      if (a.totalPoints !== b.totalPoints) return a.totalPoints - b.totalPoints;
      return b.average - a.average;
    });

    const rankings = studentList.map((s, index) => ({
      ...s,
      rank: index + 1,
    }));

    this.logger.log(`Computed rankings for ${rankings.length} students in class ${classId}, term ${termId}`);

    return rankings;
  }

  async computeSubjectRankings(subjectId: string, termId: string, classId: string, schoolId: string) {
    let computedResults = await this.prisma.computedResult.findMany({
      where: {
        subjectId,
        termId,
        classId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      },
      select: {
        studentId: true,
        subjectId: true,
        finalPercentage: true,
        finalGrade: true,
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

    if (computedResults.length === 0) {
      return [];
    }

    const studentIds = [...new Set(computedResults.map(r => r.studentId))];

    const rawResults = await this.prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        subjectId,
        termId,
        schoolId,
      },
      select: {
        studentId: true,
        score: true,
      },
    });

    const rawScoreMap = new Map<string, number>();
    for (const r of rawResults) {
      if (r.score != null) {
        rawScoreMap.set(r.studentId, r.score);
      }
    }

    const rankings = computedResults.map((result, index) => {
      let effectivePercentage = result.finalPercentage;
      if (effectivePercentage == null || effectivePercentage === 0) {
        const rawScore = rawScoreMap.get(result.studentId);
        if (rawScore != null) {
          effectivePercentage = rawScore;
        }
      }
      return {
        studentId: result.studentId,
        firstName: result.student.firstName,
        lastName: result.student.lastName,
        studentName: `${result.student.firstName} ${result.student.lastName}`,
        admissionNumber: result.student.admissionNumber,
        percentage: effectivePercentage,
        grade: result.finalGrade,
        subjectRank: index + 1,
      };
    });

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
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
      },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    });

    const subjectIds = [...new Set(computedResults.map(r => r.subjectId).filter(Boolean))];

    const rawResults = await this.prisma.result.findMany({
      where: {
        studentId,
        subjectId: { in: subjectIds },
        termId,
      },
      select: {
        subjectId: true,
        score: true,
      },
    });

    const rawScoreMap = new Map<string, number>();
    for (const r of rawResults) {
      if (r.score != null) {
        rawScoreMap.set(r.subjectId, r.score);
      }
    }

    return computedResults.map(result => {
      let effectivePercentage = result.finalPercentage;
      if (effectivePercentage == null || effectivePercentage === 0) {
        const rawScore = rawScoreMap.get(result.subjectId);
        if (rawScore != null) {
          effectivePercentage = rawScore;
        }
      }
      return {
        subjectId: result.subjectId,
        subjectName: result.subject.name,
        className: result.class.name,
        percentage: effectivePercentage,
        grade: result.finalGrade,
        classRank: result.classRank,
        subjectRank: result.subjectRank,
        points: result.points,
        gpa: result.gpa,
      };
    });
  }

  async getTopPerformers(classId: string, termId: string, limit = 10) {
    const computedResults = await this.prisma.computedResult.groupBy({
      by: ['studentId'],
      where: {
        classId,
        termId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
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
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
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
