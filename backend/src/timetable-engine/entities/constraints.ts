import {
  ExpandedLesson,
  TimetableState,
  TimeslotEntity,
  TeacherEntity,
  ClassEntity,
  RoomEntity,
  ScheduleEntry,
} from './index';
import { PreprocessedData } from './preprocessor';
import { parseTimeslotKey } from './index';

export interface ConstraintViolation {
  type: 'hard' | 'soft';
  code: string;
  message: string;
  penalty: number;
  lessonId?: string;
  timeslotId?: string;
}

export interface ConstraintContext {
  data: PreprocessedData;
  teachers: Map<string, TeacherEntity>;
  classes: Map<string, ClassEntity>;
  rooms: Map<string, RoomEntity>;
  timeslots: TimeslotEntity[];
}

export function createConstraintContext(
  data: PreprocessedData,
  teachers: TeacherEntity[],
  classes: ClassEntity[],
  rooms: RoomEntity[],
  timeslots: TimeslotEntity[]
): ConstraintContext {
  return {
    data,
    teachers: new Map(teachers.map(t => [t.id, t])),
    classes: new Map(classes.map(c => [c.id, c])),
    rooms: new Map(rooms.map(r => [r.id, r])),
    timeslots,
  };
}

export function noTeacherClash(
  state: TimetableState,
  lesson: ExpandedLesson,
  timeslotId: string,
  context: ConstraintContext
): boolean {
  return !state.hasTeacherConflict(lesson.teacherId, timeslotId);
}

export function noClassClash(
  state: TimetableState,
  lesson: ExpandedLesson,
  timeslotId: string,
  context: ConstraintContext
): boolean {
  return !state.hasClassConflict(lesson.classId, timeslotId);
}

export function noRoomClash(
  state: TimetableState,
  timeslotId: string,
  roomId: string,
  context: ConstraintContext
): boolean {
  return !state.hasRoomConflict(roomId, timeslotId);
}

export function isTeacherAvailable(
  lesson: ExpandedLesson,
  timeslotId: string,
  context: ConstraintContext
): boolean {
  const availability = context.data.teacherAvailability.get(lesson.teacherId);
  return availability ? availability.has(timeslotId) : true;
}

export function isNotBreakPeriod(
  timeslotId: string,
  context: ConstraintContext
): boolean {
  const ts = context.timeslots.find(t => t.id === timeslotId);
  return ts ? !ts.isBreak : false;
}

export function teacherMaxLessonsPerDay(
  state: TimetableState,
  lesson: ExpandedLesson,
  timeslotId: string,
  context: ConstraintContext
): boolean {
  const parsed = parseTimeslotKey(timeslotId);
  if (!parsed) return true;

  const teacher = context.teachers.get(lesson.teacherId);
  const maxPerDay = teacher?.maxLessonsPerDay || 5;

  const teacherLessons = state.schedule.filter(entry => {
    const entryParsed = parseTimeslotKey(entry.timeslotId);
    return entry.lessonId.startsWith(lesson.teacherId) && entryParsed?.day === parsed.day;
  });

  return teacherLessons.length < maxPerDay;
}

export function classMaxLessonsPerDay(
  state: TimetableState,
  lesson: ExpandedLesson,
  timeslotId: string,
  context: ConstraintContext
): boolean {
  const parsed = parseTimeslotKey(timeslotId);
  if (!parsed) return true;

  const maxPerDay = 6;
  const classLessons = state.schedule.filter(entry => {
    const entryParsed = parseTimeslotKey(entry.timeslotId);
    return entry.lessonId.startsWith(lesson.classId) && entryParsed?.day === parsed.day;
  });

  return classLessons.length < maxPerDay;
}

