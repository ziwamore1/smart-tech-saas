import { ExpandedLesson, TimeslotEntity, ScheduleEntry } from './index';
import { SolverState } from './solver';
import { scoreSchedule, ScoringWeights, DEFAULT_WEIGHTS } from './scoring';
import { isValid } from './solver';

export interface GeneticConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteSize: number;
  tournamentSize: number;
}

export const DEFAULT_GENETIC_CONFIG: GeneticConfig = {
  populationSize: 50,
  generations: 200,
  mutationRate: 0.1,
  crossoverRate: 0.7,
  eliteSize: 5,
  tournamentSize: 3,
};

export interface GeneticResult {
  schedule: ScheduleEntry[];
  score: number;
  generation: number;
  iterations: number;
}

export function runGeneticAlgorithm(
  lessons: ExpandedLesson[],
  timeslots: TimeslotEntity[],
  config: Partial<GeneticConfig> = {},
  weights: Partial<ScoringWeights> = {},
  onProgress?: (generation: number, bestScore: number) => void
): GeneticResult {
  const cfg = { ...DEFAULT_GENETIC_CONFIG, ...config };
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  const availableTimeslots = timeslots.filter(t => !t.isBreak);

  let population = createInitialPopulation(lessons, availableTimeslots, cfg.populationSize);

  let bestSchedule: ScheduleEntry[] = [];
  let bestScore = -Infinity;
  let iterations = 0;

  for (let gen = 0; gen < cfg.generations; gen++) {
    population = evaluatePopulation(population, w, timeslots);
    
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    
    if (sorted[0].fitness > bestScore) {
      bestScore = sorted[0].fitness;
      bestSchedule = [...sorted[0].schedule];
    }

    onProgress?.(gen, bestScore);

    if (bestScore >= 1000) {
      break;
    }

    const selected = select(population, cfg);
    const nextGen: Individual[] = [];

    for (let i = 0; i < cfg.eliteSize; i++) {
      nextGen.push(sorted[i]);
    }

    while (nextGen.length < cfg.populationSize) {
      const parentA = tournamentSelect(selected, cfg.tournamentSize);
      const parentB = tournamentSelect(selected, cfg.tournamentSize);

      let child: ScheduleEntry[];
      
      if (Math.random() < cfg.crossoverRate) {
        child = crossover(parentA.schedule, parentB.schedule);
      } else {
        child = [...parentA.schedule];
      }

      if (Math.random() < cfg.mutationRate) {
        child = mutate(child, availableTimeslots);
      }

      child = repair(child, lessons, availableTimeslots);
      iterations++;

      nextGen.push({
        schedule: child,
        fitness: 0,
      });
    }

    population = nextGen;
  }

  const finalPopulation = evaluatePopulation(population, w, timeslots);
  const finalBest = finalPopulation.sort((a, b) => b.fitness - a.fitness)[0];

  if (finalBest.fitness > bestScore) {
    bestScore = finalBest.fitness;
    bestSchedule = finalBest.schedule;
  }

  return {
    schedule: bestSchedule,
    score: bestScore,
    generation: cfg.generations,
    iterations,
  };
}

interface Individual {
  schedule: ScheduleEntry[];
  fitness: number;
}

function createInitialPopulation(
  lessons: ExpandedLesson[],
  timeslots: TimeslotEntity[],
  size: number
): Individual[] {
  const population: Individual[] = [];

  const greedy = createGreedySolution(lessons, timeslots);
  population.push({ schedule: greedy, fitness: 0 });

  for (let i = 1; i < size; i++) {
    const shuffled = [...lessons].sort(() => Math.random() - 0.5);
    const solution = createGreedySolution(shuffled, timeslots);
    population.push({ schedule: solution, fitness: 0 });
  }

  return population;
}

function createGreedySolution(
  lessons: ExpandedLesson[],
  timeslots: TimeslotEntity[]
): ScheduleEntry[] {
  const schedule: ScheduleEntry[] = [];
  const used = new Set<string>();

  for (const lesson of lessons) {
    for (const ts of timeslots) {
      const key = `${ts.id}`;
      if (!used.has(key)) {
        const entry: ScheduleEntry = {
          lessonId: lesson.instanceId,
          timeslotId: ts.id,
        };
        
        const hasConflict = schedule.some(e => {
          const eTs = timeslots.find(t => t.id === e.timeslotId);
          if (!eTs) return false;
          return eTs.day === ts.day && eTs.period === ts.period;
        });

        if (!hasConflict) {
          schedule.push(entry);
          used.add(key);
          break;
        }
      }
    }
  }

  return schedule;
}

function evaluatePopulation(
  population: Individual[],
  weights: ScoringWeights,
  timeslots: TimeslotEntity[]
): Individual[] {
  return population.map(individual => ({
    ...individual,
    fitness: scoreSchedule(individual.schedule, timeslots, weights).totalScore,
  }));
}

function select(population: Individual[], config: GeneticConfig): Individual[] {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  return sorted.slice(0, Math.floor(population.length / 2));
}

