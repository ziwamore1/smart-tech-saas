import { 
  Lesson, 
  Timeslot, 
  TimetableSchedule, 
  ScheduledLesson,
  TimetableConfig,
  Teacher,
  Class
} from './lesson';
import { 
  ConstraintContext, 
  hasHardConstraints, 
  scoreSchedule,
  isValidPlacement,
  ConstraintViolation
} from './constraints';
import { filterDomains, PropagationResult } from './propagation';

export interface SolveResult {
  schedule: TimetableSchedule | null;
  success: boolean;
  iterations: number;
  backtracks: number;
  unassigned: Lesson[];
  violations: ConstraintViolation[];
}

export interface SolveOptions {
  maxIterations?: number;
  maxTime?: number;
  enablePropagation?: boolean;
  heuristic?: 'mrv' | 'degree' | 'static';
  shuffleLessons?: boolean;
  shuffleTimeslots?: boolean;
}

export function solve(
  lessons: Lesson[],
  timeslots: Timeslot[],
  context: ConstraintContext,
  options: SolveOptions = {}
): SolveResult {
  const {
    maxIterations = 5000,
    maxTime = 60000,
    enablePropagation = true,
    heuristic = 'mrv',
    shuffleLessons = false,
    shuffleTimeslots = false,
  } = options;

  const schedule = new TimetableSchedule();
  let orderedLessons = [...lessons];
  let orderedTimeslots = [...timeslots];

  if (shuffleLessons) {
    orderedLessons = shuffleArray(orderedLessons);
  }
  if (shuffleTimeslots) {
    orderedLessons = shuffleArray(orderedLessons);
    orderedTimeslots = shuffleArray(orderedTimeslots);
  }

  if (heuristic === 'mrv') {
    orderedLessons = orderLessonsByMRV(orderedLessons, orderedTimeslots, schedule, context);
  } else if (heuristic === 'degree') {
    orderedLessons = orderLessonsByDegree(orderedLessons, orderedTimeslots, context);
  }

  const startTime = Date.now();
  let iterations = 0;
  let backtracks = 0;
  const violations: ConstraintViolation[] = [];

  const result = backtrack(
    orderedLessons,
    0,
    schedule,
    orderedTimeslots,
    context,
    enablePropagation,
    startTime,
    maxTime,
    maxIterations,
    iterations,
    backtracks,
    violations
  );

  return {
    ...result,
    iterations: result.iterations,
    backtracks: result.backtracks,
  };
}

function backtrack(
  lessons: Lesson[],
  index: number,
  schedule: TimetableSchedule,
  timeslots: Timeslot[],
  context: ConstraintContext,
  enablePropagation: boolean,
  startTime: number,
  maxTime: number,
  maxIterations: number,
  iterations: number,
  backtracks: number,
  violations: ConstraintViolation[]
): {
  schedule: TimetableSchedule | null;
  success: boolean;
  iterations: number;
  backtracks: number;
  unassigned: Lesson[];
  violations: ConstraintViolation[];
} {
  if (index >= lessons.length) {
    return {
      schedule,
      success: true,
      iterations,
      backtracks,
      unassigned: [],
      violations: [],
    };
  }

  if (Date.now() - startTime > maxTime) {
    violations.push({
      type: 'hard',
      name: 'TIMEOUT',
      message: 'Solver timeout',
      penalty: 0,
    });
    return {
      schedule,
      success: false,
      iterations,
      backtracks,
      unassigned: lessons.slice(index),
      violations,
    };
  }

  if (iterations >= maxIterations) {
    violations.push({
      type: 'hard',
      name: 'ITERATIONS_LIMIT',
      message: 'Max iterations reached',
      penalty: 0,
    });
    return {
      schedule,
      success: false,
      iterations,
      backtracks,
      unassigned: lessons.slice(index),
      violations,
    };
  }

  iterations++;

  const lesson = lessons[index];
  let orderedTimeslots = orderTimeslots(timeslots, lesson, schedule, context);

  if (enablePropagation) {
    const remainingLessons = lessons.slice(index + 1);
    orderedTimeslots = filterDomains(lesson, orderedTimeslots, schedule, context, remainingLessons);
  }

  for (const timeslot of orderedTimeslots) {
    if (!hasHardConstraints(schedule, lesson, timeslot, context)) {
      continue;
    }

    schedule.add(new ScheduledLesson(lesson, timeslot));

    const result = backtrack(
      lessons,
      index + 1,
      schedule,
      timeslots,
      context,
      enablePropagation,
      startTime,
      maxTime,
      maxIterations,
      iterations,
      backtracks,
      violations
    );

    if (result.success) {
      return result;
    }

    schedule.remove(lesson.id);
    backtracks++;
  }

  return {
    schedule,
    success: false,
    iterations,
    backtracks,
    unassigned: lessons.slice(index),
    violations,
  };
}

export function selectNextLesson(
  lessons: Lesson[],
  schedule: TimetableSchedule
): Lesson | null {
  const unassigned = lessons.filter(l => !schedule.findByLesson(l.id));
  if (unassigned.length === 0) return null;
  return unassigned[0];
}

export function orderLessonsByMRV(
  lessons: Lesson[],
  timeslots: Timeslot[],
  schedule: TimetableSchedule,
  context: ConstraintContext
): Lesson[] {
  const unassigned = lessons.filter(l => !schedule.findByLesson(l.id));
  
  return unassigned.sort((a, b) => {
    const countA = countValidTimeslots(a, timeslots, schedule, context);
    const countB = countValidTimeslots(b, timeslots, schedule, context);
    return countA - countB;
  });
}

export function orderLessonsByDegree(
  lessons: Lesson[],
  timeslots: Timeslot[],
  context: ConstraintContext
): Lesson[] {
  return [...lessons].sort((a, b) => {
    const degreeA = calculateDegree(a, lessons, context);
    const degreeB = calculateDegree(b, lessons, context);
    return degreeB - degreeA;
  });
}

export function calculateDegree(
  lesson: Lesson,
  allLessons: Lesson[],
  context: ConstraintContext
): number {
  let degree = 0;
  
  for (const other of allLessons) {
    if (other.id === lesson.id) continue;
    if (other.teacherId === lesson.teacherId) degree++;
    if (other.classId === lesson.classId) degree++;
  }
  
  return degree;
}

function countValidTimeslots(
  lesson: Lesson,
  timeslots: Timeslot[],
  schedule: TimetableSchedule,
  context: ConstraintContext
): number {
  return timeslots.filter(ts => hasHardConstraints(schedule, lesson, ts, context)).length;
}

export function orderTimeslots(
  timeslots: Timeslot[],
  lesson: Lesson,
  schedule: TimetableSchedule,
  context: ConstraintContext
): Timeslot[] {
  return [...timeslots].sort((a, b) => {
    const validA = hasHardConstraints(schedule, lesson, a, context);
    const validB = hasHardConstraints(schedule, lesson, b, context);
    
    if (validA && !validB) return -1;
    if (!validA && validB) return 1;
    
    const teacher = context.teachers.get(lesson.teacherId);
    if (teacher) {
      const prefA = teacher.preferredDays.includes(a.day) ? 1 : 0;
      const prefB = teacher.preferredDays.includes(b.day) ? 1 : 0;
      if (prefA !== prefB) return prefB - prefA;
    }
    
    return a.period - b.period;
  });
}

export function isValid(
  schedule: TimetableSchedule,
  lesson: Lesson,
  timeslot: Timeslot,
  context: ConstraintContext
): boolean {
  return hasHardConstraints(schedule, lesson, timeslot, context);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}