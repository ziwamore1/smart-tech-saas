/**
 * Backfills ComputedResult rows for students whose Assessment Component scores
 * were entered as "X"/"A" (absent) in single-subject entry mode.
 *
 * Bug being resolved:
 *   syncComputedResult used to query StudentAssessmentResult with
 *   rawScore: { not: null }, so absence-only entries (rawScore IS NULL and
 *   isAbsent = TRUE) were invisible. When every component for a student +
 *   subject + term was entered as X/A, totalWeight ended up 0 and the
 *   ComputedResult row was DELETED instead of flagged absent. Entry tables in
 *   Bulk Mode then rendered those cells as "-" ("missing") even though the
 *   component scores had been properly recorded, inflating the Missing counter.
 *
 * This script makes the existing data consistent by, per
 * (student, subject, term) group that contains ONLY absent component entries:
 *   - CREATE the missing ComputedResult with isAbsent = true,
 *     finalPercentage = NULL, status COMPUTED (when every configured component
 *     is covered by an absence) or PENDING (partially entered)
 *   - REPAIR existing ComputedResult rows that are not yet flagged absent
 *     (e.g. rows left with a null percentage and zero raw score)
 *   - SKIP anything already correct
 *
 * Groups that contain at least one real (non-absent) score are left untouched —
 * those were always aggregated correctly.
 *
 * Usage:
 *   Dry run (read-only):      npx tsx src/scripts/backfill-absent-computed-results.ts
 *   Apply:                    npx tsx src/scripts/backfill-absent-computed-results.ts --apply
 *   Against production:       dotenv -e .env.production -- npx tsx src/scripts/backfill-absent-computed-results.ts --apply --health-url https://api.smarttechsaas.com/api/v1/health
 *
 * When --apply is combined with --health-url <url>, the script first pings that
 * health endpoint and refuses to write unless it responds and its database
 * check reports "up". This guarantees writes only ever happen against a live,
 * correctly-wired production environment.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

// Supports both "--health-url=https://..." and "--health-url https://..."
const healthUrlIndex = process.argv.indexOf('--health-url');
const HEALTH_URL =
  healthUrlIndex !== -1
    ? process.argv[healthUrlIndex + 1]
    : process.argv.find((a) => a.startsWith('--health-url='))?.split('=')[1];

/** Returns a safe description of the DATABASE_URL target (no credentials). */
function describeDbTarget(): string {
  const raw = process.env.DATABASE_URL || '';
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return '(DATABASE_URL not set or unparsable)';
  }
}

interface HealthResult {
  ok: boolean;
  detail: string;
}

