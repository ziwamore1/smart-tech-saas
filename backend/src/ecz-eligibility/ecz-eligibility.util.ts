export type EczGradingSystem = 'FORMS' | 'SECONDARY';

export interface EczSubjectGrade {
  name: string;
  score?: number | null;
  grade?: string | null;
  points?: number | null;
  remark?: string | null;
  isAbsent?: boolean;
}

export interface ResolvedEczSubject extends EczSubjectGrade {
  grade: string;
  points: number;
  remark: string;
  passed: boolean;
  universityPassed: boolean;
}

export type EczEligibilityStatus = 'UNIVERSITY' | 'CERTIFICATE' | 'NONE';

export interface EczEligibilityResult {
  eligible: boolean;
  universityEligible: boolean;
  certificateAwarded: boolean;
  status: EczEligibilityStatus;
  certificateName: string;
  gradingSystem: EczGradingSystem;
  totalSubjects: number;
  bestSix: ResolvedEczSubject[];
  bestSixTotal: number;
  hasFailingSubject: boolean;
  englishPassed: boolean;
  mathPassed: boolean;
  englishSubject?: ResolvedEczSubject;
  mathSubject?: ResolvedEczSubject;
  failingSubjects: string[];
  details: string;
}

// School Certificate & GCE Ordinary Level (Grades 10-12 / senior secondary) — 9 point scale.
const SECONDARY_SCALE: { min: number; grade: string; points: number; remark: string }[] = [
  { min: 75, grade: '1', points: 1, remark: 'Distinction' },
  { min: 70, grade: '2', points: 2, remark: 'Distinction' },
  { min: 65, grade: '3', points: 3, remark: 'Merit' },
  { min: 60, grade: '4', points: 4, remark: 'Merit' },
  { min: 55, grade: '5', points: 5, remark: 'Credit' },
  { min: 50, grade: '6', points: 6, remark: 'Credit' },
  { min: 45, grade: '7', points: 7, remark: 'Satisfactory' },
  { min: 40, grade: '8', points: 8, remark: 'Satisfactory' },
  { min: 0, grade: '9', points: 9, remark: 'Unsatisfactory' },
];

// ECZ Competency Based (Forms 1-4) — 5 point scale. 0-39=5, 40-49=4, 50-59=3, 60-69=2, 70-100=1.
const FORMS_SCALE: { min: number; grade: string; points: number; remark: string }[] = [
  { min: 70, grade: '1', points: 1, remark: 'Star' },
  { min: 60, grade: '2', points: 2, remark: 'Merit' },
  { min: 50, grade: '3', points: 3, remark: 'Credit' },
  { min: 40, grade: '4', points: 4, remark: 'Satisfactory' },
  { min: 0, grade: '5', points: 5, remark: 'Not achieved' },
];

export const ECZ_WORST_GRADE = { FORMS: 5, SECONDARY: 9 } as const;
export const ECZ_UNIVERSITY_CUT = { FORMS: 3, SECONDARY: 6 } as const;
export const ECZ_CERTIFICATE_CUT = { FORMS: 4, SECONDARY: 8 } as const;
export const ECZ_MAX_BEST_SIX_POINTS = { FORMS: 30, SECONDARY: 54 } as const;

export function scoreToEczGrade(score: number): { grade: string; points: number; remark: string } {
  for (const s of SECONDARY_SCALE) {
    if (score >= s.min) return { grade: s.grade, points: s.points, remark: s.remark };
  }
  return { grade: '9', points: 9, remark: 'Unsatisfactory' };
}

export function gradeForScore(score: number, system: EczGradingSystem): { grade: string; points: number; remark: string } {
  const scale = system === 'FORMS' ? FORMS_SCALE : SECONDARY_SCALE;
  for (const s of scale) {
    if (score >= s.min) return { grade: s.grade, points: s.points, remark: s.remark };
  }
  const worst = ECZ_WORST_GRADE[system];
  return { grade: String(worst), points: worst, remark: 'Not achieved' };
}

// Forms 1-4 (new 2023 curriculum, 5 point competency grading) vs Grades 10-12 / senior Forms 5-6 (9 point).
export function detectEczGradingSystem(levelOrClassName?: string | null): EczGradingSystem {
  const s = (levelOrClassName || '').toLowerCase().trim();
  if (!s) return 'SECONDARY';
  if (/form\s*[1-4](?!\d)|^f[1-4](?!\d)/i.test(s)) return 'FORMS';
  return 'SECONDARY';
}

