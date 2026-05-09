import { TimetableCache, SlotIndex, EntityId, getPeriod } from '../entities/cache';

export { SlotIndex, EntityId };
export type Lesson = {
  id: string;
  teacherId: string;
  classId: string;
  subjectId?: string;
  roomId?: string;
  isDouble?: boolean;
};

export type Assignment = {
  lessonId: string;
  slot: SlotIndex;
};

export interface FastSolverResult {
  assignments: Assignment[] | null;
  success: boolean;
  iterations: number;
  backtracks: number;
}

export interface FastSolverOptions {
  maxIterations?: number;
  maxTime?: number;
  enableForwardCheck?: boolean;
  enableValidSlotCache?: boolean;
  heuristic?: 'mrv' | 'static';
}

export function createFastSolver(
  totalSlots: number,
  periodsPerDay?: number,
  validCompactDoublePeriods?: number[],
  maxTeacherLessonsPerDay?: number,
) {
  const cache = new TimetableCache({ totalSlots, periodsPerDay, validCompactDoublePeriods, maxTeacherLessonsPerDay });

  return function solveCSP(
    lessons: Lesson[],
    slots: SlotIndex[],
    options: FastSolverOptions = {},
  ): FastSolverResult {
    const maxIterations = options.maxIterations ?? 10000;
    const maxTime = options.maxTime ?? 30000;
    const enableForwardCheck = options.enableForwardCheck ?? true;
    const enableValidSlotCache = options.enableValidSlotCache ?? true;

    cache.reset();

    lessons.forEach(lesson => {
      cache.initTeacher(lesson.teacherId);
      cache.initClass(lesson.classId);
      if (lesson.roomId) {
        cache.initRoom(lesson.roomId);
      }
    });

    let orderedLessons = [...lessons];
    if (options.heuristic === 'mrv') {
      orderedLessons = orderByMRV(lessons, slots, cache, enableValidSlotCache);
    }

    const result: Assignment[] = [];
    const iterations = { count: 0 };
    const backtracks = { count: 0 };
    const startTime = Date.now();

    const success = backtrack(
      orderedLessons,
      0,
      result,
      slots,
      cache,
      iterations,
      backtracks,
      startTime,
      maxIterations,
      maxTime,
      enableForwardCheck,
      enableValidSlotCache,
    );

    return {
      assignments: success ? result : null,
      success,
      iterations: iterations.count,
      backtracks: backtracks.count,
    };
  };
}

function findMostConstrained(
  lessons: Lesson[],
  startIndex: number,
  slots: SlotIndex[],
  cache: TimetableCache,
): { index: number; lesson: Lesson } {
  let minDomain = Infinity;
  let bestIdx = startIndex;
  for (let i = startIndex; i < lessons.length; i++) {
    const size = computeDomainSize(lessons[i], slots, cache);
    if (size < minDomain) {
      minDomain = size;
      bestIdx = i;
      if (size === 0) break;
    }
  }
  if (bestIdx !== startIndex) {
    [lessons[startIndex], lessons[bestIdx]] = [lessons[bestIdx], lessons[startIndex]];
  }
  return { index: startIndex, lesson: lessons[startIndex] };
}

