import { TimetableCache, SlotIndex } from '../entities/cache';
import { 
  createFastSolver, 
  Lesson, 
  Assignment, 
  FastSolverResult,
  FastSolverOptions 
} from './fastCSPSolver';

export type Gene = {
  lessonId: string;
  slot: SlotIndex;
};

export type Chromosome = Gene[];

export interface HybridConfig {
  cspMaxIterations: number;
  cspMaxTime: number;
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteSize: number;
  tournamentSize: number;
  targetScore: number;
  enableForwardCheck: boolean;
  enableValidSlotCache: boolean;
}

export const DEFAULT_HYBRID_CONFIG: HybridConfig = {
  cspMaxIterations: 10000,
  cspMaxTime: 30000,
  populationSize: 20,
  generations: 50,
  mutationRate: 0.15,
  crossoverRate: 0.7,
  eliteSize: 2,
  tournamentSize: 3,
  targetScore: 950,
  enableForwardCheck: true,
  enableValidSlotCache: true,
};

export interface HybridResult {
  schedule: Assignment[] | null;
  success: boolean;
  score: number;
  method: 'csp' | 'hybrid';
  cspIterations: number;
  cspBacktracks: number;
  geneticIterations: number;
  timeElapsed: number;
}

export function generateTimetableHybrid(
  lessons: Lesson[],
  slots: SlotIndex[],
  config: Partial<HybridConfig> = {},
  weights?: PenaltyWeights
): HybridResult {
  const cfg = { ...DEFAULT_HYBRID_CONFIG, ...config };
  const startTime = Date.now();

  const cache = new TimetableCache({ totalSlots: slots.length });

  lessons.forEach(lesson => {
    cache.initTeacher(lesson.teacherId);
    cache.initClass(lesson.classId);
    if (lesson.roomId) {
      cache.initRoom(lesson.roomId);
    }
  });

  const cspOptions: FastSolverOptions = {
    maxIterations: cfg.cspMaxIterations,
    maxTime: cfg.cspMaxTime,
    enableForwardCheck: cfg.enableForwardCheck,
    enableValidSlotCache: cfg.enableValidSlotCache,
    heuristic: 'mrv',
  };

  const fastSolve = createFastSolver(slots.length);
  const cspResult = fastSolve(lessons, slots, cspOptions);

  if (!cspResult.assignments) {
    return {
      schedule: null,
      success: false,
      score: 0,
      method: 'csp',
      cspIterations: cspResult.iterations,
      cspBacktracks: cspResult.backtracks,
      geneticIterations: 0,
      timeElapsed: Date.now() - startTime,
    };
  }

  if (!weights) {
    return {
      schedule: cspResult.assignments,
      success: true,
      score: 1000,
      method: 'csp',
      cspIterations: cspResult.iterations,
      cspBacktracks: cspResult.backtracks,
      geneticIterations: 0,
      timeElapsed: Date.now() - startTime,
    };
  }

  const population = generateInitialPopulation(
    cspResult.assignments,
    cfg.populationSize,
    lessons,
    slots,
    cache
  );

  const lessonMap = new Map(lessons.map(l => [l.id, l]));

  const bestChromosome = geneticOptimize(
    population,
    cache,
    cfg,
    lessonMap,
    slots,
    weights,
    (gen, score) => {
      if (score >= cfg.targetScore) {
        return true;
      }
      return false;
    }
  );

  const finalScore = calculateFitness(bestChromosome, cache, lessonMap, slots, weights);

  return {
    schedule: bestChromosome,
    success: true,
    score: finalScore,
    method: 'hybrid',
    cspIterations: cspResult.iterations,
    cspBacktracks: cspResult.backtracks,
    geneticIterations: cfg.generations,
    timeElapsed: Date.now() - startTime,
  };
}

export interface PenaltyWeights {
  teacherGaps: number;
  subjectSpread: number;
  lateLesson: number;
  consecutiveLessons: number;
  roomStability: number;
}

const DEFAULT_PENALTY_WEIGHTS: PenaltyWeights = {
  teacherGaps: 30,
  subjectSpread: 20,
  lateLesson: 10,
  consecutiveLessons: 15,
  roomStability: 5,
};

function generateInitialPopulation(
  base: Chromosome,
  size: number,
  lessons: Lesson[],
  slots: SlotIndex[],
  cache: TimetableCache
): Chromosome[] {
  const population: Chromosome[] = [base];

  for (let i = 1; i < size; i++) {
    population.push(mutateSlightly(base, lessons, slots, cache));
  }

  return population;
}

