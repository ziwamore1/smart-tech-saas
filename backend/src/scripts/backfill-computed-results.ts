/**
 * Backfills ComputedResult rows from the legacy Result table for ALL schools.
 *
 * The Results Management Excel import writes published scores into the `Result`
 * table only. ComputedResult rows (used by report cards, analytics and rankings)
 * end up with NULL finalPercentage because the assessment pipeline yields no
 * scores when no termAssessmentConfiguration/studentAssessmentResult exist.
 *
 * This script makes the existing data consistent by, per (student, term, subject):
 *  - UPDATE existing ComputedResult rows that have NULL finalPercentage or stale class/school
 *    ownership (score fields only, status and any existing non-null scores are preserved)
 *  - CREATE missing ComputedResult rows from Result data (status COMPUTED)
 *  - CREATE/repair ComputedResult rows from saved StudentAssessmentResult component data
 *
 * Usage:
 *   Dry run (read-only):      npx tsx src/scripts/backfill-computed-results.ts
 *   Apply:                    npx tsx src/scripts/backfill-computed-results.ts --apply
 *   Against production:       dotenv -e .env.production -- npx tsx src/scripts/backfill-computed-results.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

interface GradeScale {
  grade: string;
  remark: string | null;
  points: number | null;
  minScore: number;
  maxScore: number;
}

const gradeCache = new Map<string, GradeScale[]>();

async function getGradeScales(classId: string | null, schoolId: string): Promise<GradeScale[]> {
  const cacheKey = classId ? `class:${classId}` : `school:${schoolId}`;
  if (gradeCache.has(cacheKey)) return gradeCache.get(cacheKey)!;

  const pick = (rows: any[]): GradeScale[] =>
    rows
      .filter((s) => s.grade != null && s.minScore != null && s.maxScore != null)
      .map((s) => ({ grade: s.grade, remark: s.remark ?? null, points: s.points ?? null, minScore: s.minScore, maxScore: s.maxScore }));

  let scales: GradeScale[] = [];
  if (classId) {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: { gradingSystem: { include: { gradeScales: true } } },
    });
    if (cls?.gradingSystem?.gradeScales?.length) scales = pick(cls.gradingSystem.gradeScales);
  }
  if (!scales.length) {
    const schoolDefault = await prisma.gradingSystem.findFirst({
      where: { schoolId, isDefault: true },
      include: { gradeScales: true },
    });
    if (schoolDefault?.gradeScales?.length) scales = pick(schoolDefault.gradeScales);
  }
  if (!scales.length) {
    const anySystem = await prisma.gradingSystem.findFirst({
      where: { schoolId },
      include: { gradeScales: true },
    });
    if (anySystem?.gradeScales?.length) scales = pick(anySystem.gradeScales);
  }
  gradeCache.set(cacheKey, scales);
  return scales;
}

function applyScale(scales: GradeScale[], score: number): GradeScale | null {
  return scales.find((s) => score >= s.minScore && score < s.maxScore + 1) ?? null;
}

function fallbackScale(score: number): GradeScale {
  if (score >= 75) return { grade: 'A', remark: 'Distinction', points: 1, minScore: 75, maxScore: 100 };
  if (score >= 65) return { grade: 'B', remark: 'Very Good', points: 2, minScore: 65, maxScore: 74.99 };
  if (score >= 50) return { grade: 'C', remark: 'Credit', points: 3, minScore: 50, maxScore: 64.99 };
  if (score >= 40) return { grade: 'D', remark: 'Pass', points: 4, minScore: 40, maxScore: 49.99 };
  return { grade: 'E', remark: 'Fail', points: 5, minScore: 0, maxScore: 39.99 };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writes)' : 'DRY RUN (read-only)'}`);

  const terms = await prisma.term.findMany({ select: { id: true, academicYearId: true } });
  console.log(`Terms to process: ${terms.length}`);

  const classIdCache = new Map<string, string | null>();

  let created = 0;
  let updated = 0;
  let skippedNoEnrollment = 0;
  let unaffected = 0;

  for (const term of terms) {
    let cursor: string | undefined;
    const groupMap = new Map<string, any[]>();
    let total = 0;

    while (true) {
      const batch = await prisma.result.findMany({
        where: { termId: term.id },
        orderBy: { id: 'asc' },
        take: 5000,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          schoolId: true,
          score: true,
          grade: true,
          remark: true,
        },
      });
      if (!batch.length) break;
      for (const r of batch) {
        const key = `${r.studentId}|${term.id}`;
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(r);
      }
      total += batch.length;
      cursor = batch[batch.length - 1].id;
      if (batch.length < 5000) break;
    }

    if (!total) continue;

    for (const [key, rows] of groupMap) {
      const studentId = key.split('|')[0];
      const cacheKey = `${studentId}|${term.academicYearId}`;

      let classId = classIdCache.get(cacheKey);
      if (classId === undefined) {
        const yearEnrollment = await prisma.enrollment.findFirst({
          where: { studentId, academicYearId: term.academicYearId },
          select: { classId: true, status: true },
        });
        const activeEnrollment = yearEnrollment && yearEnrollment.status === 'ACTIVE'
          ? yearEnrollment
          : await prisma.enrollment.findFirst({
              where: { studentId, status: 'ACTIVE' },
              select: { classId: true, status: true },
            });
        const anyEnrollment = activeEnrollment ?? yearEnrollment;
        classId = anyEnrollment?.classId ?? null;
        classIdCache.set(cacheKey, classId);
      }

      const existing = await prisma.computedResult.findMany({
        where: { studentId, termId: term.id },
        select: {
          id: true,
          subjectId: true,
          finalPercentage: true,
          finalGrade: true,
          finalRemark: true,
          points: true,
          totalRawScore: true,
          totalWeightedScore: true,
          classId: true,
          schoolId: true,
        },
      });
      const existingMap = new Map(existing.map((e) => [e.subjectId, e]));

      const schoolId = rows[0].schoolId;
      const scales = await getGradeScales(classId, schoolId);

      const prepared = rows.map((r) => {
        const scale = applyScale(scales, r.score) ?? fallbackScale(r.score);
        return {
          subjectId: r.subjectId,
          score: r.score,
          schoolId: r.schoolId,
          grade: r.grade ?? scale.grade,
          remark: r.remark ?? scale.remark,
          points: scale.points,
        };
      });

      const toCreate = prepared.filter((p) => !existingMap.has(p.subjectId));
      const toUpdate = prepared
        .map((p) => ({ p, ex: existingMap.get(p.subjectId)! }))
        .filter(({ ex }) => ex.finalPercentage == null || ex.classId !== classId || ex.schoolId !== schoolId);

      for (const { p, ex } of toUpdate) {
        if (APPLY) {
          await prisma.computedResult.update({
            where: { id: ex.id },
            data: {
              classId,
              schoolId: p.schoolId,
              totalRawScore: ex.totalRawScore ?? p.score,
              totalWeightedScore: ex.totalWeightedScore ?? p.score,
              finalPercentage: p.score,
              finalGrade: ex.finalGrade ?? p.grade,
              finalRemark: ex.finalRemark ?? p.remark,
              points: ex.points ?? p.points,
            },
          });
        }
        updated++;
      }

      if (toCreate.length > 0) {
        if (!classId) {
          skippedNoEnrollment += toCreate.length;
        } else if (APPLY) {
          await prisma.computedResult.createMany({
            data: toCreate.map((p) => ({
              studentId,
              subjectId: p.subjectId,
              termId: term.id,
              classId,
              schoolId: p.schoolId,
              totalRawScore: p.score,
              totalWeightedScore: p.score,
              finalPercentage: p.score,
              finalGrade: p.grade,
              finalRemark: p.remark,
              points: p.points,
              status: 'COMPUTED',
              isAbsent: false,
              computedAt: new Date(),
            })),
            skipDuplicates: true,
          });
          created += toCreate.length;
        } else {
          created += toCreate.length;
        }
      }

      unaffected += prepared.length - toUpdate.length - toCreate.length;
    }

    console.log(`  term ${term.id}: ${total} Result rows, ${groupMap.size} student groups`);
  }

  const componentRows = await prisma.studentAssessmentResult.findMany({
    where: {
      OR: [{ rawScore: { not: null } }, { isAbsent: true }],
    },
    select: {
      studentId: true,
      subjectId: true,
      termId: true,
      classId: true,
      rawScore: true,
      percentage: true,
      grade: true,
      remarks: true,
      isAbsent: true,
      class: { select: { schoolId: true } },
    },
  });
  let componentCreated = 0;
  let componentUpdated = 0;
  for (const row of componentRows) {
    const score = row.isAbsent ? null : row.percentage ?? row.rawScore;
    const existing = await prisma.computedResult.findUnique({
      where: {
        studentId_subjectId_termId: {
          studentId: row.studentId,
          subjectId: row.subjectId,
          termId: row.termId,
        },
      },
      select: { id: true, finalPercentage: true, classId: true, schoolId: true },
    });
    const needsRepair = !existing || existing.finalPercentage == null || existing.classId !== row.classId || existing.schoolId !== row.class.schoolId;
    if (!needsRepair) continue;

    if (APPLY) {
      await prisma.computedResult.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId: row.studentId,
            subjectId: row.subjectId,
            termId: row.termId,
          },
        },
        update: {
          classId: row.classId,
          schoolId: row.class.schoolId,
          ...(score != null ? { totalRawScore: score, finalPercentage: score } : {}),
          ...(row.grade ? { finalGrade: row.grade } : {}),
          ...(row.remarks ? { finalRemark: row.remarks } : {}),
        },
        create: {
          studentId: row.studentId,
          subjectId: row.subjectId,
          termId: row.termId,
          classId: row.classId,
          schoolId: row.class.schoolId,
          totalRawScore: score,
          finalPercentage: score,
          finalGrade: row.grade,
          finalRemark: row.remarks,
          status: score != null ? 'COMPUTED' : 'PENDING',
          isAbsent: row.isAbsent,
          computedAt: score != null ? new Date() : null,
        },
      });
    }
    if (existing) componentUpdated++;
    else componentCreated++;
  }

  console.log('\nSUMMARY');
  console.log(`  Would create:     ${created}`);
  console.log(`  Would update:     ${updated}`);
  console.log(`  Skipped (no enrollment/class): ${skippedNoEnrollment}`);
  console.log(`  Already correct:  ${unaffected}`);
  console.log(`  Component rows to create: ${componentCreated}`);
  console.log(`  Component rows to repair: ${componentUpdated}`);
  console.log(`  Applied: ${APPLY ? 'YES' : 'NO (rerun with --apply to write)'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
