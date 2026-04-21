import { Slot } from './types';

export function scoreSlot(slot: Slot): number {
  let score = 0;

  if (slot.period <= 3) score += 5;

  if (slot.period === 8) score -= 3;

  return score;
}
