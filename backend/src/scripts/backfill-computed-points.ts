/**
 * Backfills NULL points/gpa on ComputedResult rows that already have finalPercentage.
 *
 * Root cause: marks entered via the direct result route (result.service create/createBulk/update)
 * upserted computedResult WITHOUT points, so report cards rendered '—' in the pts column.
 *
 * Usage:
 *   Dry run (read-only):      npx tsx --env-file=.env.production src/scripts/backfill-computed-points.ts
 *   Apply:                    npx tsx --env-file=.env.production src/scripts/backfill-computed-points.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const SCHOOL_NAME = process.env.BACKFILL_SCHOOL || 'SMART TECH SECONDARY SCHOOL';

interface GradeScale {
  grade: string;
  remark: string | null;
  points: number | null;
  minScore: number;
  maxScore: number;
}

const scaleCache = new Map<string, GradeScale[]>();

function pickScales(rows: any[]): GradeScale[] {
  return rows
    .filter((s) => s.grade != null && s.minScore != null && s.maxScore != null)
    .map((s) => ({
      grade: s.grade,
      remark: s.remark ?? null,
      points: s.points ?? null,
      minScore: s.minScore,
      maxScore: s.maxScore,
    }));
}

async function getGradeScales(classId: string | null, schoolId: string): Promise<GradeScale[]> {
  const cacheKey = classId ? `class:${classId}` : `school:${schoolId}`;
  if (scaleCache.has(cacheKey)) return scaleCache.get(cacheKey)!;

  let scales: GradeScale[] = [];
  if (classId) {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: { gradingSystem: { include: { gradeScales: true } } },
    });
    if (cls?.gradingSystem?.gradeScales?.length) scales = pickScales(cls.gradingSystem.gradeScales);
  }
  if (!scales.length) {
    const schoolDefault = await prisma.gradingSystem.findFirst({
      where: { schoolId, isDefault: true },
      include: { gradeScales: true },
    });
    if (schoolDefault?.gradeScales?.length) scales = pickScales(schoolDefault.gradeScales);
  }
  if (!scales.length) {
    const anySystem = await prisma.gradingSystem.findFirst({
      where: { schoolId },
      include: { gradeScales: true },
    });
    if (anySystem?.gradeScales?.length) scales = pickScales(anySystem.gradeScales);
  }
  scaleCache.set(cacheKey, scales);
  return scales;
}

function applyScale(scales: GradeScale[], score: number): GradeScale | null {
  return scales.find((s) => score >= s.minScore && score <= s.maxScore) ?? null;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writes)' : 'DRY RUN (read-only)'} | School: ${SCHOOL_NAME}`);

  const school = await prisma.school.findFirst({ where: { name: SCHOOL_NAME } });
  if (!school) {
    console.log('School not found');
    return;
  }
  console.log(`School: ${school.id} ${school.name}`);

  const affected = await prisma.computedResult.findMany({
    where: {
      schoolId: school.id,
      finalPercentage: { not: null },
      points: null,
    },
    select: {
      id: true,
      studentId: true,
      subjectId: true,
      classId: true,
      termId: true,
      finalPercentage: true,
      finalGrade: true,
      finalRemark: true,
      points: true,
      gpa: true,
    },
  });

  console.log(`ComputedResult rows with finalPercentage but NULL points: ${affected.length}`);

  const studentCache = new Map<string, string>();
  const subjectCache = new Map<string, string>();

  let toFix = 0;
  let noScale = 0;

  for (const row of affected) {
    const pct = row.finalPercentage as number;
    const scales = await getGradeScales(row.classId, school.id);
    const scale = applyScale(scales, pct);

    if (!scale) {
      noScale++;
      if (!APPLY) {
        console.log(`  [SKIP no scale] ${row.studentId} ${row.subjectId} pct=${pct}`);
      }
      continue;
    }

    toFix++;
    if (APPLY) {
      await prisma.computedResult.update({
        where: { id: row.id },
        data: { points: scale.points, gpa: (scale as any).gpa ?? row.gpa ?? null },
      });
    } else {
      const studentName = studentCache.get(row.studentId);
      const subjectName = subjectCache.get(row.subjectId);
      console.log(
        `  ${studentName ?? row.studentId} | ${subjectName ?? row.subjectId} | pct=${pct} | grade=${scale.grade} | pts=${scale.points}`,
      );
    }
  }

  console.log(
    APPLY
      ? `Updated ${toFix} rows. No scale found for ${noScale} rows.`
      : `Dry run: ${toFix} rows would be updated. No scale found for ${noScale} rows.`,
  );
}

main().finally(() => prisma.$disconnect());
