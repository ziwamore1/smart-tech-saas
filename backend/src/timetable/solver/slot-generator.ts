import { Slot, ConstraintContext } from './types';

export function generateSlots(context: ConstraintContext): Slot[] {
  const slots: Slot[] = [];

  for (let day = 1; day <= context.days; day++) {
    for (let period = 1; period <= context.periods; period++) {
      const isBreak = context.breakPeriods.some(
        (b) => b.day === day && b.period === period,
      );

      if (!isBreak) {
        slots.push({ day, period });
      }
    }
  }

  return slots;
}
