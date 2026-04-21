import { 
  Lesson, 
  Timeslot, 
  TimetableSchedule, 
  ScheduledLesson,
  TimetableConfig,
  Teacher,
  Class,
  Subject,
  Room
} from './lesson';
import { 
  ConstraintContext, 
  createConstraintContext,
  scoreSchedule,
  hasHardConstraints,
  ConstraintViolation,
  isValidPlacement
} from './constraints';
import { solve, SolveResult, SolveOptions } from './solver';
import { 
  createGeneticOptimizer, 
  defaultGeneticConfig,
  createAnnealingOptimizer,
  defaultAnnealingConfig,
  Individual
} from './optimizer';
import { createRelaxationSolver, RelaxationResult, solveWithFallback, FallbackResult } from './relaxation';

export interface MasterEngineConfig {
  solver: Partial<SolveOptions>;
  genetic: Partial<typeof defaultGeneticConfig>;
  annealing: Partial<typeof defaultAnnealingConfig>;
  useOptimization: boolean;
  useRelaxation: boolean;
}

export const defaultMasterEngineConfig: MasterEngineConfig = {
  solver: {
    maxIterations: 5000,
    maxTime: 60000,
    enablePropagation: true,
    heuristic: 'mrv',
  },
  genetic: defaultGeneticConfig,
  annealing: defaultAnnealingConfig,
  useOptimization: true,
  useRelaxation: true,
};

export interface GenerateResult {
  schedule: TimetableSchedule;
  success: boolean;
  score: number;
  method: string;
  iterations: number;
  attempts: number;
  unassigned: Lesson[];
  violations: ConstraintViolation[];
}

export class TimetableMasterEngine {
  constructor(
    teachers: Teacher[],
    classes: Class[],
    rooms: Room[],
    config: Partial<MasterEngineConfig> = {}
  ) {
    this.config = { ...defaultMasterEngineConfig, ...config };
    this.context = createConstraintContext(teachers, classes, rooms, new TimetableConfig());
  }

  private config: MasterEngineConfig;
  private context: ConstraintContext;

  generate(
    lessons: Lesson[],
    timeslots: Timeslot[],
    onProgress?: (phase: string, progress: number, message: string) => void
  ): GenerateResult {
    const result = this.runSolverWithFallback(lessons, timeslots, onProgress);
    return result;
  }

  private runSolverWithFallback(
    lessons: Lesson[],
    timeslots: Timeslot[],
    onProgress?: (phase: string, progress: number, message: string) => void
  ): GenerateResult {
    onProgress?.('CSP', 10, 'Running CSP solver...');

    const cspResult = solve(lessons, timeslots, this.context, {
      ...this.config.solver,
      shuffleLessons: true,
      heuristic: 'mrv',
      enablePropagation: this.config.solver.enablePropagation ?? true,
    });

    if (cspResult.success) {
      let finalSchedule = cspResult.schedule!;
      let finalScore = cspResult.schedule ? scoreSchedule(cspResult.schedule, this.context) : 0;

      if (this.config.useOptimization) {
        onProgress?.('Optimization', 50, 'Running optimization...');

        const optResult = this.runOptimization(cspResult.schedule!, lessons, timeslots);
        if (optResult.score > finalScore) {
          finalSchedule = optResult.schedule;
          finalScore = optResult.score;
        }
      }

      onProgress?.('Complete', 100, 'Done');

      return {
        schedule: finalSchedule,
        success: true,
        score: finalScore,
        method: 'CSP',
        iterations: cspResult.iterations,
        attempts: 1,
        unassigned: [],
        violations: cspResult.violations,
      };
    }

    if (this.config.useRelaxation) {
      onProgress?.('Relaxation', 30, 'Relaxing constraints...');

      const relaxResult = this.runWithRelaxation(lessons, timeslots, onProgress);
      if (relaxResult.success) {
        return relaxResult;
      }
    }

    onProgress?.('Fallback', 60, 'Trying genetic algorithm...');

    const fallbackResult = solveWithFallback(lessons, timeslots, this.context, (method, progress) => {
      onProgress?.(method, 60 + progress * 0.3, `Trying ${method}...`);
    });

    return {
      schedule: fallbackResult.schedule,
      success: fallbackResult.success,
      score: fallbackResult.score,
      method: fallbackResult.method,
      iterations: 0,
      attempts: lessons.length,
      unassigned: lessons.filter(l => !fallbackResult.schedule.findByLesson(l.id)),
      violations: [],
    };
  }

