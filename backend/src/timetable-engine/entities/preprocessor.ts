import {
  ClassEntity,
  TeacherEntity,
 SubjectEntity,
  RoomEntity,
  TimeslotEntity,
  LessonEntity,
  ExpandedLesson,
  TimetableState,
  TimetableInput,
  TimetableConfig,
  DEFAULT_TIMETABLE_CONFIG,
  generateTimeslots,
} from './index';

export interface PreprocessedData {
  lessons: ExpandedLesson[];
  timeslots: TimeslotEntity[];
  teacherLessonsMap: Map<string, ExpandedLesson[]>;
  classLessonsMap: Map<string, ExpandedLesson[]>;
  subjectLessonsMap: Map<string, ExpandedLesson[]>;
  teacherAvailability: Map<string, Set<string>>;
  timeslotIndex: Map<string, number>;
}

export function expandLessons(lessons: LessonEntity[]): ExpandedLesson[] {
  const expanded: ExpandedLesson[] = [];

  for (const lesson of lessons) {
    for (let i = 0; i < lesson.requiredPerWeek; i++) {
      expanded.push({
        instanceId: `${lesson.id}_${i}`,
        lessonId: lesson.id,
        classId: lesson.classId,
        subjectId: lesson.subjectId,
        teacherId: lesson.teacherId,
        requiredPerWeek: lesson.requiredPerWeek,
        instanceIndex: i,
      });
    }
  }

  return expanded;
}

export function buildTeacherLessonsMap(lessons: ExpandedLesson[]): Map<string, ExpandedLesson[]> {
  const map = new Map<string, ExpandedLesson[]>();

  for (const lesson of lessons) {
    const teacherId = lesson.teacherId;
    if (!map.has(teacherId)) {
      map.set(teacherId, []);
    }
    map.get(teacherId)!.push(lesson);
  }

  return map;
}

export function buildClassLessonsMap(lessons: ExpandedLesson[]): Map<string, ExpandedLesson[]> {
  const map = new Map<string, ExpandedLesson[]>();

  for (const lesson of lessons) {
    const classId = lesson.classId;
    if (!map.has(classId)) {
      map.set(classId, []);
    }
    map.get(classId)!.push(lesson);
  }

  return map;
}

export function buildSubjectLessonsMap(lessons: ExpandedLesson[]): Map<string, ExpandedLesson[]> {
  const map = new Map<string, ExpandedLesson[]>();

  for (const lesson of lessons) {
    const subjectId = lesson.subjectId;
    if (!map.has(subjectId)) {
      map.set(subjectId, []);
    }
    map.get(subjectId)!.push(lesson);
  }

  return map;
}

export function buildTeacherAvailability(
  teachers: TeacherEntity[],
  timeslots: TimeslotEntity[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const teacher of teachers) {
    if (!map.has(teacher.id)) {
      map.set(teacher.id, new Set());
    }

    for (const ts of timeslots) {
      if (!ts.isBreak) {
        map.get(teacher.id)!.add(ts.id);
      }
    }

    if (teacher.availability) {
      for (const slot of teacher.availability) {
        map.get(teacher.id)!.add(slot);
      }
    }

    if (teacher.preferences?.unavailableSlots) {
      for (const slot of teacher.preferences.unavailableSlots) {
        map.get(teacher.id)!.delete(slot);
      }
    }
  }

  return map;
}

export function buildTimeslotIndex(timeslots: TimeslotEntity[]): Map<string, number> {
  const index = new Map<string, number>();

  for (let i = 0; i < timeslots.length; i++) {
    index.set(timeslots[i].id, i);
  }

  return index;
}

export function precomputeData(input: TimetableInput, config: TimetableConfig = DEFAULT_TIMETABLE_CONFIG): PreprocessedData {
  const timeslots = input.timeslots || generateTimeslots(config);
  const lessons = expandLessons(input.lessons);

  return {
    lessons,
    timeslots,
    teacherLessonsMap: buildTeacherLessonsMap(lessons),
    classLessonsMap: buildClassLessonsMap(lessons),
    subjectLessonsMap: buildSubjectLessonsMap(lessons),
    teacherAvailability: buildTeacherAvailability(input.teachers, timeslots),
    timeslotIndex: buildTimeslotIndex(timeslots),
  };
}

