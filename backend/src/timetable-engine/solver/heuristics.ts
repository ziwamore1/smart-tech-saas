import { ScheduledLesson, TimetableState } from '../constraints/types';
import { HardConstraintChecker } from '../constraints/hardConstraints';

export function orderLessonsByMRV(
  lessons: ScheduledLesson[],
  state: TimetableState,
  hardChecker: HardConstraintChecker,
  availableSlots: { day: number; period: number }[],
): ScheduledLesson[] {
  return [...lessons].sort((a, b) => {
    const countA = countValidSlots(a, state, hardChecker, availableSlots);
    const countB = countValidSlots(b, state, hardChecker, availableSlots);
    return countA - countB;
  });
}

export function orderLessonsByDegree(
  lessons: ScheduledLesson[],
  state: TimetableState,
  hardChecker: HardConstraintChecker,
  availableSlots: { day: number; period: number }[],
): ScheduledLesson[] {
  return [...lessons].sort((a, b) => {
    const degreeA = calculateDegree(a, lessons, state);
    const degreeB = calculateDegree(b, lessons, state);
    return degreeB - degreeA;
  });
}

export function calculateDegree(
  lesson: ScheduledLesson,
  allLessons: ScheduledLesson[],
  state: TimetableState,
): number {
  let degree = 0;
  
  for (const other of allLessons) {
    if (other.id === lesson.id) continue;
    
    if (other.teacherId === lesson.teacherId) degree++;
    if (other.classId === lesson.classId) degree++;
  }
  
  return degree;
}

function countValidSlots(
  lesson: ScheduledLesson,
  state: TimetableState,
  hardChecker: HardConstraintChecker,
  availableSlots: { day: number; period: number }[],
): number {
  let count = 0;
  
  for (const slot of availableSlots) {
    let valid = true;
    
    for (const existing of state.slots) {
      if (existing.day === slot.day && existing.period === slot.period) {
        if (existing.classId === lesson.classId || 
            existing.teacherId === lesson.teacherId ||
            (lesson.classroomId && existing.classroomId === lesson.classroomId)) {
          valid = false;
          break;
        }
      }
    }
    
    if (valid) count++;
  }
  
  return count;
}

export function selectMostConstrainedSlot(
  lesson: ScheduledLesson,
  slots: { day: number; period: number }[],
  state: TimetableState,
  hardChecker: HardConstraintChecker,
): { day: number; period: number } | null {
  let bestSlot: { day: number; period: number } | null = null;
  let minRemaining = Infinity;
  
  for (const slot of slots) {
    const remaining = countValidSlots(lesson, state, hardChecker, slots);
    if (remaining < minRemaining) {
      minRemaining = remaining;
      bestSlot = slot;
    }
  }
  
  return bestSlot;
}