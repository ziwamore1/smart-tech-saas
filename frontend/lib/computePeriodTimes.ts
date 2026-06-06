export interface TimeSettings {
  startTime: string;
  periodsPerDay: number;
  periodDuration: number;
  daysPerWeek: number;
  breakAfterPeriod: number;
  breakDuration: number;
  breaks: Array<{ afterPeriod: number; duration: number; name?: string }>;
  periodDurations: number[];
  useZeroPeriod: boolean;
  showDayNumber: boolean;
  days: Array<{ name: string; shortName: string }>;
}

export interface ComputedPeriodTime {
  start: string;
  end: string;
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function computePeriodTimes(
  ts: Partial<TimeSettings>
): Record<number, ComputedPeriodTime> | null {
  if (!ts?.startTime) return null;
  const times: Record<number, ComputedPeriodTime> = {};
  let mins = parseTimeToMinutes(ts.startTime);
  const breakMap = new Map<number, number>();
  (ts.breaks || []).forEach((b) => breakMap.set(b.afterPeriod, b.duration));

  const count = ts.periodsPerDay || 8;
  for (let i = 1; i <= count; i++) {
    const dur = ts.periodDurations?.[i - 1] ?? ts.periodDuration ?? 40;
    const start = formatTime(mins);
    const end = formatTime(mins + dur);
    times[i] = { start, end };
    mins += dur;
    const breakDur = breakMap.get(i);
    if (breakDur) mins += breakDur;
  }
  return times;
}

export function computeBreakPeriods(
  ts: Partial<TimeSettings>
): Set<number> {
  const breaks = new Set<number>();
  (ts.breaks || []).forEach((b) => breaks.add(b.afterPeriod));
  if (ts.breakAfterPeriod && ts.breakAfterPeriod > 0) {
    breaks.add(ts.breakAfterPeriod);
  }
  return breaks;
}

export function getPeriodsPerDay(ts: Partial<TimeSettings>): number {
  return ts.periodsPerDay || 8;
}
