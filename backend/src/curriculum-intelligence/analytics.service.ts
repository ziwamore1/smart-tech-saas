import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async getSubjectPerformanceAnalytics(subjectId: string, schoolId?: string, classId?: string) {
    const where: any = { subjectId };
    if (schoolId) where.schoolId = schoolId;
    if (classId) where.classId = classId;

    const results = await this.prisma.result.findMany({
      where,
      include: { student: true },
      take: 1000,
    });

    const scores = results.map(r => r.score || 0).filter(s => s > 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    const passMark = 40;
    const passed = scores.filter(s => s >= passMark).length;
    const passRate = scores.length > 0 ? (passed / scores.length) * 100 : 0;

    const distribution = [
      { range: '0-39', count: scores.filter(s => s < 40).length, percent: scores.length > 0 ? (scores.filter(s => s < 40).length / scores.length) * 100 : 0 },
      { range: '40-59', count: scores.filter(s => s >= 40 && s < 60).length, percent: scores.length > 0 ? (scores.filter(s => s >= 40 && s < 60).length / scores.length) * 100 : 0 },
      { range: '60-79', count: scores.filter(s => s >= 60 && s < 80).length, percent: scores.length > 0 ? (scores.filter(s => s >= 60 && s < 80).length / scores.length) * 100 : 0 },
      { range: '80-100', count: scores.filter(s => s >= 80).length, percent: scores.length > 0 ? (scores.filter(s => s >= 80).length / scores.length) * 100 : 0 },
    ];

    return {
      subjectId,
      totalStudents: results.length,
      averageScore: Math.round(avgScore * 10) / 10,
      maxScore,
      minScore,
      passRate: Math.round(passRate * 10) / 10,
      distribution,
      topPerformers: results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map(r => ({
        student: r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Unknown',
        score: r.score,
      })),
    };
  }

  async getCurriculumCompliance(schoolId: string) {
    const classes = await this.prisma.class.findMany({ where: { schoolId }, include: { classSubjects: { include: { subject: true } } } });

    const complianceData = [];
    for (const cls of classes) {
      for (const cs of cls.classSubjects) {
        const coverage = await this.prisma.curriculumCoverage.findMany({
          where: { classId: cls.id, subjectId: cs.subjectId },
        });
        const totalTopics = await this.prisma.topic.count({ where: { subjectId: cs.subjectId } });
        const coveredTopics = new Set(coverage.filter(c => c.isCovered).map(c => c.topicId)).size;
        const sbaTasks = await this.prisma.sbaTask.count({ where: { subjectId: cs.subjectId } });

        complianceData.push({
          class: cls.name,
          subject: cs.subject.name,
          totalTopics,
          coveredTopics,
          coveragePercent: totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0,
          sbaTasks,
          status: totalTopics > 0 ? (coveredTopics / totalTopics) >= 0.75 ? 'ON_TRACK' : (coveredTopics / totalTopics) >= 0.5 ? 'NEEDS_ATTENTION' : 'BEHIND' : 'NO_DATA',
        });
      }
    }

    const overallCoverage = complianceData.length > 0
      ? complianceData.reduce((s, d) => s + d.coveragePercent, 0) / complianceData.length
      : 0;

    return {
      schoolId,
      overallCoverage: Math.round(overallCoverage),
      onTrack: complianceData.filter(d => d.status === 'ON_TRACK').length,
      needsAttention: complianceData.filter(d => d.status === 'NEEDS_ATTENTION').length,
      behind: complianceData.filter(d => d.status === 'BEHIND').length,
      details: complianceData.sort((a, b) => a.coveragePercent - b.coveragePercent),
    };
  }
}
