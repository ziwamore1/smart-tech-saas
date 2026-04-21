import { Lesson, Timeslot, TimetableSchedule, ScheduledLesson } from './lesson';
import { hasHardConstraints, ConstraintContext } from './constraints';

export interface PropagationResult {
  possible: boolean;
  reducedTimeslots: Timeslot[];
}

export function filterDomains(
  lesson: Lesson,
  timeslots: Timeslot[],
  schedule: TimetableSchedule,
  context: ConstraintContext,
  remainingLessons: Lesson[] = []
): Timeslot[] {
  const validTimeslots = timeslots.filter(ts => 
    hasHardConstraints(schedule, lesson, ts, context)
  );

  if (remainingLessons.length === 0) {
    return validTimeslots;
  }

  const filtered: Timeslot[] = [];
  
  for (const ts of validTimeslots) {
    schedule.add(new ScheduledLesson(lesson, ts));
    
    let possible = true;
    for (const remLesson of remainingLessons) {
      const hasOptions = timeslots.some(otherTs => 
        hasHardConstraints(schedule, remLesson, otherTs, context)
      );
      if (!hasOptions) {
        possible = false;
        break;
      }
    }
    
    schedule.remove(lesson.id);
    
    if (possible) {
      filtered.push(ts);
    }
  }

  return filtered.length > 0 ? filtered : validTimeslots;
}

export function forwardCheck(
  lesson: Lesson,
  timeslots: Timeslot[],
  schedule: TimetableSchedule,
  context: ConstraintContext,
  remainingLessons: Lesson[]
): PropagationResult {
  const validTimeslots = timeslots.filter(ts => 
    hasHardConstraints(schedule, lesson, ts, context)
  );

  if (validTimeslots.length === 0) {
    return { possible: false, reducedTimeslots: [] };
  }

  if (remainingLessons.length === 0) {
    return { possible: true, reducedTimeslots: validTimeslots };
  }

  schedule.add(new ScheduledLesson(lesson, timeslots[0]));

  for (const remLesson of remainingLessons) {
    const count = timeslots.filter(ts => 
      hasHardConstraints(schedule, remLesson, ts, context)
    ).length;
    
    if (count === 0) {
      schedule.remove(lesson.id);
      return { possible: false, reducedTimeslots: [] };
    }
  }

  schedule.remove(lesson.id);
  return { possible: true, reducedTimeslots: validTimeslots };
}

export function arcConsistency(
  lessons: Lesson[],
  timeslots: Timeslot[],
  schedule: TimetableSchedule,
  context: ConstraintContext
): boolean {
  let changed = true;
  let iterations = 0;
  const maxIter = 10;

  while (changed && iterations < maxIter) {
    changed = false;
    iterations++;

    for (const lesson of lessons) {
      if (schedule.findByLesson(lesson.id)) continue;

      const validTimeslots = timeslots.filter(ts => 
        hasHardConstraints(schedule, lesson, ts, context)
      );

      if (validTimeslots.length === 0) {
        return false;
      }

      const otherTimeslots = timeslots.filter(ts => !validTimeslots.some(v => v.equals(ts)));
      if (otherTimeslots.length > 0) {
        changed = true;
      }
    }
  }

  return true;
}

export function reduceDomains(
  lesson: Lesson,
  timeslot: Timeslot,
  domains: Map<string, Timeslot[]>,
  schedule: TimetableSchedule,
  context: ConstraintContext
): Map<string, Timeslot[]> {
  const newDomains = new Map(domains);

  for (const [lessonId, slots] of domains) {
    if (lessonId === lesson.id) continue;

    const filteredSlots = slots.filter(slot => {
      if (slot.equals(timeslot)) {
        const tempLesson = new Lesson('', '', '');
        Object.assign(tempLesson, { id: lessonId });
        return hasHardConstraints(schedule, tempLesson, slot, context);
      }
      return true;
    });

    if (filteredSlots.length < slots.length) {
      newDomains.set(lessonId, filteredSlots);
    }
  }

  return newDomains;
}

function isDomainEmpty(domains: Map<string, Timeslot[]>): boolean {
  for (const [, slots] of domains) {
    if (slots.length === 0) return true;
  }
  return false;
}

export function propagate(
  lesson: Lesson,
  timeslot: Timeslot,
  allLessons: Lesson[],
  timeslots: Timeslot[],
  schedule: TimetableSchedule,
  context: ConstraintContext
): { possible: boolean; domains: Map<string, Timeslot[]> } {
  const domains = new Map<string, Timeslot[]>();

  for (const l of allLessons) {
    if (l.id === lesson.id) continue;
    
    domains.set(l.id, timeslots.filter(ts => 
      hasHardConstraints(schedule, l, ts, context)
    ));
  }

  const newSchedule = schedule.clone();
  newSchedule.add(new ScheduledLesson(lesson, timeslot));

  let possible = true;
  for (const [lessonId, slots] of domains) {
    if (slots.length === 0) {
      possible = false;
      break;
    }
  }

  return { possible, domains };
}