import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import _ from 'lodash';
import { expandLessons } from './lesson-expander';
import { generateSlots } from './slot-generator';
import { scoreSlot } from './scorer';
import { Lesson, Slot, LessonRequirement, TimetableSlot } from './types';

export interface ScheduleContext {
  schoolId: string;
  termId: string;
  days: number;
  periods: number;
  lessonRequirements: LessonRequirement[];
  slots: Slot[];
}

export interface SolveOptions {
  maxIterations?: number;
  populationSize?: number;
  maxTime?: number;
}

export interface SolveResult {
  slots: TimetableSlot[];
  score: number;
  violations: string[];
}

@Injectable()
export class TimetableSolverService {
  constructor(private prisma: PrismaService) {}

  async buildScheduleContext(
    schoolId: string,
    termId: string,
    classIds?: string[],
  ): Promise<ScheduleContext> {
    const whereClause: any = { class: { schoolId } };
    if (classIds && classIds.length > 0) {
      whereClause.classId = { in: classIds };
    }

    const requirements = await this.prisma.lessonRequirement.findMany({
      where: whereClause,
    });

    const lessonRequirements: LessonRequirement[] = requirements.map((r) => ({
      classId: r.classId,
      subjectId: r.subjectId,
      teacherId: r.teacherId,
      lessonsPerWeek: r.lessonsPerWeek,
    }));

    return {
      schoolId,
      termId,
      days: 5,
      periods: 8,
      lessonRequirements,
      slots: generateSlots({ days: 5, periods: 8, breakPeriods: [] }),
    };
  }

  async solve(
    context: ScheduleContext,
    options: SolveOptions = {},
    onProgress?: (progress: number, message: string) => void,
  ): Promise<SolveResult> {
    const { maxIterations = 2000, populationSize = 100, maxTime = 120000 } = options;

    const allSlots: TimetableSlot[] = [];
    const violations: string[] = [];
    let score = 0;
    const startTime = Date.now();

    const lessons = expandLessons(context.lessonRequirements);

    const shuffledLessons = _.shuffle(lessons);
    let iteration = 0;

    for (let i = 0; i < shuffledLessons.length; i++) {
      if (Date.now() - startTime > maxTime) {
        violations.push('Time limit exceeded');
        break;
      }

      iteration++;
      if (iteration % 50 === 0) {
        const progress = Math.round((iteration / shuffledLessons.length) * 100);
        onProgress?.(Math.min(progress, 99), `Scheduling lesson ${iteration}/${shuffledLessons.length}...`);
      }

      const lesson = shuffledLessons[i];
      const availableSlots = context.slots.filter(
        (s) =>
          !allSlots.some((t) => t.day === s.day && t.period === s.period) &&
          !allSlots.some(
            (t) =>
              t.teacherId === lesson.teacherId &&
              t.day === s.day &&
              t.period === s.period,
          ),
      );

      if (availableSlots.length === 0) {
        violations.push(`No available slot for lesson: ${lesson.subjectId}`);
        continue;
      }

      const scored = availableSlots
        .map((slot) => ({
          slot,
          score: scoreSlot(slot),
        }))
        .sort((a, b) => b.score - a.score);

      const chosen = scored[0].slot;

      allSlots.push({
        day: chosen.day,
        period: chosen.period,
        classId: lesson.classId,
        subjectId: lesson.subjectId,
        teacherId: lesson.teacherId,
      });

      score += scored[0].score;
    }

    const perDayLimit = 3;
    const teacherDayCount: Record<string, Record<number, number>> = {};
    for (const slot of allSlots) {
      if (!teacherDayCount[slot.teacherId]) {
        teacherDayCount[slot.teacherId] = {};
      }
      teacherDayCount[slot.teacherId][slot.day] = (teacherDayCount[slot.teacherId][slot.day] || 0) + 1;
      if (teacherDayCount[slot.teacherId][slot.day] > perDayLimit) {
        violations.push(`Teacher ${slot.teacherId} has more than ${perDayLimit} lessons on day ${slot.day}`);
      }
    }

    onProgress?.(100, 'Scheduling complete');

    return {
      slots: allSlots,
      score,
      violations,
    };
  }

  generateSolutionsByClass(result: SolveResult): { classId: string; lessons: TimetableSlot[] }[] {
    const classLessonsMap = new Map<string, TimetableSlot[]>();

    for (const lesson of result.slots) {
      if (!classLessonsMap.has(lesson.classId)) {
        classLessonsMap.set(lesson.classId, []);
      }
      classLessonsMap.get(lesson.classId)!.push(lesson);
    }

    return Array.from(classLessonsMap.entries()).map(([classId, lessons]) => ({
      classId,
      lessons,
    }));
  }
}
