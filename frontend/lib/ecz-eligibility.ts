export interface EczSubjectGrade {
  name: string;
  score: number;
  grade: string;
  points: number;
  remark: string;
}

export interface EczEligibilityResult {
  eligible: boolean;
  totalSubjects: number;
  bestSix: EczSubjectGrade[];
  bestSixTotal: number;
  hasFailingSubject: boolean;
  englishPassed: boolean;
  mathPassed: boolean;
  failingSubjects: string[];
  details: string;
}

const FAIL_THRESHOLD = 7;
const MIN_SUBJECTS = 6;
const MAX_BEST_SIX_POINTS = 36;

const ECZ_SCALES: { min: number; grade: string; points: number; remark: string }[] = [
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

export function scoreToEczGrade(score: number): { grade: string; points: number; remark: string } {
  for (const s of ECZ_SCALES) {
    if (score >= s.min) return { grade: s.grade, points: s.points, remark: s.remark };
  }
  return { grade: '9', points: 9, remark: 'Unsatisfactory' };
}

function normalizeSubjectName(name: string): string {
  return name.toLowerCase().trim();
}

function isEnglish(name: string): boolean {
  const n = normalizeSubjectName(name);
  return n === 'english' || n === 'english language' || n === 'eng';
}

function isMath(name: string): boolean {
  const n = normalizeSubjectName(name);
  return n === 'mathematics' || n === 'math' || n === 'maths';
}

export function checkEczEligibility(subjects: EczSubjectGrade[]): EczEligibilityResult {
  const failingSubjects = subjects.filter((s) => s.points >= FAIL_THRESHOLD);

  const english = subjects.find((s) => isEnglish(s.name));
  const math = subjects.find((s) => isMath(s.name));

  const englishPassed = english ? english.points < FAIL_THRESHOLD : false;
  const mathPassed = math ? math.points < FAIL_THRESHOLD : false;

  const bestSix = [...subjects]
    .sort((a, b) => a.points - b.points)
    .slice(0, 6);

  const bestSixTotal = bestSix.reduce((sum, s) => sum + s.points, 0);

  const meetsSubjectCount = subjects.length >= MIN_SUBJECTS;
  const noFails = failingSubjects.length === 0;
  const meetsPointsThreshold = bestSixTotal <= MAX_BEST_SIX_POINTS;
  const englishOk = !english || englishPassed;
  const mathOk = !math || mathPassed;

  const eligible = meetsSubjectCount && noFails && meetsPointsThreshold && englishOk && mathOk;

  let details: string;
  if (!meetsSubjectCount) {
    details = `Minimum 6 subjects required (${subjects.length} enrolled)`;
  } else if (!noFails) {
    details = `Failing subjects (Grade 7+): ${failingSubjects.map((s) => `${s.name} (Grade ${s.grade})`).join(', ')}`;
  } else if (!meetsPointsThreshold) {
    details = `Best 6 points (${bestSixTotal}) exceeds maximum (${MAX_BEST_SIX_POINTS})`;
  } else if (!englishOk) {
    details = `English not passed (Grade ${english?.grade ?? 'N/A'})`;
  } else if (!mathOk) {
    details = `Mathematics not passed (Grade ${math?.grade ?? 'N/A'})`;
  } else {
    details = 'Meets all ECZ certificate requirements';
  }

  return {
    eligible,
    totalSubjects: subjects.length,
    bestSix,
    bestSixTotal,
    hasFailingSubject: failingSubjects.length > 0,
    englishPassed,
    mathPassed,
    failingSubjects: failingSubjects.map((s) => s.name),
    details,
  };
}
