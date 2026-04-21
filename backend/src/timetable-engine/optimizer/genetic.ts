import { ScheduledLesson, TimetableState, cloneTimetableState } from '../constraints/types';
import { HardConstraintChecker, hasHardConstraints } from '../constraints/hardConstraints';
import { SoftConstraintScorer, calculateTotalScore } from '../constraints/softConstraints';
import { TimeslotRegistry } from '../models/Timeslot';

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

export interface Individual {
  state: TimetableState;
  fitness: number;
}

export function createGeneticOptimizer(
  hardChecker: HardConstraintChecker,
  softScorer: SoftConstraintScorer,
  timeslotRegistry: TimeslotRegistry,
  allLessons: ScheduledLesson[],
) {
  let config = defaultGeneticConfig;

  return {
    configure(newConfig: Partial<GeneticConfig>) {
      config = { ...config, ...newConfig };
      return this;
    },

    optimize(initialState: TimetableState): Individual {
      let population = this.initializePopulation(initialState);

      for (let gen = 0; gen < config.generations; gen++) {
        population = this.evolvePopulation(population);

        if (gen % 20 === 0) {
          const best = this.getBest(population);
          if (best.fitness >= 1000) {
            break;
          }
        }
      }

      return this.getBest(population);
    },

    initializePopulation(initialState: TimetableState): Individual[] {
      const population: Individual[] = [];

      population.push({
        state: cloneTimetableState(initialState),
        fitness: calculateTotalScore(softScorer, initialState),
      });

      for (let i = 1; i < config.populationSize; i++) {
        const shuffled = this.shuffleLessons([...allLessons]);
        const state: TimetableState = {
          slots: [],
          assignedLessons: new Set(),
        };

        const availableSlots = timeslotRegistry.getAvailable();

        for (const lesson of shuffled) {
          for (const slot of availableSlots) {
            if (hasHardConstraints(hardChecker, state, lesson, slot.day, slot.period)) {
              state.slots.push({ ...lesson, day: slot.day, period: slot.period });
              break;
            }
          }
        }

        population.push({
          state,
          fitness: calculateTotalScore(softScorer, state),
        });
      }

      return population;
    },

    evolvePopulation(population: Individual[]): Individual[] {
      const newPopulation: Individual[] = [];

      const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
      for (let i = 0; i < config.eliteSize; i++) {
        newPopulation.push(sorted[i]);
      }

      while (newPopulation.length < config.populationSize) {
        const parent1 = this.tournamentSelect(population);
        const parent2 = this.tournamentSelect(population);

        let child: TimetableState;
        if (Math.random() < config.crossoverRate) {
          child = this.crossover(parent1.state, parent2.state);
        } else {
          child = cloneTimetableState(parent1.state);
        }

        if (Math.random() < config.mutationRate) {
          child = this.mutate(child);
        }

        newPopulation.push({
          state: child,
          fitness: calculateTotalScore(softScorer, child),
        });
      }

      return newPopulation;
    },

    tournamentSelect(population: Individual[]): Individual {
      const tournament: Individual[] = [];
      for (let i = 0; i < config.tournamentSize; i++) {
        tournament.push(population[Math.floor(Math.random() * population.length)]);
      }
      return tournament.sort((a, b) => b.fitness - a.fitness)[0];
    },

    crossover(parent1: TimetableState, parent2: TimetableState): TimetableState {
      const childSlots: ScheduledLesson[] = [];
      const takenSlots = new Set<string>();

      const shuffled1 = [...parent1.slots].sort(() => Math.random() - 0.5);
      for (const slot of shuffled1) {
        const key = `${slot.day}-${slot.period}`;
        if (!takenSlots.has(key) && hasHardConstraints(hardChecker, { slots: childSlots, assignedLessons: new Set() }, slot, slot.day!, slot.period!)) {
          childSlots.push(slot);
          takenSlots.add(key);
        }
      }

      const shuffled2 = [...parent2.slots].sort(() => Math.random() - 0.5);
      for (const slot of shuffled2) {
        const key = `${slot.day}-${slot.period}`;
        if (!takenSlots.has(key) && hasHardConstraints(hardChecker, { slots: childSlots, assignedLessons: new Set() }, slot, slot.day!, slot.period!)) {
          childSlots.push(slot);
          takenSlots.add(key);
        }
      }

      for (const lesson of allLessons) {
        if (!childSlots.some(s => s.id === lesson.id)) {
          for (const slot of timeslotRegistry.getAvailable()) {
            const key = `${slot.day}-${slot.period}`;
            if (!takenSlots.has(key) && hasHardConstraints(hardChecker, { slots: childSlots, assignedLessons: new Set() }, lesson, slot.day, slot.period)) {
              childSlots.push({ ...lesson, day: slot.day, period: slot.period });
              takenSlots.add(key);
              break;
            }
          }
        }
      }

      return { slots: childSlots, assignedLessons: new Set(childSlots.map(s => s.id)) };
    },

    mutate(state: TimetableState): TimetableState {
      const newSlots = [...state.slots];
      if (newSlots.length < 2) return state;

      const idx1 = Math.floor(Math.random() * newSlots.length);
      let idx2 = Math.floor(Math.random() * newSlots.length);
      while (idx2 === idx1) {
        idx2 = Math.floor(Math.random() * newSlots.length);
      }

      const slot1 = newSlots[idx1];
      const slot2 = newSlots[idx2];

      const tempDay = slot1.day;
      const tempPeriod = slot1.period;
      newSlots[idx1] = { ...slot1, day: slot2.day, period: slot2.period };
      newSlots[idx2] = { ...slot2, day: tempDay!, period: tempPeriod! };

      return { slots: newSlots, assignedLessons: new Set(newSlots.map(s => s.id)) };
    },

    shuffleLessons(lessons: ScheduledLesson[]): ScheduledLesson[] {
      for (let i = lessons.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lessons[i], lessons[j]] = [lessons[j], lessons[i]];
      }
      return lessons;
    },

    getBest(population: Individual[]): Individual {
      return population.sort((a, b) => b.fitness - a.fitness)[0];
    },
  };
}