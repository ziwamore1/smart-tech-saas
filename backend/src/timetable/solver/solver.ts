import _ from 'lodash';
import { Lesson, Slot, TimetableSlot } from './types';
import { generateSlots } from './slot-generator';
import { scoreSlot } from './scorer';

export function solveTimetable(
  lessons: Lesson[],
  days: number,
  periods: number,
  breakPeriods: Slot[],
  constraints,
): TimetableSlot[] | null {
  const slots = generateSlots({ days, periods, breakPeriods });

  const schedule: TimetableSlot[] = [];

  const shuffledLessons = _.shuffle(lessons);

  for (const lesson of shuffledLessons) {
    const availableSlots = slots.filter(
      (s) =>
        !schedule.find((t) => t.day === s.day && t.period === s.period) &&
        !schedule.find(
          (t) =>
            t.teacherId === lesson.teacherId &&
            t.day === s.day &&
            t.period === s.period,
        ),
    );

    if (availableSlots.length === 0) {
      return null;
    }

    const scored = availableSlots
      .map((slot) => ({
        slot,
        score: scoreSlot(slot),
      }))
      .sort((a, b) => b.score - a.score);

    const chosen = scored[0].slot;

    schedule.push({
      day: chosen.day,
      period: chosen.period,
      classId: lesson.classId,
      subjectId: lesson.subjectId,
      teacherId: lesson.teacherId,
    });
  }

  return schedule;
}
