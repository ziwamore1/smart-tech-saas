import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RecommendationService {
  constructor(private prisma: PrismaService) {}

  async getStudentRecommendations(schoolId: string, studentId: string, termId: string) {
    const results = await this.prisma.result.findMany({
      where: { studentId, termId, schoolId },
      include: { subject: true },
    });

    if (!results.length) return { error: 'No results to base recommendations on' };

    const recommendations: Array<{
      category: string;
      issue: string;
      recommendation: string;
      priority: string;
    }> = [];

    for (const r of results) {
      if (r.score < 40) {
        recommendations.push({
          category: 'ACADEMIC',
          issue: `Critical failure in ${r.subject.name}`,
          recommendation: `Immediate intervention required for ${r.subject.name}. Assign intensive remedial exercises and schedule one-on-one tutoring sessions. Consider parental involvement meeting.`,
          priority: 'CRITICAL',
        });
      } else if (r.score < 50) {
        recommendations.push({
          category: 'ACADEMIC',
          issue: `Below pass mark in ${r.subject.name}`,
          recommendation: `Provide additional practice materials and targeted revision for ${r.subject.name}. Monitor progress weekly.`,
          priority: 'HIGH',
        });
      } else if (r.score < 65) {
        recommendations.push({
          category: 'ACADEMIC',
          issue: `Average performance in ${r.subject.name}`,
          recommendation: `Encourage additional practice in ${r.subject.name} to strengthen understanding. Consider peer study groups.`,
          priority: 'MEDIUM',
        });
      }
    }

    const competencyScores = await this.prisma.competencyScore.findMany({
      where: { studentId, termId, schoolId },
      include: { learningArea: true },
    });

    for (const cs of competencyScores) {
      if (cs.score < 40) {
        recommendations.push({
          category: 'COMPETENCY',
          issue: `Critical weakness in ${cs.learningArea.name}`,
          recommendation: `Targeted remediation in ${cs.learningArea.name} is essential. Provide focused exercises and foundational concept review.`,
          priority: 'CRITICAL',
        });
      } else if (cs.score < 60) {
        recommendations.push({
          category: 'COMPETENCY',
          issue: `Developing competency in ${cs.learningArea.name}`,
          recommendation: `Reinforce ${cs.learningArea.name} through structured practice and application exercises.`,
          priority: 'MEDIUM',
        });
      }
    }

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: { studentId, schoolId },
    });

    if (attendanceRecords.length > 0) {
      const absentRate = attendanceRecords.filter(a => a.status === 'ABSENT').length / attendanceRecords.length;
      if (absentRate > 0.2) {
        recommendations.push({
          category: 'ATTENDANCE',
          issue: `Low attendance rate (${(100 - absentRate * 100).toFixed(0)}%)`,
          recommendation: 'Investigate reasons for absenteeism. Engage parents and implement attendance improvement plan. Monitor daily attendance.',
          priority: 'HIGH',
        });
      }
    }

    const interventions = await this.prisma.studentIntervention.findMany({
      where: { studentId, schoolId },
      include: { intervention: true },
      orderBy: { assignedAt: 'desc' },
      take: 5,
    });

    for (const inv of interventions) {
      if (inv.outcome === 'STABLE' || inv.outcome === 'DECLINED') {
        recommendations.push({
          category: 'INTERVENTION',
          issue: `${inv.intervention.name} had limited effectiveness`,
          recommendation: 'Re-evaluate intervention approach. Consider alternative strategies or increased support intensity.',
          priority: 'MEDIUM',
        });
      }
    }

    return {
      studentId,
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
      }),
      summary: {
        total: recommendations.length,
        critical: recommendations.filter(r => r.priority === 'CRITICAL').length,
        high: recommendations.filter(r => r.priority === 'HIGH').length,
        medium: recommendations.filter(r => r.priority === 'MEDIUM').length,
      },
    };
  }

  async getClassInterventionNeeds(schoolId: string, classId: string, termId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const results = await this.prisma.result.findMany({
      where: {
        studentId: { in: enrollments.map(e => e.studentId) },
        termId,
        schoolId,
      },
      include: { subject: true, student: true },
    });

    const subjectNeeds: Record<string, { subjectName: string; failingCount: number; totalCount: number; average: number }> = {};
    for (const r of results) {
      if (!subjectNeeds[r.subjectId]) {
        subjectNeeds[r.subjectId] = { subjectName: r.subject.name, failingCount: 0, totalCount: 0, average: 0 };
      }
      subjectNeeds[r.subjectId].totalCount++;
      subjectNeeds[r.subjectId].average += r.score;
      if (r.score < 50) subjectNeeds[r.subjectId].failingCount++;
    }

    for (const key of Object.keys(subjectNeeds)) {
      const s = subjectNeeds[key];
      s.average = Number((s.average / s.totalCount).toFixed(2));
    }

    const classWideIssues: Array<{ subject: string; issue: string; recommendation: string; urgency: string }> = [];
    for (const [, data] of Object.entries(subjectNeeds)) {
      const failRate = (data.failingCount / data.totalCount) * 100;
      if (failRate > 30) {
        classWideIssues.push({
          subject: data.subjectName,
          issue: `${failRate.toFixed(0)}% of students failing ${data.subjectName}`,
          recommendation: `Whole-class remediation in ${data.subjectName} recommended. Consider re-teaching key concepts and adjusting instructional approach.`,
          urgency: failRate > 50 ? 'CRITICAL' : 'HIGH',
        });
      } else if (data.average < 55) {
        classWideIssues.push({
          subject: data.subjectName,
          issue: `Low class average (${data.average}%) in ${data.subjectName}`,
          recommendation: `Targeted support and additional practice for ${data.subjectName}. Review assessment alignment with curriculum.`,
          urgency: 'MEDIUM',
        });
      }
    }

    const atRiskStudents = results
      .filter(r => r.score < 50)
      .reduce<Record<string, { name: string; failingSubjects: string[] }>>((acc, r) => {
        const sid = r.studentId;
        if (!acc[sid]) {
          acc[sid] = { name: `${r.student.firstName} ${r.student.lastName}`, failingSubjects: [] };
        }
        acc[sid].failingSubjects.push(r.subject.name);
        return acc;
      }, {});

    return {
      classId,
      classWideIssues,
      atRiskStudents: Object.entries(atRiskStudents).map(([id, data]) => ({
        studentId: id,
        studentName: data.name,
        failingSubjects: [...new Set(data.failingSubjects)],
        needs: data.failingSubjects.length > 2 ? 'COMPREHENSIVE_SUPPORT' : 'TARGETED_SUPPORT',
      })),
      priorityAreas: classWideIssues.filter(i => i.urgency === 'CRITICAL').map(i => i.subject),
    };
  }

  async suggestInterventions(schoolId: string, studentId: string) {
    const results = await this.prisma.result.findMany({
      where: { studentId, schoolId },
      include: { subject: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const recommendations = await this.getStudentRecommendations(schoolId, studentId, results[0]?.termId || '');

    const existingInterventions = await this.prisma.studentIntervention.findMany({
      where: { studentId, schoolId },
      include: { intervention: true },
    });

    const suggestedInterventions: Array<{
      name: string;
      description: string;
      category: string;
      priority: string;
      expectedImpact: string;
    }> = [];

    const failingCount = results.filter(r => r.score < 50).length;
    const avg = results.length ? results.reduce((a, b) => a + b.score, 0) / results.length : 0;
    const existingNames = new Set(existingInterventions.map(i => i.intervention.name));

    if (avg < 50 && !existingNames.has('Comprehensive Academic Support')) {
      suggestedInterventions.push({
        name: 'Comprehensive Academic Support',
        description: 'Holistic academic intervention including remedial classes, tutoring, and progress monitoring across all subjects.',
        category: 'ACADEMIC',
        priority: 'CRITICAL',
        expectedImpact: 'Expected 15-20% improvement in overall scores over one term',
      });
    }

    if (failingCount >= 3 && !existingNames.has('Subject-Specific Remediation')) {
      suggestedInterventions.push({
        name: 'Subject-Specific Remediation',
        description: `Targeted remediation for failing subjects: ${results.filter(r => r.score < 50).map(r => r.subject.name).join(', ')}`,
        category: 'ACADEMIC',
        priority: 'HIGH',
        expectedImpact: 'Expected 10-15% improvement in targeted subjects',
      });
    }

    const weakCompetencies = await this.prisma.competencyScore.findMany({
      where: { studentId, schoolId, score: { lt: 50 } },
      include: { learningArea: true },
      take: 5,
    });

    if (weakCompetencies.length > 0 && !existingNames.has('Competency-Based Intervention')) {
      suggestedInterventions.push({
        name: 'Competency-Based Intervention',
        description: `Focused intervention on weak competencies: ${weakCompetencies.map(c => c.learningArea.name).join(', ')}`,
        category: 'ACADEMIC',
        priority: 'HIGH',
        expectedImpact: 'Expected mastery improvement in targeted competencies',
      });
    }

    const attendance = await this.prisma.attendance.findMany({
      where: { studentId, schoolId },
    });

    if (attendance.length > 0) {
      const absentRate = attendance.filter(a => a.status === 'ABSENT').length / attendance.length;
      if (absentRate > 0.15 && !existingNames.has('Attendance Improvement Plan')) {
        suggestedInterventions.push({
          name: 'Attendance Improvement Plan',
          description: 'Parent engagement, attendance monitoring, and incentive system to improve school attendance.',
          category: 'ATTENDANCE',
          priority: 'HIGH',
          expectedImpact: 'Expected attendance rate improvement to above 90%',
        });
      }
    }

    if (avg < 60 && !existingNames.has('Peer Tutoring Program')) {
      suggestedInterventions.push({
        name: 'Peer Tutoring Program',
        description: 'Structured peer tutoring sessions with high-performing students to provide collaborative learning support.',
        category: 'ACADEMIC',
        priority: 'MEDIUM',
        expectedImpact: 'Expected 5-10% improvement through peer learning',
      });
    }

    if (!existingNames.has('Parent-Teacher Partnership')) {
      suggestedInterventions.push({
        name: 'Parent-Teacher Partnership',
        description: 'Regular parent-teacher meetings, progress reports, and home support guidelines.',
        category: 'PARENTAL',
        priority: 'MEDIUM',
        expectedImpact: 'Improved home support and student accountability',
      });
    }

    return {
      studentId,
      currentMetrics: {
        average: Number(avg.toFixed(2)),
        failingSubjects: failingCount,
        existingInterventions: existingInterventions.length,
      },
      currentRecommendations: recommendations.recommendations || [],
      suggestedInterventions,
    };
  }
}
