import { TimetableCache, SlotIndex } from '../entities/cache';
import { Lesson, Assignment, Chromosome } from './fastHybridSolver';

export interface HeuristicStats {
  failures: number;
  success: number;
}

export interface SlotStats {
  success: number;
  fail: number;
}

export interface LearningState {
  lessonStats: Record<string, HeuristicStats>;
  slotStats: Record<number, SlotStats>;
}

export function createLearningState(): LearningState {
  return {
    lessonStats: {},
    slotStats: {},
  };
}

export function getLessonPriority(
  lesson: Lesson,
  state: LearningState,
  getDomainSize: (lesson: Lesson) => number
): number {
  const stats = state.lessonStats[lesson.id] || { failures: 1, success: 1 };

  const difficulty = getDomainSize(lesson);
  const failureRate = stats.failures / (stats.success + stats.failures);

  return difficulty * (1 + failureRate);
}

export function orderLessonsByLearning(
  lessons: Lesson[],
  state: LearningState,
  getDomainSize: (lesson: Lesson) => number
): Lesson[] {
  return [...lessons].sort((a, b) => {
    const priorityA = getLessonPriority(a, state, getDomainSize);
    const priorityB = getLessonPriority(b, state, getDomainSize);
    return priorityB - priorityA;
  });
}

export function rankSlots(
  slots: SlotIndex[],
  state: LearningState
): SlotIndex[] {
  return [...slots].sort((a, b) => {
    const sa = state.slotStats[a] || { success: 1, fail: 1 };
    const sb = state.slotStats[b] || { success: 1, fail: 1 };

    const scoreA = sa.success / (sa.success + sa.fail);
    const scoreB = sb.success / (sb.success + sb.fail);

    return scoreB - scoreA;
  });
}

export function recordSuccess(
  lessonId: string,
  slot: SlotIndex,
  state: LearningState
): void {
  if (!state.lessonStats[lessonId]) {
    state.lessonStats[lessonId] = { failures: 0, success: 0 };
  }
  state.lessonStats[lessonId].success++;

  if (!state.slotStats[slot]) {
    state.slotStats[slot] = { success: 0, fail: 0 };
  }
  state.slotStats[slot].success++;
}

export function recordFailure(
  lessonId: string,
  slot: SlotIndex,
  state: LearningState
): void {
  if (!state.lessonStats[lessonId]) {
    state.lessonStats[lessonId] = { failures: 0, success: 0 };
  }
  state.lessonStats[lessonId].failures++;

  if (!state.slotStats[slot]) {
    state.slotStats[slot] = { success: 0, fail: 0 };
  }
  state.slotStats[slot].fail++;
}

export function mergeLearningState(
  target: LearningState,
  source: LearningState
): void {
  for (const lessonId in source.lessonStats) {
    if (!target.lessonStats[lessonId]) {
      target.lessonStats[lessonId] = { failures: 0, success: 0 };
    }
    target.lessonStats[lessonId].failures += source.lessonStats[lessonId].failures;
    target.lessonStats[lessonId].success += source.lessonStats[lessonId].success;
  }

  for (const slot in source.slotStats) {
    const slotNum = Number(slot);
    if (!target.slotStats[slotNum]) {
      target.slotStats[slotNum] = { success: 0, fail: 0 };
    }
    target.slotStats[slotNum].success += source.slotStats[slotNum].success;
    target.slotStats[slotNum].fail += source.slotStats[slotNum].fail;
  }
}

export function cloneLearningState(state: LearningState): LearningState {
  return {
    lessonStats: { ...state.lessonStats },
    slotStats: { ...state.slotStats },
  };
}

export function serializeLearningState(state: LearningState): string {
  return JSON.stringify(state);
}

export function deserializeLearningState(data: string): LearningState {
  return JSON.parse(data) as LearningState;
}