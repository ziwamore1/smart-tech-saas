import { TimeSlot, ClassRegistry, ClassConstraint } from '../models/Class';
import { TeacherRegistry } from '../models/Teacher';
import { RoomRegistry } from '../models/Room';
import { TimeslotRegistry, TimeslotModel } from '../models/Timeslot';
import { ScheduledLesson, TimetableState } from './types';

export interface SoftConstraintViolation {
  constraint: string;
  message: string;
  severity: 'soft';
  penalty: number;
  lesson?: ScheduledLesson;
}

export interface SoftConstraintScorer {
  (
    state: TimetableState,
    lesson: ScheduledLesson,
    targetDay: number,
    targetPeriod: number,
  ): number;
}

export interface SoftConstraintDetails {
  (
    state: TimetableState,
    lesson: ScheduledLesson,
    targetDay: number,
    targetPeriod: number,
  ): SoftConstraintViolation[];
}

export function createSoftConstraintScorer(
  classRegistry: ClassRegistry,
  teacherRegistry: TeacherRegistry,
  roomRegistry: RoomRegistry,
  timeslotRegistry: TimeslotRegistry,
  weights: Partial<SoftConstraintWeights> = {},
): { scorer: SoftConstraintScorer; details: SoftConstraintDetails } {
  const w = {
    teacherPreferredDay: weights.teacherPreferredDay ?? 10,
    teacherConsecutive: weights.teacherConsecutive ?? 5,
    subjectClustering: weights.subjectClustering ?? 8,
    subjectDistribution: weights.subjectDistribution ?? 12,
    roomPreference: weights.roomPreference ?? 3,
    morningPreference: weights.morningPreference ?? 5,
    afternoonPenalty: weights.afternoonPenalty ?? 2,
    doublePeriod: weights.doublePeriod ?? 15,
    balancedDaily: weights.balancedDaily ?? 6,
    ...weights,
  };

  const scorer = function scoreSoftConstraints(
    state: TimetableState,
    lesson: ScheduledLesson,
    targetDay: number,
    targetPeriod: number,
  ): number {
    let score = 0;

    const teacher = teacherRegistry.get(lesson.teacherId);
    if (teacher?.preferredDays?.includes(targetDay)) {
      score += w.teacherPreferredDay!;
    }

    const consecutiveCount = countConsecutiveLessons(state, lesson.teacherId, targetDay, targetPeriod);
    if (consecutiveCount > 1) {
      score -= w.teacherConsecutive! * (consecutiveCount - 1);
    }

    const subjectCount = state.slots.filter(
      s => s.subjectId === lesson.subjectId && s.classId === lesson.classId
    ).length;
    const sameDayCount = state.slots.filter(
      s => s.subjectId === lesson.subjectId && s.classId === lesson.classId && s.day === targetDay
    ).length;
    if (sameDayCount > 0 && subjectCount < 4) {
      score += w.subjectClustering!;
    }
    if (sameDayCount === 0 && subjectCount > 0) {
      const lastDay = getLastDayWithSubject(state, lesson.subjectId, lesson.classId);
      if (lastDay && targetDay - lastDay <= 2) {
        score += w.subjectDistribution!;
      }
    }

    if (lesson.classroomId) {
      score += w.roomPreference!;
    }

    if (targetPeriod <= 3) {
      score += w.morningPreference!;
    } else if (targetPeriod >= 7) {
      score -= w.afternoonPenalty!;
    }

    return score;
  };

  const details = function getSoftConstraintDetails(
    state: TimetableState,
    lesson: ScheduledLesson,
    targetDay: number,
    targetPeriod: number,
  ): SoftConstraintViolation[] {
    const violations: SoftConstraintViolation[] = [];
    const teacher = teacherRegistry.get(lesson.teacherId);

    if (teacher?.preferredDays && !teacher.preferredDays.includes(targetDay)) {
      violations.push({
        constraint: 'TEACHER_NON_PREFERRED_DAY',
        message: `Teacher ${lesson.teacherId} prefers not to teach on Day ${targetDay}`,
        severity: 'soft',
        penalty: w.teacherPreferredDay!,
      });
    }

    const consecutiveCount = countConsecutiveLessons(state, lesson.teacherId, targetDay, targetPeriod);
    if (consecutiveCount > 2) {
      violations.push({
        constraint: 'TEACHER_TOO_MANY_CONSECUTIVE',
        message: `Teacher ${lesson.teacherId} has ${consecutiveCount} consecutive lessons`,
        severity: 'soft',
        penalty: w.teacherConsecutive!,
      });
    }

    const sameDayCount = state.slots.filter(
      s => s.subjectId === lesson.subjectId && s.classId === lesson.classId && s.day === targetDay
    ).length;
    if (sameDayCount >= 2) {
      violations.push({
        constraint: 'SUBJECT_SAME_DAY_EXCEEDS',
        message: `Subject ${lesson.subjectId} appears ${sameDayCount + 1} times on Day ${targetDay}`,
        severity: 'soft',
        penalty: w.subjectClustering!,
      });
    }

    if (targetPeriod >= 7) {
      violations.push({
        constraint: 'LATE_AFTERNOON',
        message: `Lesson scheduled in late afternoon (Period ${targetPeriod})`,
        severity: 'soft',
        penalty: w.afternoonPenalty!,
      });
    }

    return violations;
  };

  return { scorer, details };
}

function countConsecutiveLessons(
  state: TimetableState,
  teacherId: string,
  day: number,
  period: number,
): number {
  const dayLessons = state.slots
    .filter(s => s.teacherId === teacherId && s.day === day && s.period === period)
    .sort((a, b) => a.period - b.period);

  let count = 0;
  let current = period;
  for (const lesson of dayLessons) {
    if (lesson.period === current || lesson.period === current + 1) {
      count++;
      current = lesson.period;
    }
  }
  return count;
}

function getLastDayWithSubject(
  state: TimetableState,
  subjectId: string,
  classId: string,
): number | null {
  const lessons = state.slots
    .filter(s => s.subjectId === subjectId && s.classId === classId)
    .sort((a, b) => b.day - a.day);

  return lessons[0]?.day ?? null;
}

export interface SoftConstraintWeights {
  teacherPreferredDay: number;
  teacherConsecutive: number;
  subjectClustering: number;
  subjectDistribution: number;
  roomPreference: number;
  morningPreference: number;
  afternoonPenalty: number;
  doublePeriod: number;
  balancedDaily: number;
}

export function calculateTotalScore(
  scorer: SoftConstraintScorer,
  state: TimetableState,
): number {
  let totalScore = 0;
  for (const lesson of state.slots) {
    totalScore += scorer(state, lesson, lesson.day, lesson.period);
  }
  return totalScore;
}