function mutateSlightly(
  base: Chromosome,
  lessons: Lesson[],
  slots: SlotIndex[],
  cache: TimetableCache
): Chromosome {
  const newChromosome: Chromosome = base.map(gene => ({ ...gene }));
  const numMutations = Math.max(1, Math.floor(newChromosome.length * 0.1));

  for (let i = 0; i < numMutations; i++) {
    const index = Math.floor(Math.random() * newChromosome.length);
    const gene = newChromosome[index];

    const newSlot = slots[Math.floor(Math.random() * slots.length)];
    const lesson = lessons.find(l => l.id === gene.lessonId);

    if (lesson && cache.isSlotFree(lesson.teacherId, lesson.classId, newSlot, lesson.roomId)) {
      gene.slot = newSlot;
    }
  }

  return repair(newChromosome, lessons, slots, cache);
}

function geneticOptimize(
  population: Chromosome[],
  cache: TimetableCache,
  cfg: HybridConfig,
  lessonMap: Map<string, Lesson>,
  slots: SlotIndex[],
  weights: PenaltyWeights,
  onGeneration?: (generation: number, score: number) => boolean
): Chromosome {
  let best = population[0];
  let bestScore = calculateFitness(best, cache, lessonMap, slots, weights);

  for (let g = 0; g < cfg.generations; g++) {
    const evaluated = evaluatePopulation(population, cache, lessonMap, slots, weights);
    
    const sorted = [...evaluated].sort((a, b) => b.fitness - a.fitness);
    
    if (sorted[0].fitness > bestScore) {
      bestScore = sorted[0].fitness;
      best = sorted[0].chromosome;
    }

    if (onGeneration?.(g, bestScore)) {
      break;
    }

    const newPopulation: Chromosome[] = [];

    for (let i = 0; i < cfg.eliteSize; i++) {
      newPopulation.push(sorted[i].chromosome);
    }

    while (newPopulation.length < cfg.populationSize) {
      const parentA = tournamentSelect(population, cfg.tournamentSize, cache, lessonMap, slots, weights);
      const parentB = tournamentSelect(population, cfg.tournamentSize, cache, lessonMap, slots, weights);

      let child: Chromosome;

      if (Math.random() < cfg.crossoverRate) {
        child = crossover(parentA, parentB);
      } else {
        child = [...parentA];
      }

      if (Math.random() < cfg.mutationRate) {
        child = mutate(child, lessonMap, slots, cache);
      }

      child = repair(child, Array.from(lessonMap.values()), slots, cache);

      newPopulation.push(child);
    }

    population = newPopulation;
  }

  return best;
}

interface EvaluatedIndividual {
  chromosome: Chromosome;
  fitness: number;
}

function evaluatePopulation(
  population: Chromosome[],
  cache: TimetableCache,
  lessonMap: Map<string, Lesson>,
  slots: SlotIndex[],
  weights: PenaltyWeights
): EvaluatedIndividual[] {
  return population.map(chromosome => ({
    chromosome,
    fitness: calculateFitness(chromosome, cache, lessonMap, slots, weights),
  }));
}

function calculateFitness(
  chromosome: Chromosome,
  cache: TimetableCache,
  lessonMap: Map<string, Lesson>,
  slots: SlotIndex[],
  weights: PenaltyWeights
): number {
  const hash = hashChromosome(chromosome);
  const cached = cache.getScore(hash);
  if (cached !== undefined) return cached;

  let score = 1000;

  score -= teacherGapsPenalty(chromosome, lessonMap, slots) * weights.teacherGaps;
  score -= subjectSpreadPenalty(chromosome, lessonMap, slots) * weights.subjectSpread;
  score -= lateLessonPenalty(chromosome, lessonMap, slots) * weights.lateLesson;
  score -= consecutiveLessonsPenalty(chromosome, lessonMap, slots) * weights.consecutiveLessons;

  cache.setScore(hash, score);
  return score;
}

function hashChromosome(chromosome: Chromosome): string {
  return chromosome.map(g => `${g.lessonId}:${g.slot}`).join('|');
}

function teacherGapsPenalty(chromosome: Chromosome, lessonMap: Map<string, Lesson>, slots: SlotIndex[]): number {
  const teacherDays = new Map<string, Set<number>>();

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    const day = Math.floor(gene.slot / 8);
    
    if (!teacherDays.has(lesson.teacherId)) {
      teacherDays.set(lesson.teacherId, new Set());
    }
    teacherDays.get(lesson.teacherId)!.add(day);
  }

  let penalty = 0;
  for (const days of teacherDays.values()) {
    const sortedDays = [...days].sort((a, b) => a - b);
    for (let i = 1; i < sortedDays.length; i++) {
      if (sortedDays[i] - sortedDays[i - 1] > 1) {
        penalty += 1;
      }
    }
  }

  return penalty;
}

