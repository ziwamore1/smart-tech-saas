import type { Lesson, Teacher, Classroom, TimeSettings, TimeOffSchedule, TeacherConstraints } from "@/types/timetable";
import type { TimetableAssignment } from "./constraints/checkConflicts";
import { checkConflicts } from "./constraints/checkConflicts";

const BLOCK_SIZES: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  quadruple: 4,
  quintuple: 5,
  sextuple: 6,
  septuple: 7,
  octuple: 8,
};

function getBlockSize(lesson: Lesson): number {
  if (lesson.lessonType) {
    return BLOCK_SIZES[lesson.lessonType] || 1;
  }
  return 1;
}

function getBlockCount(lesson: Lesson, blockSize: number): number {
  if (lesson.lessonCount && lesson.lessonCount > 0) {
    return lesson.lessonCount;
  }
  return Math.ceil((lesson.lessonsPerWeek || 1) / blockSize);
}

function buildBreakSet(settings: TimeSettings): Set<number> {
  const breaks = new Set<number>();
  for (const b of settings.breaks || []) {
    breaks.add(b.afterPeriod);
  }
  if (settings.breakAfterPeriod && settings.breakAfterPeriod > 0) {
    breaks.add(settings.breakAfterPeriod);
  }
  return breaks;
}

interface AutoAssignOptions {
  lessons: Lesson[];
  teachers: Teacher[];
  classrooms: Classroom[];
  settings: TimeSettings;
  timeOffSchedule?: TimeOffSchedule;
  teacherConstraints?: Record<string, TeacherConstraints>;
  onProgress?: (progress: number) => void;
}

interface AutoAssignResult {
  assignments: TimetableAssignment[];
  conflicts: import("./constraints/checkConflicts").Conflict[];
  unassigned: Lesson[];
}

export function autoAssign({
  lessons,
  teachers,
  classrooms,
  settings,
  timeOffSchedule,
  teacherConstraints,
  onProgress,
}: AutoAssignOptions): AutoAssignResult {
  const assignments: TimetableAssignment[] = [];
  const unassigned: Lesson[] = [];
  const breakPeriods = buildBreakSet(settings);

  const teacherLoad: Record<string, number> = {};
  const classroomLoad: Record<string, number> = {};
  for (const t of teachers) teacherLoad[t.id] = 0;
  for (const c of classrooms) classroomLoad[c.id] = 0;

  const teacherDayPeriods: Record<string, Set<string>> = {};
  for (const t of teachers) teacherDayPeriods[t.id] = new Set();

  const teacherDaySubjectCount: Record<string, Record<number, Record<string, number>>> = {};
  const teacherDayLessonCount: Record<string, Record<number, number>> = {};

  const classDayPeriods: Record<string, Set<string>> = {};
  for (const l of lessons) {
    classDayPeriods[l.classId] = classDayPeriods[l.classId] || new Set();
  }

  const sortedLessons = [...lessons].sort((a, b) => {
    const aBlocks = getBlockCount(a, getBlockSize(a));
    const bBlocks = getBlockCount(b, getBlockSize(b));
    return bBlocks * getBlockSize(b) - aBlocks * getBlockSize(a);
  });
  const totalLessons = sortedLessons.length;

  function isBreakBetween(p1: number, p2: number): boolean {
    for (let p = p1; p < p2; p++) {
      if (breakPeriods.has(p)) return true;
    }
    return false;
  }

  function periodsAvailable(day: number, startPeriod: number, count: number, tch: Teacher, les: Lesson): boolean {
    for (let offset = 0; offset < count; offset++) {
      const p = startPeriod + offset;
      if (p > settings.periodsPerDay) return false;
      const slotKey = `${day}-${p}`;
      if (teacherDayPeriods[tch.id]?.has(slotKey)) return false;
      if (classDayPeriods[les.classId]?.has(slotKey)) return false;
      if (timeOffSchedule?.[tch.id]) {
        const dayKey = String(day);
        const periodKey = String(p);
        if (timeOffSchedule[tch.id]?.[dayKey]?.[periodKey] === "unavailable") return false;
      }
    }
    return true;
  }

  for (let i = 0; i < sortedLessons.length; i++) {
    const lesson = sortedLessons[i];
    const teacher = teachers.find((t) => t.id === lesson.teacherId);
    if (!teacher) {
      unassigned.push(lesson);
      continue;
    }

    const blockSize = getBlockSize(lesson);
    const targetBlocks = getBlockCount(lesson, blockSize);
    let assignedBlocks = 0;

    for (let day = 0; day < settings.daysPerWeek && assignedBlocks < targetBlocks; day++) {
      for (let startPeriod = 0; startPeriod <= settings.periodsPerDay - blockSize && assignedBlocks < targetBlocks; startPeriod++) {
        const endPeriod = startPeriod + blockSize - 1;

        if (isBreakBetween(startPeriod, endPeriod)) continue;

        if (!periodsAvailable(day, startPeriod, blockSize, teacher, lesson)) continue;

        const teacherMaxSubject = teacherConstraints?.[teacher.id]?.maxSubjectPerDay;
        if (teacherMaxSubject && teacherMaxSubject > 0) {
          const currentSubjectCount = teacherDaySubjectCount[teacher.id]?.[day]?.[lesson.subjectId] || 0;
          if (currentSubjectCount + blockSize > teacherMaxSubject) continue;
        }

        const teacherMaxLessons = teacherConstraints?.[teacher.id]?.maxLessonsPerTeacherPerDay;
        if (teacherMaxLessons && teacherMaxLessons > 0) {
          const currentLessonCount = teacherDayLessonCount[teacher.id]?.[day] || 0;
          if (currentLessonCount + blockSize > teacherMaxLessons) continue;
        }

        const tempAssignments: TimetableAssignment[] = [];
        let classroomForBlock: Classroom | null = null;

        if (classrooms.length > 0) {
          classroomForBlock = classrooms.reduce((best, c) => {
            const load = classroomLoad[c.id] || 0;
            const bestLoad = best ? classroomLoad[best.id] || 0 : Infinity;
            return load < bestLoad ? c : best;
          }, null as Classroom | null);
        }

        for (let offset = 0; offset < blockSize; offset++) {
          const p = startPeriod + offset;
          tempAssignments.push({
            lessonId: lesson.id || `temp-${i}-${assignedBlocks}-${offset}`,
            teacherId: teacher.id,
            classId: lesson.classId,
            classroomId: classroomForBlock?.id,
            day,
            period: p,
          });
        }

        const testAssignments = [...assignments, ...tempAssignments];
        const conflicts = checkConflicts(testAssignments, teachers, lessons, settings, timeOffSchedule, teacherConstraints);
        const hasBlockingConflict = conflicts.some((c) => c.severity === "error");

        if (hasBlockingConflict) continue;

        for (const ta of tempAssignments) {
          assignments.push(ta);
          const slotKey = `${ta.day}-${ta.period}`;
          teacherDayPeriods[teacher.id].add(slotKey);
          classDayPeriods[lesson.classId].add(slotKey);
          teacherLoad[teacher.id]++;
          if (ta.classroomId) classroomLoad[ta.classroomId]++;

          if (!teacherDaySubjectCount[teacher.id]) teacherDaySubjectCount[teacher.id] = {};
          if (!teacherDaySubjectCount[teacher.id][ta.day]) teacherDaySubjectCount[teacher.id][ta.day] = {};
          teacherDaySubjectCount[teacher.id][ta.day][lesson.subjectId] = (teacherDaySubjectCount[teacher.id][ta.day][lesson.subjectId] || 0) + 1;

          if (!teacherDayLessonCount[teacher.id]) teacherDayLessonCount[teacher.id] = {};
          teacherDayLessonCount[teacher.id][ta.day] = (teacherDayLessonCount[teacher.id][ta.day] || 0) + 1;
        }
        assignedBlocks++;
      }
    }

    if (assignedBlocks < targetBlocks) {
      unassigned.push(lesson);
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalLessons) * 100));
    }
  }

  const conflicts = checkConflicts(assignments, teachers, lessons, settings, timeOffSchedule, teacherConstraints);

  return { assignments, conflicts, unassigned };
}

