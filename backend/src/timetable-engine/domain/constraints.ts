import { 
  Lesson, 
  Timeslot, 
  Teacher, 
  Class, 
  Room, 
  ScheduledLesson, 
  TimetableSchedule,
  TimetableConfig 
} from './lesson';

export interface ConstraintViolation {
  type: 'hard' | 'soft';
  name: string;
  message: string;
  penalty: number;
}

export interface ConstraintContext {
  teachers: Map<string, Teacher>;
  classes: Map<string, Class>;
  rooms: Map<string, Room>;
  config: TimetableConfig;
}

export function createConstraintContext(
  teachers: Teacher[],
  classes: Class[],
  rooms: Room[],
  config: TimetableConfig
): ConstraintContext {
  return {
    teachers: new Map(teachers.map(t => [t.id, t])),
    classes: new Map(classes.map(c => [c.id, c])),
    rooms: new Map(rooms.map(r => [r.id, r])),
    config,
  };
}

export function noTeacherClash(
  schedule: TimetableSchedule, 
  lesson: Lesson, 
  timeslot: Timeslot,
  context: ConstraintContext
): boolean {
  return !schedule.hasTeacherConflict(lesson.teacherId, timeslot);
}

export function noClassClash(
  schedule: TimetableSchedule, 
  lesson: Lesson, 
  timeslot: Timeslot,
  context: ConstraintContext
): boolean {
  return !schedule.hasClassConflict(lesson.classId, timeslot);
}

export function noRoomClash(
  schedule: TimetableSchedule, 
  timeslot: Timeslot,
  roomId: string,
  context: ConstraintContext
): boolean {
  return !schedule.hasRoomConflict(roomId, timeslot);
}

export function isRoomAvailable(
  timeslot: Timeslot,
  roomId: string,
  context: ConstraintContext
): boolean {
  const room = context.rooms.get(roomId);
  if (!room) return false;
  return !room.blockedSlots.some(b => b.equals(timeslot));
}

export function isTeacherAvailable(
  lesson: Lesson,
  timeslot: Timeslot,
  context: ConstraintContext
): boolean {
  const teacher = context.teachers.get(lesson.teacherId);
  if (!teacher) return false;
  return !teacher.unavailableSlots.some(b => b.equals(timeslot));
}

export function teacherMaxLessonsPerDay(
  schedule: TimetableSchedule,
  lesson: Lesson,
  timeslot: Timeslot,
  context: ConstraintContext
): boolean {
  const teacher = context.teachers.get(lesson.teacherId);
  if (!teacher) return true;
  
  const dayLessons = schedule.getTeacherLessonsForDay(lesson.teacherId, timeslot.day);
  return dayLessons.length < teacher.maxLessonsPerDay;
}

export function classMaxLessonsPerDay(
  schedule: TimetableSchedule,
  lesson: Lesson,
  timeslot: Timeslot,
  context: ConstraintContext
): boolean {
  const cls = context.classes.get(lesson.classId);
  if (!cls) return true;
  
  const dayLessons = schedule.getClassLessonsForDay(lesson.classId, timeslot.day);
  return dayLessons.length < cls.maxLessonsPerDay;
}

export function isNotBreakPeriod(
  timeslot: Timeslot,
  context: ConstraintContext
): boolean {
  return !context.config.isBreak(timeslot);
}

export function noBlockedSlot(
  schedule: TimetableSchedule,
  lesson: Lesson,
  timeslot: Timeslot,
  context: ConstraintContext
): boolean {
  const teacher = context.teachers.get(lesson.teacherId);
  const cls = context.classes.get(lesson.classId);
  
  if (teacher && teacher.unavailableSlots.some(b => b.equals(timeslot))) {
    return false;
  }
  if (cls && cls.blockedSlots.some(b => b.equals(timeslot))) {
    return false;
  }
  return true;
}

export function isValidPlacement(
  schedule: TimetableSchedule,
  lesson: Lesson,
  timeslot: Timeslot,
  context: ConstraintContext
): { valid: boolean; violations: ConstraintViolation[] } {
  const violations: ConstraintViolation[] = [];
  
  if (!noTeacherClash(schedule, lesson, timeslot, context)) {
    violations.push({
      type: 'hard',
      name: 'TEACHER_CLASH',
      message: `Teacher ${lesson.teacherId} already has class at ${timeslot.toString()}`,
      penalty: 0,
    });
  }
  
  if (!noClassClash(schedule, lesson, timeslot, context)) {
    violations.push({
      type: 'hard',
      name: 'CLASS_CLASH',
      message: `Class ${lesson.classId} already has class at ${timeslot.toString()}`,
      penalty: 0,
    });
  }
  
  if (!teacherMaxLessonsPerDay(schedule, lesson, timeslot, context)) {
    const teacher = context.teachers.get(lesson.teacherId);
    violations.push({
      type: 'hard',
      name: 'TEACHER_MAX_LESSONS',
      message: `Teacher ${lesson.teacherId} exceeds max lessons per day`,
      penalty: 0,
    });
  }
  
  if (!classMaxLessonsPerDay(schedule, lesson, timeslot, context)) {
    violations.push({
      type: 'hard',
      name: 'CLASS_MAX_LESSONS',
      message: `Class ${lesson.classId} exceeds max lessons per day`,
      penalty: 0,
    });
  }
  
  if (!isNotBreakPeriod(timeslot, context)) {
    violations.push({
      type: 'hard',
      name: 'BREAK_PERIOD',
      message: `${timeslot.toString()} is a break period`,
      penalty: 0,
    });
  }
  
  if (!noBlockedSlot(schedule, lesson, timeslot, context)) {
    violations.push({
      type: 'hard',
      name: 'BLOCKED_SLOT',
      message: `Slot ${timeslot.toString()} is blocked`,
      penalty: 0,
    });
  }
  
  if (!isTeacherAvailable(lesson, timeslot, context)) {
    violations.push({
      type: 'hard',
      name: 'TEACHER_UNAVAILABLE',
      message: `Teacher ${lesson.teacherId} unavailable at ${timeslot.toString()}`,
      penalty: 0,
    });
  }
  
  return {
    valid: violations.filter(v => v.type === 'hard').length === 0,
    violations,
  };
}