function backtrack(
  lessons: Lesson[],
  index: number,
  result: Assignment[],
  slots: SlotIndex[],
  cache: TimetableCache,
  iterations: { count: number },
  backtracks: { count: number },
  startTime: number,
  maxIterations: number,
  maxTime: number,
  enableForwardCheck: boolean,
  enableValidSlotCache: boolean,
): boolean {
  if (index >= lessons.length) {
    return true;
  }

  if (Date.now() - startTime > maxTime) {
    return false;
  }

  if (iterations.count >= maxIterations) {
    return false;
  }

  iterations.count++;

  const { lesson } = findMostConstrained(lessons, index, slots, cache);

  if (lesson.isDouble) {
    const validStartSlots = enableValidSlotCache
      ? computeValidSlots(lesson, slots, cache)
      : cache.getValidDoubleSlots(lesson.teacherId, lesson.classId, slots, lesson.subjectId);

    for (const slot1 of validStartSlots) {
      const period1 = getPeriod(slot1, cache.getPeriodsPerDay());
      const slot2 = slot1 + 1;

      cache.assignDoubleLesson(lesson.teacherId, lesson.classId, slot1, slot2, lesson.id, lesson.subjectId, lesson.roomId);
      result.push({ lessonId: lesson.id, slot: slot1 });
      result.push({ lessonId: lesson.id, slot: slot2 });

      if (enableForwardCheck) {
        if (!forwardCheck(lessons, index + 1, slots, cache)) {
          result.pop();
          result.pop();
          cache.unassignLesson(lesson.teacherId, lesson.classId, slot1, lesson.subjectId, lesson.roomId);
          cache.unassignLesson(lesson.teacherId, lesson.classId, slot2, lesson.subjectId, lesson.roomId);
          cache.clearValidSlots();
          backtracks.count++;
          continue;
        }
      }

      if (backtrack(
        lessons,
        index + 1,
        result,
        slots,
        cache,
        iterations,
        backtracks,
        startTime,
        maxIterations,
        maxTime,
        enableForwardCheck,
        enableValidSlotCache,
      )) {
        return true;
      }

      result.pop();
      result.pop();
      cache.unassignLesson(lesson.teacherId, lesson.classId, slot1, lesson.subjectId, lesson.roomId);
      cache.unassignLesson(lesson.teacherId, lesson.classId, slot2, lesson.subjectId, lesson.roomId);
      cache.clearValidSlots();
    }
  } else {
    const validSlots = enableValidSlotCache
      ? computeValidSlots(lesson, slots, cache)
      : slots.filter(slot => {
          if (!cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)) {
            return false;
          }
          return cache.canAssign(lesson.teacherId, lesson.classId, slot, lesson.subjectId).valid;
        });

    for (const slot of validSlots) {
      cache.assignLesson(lesson.teacherId, lesson.classId, slot, lesson.subjectId, lesson.roomId);
      result.push({ lessonId: lesson.id, slot });

      if (enableForwardCheck) {
        if (!forwardCheck(lessons, index + 1, slots, cache)) {
          result.pop();
          cache.unassignLesson(lesson.teacherId, lesson.classId, slot, lesson.subjectId, lesson.roomId);
          cache.clearValidSlots();
          backtracks.count++;
          continue;
        }
      }

      if (backtrack(
        lessons,
        index + 1,
        result,
        slots,
        cache,
        iterations,
        backtracks,
        startTime,
        maxIterations,
        maxTime,
        enableForwardCheck,
        enableValidSlotCache,
      )) {
        return true;
      }

      result.pop();
      cache.unassignLesson(lesson.teacherId, lesson.classId, slot, lesson.subjectId, lesson.roomId);
      cache.clearValidSlots();
    }
  }

  backtracks.count++;
  return false;
}

function computeValidSlots(
  lesson: Lesson,
  slots: SlotIndex[],
  cache: TimetableCache,
): SlotIndex[] {
  const cached = cache.getValidSlots(lesson.id);
  if (cached) return cached;

  let valid: SlotIndex[];

  if (lesson.isDouble) {
    valid = cache.getValidDoubleSlots(lesson.teacherId, lesson.classId, slots, lesson.subjectId);
  } else {
    valid = slots.filter(slot => {
      if (!cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)) {
        return false;
      }
      const canAssign = cache.canAssign(lesson.teacherId, lesson.classId, slot, lesson.subjectId);
      return canAssign.valid;
    });
  }

  cache.setValidSlots(lesson.id, valid);
  return valid;
}