export function canPlaceLesson(
  state: TimetableState,
  lesson: ExpandedLesson,
  timeslotId: string,
  roomId: string | undefined,
  context: ConstraintContext
): { valid: boolean; violations: ConstraintViolation[] } {
  const violations: ConstraintViolation[] = [];

  if (!noTeacherClash(state, lesson, timeslotId, context)) {
    violations.push({
      type: 'hard',
      code: 'TEACHER_CLASH',
      message: `Teacher ${lesson.teacherId} already has class at ${timeslotId}`,
      penalty: 0,
      lessonId: lesson.instanceId,
      timeslotId,
    });
  }

  if (!noClassClash(state, lesson, timeslotId, context)) {
    violations.push({
      type: 'hard',
      code: 'CLASS_CLASH',
      message: `Class ${lesson.classId} already has class at ${timeslotId}`,
      penalty: 0,
      lessonId: lesson.instanceId,
      timeslotId,
    });
  }

  if (roomId && !noRoomClash(state, timeslotId, roomId, context)) {
    violations.push({
      type: 'hard',
      code: 'ROOM_CLASH',
      message: `Room ${roomId} already occupied at ${timeslotId}`,
      penalty: 0,
      lessonId: lesson.instanceId,
      timeslotId,
    });
  }

  if (!isNotBreakPeriod(timeslotId, context)) {
    violations.push({
      type: 'hard',
      code: 'BREAK_PERIOD',
      message: `${timeslotId} is a break period`,
      penalty: 0,
      lessonId: lesson.instanceId,
      timeslotId,
    });
  }

  if (!isTeacherAvailable(lesson, timeslotId, context)) {
    violations.push({
      type: 'hard',
      code: 'TEACHER_UNAVAILABLE',
      message: `Teacher ${lesson.teacherId} unavailable at ${timeslotId}`,
      penalty: 0,
      lessonId: lesson.instanceId,
      timeslotId,
    });
  }

  return {
    valid: violations.filter(v => v.type === 'hard').length === 0,
    violations,
  };
}

export function hasHardConstraints(
  state: TimetableState,
  lesson: ExpandedLesson,
  timeslotId: string,
  roomId: string | undefined,
  context: ConstraintContext
): boolean {
  return canPlaceLesson(state, lesson, timeslotId, roomId, context).valid;
}

export function scoreSoftConstraints(
  state: TimetableState,
  lesson: ExpandedLesson,
  timeslotId: string,
  context: ConstraintContext
): number {
  let score = 0;

  const parsed = parseTimeslotKey(timeslotId);
  if (!parsed) return 0;

  const teacher = context.teachers.get(lesson.teacherId);
  if (teacher?.preferences?.preferredDays?.includes(parsed.day)) {
    score += 10;
  }

  const sameDayLessons = state.schedule.filter(entry => {
    const entryParsed = parseTimeslotKey(entry.timeslotId);
    return entry.lessonId.startsWith(lesson.subjectId) && entryParsed?.day === parsed.day;
  });

  if (sameDayLessons.length > 0) {
    score += 8;
  }

  if (parsed.period <= 3) {
    score += 5;
  } else if (parsed.period >= 7) {
    score -= 2;
  }

  return score;
}

export function scoreSchedule(state: TimetableState, context: ConstraintContext): number {
  let score = 1000;

  for (const entry of state.schedule) {
    const parsed = parseTimeslotKey(entry.timeslotId);
    if (!parsed) continue;

    const lessonId = entry.lessonId.replace(/_(\d+)$/, '');
    const lessons = context.data.lessons.filter(l => l.instanceId === entry.lessonId);
    if (lessons.length === 0) continue;

    const lesson = lessons[0];
    score += scoreSoftConstraints(state, lesson, entry.timeslotId, context);

    const teacherLessons = state.schedule.filter(e => {
      const p = parseTimeslotKey(e.timeslotId);
      return e.lessonId.startsWith(lesson.teacherId) && p?.day === parsed.day;
    });

    if (teacherLessons.length > 3) {
      score -= (teacherLessons.length - 3) * 5;
    }
  }

  return score;
}
