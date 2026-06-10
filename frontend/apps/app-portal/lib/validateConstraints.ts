export interface ConstraintViolation {
  type: "error" | "warning";
  code: string;
  message: string;
  day?: number;
  period?: number;
  teacherId?: string;
  subjectId?: string;
  subjectName?: string;
}

interface SlotData {
  id?: string;
  day: number;
  period: number;
  subject?: { id?: string; name: string };
  teacher?: { id?: string; user?: { username?: string; firstName?: string; lastName?: string } };
  classGroup?: { id?: string; name: string };
}

interface TeacherConstraintConfig {
  maxSubjectPerDay: number;
  maxLessonsPerTeacherPerDay: number;
  maxConsecutivePeriods: number;
}

export function validateSlotConstraints(
  slots: SlotData[],
  teacherConstraints: Record<string, TeacherConstraintConfig>
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const teacherDaySubjectCount: Record<string, Record<number, Record<string, number>>> = {};
  const teacherDayLessonCount: Record<string, Record<number, number>> = {};
  const teacherDayPeriods: Record<string, Record<number, number[]>> = {};

  for (const slot of slots) {
    const tId = slot.teacher?.id;
    const sId = slot.subject?.id || slot.subject?.name;
    if (!tId || !sId) continue;

    if (!teacherDaySubjectCount[tId]) teacherDaySubjectCount[tId] = {};
    if (!teacherDaySubjectCount[tId][slot.day]) teacherDaySubjectCount[tId][slot.day] = {};
    teacherDaySubjectCount[tId][slot.day][sId] = (teacherDaySubjectCount[tId][slot.day][sId] || 0) + 1;

    if (!teacherDayLessonCount[tId]) teacherDayLessonCount[tId] = {};
    teacherDayLessonCount[tId][slot.day] = (teacherDayLessonCount[tId][slot.day] || 0) + 1;

    if (!teacherDayPeriods[tId]) teacherDayPeriods[tId] = {};
    if (!teacherDayPeriods[tId][slot.day]) teacherDayPeriods[tId][slot.day] = [];
    teacherDayPeriods[tId][slot.day].push(slot.period);
  }

  for (const [tId, days] of Object.entries(teacherDaySubjectCount)) {
    const tc = teacherConstraints[tId];
    if (!tc || tc.maxSubjectPerDay <= 0) continue;

    for (const [dayStr, subjects] of Object.entries(days)) {
      for (const [sId, count] of Object.entries(subjects)) {
        if (count > tc.maxSubjectPerDay) {
          const subjectName = slots.find(
            (s) => s.teacher?.id === tId && (s.subject?.id === sId || s.subject?.name === sId)
          )?.subject?.name || sId;

          violations.push({
            type: "warning",
            code: "MAX_SUBJECT_PER_DAY",
            message: `Subject "${subjectName}" appears ${count} times on day ${parseInt(dayStr) + 1} (max: ${tc.maxSubjectPerDay})`,
            day: parseInt(dayStr),
            teacherId: tId,
            subjectId: sId,
            subjectName,
          });
        }
      }
    }
  }

  for (const [tId, days] of Object.entries(teacherDayLessonCount)) {
    const tc = teacherConstraints[tId];
    if (!tc || tc.maxLessonsPerTeacherPerDay <= 0) continue;

    for (const [dayStr, count] of Object.entries(days)) {
      if (count > tc.maxLessonsPerTeacherPerDay) {
        violations.push({
          type: "warning",
          code: "MAX_LESSONS_PER_DAY",
          message: `Teacher has ${count} lessons on day ${parseInt(dayStr) + 1} (max: ${tc.maxLessonsPerTeacherPerDay})`,
          day: parseInt(dayStr),
          teacherId: tId,
        });
      }
    }
  }

  for (const [tId, days] of Object.entries(teacherDayPeriods)) {
    const tc = teacherConstraints[tId];
    if (!tc || tc.maxConsecutivePeriods <= 0) continue;

    for (const [dayStr, periods] of Object.entries(days)) {
      const sorted = [...periods].sort((a, b) => a - b);
      let maxConsecutive = 1;
      let current = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
          current++;
          maxConsecutive = Math.max(maxConsecutive, current);
        } else {
          current = 1;
        }
      }
      if (maxConsecutive > tc.maxConsecutivePeriods) {
        violations.push({
          type: "warning",
          code: "MAX_CONSECUTIVE",
          message: `Teacher has ${maxConsecutive} consecutive periods on day ${parseInt(dayStr) + 1} (max: ${tc.maxConsecutivePeriods})`,
          day: parseInt(dayStr),
          teacherId: tId,
        });
      }
    }
  }

  return violations;
}
