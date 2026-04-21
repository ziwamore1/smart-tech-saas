export type LessonRequirement = {
  classId: string;
  subjectId: string;
  teacherId: string;
  lessonsPerWeek: number;
};

export type Lesson = {
  classId: string;
  subjectId: string;
  teacherId: string;
};

export type Slot = {
  day: number;
  period: number;
};

export type TimetableSlot = {
  day: number;
  period: number;
  classId: string;
  subjectId: string;
  teacherId: string;
  classroomId?: string;
};

export type ConstraintContext = {
  days: number;
  periods: number;
  breakPeriods: Slot[];
};