export function suggestAssignments(
  lesson: Lesson,
  teachers: Teacher[],
  classrooms: Classroom[],
  settings: TimeSettings,
  existingAssignments: TimetableAssignment[],
  timeOffSchedule?: TimeOffSchedule
): TimetableAssignment[] {
  const suggestions: TimetableAssignment[] = [];
  const teacher = teachers.find((t) => t.id === lesson.teacherId);
  if (!teacher) return suggestions;

  const blockSize = getBlockSize(lesson);
  const targetBlocks = getBlockCount(lesson, blockSize);
  const breakPeriods = buildBreakSet(settings);

  const teacherSlots = new Set<string>();
  const classSlots = new Set<string>();
  for (const a of existingAssignments) {
    if (a.teacherId === teacher.id) teacherSlots.add(`${a.day}-${a.period}`);
    if (a.classId === lesson.classId) classSlots.add(`${a.day}-${a.period}`);
  }

  function isBreakBetween(p1: number, p2: number): boolean {
    for (let p = p1; p < p2; p++) {
      if (breakPeriods.has(p)) return true;
    }
    return false;
  }

  for (let day = 0; day < settings.daysPerWeek; day++) {
    for (let sp = 0; sp <= settings.periodsPerDay - blockSize; sp++) {
      const ep = sp + blockSize - 1;
      if (isBreakBetween(sp, ep)) continue;

      let available = true;
      for (let offset = 0; offset < blockSize; offset++) {
        const p = sp + offset;
        const slotKey = `${day}-${p}`;
        if (teacherSlots.has(slotKey) || classSlots.has(slotKey)) {
          available = false;
          break;
        }
        if (timeOffSchedule?.[teacher.id]) {
          const dayKey = String(day);
          const periodKey = String(p);
          if (timeOffSchedule[teacher.id]?.[dayKey]?.[periodKey] === "unavailable") {
            available = false;
            break;
          }
        }
      }
      if (!available) continue;

      for (let offset = 0; offset < blockSize; offset++) {
        suggestions.push({
          lessonId: lesson.id || "",
          teacherId: teacher.id,
          classId: lesson.classId,
          classroomId: classrooms[0]?.id,
          day,
          period: sp + offset,
        });
      }

      if (suggestions.length >= blockSize * 5) break;
    }
    if (suggestions.length >= blockSize * 5) break;
  }

  return suggestions.slice(0, blockSize * 5);
}
