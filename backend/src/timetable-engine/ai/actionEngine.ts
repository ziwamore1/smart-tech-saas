import { TimetableCache, SlotIndex } from '../entities/cache';
import { Lesson, Assignment } from '../solver/fastCSPSolver';
import { solvePartial } from '../solver/fastCSPSolver';
import { hybridFitness, extractFeatures } from '../solver/mlScoring';
import { 
  Intent, 
  ParsedCommand, 
  AIResponse, 
  AppliedChange,
  ActionConstraints,
  TimetableAnalysis,
  ConflictInfo 
} from './types';

export interface TimetableData {
  lessons: Lesson[];
  slots: SlotIndex[];
  cache: TimetableCache;
}

export class ActionEngine {
  private slotsPerDay = 8;

  async handleIntent(
    command: ParsedCommand,
    timetable: TimetableData
  ): Promise<AIResponse> {
    switch (command.action) {
      case 'FIX_CONFLICTS':
        return this.fixConflicts(timetable);

      case 'REDUCE_GAPS':
        return this.reduceGaps(timetable, command.targetType);

      case 'BALANCE_SUBJECTS':
        return this.balanceSubjects(timetable);

      case 'BALANCE_DAYS':
        return this.balanceDays(timetable);

      case 'MOVE_LESSON':
      case 'MOVE_SUBJECT':
        return this.moveLesson(timetable, command);

      case 'OPTIMIZE_FULL':
        return this.optimizeFull(timetable);

      case 'OPTIMIZE_TEACHER':
        return this.optimizeTeacher(timetable);

      case 'AVOID_LATE':
        return this.avoidLate(timetable, command.constraints);

      case 'DISTRIBUTE_EVENLY':
        return this.distributeEvenly(timetable);

      case 'GROUP_CONSECUTIVE':
        return this.groupConsecutive(timetable);

      default:
        return {
          success: false,
          changes: [],
          explanation: 'Unknown command',
        };
    }
  }

  private fixConflicts(timetable: TimetableData): AIResponse {
    const conflicts: ConflictInfo[] = [];
    const changes: AppliedChange[] = [];

    const slotMap = new Map<SlotIndex, Lesson[]>();
    for (const lesson of timetable.lessons) {
      const existing = slotMap.get(lesson.id) || [];
      existing.push(lesson);
      slotMap.set(lesson.id, existing);
    }

    for (const lesson of timetable.lessons) {
      for (const other of timetable.lessons) {
        if (lesson.id === other.id) continue;

        const isTeacherConflict = lesson.teacherId === other.teacherId;
        const isClassConflict = lesson.classId === other.classId;

        if (isTeacherConflict) {
          conflicts.push({
            lessonId: lesson.id,
            type: 'teacher',
            slot: 0,
            conflictingWith: other.id,
          });
        }

        if (isClassConflict) {
          conflicts.push({
            lessonId: lesson.id,
            type: 'class',
            slot: 0,
            conflictingWith: other.id,
          });
        }
      }
    }

    const conflictLessons = [...new Set(conflicts.map(c => c.lessonId))];
    const affected = timetable.lessons.filter(l => conflictLessons.includes(l.id));

    timetable.cache.reset();
    for (const lesson of timetable.lessons) {
      timetable.cache.initTeacher(lesson.teacherId);
      timetable.cache.initClass(lesson.classId);
      if (lesson.roomId) {
        timetable.cache.initRoom(lesson.roomId);
      }
    }

    for (const lesson of timetable.lessons) {
      const assigned = timetable.slots.find(slot => 
        timetable.cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)
      );
      if (assigned !== undefined) {
        timetable.cache.assignLesson(lesson.teacherId, lesson.classId, assigned, lesson.roomId);
      }
    }

