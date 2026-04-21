import { TimeSlot, ClassRegistry, ClassConstraint } from '../models/Class';
import { TeacherRegistry } from '../models/Teacher';
import { RoomRegistry } from '../models/Room';
import { TimeslotRegistry } from '../models/Timeslot';
import { ScheduledLesson, TimetableState } from './types';

export interface HardConstraintViolation {
  constraint: string;
  message: string;
  severity: 'hard';
  lesson?: ScheduledLesson;
}

export interface HardConstraintChecker {
  (
    state: TimetableState,
    lesson: ScheduledLesson,
    targetDay: number,
    targetPeriod: number,
  ): HardConstraintViolation[];
}

export function createHardConstraintChecker(
  classRegistry: ClassRegistry,
  teacherRegistry: TeacherRegistry,
  roomRegistry: RoomRegistry,
  timeslotRegistry: TimeslotRegistry,
): HardConstraintChecker {
  return function checkHardConstraints(
    state: TimetableState,
    lesson: ScheduledLesson,
    targetDay: number,
    targetPeriod: number,
  ): HardConstraintViolation[] {
    const violations: HardConstraintViolation[] = [];

    const classConflict = state.slots.some(
      s => s.classId === lesson.classId && s.day === targetDay && s.period === targetPeriod
    );
    if (classConflict) {
      violations.push({
        constraint: 'CLASS_CONFLICT',
        message: `Class ${lesson.classId} already has a lesson at Day ${targetDay}, Period ${targetPeriod}`,
        severity: 'hard',
      });
    }

    const teacherConflict = state.slots.some(
      s => s.teacherId === lesson.teacherId && s.day === targetDay && s.period === targetPeriod
    );
    if (teacherConflict) {
      violations.push({
        constraint: 'TEACHER_CONFLICT',
        message: `Teacher ${lesson.teacherId} is already scheduled at Day ${targetDay}, Period ${targetPeriod}`,
        severity: 'hard',
      });
    }

    if (lesson.classroomId) {
      const roomConflict = state.slots.some(
        s => s.classroomId === lesson.classroomId && s.day === targetDay && s.period === targetPeriod
      );
      if (roomConflict) {
        violations.push({
          constraint: 'ROOM_CONFLICT',
          message: `Room ${lesson.classroomId} is already in use at Day ${targetDay}, Period ${targetPeriod}`,
          severity: 'hard',
        });
      }

      const room = roomRegistry.get(lesson.classroomId);
      if (room && !roomRegistry.isAvailable(lesson.classroomId, targetDay, targetPeriod)) {
        violations.push({
          constraint: 'ROOM_UNAVAILABLE',
          message: `Room ${lesson.classroomId} is not available at Day ${targetDay}, Period ${targetPeriod}`,
          severity: 'hard',
        });
      }
    }

    const teacher = teacherRegistry.get(lesson.teacherId);
    if (teacher) {
      const unavailable = teacher.unavailableSlots.some(
        s => s.day === targetDay && s.period === targetPeriod
      );
      if (unavailable) {
        violations.push({
          constraint: 'TEACHER_UNAVAILABLE',
          message: `Teacher ${lesson.teacherId} is not available at Day ${targetDay}, Period ${targetPeriod}`,
          severity: 'hard',
        });
      }

      const dayLessonCount = state.slots.filter(
        s => s.teacherId === lesson.teacherId && s.day === targetDay
      ).length;
      if (teacher.maxLessonsPerDay && dayLessonCount >= teacher.maxLessonsPerDay) {
        violations.push({
          constraint: 'TEACHER_MAX_LESSONS_PER_DAY',
          message: `Teacher ${lesson.teacherId} already has ${teacher.maxLessonsPerDay} lessons on Day ${targetDay}`,
          severity: 'hard',
        });
      }
    }

    const classConstraint = classRegistry.getConstraint(lesson.classId);
    if (classConstraint) {
      const blocked = classConstraint.blockedPeriods.some(
        b => b.day === targetDay && b.period === targetPeriod
      );
      if (blocked) {
        violations.push({
          constraint: 'CLASS_BLOCKED_PERIOD',
          message: `Class ${lesson.classId} has blocked Day ${targetDay}, Period ${targetPeriod}`,
          severity: 'hard',
        });
      }

      if (classConstraint.maxLessonsPerDay) {
        const dayLessonCount = state.slots.filter(
          s => s.classId === lesson.classId && s.day === targetDay
        ).length;
        if (dayLessonCount >= classConstraint.maxLessonsPerDay) {
          violations.push({
            constraint: 'CLASS_MAX_LESSONS_PER_DAY',
            message: `Class ${lesson.classId} already has ${classConstraint.maxLessonsPerDay} lessons on Day ${targetDay}`,
            severity: 'hard',
          });
        }
      }
    }

    if (timeslotRegistry.isBreak(targetDay, targetPeriod)) {
      violations.push({
        constraint: 'BREAK_PERIOD',
        message: `Day ${targetDay}, Period ${targetPeriod} is a break period`,
        severity: 'hard',
      });
    }

    return violations;
  };
}

export function hasHardConstraints(
  checker: HardConstraintChecker,
  state: TimetableState,
  lesson: ScheduledLesson,
  targetDay: number,
  targetPeriod: number,
): boolean {
  const violations = checker(state, lesson, targetDay, targetPeriod);
  return violations.length === 0;
}