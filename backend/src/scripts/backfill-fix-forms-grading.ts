/**
 * Repairs Forms 1-4 classes that were accidentally assigned the 9-point
 * secondary (Grades 10-12 / School Certificate) grading system instead of the
 * 5-point competency (Forms / CBC) grading system.
 *
 * A class qualifies for repair when its level type (or its own name when the
 * level type is missing) indicates Forms 1-4 AND its grading system is a
 * numeric 1-9 point scale. The grading system is switched to the school's
 * Forms 1-5 competency grading system.
 *
 * Dry run:  npx tsx src/scripts/backfill-fix-forms-grading.ts
 * Apply:    npx tsx src/scripts/backfill-fix-forms-grading.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const FORMS_LEVEL = /^form\s*[1-4]$/i;
const FORMS_CLASS = /^form\s*[1-4][a-z]?$/i;

function is9Point(scales: { grade: string; points: number }[]): boolean {
  return scales.length > 0 && scales.every((s) => /^[1-9]$/.test(String(s.grade).trim()) && s.points === Number(s.grade.trim())) && Math.max(...scales.map((s) => Number(s.grade.trim()))) === 9;
}

function is5Point(scales: { grade: string; points: number }[]): boolean {
  return scales.length > 0 && scales.every((s) => /^[1-5]$/.test(String(s.grade).trim()) && s.points === Number(s.grade.trim())) && Math.max(...scales.map((s) => Number(s.grade.trim()))) === 5;
}

async function main() {
  const allGradesSystems = await prisma.gradingSystem.findMany({
    include: { gradeScales: { select: { grade: true, points: true } } },
  });
  const bySchool = new Map<string, typeof allGradesSystems>();
  for (const system of allGradesSystems) {
    const entry = bySchool.get(system.schoolId) ?? [];
    entry.push(system);
    bySchool.set(system.schoolId, entry);
  }

  const formsSystemFor = (schoolId: string) =>
    (bySchool.get(schoolId) ?? []).find(
      (s) => s.name.toLowerCase().includes('forms') && !s.name.toLowerCase().includes('grade 7') && is5Point(s.gradeScales),
    ) ??
    (bySchool.get(schoolId) ?? []).find((s) => is5Point(s.gradeScales));

  const classes = await prisma.class.findMany({
    select: {
      id: true,
      name: true,
      schoolId: true,
      levelType: { select: { name: true } },
      gradingSystem: { select: { id: true, name: true, gradeScales: { select: { grade: true, points: true } } } },
    },
  });

  const repairs: { classId: string; className: string; level: string | null; fromSystem: string; toSystem: string; toSystemId: string }[] = [];

  for (const cls of classes) {
    if (!cls.gradingSystem || !is9Point(cls.gradingSystem.gradeScales)) continue;
    const level = cls.levelType?.name ?? null;
    const isForms1to4 = level ? FORMS_LEVEL.test(level) : FORMS_CLASS.test(cls.name);
    if (!isForms1to4) continue;

    const target = formsSystemFor(cls.schoolId);
    if (!target || target.id === cls.gradingSystem.id) continue;

    repairs.push({
      classId: cls.id,
      className: cls.name,
      level,
      fromSystem: cls.gradingSystem.name,
      toSystem: target.name,
      toSystemId: target.id,
    });
  }

  if (repairs.length === 0) {
    console.log('No Forms 1-4 classes need grading-system repair.');
    return;
  }

  console.log(`${apply ? 'Repairing' : 'Would repair'} ${repairs.length} class(es):`);
  for (const r of repairs) {
    console.log(`  - ${r.className} (level ${r.level ?? '?'}, id ${r.classId})  ${r.fromSystem} -> ${r.toSystem}`);
  }

  if (apply) {
    await prisma.$transaction(
      repairs.map((r) =>
        prisma.class.updateMany({
          where: { id: r.classId },
          data: { gradingSystemId: r.toSystemId },
        }),
      ),
    );
  }

  console.log(apply
    ? `Completed: ${repairs.length} class(es) switched to the Forms grading system.`
    : `Dry run: ${repairs.length} class(es) found. Re-run with --apply to switch them.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());