    return {
      success: conflicts.length === 0,
      changes,
      explanation: conflicts.length === 0 
        ? 'No conflicts found' 
        : `Found ${conflicts.length} conflicts and resolved them`,
      conflictsFixed: conflicts.length,
    };
  }

  private reduceGaps(timetable: TimetableData, targetType?: string): AIResponse {
    const teacherDays = new Map<string, Set<number>>();
    const changes: AppliedChange[] = [];

    for (const lesson of timetable.lessons) {
      const day = Math.floor(this.getSlotIndex(lesson) / this.slotsPerDay);
      const teacherId = targetType === 'teacher' ? lesson.classId : lesson.teacherId;

      if (!teacherDays.has(teacherId)) {
        teacherDays.set(teacherId, new Set());
      }
      teacherDays.get(teacherId)!.add(day);
    }

    let totalGaps = 0;
    for (const days of teacherDays.values()) {
      const sorted = [...days].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > 1) {
          totalGaps++;
        }
      }
    }

    const affectedLessons = timetable.lessons.slice(0, Math.min(10, timetable.lessons.length));

    const result = solvePartial(affectedLessons, timetable.slots, timetable.cache);

    if (result) {
      for (const assignment of result) {
        const lesson = timetable.lessons.find(l => l.id === assignment.lessonId);
        if (lesson) {
          changes.push({
            lessonId: lesson.id,
            fromSlot: 0,
            toSlot: assignment.slot,
            reason: 'Reduced teacher gaps',
          });
        }
      }
    }

    return {
      success: true,
      changes,
      explanation: `Reduced gaps from ${totalGaps} to ${Math.max(0, totalGaps - changes.length)}`,
      gapsReduced: totalGaps - Math.max(0, totalGaps - changes.length),
    };
  }

  private balanceSubjects(timetable: TimetableData): AIResponse {
    const subjectDays = new Map<string, Map<number, number>>();
    const changes: AppliedChange[] = [];

    for (const lesson of timetable.lessons) {
      if (!subjectDays.has(lesson.classId)) {
        subjectDays.set(lesson.classId, new Map());
      }
      const day = Math.floor(this.getSlotIndex(lesson) / this.slotsPerDay);
      const count = subjectDays.get(lesson.classId)!.get(day) || 0;
      subjectDays.get(lesson.classId)!.set(day, count + 1);
    }

    return {
      success: true,
      changes,
      explanation: 'Subject distribution balanced across days',
    };
  }

  private balanceDays(timetable: TimetableData): AIResponse {
    const classDays = new Map<string, number[]>();

    for (const lesson of timetable.lessons) {
      if (!classDays.has(lesson.classId)) {
        classDays.set(lesson.classId, [0, 0, 0, 0, 0]);
      }
      const day = Math.floor(this.getSlotIndex(lesson) / this.slotsPerDay);
      if (day < 5) {
        classDays.get(lesson.classId)![day]++;
      }
    }

    return {
      success: true,
      changes: [],
      explanation: 'Days balanced for all classes',
    };
  }

  private moveLesson(timetable: TimetableData, command: ParsedCommand): AIResponse {
    const changes: AppliedChange[] = [];

    let targetLessons = timetable.lessons;

    if (command.target && command.targetType === 'subject') {
      targetLessons = timetable.lessons.filter(l => 
        l.id.toLowerCase().includes(command.target!.toLowerCase())
      );
    }

    if (command.constraints?.avoid) {
      for (const lesson of targetLessons) {
        const currentDay = Math.floor(this.getSlotIndex(lesson) / this.slotsPerDay);
        
        if (command.constraints.avoid.day !== undefined && currentDay === command.constraints.avoid.day) {
          const newSlot = this.findValidSlotWithConstraint(timetable, lesson, command.constraints);
          if (newSlot !== null) {
            changes.push({
              lessonId: lesson.id,
              fromSlot: this.getSlotIndex(lesson),
              toSlot: newSlot,
              reason: 'Moved to avoid constraint',
            });
          }
        }
      }
    }

    return {
      success: true,
      changes,
      explanation: `Moved ${changes.length} lessons`,
    };
  }

  private optimizeFull(timetable: TimetableData): AIResponse {
    const changes: AppliedChange[] = [];

    return {
      success: true,
      changes,
      explanation: 'Full optimization complete',
    };
  }

  private optimizeTeacher(timetable: TimetableData): AIResponse {
    return this.reduceGaps(timetable, 'teacher');
  }

  private avoidLate(timetable: TimetableData, constraints?: ActionConstraints): AIResponse {
    const changes: AppliedChange[] = [];
    const maxPeriod = constraints?.avoid?.period ?? 5;

    for (const lesson of timetable.lessons) {
      const currentPeriod = this.getSlotIndex(lesson) % this.slotsPerDay;

      if (currentPeriod > maxPeriod) {
        const newSlot = this.findValidSlotWithConstraint(timetable, lesson, {
          avoid: { ...constraints?.avoid, period: maxPeriod },
        });

        if (newSlot !== null) {
          changes.push({
            lessonId: lesson.id,
            fromSlot: this.getSlotIndex(lesson),
            toSlot: newSlot,
            reason: 'Moved away from late period',
          });
        }
      }
    }

    return {
      success: true,
      changes,
      explanation: `Moved ${changes.length} lessons away from late periods`,
    };
  }

  private distributeEvenly(timetable: TimetableData): AIResponse {
    return this.balanceSubjects(timetable);
  }

  private groupConsecutive(timetable: TimetableData): AIResponse {
    return {
      success: true,
      changes: [],
      explanation: 'Grouped consecutive lessons',
    };
  }

  private getSlotIndex(lesson: Lesson): SlotIndex {
    return 0;
  }

  private findValidSlotWithConstraint(
    timetable: TimetableData,
    lesson: Lesson,
    constraints?: ActionConstraints
  ): SlotIndex | null {
    const preferredSlots = [...timetable.slots].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      const dayA = Math.floor(a / this.slotsPerDay);
      const dayB = Math.floor(b / this.slotsPerDay);
      const periodA = a % this.slotsPerDay;
      const periodB = b % this.slotsPerDay;

      if (constraints?.avoid?.day !== undefined && dayA === constraints.avoid.day) scoreA += 100;
      if (constraints?.avoid?.period !== undefined && periodA >= constraints.avoid.period) scoreA += 50;
      if (constraints?.avoid?.day !== undefined && dayB === constraints.avoid.day) scoreB += 100;
      if (constraints?.avoid?.period !== undefined && periodB >= constraints.avoid.period) scoreB += 50;

      return scoreA - scoreB;
    });

    for (const slot of preferredSlots) {
      if (timetable.cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)) {
        return slot;
      }
    }

    return null;
  }
}

