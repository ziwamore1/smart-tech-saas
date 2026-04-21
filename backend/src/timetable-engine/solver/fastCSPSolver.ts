import { TimetableCache, SlotIndex, EntityId } from '../entities/cache';

export type Lesson = {
  id: string;
  teacherId: string;
  classId: string;
  roomId?: string;
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

export function createFastSolver(totalSlots: number) {
  const cache = new TimetableCache({ totalSlots });

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
    let iterations = 0;
    let backtracks = 0;
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
      iterations,
      backtracks,
    };
  };
}

function backtrack(
  lessons: Lesson[],
  index: number,
  result: Assignment[],
  slots: SlotIndex[],
  cache: TimetableCache,
  iterations: number,
  backtracks: number,
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

  if (iterations >= maxIterations) {
    return false;
  }

  iterations++;

  const lesson = lessons[index];
  const validSlots = enableValidSlotCache
    ? computeValidSlots(lesson, slots, cache)
    : slots.filter(slot =>
        cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)
      );

  for (const slot of validSlots) {
    cache.assignLesson(lesson.teacherId, lesson.classId, slot, lesson.roomId);
    result.push({ lessonId: lesson.id, slot });

    if (enableForwardCheck) {
      if (!forwardCheck(lessons, index + 1, slots, cache)) {
        result.pop();
        cache.unassignLesson(lesson.teacherId, lesson.classId, slot, lesson.roomId);
        backtracks++;
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
    cache.unassignLesson(lesson.teacherId, lesson.classId, slot, lesson.roomId);
  }

  backtracks++;
  return false;
}

function computeValidSlots(
  lesson: Lesson,
  slots: SlotIndex[],
  cache: TimetableCache,
): SlotIndex[] {
  const cached = cache.getValidSlots(lesson.id);
  if (cached) return cached;

  const valid = slots.filter(slot =>
    cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)
  );

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
    const hasValid = slots.some(slot =>
      cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)
    );

    if (!hasValid) return false;
  }
  return true;
}

function orderByMRV(
  lessons: Lesson[],
  slots: SlotIndex[],
  cache: TimetableCache,
  useCache: boolean,
): Lesson[] {
  return [...lessons].sort((a, b) => {
    const domainA = useCache
      ? (cache.getValidSlots(a.id)?.length ?? slots.length)
      : slots.filter(s => cache.isSlotFree(a.teacherId, a.classId, s, a.roomId)).length;
    const domainB = useCache
      ? (cache.getValidSlots(b.id)?.length ?? slots.length)
      : slots.filter(s => cache.isSlotFree(b.teacherId, b.classId, s, b.roomId)).length;
    return domainA - domainB;
  });
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

    for (const slot of slots) {
      if (cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)) {
        cache.assignLesson(lesson.teacherId, lesson.classId, slot, lesson.roomId);
        result.push({ lessonId: lesson.id, slot });

        if (backtrack(index + 1)) return true;

        result.pop();
        cache.unassignLesson(lesson.teacherId, lesson.classId, slot, lesson.roomId);
      }
    }

    return false;
  }

  return backtrack(0) ? result : null;
}

export function createParallelSolvers(
  totalSlots: number,
  count: number,
): ((lessons: Lesson[], slots: SlotIndex[]) => FastSolverResult)[] {
  const baseCache = new TimetableCache({ totalSlots });

  return Array.from({ length: count }, () => {
    return (lessons: Lesson[], slots: SlotIndex[]) => {
      const solver = createFastSolver(totalSlots);
      return solver(lessons, slots);
    };
  });
}

export function cloneSolverCache(cache: TimetableCache): TimetableCache {
  return cache.clone();
}
