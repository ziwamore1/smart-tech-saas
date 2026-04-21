import { ExpandedLesson, TimeslotEntity, ScheduleEntry } from './index';
import { 
  scoreSchedule, 
  scorePartialSchedule, 
  ScoringWeights, 
  DEFAULT_WEIGHTS,
  ScoringResult 
} from './scoring';

export class SolverState {
  constructor(timeslots: TimeslotEntity[]) {
    this.timeslots = timeslots;
    this.schedule = [];
    this.teacherBusy = new Map<string, boolean>();
    this.classBusy = new Map<string, boolean>();
    this.roomBusy = new Map<string, boolean>();
    this.assignedLessons = new Set<string>();
  }

  timeslots: TimeslotEntity[];
  schedule: ScheduleEntry[];
  teacherBusy: Map<string, boolean>;
  classBusy: Map<string, boolean>;
  roomBusy: Map<string, boolean>;
  assignedLessons: Set<string>;

  isTeacherFree(teacherId: string, timeslotId: string): boolean {
    return !this.teacherBusy.has(`${teacherId}_${timeslotId}`);
  }

  isClassFree(classId: string, timeslotId: string): boolean {
    return !this.classBusy.has(`${classId}_${timeslotId}`);
  }

  isRoomFree(roomId: string, timeslotId: string): boolean {
    return !this.roomBusy.has(`${roomId}_${timeslotId}`);
  }

  isAssigned(lessonInstanceId: string): boolean {
    return this.assignedLessons.has(lessonInstanceId);
  }

  assign(lesson: ExpandedLesson, timeslot: TimeslotEntity, roomId?: string): void {
    const entry: ScheduleEntry = {
      lessonId: lesson.instanceId,
      timeslotId: timeslot.id,
      roomId,
    };

    this.schedule.push(entry);
    this.assignedLessons.add(lesson.instanceId);
    this.teacherBusy.set(`${lesson.teacherId}_${timeslot.id}`, true);
    this.classBusy.set(`${lesson.classId}_${timeslot.id}`, true);

    if (roomId) {
      this.roomBusy.set(`${roomId}_${timeslot.id}`, true);
    }
  }

  unassign(lesson: ExpandedLesson, timeslot: TimeslotEntity, roomId?: string): void {
    this.schedule.pop();
    this.assignedLessons.delete(lesson.instanceId);
    this.teacherBusy.delete(`${lesson.teacherId}_${timeslot.id}`);
    this.classBusy.delete(`${lesson.classId}_${timeslot.id}`);

    if (roomId) {
      this.roomBusy.delete(`${roomId}_${timeslot.id}`);
    }
  }

  clone(): SolverState {
    const newState = new SolverState(this.timeslots);
    newState.schedule = [...this.schedule];
    newState.assignedLessons = new Set(this.assignedLessons);
    newState.teacherBusy = new Map(this.teacherBusy);
    newState.classBusy = new Map(this.classBusy);
    newState.roomBusy = new Map(this.roomBusy);
    return newState;
  }

  getTeacherLessonsOnDay(teacherId: string, day: number): number {
    let count = 0;
    for (const entry of this.schedule) {
      const ts = this.timeslots.find(t => t.id === entry.timeslotId);
      if (ts && ts.day === day && entry.lessonId.includes(teacherId)) {
        count++;
      }
    }
    return count;
  }

  getClassLessonsOnDay(classId: string, day: number): number {
    let count = 0;
    for (const entry of this.schedule) {
      const ts = this.timeslots.find(t => t.id === entry.timeslotId);
      if (ts && ts.day === day && entry.lessonId.includes(classId)) {
        count++;
      }
    }
    return count;
  }
}

export interface SolverOptions {
  maxIterations?: number;
  maxTime?: number;
  enableForwardCheck?: boolean;
  enableMRV?: boolean;
  enableDomainOrdering?: boolean;
  enableScoring?: boolean;
  weights?: Partial<ScoringWeights>;
  pruneThreshold?: number;
  findBest?: boolean;
}

export interface SolverResult {
  success: boolean;
  schedule: ScheduleEntry[];
  score: number;
  iterations: number;
  backtracks: number;
  unassigned: ExpandedLesson[];
  timeElapsed: number;
  scoringDetails?: ScoringResult;
}

export function solveCSP(
  lessons: ExpandedLesson[],
  timeslots: TimeslotEntity[],
  options: SolverOptions = {}
): SolverResult {
  const {
    maxIterations = 5000,
    maxTime = 60000,
    enableForwardCheck = true,
    enableMRV = true,
    enableDomainOrdering = true,
    enableScoring = false,
    weights = {},
    pruneThreshold = 900,
    findBest = false,
  } = options;

  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const availableTimeslots = timeslots.filter(t => !t.isBreak);
  const state = new SolverState(timeslots);

  let iterations = 0;
  let backtracks = 0;
  let bestScore = -Infinity;
  let bestSchedule: ScheduleEntry[] = [];
  const startTime = Date.now();

  const orderedLessons = enableMRV
    ? orderByMRV(lessons, availableTimeslots, state)
    : [...lessons];

  const result = backtrack(
    orderedLessons,
    0,
    state,
    availableTimeslots,
    enableForwardCheck,
    enableDomainOrdering,
    maxIterations,
    maxTime,
    startTime,
    iterations,
    backtracks,
    bestScore,
    bestSchedule,
    enableScoring,
    w,
    pruneThreshold,
    findBest,
    timeslots
  );

  const finalScore = enableScoring 
    ? scoreSchedule(state.schedule, timeslots, w).totalScore
    : 0;

  return {
    success: result.success,
    schedule: findBest && bestSchedule.length > 0 ? bestSchedule : state.schedule,
    score: enableScoring ? (findBest && bestSchedule.length > 0 
      ? scoreSchedule(bestSchedule, timeslots, w).totalScore 
      : finalScore) : 0,
    iterations: result.iterations,
    backtracks: result.backtracks,
    unassigned: result.unassigned,
    timeElapsed: Date.now() - startTime,
  };
}

