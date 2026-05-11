import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DescriptiveStatsService } from './descriptive-stats.service';
import { TrendAnalysisService } from './trend-analysis.service';
import { DiagnosticAnalysisService } from './diagnostic-analysis.service';

@Injectable()
export class NarrativeReportService {
  constructor(
    private prisma: PrismaService,
    private descriptiveStats: DescriptiveStatsService,
    private trendAnalysis: TrendAnalysisService,
    private diagnosticAnalysis: DiagnosticAnalysisService,
  ) {}

  async generateStudentNarrativeReport(schoolId: string, studentId: string, termId: string) {
    const [results, student, term, stats, trajectory, diagnosis] = await Promise.all([
      this.prisma.result.findMany({
        where: { studentId, termId, schoolId },
        include: { subject: true },
      }),
      this.prisma.student.findUnique({ where: { id: studentId } }),
      this.prisma.term.findUnique({
        where: { id: termId },
        include: { academicYear: true },
      }),
      this.descriptiveStats.getStudentStats(schoolId, studentId).catch(() => null),
      this.trendAnalysis.getStudentGrowthTrajectory(schoolId, studentId).catch(() => null),
      this.diagnosticAnalysis.getCompetencyDiagnosis(schoolId, studentId, termId).catch(() => null),
    ]);

    if (!results.length || !student) {
      return { error: 'Insufficient data to generate report' };
    }

    const scores = results.map(r => r.score);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const passed = results.filter(r => r.score >= 50).length;
    const failed = results.filter(r => r.score < 50).length;
    const bestSubject = results.reduce((best, r) => r.score > (best?.score || 0) ? r : best, results[0]);
    const worstSubject = results.reduce((worst, r) => r.score < (worst?.score || 100) ? r : worst, results[0]);

    const sections: string[] = [];

    if (stats && !stats.error) {
      sections.push(this.generatePerformanceOverview(average, passed, failed, results.length, stats));
    } else {
      sections.push(`In the ${term?.name || 'current'} term, the student sat for ${results.length} subjects, achieving an average score of ${average.toFixed(1)}%.`);
    }

    sections.push(this.generateSubjectBreakdown(results, bestSubject, worstSubject));

    if (diagnosis && !diagnosis.error) {
      sections.push(this.generateDiagnosticInsight(diagnosis));
    }

    if (trajectory && !('error' in trajectory) && trajectory.trajectory?.length >= 2) {
      sections.push(this.generateTrendNarrative(trajectory));
    }

    if (stats && !stats.error) {
      sections.push(this.generateComparativeAnalysis(stats));
    }

    sections.push(this.generateConclusion(average, trajectory));

    return {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      term: `${term?.name} ${term?.academicYear?.name || ''}`,
      generatedAt: new Date().toISOString(),
      report: sections.join('\n\n'),
      metrics: {
        average: Number(average.toFixed(2)),
        passRate: Number(((passed / results.length) * 100).toFixed(2)),
        subjectsTaken: results.length,
        subjectsPassed: passed,
        subjectsFailed: failed,
        bestSubject: bestSubject.subject.name,
        worstSubject: worstSubject.subject.name,
      },
    };
  }

