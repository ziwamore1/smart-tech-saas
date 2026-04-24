export * from './domain/index';

export { createFastSolver, FastSolverResult, FastSolverOptions } from './solver/fastCSPSolver';
export { generateTimetableHybrid, HybridConfig, HybridResult, PenaltyWeights } from './solver/fastHybridSolver';
export { solveDistributed, runParallelHybrid } from './solver/parallelSolver';
export { mlFitness, extractFeatures, updateModel, MLModel, Features } from './solver/mlScoring';
export { LearningState, createLearningState } from './solver/adaptiveHeuristics';
export * from './ai/index';

export interface TimetableInput {
  lessons: any[];
  timeslots: any[];
  teachers: any[];
  classes: any[];
  rooms: any[];
  config?: any;
}

export interface TimetableConfig {
  daysPerWeek: number;
  periodsPerDay: number;
}

export const DEFAULT_TIMETABLE_CONFIG: TimetableConfig = {
  daysPerWeek: 5,
  periodsPerDay: 7,
};

export interface TimetableState {
  entries: any[];
  assignedLessons: Set<string>;
}

export interface ClassEntity {
  id: string;
  name: string;
  capacity: number;
  year: number;
}

export interface TeacherEntity {
  id: string;
  name: string;
  employeeNo: string;
  subjects: string[];
}

export interface SubjectEntity {
  id: string;
  name: string;
  code: string;
}

export interface RoomEntity {
  id: string;
  name: string;
  capacity: number;
  type: string;
}

export interface TimeslotEntity {
  id: string;
  day: number;
  period: number;
  isBreak: boolean;
}

export interface LessonEntity {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId?: string;
  requiredPerWeek: number;
}

export interface ScheduleEntry {
  lessonId: string;
  timeslotId: string;
}

export interface ExpandedLesson {
  instanceId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId?: string;
}

export function generateTimeslots(config?: TimetableConfig): TimeslotEntity[] {
  const cfg = config ?? DEFAULT_TIMETABLE_CONFIG;
  const timeslots: TimeslotEntity[] = [];

  for (let day = 1; day <= cfg.daysPerWeek; day++) {
    for (let period = 1; period <= cfg.periodsPerDay; period++) {
      timeslots.push({
        id: `TS_${day}_${period}`,
        day,
        period,
        isBreak: period === 4,
      });
    }
  }

  return timeslots;
}

export function timeslotKey(day: number, period: number): string {
  return `TS_${day}_${period}`;
}

export function parseTimeslotKey(key: string): { day: number; period: number } | null {
  const match = key.match(/TS_(\d+)_(\d+)/);
  if (!match) return null;
  return { day: parseInt(match[1], 10), period: parseInt(match[2], 10) };
}