export function validateInput(input: TimetableInput, config: TimetableConfig = DEFAULT_TIMETABLE_CONFIG): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const timeslots = input.timeslots || generateTimeslots(config);
  const totalSlots = timeslots.filter(t => !t.isBreak).length;

  const lessons = expandLessons(input.lessons);
  const totalLessons = lessons.length;

  if (totalLessons > totalSlots) {
    errors.push(
      `Impossible timetable: ${totalLessons} lessons required but only ${totalSlots} slots available`
    );
  }

  const teacherLoad = new Map<string, number>();
  for (const lesson of lessons) {
    const count = teacherLoad.get(lesson.teacherId) || 0;
    teacherLoad.set(lesson.teacherId, count + 1);
  }

  for (const [teacherId, count] of teacherLoad) {
    const teacher = input.teachers.find(t => t.id === teacherId);
    const maxPerDay = teacher?.maxLessonsPerDay || 5;
    const maxTotal = maxPerDay * config.days;

    if (count > maxTotal) {
      warnings.push(
        `Teacher ${teacherId} has ${count} lessons but max is ${maxTotal} (${config.days} days × ${maxPerDay})`
      );
    }
  }

  const classLoad = new Map<string, number>();
  for (const lesson of lessons) {
    const count = classLoad.get(lesson.classId) || 0;
    classLoad.set(lesson.classId, count + 1);
  }

  for (const [classId, count] of classLoad) {
    const cls = input.classes.find(c => c.id === classId);
    const maxPerDay = 6;
    const maxTotal = maxPerDay * config.days;

    if (count > maxTotal) {
      warnings.push(
        `Class ${classId} has ${count} lessons but max is ${maxTotal} (${config.days} days × ${maxPerDay})`
      );
    }
  }

  const uniqueTeachers = new Set(lessons.map(l => l.teacherId));
  const missingTeachers = uniqueTeachers.size === 0 
    ? [] 
    : input.teachers.filter(t => !uniqueTeachers.has(t.id)).map(t => t.id);

  if (missingTeachers.length > 0) {
    errors.push(`Missing teachers: ${missingTeachers.join(', ')}`);
  }

  const uniqueClasses = new Set(lessons.map(l => l.classId));
  const missingClasses = uniqueClasses.size === 0
    ? []
    : input.classes.filter(c => !uniqueClasses.has(c.id)).map(c => c.id);

  if (missingClasses.length > 0) {
    errors.push(`Missing classes: ${missingClasses.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getStatistics(input: TimetableInput): {
  totalClasses: number;
  totalTeachers: number;
  totalSubjects: number;
  totalRooms: number;
  totalLessons: number;
  totalSlots: number;
  averageLessonsPerClass: number;
  averageLessonsPerTeacher: number;
} {
  const lessons = expandLessons(input.lessons);
  const timeslots = input.timeslots || generateTimeslots(DEFAULT_TIMETABLE_CONFIG);
  const availableSlots = timeslots.filter(t => !t.isBreak).length;

  const classLessonCounts = new Map<string, number>();
  const teacherLessonCounts = new Map<string, number>();

  for (const lesson of lessons) {
    classLessonCounts.set(lesson.classId, (classLessonCounts.get(lesson.classId) || 0) + 1);
    teacherLessonCounts.set(lesson.teacherId, (teacherLessonCounts.get(lesson.teacherId) || 0) + 1);
  }

  const avgLessonsPerClass = classLessonCounts.size > 0
    ? [...classLessonCounts.values()].reduce((a, b) => a + b, 0) / classLessonCounts.size
    : 0;

  const avgLessonsPerTeacher = teacherLessonCounts.size > 0
    ? [...teacherLessonCounts.values()].reduce((a, b) => a + b, 0) / teacherLessonCounts.size
    : 0;

  return {
    totalClasses: input.classes.length,
    totalTeachers: input.teachers.length,
    totalSubjects: input.subjects.length,
    totalRooms: input.rooms.length,
    totalLessons: lessons.length,
    totalSlots: availableSlots,
    averageLessonsPerClass: Math.round(avgLessonsPerClass * 10) / 10,
    averageLessonsPerTeacher: Math.round(avgLessonsPerTeacher * 10) / 10,
  };
}