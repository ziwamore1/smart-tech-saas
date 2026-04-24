import { ScheduledLesson, TimetableState } from '../constraints/types';
import { HardConstraintChecker, hasHardConstraints } from '../constraints/hardConstraints';

export interface PropagationResult {
  possible: boolean;
  reducedSlots: Map<string, { day: number; period: number }[]>;
}

export function forwardCheck(
  remainingLessons: ScheduledLesson[],
  state: TimetableState,
  hardChecker: HardConstraintChecker,
  availableSlots: { day: number; period: number }[],
): PropagationResult {
  const reducedSlots = new Map<string, { day: number; period: number }[]>();

  for (const lesson of remainingLessons) {
    const validSlots: { day: number; period: number }[] = [];

    for (const slot of availableSlots) {
      if (hasHardConstraints(hardChecker, state, lesson, slot.day, slot.period)) {
        validSlots.push(slot);
      }
    }

    reducedSlots.set(lesson.id, validSlots);

    if (validSlots.length === 0) {
      return { possible: false, reducedSlots };
    }
  }

  return { possible: true, reducedSlots };
}

export function propagateConstraints(
  remainingLessons: ScheduledLesson[],
  state: TimetableState,
  hardChecker: HardConstraintChecker,
  availableSlots: { day: number; period: number }[],
): PropagationResult {
  return forwardCheck(remainingLessons, state, hardChecker, availableSlots);
}

export function arcConsistency(
  lessons: ScheduledLesson[],
  state: TimetableState,
  hardChecker: HardConstraintChecker,
  availableSlots: { day: number; period: number }[],
): boolean {
  let changed = true;
  let iterations = 0;
  const maxIter = 10;

  while (changed && iterations < maxIter) {
    changed = false;
    iterations++;

    const result = forwardCheck(lessons, state, hardChecker, availableSlots);
    
    if (!result.possible) {
      return false;
    }

    for (const [, slots] of result.reducedSlots) {
      if (slots.length === 0) {
        return false;
      }
    }

    if (result.reducedSlots.size < lessons.length) {
      changed = true;
    }
  }

  return true;
}

export function domainReduction(
  lesson: ScheduledLesson,
  targetDay: number,
  targetPeriod: number,
  domains: Map<string, { day: number; period: number }[]>,
  hardChecker: HardConstraintChecker,
  state: TimetableState,
): Map<string, { day: number; period: number }[]> {
  const newDomains = new Map(domains);
  let changed = false;

  for (const [lessonId, slots] of domains) {
    if (lessonId === lesson.id) continue;

    const filteredSlots = slots.filter(slot => {
      if (slot.day === targetDay && slot.period === targetPeriod) {
        const otherLesson = { ...lesson, id: lessonId };
        return hasHardConstraints(hardChecker, state, otherLesson, slot.day, slot.period);
      }
      return true;
    });

    if (filteredSlots.length < slots.length) {
      newDomains.set(lessonId, filteredSlots);
      changed = true;
    }
  }

  let hasChanges = false;

  for (const [lessonId, slots] of domains) {
    if (lessonId === lesson.id) continue;

    const filteredSlots = slots.filter(slot => {
      if (slot.day === targetDay && slot.period === targetPeriod) {
        const otherLesson = { ...lesson, id: lessonId };
        return hasHardConstraints(hardChecker, state, otherLesson, slot.day, slot.period);
      }
      return true;
    });

    if (filteredSlots.length < slots.length) {
      newDomains.set(lessonId, filteredSlots);
      hasChanges = true;
    }
  }

  return newDomains;
}