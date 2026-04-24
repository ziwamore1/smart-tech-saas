import {
  TimetableInput,
  TimetableConfig,
  DEFAULT_TIMETABLE_CONFIG,
  TimetableState,
  ClassEntity,
  TeacherEntity,
  SubjectEntity,
  RoomEntity,
  TimeslotEntity,
  LessonEntity,
  ScheduleEntry,
  ExpandedLesson,
  generateTimeslots,
  timeslotKey,
  parseTimeslotKey,
} from './index';
import {
  precomputeData,
  validateInput,
  getStatistics,
  PreprocessedData,
} from './preprocessor';
import {
  ConstraintContext,
  createConstraintContext,
  canPlaceLesson,
  hasHardConstraints,
  scoreSchedule,
  ConstraintViolation,
} from './constraints';
import {
  solveCSP,
  SolverOptions,
  SolverResult,
} from './solver';
import {
  detectConflicts,
  autoFix,
  AutoFixResult,
  Conflict,
} from './conflictDetector';

function convertConflictsToViolations(conflicts: Conflict[]): ConstraintViolation[] {
  return conflicts.map(conflict => ({
    type: 'hard' as const,
    code: `CONFLICT_${conflict.type}`,
    message: `Conflict: ${conflict.type} - ${conflict.conflictingWith.join(', ')}`,
    penalty: 100,
    lessonId: conflict.lessonId,
    timeslotId: conflict.timeslotId,
  }));
}

export interface GenerateTimetableRequest {
  classes: ClassEntity[];
  teachers: TeacherEntity[];
  subjects: SubjectEntity[];
  rooms: RoomEntity[];
  lessons: LessonEntity[];
  timeslots?: TimeslotEntity[];
  config?: Partial<TimetableConfig>;
}

export interface GenerateTimetableResponse {
  success: boolean;
  schedule: ScheduleEntry[];
  score: number;
  method: string;
  iterations: number;
  unassigned: string[];
  violations: ConstraintViolation[];
  errors: string[];
  warnings: string[];
  statistics: ReturnType<typeof getStatistics>;
}

export interface SolveOptions {
  maxIterations?: number;
  maxTime?: number;
  enableOptimization?: boolean;
  useBacktracking?: boolean;
  useGenetic?: boolean;
}

export interface ProgressCallback {
  (progress: SolverProgress): void;
}

export interface SolverProgress {
  phase: 'validating' | 'preprocessing' | 'solving' | 'optimizing' | 'autofix' | 'complete';
  percent: number;
  message: string;
  iterations?: number;
  conflicts?: number;
  fixed?: number;
}

export async function generateTimetable(
  request: GenerateTimetableRequest,
  options: SolveOptions = {},
  progressCallback?: ProgressCallback
): Promise<GenerateTimetableResponse> {
  const config = { ...DEFAULT_TIMETABLE_CONFIG, ...request.config };
  
  const reportProgress = (phase: SolverProgress['phase'], percent: number, message: string, extra?: Partial<SolverProgress>) => {
    if (progressCallback) {
      progressCallback({ phase, percent, message, ...extra });
    }
  };

  reportProgress('validating', 5, 'Validating input data...');
  const validation = validateInput(request, config);

  if (!validation.valid) {
    reportProgress('complete', 100, 'Validation failed');
    return {
      success: false,
      schedule: [],
      score: 0,
      method: 'validation',
      iterations: 0,
      unassigned: [],
      violations: [],
      errors: validation.errors,
      warnings: validation.warnings,
      statistics: getStatistics(request),
    };
  }

  reportProgress('preprocessing', 15, 'Preprocessing lessons...');
  const timeslots = request.timeslots || generateTimeslots(config);
  const data = precomputeData(request, config);
  const context = createConstraintContext(
    data,
    request.teachers,
    request.classes,
    request.rooms,
    timeslots
  );

  reportProgress('solving', 30, 'Generating timetable...');
  const result = solveTimetable(data, timeslots, options, reportProgress);

  const conflictResult = detectConflicts(result.schedule);
  let autoFixResult: AutoFixResult | null = null;
  let fixedCount = 0;
  
  if (conflictResult.hasConflicts) {
    reportProgress('autofix', 80, `Resolving ${conflictResult.conflicts.length} conflicts...`);
    autoFixResult = autoFix(result.schedule, timeslots, 10);
    fixedCount = autoFixResult.fixed;
  }

  const finalSchedule = autoFixResult?.schedule || result.schedule;
  const finalScore = calculateScore(finalSchedule, timeslots);
  
  reportProgress('complete', 100, 'Timetable generated successfully');

  return {
    success: !detectConflicts(finalSchedule).hasConflicts,
    schedule: finalSchedule,
    score: finalScore,
    method: result.method,
    iterations: result.iterations,
    unassigned: result.unassigned.map(l => l.instanceId),
    violations: convertConflictsToViolations(conflictResult.conflicts),
    errors: [],
    warnings: validation.warnings,
    statistics: getStatistics(request),
  };
}

interface ExtendedSolverResult {
  success: boolean;
  schedule: ScheduleEntry[];
  score: number;
  method: string;
  iterations: number;
  backtracks: number;
  unassigned: ExpandedLesson[];
}

