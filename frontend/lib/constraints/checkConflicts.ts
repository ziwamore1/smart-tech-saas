import type { Lesson, Teacher, TimeSettings, TimeOffSchedule, TeacherConstraints } from "@/types/timetable";

export type ConflictType =
  | "teacher-double-booked"
  | "teacher-unavailable"
  | "teacher-max-consecutive"
  | "teacher-max-gaps"
  | "teacher-max-days"
  | "teacher-max-lessons"
  | "teacher-max-subject-per-day"
  | "teacher-max-lessons-per-day"
  | "classroom-double-booked"
  | "class-double-booked"
  | "lesson-overload";

export interface Conflict {
  type: ConflictType;
  severity: "error" | "warning";
  message: string;
  lessonId?: string;
  day?: number;
  period?: number;
  teacherId?: string;
  classroomId?: string;
  classId?: string;
}

export interface TimetableAssignment {
  lessonId: string;
  teacherId: string;
  classId: string;
  classroomId?: string;
  day: number;
  period: number;
}

export function checkConflicts(
  assignments: TimetableAssignment[],
  teachers: Teacher[],
  lessons: Lesson[],
  settings: TimeSettings,
  timeOffSchedule?: TimeOffSchedule,
  teacherConstraintsMap?: Record<string, TeacherConstraints>,
): Conflict[] {
  const conflicts: Conflict[] = [];

  const teacherSlots: Record<string, string[]> = {};
  const classroomSlots: Record<string, string[]> = {};
  const classSlots: Record<string, string[]> = {};
  const teacherDayPeriods: Record<string, Record<number, number[]>> = {};

  const lessonSubjectMap: Record<string, string> = {};
  for (const lesson of lessons) {
    if (lesson.id) lessonSubjectMap[lesson.id] = lesson.subjectId;
  }

  for (const a of assignments) {
    const slotKey = `${a.day}-${a.period}`;

    if (!teacherSlots[a.teacherId]) teacherSlots[a.teacherId] = [];
    if (teacherSlots[a.teacherId].includes(slotKey)) {
      conflicts.push({
        type: "teacher-double-booked",
        severity: "error",
        message: `Teacher ${a.teacherId} is assigned to multiple classes on day ${a.day}, period ${a.period}`,
        lessonId: a.lessonId,
        teacherId: a.teacherId,
        day: a.day,
        period: a.period,
      });
    }
    teacherSlots[a.teacherId].push(slotKey);

    if (a.classroomId) {
      if (!classroomSlots[a.classroomId]) classroomSlots[a.classroomId] = [];
      if (classroomSlots[a.classroomId].includes(slotKey)) {
        conflicts.push({
          type: "classroom-double-booked",
          severity: "error",
          message: `Classroom ${a.classroomId} is double-booked on day ${a.day}, period ${a.period}`,
          lessonId: a.lessonId,
          classroomId: a.classroomId,
          day: a.day,
          period: a.period,
        });
      }
      classroomSlots[a.classroomId].push(slotKey);
    }

    if (!classSlots[a.classId]) classSlots[a.classId] = [];
    if (classSlots[a.classId].includes(slotKey)) {
      conflicts.push({
        type: "class-double-booked",
        severity: "error",
        message: `Class ${a.classId} has overlapping lessons on day ${a.day}, period ${a.period}`,
        lessonId: a.lessonId,
        classId: a.classId,
        day: a.day,
        period: a.period,
      });
    }
    classSlots[a.classId].push(slotKey);

    if (!teacherDayPeriods[a.teacherId]) teacherDayPeriods[a.teacherId] = {};
    if (!teacherDayPeriods[a.teacherId][a.day]) teacherDayPeriods[a.teacherId][a.day] = [];
    teacherDayPeriods[a.teacherId][a.day].push(a.period);
  }

  const teacherDaySubjectCount: Record<string, Record<number, Record<string, number>>> = {};
  for (const a of assignments) {
    const subjectId = lessonSubjectMap[a.lessonId];
    if (!subjectId) continue;
    if (!teacherDaySubjectCount[a.teacherId]) teacherDaySubjectCount[a.teacherId] = {};
    if (!teacherDaySubjectCount[a.teacherId][a.day]) teacherDaySubjectCount[a.teacherId][a.day] = {};
    teacherDaySubjectCount[a.teacherId][a.day][subjectId] = (teacherDaySubjectCount[a.teacherId][a.day][subjectId] || 0) + 1;
  }
  for (const [teacherId, days] of Object.entries(teacherDaySubjectCount)) {
    const maxSubjectPerDay = teacherConstraintsMap?.[teacherId]?.maxSubjectPerDay;
    if (!maxSubjectPerDay || maxSubjectPerDay <= 0) continue;
    for (const [day, subjects] of Object.entries(days)) {
      for (const [subjectId, count] of Object.entries(subjects)) {
        if (count > maxSubjectPerDay) {
          conflicts.push({
            type: "teacher-max-subject-per-day",
            severity: "warning",
            message: `Teacher ${teacherId} teaches subject ${subjectId} ${count} times on day ${day} (max: ${maxSubjectPerDay} per day)`,
            teacherId,
            day: parseInt(day),
          });
        }
      }
    }
  }

  const teacherDayCount: Record<string, Record<number, number>> = {};
  for (const a of assignments) {
    if (!teacherDayCount[a.teacherId]) teacherDayCount[a.teacherId] = {};
    teacherDayCount[a.teacherId][a.day] = (teacherDayCount[a.teacherId][a.day] || 0) + 1;
  }
  for (const [teacherId, days] of Object.entries(teacherDayCount)) {
    const maxLessonsPerDay = teacherConstraintsMap?.[teacherId]?.maxLessonsPerTeacherPerDay;
    if (!maxLessonsPerDay || maxLessonsPerDay <= 0) continue;
    for (const [day, count] of Object.entries(days)) {
      if (count > maxLessonsPerDay) {
        conflicts.push({
          type: "teacher-max-lessons-per-day",
          severity: "warning",
          message: `Teacher ${teacherId} has ${count} lessons on day ${day} (max: ${maxLessonsPerDay} per day)`,
          teacherId,
          day: parseInt(day),
        });
      }
    }
  }

  for (const [teacherId, dayPeriods] of Object.entries(teacherDayPeriods)) {
    for (const [day, periods] of Object.entries(dayPeriods)) {
      const d = parseInt(day);
      const sorted = [...periods].sort((a, b) => a - b);

      let maxConsecutive = 1;
      let currentConsecutive = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
          currentConsecutive++;
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
          currentConsecutive = 1;
        }
      }

      const constraints = teacherConstraintsMap?.[teacherId];
      if (constraints?.maxConsecutivePeriods && maxConsecutive > constraints.maxConsecutivePeriods) {
        conflicts.push({
          type: "teacher-max-consecutive",
          severity: "warning",
          message: `Teacher ${teacherId} has ${maxConsecutive} consecutive periods on day ${d} (max: ${constraints.maxConsecutivePeriods})`,
          teacherId,
          day: d,
        });
      }
    }

    const totalDays = Object.keys(dayPeriods).length;
    const constraints = teacherConstraintsMap?.[teacherId];
    if (constraints?.maxDaysPerWeek && totalDays > constraints.maxDaysPerWeek) {
      conflicts.push({
        type: "teacher-max-days",
        severity: "warning",
        message: `Teacher ${teacherId} teaches on ${totalDays} days (max: ${constraints.maxDaysPerWeek})`,
        teacherId,
      });
    }
  }

  if (timeOffSchedule) {
    for (const a of assignments) {
      const teacherTimeOff = timeOffSchedule[a.teacherId];
      if (teacherTimeOff) {
        const dayKey = String(a.day);
        const periodKey = String(a.period);
        if (teacherTimeOff[dayKey]?.[periodKey] === "unavailable") {
          conflicts.push({
            type: "teacher-unavailable",
            severity: "error",
            message: `Teacher ${a.teacherId} is unavailable on day ${a.day}, period ${a.period}`,
            lessonId: a.lessonId,
            teacherId: a.teacherId,
            day: a.day,
            period: a.period,
          });
        }
      }
    }
  }

  return conflicts;
}

export function validateAssignments(
  assignments: TimetableAssignment[],
  lessons: Lesson[],
  settings: TimeSettings
): Conflict[] {
  const conflicts: Conflict[] = [];
  const totalSlots = settings.daysPerWeek * settings.periodsPerDay;

  const lessonAssignments: Record<string, number> = {};
  for (const a of assignments) {
    lessonAssignments[a.lessonId] = (lessonAssignments[a.lessonId] || 0) + 1;
  }

  for (const lesson of lessons) {
    const assigned = lessonAssignments[lesson.id || ""] || 0;
    if (assigned > totalSlots) {
      conflicts.push({
        type: "lesson-overload",
        severity: "warning",
        message: `Lesson ${lesson.id} requires ${lesson.lessonsPerWeek}/week but has ${assigned} slots assigned`,
        lessonId: lesson.id,
      });
    }
  }

  return conflicts;
}
