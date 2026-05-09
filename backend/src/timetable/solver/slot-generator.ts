import { Slot, ConstraintContext } from './types';

export function generateSlots(context: ConstraintContext): Slot[] {
  const slots: Slot[] = [];

  for (let day = 1; day <= context.days; day++) {
    for (let period = 1; period <= context.periods; period++) {
      slots.push({ day, period });
    }
  }

  return slots;
}