export function hasHardConstraints(
  schedule: TimetableSchedule,
  lesson: Lesson,
  timeslot: Timeslot,
  context: ConstraintContext
): boolean {
  const result = isValidPlacement(schedule, lesson, timeslot, context);
  return result.valid;
}

export function penaltyTeacherGap(
  schedule: TimetableSchedule,
  context: ConstraintContext
): number {
  let penalty = 0;
  const teacherMap = new Map<string, number[]>();
  
  for (const slot of schedule.slots) {
    const teacherId = slot.lesson.teacherId;
    if (!teacherMap.has(teacherId)) {
      teacherMap.set(teacherId, []);
    }
    teacherMap.get(teacherId)!.push(slot.timeslot.day);
  }
  
  for (const [, days] of teacherMap) {
    const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
    for (let i = 1; i < uniqueDays.length; i++) {
      const gap = uniqueDays[i] - uniqueDays[i - 1];
      if (gap > 2) {
        penalty += (gap - 2) * 5;
      }
    }
  }
  
  return penalty;
}

export function penaltySubjectSpread(
  schedule: TimetableSchedule,
  context: ConstraintContext
): number {
  let penalty = 0;
  
  for (const classId of context.classes.keys()) {
    const subjectMap = new Map<string, number[]>();
    
    for (const slot of schedule.slots) {
      if (slot.lesson.classId === classId) {
        const subjectId = slot.lesson.subjectId;
        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, []);
        }
        subjectMap.get(subjectId)!.push(slot.timeslot.day);
      }
    }
    
    for (const [, days] of subjectMap) {
      const uniqueDays = [...new Set(days)];
      if (uniqueDays.length >= 2) {
        penalty += (uniqueDays.length - 1) * 3;
      }
    }
  }
  
  return penalty;
}

export function penaltyTeacherConsecutive(
  schedule: TimetableSchedule,
  context: ConstraintContext
): number {
  let penalty = 0;
  
  for (const teacherId of context.teachers.keys()) {
    const dayLessons = new Map<number, number[]>();
    
    for (const slot of schedule.slots) {
      if (slot.lesson.teacherId === teacherId) {
        const day = slot.timeslot.day;
        if (!dayLessons.has(day)) {
          dayLessons.set(day, []);
        }
        dayLessons.get(day)!.push(slot.timeslot.period);
      }
    }
    
    for (const [, periods] of dayLessons) {
      const sorted = periods.sort((a, b) => a - b);
      let consecutive = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
          consecutive++;
        } else {
          if (consecutive > 2) {
            penalty += (consecutive - 2) * 2;
          }
          consecutive = 1;
        }
      }
      if (consecutive > 2) {
        penalty += (consecutive - 2) * 2;
      }
    }
  }
  
  return penalty;
}

export function bonusPreferredDay(
  schedule: TimetableSchedule,
  context: ConstraintContext
): number {
  let bonus = 0;
  
  for (const slot of schedule.slots) {
    const teacher = context.teachers.get(slot.lesson.teacherId);
    if (teacher && teacher.preferredDays.includes(slot.timeslot.day)) {
      bonus += 3;
    }
  }
  
  return bonus;
}

export function bonusMorningSlot(
  schedule: TimetableSchedule,
  context: ConstraintContext
): number {
  let bonus = 0;
  
  for (const slot of schedule.slots) {
    if (slot.timeslot.period <= 3) {
      bonus += 2;
    } else if (slot.timeslot.period >= 7) {
      bonus -= 1;
    }
  }
  
  return bonus;
}

export function scoreSchedule(
  schedule: TimetableSchedule,
  context: ConstraintContext
): number {
  let score = 1000;
  
  score -= penaltyTeacherGap(schedule, context);
  score -= penaltySubjectSpread(schedule, context);
  score -= penaltyTeacherConsecutive(schedule, context);
  score += bonusPreferredDay(schedule, context);
  score += bonusMorningSlot(schedule, context);
  
  return score;
}