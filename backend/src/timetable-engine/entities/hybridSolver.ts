import { ExpandedLesson, TimeslotEntity, ScheduleEntry, generateTimeslots } from './index';
import { BitmaskState, ConstraintMatrix } from './fastState';
import { solveCSP } from './solver';
import { runGeneticAlgorithm } from './genetic';
import { scoreSchedule } from './scoring';
import { autoFix } from './conflictDetector';

export interface SolveConfig {
  strategy: 'csp' | 'genetic' | 'auto';
  maxIterations: number;
  maxTime: number;
  workerCount: number;
}

export const DEFAULT_SOLVE_CONFIG: SolveConfig = {
  strategy: 'auto',
  maxIterations: 5000,
  maxTime: 60000,
  workerCount: 1,
};

export interface SolveResult {
  success: boolean;
  schedule: ScheduleEntry[];
  score: number;
  method: string;
  timeElapsed: number;
  iterations: number;
}

function splitIntoGroups(
  lessons: ExpandedLesson[],
  by: 'class' | 'teacher' | 'subject'
): ExpandedLesson[][] {
  const groups = new Map<string, ExpandedLesson[]>();

  for (const lesson of lessons) {
    let key: string;
    switch (by) {
      case 'class':
        key = lesson.classId;
        break;
      case 'teacher':
        key = lesson.teacherId;
        break;
      case 'subject':
        key = lesson.subjectId;
        break;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(lesson);
  }

  return Array.from(groups.values());
}

function solveGroupCSP(
  groupLessons: ExpandedLesson[],
  state: BitmaskState,
  matrix: ConstraintMatrix
): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const sorted = [...groupLessons].sort((a, b) => {
    const validA = matrix.getValidSlotsForLesson(a, state).length;
    const validB = matrix.getValidSlotsForLesson(b, state).length;
    return validA - validB;
  });

  for (const lesson of sorted) {
    const validSlots = matrix.getValidSlotsForLesson(lesson, state);
    
    if (validSlots.length === 0) {
      continue;
    }

    const slotIndex = validSlots[0];
    const day = Math.floor(slotIndex / 8) + 1;
    const period = (slotIndex % 8) + 1;
    const timeslotId = `TS_${day}_${period}`;

    entries.push({
      lessonId: lesson.instanceId,
      timeslotId,
    });

    state.assignTeacher(lesson.teacherId, slotIndex);
    state.assignClass(lesson.classId, slotIndex);
    state.assignLesson(lesson.instanceId, slotIndex);
  }

  return entries;
}

async function solveGroupAsync(
  groupLessons: ExpandedLesson[],
  timeslots: TimeslotEntity[],
  config: SolveConfig
): Promise<ScheduleEntry[]> {
  const state = new BitmaskState(timeslots.length);
  const matrix = new ConstraintMatrix(
    timeslots.length,
    1,
    1
  );

  if (config.strategy === 'csp' || groupLessons.length < 300) {
    return solveGroupCSP(groupLessons, state, matrix);
  }

  const result = runGeneticAlgorithm(groupLessons, timeslots, {
    populationSize: 30,
    generations: 50,
  });

  return result.schedule;
}

