import { 
  Lesson, 
  Timeslot, 
  TimetableSchedule, 
  ScheduledLesson,
  TimetableConfig 
} from './lesson';
import { 
  ConstraintContext, 
  scoreSchedule,
  hasHardConstraints,
  ConstraintViolation 
} from './constraints';

export interface Individual {
  schedule: TimetableSchedule;
  fitness: number;
}

export interface GeneticConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteSize: number;
  tournamentSize: number;
}

export const defaultGeneticConfig: GeneticConfig = {
  populationSize: 100,
  generations: 200,
  mutationRate: 0.15,
  crossoverRate: 0.7,
  eliteSize: 5,
  tournamentSize: 3,
};

export function createGeneticOptimizer(
  lessons: Lesson[],
  timeslots: Timeslot[],
  context: ConstraintContext,
  config: Partial<GeneticConfig> = {}
) {
  const cfg = { ...defaultGeneticConfig, ...config };

  return {
    optimize(onProgress?: (gen: number, best: number) => void): Individual {
      let population = this.initialize();

      for (let gen = 0; gen < cfg.generations; gen++) {
        population = this.evolve(population);

        const best = this.getBest(population);
        onProgress?.(gen, best.fitness);

        if (best.fitness >= 1000) {
          break;
        }
      }

      return this.getBest(population);
    },

    initialize(): Individual[] {
      const population: Individual[] = [];

      const initial = buildInitialSchedule(lessons, timeslots, context);
      population.push({
        schedule: initial,
        fitness: scoreSchedule(initial, context),
      });

      for (let i = 1; i < cfg.populationSize; i++) {
        const shuffled = shuffleLessons([...lessons]);
        const schedule = buildGreedySchedule(shuffled, timeslots, context);
        population.push({
          schedule,
          fitness: scoreSchedule(schedule, context),
        });
      }

      return population;
    },

    evolve(population: Individual[]): Individual[] {
      const newPop: Individual[] = [];
      const sorted = [...population].sort((a, b) => b.fitness - a.fitness);

      for (let i = 0; i < cfg.eliteSize; i++) {
        newPop.push(sorted[i]);
      }

      while (newPop.length < cfg.populationSize) {
        const p1 = this.tournamentSelect(population);
        const p2 = this.tournamentSelect(population);

        let child: TimetableSchedule;
        if (Math.random() < cfg.crossoverRate) {
          child = this.crossover(p1.schedule, p2.schedule);
        } else {
          child = p1.schedule.clone();
        }

        if (Math.random() < cfg.mutationRate) {
          child = this.mutate(child);
        }

        newPop.push({
          schedule: child,
          fitness: scoreSchedule(child, context),
        });
      }

      return newPop;
    },

    tournamentSelect(population: Individual[]): Individual {
      const tournament: Individual[] = [];
      for (let i = 0; i < cfg.tournamentSize; i++) {
        tournament.push(population[Math.floor(Math.random() * population.length)]);
      }
      return tournament.sort((a, b) => b.fitness - a.fitness)[0];
    },

    crossover(parent1: TimetableSchedule, parent2: TimetableSchedule): TimetableSchedule {
      const child = new TimetableSchedule();
      const used = new Set<string>();

      const slots1 = [...parent1.slots].sort(() => Math.random() - 0.5);
      for (const slot of slots1) {
        const key = slot.timeslot.toKey();
        if (!used.has(key)) {
          child.add(new ScheduledLesson(slot.lesson, slot.timeslot, slot.roomId));
          used.add(key);
        }
      }

      const slots2 = [...parent2.slots].sort(() => Math.random() - 0.5);
      for (const slot of slots2) {
        const key = slot.timeslot.toKey();
        if (!used.has(key)) {
          if (!child.hasTeacherConflict(slot.lesson.teacherId, slot.timeslot) &&
              !child.hasClassConflict(slot.lesson.classId, slot.timeslot)) {
            child.add(new ScheduledLesson(slot.lesson, slot.timeslot, slot.roomId));
            used.add(key);
          }
        }
      }

      for (const lesson of lessons) {
        if (!child.findByLesson(lesson.id)) {
          for (const ts of timeslots) {
            if (!used.has(ts.toKey()) && hasHardConstraints(child, lesson, ts, context)) {
              child.add(new ScheduledLesson(lesson, ts));
              used.add(ts.toKey());
              break;
            }
          }
        }
      }

      return child;
    },

    mutate(schedule: TimetableSchedule): TimetableSchedule {
      if (schedule.slots.length < 2) return schedule;

      const idx1 = Math.floor(Math.random() * schedule.slots.length);
      let idx2 = Math.floor(Math.random() * schedule.slots.length);
      while (idx2 === idx1) {
        idx2 = Math.floor(Math.random() * schedule.slots.length);
      }

      const newSchedule = new TimetableSchedule();
      const slots = [...schedule.slots];

      const tempDay = slots[idx1].timeslot.day;
      const tempPeriod = slots[idx1].timeslot.period;

      slots[idx1] = new ScheduledLesson(
        slots[idx1].lesson,
        new Timeslot(slots[idx2].timeslot.day, slots[idx2].timeslot.period),
        slots[idx1].roomId
      );
      slots[idx2] = new ScheduledLesson(
        slots[idx2].lesson,
        new Timeslot(tempDay, tempPeriod),
        slots[idx2].roomId
      );

      for (const slot of slots) {
        newSchedule.add(new ScheduledLesson(slot.lesson, slot.timeslot, slot.roomId));
      }

      return newSchedule;
    },

    getBest(population: Individual[]): Individual {
      return population.sort((a, b) => b.fitness - a.fitness)[0];
    },
  };

  function shuffleLessons(arr: Lesson[]): Lesson[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export interface AnnealingConfig {
  initialTemp: number;
  finalTemp: number;
  coolingRate: number;
  iterationsPerTemp: number;
}

export const defaultAnnealingConfig: AnnealingConfig = {
  initialTemp: 1000,
  finalTemp: 1,
  coolingRate: 0.995,
  iterationsPerTemp: 10,
};

export function createAnnealingOptimizer(
  timeslots: Timeslot[],
  context: ConstraintContext,
  config: Partial<AnnealingConfig> = {}
) {
  const cfg = { ...defaultAnnealingConfig, ...config };

  return {
    optimize(initialSchedule: TimetableSchedule): TimetableSchedule {
      let current = initialSchedule.clone();
      let currentScore = scoreSchedule(current, context);

      let best = current.clone();
      let bestScore = currentScore;

      let temp = cfg.initialTemp;

      while (temp > cfg.finalTemp) {
        for (let i = 0; i < cfg.iterationsPerTemp; i++) {
          const neighbor = this.getNeighbor(current, timeslots);
          const neighborScore = scoreSchedule(neighbor, context);

          const delta = neighborScore - currentScore;
          const probability = Math.exp(delta / temp);

          if (delta > 0 || Math.random() < probability) {
            current = neighbor;
            currentScore = neighborScore;

            if (currentScore > bestScore) {
              best = current.clone();
              bestScore = currentScore;
            }
          }
        }

        temp *= cfg.coolingRate;
      }

      return best;
    },

    getNeighbor(schedule: TimetableSchedule, timeslots: Timeslot[]): TimetableSchedule {
      if (schedule.slots.length < 2) return schedule;

      const slots = [...schedule.slots];
      const idx = Math.floor(Math.random() * slots.length);
      const lesson = slots[idx].lesson;

      const availableTimeslots = timeslots.filter(ts => 
        !schedule.findByTimeslot(ts) && hasHardConstraints(schedule, lesson, ts, context)
      );

      if (availableTimeslots.length === 0) return schedule;

      const newTs = availableTimeslots[Math.floor(Math.random() * availableTimeslots.length)];
      slots[idx] = new ScheduledLesson(lesson, newTs);

      const newSchedule = new TimetableSchedule();
      for (const slot of slots) {
        newSchedule.add(new ScheduledLesson(slot.lesson, slot.timeslot, slot.roomId));
      }

      return newSchedule;
    },
  };
}

function buildInitialSchedule(
  lessons: Lesson[],
  timeslots: Timeslot[],
  context: ConstraintContext
): TimetableSchedule {
  const schedule = new TimetableSchedule();
  const used = new Set<string>();

  for (const lesson of lessons) {
    for (const ts of timeslots) {
      if (!used.has(ts.toKey()) && hasHardConstraints(schedule, lesson, ts, context)) {
        schedule.add(new ScheduledLesson(lesson, ts));
        used.add(ts.toKey());
        break;
      }
    }
  }

  return schedule;
}

function buildGreedySchedule(
  lessons: Lesson[],
  timeslots: Timeslot[],
  context: ConstraintContext
): TimetableSchedule {
  const schedule = new TimetableSchedule();
  const used = new Set<string>();

  for (const lesson of lessons) {
    const validTimeslots = timeslots
      .filter(ts => !used.has(ts.toKey()) && hasHardConstraints(schedule, lesson, ts, context))
      .sort((a, b) => {
        const teacher = context.teachers.get(lesson.teacherId);
        const prefA = teacher?.preferredDays.includes(a.day) ? 1 : 0;
        const prefB = teacher?.preferredDays.includes(b.day) ? 1 : 0;
        return prefB - prefA || a.period - b.period;
      });

    if (validTimeslots.length > 0) {
      schedule.add(new ScheduledLesson(lesson, validTimeslots[0]));
      used.add(validTimeslots[0].toKey());
    }
  }

  return schedule;
}