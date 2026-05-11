import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DiagnosticAnalysisService {
  constructor(private prisma: PrismaService) {}

  async getCompetencyDiagnosis(schoolId: string, studentId: string, termId: string) {
    const scores = await this.prisma.competencyScore.findMany({
      where: { studentId, termId, schoolId },
      include: { learningArea: { include: { subject: true } } },
    });

    if (!scores.length) {
      return { error: 'No competency scores found. Please record learning area assessments first.' };
    }

    const bySubject: Record<string, { subjectName: string; areas: any[]; average: number }> = {};
    for (const s of scores) {
      const key = s.learningArea.subjectId;
      if (!bySubject[key]) {
        bySubject[key] = { subjectName: s.learningArea.subject.name, areas: [], average: 0 };
      }
      bySubject[key].areas.push({
        learningAreaId: s.learningArea.id,
        learningArea: s.learningArea.name,
        score: s.score,
        status: this.classifyCompetency(s.score),
        gap: Number((100 - s.score).toFixed(2)),
      });
    }

    for (const key of Object.keys(bySubject)) {
      const subject = bySubject[key];
      subject.average = Number(
        (subject.areas.reduce((sum, a) => sum + a.score, 0) / subject.areas.length).toFixed(2),
      );
    }

    const allAreas = scores.map(s => ({
      area: s.learningArea.name,
      subject: s.learningArea.subject.name,
      score: s.score,
      status: this.classifyCompetency(s.score),
    }));

    const weakest = allAreas.sort((a, b) => a.score - b.score).slice(0, 5);
    const strongest = allAreas.sort((a, b) => b.score - a.score).slice(0, 5);

    return {
      studentId,
      termId,
      summary: {
        totalAreas: allAreas.length,
        criticalWeaknesses: allAreas.filter(a => a.status === 'CRITICAL').length,
        needsReinforcement: allAreas.filter(a => a.status === 'NEEDS_REINFORCEMENT').length,
        acceptable: allAreas.filter(a => a.status === 'ACCEPTABLE').length,
        strong: allAreas.filter(a => a.status === 'STRONG').length,
      },
      bySubject,
      weakestAreas: weakest,
      strongestAreas: strongest,
      diagnosis: this.generateDiagnosis(weakest, strongest),
    };
  }

  async getClassCompetencyOverview(schoolId: string, classId: string, termId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const scores = await this.prisma.competencyScore.findMany({
      where: {
        studentId: { in: enrollments.map(e => e.studentId) },
        termId,
        schoolId,
      },
      include: { learningArea: { include: { subject: true } } },
    });

    if (!scores.length) return { error: 'No competency data for this class' };

    const areaMap = new Map<string, { name: string; subject: string; scores: number[] }>();
    for (const s of scores) {
      const key = s.learningAreaId;
      const existing = areaMap.get(key) || {
        name: s.learningArea.name,
        subject: s.learningArea.subject.name,
        scores: [],
      };
      existing.scores.push(s.score);
      areaMap.set(key, existing);
    }

    const heatmap = Array.from(areaMap.entries()).map(([id, data]) => {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      return {
        learningAreaId: id,
        learningArea: data.name,
        subject: data.subject,
        classAverage: Number(avg.toFixed(2)),
        status: this.classifyCompetency(avg),
        min: Math.min(...data.scores),
        max: Math.max(...data.scores),
        studentCount: data.scores.length,
      };
    });

    const criticalAreas = heatmap.filter(h => h.status === 'CRITICAL');
    const weakAreas = heatmap.filter(h => h.status === 'NEEDS_REINFORCEMENT');

    return {
      heatmap,
      criticalAreas,
      weakAreas,
      classDiagnosis: {
        totalLearningAreas: heatmap.length,
        criticalCount: criticalAreas.length,
        weakCount: weakAreas.length,
        overallHealth: this.overallHealthRating(heatmap),
        recommendedFocus: weakAreas.concat(criticalAreas).map(a => a.learningArea),
      },
    };
  }

  async getStudentWeaknessProfile(schoolId: string, studentId: string) {
    const scores = await this.prisma.competencyScore.findMany({
      where: { studentId, schoolId },
      include: { learningArea: { include: { subject: true } }, term: { include: { academicYear: true } } },
      orderBy: { term: { startDate: 'desc' } },
    });

    if (!scores.length) return { error: 'No competency data available' };

    const areaProgress: Record<string, { name: string; subject: string; scores: { term: string; score: number }[] }> = {};
    for (const s of scores) {
      const key = s.learningAreaId;
      if (!areaProgress[key]) {
        areaProgress[key] = { name: s.learningArea.name, subject: s.learningArea.subject.name, scores: [] };
      }
      areaProgress[key].scores.push({
        term: `${s.term.name} ${s.term.academicYear.name}`,
        score: s.score,
      });
    }

    const weaknesses: Array<{
      learningArea: string;
      subject: string;
      currentScore: number;
      trend: string;
      recommendation: string;
    }> = [];

    for (const [, data] of Object.entries(areaProgress)) {
      const recent = data.scores.slice(-3);
      if (recent.length === 0) continue;
      const current = recent[recent.length - 1].score;
      if (current < 60) {
        const trend = recent.length >= 2
          ? recent[recent.length - 1].score - recent[0].score
          : 0;
        weaknesses.push({
          learningArea: data.name,
          subject: data.subject,
          currentScore: current,
          trend: trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable',
          recommendation: this.getWeaknessRecommendation(data.name, current, data.subject),
        });
      }
    }

    return {
      studentId,
      weaknesses: weaknesses.sort((a, b) => a.currentScore - b.currentScore),
      areaProgress,
      summary: {
        totalWeaknesses: weaknesses.length,
        criticalCount: weaknesses.filter(w => w.currentScore < 40).length,
        improvingCount: weaknesses.filter(w => w.trend === 'improving').length,
        decliningCount: weaknesses.filter(w => w.trend === 'declining').length,
      },
    };
  }

  async getCrossSubjectDiagnosis(schoolId: string, studentId: string) {
    const results = await this.prisma.result.findMany({
      where: { studentId, schoolId },
      include: { subject: true, term: { include: { academicYear: true } } },
      orderBy: [{ term: { academicYear: { startDate: 'asc' } } }, { term: { startDate: 'asc' } }],
    });

    if (!results.length) return { error: 'No results found' };

    const bySubject: Record<string, { subjectName: string; scores: number[]; trends: string[] }> = {};
    for (const r of results) {
      if (!bySubject[r.subjectId]) {
        bySubject[r.subjectId] = { subjectName: r.subject.name, scores: [], trends: [] };
      }
      bySubject[r.subjectId].scores.push(r.score);
    }

    const assessments: Array<{
      subject: string;
      average: number;
      trend: string;
      consistency: string;
      flag: string;
    }> = [];

    for (const [, data] of Object.entries(bySubject)) {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const trend = data.scores.length >= 2
        ? data.scores[data.scores.length - 1] - data.scores[0]
        : 0;
      const variance = Math.sqrt(
        data.scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / data.scores.length,
      );

      let flag = 'NORMAL';
      if (avg < 50) flag = 'CRITICAL';
      else if (avg < 60) flag = 'WARNING';
      else if (trend < -10) flag = 'DECLINING';

      assessments.push({
        subject: data.subjectName,
        average: Number(avg.toFixed(2)),
        trend: trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable',
        consistency: variance < 10 ? 'consistent' : variance < 20 ? 'variable' : 'erratic',
        flag,
      });
    }

    const literacySubjects = ['English', 'Literacy', 'Language'];
    const numeracySubjects = ['Mathematics', 'Numeracy', 'Science'];

    const literacyAvg = assessments
      .filter(a => literacySubjects.some(l => a.subject.toLowerCase().includes(l.toLowerCase())))
      .reduce((sum, a) => sum + a.average, 0) / (assessments.filter(a => literacySubjects.some(l => a.subject.toLowerCase().includes(l.toLowerCase()))).length || 1);

    const numeracyAvg = assessments
      .filter(a => numeracySubjects.some(n => a.subject.toLowerCase().includes(n.toLowerCase())))
      .reduce((sum, a) => sum + a.average, 0) / (assessments.filter(a => numeracySubjects.some(n => a.subject.toLowerCase().includes(n.toLowerCase()))).length || 1);

    const crossImpacts: string[] = [];
    if (literacyAvg < 60) {
      crossImpacts.push('Weak literacy skills may be affecting performance in other subjects that require reading comprehension');
    }
    if (numeracyAvg < 60) {
      crossImpacts.push('Weak numeracy skills may be affecting performance in science and analytical subjects');
    }

    return {
      studentId,
      subjectAssessments: assessments,
      crossCuttingInsights: crossImpacts,
      foundationalSkills: {
        literacyAverage: Number(literacyAvg.toFixed(2)),
        numeracyAverage: Number(numeracyAvg.toFixed(2)),
        literacyFlag: literacyAvg < 50 ? 'CRITICAL' : literacyAvg < 60 ? 'WARNING' : 'ACCEPTABLE',
        numeracyFlag: numeracyAvg < 50 ? 'CRITICAL' : numeracyAvg < 60 ? 'WARNING' : 'ACCEPTABLE',
      },
    };
  }

  private classifyCompetency(score: number): string {
    if (score >= 80) return 'STRONG';
    if (score >= 60) return 'ACCEPTABLE';
    if (score >= 40) return 'NEEDS_REINFORCEMENT';
    return 'CRITICAL';
  }

  private overallHealthRating(heatmap: Array<{ status: string }>): string {
    const critical = heatmap.filter(h => h.status === 'CRITICAL').length;
    const weak = heatmap.filter(h => h.status === 'NEEDS_REINFORCEMENT').length;
    const total = heatmap.length;

    if (critical / total > 0.3) return 'CRITICAL';
    if (weak / total > 0.3) return 'NEEDS_ATTENTION';
    if (critical > 0) return 'MONITORING_REQUIRED';
    return 'HEALTHY';
  }

  private generateDiagnosis(weakest: any[], strongest: any[]): string {
    const parts: string[] = [];
    if (weakest.length) {
      const criticalAreas = weakest.filter(w => w.status === 'CRITICAL').map(w => w.area);
      if (criticalAreas.length) {
        parts.push(`Critical weaknesses identified in: ${criticalAreas.join(', ')}.`);
      }
      parts.push(`Priority intervention needed for: ${weakest.slice(0, 3).map(w => `${w.area} (${w.score}%)`).join(', ')}.`);
    }
    if (strongest.length) {
      parts.push(`Strengths: ${strongest.slice(0, 3).map(s => `${s.area} (${s.score}%)`).join(', ')}.`);
    }
    return parts.join(' ') || 'Insufficient diagnostic data.';
  }

  private getWeaknessRecommendation(area: string, score: number, subject: string): string {
    if (score < 40) return `Critical weakness in ${area}. Requires intensive remedial intervention and one-on-one support in ${subject}.`;
    if (score < 50) return `Below expectations in ${area}. Recommend targeted practice exercises and additional instructional support in ${subject}.`;
    return `Developing competence in ${area}. Needs reinforcement through additional practice and review exercises in ${subject}.`;
  }
}
