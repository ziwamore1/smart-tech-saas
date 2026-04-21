export interface ScheduledLesson {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  classroomId?: string;
  day?: number;
  period?: number;
}

export interface TimetableState {
  slots: ScheduledLesson[];
  assignedLessons: Set<string>;
}

export function createTimetableState(): TimetableState {
  return {
    slots: [],
    assignedLessons: new Set(),
  };
}

export function cloneTimetableState(state: TimetableState): TimetableState {
  return {
    slots: [...state.slots],
    assignedLessons: new Set(state.assignedLessons),
  };
}

export interface Violation {
  constraint: string;
  message: string;
  severity: 'hard' | 'soft';
  penalty?: number;
  lesson?: ScheduledLesson;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  score?: number;
}

export interface OptimizationResult {
  state: TimetableState;
  score: number;
  iterations: number;
  converged: boolean;
}

export interface SolverConfig {
  maxIterations: number;
  maxTime: number;
  enablePropagation: boolean;
  enableOptimization: boolean;
}

export const defaultSolverConfig: SolverConfig = {
  maxIterations: 5000,
  maxTime: 60000,
  enablePropagation: true,
  enableOptimization: true,
};