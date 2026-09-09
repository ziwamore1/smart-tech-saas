import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  InsightFact,
  TeacherInsight,
  StudentRiskSummary,
} from './teacher-analytics.types';

/**
 * Teaching Intelligence insight generator.
 *
 * The rule-based generator interprets the AUTHORITATIVE statistics produced by
 * TeacherAnalyticsService. When OPENAI_API_KEY is configured, the same
 * statistics are handed to a model that is explicitly instructed to only
 * derive — never invent — figures; every claim must map back to an input
 * metric. The output is always fact-checked and normalized back into the
 * stable TeacherInsight contract so the dashboard and report are deterministic.
 */
@Injectable()
export class TeacherAnalyticsAiService {
  private readonly logger = new Logger(TeacherAnalyticsAiService.name);
  private openai: OpenAI | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI initialized for teacher-analytics insights.');
    } else {
      this.logger.warn('OPENAI_API_KEY not configured. Teacher analytics AI will use rule-based insights.');
    }
  }

  async generateInsights(overview: any): Promise<TeacherInsight> {
    const ruleBased = this.buildRuleBased(overview);
    if (!this.openai) return ruleBased;
    const ai = await this.generateWithAi(overview);
    return ai.aiUsed ? this.normalize(ai.content, ruleBased) : ruleBased;
  }

  // -------------------------------------------------------------------------
  // Rule-based generation (deterministic; used standalone or as fallback)
  // -------------------------------------------------------------------------

  private buildRuleBased(o: any): TeacherInsight {
    const summary = o?.summary;
    const assignments: any[] = o?.assignments || [];
    const atRisk: StudentRiskSummary[] = o?.atRisk || [];
    const competency = o?.competency;
    const trends: any[] = o?.trends || [];
    const attendance = o?.attendance;

    const avg = summary?.overallAverage ?? null;
    const passRate = summary?.overallPassRate ?? null;
    const atRiskCount = summary?.studentsAtRisk ?? atRisk.filter((s) => s.riskLevel === 'HIGH').length;
    const interventionCount = summary?.studentsRequiringIntervention ?? atRisk.length;

    const severity = this.severity(avg, passRate, atRiskCount);
    const strengths = this.buildStrengths(summary, assignments, trends, attendance, competency);
    const contributing = this.buildContributing(atRisk, attendance, assignments);
    const nextSteps = this.buildNextSteps(atRisk, summary, competency);
    const measures = this.buildMeasureProgress();
    const factCheck = this.buildFactCheck(o, atRisk);

    const weakestSubject = summary?.weakestSubject;
    const weakestCompetency = summary?.weakestCompetency || competency?.weakestCompetency?.name || null;
    const strongestSubject = summary?.strongestSubject;

    let whatIsHappening = `Across ${summary?.classesCount ?? 0} classes and ${summary?.subjectsCount ?? 0} subjects, the teacher's load averaged ${this.fmtPct(avg)} with a pass rate of ${this.fmtPct(passRate)}.`;
    if (trends.length >= 2) {
      const last = trends[trends.length - 1];
      const prev = trends[trends.length - 2];
      const delta = (last?.average ?? 0) - (prev?.average ?? 0);
      const dir = delta > 3 ? 'an upward' : delta < -3 ? 'a downward' : 'a broadly stable';
      whatIsHappening += ` Across recent terms the trajectory has been ${dir} trend (-${Math.abs(delta).toFixed(1)} to ${last?.average != null ? last.average.toFixed(1) + '%' : 'n/a'}).`;
    }

    let whereIsTheProblem = 'No single problem area stands out.';
    if (weakestSubject && weakestSubject.average != null) {
      whereIsTheProblem = `The strongest concern is ${weakestSubject.subjectName} (average ${weakestSubject.average.toFixed(1)}%), followed by any classes where average scores trail the teacher's overall average.`;
    }
    if (weakestCompetency) {
      whereIsTheProblem += ` Competency data additionally flags ${weakestCompetency} as the least-mastered competency/topic.`;
    }
    if (atRisk.length > 0) {
      const high = atRisk.filter((s) => s.riskLevel === 'HIGH');
      const mod = atRisk.filter((s) => s.riskLevel === 'MODERATE');
      whereIsTheProblem += ` There are ${high.length} learners in the HIGH risk group and ${mod.length} in the MODERATE group.`;
    }

    const affectedGroups = this.buildAffectedLearners(atRisk, interventionCount);

    return {
      aiUsed: false,
      model: null,
      generatedAt: new Date().toISOString(),
      scope: 'teacher',
      whatIsHappening,
      whereIsTheProblem,
      howSerious: { level: severity, text: this.severityText(severity, avg, passRate, atRiskCount) },
      whichLearnersAreAffected: affectedGroups,
      whatMayBeContributing: contributing,
      supportingEvidence: this.buildEvidence(summary, assignments, atRisk, attendance),
      recommendedNextSteps: nextSteps,
      howToMeasureProgress: measures,
      actionPlan: this.buildActionPlan(weakestSubject, weakestCompetency, atRisk, summary),
      strengths,
      factCheck,
    };
  }

  private severity(avg: number | null, passRate: number | null, atRiskCount: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (avg == null && passRate == null) return 'MODERATE';
    if ((avg != null && avg < 40) || (passRate != null && passRate < 40) || atRiskCount >= 10) return 'CRITICAL';
    if ((avg != null && avg < 50) || (passRate != null && passRate < 60) || atRiskCount >= 5) return 'HIGH';
    if ((avg != null && avg < 65) || (passRate != null && passRate < 75)) return 'MODERATE';
    return 'LOW';
  }

  private severityText(level: string, avg: number | null, passRate: number | null, atRiskCount: number): string {
    switch (level) {
      case 'CRITICAL':
        return `Current performance is critical: average ${this.fmtPct(avg)} and pass rate ${this.fmtPct(passRate)}, with ${atRiskCount} learners in the high-risk bracket. Immediate intervention is warranted.`;
      case 'HIGH':
        return `Current performance needs attention: average ${this.fmtPct(avg)} and pass rate ${this.fmtPct(passRate)}, with ${atRiskCount} learners in the high-risk bracket.`;
      case 'MODERATE':
        return `Performance is moderate: average ${this.fmtPct(avg)} and pass rate ${this.fmtPct(passRate)}. Targeted support for specific classes/subjects is recommended.`;
      default:
        return `Performance is healthy: average ${this.fmtPct(avg)} and pass rate ${this.fmtPct(passRate)}. Maintain current strategies and continue monitoring.`;
    }
  }

  private buildStrengths(summary: any, assignments: any[], trends: any[], attendance: any, competency: any): string[] {
    const out: string[] = [];
    if (summary?.strongestSubject?.subjectName) {
      out.push(`${summary.strongestSubject.subjectName} is a relative strength (average ${this.fmtNum(summary.strongestSubject.average)}).`);
    }
    if (summary?.overallPassRate != null && summary.overallPassRate >= 75) {
      out.push(`Overall pass rate of ${summary.overallPassRate.toFixed(1)}% exceeds the quality benchmark.`);
    }
    if (trends.length >= 2) {
      const last = trends[trends.length - 1];
      if (last?.isCurrent && last.average != null && trends[trends.length - 2].average != null &&
          last.average - trends[trends.length - 2].average > 3) {
        out.push('The most recent term shows a measurable improvement over the previous one.');
      }
    }
    const improving = assignments.reduce((s: number, a: any) => s + (a.improvingStudents?.length || 0), 0);
    if (improving > 0) out.push(`${improving} learner-scores improved by more than 3 points versus the previous term.`);
    if (competency?.strongestCompetency?.name) {
      out.push(`${competency.strongestCompetency.name} shows the highest competency mastery (${this.fmtNum(competency.strongestCompetency.averageMastery)}).`);
    }
    if (attendance?.available && attendance.lowAttendanceAverage != null && attendance.highAttendanceAverage != null &&
        attendance.highAttendanceAverage - attendance.lowAttendanceAverage <= 5) {
      out.push('Attendance and performance are weakly linked in this cohort, indicating engagement is broadly comparable across learners.');
    }
    if (out.length === 0) out.push('Baseline data is available; continue to build on current assessment coverage.');
    return out;
  }

  private buildContributing(atRisk: StudentRiskSummary[], attendance: any, assignments: any[]): string[] {
    const out: string[] = [];
    const flags = new Map<string, number>();
    for (const s of atRisk) {
      for (const f of s.flags || []) flags.set(f, (flags.get(f) || 0) + 1);
    }
    const repeated = [...flags.entries()]
      .filter(([f]) => /repeated|failure/i.test(f))
      .reduce((sum, [, n]) => sum + n, 0);
    const declining = [...flags.entries()]
      .filter(([f]) => /decline/i.test(f))
      .reduce((sum, [, n]) => sum + n, 0);

    if (repeated > 0) out.push(`${repeated} at-risk learner-scores reflect repeated failure — patterns likely point to sustained foundational gaps rather than single-exam dips.`);
    if (declining > 0) out.push(`${declining} at-risk learner-scores declined by more than 10 points from the previous term, suggesting a recent disruption worth investigating.`);
    if (attendance?.available && attendance.interpretation && attendance.correlation != null && attendance.correlation > 0.15) {
      out.push(`Attendance is positively associated with performance in this cohort (r=${attendance.correlation.toFixed(2)}); learners with lower attendance tend to score lower.`);
    }
    const lowParticipation = assignments.filter((a: any) => a.participationRate != null && a.participationRate < 60);
    if (lowParticipation.length > 0) {
      out.push(`${lowParticipation.length} class/subject combination(s) had participation below 60% — missing assessments may be masking or amplifying the observed averages.`);
    }
    if (out.length === 0) out.push('No consistent contributing factor is detectable in the current data beyond the performance levels themselves.');
    return out;
  }

  private buildAffectedLearners(atRisk: StudentRiskSummary[], interventionCount: number) {
    const groups: Array<{ learnerGroup: string; count: number; detail: string }> = [];
    const high = atRisk.filter((s) => s.riskLevel === 'HIGH');
    const mod = atRisk.filter((s) => s.riskLevel === 'MODERATE');
    if (high.length > 0) {
      groups.push({
        learnerGroup: 'High-risk learners (<40% or repeated failure)',
        count: high.length,
        detail: high.slice(0, 8).map((s) => s.studentName.split(' ')[0]).join(', ') + (high.length > 8 ? ` and ${high.length - 8} more` : ''),
      });
    }
    if (mod.length > 0) {
      groups.push({
        learnerGroup: 'Moderate-risk learners (just below pass threshold or declining)',
        count: mod.length,
        detail: `These learners are closest to the pass line — targeted support has the highest near-term payoff.`,
      });
    }
    if (groups.length === 0) {
      groups.push({ learnerGroup: 'No at-risk learners', count: 0, detail: interventionCount === 0 ? 'No learner currently meets the risk criteria.' : 'Risk criteria are not currently tripped.' });
    }
    return groups;
  }

  private buildEvidence(summary: any, assignments: any[], atRisk: StudentRiskSummary[], attendance: any) {
    const evidence: Array<{ observation: string; metric: string }> = [];
    if (summary?.overallAverage != null || summary?.overallPassRate != null) {
      evidence.push({
        observation: `The teacher's aggregate load average is ${this.fmtPct(summary.overallAverage)} with a pass rate of ${this.fmtPct(summary.overallPassRate)}.`,
        metric: 'overall_average / overall_pass_rate',
      });
    }
    if (summary?.weakestSubject?.average != null) {
      evidence.push({
        observation: `${summary.weakestSubject.subjectName} is the weakest subject at ${summary.weakestSubject.average.toFixed(1)}% average.`,
        metric: 'subject_average',
      });
    }
    if (summary?.genderGap != null) {
      evidence.push({
        observation: `The gender gap across assessed classes is ${summary.genderGap.toFixed(1)} points (${summary.genderGapClassification}).`,
        metric: 'gender_gap',
      });
    }
    if (atRisk.length > 0) {
      const avgRisk = this.round2(atRisk.reduce((s, x) => s + (x.currentAverage ?? 0), 0) / atRisk.length);
      evidence.push({
        observation: `${atRisk.length} learners are flagged for intervention with an average of ${avgRisk == null ? '—' : avgRisk.toFixed(1) + '%'} across their assessed subjects.`,
        metric: 'students_at_risk',
      });
    }
    if (attendance?.available && attendance.correlation != null) {
      evidence.push({
        observation: `Attendance-performance correlation of r=${attendance.correlation.toFixed(2)} (n=${attendance.sampleSize}).`,
        metric: 'attendance_performance_correlation',
      });
    }
    if (evidence.length === 0) evidence.push({ observation: 'No quantitative evidence available yet.', metric: 'none' });
    return evidence;
  }

  private buildNextSteps(atRisk: StudentRiskSummary[], summary: any, competency: any): string[] {
    const out: string[] = [];
    if (atRisk.length > 0) {
      for (const s of atRisk.slice(0, 3)) {
        if (s.recommendedIntervention) out.push(`${s.studentName.split(' ')[0]} (${s.currentAverage == null ? '—' : s.currentAverage.toFixed(0) + '%'}): ${s.recommendedIntervention}`);
      }
    }
    if (summary?.weakestSubject?.subjectName) {
      out.push(`Prioritise a reteaching-and-reassessment cycle for ${summary.weakestSubject.subjectName}; compare outcomes against the current baseline.`);
    }
    if (summary?.weakestCompetency) {
      out.push(`Target the ${summary.weakestCompetency} competency with explicit instruction and skill checks before the next assessment window.`);
    }
    if (summary?.genderGap && Math.abs(summary.genderGap) > 8) {
      out.push('Differentiate support for the lower-performing gender group in the classes where the gap is largest.');
    }
    if (out.length === 0) out.push('Maintain current teaching strategies and reassess next term to confirm stability.');
    return out;
  }

  private buildMeasureProgress(): string[] {
    return [
      'Re-assess affected learners within two weeks using a short mastery check.',
      'Compare next-term average/pass rate against this baseline for the weakest subject.',
      'Track the count of learners moving OUT of the HIGH/MODERATE risk brackets.',
      'For attendance-linked cohorts, monitor attendance trend alongside scores for two consecutive weeks.',
    ];
  }

  private buildActionPlan(weakest: any, weakestCompetency: string | null, atRisk: StudentRiskSummary[], summary: any) {
    const plan: Array<{
      problem: string;
      evidence: string;
      affectedLearners: string;
      intervention: string;
      duration: string;
      successIndicator: string;
      followUp: string;
    }> = [];

    if (weakest?.average != null) {
      plan.push({
        problem: `Weak performance in ${weakest.subjectName}`,
        evidence: `Average ${weakest.average.toFixed(1)}% across the teacher's ${weakest.subjectName} load.`,
        affectedLearners: 'All learners in this subject, especially those at or below the pass threshold.',
        intervention: 'Diagnostic review of scores, targeted reteaching, worked examples and retrieval practice.',
        duration: '2 weeks',
        successIndicator: 'Class average moves toward 50%+ on the next assessment.',
        followUp: 'Re-run assignment analytics for this subject to confirm movement above threshold.',
      });
    }
    if (weakestCompetency) {
      plan.push({
        problem: `Low competency mastery in ${weakestCompetency}`,
        evidence: `${weakestCompetency} appears in the lowest competency-mastery band for affected classes.`,
        affectedLearners: 'Learners within the classes where this competency is assessed.',
        intervention: 'Targeted competency/topic lessons with frequent skill checks.',
        duration: '2 weeks',
        successIndicator: 'Competency mastery rises to DEVELOPING or above.',
        followUp: 'Check term-summary competency scores after the intervention window.',
      });
    }
    if (atRisk.length > 0) {
      const learners = atRisk.length > 5 ? `${atRisk.length} flagged learners` : atRisk.map((s) => s.studentName).join(', ');
      plan.push({
        problem: `${atRisk.length} learner(s) require structured intervention`,
        evidence: 'Risk engine flags including below-threshold scores and/or substantial declines.',
        affectedLearners: learners,
        intervention: 'Small-group remediation using the generated per-learner intervention guidance.',
        duration: '3 weeks',
        successIndicator: 'At least half of flagged learners move to a higher average or lower risk bracket.',
        followUp: 'Regenerate the at-risk list and compare risk levels term-over-term.',
      });
    }
    if (plan.length === 0) {
      plan.push({
        problem: 'No active intervention needed',
        evidence: 'Performance indicators are stable.',
        affectedLearners: 'None currently flagged.',
        intervention: 'Continue current practice and monitor next term.',
        duration: '1 term',
        successIndicator: 'Performance stays at or above current levels.',
        followUp: 'Review trends at the end of the next term.',
      });
    }
    return plan;
  }

  private buildFactCheck(o: any, atRisk: StudentRiskSummary[]): InsightFact[] {
    const summary = o?.summary;
    const attendance = o?.attendance;
    const facts: InsightFact[] = [];

    facts.push({
      type: 'FACT',
      text: `Overall average ${this.fmtPct(summary?.overallAverage)} and pass rate ${this.fmtPct(summary?.overallPassRate)} were computed from the authoritative results pipeline.`,
      evidence: 'TeacherAnalyticsService.getOverview',
    });
    facts.push({
      type: 'OBSERVATION',
      text: `${atRisk.length} learner(s) are flagged based on below-threshold scores or 10+ point declines.`,
      evidence: 'Risk engine output (teacher-analytics.students-at-risk)',
    });
    if (attendance?.available && attendance.correlation != null) {
      facts.push({
        type: 'OBSERVATION',
        text: `Attendance shows ${attendance.correlation > 0.15 ? 'a positive' : attendance.correlation < -0.15 ? 'a weak or inverted' : 'no meaningful'} association with performance in this cohort.`,
        evidence: `Pearson r=${attendance.correlation.toFixed(2)}, n=${attendance.sampleSize}`,
      });
    }
    facts.push({
      type: 'POSSIBLE_EXPLANATION',
      text: 'Where repeated failure clusters, foundational knowledge gaps are a plausible driver, but this is not proven by the data alone.',
      evidence: 'Derived from risk flags; requires classroom observation to confirm.',
    });
    facts.push({
      type: 'RECOMMENDED_ACTION',
      text: 'Begin with the recommended intervention for the HIGH-risk learners and re-assess within two weeks.',
      evidence: 'Structured action plan generated from the risk engine.',
    });
    return facts;
  }

  // -------------------------------------------------------------------------
  // Optional OpenAI enrichment + normalization back to the stable contract
  // -------------------------------------------------------------------------

  private async generateWithAi(o: any): Promise<{ aiUsed: boolean; model: string | null; content: any }> {
    const data = {
      summary: {
        classes: o?.summary?.classesCount,
        subjects: o?.summary?.subjectsCount,
        overallAverage: o?.summary?.overallAverage,
        overallPassRate: o?.summary?.overallPassRate,
        highestClassAverage: o?.summary?.highestClassAverage,
        lowestClassAverage: o?.summary?.lowestClassAverage,
        strongestSubject: o?.summary?.strongestSubject,
        weakestSubject: o?.summary?.weakestSubject,
        genderGap: o?.summary?.genderGap,
        genderGapClassification: o?.summary?.genderGapClassification,
        studentsAtRisk: o?.summary?.studentsAtRisk,
        studentsRequiringIntervention: o?.summary?.studentsRequiringIntervention,
        performanceIndicators: o?.summary?.performanceIndicators,
      },
      assignments: (o?.assignments || []).map((a: any) => ({
        className: a.className,
        subjectName: a.subjectName,
        average: a.stats?.average,
        passRate: a.stats?.passRate,
        participationRate: a.participationRate,
        distribution: a.distribution,
        trend: a.trend,
        qualityQuantity: a.qualityQuantity,
      })),
      competency: o?.competency
        ? {
            available: o.competency.available,
            weakestCompetency: o.competency.weakestCompetency,
            strongestCompetency: o.competency.strongestCompetency,
          }
        : null,
      trends: (o?.trends || []).map((t: any) => ({ termName: t.termName, average: t.average, passRate: t.passRate, isCurrent: t.isCurrent })),
      atRisk: (o?.atRisk || []).map((s: StudentRiskSummary) => ({
        studentName: s.studentName,
        className: s.className,
        currentAverage: s.currentAverage,
        riskLevel: s.riskLevel,
        flags: s.flags,
      })),
      attendance: o?.attendance
        ? { available: o.attendance.available, correlation: o.attendance.correlation, lowAttendanceAverage: o.attendance.lowAttendanceAverage, highAttendanceAverage: o.attendance.highAttendanceAverage }
        : null,
    };

    const prompt = `You are an expert education data analyst for a Zambian school management system. You are given COMPUTED statistics for one teacher's teaching load. You must derive insights ONLY from this data — never invent numbers, never claim causal relationships, and clearly mark any hypothesis as a possibility rather than fact.

Return a JSON object with EXACTLY these fields:
- "whatIsHappening": 2-3 sentence plain-English summary of the current state.
- "whereIsTheProblem": where the main weaknesses are located (subjects/classes/competencies).
- "howSerious": {"level": "LOW"|"MODERATE"|"HIGH"|"CRITICAL", "text": "one sentence justification using the actual numbers"}.
- "whichLearnersAreAffected": array of {"learnerGroup", "count", "detail"}.
- "whatMayBeContributing": string array of possible contributing factors phrased as hypotheses, not facts.
- "supportingEvidence": array of {"observation", "metric"}.
- "recommendedNextSteps": string array of 3-5 specific, actionable recommendations.
- "howToMeasureProgress": string array of measurable follow-up indicators.
- "actionPlan": array of {"problem", "evidence", "affectedLearners", "intervention", "duration", "successIndicator", "followUp"}.
- "strengths": string array.
- "factCheck": array of {"type": "FACT"|"OBSERVATION"|"POSSIBLE_EXPLANATION"|"RECOMMENDED_ACTION", "text", "evidence"}.

Data (JSON): ${JSON.stringify(data).slice(0, 16000)}

Respond with ONLY valid JSON, no markdown.`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You output strictly valid JSON with no commentary.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1400,
      });
      const content = response.choices[0]?.message?.content || '';
      const cleaned = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return { aiUsed: true, model: response.model || 'gpt-4o-mini', content: parsed };
    } catch (error) {
      this.logger.warn(`Teacher analytics AI generation failed, using rule-based: ${(error as Error).message}`);
      return { aiUsed: false, model: null, content: null };
    }
  }

  private normalize(ai: any, fallback: TeacherInsight): TeacherInsight {
    if (!ai || typeof ai !== 'object') return fallback;
    const severityText = typeof ai.howSerious?.text === 'string' ? ai.howSerious.text : '';
    const severityLevel = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(ai.howSerious?.level)
      ? ai.howSerious.level
      : fallback.howSerious?.level || 'MODERATE';
    const pickArray = (v: any) => (Array.isArray(v) ? v.map(String) : []);
    const pickObjective = (v: any, keys: string[]) =>
      Array.isArray(v)
        ? v
            .filter((item: any) => item && typeof item === 'object')
            .map((item: any) => {
              const out: any = {};
              for (const k of keys) out[k] = item[k] ?? null;
              return out;
            })
        : [];

    return {
      aiUsed: true,
      model: 'gpt-4o-mini',
      generatedAt: new Date().toISOString(),
      scope: 'teacher',
      whatIsHappening:
        typeof ai.whatIsHappening === 'string' && ai.whatIsHappening.trim()
          ? ai.whatIsHappening.trim()
          : fallback.whatIsHappening,
      whereIsTheProblem:
        typeof ai.whereIsTheProblem === 'string' && ai.whereIsTheProblem.trim()
          ? ai.whereIsTheProblem.trim()
          : fallback.whereIsTheProblem,
      howSerious: { level: severityLevel, text: severityText || fallback.howSerious?.text || '' },
      whichLearnersAreAffected: pickObjective(ai.whichLearnersAreAffected, ['learnerGroup', 'count', 'detail']).length
        ? pickObjective(ai.whichLearnersAreAffected, ['learnerGroup', 'count', 'detail'])
        : fallback.whichLearnersAreAffected,
      whatMayBeContributing: pickArray(ai.whatMayBeContributing).length
        ? pickArray(ai.whatMayBeContributing)
        : fallback.whatMayBeContributing,
      supportingEvidence: pickObjective(ai.supportingEvidence, ['observation', 'metric']).length
        ? pickObjective(ai.supportingEvidence, ['observation', 'metric'])
        : fallback.supportingEvidence,
      recommendedNextSteps: pickArray(ai.recommendedNextSteps).length
        ? pickArray(ai.recommendedNextSteps)
        : fallback.recommendedNextSteps,
      howToMeasureProgress: pickArray(ai.howToMeasureProgress).length
        ? pickArray(ai.howToMeasureProgress)
        : fallback.howToMeasureProgress,
      actionPlan: pickObjective(ai.actionPlan, ['problem', 'evidence', 'affectedLearners', 'intervention', 'duration', 'successIndicator', 'followUp']).length
        ? pickObjective(ai.actionPlan, ['problem', 'evidence', 'affectedLearners', 'intervention', 'duration', 'successIndicator', 'followUp'])
        : fallback.actionPlan,
      strengths: pickArray(ai.strengths).length ? pickArray(ai.strengths) : fallback.strengths,
      factCheck: pickObjective(ai.factCheck, ['type', 'text', 'evidence']).filter(
        (f: any) => ['FACT', 'OBSERVATION', 'POSSIBLE_EXPLANATION', 'RECOMMENDED_ACTION'].includes(f.type),
      ).length
        ? pickObjective(ai.factCheck, ['type', 'text', 'evidence'])
        : fallback.factCheck,
    };
  }

  private fmtPct(value: number | null): string {
    return value == null ? 'Insufficient data' : `${value.toFixed(1)}%`;
  }

  private fmtNum(value: number | null): string {
    return value == null ? '—' : `${value.toFixed(1)}%`;
  }

  private round2(value: number): number | null {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }
}