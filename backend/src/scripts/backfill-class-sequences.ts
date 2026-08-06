/**
 * Backfills and repairs the durable class register position for every active
 * enrollment. Existing sequence numbers win; legacy admission numbers are
 * used only as the deterministic fallback for records not yet backfilled.
 *
 * Dry run:  npx tsx src/scripts/backfill-class-sequences.ts
 * Apply:    npx tsx src/scripts/backfill-class-sequences.ts --apply
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

function legacyNumber(value: string): number {
  const match = value.match(/-(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

async function repairRegister(schoolId: string, academicYearId: string, classId: string, year: number) {
  const enrollments = await prisma.enrollment.findMany({
    where: { schoolId, academicYearId, classId, status: 'ACTIVE' },
    select: {
      id: true,
      studentId: true,
      sequenceNumber: true,
      student: { select: { id: true, classId: true, admissionNumber: true, firstName: true, lastName: true } },
    },
  });

  const ordered = [...enrollments].sort((a, b) => {
    if (a.sequenceNumber != null && b.sequenceNumber != null && a.sequenceNumber !== b.sequenceNumber) return a.sequenceNumber - b.sequenceNumber;
    if (a.sequenceNumber != null) return -1;
    if (b.sequenceNumber != null) return 1;
    return legacyNumber(a.student.admissionNumber) - legacyNumber(b.student.admissionNumber)
      || `${a.student.firstName} ${a.student.lastName}`.localeCompare(`${b.student.firstName} ${b.student.lastName}`)
      || a.studentId.localeCompare(b.studentId);
  });

  if (!apply) return ordered.length;

  await prisma.$transaction(async (tx) => {
    await tx.enrollment.updateMany({
      where: { schoolId, academicYearId, classId, status: 'ACTIVE' },
      data: { sequenceNumber: null },
    });

    for (const enrollment of ordered.filter((item) => item.student.classId === classId)) {
      await tx.student.update({
        where: { id: enrollment.studentId },
        data: { admissionNumber: `TMP-${enrollment.studentId.slice(0, 12)}` },
      });
    }

    for (let index = 0; index < ordered.length; index += 1) {
      const enrollment = ordered[index];
      await tx.enrollment.update({ where: { id: enrollment.id }, data: { sequenceNumber: index + 1 } });
      if (enrollment.student.classId === classId) {
        await tx.student.update({
          where: { id: enrollment.studentId },
          data: { admissionNumber: `ST-${year}-${String(index + 1).padStart(3, '0')}` },
        });
      }
    }

    await tx.admissionSequence.upsert({
      where: { schoolId_academicYearId_classId: { schoolId, academicYearId, classId } },
      update: { currentSequence: ordered.length, year },
      create: { schoolId, academicYearId, classId, year, currentSequence: ordered.length },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 10000 });

  return ordered.length;
}

async function main() {
  const academicYears = await prisma.academicYear.findMany({
    select: { id: true, schoolId: true, startDate: true },
    orderBy: { startDate: 'asc' },
  });
  let registers = 0;
  let students = 0;

  for (const academicYear of academicYears) {
    const classes = await prisma.class.findMany({ where: { schoolId: academicYear.schoolId }, select: { id: true } });
    for (const classItem of classes) {
      const count = await repairRegister(
        academicYear.schoolId,
        academicYear.id,
        classItem.id,
        academicYear.startDate.getFullYear(),
      );
      if (count > 0) {
        registers += 1;
        students += count;
        console.log(`${apply ? 'Repaired' : 'Would repair'} ${count} enrollment(s) in class ${classItem.id}, academic year ${academicYear.id}`);
      }
    }
  }

  console.log(`${apply ? 'Completed' : 'Dry run'}: ${registers} register(s), ${students} enrollment(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
