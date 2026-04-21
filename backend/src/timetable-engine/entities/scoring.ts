import { ExpandedLesson, TimeslotEntity, ScheduleEntry } from './index';
import { parseTimeslotKey } from './index';

export interface ScoringWeights {
  TEACHER_GAPS: number;
  SUBJECT_REPEAT: number;
  BALANCE: number;
  TEACHER_CONSECUTIVE: number;
  MORNING_PREFERENCE: number;
  AFTERNOON_PENALTY: number;
  PREFERRED_DAY: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  TEACHER_GAPS: 2,
  SUBJECT_REPEAT: 5,
  BALANCE: 1,
  TEACHER_CONSECUTIVE: 3,
  MORNING_PREFERENCE: 3,
  AFTERNOON_PENALTY: 2,
  PREFERRED_DAY: 5,
};

export const BASE_SCORE = 1000;

export interface ScoringResult {
  totalScore: number;
  penalties: {
    teacherGaps: number;
    subjectRepeat: number;
    unbalancedDays: number;
    teacherConsecutive: number;
    afternoonPenalty: number;
  };
  bonuses: {
    morningPreference: number;
    preferredDay: number;
  };
}

export function scoreSchedule(
  schedule: ScheduleEntry[],
  timeslots: TimeslotEntity[],
  weights: Partial<ScoringWeights> = {}
): ScoringResult {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  const teacherGaps = penaltyTeacherGaps(schedule, w.TEACHER_GAPS);
  const subjectRepeat = penaltySubjectRepetition(schedule, w.SUBJECT_REPEAT);
  const unbalancedDays = penaltyUnbalancedDays(schedule, w.BALANCE);
  const teacherConsecutive = penaltyTeacherConsecutive(schedule, w.TEACHER_CONSECUTIVE);
  const afternoonPenalty = penaltyAfternoonLessons(schedule, w.AFTERNOON_PENALTY);

  const morningPreference = bonusMorningPreference(schedule, w.MORNING_PREFERENCE);
  const preferredDay = bonusPreferredDay(schedule, w.PREFERRED_DAY);

  const totalScore =
    BASE_SCORE -
    teacherGaps -
    subjectRepeat -
    unbalancedDays -
    teacherConsecutive -
    afternoonPenalty +
    morningPreference +
    preferredDay;

  return {
    totalScore,
    penalties: {
      teacherGaps,
      subjectRepeat,
      unbalancedDays,
      teacherConsecutive,
      afternoonPenalty,
    },
    bonuses: {
      morningPreference,
      preferredDay,
    },
  };
}

export function penaltyTeacherGaps(schedule: ScheduleEntry[], weight: number = 2): number {
  let penalty = 0;
  const teacherMap = new Map<string, number[]>();

  for (const entry of schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    const lessonId = entry.lessonId;
    const teacherId = lessonId.split('-').find((_, i) => i === 2) || '';

    if (!teacherMap.has(teacherId)) {
      teacherMap.set(teacherId, []);
    }
    teacherMap.get(teacherId)!.push(parsed.period);
  }

  for (const [, periods] of teacherMap) {
    const sorted = periods.sort((a, b) => a - b);

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap > 1) {
        penalty += gap * weight;
      }
    }
  }

  return penalty;
}

export function penaltySubjectRepetition(
  schedule: ScheduleEntry[],
  weight: number = 5
): number {
  let penalty = 0;
  const classDayMap = new Map<string, Map<string, number>>();

  for (const entry of schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    const lessonId = entry.lessonId;
    const parts = lessonId.split('-');
    const classId = parts[0] || '';
    const subjectId = parts[1] || '';

    const key = `${classId}_${parsed.day}`;
    if (!classDayMap.has(key)) {
      classDayMap.set(key, new Map());
    }

    const subjectCount = classDayMap.get(key)!;
    subjectCount.set(subjectId, (subjectCount.get(subjectId) || 0) + 1);
  }

  for (const [, subjects] of classDayMap) {
    for (const [, count] of subjects) {
      if (count > 1) {
        penalty += (count - 1) * weight;
      }
    }
  }

  return penalty;
}