function backtrack(
  lessons: ExpandedLesson[],
  index: number,
  state: SolverState,
  timeslots: TimeslotEntity[],
  enableForwardCheck: boolean,
  enableDomainOrdering: boolean,
  maxIterations: number,
  maxTime: number,
  startTime: number,
  iterations: number,
  backtracks: number,
  bestScore: number,
  bestSchedule: ScheduleEntry[],
  enableScoring: boolean,
  weights: ScoringWeights,
  pruneThreshold: number,
  findBest: boolean,
  allTimeslots: TimeslotEntity[]
): { success: boolean; unassigned: ExpandedLesson[]; iterations: number; backtracks: number } {
  if (index >= lessons.length) {
    if (enableScoring && findBest) {
      const currentScore = scoreSchedule(state.schedule, allTimeslots, weights).totalScore;
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestSchedule.length = 0;
        bestSchedule.push(...state.schedule);
      }
    }
    return { success: true, unassigned: [], iterations, backtracks };
  }

  if (Date.now() - startTime > maxTime) {
    return {
      success: false,
      unassigned: lessons.slice(index),
      iterations,
      backtracks,
    };
  }

  if (iterations >= maxIterations) {
    return {
      success: false,
      unassigned: lessons.slice(index),
      iterations,
      backtracks,
    };
  }

  iterations++;

  const lesson = lessons[index];
  let orderedTimeslots = enableDomainOrdering
    ? orderTimeslotsByScore(timeslots, lesson, state)
    : [...timeslots];

  if (enableForwardCheck) {
    orderedTimeslots = getValidTimeslots(lesson, orderedTimeslots, state);

    if (orderedTimeslots.length === 0) {
      backtracks++;
      return {
        success: false,
        unassigned: lessons.slice(index),
        iterations,
        backtracks,
      };
    }
  }

  for (const slot of orderedTimeslots) {
    if (isValid(state, lesson, slot)) {
      state.assign(lesson, slot);

      let canPrune = false;
      if (enableScoring && findBest && bestScore > pruneThreshold) {
        canPrune = true;
      }

      if (!canPrune) {
        const result = backtrack(
          lessons,
          index + 1,
          state,
          timeslots,
          enableForwardCheck,
          enableDomainOrdering,
          maxIterations,
          maxTime,
          startTime,
          iterations,
          backtracks,
          bestScore,
          bestSchedule,
          enableScoring,
          weights,
          pruneThreshold,
          findBest,
          allTimeslots
        );

        if (result.success && !findBest) {
          return result;
        }
      }

      state.unassign(lesson, slot);
      backtracks++;
    }
  }

  return {
    success: false,
    unassigned: lessons.slice(index),
    iterations,
    backtracks,
  };
}

function isValid(state: SolverState, lesson: ExpandedLesson, timeslot: TimeslotEntity): boolean {
  if (!state.isTeacherFree(lesson.teacherId, timeslot.id)) {
    return false;
  }

  if (!state.isClassFree(lesson.classId, timeslot.id)) {
    return false;
  }

  return true;
}

function getValidTimeslots(
  lesson: ExpandedLesson,
  timeslots: TimeslotEntity[],
  state: SolverState
): TimeslotEntity[] {
  return timeslots.filter(ts => isValid(state, lesson, ts));
}

function countAvailableSlots(lesson: ExpandedLesson, timeslots: TimeslotEntity[], state: SolverState): number {
  return timeslots.filter(ts => isValid(state, lesson, ts)).length;
}

function orderByMRV(lessons: ExpandedLesson[], timeslots: TimeslotEntity[], state: SolverState): ExpandedLesson[] {
  return [...lessons].sort((a, b) => {
    const countA = countAvailableSlots(a, timeslots, state);
    const countB = countAvailableSlots(b, timeslots, state);
    return countA - countB;
  });
}

function orderTimeslotsByScore(
  timeslots: TimeslotEntity[],
  lesson: ExpandedLesson,
  state: SolverState
): TimeslotEntity[] {
  return [...timeslots].sort((a, b) => {
    const scoreA = conflictScore(state, lesson, a);
    const scoreB = conflictScore(state, lesson, b);
    return scoreA - scoreB;
  });
}

function conflictScore(state: SolverState, lesson: ExpandedLesson, timeslot: TimeslotEntity): number {
  let score = 0;

  if (!state.isTeacherFree(lesson.teacherId, timeslot.id)) {
    score += 10;
  }

  if (!state.isClassFree(lesson.classId, timeslot.id)) {
    score += 10;
  }

  const teacherDayLessons = state.getTeacherLessonsOnDay(lesson.teacherId, timeslot.day);
  if (teacherDayLessons >= 4) {
    score += 5;
  }

  const classDayLessons = state.getClassLessonsOnDay(lesson.classId, timeslot.day);
  if (classDayLessons >= 5) {
    score += 5;
  }

  return score;
}

export { SolverState as State, isValid, getValidTimeslots, countAvailableSlots, conflictScore };