async function checkEnvironmentHealth(url: string): Promise<HealthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status} from ${url}` };
    }
    try {
      const body = JSON.parse(text);
      const dbStatus =
        body?.data?.checks?.database?.status ??
        body?.checks?.database?.status ??
        null;
      if (dbStatus && dbStatus !== 'up') {
        return { ok: false, detail: `${url} reports database "${dbStatus}"` };
      }
      return { ok: true, detail: `HTTP ${res.status}, database ${dbStatus ?? 'status unknown'}` };
    } catch {
      // Not JSON — accept any successful response as alive.
      return { ok: true, detail: `HTTP ${res.status} (non-JSON body)` };
    }
  } catch (e: any) {
    return { ok: false, detail: e?.name === 'AbortError' ? 'request timed out after 15s' : e?.message || 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

interface ComponentEntry {
  assessmentDefId: string;
  rawScore: number | null;
  maxScore: number;
  isAbsent: boolean;
}

interface GroupInfo {
  studentId: string;
  subjectId: string;
  termId: string;
  classId: string;
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

function computeExpectedState(entries: ComponentEntry[], configs: { assessmentDefId: string }[]) {
  const allEntriesAbsent =
    entries.length > 0 && entries.every((e) => e.isAbsent && e.rawScore == null);

  let fullyAbsent: boolean;
  let allFilled: boolean;
  if (configs.length > 0) {
    fullyAbsent =
      allEntriesAbsent &&
      configs.every((c) => {
        const e = entries.find((x) => x.assessmentDefId === c.assessmentDefId);
        return !!e && e.isAbsent && e.rawScore == null;
      });
    allFilled = configs.every((c) => {
      const e = entries.find((x) => x.assessmentDefId === c.assessmentDefId);
      return !!e && (e.rawScore != null || e.isAbsent);
    });
  } else {
    // No term configuration — treat any absence-only data as authoritative.
    fullyAbsent = allEntriesAbsent;
    allFilled = entries.length > 0;
  }

  return {
    totalRawScore: 0,
    totalWeightedScore: null as number | null,
    finalPercentage: null as number | null,
    finalGrade: null as string | null,
    finalRemark: fullyAbsent ? 'ABSENT (X)' : null,
    points: null as number | null,
    isAbsent: true,
    status: fullyAbsent && allFilled ? ('COMPUTED' as const) : ('PENDING' as const),
    metadata: fullyAbsent ? { absentCode: 'X' } : {},
    computedAt: fullyAbsent && allFilled ? new Date() : null,
  };
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writes)' : 'DRY RUN (read-only)'}`);
  console.log(`Database target: ${describeDbTarget()}`);

  if (APPLY && HEALTH_URL) {
    console.log(`Preflight health check: ${HEALTH_URL}`);
    const health = await checkEnvironmentHealth(HEALTH_URL);
    if (!health.ok) {
      console.error(`ABORT: target environment is not healthy (${health.detail}). Refusing to write.`);
      process.exitCode = 1;
      return;
    }
    console.log(`Health OK — proceeding (${health.detail}).`);
  } else if (APPLY && !HEALTH_URL) {
    console.log('No --health-url supplied; skipping preflight (pass it to guard production writes).');
  }

  // ── Collect all (student, subject, term) groups touched by absences ──
  const groupMap = new Map<string, GroupInfo>();
  let scannedRows = 0;
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.studentAssessmentResult.findMany({
      where: { isAbsent: true },
      orderBy: { id: 'asc' },
      take: 5000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        termId: true,
        classId: true,
      },
    });
    if (!batch.length) break;
    for (const r of batch) {
      const key = `${r.studentId}|${r.subjectId}|${r.termId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          studentId: r.studentId,
          subjectId: r.subjectId,
          termId: r.termId,
          classId: r.classId,
        });
      }
    }
    scannedRows += batch.length;
    cursor = batch[batch.length - 1].id;
    console.log(`  scanned ${scannedRows} absent component rows, ${groupMap.size} groups so far...`);
    if (batch.length < 5000) break;
  }

  console.log(`\nAbsence-touched groups to inspect: ${groupMap.size}`);
  if (groupMap.size === 0) {
    console.log('Nothing to do.');
    return;
  }

  const schoolIdCache = new Map<string, string | null>();
  const resolveSchoolId = async (classId: string): Promise<string | null> => {
    if (!schoolIdCache.has(classId)) {
      const cls = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
      schoolIdCache.set(classId, cls?.schoolId ?? null);
    }
    return schoolIdCache.get(classId) ?? null;
  };

  let toCreate = 0;
  let toUpdate = 0;
  let alreadyCorrect = 0;
  let skippedMixed = 0;
  let skippedNoSchool = 0;

  const groups = [...groupMap.values()];

  await mapLimit(groups, 5, async (group) => {
    const [entries, configs] = await Promise.all([
      prisma.studentAssessmentResult.findMany({
        where: {
          studentId: group.studentId,
          subjectId: group.subjectId,
          termId: group.termId,
        },
        select: {
          assessmentDefId: true,
          rawScore: true,
          maxScore: true,
          isAbsent: true,
        },
      }),
      prisma.termAssessmentConfiguration.findMany({
        where: {
          classId: group.classId,
          subjectId: group.subjectId,
          termId: group.termId,
        },
        select: { assessmentDefId: true },
      }),
    ]);

    // Groups containing at least one real score were always aggregated
    // correctly (absences are excluded from numerator and denominator) — skip.
    if (entries.some((e) => e.rawScore != null && !e.isAbsent)) {
      skippedMixed++;
      return;
    }
    if (entries.length === 0) return;

    const schoolId = await resolveSchoolId(group.classId);
    if (!schoolId) {
      skippedNoSchool++;
      return;
    }

    const expected = computeExpectedState(
      entries.map((e) => ({
        assessmentDefId: e.assessmentDefId,
        rawScore: e.rawScore,
        maxScore: e.maxScore,
        isAbsent: e.isAbsent,
      })),
      configs,
    );

    const existing = await prisma.computedResult.findUnique({
      where: {
        studentId_subjectId_termId: {
          studentId: group.studentId,
          subjectId: group.subjectId,
          termId: group.termId,
        },
      },
      select: {
        id: true,
        classId: true,
        schoolId: true,
        totalRawScore: true,
        finalPercentage: true,
        finalRemark: true,
        points: true,
        status: true,
        isAbsent: true,
      },
    });

    const matchesExpected =
      existing &&
      existing.isAbsent === true &&
      existing.finalPercentage == null &&
      (existing.totalRawScore ?? 0) === 0 &&
      existing.status === expected.status &&
      (existing.finalRemark ?? null) === expected.finalRemark &&
      existing.points == null &&
      existing.classId === group.classId &&
      existing.schoolId === schoolId;

    if (matchesExpected) {
      alreadyCorrect++;
      return;
    }

    if (!existing) toCreate++;
    else toUpdate++;

    if (APPLY) {
      await prisma.computedResult.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId: group.studentId,
            subjectId: group.subjectId,
            termId: group.termId,
          },
        },
        update: {
          classId: group.classId,
          schoolId,
          ...expected,
        },
        create: {
          studentId: group.studentId,
          subjectId: group.subjectId,
          termId: group.termId,
          classId: group.classId,
          schoolId,
          ...expected,
        },
      });
    }
  });

  console.log('\nSUMMARY');
  console.log(`  Absent component rows scanned: ${scannedRows}`);
  console.log(`  Groups inspected:              ${groups.length}`);
  console.log(`  Would create:                  ${toCreate}`);
  console.log(`  Would repair:                  ${toUpdate}`);
  console.log(`  Already correct:               ${alreadyCorrect}`);
  console.log(`  Skipped (has real scores):     ${skippedMixed}`);
  console.log(`  Skipped (no school/class):     ${skippedNoSchool}`);
  console.log(`  Applied: ${APPLY ? 'YES' : 'NO (rerun with --apply to write)'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
