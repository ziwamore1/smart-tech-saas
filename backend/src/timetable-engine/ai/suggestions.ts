import { TimetableCache, SlotIndex } from '../entities/cache';
import { Lesson } from '../solver/fastCSPSolver';
import { Suggestion, Intent, TimetableAnalysis } from './types';

const SLOTS_PER_DAY = 8;

export function generateSuggestions(
  lessons: Lesson[],
  cache: TimetableCache
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  const analysis = analyzeTimetable(lessons);

  if (analysis.conflicts.length > 0) {
    suggestions.push({
      id: 'fix-conflicts',
      title: 'Fix conflicts',
      description: `Found ${analysis.conflicts.length} scheduling conflicts`,
      intent: 'FIX_CONFLICTS' as Intent,
      impact: 'high',
      estimatedImprovement: analysis.conflicts.length * 50,
    });
  }

  const totalGaps = countTeacherGaps(lessons);
  if (totalGaps > 5) {
    suggestions.push({
      id: 'reduce-gaps',
      title: 'Reduce teacher gaps',
      description: `Teachers have ${totalGaps} gaps across the week`,
      intent: 'REDUCE_GAPS' as Intent,
      impact: 'high',
      estimatedImprovement: totalGaps * 20,
    });
  }

  if (analysis.lateLessons > lessons.length * 0.2) {
    suggestions.push({
      id: 'avoid-late',
      title: 'Move lessons earlier',
      description: `${analysis.lateLessons} lessons are in late periods`,
      intent: 'AVOID_LATE' as Intent,
      impact: 'medium',
      estimatedImprovement: analysis.lateLessons * 15,
    });
  }

  if (analysis.morningLessons < lessons.length * 0.3) {
    suggestions.push({
      id: 'more-morning',
      title: 'Schedule more morning lessons',
      description: 'Morning lessons have better engagement',
      intent: 'AVOID_LATE' as Intent,
      impact: 'low',
      estimatedImprovement: 30,
    });
  }

  if (analysis.unbalancedDays.length > 0) {
    suggestions.push({
      id: 'balance-days',
      title: 'Balance day distribution',
      description: `${analysis.unbalancedDays.length} classes have uneven day distribution`,
      intent: 'BALANCE_DAYS' as Intent,
      impact: 'medium',
      estimatedImprovement: analysis.unbalancedDays.length * 25,
    });
  }

  if (analysis.overloadedTeachers.length > 0) {
    suggestions.push({
      id: 'optimize-teacher',
      title: 'Optimize teacher schedules',
      description: `${analysis.overloadedTeachers.length} teachers have heavy workloads`,
      intent: 'OPTIMIZE_TEACHER' as Intent,
      impact: 'medium',
      estimatedImprovement: analysis.overloadedTeachers.length * 30,
    });
  }

  suggestions.push({
    id: 'full-optimize',
    title: 'Full optimization',
    description: 'Run complete optimization for best results',
    intent: 'OPTIMIZE_FULL' as Intent,
    impact: 'high',
    estimatedImprovement: 100,
  });

  return suggestions.sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[a.impact] - impactOrder[b.impact];
    }
    return b.estimatedImprovement - a.estimatedImprovement;
  });
}

function analyzeTimetable(lessons: Lesson[]): TimetableAnalysis {
  const conflicts: any[] = [];
  const teacherGaps = new Map<string, number[]>();
  const subjectDistribution = new Map<string, Map<number, number>>();
  let lateLessons = 0;
  let morningLessons = 0;
  const overloadedTeachers: string[] = [];
  const unbalancedDays: string[] = [];

  for (const lesson of lessons) {
    if (!teacherGaps.has(lesson.teacherId)) {
      teacherGaps.set(lesson.teacherId, []);
    }
  }

  return {
    conflicts,
    teacherGaps,
    subjectDistribution,
    lateLessons,
    morningLessons,
    overloadedTeachers,
    unbalancedDays,
    overallScore: 1000,
  };
}

function countTeacherGaps(lessons: Lesson[]): number {
  const teacherDays = new Map<string, Set<number>>();

  for (const lesson of lessons) {
    if (!teacherDays.has(lesson.teacherId)) {
      teacherDays.set(lesson.teacherId, new Set());
    }
  }

  let totalGaps = 0;
  for (const days of teacherDays.values()) {
    const sorted = [...days].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 1) {
        totalGaps++;
      }
    }
  }

  return totalGaps;
}

export function estimateImprovement(intent: Intent, lessons: Lesson[]): number {
  switch (intent) {
    case 'FIX_CONFLICTS':
      return 100;
    case 'REDUCE_GAPS':
      return countTeacherGaps(lessons) * 20;
    case 'BALANCE_SUBJECTS':
      return 50;
    case 'BALANCE_DAYS':
      return 40;
    case 'AVOID_LATE':
      return 30;
    case 'OPTIMIZE_FULL':
      return 150;
    default:
      return 10;
  }
}