function solveTimetable(
  data: PreprocessedData,
  timeslots: TimeslotEntity[],
  options: SolveOptions,
  reportProgress?: (phase: SolverProgress['phase'], percent: number, message: string, extra?: Partial<SolverProgress>) => void
): ExtendedSolverResult {
  const {
    maxIterations = 5000,
    maxTime = 60000,
  } = options;

  const solverOptions: SolverOptions = {
    maxIterations,
    maxTime,
    enableForwardCheck: true,
    enableMRV: true,
    enableDomainOrdering: true,
  };

  const result = solveCSP(data.lessons, timeslots, solverOptions);

  if (reportProgress) {
    reportProgress('solving', 70, `Placed ${result.schedule.length} lessons`, { iterations: result.iterations });
  }

  return {
    success: result.success,
    schedule: result.schedule,
    score: 0,
    method: result.success ? 'CSP-Backtracking' : 'Fallback',
    iterations: result.iterations,
    backtracks: result.backtracks,
    unassigned: result.unassigned,
  };
}

function calculateScore(schedule: ScheduleEntry[], timeslots: TimeslotEntity[]): number {
  let score = 1000;

  const byDay = new Map<number, number>();
  for (const entry of schedule) {
    const ts = timeslots.find(t => t.id === entry.timeslotId);
    if (!ts) continue;

    byDay.set(ts.day, (byDay.get(ts.day) || 0) + 1);
  }

  for (const [, entries] of byDay) {
    if (entries > 0 && entries <= 3) {
      score += 5;
    } else if (entries > 6) {
      score -= (entries - 6) * 2;
    }
  }

  return score;
}

function scoreSoftConstraints(
  state: TimetableState,
  lesson: ExpandedLesson,
  timeslotId: string,
  context: ConstraintContext
): number {
  let score = 0;

  const parsed = parseTimeslotKey(timeslotId);
  if (!parsed) return 0;

  const teacher = context.teachers.get(lesson.teacherId);
  if (teacher?.preferences?.preferredDays?.includes(parsed.day)) {
    score += 10;
  }

  const sameDayLessons = state.schedule.filter(entry => {
    const entryParsed = parseTimeslotKey(entry.timeslotId);
    if (!entryParsed) return false;
    return entry.lessonId.includes(lesson.subjectId) && entryParsed.day === parsed.day;
  });

  if (sameDayLessons.length > 0 && sameDayLessons.length < 2) {
    score += 8;
  }

  if (parsed.period <= 3) {
    score += 5;
  } else if (parsed.period >= 7) {
    score -= 2;
  }

  const teacherDayLessons = state.schedule.filter(entry => {
    const entryParsed = parseTimeslotKey(entry.timeslotId);
    if (!entryParsed) return false;
    return entry.lessonId.includes(lesson.teacherId) && entryParsed.day === parsed.day;
  });

  if (teacherDayLessons.length >= 2) {
    score -= (teacherDayLessons.length - 1) * 3;
  }

  return score;
}

export function formatScheduleByClass(
  schedule: ScheduleEntry[],
  lessons: ExpandedLesson[]
): Map<string, ScheduleEntry[]> {
  const result = new Map<string, ScheduleEntry[]>();

  for (const entry of schedule) {
    const lesson = lessons.find(l => l.instanceId === entry.lessonId);
    if (!lesson) continue;

    if (!result.has(lesson.classId)) {
      result.set(lesson.classId, []);
    }
    result.get(lesson.classId)!.push(entry);
  }

  return result;
}

export function formatScheduleByTeacher(
  schedule: ScheduleEntry[],
  lessons: ExpandedLesson[]
): Map<string, ScheduleEntry[]> {
  const result = new Map<string, ScheduleEntry[]>();

  for (const entry of schedule) {
    const lesson = lessons.find(l => l.instanceId === entry.lessonId);
    if (!lesson) continue;

    if (!result.has(lesson.teacherId)) {
      result.set(lesson.teacherId, []);
    }
    result.get(lesson.teacherId)!.push(entry);
  }

  return result;
}

export function formatScheduleByDay(
  schedule: ScheduleEntry[]
): Map<number, ScheduleEntry[]> {
  const result = new Map<number, ScheduleEntry[]>();

  for (const entry of schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    if (!result.has(parsed.day)) {
      result.set(parsed.day, []);
    }
    result.get(parsed.day)!.push(entry);
  }

  return result;
}

export function exportToArray(schedule: ScheduleEntry[]): any[] {
  return schedule.map(entry => {
    const parsed = parseTimeslotKey(entry.timeslotId);
    return {
      lessonId: entry.lessonId,
      timeslotId: entry.timeslotId,
      roomId: entry.roomId,
      day: parsed?.day,
      period: parsed?.period,
    };
  });
}

export function exportToObject(schedule: ScheduleEntry[], lessons: ExpandedLesson[]): {
  byClass: Record<string, any[]>;
  byTeacher: Record<string, any[]>;
  byDay: Record<number, any[]>;
} {
  const byClass = formatScheduleByClass(schedule, lessons);
  const byTeacher = formatScheduleByTeacher(schedule, lessons);
  const byDay = formatScheduleByDay(schedule);

  return {
    byClass: Object.fromEntries(byClass),
    byTeacher: Object.fromEntries(byTeacher),
    byDay: Object.fromEntries(byDay),
  };
}