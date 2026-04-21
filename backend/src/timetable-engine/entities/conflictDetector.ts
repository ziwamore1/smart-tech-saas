import { ExpandedLesson, TimeslotEntity, ScheduleEntry } from './index';
import { parseTimeslotKey } from './index';

export interface Conflict {
  type: 'TEACHER' | 'CLASS' | 'ROOM';
  lessonId: string;
  timeslotId: string;
  conflictingWith: string[];
}

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
}

export function detectConflicts(schedule: ScheduleEntry[]): ConflictResult {
  const conflicts: Conflict[] = [];
  
  const teacherMap = new Map<string, string[]>();
  const classMap = new Map<string, string[]>();
  const roomMap = new Map<string, string[]>();

  for (const entry of schedule) {
    const timeslot = entry.timeslotId;
    const lessonId = entry.lessonId;
    
    const key = `${timeslot}`;
    
    const teacherKey = `teacher_${entry.lessonId.split('-')[2]}_${timeslot}`;
    if (!teacherMap.has(teacherKey)) {
      teacherMap.set(teacherKey, []);
    }
    teacherMap.get(teacherKey)!.push(lessonId);

    const classKey = `class_${entry.lessonId.split('-')[0]}_${timeslot}`;
    if (!classMap.has(classKey)) {
      classMap.set(classKey, []);
    }
    classMap.get(classKey)!.push(lessonId);

    if (entry.roomId) {
      const roomKey = `room_${entry.roomId}_${timeslot}`;
      if (!roomMap.has(roomKey)) {
        roomMap.set(roomKey, []);
      }
      roomMap.get(roomKey)!.push(lessonId);
    }
  }

  for (const [key, lessonIds] of teacherMap) {
    if (lessonIds.length > 1) {
      const timeslotId = key.split('_').slice(2).join('_');
      conflicts.push({
        type: 'TEACHER',
        lessonId: lessonIds[0],
        timeslotId,
        conflictingWith: lessonIds.slice(1),
      });
    }
  }

  for (const [key, lessonIds] of classMap) {
    if (lessonIds.length > 1) {
      const timeslotId = key.split('_').slice(2).join('_');
      conflicts.push({
        type: 'CLASS',
        lessonId: lessonIds[0],
        timeslotId,
        conflictingWith: lessonIds.slice(1),
      });
    }
  }

  for (const [key, lessonIds] of roomMap) {
    if (lessonIds.length > 1) {
      const timeslotId = key.split('_').slice(2).join('_');
      conflicts.push({
        type: 'ROOM',
        lessonId: lessonIds[0],
        timeslotId,
        conflictingWith: lessonIds.slice(1),
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

export function moveLesson(
  schedule: ScheduleEntry[],
  lessonId: string,
  newTimeslotId: string
): ScheduleEntry[] {
  return schedule.map(entry =>
    entry.lessonId === lessonId
      ? { ...entry, timeslotId: newTimeslotId }
      : entry
  );
}

export function swapLessons(
  schedule: ScheduleEntry[],
  lessonId1: string,
  lessonId2: string
): ScheduleEntry[] {
  const entry1 = schedule.find(e => e.lessonId === lessonId1);
  const entry2 = schedule.find(e => e.lessonId === lessonId2);

  if (!entry1 || !entry2) return schedule;

  return schedule.map(entry => {
    if (entry.lessonId === lessonId1) {
      return { ...entry, timeslotId: entry2.timeslotId };
    }
    if (entry.lessonId === lessonId2) {
      return { ...entry, timeslotId: entry1.timeslotId };
    }
    return entry;
  });
}

export function canSwap(
  schedule: ScheduleEntry[],
  lessonId1: string,
  lessonId2: string
): boolean {
  const testSchedule = swapLessons(schedule, lessonId1, lessonId2);
  return !detectConflicts(testSchedule).hasConflicts;
}

export function findFreeSlots(
  schedule: ScheduleEntry[],
  lesson: ExpandedLesson,
  timeslots: TimeslotEntity[]
): TimeslotEntity[] {
  const usedSlots = new Set<string>();
  
  for (const entry of schedule) {
    if (entry.lessonId !== lesson.instanceId) {
      usedSlots.add(entry.timeslotId);
    }
  }

  const classLessons = schedule
    .filter(e => e.lessonId.startsWith(lesson.classId))
    .map(e => e.timeslotId);
  
  const teacherLessons = schedule
    .filter(e => e.lessonId.includes(lesson.teacherId))
    .map(e => e.timeslotId);

  return timeslots.filter(ts => {
    if (usedSlots.has(ts.id)) return false;
    if (ts.isBreak) return false;
    
    if (classLessons.includes(ts.id)) return false;
    if (teacherLessons.includes(ts.id)) return false;
    
    return true;
  });
}

export interface AutoFixResult {
  success: boolean;
  schedule: ScheduleEntry[];
  method: 'swap' | 'move' | 'partial' | 'none';
  fixed: number;
}

export function autoFix(
  schedule: ScheduleEntry[],
  timeslots: TimeslotEntity[],
  maxAttempts: number = 10
): AutoFixResult {
  const result = detectConflicts(schedule);
  
  if (!result.hasConflicts) {
    return { success: true, schedule, method: 'none', fixed: 0 };
  }

  let currentSchedule = [...schedule];
  let fixed = 0;
  let method: AutoFixResult['method'] = 'none';

  for (let attempt = 0; attempt < maxAttempts && fixed < result.conflicts.length; attempt++) {
    const conflict = result.conflicts[fixed];
    
    const swapResult = trySwapFix(currentSchedule, conflict, timeslots);
    if (swapResult) {
      currentSchedule = swapResult;
      method = 'swap';
      fixed++;
      const newResult = detectConflicts(currentSchedule);
      if (!newResult.hasConflicts) break;
      continue;
    }

    const moveResult = tryMoveFix(currentSchedule, conflict, timeslots);
    if (moveResult) {
      currentSchedule = moveResult;
      method = 'move';
      fixed++;
      const newResult = detectConflicts(currentSchedule);
      if (!newResult.hasConflicts) break;
      continue;
    }

    fixed++;
  }

  const finalResult = detectConflicts(currentSchedule);
  
  return {
    success: !finalResult.hasConflicts,
    schedule: currentSchedule,
    method,
    fixed,
  };
}

function trySwapFix(
  schedule: ScheduleEntry[],
  conflict: Conflict,
  timeslots: TimeslotEntity[]
): ScheduleEntry[] | null {
  const conflictEntry = schedule.find(e => e.lessonId === conflict.lessonId);
  if (!conflictEntry) return null;

  for (const otherId of conflict.conflictingWith) {
    const otherEntry = schedule.find(e => e.lessonId === otherId);
    if (!otherEntry) continue;

    if (canSwap(schedule, conflict.lessonId, otherId)) {
      return swapLessons(schedule, conflict.lessonId, otherId);
    }
  }

  return null;
}

function tryMoveFix(
  schedule: ScheduleEntry[],
  conflict: Conflict,
  timeslots: TimeslotEntity[]
): ScheduleEntry[] | null {
  const conflictEntry = schedule.find(e => e.lessonId === conflict.lessonId);
  if (!conflictEntry) return null;

  const lessonParts = conflict.lessonId.split('-');
  const lesson: ExpandedLesson = {
    instanceId: conflict.lessonId,
    lessonId: '',
    classId: lessonParts[0] || '',
    subjectId: lessonParts[1] || '',
    teacherId: lessonParts[2] || '',
    requiredPerWeek: 1,
    instanceIndex: 0,
  };

  const freeSlots = findFreeSlots(schedule, lesson, timeslots);
  
  if (freeSlots.length > 0) {
    return moveLesson(schedule, conflict.lessonId, freeSlots[0].id);
  }

  return null;
}

export function partialSolve(
  affectedLessons: string[],
  schedule: ScheduleEntry[],
  timeslots: TimeslotEntity[]
): ScheduleEntry[] {
  const affectedEntries = schedule.filter(e => affectedLessons.includes(e.lessonId));
  const unaffectedEntries = schedule.filter(e => !affectedLessons.includes(e.lessonId));

  const usedSlots = new Set(unaffectedEntries.map(e => e.timeslotId));

  const affectedWithTimeslots = affectedEntries.map(entry => {
    const ts = timeslots.find(t => t.id === entry.timeslotId);
    return { entry, day: ts?.day || 1, period: ts?.period || 1 };
  }).sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.period - b.period;
  });

  let result = [...unaffectedEntries];

  for (const { entry } of affectedWithTimeslots) {
    const parts = entry.lessonId.split('-');
    const lesson: ExpandedLesson = {
      instanceId: entry.lessonId,
      lessonId: entry.lessonId,
      classId: parts[0] || '',
      subjectId: parts[1] || '',
      teacherId: parts[2] || '',
      requiredPerWeek: 1,
      instanceIndex: 0,
    };

    const freeSlot = findFreeSlots(result, lesson, timeslots)[0];
    if (freeSlot) {
      result.push({ ...entry, timeslotId: freeSlot.id });
    }
  }

  return result;
}
