import { PrismaService } from '../../prisma/prisma.service';
import { ConstraintContext, Slot } from './types';

export async function buildConstraints(
  prisma: PrismaService,
  schoolId: string,
): Promise<ConstraintContext> {
  const breakPeriods = await prisma.breakPeriod.findMany({
    where: { schoolId },
  });

  const breaks: Slot[] = breakPeriods.map((b) => ({
    day: b.day,
    period: b.period,
  }));

  return {
    days: 5,
    periods: 8,
    breakPeriods: breaks,
  };
}
