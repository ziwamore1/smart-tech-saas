import { ExpandedLesson, TimeslotEntity, ScheduleEntry } from './index';

export class BitmaskState {
  constructor(numSlots: number = 40) {
    this.numSlots = numSlots;
    this.teacherBits = new Map<string, number>();
    this.classBits = new Map<string, number>();
    this.roomBits = new Map<string, number>();
    this.lessonBits = new Map<string, number>();
  }

  numSlots: number;
  teacherBits: Map<string, number>;
  classBits: Map<string, number>;
  roomBits: Map<string, number>;
  lessonBits: Map<string, number>;

  getSlotIndex(day: number, period: number): number {
    return (day - 1) * 8 + (period - 1);
  }

  isTeacherFree(teacherId: string, slotIndex: number): boolean {
    const mask = this.teacherBits.get(teacherId) || 0;
    return (mask & (1 << slotIndex)) === 0;
  }

  isClassFree(classId: string, slotIndex: number): boolean {
    const mask = this.classBits.get(classId) || 0;
    return (mask & (1 << slotIndex)) === 0;
  }

  isRoomFree(roomId: string, slotIndex: number): boolean {
    const mask = this.roomBits.get(roomId) || 0;
    return (mask & (1 << slotIndex)) === 0;
  }

  isLessonFree(lessonId: string, slotIndex: number): boolean {
    const mask = this.lessonBits.get(lessonId) || 0;
    return (mask & (1 << slotIndex)) === 0;
  }

  assignTeacher(teacherId: string, slotIndex: number): void {
    const current = this.teacherBits.get(teacherId) || 0;
    this.teacherBits.set(teacherId, current | (1 << slotIndex));
  }

  assignClass(classId: string, slotIndex: number): void {
    const current = this.classBits.get(classId) || 0;
    this.classBits.set(classId, current | (1 << slotIndex));
  }

  assignRoom(roomId: string, slotIndex: number): void {
    const current = this.roomBits.get(roomId) || 0;
    this.roomBits.set(roomId, current | (1 << slotIndex));
  }

  assignLesson(lessonId: string, slotIndex: number): void {
    const current = this.lessonBits.get(lessonId) || 0;
    this.lessonBits.set(lessonId, current | (1 << slotIndex));
  }

  unassignTeacher(teacherId: string, slotIndex: number): void {
    const current = this.teacherBits.get(teacherId) || 0;
    this.teacherBits.set(teacherId, current & ~(1 << slotIndex));
  }

  unassignClass(classId: string, slotIndex: number): void {
    const current = this.classBits.get(classId) || 0;
    this.classBits.set(classId, current & ~(1 << slotIndex));
  }

  unassignRoom(roomId: string, slotIndex: number): void {
    const current = this.roomBits.get(roomId) || 0;
    this.roomBits.set(roomId, current & ~(1 << slotIndex));
  }

  unassignLesson(lessonId: string, slotIndex: number): void {
    const current = this.lessonBits.get(lessonId) || 0;
    this.lessonBits.set(lessonId, current & ~(1 << slotIndex));
  }

  clone(): BitmaskState {
    const newState = new BitmaskState(this.numSlots);
    newState.teacherBits = new Map(this.teacherBits);
    newState.classBits = new Map(this.classBits);
    newState.roomBits = new Map(this.roomBits);
    newState.lessonBits = new Map(this.lessonBits);
    return newState;
  }

  getTeacherLessons(teacherId: string): number[] {
    const mask = this.teacherBits.get(teacherId) || 0;
    const slots: number[] = [];
    for (let i = 0; i < this.numSlots; i++) {
      if ((mask & (1 << i)) !== 0) {
        slots.push(i);
      }
    }
    return slots;
  }

  getClassLessons(classId: string): number[] {
    const mask = this.classBits.get(classId) || 0;
    const slots: number[] = [];
    for (let i = 0; i < this.numSlots; i++) {
      if ((mask & (1 << i)) !== 0) {
        slots.push(i);
      }
    }
    return slots;
  }

  getTeacherLessonsOnDay(teacherId: string, day: number): number {
    const mask = this.teacherBits.get(teacherId) || 0;
    const dayStart = (day - 1) * 8;
    let count = 0;
    for (let i = dayStart; i < dayStart + 8; i++) {
      if ((mask & (1 << i)) !== 0) count++;
    }
    return count;
  }

  getClassLessonsOnDay(classId: string, day: number): number {
    const mask = this.classBits.get(classId) || 0;
    const dayStart = (day - 1) * 8;
    let count = 0;
    for (let i = dayStart; i < dayStart + 8; i++) {
      if ((mask & (1 << i)) !== 0) count++;
    }
    return count;
  }

