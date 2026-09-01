/**
 * Shared exam type constants matching the Prisma ExamType enum.
 *
 * The VALUE sent to the backend must be the Prisma enum value (UPPERCASE, underscored).
 * The LABEL is for display only.
 *
 * Usage:
 *   <select>
 *     {EXAM_TYPE_OPTIONS.map(et => (
 *       <option key={et.value} value={et.value}>{et.label}</option>
 *     ))}
 *   </select>
 */

export const EXAM_TYPE_OPTIONS = [
  { value: 'EXAM', label: 'Exam' },
  { value: 'QUIZ', label: 'Quiz' },
  { value: 'TEST', label: 'Test' },
  { value: 'MID_TERM', label: 'Mid-Term' },
  { value: 'END_TERM', label: 'End of Term' },
  { value: 'PRACTICAL', label: 'Practical' },
  { value: 'OBJECTIVE', label: 'Objective' },
  { value: 'STRUCTURED', label: 'Structured' },
  { value: 'MOCK', label: 'Mock' },
  { value: 'SP1', label: 'SP1' },
  { value: 'SP2', label: 'SP2' },
] as const;

/** Flat array of valid enum values for quick checks */
export const EXAM_TYPE_VALUES = EXAM_TYPE_OPTIONS.map(et => et.value);

/** Get display label from an enum value */
export function examTypeLabel(value: string): string {
  return EXAM_TYPE_OPTIONS.find(et => et.value === value)?.label ?? value;
}