function tournamentSelect(population: Individual[], tournamentSize: number): Individual {
  const tournament: Individual[] = [];
  
  for (let i = 0; i < tournamentSize; i++) {
    tournament.push(population[Math.floor(Math.random() * population.length)]);
  }
  
  return tournament.sort((a, b) => b.fitness - a.fitness)[0];
}

function crossover(parentA: ScheduleEntry[], parentB: ScheduleEntry[]): ScheduleEntry[] {
  const child: ScheduleEntry[] = [];
  const usedLessons = new Set<string>();
  const usedSlots = new Set<string>();

  const shuffledA = [...parentA].sort(() => Math.random() - 0.5);
  const shuffledB = [...parentB].sort(() => Math.random() - 0.5);

  for (const entry of shuffledA) {
    if (!usedLessons.has(entry.lessonId) && !usedSlots.has(entry.timeslotId)) {
      child.push(entry);
      usedLessons.add(entry.lessonId);
      usedSlots.add(entry.timeslotId);
    }
  }

  for (const entry of shuffledB) {
    if (!usedLessons.has(entry.lessonId) && !usedSlots.has(entry.timeslotId)) {
      child.push(entry);
      usedLessons.add(entry.lessonId);
      usedSlots.add(entry.timeslotId);
    }
  }

  return child;
}

function mutate(schedule: ScheduleEntry[], timeslots: TimeslotEntity[]): ScheduleEntry[] {
  return schedule.map(entry => {
    if (Math.random() < 0.1) {
      const randomSlot = timeslots[Math.floor(Math.random() * timeslots.length)];
      return {
        ...entry,
        timeslotId: randomSlot.id,
      };
    }
    return entry;
  });
}

function repair(
  schedule: ScheduleEntry[],
  lessons: ExpandedLesson[],
  timeslots: TimeslotEntity[]
): ScheduleEntry[] {
  const repaired: ScheduleEntry[] = [];
  const usedSlots = new Set<string>();
  const assignedLessons = new Set<string>();

  const shuffled = [...schedule].sort(() => Math.random() - 0.5);

  for (const entry of shuffled) {
    if (!assignedLessons.has(entry.lessonId) && !usedSlots.has(entry.timeslotId)) {
      repaired.push(entry);
      usedSlots.add(entry.timeslotId);
      assignedLessons.add(entry.lessonId);
    }
  }

  for (const lesson of lessons) {
    if (!assignedLessons.has(lesson.instanceId)) {
      for (const ts of timeslots) {
        if (!usedSlots.has(ts.id)) {
          repaired.push({
            lessonId: lesson.instanceId,
            timeslotId: ts.id,
          });
          usedSlots.add(ts.id);
          assignedLessons.add(lesson.instanceId);
          break;
        }
      }
    }
  }

  return repaired;
}

export function optimizeWithGenetic(
  lessons: ExpandedLesson[],
  timeslots: TimeslotEntity[],
  initialSchedule: ScheduleEntry[],
  config: Partial<GeneticConfig> = {},
  weights: Partial<ScoringWeights> = {},
  onProgress?: (generation: number, bestScore: number) => void
): GeneticResult {
  const cfg = { ...DEFAULT_GENETIC_CONFIG, ...config };
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  const availableTimeslots = timeslots.filter(t => !t.isBreak);

  let population: Individual[] = [];

  population.push({ schedule: initialSchedule, fitness: 0 });

  for (let i = 1; i < cfg.populationSize; i++) {
    const shuffled = [...lessons].sort(() => Math.random() - 0.5);
    const solution = createGreedySolution(shuffled, availableTimeslots);
    population.push({ schedule: solution, fitness: 0 });
  }

  let bestSchedule = initialSchedule;
  let bestScore = scoreSchedule(initialSchedule, timeslots, w).totalScore;
  let iterations = 0;

  for (let gen = 0; gen < cfg.generations; gen++) {
    population = evaluatePopulation(population, w, timeslots);
    
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    
    if (sorted[0].fitness > bestScore) {
      bestScore = sorted[0].fitness;
      bestSchedule = [...sorted[0].schedule];
    }

    onProgress?.(gen, bestScore);

    if (bestScore >= 1000) {
      break;
    }

    const selected = select(population, cfg);
    const nextGen: Individual[] = [];

    for (let i = 0; i < cfg.eliteSize; i++) {
      nextGen.push({ ...sorted[i] });
    }

    while (nextGen.length < cfg.populationSize) {
      const parentA = tournamentSelect(selected, cfg.tournamentSize);
      const parentB = tournamentSelect(selected, cfg.tournamentSize);

      let child = Math.random() < cfg.crossoverRate
        ? crossover(parentA.schedule, parentB.schedule)
        : [...parentA.schedule];

      if (Math.random() < cfg.mutationRate) {
        child = mutate(child, availableTimeslots);
      }

      child = repair(child, lessons, availableTimeslots);
      iterations++;

      nextGen.push({ schedule: child, fitness: 0 });
    }

    population = nextGen;
  }

  return {
    schedule: bestSchedule,
    score: bestScore,
    generation: cfg.generations,
    iterations,
  };
}