  toScheduleEntries(lessons: ExpandedLesson[], timeslots: TimeslotEntity[]): ScheduleEntry[] {
    const entries: ScheduleEntry[] = [];

    for (const [lessonKey, lessonMask] of this.lessonBits) {
      const lesson = lessons.find(l => l.instanceId === lessonKey);
      if (!lesson) continue;

      for (let slotIndex = 0; slotIndex < this.numSlots; slotIndex++) {
        if ((lessonMask & (1 << slotIndex)) !== 0) {
          const ts = timeslots[slotIndex];
          if (ts && !ts.isBreak) {
            entries.push({
              lessonId: lesson.instanceId,
              timeslotId: ts.id,
            });
            break;
          }
        }
      }
    }

    return entries;
  }
}

export class ConstraintMatrix {
  constructor(numSlots: number, numTeachers: number, numClasses: number) {
    this.numSlots = numSlots;
    this.numTeachers = numTeachers;
    this.numClasses = numClasses;
    
    this.teacherAvailability = new Map<string, number[]>();
    this.classAvailability = new Map<string, number[]>();
    this.teacherMaxPerDay = new Map<string, number>();
    this.classMaxPerDay = new Map<string, number>();
  }

  numSlots: number;
  numTeachers: number;
  numClasses: number;
  teacherAvailability: Map<string, number[]>;
  classAvailability: Map<string, number[]>;
  teacherMaxPerDay: Map<string, number>;
  classMaxPerDay: Map<string, number>;

  buildTeacherAvailability(teachers: { id: string; unavailableSlots?: string[] }[], timeslots: TimeslotEntity[]): void {
    for (const teacher of teachers) {
      const available: number[] = [];
      
      for (let i = 0; i < timeslots.length; i++) {
        const ts = timeslots[i];
        if (ts.isBreak) continue;
        
        const isUnavailable = teacher.unavailableSlots?.some(s => s === ts.id);
        if (!isUnavailable) {
          available.push(this.getSlotIndex(ts.day, ts.period));
        }
      }
      
      this.teacherAvailability.set(teacher.id, available);
      this.teacherMaxPerDay.set(teacher.id, teacher.maxLessonsPerDay || 5);
    }
  }

  buildClassAvailability(classes: { id: string; capacity?: number; maxLessonsPerDay?: number }[], timeslots: TimeslotEntity[]): void {
    for (const cls of classes) {
      const available: number[] = [];
      
      for (let i = 0; i < timeslots.length; i++) {
        const ts = timeslots[i];
        if (!ts.isBreak) {
          available.push(this.getSlotIndex(ts.day, ts.period));
        }
      }
      
      this.classAvailability.set(cls.id, available);
      this.classMaxPerDay.set(cls.id, cls.maxLessonsPerDay || 6);
    }
  }

  getSlotIndex(day: number, period: number): number {
    return (day - 1) * 8 + (period - 1);
  }

  isTeacherAvailable(teacherId: string, slotIndex: number): boolean {
    const available = this.teacherAvailability.get(teacherId);
    return available ? available.includes(slotIndex) : true;
  }

  isClassAvailable(classId: string, slotIndex: number): boolean {
    const available = this.classAvailability.get(classId);
    return available ? available.includes(slotIndex) : true;
  }

  canTeacherFitDay(teacherId: string, day: number, state: BitmaskState): boolean {
    const max = this.teacherMaxPerDay.get(teacherId) || 5;
    const current = state.getTeacherLessonsOnDay(teacherId, day);
    return current < max;
  }

  canClassFitDay(classId: string, day: number, state: BitmaskState): boolean {
    const max = this.classMaxPerDay.get(classId) || 6;
    const current = state.getClassLessonsOnDay(classId, day);
    return current < max;
  }

  getValidSlotsForLesson(
    lesson: ExpandedLesson,
    state: BitmaskState
  ): number[] {
    const valid: number[] = [];
    const teacherAvailable = this.teacherAvailability.get(lesson.teacherId);
    const classAvailable = this.classAvailability.get(lesson.classId);
    
    if (!teacherAvailable || !classAvailable) return valid;

    const commonAvailable = teacherAvailable.filter(
      (slotIndex, i) => classAvailable.includes(slotIndex)
    );

    for (const slotIndex of commonAvailable) {
      if (
        state.isTeacherFree(lesson.teacherId, slotIndex) &&
        state.isClassFree(lesson.classId, slotIndex)
      ) {
        const day = Math.floor(slotIndex / 8) + 1;
        if (
          this.canTeacherFitDay(lesson.teacherId, day, state) &&
          this.canClassFitDay(lesson.classId, day, state)
        ) {
          valid.push(slotIndex);
        }
      }
    }

    return valid;
  }
}

export { BitmaskState as FastState, ConstraintMatrix as Matrix };