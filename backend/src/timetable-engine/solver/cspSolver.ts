import { ScheduledLesson, TimetableState, cloneTimetableState, SolverConfig, defaultSolverConfig } from '../constraints/types';
import { HardConstraintChecker, hasHardConstraints } from '../constraints/hardConstraints';
import { SoftConstraintScorer } from '../constraints/softConstraints';
import { TimeslotRegistry } from '../models/Timeslot';
import { orderLessonsByMRV, orderLessonsByDegree } from './heuristics';
import { forwardCheck, propagateConstraints } from './propagation';

export interface CSPSolverResult {
  state: TimetableState;
  success: boolean;
  iterations: number;
  backtracks: number;
  unassigned: ScheduledLesson[];
  violations: string[];
}

export interface SolverOptions {
  maxIterations?: number;
  maxTime?: number;
  enablePropagation?: boolean;
  heuristic?: 'mrv' | 'degree' | 'static';
  shuffleLessons?: boolean;
}

export function createCSPSolver(
  hardChecker: HardConstraintChecker,
  softScorer: SoftConstraintScorer,
  timeslotRegistry: TimeslotRegistry,
) {
  return function solveCSP(
    lessons: ScheduledLesson[],
    options: SolverOptions = {},
  ): CSPSolverResult {
    const config: SolverConfig = {
      ...defaultSolverConfig,
      maxIterations: options.maxIterations ?? defaultSolverConfig.maxIterations,
      maxTime: options.maxTime ?? defaultSolverConfig.maxTime,
      enablePropagation: options.enablePropagation ?? true,
    };

    const state: TimetableState = {
      slots: [],
      assignedLessons: new Set(),
    };

    const availableSlots = timeslotRegistry.getAvailable();
    
    let orderedLessons = [...lessons];
    if (options.shuffleLessons) {
      orderedLessons = shuffleArray(orderedLessons);
    }
    
    if (options.heuristic === 'mrv') {
      orderedLessons = orderLessonsByMRV(lessons, state, hardChecker, availableSlots);
    } else if (options.heuristic === 'degree') {
      orderedLessons = orderLessonsByDegree(lessons, state, hardChecker, availableSlots);
    }

    const startTime = Date.now();
    let iterations = 0;
    let backtracks = 0;
    const violations: string[] = [];

    const result = backtrack(
      orderedLessons,
      0,
      state,
      availableSlots,
      config,
      iterations,
      backtracks,
      startTime,
      violations,
    );

    return {
      ...result,
      iterations: result.iterations,
      backtracks: result.backtracks,
    };
  };

  function backtrack(
    lessons: ScheduledLesson[],
    index: number,
    state: TimetableState,
    availableSlots: { day: number; period: number }[],
    config: SolverConfig,
    iterations: number,
    backtracks: number,
    startTime: number,
    violations: string[],
  ): {
    state: TimetableState;
    success: boolean;
    iterations: number;
    backtracks: number;
    unassigned: ScheduledLesson[];
    violations: string[];
  } {
    if (index >= lessons.length) {
      return {
        state,
        success: true,
        iterations,
        backtracks,
        unassigned: [],
        violations,
      };
    }

    if (Date.now() - startTime > config.maxTime) {
      violations.push('Time limit exceeded');
      return {
        state,
        success: false,
        iterations,
        backtracks,
        unassigned: lessons.slice(index),
        violations,
      };
    }

    if (iterations >= config.maxIterations) {
      violations.push('Iteration limit exceeded');
      return {
        state,
        success: false,
        iterations,
        backtracks,
        unassigned: lessons.slice(index),
        violations,
      };
    }

    iterations++;

    const lesson = lessons[index];
    const sortedSlots = [...availableSlots].sort((a, b) => {
      const scoreA = softScorer(state, lesson, a.day, a.period);
      const scoreB = softScorer(state, lesson, b.day, b.period);
      return scoreB - scoreA;
    });

    for (const slot of sortedSlots) {
      if (!hasHardConstraints(hardChecker, state, lesson, slot.day, slot.period)) {
        continue;
      }

      const newState = cloneTimetableState(state);
      newState.slots.push({
        ...lesson,
        day: slot.day,
        period: slot.period,
      });
      newState.assignedLessons.add(lesson.id);

      if (config.enablePropagation) {
        const propagationResult = propagateConstraints(
          lessons.slice(index + 1),
          newState,
          hardChecker,
          availableSlots,
        );
        
        if (!propagationResult.possible) {
          continue;
        }
      }

      const result = backtrack(
        lessons,
        index + 1,
        newState,
        availableSlots,
        config,
        iterations,
        backtracks,
        startTime,
        violations,
      );

      if (result.success) {
        return result;
      }
    }

    backtracks++;
    
    return {
      state,
      success: false,
      iterations,
      backtracks,
      unassigned: lessons.slice(index),
      violations,
    };
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function solveWithFallback(
  lessons: ScheduledLesson[],
  hardChecker: HardConstraintChecker,
  softScorer: SoftConstraintScorer,
  timeslotRegistry: TimeslotRegistry,
  options: SolverOptions = {},
): CSPSolverResult {
  const solver = createCSPSolver(hardChecker, softScorer, timeslotRegistry);
  
  let result = solver(lessons, options);
  
  if (result.success) {
    return result;
  }

  const unassigned = result.unassigned;
  if (unassigned.length === 0) {
    return result;
  }

  for (const lesson of unassigned) {
    const availableSlots = timeslotRegistry.getAvailable();
    const sortedSlots = availableSlots.sort((a, b) => {
      const scoreA = softScorer(result.state, lesson, a.day, a.period);
      const scoreB = softScorer(result.state, lesson, b.day, b.period);
      return scoreB - scoreA;
    });

    for (const slot of sortedSlots) {
      result.state.slots.push({
        ...lesson,
        day: slot.day,
        period: slot.period,
      });
      break;
    }
  }

  return {
    ...result,
    success: result.state.slots.length === lessons.length,
    unassigned: [],
  };
}