/**
 * Shared exam type normalization utility.
 *
 * The ResultSheet.examType column is a plain TEXT field, so any string can be stored.
 * This utility normalizes user-provided exam type values to match the Prisma ExamType enum.
 */

export const VALID_EXAM_TYPES = [
  'EXAM', 'QUIZ', 'TEST', 'MID_TERM', 'END_TERM',
  'PRACTICAL', 'OBJECTIVE', 'STRUCTURED', 'MOCK', 'SP1', 'SP2',
] as const;

const EXAM_TYPE_MAP: Record<string, string> = {
  'exam': 'EXAM', 'Exam': 'EXAM', 'EXAM': 'EXAM',
  'quiz': 'QUIZ', 'Quiz': 'QUIZ', 'QUIZ': 'QUIZ',
  'test': 'TEST', 'Test': 'TEST', 'TEST': 'TEST',
  'cat': 'TEST', 'Cat': 'TEST', 'CAT': 'TEST',
  'mid-term': 'MID_TERM', 'Mid-Term': 'MID_TERM', 'MID_TERM': 'MID_TERM',
  'Mid Term': 'MID_TERM', 'mid_term': 'MID_TERM', 'midterm': 'MID_TERM',
  'Midterm': 'MID_TERM', 'MIDTERM': 'MID_TERM',
  'end-term': 'END_TERM', 'End-Term': 'END_TERM', 'END_TERM': 'END_TERM',
  'End Term': 'END_TERM', 'end_term': 'END_TERM', 'endterm': 'END_TERM',
  'Endterm': 'END_TERM', 'ENDTERM': 'END_TERM',
  'end of term': 'END_TERM', 'End of Term': 'END_TERM',
  'practical': 'PRACTICAL', 'Practical': 'PRACTICAL', 'PRACTICAL': 'PRACTICAL',
  'objective': 'OBJECTIVE', 'Objective': 'OBJECTIVE', 'OBJECTIVE': 'OBJECTIVE',
  'structured': 'STRUCTURED', 'Structured': 'STRUCTURED', 'STRUCTURED': 'STRUCTURED',
  'mock': 'MOCK', 'Mock': 'MOCK', 'MOCK': 'MOCK',
  'sp1': 'SP1', 'Sp1': 'SP1', 'SP1': 'SP1',
  'sp2': 'SP2', 'Sp2': 'SP2', 'SP2': 'SP2',
  'assignment': 'EXAM', 'Assignment': 'EXAM', 'ASSIGNMENT': 'EXAM',
  'project': 'PRACTICAL', 'Project': 'PRACTICAL', 'PROJECT': 'PRACTICAL',
};

/**
 * Normalize an exam type value to the Prisma ExamType enum format.
 * Returns 'END_TERM' if the input is empty/null/undefined.
 * Returns the original value (with no transformation) if no mapping is found.
 */
export function normalizeExamType(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return 'END_TERM';
  if (VALID_EXAM_TYPES.includes(raw as any)) return raw;
  return EXAM_TYPE_MAP[raw] || raw;
}
