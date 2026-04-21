export class Timeslot {
  constructor(day: number, period: number) {
    this.day = day;
    this.period = period;
  }

  day: number;
  period: number;

  equals(other: Timeslot): boolean {
    return this.day === other.day && this.period === other.period;
  }

  toString(): string {
    return `D${this.day}P${this.period}`;
  }

  toKey(): string {
    return `${this.day}-${this.period}`;
  }
}

export class Room {
  constructor(id: string, name: string, capacity: number = 30, type: string = 'regular') {
    this.id = id;
    this.name = name;
    this.capacity = capacity;
    this.type = type;
    this.blockedSlots = [];
  }

  id: string;
  name: string;
  capacity: number;
  type: string;
  blockedSlots: Timeslot[];
}

export class Teacher {
  constructor(id: string, name: string, employeeNo: string, subjects: string[] = []) {
    this.id = id;
    this.name = name;
    this.employeeNo = employeeNo;
    this.subjects = subjects;
    this.maxLessonsPerDay = 5;
    this.maxConsecutiveLessons = 3;
    this.preferredDays = [1, 2, 3, 4, 5];
    this.unavailableSlots = [];
  }

  id: string;
  name: string;
  employeeNo: string;
  subjects: string[];
  maxLessonsPerDay: number;
  maxConsecutiveLessons: number;
  preferredDays: number[];
  unavailableSlots: Timeslot[];
}

export class Class {
  constructor(id: string, name: string, capacity: number = 30) {
    this.id = id;
    this.name = name;
    this.capacity = capacity;
    this.maxLessonsPerDay = 6;
    this.blockedSlots = [];
  }

  id: string;
  name: string;
  capacity: number;
  maxLessonsPerDay: number;
  blockedSlots: Timeslot[];
}

export class Subject {
  constructor(id: string, name: string, code: string) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.requiresLab = false;
    this.doublePeriod = false;
    this.minDaysBetween = 1;
  }

  id: string;
  name: string;
  code: string;
  requiresLab: boolean;
  doublePeriod: boolean;
  minDaysBetween: number;
}

export class Lesson {
  constructor(classId: string, subjectId: string, teacherId: string) {
    this.id = `${classId}-${subjectId}-${teacherId}`;
    this.classId = classId;
    this.subjectId = subjectId;
    this.teacherId = teacherId;
    this.timeslot = null;
    this.roomId = null;
  }

  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  timeslot: Timeslot | null;
  roomId: string | null;

  assign(timeslot: Timeslot, roomId?: string): void {
    this.timeslot = timeslot;
    this.roomId = roomId || null;
  }

  isAssigned(): boolean {
    return this.timeslot !== null;
  }

  getKey(): string {
    return `${this.classId}-${this.subjectId}-${this.teacherId}`;
  }
}

export class ScheduledLesson {
  constructor(lesson: Lesson, timeslot: Timeslot, roomId?: string) {
    this.lesson = lesson;
    this.timeslot = timeslot;
    this.roomId = roomId;
  }

  lesson: Lesson;
  timeslot: Timeslot;
  roomId?: string;

  toKey(): string {
    return this.timeslot.toKey();
  }
}

export class TimetableSchedule {
  constructor() {
    this.slots = [];
    this.lessonMap = new Map();
    this.timeslotMap = new Map();
  }

  slots: ScheduledLesson[];
  lessonMap: Map<string, ScheduledLesson>;
  timeslotMap: Map<string, ScheduledLesson>;

  add(scheduled: ScheduledLesson): void {
    this.slots.push(scheduled);
    this.lessonMap.set(scheduled.lesson.id, scheduled);
    this.timeslotMap.set(scheduled.timeslot.toKey(), scheduled);
  }

  remove(lessonId: string): ScheduledLesson | null {
    const scheduled = this.lessonMap.get(lessonId);
    if (scheduled) {
      this.slots = this.slots.filter(s => s.lesson.id !== lessonId);
      this.lessonMap.delete(lessonId);
      this.timeslotMap.delete(scheduled.timeslot.toKey());
      return scheduled;
    }
    return null;
  }

  findByTimeslot(timeslot: Timeslot): ScheduledLesson | undefined {
    return this.timeslotMap.get(timeslot.toKey());
  }

  findByLesson(lessonId: string): ScheduledLesson | undefined {
    return this.lessonMap.get(lessonId);
  }

  hasTimeslotConflict(timeslot: Timeslot): boolean {
    return this.timeslotMap.has(timeslot.toKey());
  }

  hasTeacherConflict(teacherId: string, timeslot: Timeslot): boolean {
    return this.slots.some(
      s => s.lesson.teacherId === teacherId && s.timeslot.equals(timeslot)
    );
  }

  hasClassConflict(classId: string, timeslot: Timeslot): boolean {
    return this.slots.some(
      s => s.lesson.classId === classId && s.timeslot.equals(timeslot)
    );
  }

  hasRoomConflict(roomId: string, timeslot: Timeslot): boolean {
    return this.slots.some(s => s.roomId === roomId && s.timeslot.equals(timeslot));
  }

  getTeacherLessonsForDay(teacherId: string, day: number): ScheduledLesson[] {
    return this.slots.filter(
      s => s.lesson.teacherId === teacherId && s.timeslot.day === day
    );
  }

  getClassLessonsForDay(classId: string, day: number): ScheduledLesson[] {
    return this.slots.filter(
      s => s.lesson.classId === classId && s.timeslot.day === day
    );
  }

  getSubjectLessonsForClass(classId: string, subjectId: string): ScheduledLesson[] {
    return this.slots.filter(
      s => s.lesson.classId === classId && s.lesson.subjectId === subjectId
    );
  }

  clone(): TimetableSchedule {
    const newSchedule = new TimetableSchedule();
    for (const slot of this.slots) {
      newSchedule.add(new ScheduledLesson(
        slot.lesson,
        slot.timeslot,
        slot.roomId
      ));
    }
    return newSchedule;
  }
}

export class TimetableConfig {
  constructor(days: number = 5, periods: number = 8) {
    this.days = days;
    this.periods = periods;
    this.breakPeriods = [];
  }

  days: number;
  periods: number;
  breakPeriods: Timeslot[];
  teachers: Teacher[] = [];
  classes: Class[] = [];
  subjects: Subject[] = [];
  rooms: Room[] = [];

  generateTimeslots(): Timeslot[] {
    const timeslots: Timeslot[] = [];
    for (let day = 1; day <= this.days; day++) {
      for (let period = 1; period <= this.periods; period++) {
        const ts = new Timeslot(day, period);
        if (!this.isBreak(ts)) {
          timeslots.push(ts);
        }
      }
    }
    return timeslots;
  }

  isBreak(timeslot: Timeslot): boolean {
    return this.breakPeriods.some(b => b.equals(timeslot));
  }

  getAvailableTimeslots(): Timeslot[] {
    return this.generateTimeslots();
  }
}