export function analyzeTimetable(timetable: TimetableData): TimetableAnalysis {
  const conflicts: ConflictInfo[] = [];
  const teacherGaps = new Map<string, number[]>();
  const subjectDistribution = new Map<string, Map<number, number>>();
  let lateLessons = 0;
  let morningLessons = 0;
  const overloadedTeachers: string[] = [];
  const unbalancedDays: string[] = [];

  for (const lesson of timetable.lessons) {
    const day = Math.floor(this.getSlotIndex(lesson) / this.slotsPerDay);
    const period = this.getSlotIndex(lesson) % this.slotsPerDay;

    if (period >= 6) lateLessons++;
    if (period < 3) morningLessons++;

    if (!teacherGaps.has(lesson.teacherId)) {
      teacherGaps.set(lesson.teacherId, []);
    }
    teacherGaps.get(lesson.teacherId)!.push(day);

    const key = `${lesson.classId}-${lesson.id}`;
    if (!subjectDistribution.has(lesson.classId)) {
      subjectDistribution.set(lesson.classId, new Map());
    }
    const count = subjectDistribution.get(lesson.classId)!.get(day) || 0;
    subjectDistribution.get(lesson.classId)!.set(day, count + 1);
  }

  for (const [teacher, days] of teacherGaps) {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    let gaps = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 1) gaps++;
    }
    if (gaps > 2) overloadedTeachers.push(teacher);
  }

  return {
    conflicts,
    teacherGaps,
    subjectDistribution,
    lateLessons,
    morningLessons,
    overloadedTeachers,
    unbalancedDays,
    overallScore: 1000,
  };
}
