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
  sciencePassed: boolean;
  englishSubject?: ResolvedEczSubject;
  mathSubject?: ResolvedEczSubject;
  scienceSubject?: ResolvedEczSubject;
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

// ECZ Competence Based Curriculum (Forms 1-4) — 5 point competency scale.
// Score ranges and descriptors per official ECSEOL Chapter 30 (Grading and Certification):
//   70-100=1 Outstanding, 60-69=2 Advanced, 50-59=3 Basic, 40-49=4 Satisfactory, 0-39=5 Unsatisfactory.
const FORMS_SCALE: { min: number; grade: string; points: number; remark: string }[] = [
  { min: 70, grade: '1', points: 1, remark: 'Outstanding' },
  { min: 60, grade: '2', points: 2, remark: 'Advanced' },
  { min: 50, grade: '3', points: 3, remark: 'Basic' },
  { min: 40, grade: '4', points: 4, remark: 'Satisfactory' },
  { min: 0, grade: '5', points: 5, remark: 'Unsatisfactory' },
];

// Lower is better. Points equal the grade number on both systems.
const WORST_GRADE = { FORMS: 5, SECONDARY: 9 } as const;
// University entry: best 6 must all be within these grades (incl. English & Math I/II).
const UNIVERSITY_CUT = { FORMS: 3, SECONDARY: 6 } as const;
// Certificate: Satisfactory (grade 1-4 on Forms) counts as a pass; 5 = no award on secondary.
const CERTIFICATE_CUT = { FORMS: 4, SECONDARY: 8 } as const;
// CBC certificate thresholds:
//  "Satisfactory" (grade <= 4) is the pass-counting level; "Basic" (grade <= 3) is the higher qualifier.
//  Condition (a): Satisfactory in >= 6 subjects incl. English with Basic in >= 1.
//  Condition (b): Satisfactory in >= 5 subjects incl. English with Basic in >= 2.
const CBC_SATISFACTORY_CUT = { FORMS: 4, SECONDARY: 8 } as const;
const CBC_BASIC_CUT = { FORMS: 3, SECONDARY: 6 } as const;
const MAX_BEST_SIX_POINTS = { FORMS: 30, SECONDARY: 54 } as const;
// Candidates who write fewer than 6 subjects must never be rewarded with an
// artificially low aggregate. Six grade-1s is the minimum a full candidate can
// score, so the best-six total can never go below 6 points.
const MIN_BEST_SIX_POINTS = 6;

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
  const grade = String(WORST_GRADE[system]);
  return { grade, points: WORST_GRADE[system], remark: 'Unsatisfactory' };
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
  if (num == null) num = WORST_GRADE[system];
  num = Math.max(1, Math.min(num, WORST_GRADE[system]));

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
    passed: num <= CERTIFICATE_CUT[system],
    universityPassed: num <= UNIVERSITY_CUT[system],
  };
}

function normalizeSubjectName(name: string): string {
  return name.toLowerCase().trim();
}

function isEnglish(name: string): boolean {
  const n = normalizeSubjectName(name);
  return n === 'english' || n === 'english language' || n === 'eng' || n.startsWith('english ');
}

function isMath(name: string): boolean {
  const n = normalizeSubjectName(name);
  return n === 'mathematics' || n === 'math' || n === 'maths' || n.startsWith('mathematics ') || n.startsWith('math ');
}

// University science requirement:
//  Forms 1-4  -> best of Agricultural Science, Physics, Chemistry or Biology
//  Grades 10-12 -> best of Science (Composite), Biology or Agricultural Science
const SCIENCE_SUBJECTS: Record<EczGradingSystem, string[]> = {
  FORMS: ['agricultural science', 'agriculture', 'physics', 'chemistry', 'biology'],
  SECONDARY: ['science', 'biology', 'agricultural science', 'agriculture'],
};