  private runOptimization(
    initialSchedule: TimetableSchedule,
    lessons: Lesson[],
    timeslots: Timeslot[]
  ): TimetableSchedule {
    const genetic = createGeneticOptimizer(lessons, timeslots, this.context, this.config.genetic);
    
    const result = genetic.optimize((gen) => {
    });

    return result.schedule;
  }

  private runWithRelaxation(
    lessons: Lesson[],
    timeslots: Timeslot[],
    onProgress?: (phase: string, progress: number, message: string) => void
  ): GenerateResult {
    const relaxation = createRelaxationSolver(
      lessons,
      timeslots,
      this.context,
      this.config.solver,
      { maxRetries: 3, enableGeneticOnRelax: true }
    );

    const result = relaxation.solveWithRelaxation((attempt, level, message) => {
      onProgress?.('Relaxation', 30 + attempt * 10, message);
    });

    return {
      schedule: result.schedule,
      success: result.success,
      score: result.score,
      method: 'Relaxation',
      iterations: 0,
      attempts: result.attempts,
      unassigned: lessons.filter(l => !result.schedule.findByLesson(l.id)),
      violations: [],
    };
  }

  validate(schedule: TimetableSchedule): {
    valid: boolean;
    violations: ConstraintViolation[];
    score: number;
  } {
    const violations: ConstraintViolation[] = [];

    for (const slot of schedule.slots) {
      if (!slot.timeslot) continue;

      const result = isValidPlacement(
        schedule,
        slot.lesson,
        slot.timeslot,
        this.context
      );
      violations.push(...result.violations);
    }

    const hardViolations = violations.filter(v => v.type === 'hard');

    return {
      valid: hardViolations.length === 0,
      violations,
      score: scoreSchedule(schedule, this.context),
    };
  }

  getConflicts(schedule: TimetableSchedule): {
    day: number;
    period: number;
    conflict: string;
    lessons: string[];
  }[] {
    const conflictMap = new Map<string, { day: number; period: number; lessons: string[] }>();

    for (const slot of schedule.slots) {
      const key = slot.timeslot.toKey();
      
      if (!conflictMap.has(key)) {
        conflictMap.set(key, {
          day: slot.timeslot.day,
          period: slot.timeslot.period,
          lessons: [],
        });
      }
      
      conflictMap.get(key)!.lessons.push(slot.lesson.id);
    }

    const conflicts: { day: number; period: number; conflict: string; lessons: string[] }[] = [];

    for (const [, data] of conflictMap) {
      if (data.lessons.length > 1) {
        conflicts.push({
          day: data.day,
          period: data.period,
          conflict: `${data.lessons.length} lessons`,
          lessons: data.lessons,
        });
      }
    }

    return conflicts;
  }

  exportSchedule(
    schedule: TimetableSchedule,
    format: 'array' | 'map' = 'array'
  ): any {
    if (format === 'array') {
      return schedule.slots.map(slot => ({
        lessonId: slot.lesson.id,
        classId: slot.lesson.classId,
        subjectId: slot.lesson.subjectId,
        teacherId: slot.lesson.teacherId,
        day: slot.timeslot.day,
        period: slot.timeslot.period,
        roomId: slot.roomId,
      }));
    }

    const byClass = new Map<string, any[]>();
    const byTeacher = new Map<string, any[]>();
    const byDay = new Map<number, any[]>();

    for (const slot of schedule.slots) {
      const entry = {
        lessonId: slot.lesson.id,
        classId: slot.lesson.classId,
        subjectId: slot.lesson.subjectId,
        teacherId: slot.lesson.teacherId,
        period: slot.timeslot.period,
        roomId: slot.roomId,
      };

      if (!byClass.has(slot.lesson.classId)) {
        byClass.set(slot.lesson.classId, []);
      }
      byClass.get(slot.lesson.classId)!.push(entry);

      if (!byTeacher.has(slot.lesson.teacherId)) {
        byTeacher.set(slot.lesson.teacherId, []);
      }
      byTeacher.get(slot.lesson.teacherId)!.push(entry);

      if (!byDay.has(slot.timeslot.day)) {
        byDay.set(slot.timeslot.day, []);
      }
      byDay.get(slot.timeslot.day)!.push(entry);
    }

    return { byClass, byTeacher, byDay };
  }
}