function forwardCheck(
  lessons: Lesson[],
  startIndex: number,
  slots: SlotIndex[],
  cache: TimetableCache,
): boolean {
  for (let i = startIndex; i < lessons.length; i++) {
    const lesson = lessons[i];

    if (lesson.isDouble) {
      const valid = cache.getValidDoubleSlots(lesson.teacherId, lesson.classId, slots, lesson.subjectId);
      if (valid.length === 0) return false;
    } else {
      const hasValid = slots.some(slot => {
        if (!cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)) {
          return false;
        }
        return cache.canAssign(lesson.teacherId, lesson.classId, slot, lesson.subjectId).valid;
      });
      if (!hasValid) return false;
    }
  }
  return true;
}

function computeDomainSize(lesson: Lesson, slots: SlotIndex[], cache: TimetableCache): number {
  if (lesson.isDouble) {
    return cache.getValidDoubleSlots(lesson.teacherId, lesson.classId, slots, lesson.subjectId).length;
  }
  return slots.filter(s => {
    if (!cache.isSlotFree(lesson.teacherId, lesson.classId, s, lesson.roomId)) return false;
    return cache.canAssign(lesson.teacherId, lesson.classId, s, lesson.subjectId).valid;
  }).length;
}

function orderByMRV(
  lessons: Lesson[],
  slots: SlotIndex[],
  cache: TimetableCache,
  useCache: boolean,
): Lesson[] {
  const domainCache = new Map<string, number>();
  const getDomain = (lesson: Lesson): number => {
    const cached = domainCache.get(lesson.id);
    if (cached !== undefined) return cached;
    const size = useCache
      ? (cache.getValidSlots(lesson.id)?.length ?? computeDomainSize(lesson, slots, cache))
      : computeDomainSize(lesson, slots, cache);
    domainCache.set(lesson.id, size);
    return size;
  };
  return [...lessons].sort((a, b) => getDomain(a) - getDomain(b));
}

export function solvePartial(
  affectedLessons: Lesson[],
  slots: SlotIndex[],
  cache: TimetableCache,
): Assignment[] | null {
  const result: Assignment[] = [];

  function backtrack(index: number): boolean {
    if (index === affectedLessons.length) return true;

    const lesson = affectedLessons[index];

    if (lesson.isDouble) {
      const validStartSlots = cache.getValidDoubleSlots(lesson.teacherId, lesson.classId, slots, lesson.subjectId);
      for (const slot1 of validStartSlots) {
        const slot2 = slot1 + 1;
        cache.assignDoubleLesson(lesson.teacherId, lesson.classId, slot1, slot2, lesson.id, lesson.subjectId, lesson.roomId);
        result.push({ lessonId: lesson.id, slot: slot1 });
        result.push({ lessonId: lesson.id, slot: slot2 });

        if (backtrack(index + 1)) return true;

        result.pop();
        result.pop();
        cache.unassignLesson(lesson.teacherId, lesson.classId, slot1, lesson.subjectId, lesson.roomId);
        cache.unassignLesson(lesson.teacherId, lesson.classId, slot2, lesson.subjectId, lesson.roomId);
      }
    } else {
      for (const slot of slots) {
        if (cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)) {
          cache.assignLesson(lesson.teacherId, lesson.classId, slot, lesson.roomId);
          result.push({ lessonId: lesson.id, slot });

          if (backtrack(index + 1)) return true;

          result.pop();
          cache.unassignLesson(lesson.teacherId, lesson.classId, slot, lesson.roomId);
        }
      }
    }

    return false;
  }

  return backtrack(0) ? result : null;
}

export function createParallelSolvers(
  totalSlots: number,
  count: number,
  periodsPerDay?: number,
): ((lessons: Lesson[], slots: SlotIndex[]) => FastSolverResult)[] {
  const baseCache = new TimetableCache({ totalSlots, periodsPerDay });

  return Array.from({ length: count }, () => {
    return (lessons: Lesson[], slots: SlotIndex[]) => {
      const solver = createFastSolver(totalSlots, periodsPerDay);
      return solver(lessons, slots);
    };
  });
}

export function cloneSolverCache(cache: TimetableCache): TimetableCache {
  return cache.clone();
}
