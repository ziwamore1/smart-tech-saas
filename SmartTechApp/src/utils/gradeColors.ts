const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  'A+': { text: '#059669', bg: '#d1fae5' },
  'A':  { text: '#059669', bg: '#d1fae5' },
  'A-': { text: '#059669', bg: '#d1fae5' },
  'B+': { text: '#2563eb', bg: '#dbeafe' },
  'B':  { text: '#2563eb', bg: '#dbeafe' },
  'B-': { text: '#2563eb', bg: '#dbeafe' },
  'C+': { text: '#d97706', bg: '#fef3c7' },
  'C':  { text: '#d97706', bg: '#fef3c7' },
  'C-': { text: '#d97706', bg: '#fef3c7' },
  'D+': { text: '#dc2626', bg: '#fee2e2' },
  'D':  { text: '#dc2626', bg: '#fee2e2' },
  'D-': { text: '#dc2626', bg: '#fee2e2' },
  'E':  { text: '#dc2626', bg: '#fee2e2' },
  'F':  { text: '#dc2626', bg: '#fee2e2' },
  '1':  { text: '#059669', bg: '#d1fae5' },
  '2':  { text: '#2563eb', bg: '#dbeafe' },
  '3':  { text: '#d97706', bg: '#fef3c7' },
  '4':  { text: '#dc2626', bg: '#fee2e2' },
  '5':  { text: '#dc2626', bg: '#fee2e2' },
};

export const getGradeColors = (grade?: string | null): { text: string; bg: string } => {
  if (!grade) return { text: '#9ca3af', bg: '#f3f4f6' };
  const normalized = grade.trim();
  return GRADE_COLORS[normalized] || { text: '#9ca3af', bg: '#f3f4f6' };
};

export const getGradeTextColor = (grade?: string | null): string => getGradeColors(grade).text;
export const getGradeBgColor = (grade?: string | null): string => getGradeColors(grade).bg;

export const getScoreColors = (pct?: number | null): { text: string; bg: string } => {
  if (pct == null) return { text: '#9ca3af', bg: '#f3f4f6' };
  if (pct >= 75) return { text: '#059669', bg: '#d1fae5' };
  if (pct >= 50) return { text: '#d97706', bg: '#fef3c7' };
  return { text: '#dc2626', bg: '#fee2e2' };
};

export const getScoreTextColor = (pct?: number | null): string => getScoreColors(pct).text;
export const getScoreBgColor = (pct?: number | null): string => getScoreColors(pct).bg;