  async generateClassNarrativeReport(schoolId: string, classId: string, termId: string) {
    const [results, classEntity, term] = await Promise.all([
      this.prisma.result.findMany({
        where: {
          termId,
          schoolId,
          student: { enrollments: { some: { classId, status: 'ACTIVE' } } },
        },
        include: { student: true, subject: true },
      }),
      this.prisma.class.findUnique({ where: { id: classId } }),
      this.prisma.term.findUnique({
        where: { id: termId },
        include: { academicYear: true },
      }),
    ]);

    if (!results.length) return { error: 'No data to generate report' };

    const scores = results.map(r => r.score);
    const classAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const passRate = (scores.filter(s => s >= 50).length / scores.length) * 100;

    const bySubject: Record<string, number[]> = {};
    for (const r of results) {
      if (!bySubject[r.subjectId]) bySubject[r.subjectId] = [];
      bySubject[r.subjectId].push(r.score);
    }

    const subjectSummary = Object.entries(bySubject).map(([id, subjScores]) => ({
      subject: results.find(r => r.subjectId === id)?.subject.name || 'Unknown',
      average: Number((subjScores.reduce((a, b) => a + b, 0) / subjScores.length).toFixed(2)),
      passRate: Number(((subjScores.filter(s => s >= 50).length / subjScores.length) * 100).toFixed(2)),
    })).sort((a, b) => a.average - b.average);

    const weakestSubject = subjectSummary[0];
    const strongestSubject = subjectSummary[subjectSummary.length - 1];

    const studentAverages = new Map<string, number[]>();
    for (const r of results) {
      const arr = studentAverages.get(r.studentId) || [];
      arr.push(r.score);
      studentAverages.set(r.studentId, arr);
    }

    const avgArr = Array.from(studentAverages.values()).map(s => s.reduce((a, b) => a + b, 0) / s.length);
    const topStudents = Array.from(studentAverages.entries())
      .map(([id, s]) => ({ id, avg: s.reduce((a, b) => a + b, 0) / s.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);

    const bottomStudents = Array.from(studentAverages.entries())
      .map(([id, s]) => ({ id, avg: s.reduce((a, b) => a + b, 0) / s.length }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3);

    const report = `
Class Performance Report: ${classEntity?.name || 'Unknown'} - ${term?.name} ${term?.academicYear?.name || ''}

The class achieved an average score of ${classAvg.toFixed(1)}% with a pass rate of ${passRate.toFixed(1)}%. A total of ${results.length} results were recorded across ${Object.keys(bySubject).length} subjects for ${studentAverages.size} students.

Subject Performance:
${subjectSummary.map(s => `  - ${s.subject}: Average ${s.average}%, Pass Rate ${s.passRate}%`).join('\n')}

${weakestSubject ? `The weakest performing subject is ${weakestSubject.subject} with an average of ${weakestSubject.average}%.` : ''}
${strongestSubject ? `The strongest performing subject is ${strongestSubject.subject} with an average of ${strongestSubject.average}%.` : ''}

Top Performing Students:
${topStudents.map((s, i) => `  ${i + 1}. ${results.find(r => r.studentId === s.id)?.student.firstName} ${results.find(r => r.studentId === s.id)?.student.lastName} - ${s.avg.toFixed(1)}%`).join('\n')}

Students Requiring Support:
${bottomStudents.map(s => `  - ${results.find(r => r.studentId === s.id)?.student.firstName} ${results.find(r => r.studentId === s.id)?.student.lastName} (${s.avg.toFixed(1)}%)`).join('\n')}

Recommendation: Focus on improving performance in ${weakestSubject?.subject || 'subjects with lower averages'} through targeted interventions and additional instructional support.`.trim();

    return {
      classId,
      className: classEntity?.name,
      term: `${term?.name} ${term?.academicYear?.name || ''}`,
      generatedAt: new Date().toISOString(),
      report,
      metrics: {
        classAverage: Number(classAvg.toFixed(2)),
        passRate: Number(passRate.toFixed(2)),
        totalStudents: studentAverages.size,
        totalSubjects: Object.keys(bySubject).length,
        strongestSubject: strongestSubject?.subject,
        weakestSubject: weakestSubject?.subject,
      },
    };
  }

  async generateLongitudinalNarrative(schoolId: string, studentId: string) {
    const [student, trajectory] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: studentId } }),
      this.trendAnalysis.getLongitudinalStudentReport(schoolId, studentId),
    ]);

    if (!student || 'error' in trajectory) {
      return { error: 'Insufficient longitudinal data' };
    }

    const results = await this.prisma.result.findMany({
      where: { studentId, schoolId },
      include: { subject: true, term: { include: { academicYear: true } } },
      orderBy: [{ term: { academicYear: { startDate: 'asc' } } }, { term: { startDate: 'asc' } }],
    });

    const termGroups: Record<string, { term: string; avg: number }> = {};
    for (const r of results) {
      const key = `${r.term.name} ${r.term.academicYear.name}`;
      if (!termGroups[key]) termGroups[key] = { term: key, avg: 0 };
      termGroups[key] = {
        term: key,
        avg: (termGroups[key].avg * (Object.keys(termGroups).length - 1) + r.score) / Object.keys(termGroups).length,
      };
    }

    const chronologicalTerms = Object.values(termGroups);
    const firstScore = chronologicalTerms[0]?.avg || 0;
    const lastScore = chronologicalTerms[chronologicalTerms.length - 1]?.avg || 0;
    const totalChange = lastScore - firstScore;
    const totalTerms = chronologicalTerms.length;

    const bySubject: Record<string, { name: string; scores: number[]; change: number }> = {};
    for (const r of results) {
      if (!bySubject[r.subjectId]) {
        bySubject[r.subjectId] = { name: r.subject.name, scores: [], change: 0 };
      }
      bySubject[r.subjectId].scores.push(r.score);
    }
    for (const [, data] of Object.entries(bySubject)) {
      if (data.scores.length >= 2) {
        data.change = data.scores[data.scores.length - 1] - data.scores[0];
      }
    }

    const improvingSubjects = Object.values(bySubject).filter(s => s.change > 5).map(s => s.name);
    const decliningSubjects = Object.values(bySubject).filter(s => s.change < -5).map(s => s.name);

    const report = `
Longitudinal Academic Progress Report: ${student.firstName} ${student.lastName}
Period: ${chronologicalTerms.length} terms (${chronologicalTerms[0]?.term} - ${chronologicalTerms[chronologicalTerms.length - 1]?.term})

Academic Trajectory:
${student.firstName} has demonstrated ${totalChange > 0 ? 'improvement' : 'a decline'} in academic performance over ${totalTerms} terms, with overall scores ${totalChange > 0 ? 'increasing' : 'decreasing'} from ${firstScore.toFixed(1)}% to ${lastScore.toFixed(1)}% (${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} percentage points).

${chronologicalTerms.map(t => `  ${t.term}: ${t.avg.toFixed(1)}%`).join('\n')}

Subject Progress:
${Object.values(bySubject).map(s => `  ${s.name}: ${s.scores.map(sc => sc.toFixed(0)).join(' → ')}% (${s.change > 0 ? '+' : ''}${s.change.toFixed(1)}%)`).join('\n')}

${improvingSubjects.length ? `Areas of Improvement: ${improvingSubjects.join(', ')}.` : ''}
${decliningSubjects.length ? `Areas of Concern: ${decliningSubjects.join(', ')}. These subjects require targeted intervention.` : ''}

${trajectory.trajectory?.overallTrend?.interpretation || ''}

Recommendation: ${decliningSubjects.length > 0
  ? 'Immediate attention is needed for declining subjects. Consider additional tutoring and parent-teacher collaboration.'
  : improvingSubjects.length > 0
    ? 'Continue the positive trajectory. Encourage the student to maintain consistent effort across all subjects.'
    : 'Regular monitoring and continued support is recommended to maintain stable performance.'
}`.trim();

    return {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      generatedAt: new Date().toISOString(),
      report,
      metrics: {
        totalTerms,
        firstAverage: Number(firstScore.toFixed(2)),
        lastAverage: Number(lastScore.toFixed(2)),
        totalChange: Number(totalChange.toFixed(2)),
        improvingSubjects: improvingSubjects.length,
        decliningSubjects: decliningSubjects.length,
      },
    };
  }

  private generatePerformanceOverview(average: number, passed: number, failed: number, total: number, stats: any): string {
    const z = stats.comparativeStats?.zScore || 0;
    const percentile = stats.comparativeStats?.percentile || 50;
    const interpretation = stats.comparativeStats?.interpretation || '';

    let perf = `In the current term, the student sat for ${total} subjects, achieving an average score of ${average.toFixed(1)}%. `;
    perf += `The student passed ${passed} subjects and failed ${failed} subjects. `;

    if (z !== 0) {
      perf += `Compared to the school average, the student's performance is ${z.toFixed(2)} standard deviations ${z > 0 ? 'above' : 'below'} the mean, `;
      perf += `placing them at the ${percentile.toFixed(1)}th percentile. `;
      perf += `${interpretation}.`;
    }

    return perf;
  }

  private generateSubjectBreakdown(results: any[], bestSubject: any, worstSubject: any): string {
    const breakdown = results.map(r =>
      `${r.subject.name}: ${r.score}%${r.grade ? ` (Grade: ${r.grade})` : ''}`
    ).join(', ');

    return `Subject Performance: ${breakdown}. Best performance was in ${bestSubject.subject.name} (${bestSubject.score}%) and the area requiring most improvement is ${worstSubject.subject.name} (${worstSubject.score}%).`;
  }

  private generateDiagnosticInsight(diagnosis: any): string {
    if (diagnosis.error) return '';
    const parts: string[] = [];
    if (diagnosis.weakestAreas?.length) {
      const critical = diagnosis.weakestAreas
        .filter((a: any) => a.status === 'CRITICAL')
        .map((a: any) => `${a.area} (${a.score}%)`);
      if (critical.length) {
        parts.push(`Diagnostic analysis reveals critical weaknesses in: ${critical.join(', ')}.`);
      }
      const weak = diagnosis.weakestAreas
        .filter((a: any) => a.status === 'NEEDS_REINFORCEMENT')
        .map((a: any) => `${a.area} (${a.score}%)`);
      if (weak.length) {
        parts.push(`Additional reinforcement needed in: ${weak.join(', ')}.`);
      }
    }
    return parts.join(' ');
  }

  private generateTrendNarrative(trajectory: any): string {
    if (!trajectory.trajectory?.length || trajectory.trajectory.length < 2) return '';
    const terms = trajectory.trajectory;
    const first = terms[0].average;
    const last = terms[terms.length - 1].average;
    const change = last - first;
    const direction = change > 0 ? 'improved' : 'declined';
    const growthRates = trajectory.growthRates || [];

    let narrative = `Over the past ${terms.length} terms, the student's performance has ${direction} from ${first.toFixed(1)}% to ${last.toFixed(1)}%. `;

    if (growthRates.length >= 2) {
      const recentGrowth = growthRates.slice(-2).reduce((a: number, b: number) => a + b, 0) / 2;
      narrative += `The recent growth rate of ${recentGrowth > 0 ? '+' : ''}${recentGrowth.toFixed(1)}% per term suggests a ${recentGrowth > 0 ? 'positive' : 'concerning'} trajectory. `;
    }

    narrative += trajectory.overallTrend?.interpretation || '';
    return narrative;
  }

  private generateComparativeAnalysis(stats: any): string {
    if (stats.error) return '';
    return `Comparative Analysis: The school average is ${stats.comparativeStats?.schoolMean?.toFixed(1)}% with a standard deviation of ${stats.comparativeStats?.schoolStdDev?.toFixed(1)}. The student's z-score of ${stats.comparativeStats?.zScore?.toFixed(2)} indicates performance ${stats.comparativeStats?.zScore > 0 ? 'above' : 'below'} the school norm.`;
  }

  private generateConclusion(average: number, trajectory: any): string {
    let conclusion = 'In conclusion, ';
    if (average >= 80) {
      conclusion += 'the student has demonstrated excellent academic performance this term. Continued effort and engagement is encouraged to maintain this high standard.';
    } else if (average >= 65) {
      conclusion += 'the student has performed well. With continued dedication and focus, further improvement is achievable.';
    } else if (average >= 50) {
      conclusion += 'the student has achieved a satisfactory performance but has significant room for improvement. Targeted support in weaker areas is recommended.';
    } else {
      conclusion += 'the student requires urgent academic intervention. A comprehensive support plan involving teachers, parents, and academic counselors should be implemented immediately.';
    }

    if (trajectory && !('error' in trajectory) && trajectory.overallTrend?.direction) {
      const dir = trajectory.overallTrend.direction;
      if (dir.includes('downward')) {
        conclusion += ' Given the declining trend, early intervention is critical to reverse the trajectory.';
      }
    }

    return conclusion;
  }
}