function subjectSpreadPenalty(chromosome: Chromosome, lessonMap: Map<string, Lesson>, slots: SlotIndex[]): number {
  const subjectDays = new Map<string, Set<number>>();

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    const day = Math.floor(gene.slot / 8);
    
    if (!subjectDays.has(lesson.classId)) {
      subjectDays.set(lesson.classId, new Set());
    }
    subjectDays.get(lesson.classId)!.add(day);
  }

  return Math.max(0, 5 - subjectDays.size) * 2;
}

function lateLessonPenalty(chromosome: Chromosome, lessonMap: Map<string, Lesson>, slots: SlotIndex[]): number {
  let penalty = 0;

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    const period = gene.slot % 8;
    if (period >= 6) {
      penalty += 1;
    }
  }

  return penalty;
}

function consecutiveLessonsPenalty(chromosome: Chromosome, lessonMap: Map<string, Lesson>, slots: SlotIndex[]): number {
  return 0;
}

function crossover(parentA: Chromosome, Chromosome: Chromosome): Chromosome {
  const split = Math.floor(parentA.length / 2);

  return [
    ...parentA.slice(0, split),
    ...Chromosome.slice(split)
  ];
}

function mutate(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slots: SlotIndex[],
  cache: TimetableCache
): Chromosome {
  const newChromosome = chromosome.map(gene => ({ ...gene }));

  const index = Math.floor(Math.random() * newChromosome.length);
  const gene = newChromosome[index];
  const lesson = lessonMap.get(gene.lessonId);

  if (!lesson) return newChromosome;

  const newSlot = slots[Math.floor(Math.random() * slots.length)];

  if (cache.isSlotFree(lesson.teacherId, lesson.classId, newSlot, lesson.roomId)) {
    gene.slot = newSlot;
  }

  return newChromosome;
}

function repair(
  chromosome: Chromosome,
  lessons: Lesson[],
  slots: SlotIndex[],
  cache: TimetableCache
): Chromosome {
  cache.reset();

  const lessonMap = new Map(lessons.map(l => [l.id, l]));
  const fixed: Chromosome = [];

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    if (cache.isSlotFree(lesson.teacherId, lesson.classId, gene.slot, lesson.roomId)) {
      cache.assignLesson(lesson.teacherId, lesson.classId, gene.slot, lesson.roomId);
      fixed.push(gene);
    } else {
      const slot = findValidSlot(lesson, slots, cache);
      if (slot !== null) {
        cache.assignLesson(lesson.teacherId, lesson.classId, slot, lesson.roomId);
        fixed.push({ ...gene, slot });
      }
    }
  }

  for (const lesson of lessons) {
    if (!fixed.some(g => g.lessonId === lesson.id)) {
      const slot = findValidSlot(lesson, slots, cache);
      if (slot !== null) {
        cache.assignLesson(lesson.teacherId, lesson.classId, slot, lesson.roomId);
        fixed.push({ lessonId: lesson.id, slot });
      }
    }
  }

  return fixed;
}

function findValidSlot(
  lesson: Lesson,
  slots: SlotIndex[],
  cache: TimetableCache
): SlotIndex | null {
  for (const slot of slots) {
    if (cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)) {
      return slot;
    }
  }
  return null;
}

function tournamentSelect(
  population: Chromosome[],
  tournamentSize: number,
  cache: TimetableCache,
  lessonMap: Map<string, Lesson>,
  slots: SlotIndex[],
  weights: PenaltyWeights
): Chromosome {
  const tournament: Chromosome[] = [];
  
  for (let i = 0; i < tournamentSize; i++) {
    tournament.push(population[Math.floor(Math.random() * population.length)]);
  }
  
  return tournament.sort((a, b) => 
    calculateFitness(b, cache, lessonMap, slots, weights) - 
    calculateFitness(a, cache, lessonMap, slots, weights)
  )[0];
}

export async function runParallelHybrid(
  lessons: Lesson[],
  slots: SlotIndex[],
  config: Partial<HybridConfig> = {},
  weights?: PenaltyWeights,
  workerCount: number = 3
): Promise<HybridResult> {
  const promises: Promise<HybridResult>[] = [];

  for (let i = 0; i < workerCount; i++) {
    promises.push(Promise.resolve(generateTimetableHybrid(lessons, slots, config, weights)));
  }

  const results = await Promise.all(promises);
  
  return results.reduce((best, current) => 
    current.score > best.score ? current : best
  );
}