export function isScienceSubject(name: string, system: EczGradingSystem): boolean {
  const n = normalizeSubjectName(name);
  return (SCIENCE_SUBJECTS[system] || []).some((k) => n === k || n.startsWith(`${k} `));
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
  const certificateName = gradingSystem === 'FORMS' ? 'Certificate of Secondary Education' : 'School Certificate';

  const bestSix = [...resolved]
    .sort((a, b) => a.points - b.points || a.name.localeCompare(b.name))
    .slice(0, 6);

  const rawBestSixTotal = bestSix.reduce((sum, s) => sum + s.points, 0);
  const bestSixTotal = bestSix.length > 0 ? Math.max(MIN_BEST_SIX_POINTS, rawBestSixTotal) : 0;

  const english = resolved.find((s) => isEnglish(s.name));
  const math = resolved.find((s) => isMath(s.name));
  const science = resolved.find((s) => isScienceSubject(s.name, gradingSystem));

  const uniCut = UNIVERSITY_CUT[gradingSystem];
  const certCut = CERTIFICATE_CUT[gradingSystem];

  const failsCertificate = resolved.filter((s) => !s.passed);
  const englishOkUni = !!english && english.points <= uniCut;
  const mathOkUni = !!math && math.points <= uniCut;
  const scienceOkUni = !!science && science.points <= uniCut;
  const englishOkCert = !!english && english.points <= certCut;

  const hasSix = resolved.length >= 6;
  const bestSixUniOk = bestSix.length === 6 && bestSix.every((s) => s.points <= uniCut);
  const bestSixCertOk = bestSix.length === 6 && bestSix.every((s) => s.points <= certCut);

  // CBC (Forms) certification — ECSEOL 2.2:
  //  (a) Satisfactory (grade <=4) in at least 6 subjects incl. English with Basic (grade <=3) in >=1; or
  //  (b) Satisfactory in 5 subjects incl. English with Basic in >=2.
  // A candidate who fulfils neither condition is unclassified.
  const certGradeCount = resolved.filter((s) => s.points <= CBC_SATISFACTORY_CUT[gradingSystem]).length;
  const basicGradeCount = resolved.filter((s) => s.points <= CBC_BASIC_CUT[gradingSystem]).length;
  const cbcCertificateAwarded =
    englishOkCert && ((certGradeCount >= 6 && basicGradeCount >= 1) || (certGradeCount >= 5 && basicGradeCount >= 2));

  const universityEligible = hasSix && bestSixUniOk && englishOkUni && mathOkUni && scienceOkUni;
  const certificateAwarded =
    gradingSystem === 'FORMS' ? cbcCertificateAwarded : hasSix && bestSixCertOk && englishOkCert;

  const status: EczEligibilityStatus = universityEligible
    ? 'UNIVERSITY'
    : certificateAwarded
      ? 'CERTIFICATE'
      : 'NONE';

  const unclassifiedDetails =
    gradingSystem === 'FORMS'
      ? !englishOkCert
        ? `Unclassified — does not meet ${certificateName}: English not at Satisfactory or better (Grade ${english?.grade ?? 'N/A'}; requires 4 or better)`
        : certGradeCount < 5
          ? `Unclassified — does not meet ${certificateName}: only ${certGradeCount} subject(s) at Satisfactory or better (minimum 5 required incl. English)`
          : `Unclassified — does not meet ${certificateName}: ${certGradeCount} subject(s) at Satisfactory or better incl. English but only ${basicGradeCount} at Basic or better (need 6 with 1 at Basic, or 5 with 2 at Basic)`
      : `Does not meet ${certificateName} requirements — failing: ${failsCertificate
          .map((s) => `${s.name} (Grade ${s.grade})`)
          .join(', ')}`;

  let details: string;
  if (gradingSystem === 'FORMS' && !universityEligible && !certificateAwarded) {
    details = unclassifiedDetails;
  } else if (gradingSystem === 'FORMS' && !hasSix) {
    details = `Achieves the ${certificateName} (${certGradeCount} subjects at Satisfactory or better incl. English, ${basicGradeCount} at Basic or better) but not university grade (minimum 6 subjects required for university)`;
  } else if (universityEligible) {
    details = `University eligible — best 6 in grades 1-${uniCut} including English, Mathematics and a science subject`;
  } else if (!englishOkUni) {
    details = `English not at university grade (Grade ${english?.grade ?? 'N/A'}; requires ${uniCut} or better)`;
  } else if (!mathOkUni) {
    details = `Mathematics not at university grade (Grade ${math?.grade ?? 'N/A'}; requires ${uniCut} or better)`;
  } else if (!scienceOkUni) {
    details = `Science not at university grade (Grade ${science?.grade ?? 'N/A'}; requires ${uniCut} or better in one of: ${SCIENCE_SUBJECTS[gradingSystem].join(', ')})`;
  } else if (!bestSixUniOk) {
    details = `Best 6 (${bestSixTotal} pts, max ${MAX_BEST_SIX_POINTS[gradingSystem]}) contains grades above ${uniCut}`;
  } else if (certificateAwarded) {
    details =
      gradingSystem === 'FORMS'
        ? `Achieves the ${certificateName} (${certGradeCount} subjects at Satisfactory or better incl. English, ${basicGradeCount} at Basic or better) but not university grade`
        : `Achieves the ${certificateName} (best 6 within grades 1-${certCut}) but not university grade`;
  } else {
    details = unclassifiedDetails;
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
    sciencePassed: scienceOkUni,
    englishSubject: english,
    mathSubject: math,
    scienceSubject: science,
    failingSubjects: failsCertificate.map((s) => s.name),
    details,
  };
}