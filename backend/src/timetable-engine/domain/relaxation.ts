import { 
  Lesson, 
  Timeslot, 
  TimetableSchedule, 
  ScheduledLesson,
  TimetableConfig 
} from './lesson';
import { 
  ConstraintContext, 
  hasHardConstraints,
  scoreSchedule,
  ConstraintViolation
} from './constraints';
import { solve, SolveResult, SolveOptions } from './solver';
import { createGeneticOptimizer, Individual, defaultGeneticConfig } from './optimizer';

export interface RelaxationConfig {
  maxRetries: number;
  relaxationStep: number;
  enableGeneticOnRelax: boolean;
}

export const defaultRelaxationConfig: RelaxationConfig = {
  maxRetries: 3,
  relaxationStep: 0.1,
  enableGeneticOnRelax: true,
};

export interface RelaxationResult {
  schedule: TimetableSchedule;
  success: boolean;
  score: number;
  relaxationLevel: number;
  attempts: number;
}

export function relaxSoftConstraints(
  violations: ConstraintViolation[]
): void {
  for (const v of violations) {
    if (v.type === 'soft') {
      v.penalty = Math.floor(v.penalty * 0.5);
    }
  }
}

export function createRelaxationSolver(
  lessons: Lesson[],
  timeslots: Timeslot[],
  context: ConstraintContext,
  baseConfig: Partial<SolveOptions> = {},
  relaxationConfig: Partial<RelaxationConfig> = {}
) {
  const config = { ...defaultRelaxationConfig, ...relaxationConfig };
  
  return {
    solveWithRelaxation(
      onProgress?: (attempt: number, level: number, message: string) => void
    ): RelaxationResult {
      for (let attempt = 0; attempt < config.maxRetries; attempt++) {
        onProgress?.(attempt, attempt * config.relaxationStep, `Attempt ${attempt + 1}/${config.maxRetries}`);

        const result = solve(lessons, timeslots, context, {
          ...baseConfig,
          shuffleLessons: true,
          heuristic: attempt === 0 ? 'mrv' : 'static',
        });

        if (result.success) {
          return {
            schedule: result.schedule!,
            success: true,
            score: scoreSchedule(result.schedule!, context),
            relaxationLevel: attempt * config.relaxationStep,
            attempts: attempt + 1,
          };
        }

        relaxSoftConstraints(result.violations);
      }

      if (config.enableGeneticOnRelax) {
        onProgress?.(config.maxRetries, 0, 'Running genetic algorithm...');

        const genetic = createGeneticOptimizer(lessons, timeslots, context, {
          populationSize: 50,
          generations: 100,
        });

        const best = genetic.optimize((gen, fitness) => {
          if (gen % 10 === 0) {
            onProgress?.(config.maxRetries, gen / 100, `Generation ${gen}`);
          }
        });

        if (best.fitness > 0) {
          return {
            schedule: best.schedule,
            success: true,
            score: best.fitness,
            relaxationLevel: 1,
            attempts: config.maxRetries + 1,
          };
        }
      }

      return {
        schedule: new TimetableSchedule(),
        success: false,
        score: 0,
        relaxationLevel: config.maxRetries * config.relaxationStep,
        attempts: config.maxRetries,
      };
    },
  };
}

export interface FallbackResult {
  schedule: TimetableSchedule;
  method: string;
  success: boolean;
  score: number;
}

export function solveWithFallback(
  lessons: Lesson[],
  timeslots: Timeslot[],
  context: ConstraintContext,
  onProgress?: (method: string, progress: number) => void
): FallbackResult {
  onProgress?.('CSP', 0);

  const cspResult = solve(lessons, timeslots, context, {
    shuffleLessons: true,
    heuristic: 'mrv',
    enablePropagation: true,
  });

  if (cspResult.success) {
    onProgress?.('CSP', 100);
    return {
      schedule: cspResult.schedule!,
      method: 'CSP',
      success: true,
      score: scoreSchedule(cspResult.schedule!, context),
    };
  }

  onProgress?.('Genetic', 0);

  const genetic = createGeneticOptimizer(lessons, timeslots, context, {
    populationSize: 50,
    generations: 100,
  });

  const geneticResult = genetic.optimize((gen) => {
    onProgress?.('Genetic', (gen / 100) * 100);
  });

  if (geneticResult.fitness > 0) {
    return {
      schedule: geneticResult.schedule,
      method: 'Genetic',
      success: true,
      score: geneticResult.fitness,
    };
  }

  onProgress?.('Greedy', 0);

  const greedyResult = solveGreedy(lessons, timeslots, context);
  onProgress?.('Greedy', 100);

  return {
    schedule: greedyResult.schedule,
    method: 'Greedy',
    success: greedyResult.success,
    score: greedyResult.score,
  };
}

function solveGreedy(
  lessons: Lesson[],
  timeslots: Timeslot[],
  context: ConstraintContext
): FallbackResult {
  const schedule = new TimetableSchedule();
  const used = new Set<string>();

  const shuffled = [...lessons].sort(() => Math.random() - 0.5);

  for (const lesson of shuffled) {
    for (const ts of timeslots) {
      if (!used.has(ts.toKey()) && hasHardConstraints(schedule, lesson, ts, context)) {
        schedule.add(new ScheduledLesson(lesson, ts));
        used.add(ts.toKey());
        break;
      }
    }
  }

  const success = schedule.slots.length === lessons.length;
  const score = scoreSchedule(schedule, context);

  return { schedule, method: 'Greedy', success, score };
}