function numericGrade(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= 1 && n <= 9) return n;
    return null;
  }
  if (typeof value === 'string') {
    const n = value.trim().replace(/['"]/g, '');
    if (/^[1-9]$/.test(n)) return Number(n);
  }
  return null;
}

function resolveSubject(raw: EczSubjectGrade, system: EczGradingSystem): ResolvedEczSubject {
  let num = numericGrade(raw.grade);
  if (num == null) num = numericGrade(raw.points);
  if (num == null && typeof raw.score === 'number' && Number.isFinite(raw.score)) {
    num = Number(gradeForScore(raw.score, system).grade);
  }
  if (num == null) num = ECZ_WORST_GRADE[system];
  num = Math.max(1, Math.min(num, ECZ_WORST_GRADE[system]));

  const remark =
    raw.isAbsent
      ? 'Absent'
      : typeof raw.remark === 'string' && raw.remark && raw.remark !== '-'
        ? raw.remark
        : String(num);

  return {
    ...raw,
    score: typeof raw.score === 'number' ? raw.score : null,
    grade: String(num),
    points: num,
    remark,
    passed: num <= ECZ_CERTIFICATE_CUT[system],
    universityPassed: num <= ECZ_UNIVERSITY_CUT[system],
  };
}

function normalizeSubjectName(name: string): string {
  return String(name || '').toLowerCase().trim();
}

function isEnglish(name: string): boolean {
  const n = normalizeSubjectName(name);
  return n === 'english' || n === 'english language' || n === 'eng' || n.startsWith('english ');
}

function isMath(name: string): boolean {
  const n = normalizeSubjectName(name);
  return n === 'mathematics' || n === 'math' || n === 'maths' || n.startsWith('mathematics ') || n.startsWith('math ');
}

export type EczEligibilityOptions =
  | EczGradingSystem
  | { gradingSystem?: EczGradingSystem; levelTypeName?: string };

export function checkEczEligibility(
  subjects: EczSubjectGrade[],
  options?: EczEligibilityOptions,
): EczEligibilityResult {
  const gradingSystem: EczGradingSystem =
    typeof options === 'string'
      ? options
      : options?.gradingSystem ?? detectEczGradingSystem(options?.levelTypeName);

  const resolved = subjects.filter((s) => !(s.isAbsent ?? false)).map((s) => resolveSubject(s, gradingSystem));
  const certificateName = 'School Certificate';

  const bestSix = [...resolved]
    .sort((a, b) => a.points - b.points || a.name.localeCompare(b.name))
    .slice(0, 6);

  const bestSixTotal = bestSix.reduce((sum, s) => sum + s.points, 0);

  const english = resolved.find((s) => isEnglish(s.name));
  const math = resolved.find((s) => isMath(s.name));

  const uniCut = ECZ_UNIVERSITY_CUT[gradingSystem];
  const certCut = ECZ_CERTIFICATE_CUT[gradingSystem];

  const failsCertificate = resolved.filter((s) => !s.passed);
  const englishOkUni = !!english && english.points <= uniCut;
  const mathOkUni = !!math && math.points <= uniCut;
  const englishOkCert = !!english && english.points <= certCut;

  const hasSix = resolved.length >= 6;
  const bestSixUniOk = bestSix.length === 6 && bestSix.every((s) => s.points <= uniCut);
  const bestSixCertOk = bestSix.length === 6 && bestSix.every((s) => s.points <= certCut);

  const universityEligible = hasSix && bestSixUniOk && englishOkUni && mathOkUni;
  const certificateAwarded = hasSix && bestSixCertOk && englishOkCert;

  const status: EczEligibilityStatus = universityEligible
    ? 'UNIVERSITY'
    : certificateAwarded
      ? 'CERTIFICATE'
      : 'NONE';

  let details: string;
  if (!hasSix) {
    details = `Minimum 6 subjects required (${resolved.length} enrolled)`;
  } else if (universityEligible) {
    details = `University eligible — best 6 in grades 1-${uniCut} including English and Mathematics`;
  } else if (!englishOkUni) {
    details = `English not at university grade (Grade ${english?.grade ?? 'N/A'}; requires ${uniCut} or better)`;
  } else if (!mathOkUni) {
    details = `Mathematics not at university grade (Grade ${math?.grade ?? 'N/A'}; requires ${uniCut} or better)`;
  } else if (!bestSixUniOk) {
    details = `Best 6 (${bestSixTotal} pts, max ${ECZ_MAX_BEST_SIX_POINTS[gradingSystem]}) contains grades above ${uniCut}`;
  } else if (certificateAwarded) {
    details = `Achieves the ${certificateName} (best 6 within grades 1-${certCut}) but not university grade`;
  } else {
    details = `Does not meet ${certificateName} requirements — failing: ${failsCertificate
      .map((s) => `${s.name} (Grade ${s.grade})`)
      .join(', ')}`;
  }

  return {
    eligible: universityEligible,
    universityEligible,
    certificateAwarded,
    status,
    certificateName,
    gradingSystem,
    totalSubjects: resolved.length,
    bestSix,
    bestSixTotal,
    hasFailingSubject: failsCertificate.length > 0,
    englishPassed: englishOkUni,
    mathPassed: mathOkUni,
    englishSubject: english,
    mathSubject: math,
    failingSubjects: failsCertificate.map((s) => s.name),
    details,
  };
}