export async function hybridSolve(
  lessons: ExpandedLesson[],
  timeslots: TimeslotEntity[],
  config: Partial<SolveConfig> = {}
): Promise<SolveResult> {
  const cfg = { ...DEFAULT_SOLVE_CONFIG, ...config };
  const startTime = Date.now();

  const totalLessons = lessons.length;
  let strategy = cfg.strategy;

  if (strategy === 'auto') {
    if (totalLessons < 500) {
      strategy = 'csp';
    } else {
      strategy = 'genetic';
    }
  }

  let schedule: ScheduleEntry[] = [];

  if (strategy === 'csp' && cfg.workerCount === 1) {
    const state = new BitmaskState(timeslots.length);
    const matrix = new ConstraintMatrix(timeslots.length, 1, 1);

    const sorted = [...lessons].sort((a, b) => {
      const validA = matrix.getValidSlotsForLesson(a, state).length;
      const validB = matrix.getValidSlotsForLesson(b, state).length;
      return validA - validB;
    });

    const sortedLessons = sorted.filter(
      (lesson, i) => i < cfg.maxIterations
    );

    schedule = [];
    for (const lesson of sortedLessons) {
      const validSlots = matrix.getValidSlotsForLesson(lesson, state);

      if (validSlots.length > 0) {
        const slotIndex = validSlots[0];
        const day = Math.floor(slotIndex / 8) + 1;
        const period = (slotIndex % 8) + 1;

        schedule.push({
          lessonId: lesson.instanceId,
          timeslotId: `TS_${day}_${period}`,
        });

        state.assignTeacher(lesson.teacherId, slotIndex);
        state.assignClass(lesson.classId, slotIndex);
      }
    }
  } else {
    const groups = splitIntoGroups(lessons, 'class');

    const groupResults = await Promise.all(
      groups.map(async (groupLessons, groupIndex) => {
        await new Promise(resolve => setTimeout(resolve, groupIndex * 10));
        return solveGroupAsync(groupLessons, timeslots, cfg);
      })
    );

    for (const groupResult of groupResults) {
      schedule.push(...groupResult);
    }
  }

  const fixResult = autoFix(schedule, timeslots);
  schedule = fixResult.schedule;

  const score = scoreSchedule(schedule, timeslots).totalScore;
  const success = schedule.length === lessons.length;

  return {
    success,
    schedule,
    score,
    method: strategy,
    timeElapsed: Date.now() - startTime,
    iterations: schedule.length,
  };
}

export function incrementalSolve(
  changedLessonIds: string[],
  currentSchedule: ScheduleEntry[],
  timeslots: TimeslotEntity[],
  lessons: ExpandedLesson[]
): ScheduleEntry[] {
  const affectedIds = new Set<string>();

  for (const changedId of changedLessonIds) {
    affectedIds.add(changedId);

    const currentEntry = currentSchedule.find(e => e.lessonId === changedId);
    if (currentEntry) {
      const parts = changedId.split('-');
      if (parts.length >= 3) {
        const teacherId = parts[2];
        const classId = parts[0];

        for (const entry of currentSchedule) {
          if (entry.lessonId.includes(teacherId) || entry.lessonId.includes(classId)) {
            affectedIds.add(entry.lessonId);
          }
        }
      }
    }
  }

  const unaffected = currentSchedule.filter(
    e => !affectedIds.has(e.lessonId)
  );

  const affectedLessons = lessons.filter(l => affectedIds.has(l.instanceId));
  const unaffectedLessons = lessons.filter(l => !affectedIds.has(l.instanceId));

  const usedSlots = new Set(unaffected.map(e => e.timeslotId));
  const availableTimeslots = timeslots.filter(
    ts => !ts.isBreak && !usedSlots.has(ts.id)
  );

  const state = new BitmaskState(timeslots.length);

  for (const entry of unaffected) {
    const ts = timeslots.find(t => t.id === entry.timeslotId);
    if (ts) {
      const slotIndex = (ts.day - 1) * 8 + (ts.period - 1);
      const parts = entry.lessonId.split('-');
      if (parts.length >= 3) {
        state.assignTeacher(parts[2], slotIndex);
        state.assignClass(parts[0], slotIndex);
      }
    }
  }

  const matrix = new ConstraintMatrix(timeslots.length, 1, 1);
  const newEntries: ScheduleEntry[] = [];

  for (const lesson of affectedLessons) {
    const validSlots = matrix.getValidSlotsForLesson(lesson, state);

    if (validSlots.length > 0) {
      const slotIndex = validSlots[0];
      const day = Math.floor(slotIndex / 8) + 1;
      const period = (slotIndex % 8) + 1;

      newEntries.push({
        lessonId: lesson.instanceId,
        timeslotId: `TS_${day}_${period}`,
      });

      state.assignTeacher(lesson.teacherId, slotIndex);
      state.assignClass(lesson.classId, slotIndex);
    }
  }

  return [...unaffected, ...newEntries];
}

export { hybridSolve as smartSolve };