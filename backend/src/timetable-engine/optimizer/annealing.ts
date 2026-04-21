import { ScheduledLesson, TimetableState, cloneTimetableState } from '../constraints/types';
import { HardConstraintChecker, hasHardConstraints } from '../constraints/hardConstraints';
import { SoftConstraintScorer, calculateTotalScore } from '../constraints/softConstraints';
import { TimeslotRegistry } from '../models/Timeslot';

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

export function createSimulatedAnnealingOptimizer(
  hardChecker: HardConstraintChecker,
  softScorer: SoftConstraintScorer,
  timeslotRegistry: TimeslotRegistry,
) {
  let config = defaultAnnealingConfig;

  return {
    configure(newConfig: Partial<AnnealingConfig>) {
      config = { ...config, ...newConfig };
      return this;
    },

    optimize(initialState: TimetableState): TimetableState {
      let current = cloneTimetableState(initialState);
      let currentScore = calculateTotalScore(softScorer, current);
      
      let best = cloneTimetableState(current);
      let bestScore = currentScore;
      
      let temperature = config.initialTemp;

      while (temperature > config.finalTemp) {
        for (let i = 0; i < config.iterationsPerTemp; i++) {
          const neighbor = this.getNeighbor(current);
          const neighborScore = calculateTotalScore(softScorer, neighbor);
          
          const delta = neighborScore - currentScore;
          const probability = Math.exp(delta / temperature);
          
          if (delta > 0 || Math.random() < probability) {
            current = neighbor;
            currentScore = neighborScore;
            
            if (currentScore > bestScore) {
              best = cloneTimetableState(current);
              bestScore = currentScore;
            }
          }
        }
        
        temperature *= config.coolingRate;
      }

      return best;
    },

    getNeighbor(current: TimetableState): TimetableState {
      const newSlots = current.slots.length > 1
        ? this.swapTwoSlots(current.slots)
        : this.moveOneSlot(current.slots);
      
      return { slots: newSlots, assignedLessons: new Set(newSlots.map(s => s.id)) };
    },

    swapTwoSlots(slots: ScheduledLesson[]): ScheduledLesson[] {
      if (slots.length < 2) return slots;
      
      const idx1 = Math.floor(Math.random() * slots.length);
      let idx2 = Math.floor(Math.random() * slots.length);
      while (idx2 === idx1) {
        idx2 = Math.floor(Math.random() * slots.length);
      }
      
      const newSlots = [...slots];
      const slot1 = newSlots[idx1];
      const slot2 = newSlots[idx2];
      
      newSlots[idx1] = { ...slot1, day: slot2.day, period: slot2.period };
      newSlots[idx2] = { ...slot2, day: slot1.day, period: slot1.period };
      
      return newSlots;
    },

    moveOneSlot(slots: ScheduledLesson[]): ScheduledLesson[] {
      const moveIdx = Math.floor(Math.random() * slots.length);
      const lesson = slots[moveIdx];
      
      const availableSlots = timeslotRegistry.getAvailable();
      const randomSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
      
      const newSlots = [...slots];
      newSlots[moveIdx] = { ...lesson, day: randomSlot.day, period: randomSlot.period };
      
      return newSlots;
    },
  };
}