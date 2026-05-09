import { PrismaService } from '../../prisma/prisma.service';
import { ConstraintContext } from './types';

export async function buildConstraints(
  prisma: PrismaService,
  schoolId: string,
): Promise<ConstraintContext> {
  const settings = await prisma.schoolSetting.findUnique({
    where: { schoolId },
  });

  const periodsPerDay = settings?.periodsPerDay ?? 8;
  const daysPerWeek = settings?.daysPerWeek ?? 5;

  return {
    days: daysPerWeek,
    periods: periodsPerDay,
    breakPeriods: [],
  };
}