export function penaltyUnbalancedDays(
  schedule: ScheduleEntry[],
  weight: number = 1
): number {
  let penalty = 0;
  const classDayLoad = new Map<string, number>();

  for (const entry of schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    const classId = entry.lessonId.split('-')[0] || '';
    const key = `${classId}_${parsed.day}`;
    classDayLoad.set(key, (classDayLoad.get(key) || 0) + 1);
  }

  const loads: number[] = [];
  const byClass = new Map<string, number[]>();

  for (const [key, load] of classDayLoad) {
    const classId = key.split('_')[0];
    if (!byClass.has(classId)) {
      byClass.set(classId, []);
    }
    byClass.get(classId)!.push(load);
    loads.push(load);
  }

  if (loads.length === 0) return 0;

  const avg = loads.reduce((a, b) => a + b, 0) / loads.length;

  for (const load of loads) {
    penalty += Math.abs(load - avg) * weight;
  }

  return penalty;
}

export function penaltyTeacherConsecutive(
  schedule: ScheduleEntry[],
  weight: number = 3
): number {
  let penalty = 0;
  const teacherDayMap = new Map<string, Map<number, number[]>>();

  for (const entry of schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    const lessonId = entry.lessonId;
    const teacherId = lessonId.split('-').find((_, i) => i === 2) || '';

    if (!teacherDayMap.has(teacherId)) {
      teacherDayMap.set(teacherId, new Map());
    }

    const dayMap = teacherDayMap.get(teacherId)!;
    if (!dayMap.has(parsed.day)) {
      dayMap.set(parsed.day, []);
    }
    dayMap.get(parsed.day)!.push(parsed.period);
  }

  for (const [, dayMap] of teacherDayMap) {
    for (const [, periods] of dayMap) {
      const sorted = periods.sort((a, b) => a - b);
      let consecutive = 1;

      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
          consecutive++;
        } else {
          if (consecutive > 2) {
            penalty += (consecutive - 2) * weight;
          }
          consecutive = 1;
        }
      }

      if (consecutive > 2) {
        penalty += (consecutive - 2) * weight;
      }
    }
  }

  return penalty;
}

export function penaltyAfternoonLessons(
  schedule: ScheduleEntry[],
  weight: number = 2
): number {
  let penalty = 0;

  for (const entry of schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    if (parsed.period >= 7) {
      penalty += weight;
    }
  }

  return penalty;
}

export function bonusMorningPreference(
  schedule: ScheduleEntry[],
  bonus: number = 3
): number {
  let total = 0;

  for (const entry of schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    if (parsed.period <= 3) {
      total += bonus;
    }
  }

  return total;
}

export function bonusPreferredDay(
  schedule: ScheduleEntry[],
  bonus: number = 5,
  preferredDays: number[] = [1, 2, 3, 4, 5]
): number {
  let total = 0;

  for (const entry of schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    if (preferredDays.includes(parsed.day)) {
      total += bonus;
    }
  }

  return total;
}

export function scorePartialSchedule(
  schedule: ScheduleEntry[],
  timeslots: TimeslotEntity[],
  weights: Partial<ScoringWeights> = {}
): number {
  return scoreSchedule(schedule, timeslots, weights).totalScore;
}

export function getDetailedBreakdown(
  schedule: ScheduleEntry[],
  timeslots: TimeslotEntity[]
): {
  byTeacher: Record<string, number>;
  byClass: Record<string, number>;
  bySubject: Record<string, number>;
  byDay: Record<number, number>;
} {
  const byTeacher: Record<string, number> = {};
  const byClass: Record<string, number> = {};
  const bySubject: Record<string, number> = {};
  const byDay: Record<number, number> = {};

  for (const entry of schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    const parts = entry.lessonId.split('-');
    const classId = parts[0] || '';
    const subjectId = parts[1] || '';
    const teacherId = parts[2] || '';

    byTeacher[teacherId] = (byTeacher[teacherId] || 0) + 1;
    byClass[classId] = (byClass[classId] || 0) + 1;
    bySubject[subjectId] = (bySubject[subjectId] || 0) + 1;
    byDay[parsed.day] = (byDay[parsed.day] || 0) + 1;
  }

  return { byTeacher, byClass, bySubject, byDay };
}
