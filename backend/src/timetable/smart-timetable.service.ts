import { Injectable } from '@nestjs/common';
import { TimetableCache, SlotIndex } from '../timetable-engine/entities/cache';
import { Lesson } from '../timetable-engine/solver/fastCSPSolver';
import { generateTimetableHybrid } from '../timetable-engine/solver/fastHybridSolver';
import { solveDistributed } from '../timetable-engine/solver/parallelSolver';
import { createAssistant } from '../timetable-engine/ai/assistant';
import { TimetableAssistant } from '../timetable-engine/ai/assistant';
import { generateSuggestions } from '../timetable-engine/ai/suggestions';
import { Intent } from '../timetable-engine/ai/types';

@Injectable()
export class SmartTimetableService {
  private assistants = new Map<string, TimetableAssistant>();

  async generateTimetable(
    lessons: any[],
    config?: {
      strategy?: 'csp' | 'genetic' | 'hybrid';
      workers?: number;
      targetScore?: number;
    }
  ) {
    const slotCount = (config as any)?.daysPerWeek * (config as any)?.periodsPerDay || 35;
    const slots: SlotIndex[] = Array.from({ length: slotCount }, (_, i) => i);

    const mappedLessons: Lesson[] = lessons.map((l, idx) => ({
      id: l.id || `lesson-${idx}`,
      teacherId: l.teacherId,
      classId: l.classId,
      roomId: l.roomId,
    }));

    const result = generateTimetableHybrid(mappedLessons, slots, {
      populationSize: config?.strategy === 'genetic' ? 50 : 20,
      generations: config?.strategy === 'genetic' ? 100 : 50,
      targetScore: config?.targetScore ?? 900,
    });

    return {
      success: result.success,
      schedule: result.schedule,
      score: result.score,
      method: result.method,
      timeElapsed: result.timeElapsed,
    };
  }

  async generateTimetableDistributed(
    lessons: any[],
    config?: {
      workers?: number;
      timeoutMs?: number;
    }
  ) {
    const slots: SlotIndex[] = Array.from({ length: 35 }, (_, i) => i);

    const mappedLessons: Lesson[] = lessons.map((l, idx) => ({
      id: l.id || `lesson-${idx}`,
      teacherId: l.teacherId,
      classId: l.classId,
      roomId: l.roomId,
    }));

    const result = await solveDistributed(mappedLessons, slots, {
      workers: config?.workers ?? 4,
      timeoutMs: config?.timeoutMs ?? 20000,
    });

    return result;
  }

  async processAICommand(
    timetableId: string,
    command: string,
    lessons: any[]
  ) {
    const assistant = this.getOrCreateAssistant(timetableId);

    const mappedLessons: Lesson[] = lessons.map((l, idx) => ({
      id: l.id || `lesson-${idx}`,
      teacherId: l.teacherId,
      classId: l.classId,
      roomId: l.roomId,
    }));

    const slots: SlotIndex[] = Array.from({ length: 35 }, (_, i) => i);
    const cache = new TimetableCache({ totalSlots: 35 });

    for (const lesson of mappedLessons) {
      cache.initTeacher(lesson.teacherId);
      cache.initClass(lesson.classId);
      if (lesson.roomId) {
        cache.initRoom(lesson.roomId);
      }
    }

    const result = await assistant.processInput(command, {
      lessons: mappedLessons,
      slots,
      cache,
    });

    return result;
  }

  async getSuggestions(timetableId: string, lessons: any[]) {
    const mappedLessons: Lesson[] = lessons.map((l, idx) => ({
      id: l.id || `lesson-${idx}`,
      teacherId: l.teacherId,
      classId: l.classId,
      roomId: l.roomId,
    }));

    const cache = new TimetableCache({ totalSlots: 35 });

    for (const lesson of mappedLessons) {
      cache.initTeacher(lesson.teacherId);
      cache.initClass(lesson.classId);
      if (lesson.roomId) {
        cache.initRoom(lesson.roomId);
      }
    }

    return generateSuggestions(mappedLessons, cache);
  }

  async optimizeTimetable(
    lessons: any[],
    intent: Intent
  ) {
    const mappedLessons: Lesson[] = lessons.map((l, idx) => ({
      id: l.id || `lesson-${idx}`,
      teacherId: l.teacherId,
      classId: l.classId,
      roomId: l.roomId,
    }));

    const slots: SlotIndex[] = Array.from({ length: 35 }, (_, i) => i);
    const cache = new TimetableCache({ totalSlots: 35 });

    const assistant = createAssistant({ enableLearning: false });

    const intentMap: Record<Intent, string> = {
      FIX_CONFLICTS: 'fix conflicts',
      REDUCE_GAPS: 'reduce gaps',
      BALANCE_SUBJECTS: 'balance subjects',
      BALANCE_DAYS: 'balance days',
      MOVE_LESSON: 'move lesson',
      MOVE_SUBJECT: 'move subject',
      OPTIMIZE_FULL: 'optimize fully',
      OPTIMIZE_TEACHER: 'optimize teacher schedule',
      AVOID_LATE: 'avoid late lessons',
      AVOID_MORNING: 'avoid morning lessons',
      DISTRIBUTE_EVENLY: 'distribute evenly',
      GROUP_CONSECUTIVE: 'group consecutive',
      SET_DEFAULT: 'reset',
    };

    const result = await assistant.processInput(
      intentMap[intent] || 'optimize',
      { lessons: mappedLessons, slots, cache }
    );

    return result;
  }

  private getOrCreateAssistant(timetableId: string): TimetableAssistant {
    if (!this.assistants.has(timetableId)) {
      this.assistants.set(timetableId, createAssistant({ enableLearning: true }));
    }
    return this.assistants.get(timetableId)!;
  }

  clearAssistant(timetableId: string) {
    this.assistants.delete(timetableId);
  }
}
