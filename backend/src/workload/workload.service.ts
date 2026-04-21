import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type WorkloadLevel = 'light' | 'normal' | 'heavy' | 'overloaded';

@Injectable()
export class WorkloadService {
  constructor(private prisma: PrismaService) {}

  private calculateWorkloadLevel(lessonsPerWeek: number): WorkloadLevel {
    if (lessonsPerWeek < 15) return 'light';
    if (lessonsPerWeek < 25) return 'normal';
    if (lessonsPerWeek < 35) return 'heavy';
    return 'overloaded';
  }

  async getTeacherLoad(teacherId: string, termId?: string) {
    const term = termId
      ? await this.prisma.term.findUnique({ where: { id: termId } })
      : await this.prisma.term.findFirst({ where: { isCurrent: true } });

    if (!term) return null;

    const assignments = await this.prisma.teachingAssignment.findMany({
      where: {
        teacherId,
        academicYearId: term.academicYearId,
      },
      include: {
        class: true,
        subject: true,
      },
    });

    const timetable = await this.prisma.timetable.findFirst({
      where: { termId: term.id },
      include: {
        slots: {
          where: { teacherId },
        },
      },
    });

    const totalLessons = timetable?.slots?.length || 0;
    const totalHours = totalLessons * 0.75;
    const avgLessonsPerDay = totalLessons / 5;

    const classMap: Record<string, { classId: string; className: string; lessonsPerWeek: number }> = {};
    const subjectMap: Record<string, { subjectId: string; subjectName: string; lessonsPerWeek: number }> = {};

    timetable?.slots?.forEach(slot => {
      const classKey = slot.timetableId;
      if (!classMap[classKey]) {
        classMap[classKey] = {
          classId: classKey,
          className: assignments.find(a => a.classId === slot.timetableId)?.class?.name || 'Unknown',
          lessonsPerWeek: 0,
        };
      }
      classMap[classKey].lessonsPerWeek++;

      const subjKey = slot.subjectId;
      if (!subjectMap[subjKey]) {
        subjectMap[subjKey] = {
          subjectId: subjKey,
          subjectName: assignments.find(a => a.subjectId === subjKey)?.subject?.name || 'Unknown',
          lessonsPerWeek: 0,
        };
      }
      subjectMap[subjKey].lessonsPerWeek++;
    });

    const conflicts = this.detectConflicts(timetable?.slots || []);

    return {
      teacherId,
      totalLessons,
      totalHours,
      classes: Object.values(classMap),
      subjects: Object.values(subjectMap),
      avgLessonsPerDay,
      workloadLevel: this.calculateWorkloadLevel(totalLessons),
      conflicts,
    };
  }

  async getAllTeachers(termId?: string) {
    const term = termId
      ? await this.prisma.term.findUnique({ where: { id: termId } })
      : await this.prisma.term.findFirst({ where: { isCurrent: true } });

    if (!term) return [];

    const timetables = await this.prisma.timetable.findMany({
      where: { termId: term.id },
      include: {
        slots: true,
        class: true,
      },
    });

    const teacherLoads: Record<string, any> = {};

    for (const timetable of timetables) {
      for (const slot of timetable.slots) {
        if (!teacherLoads[slot.teacherId]) {
          const teacher = await this.prisma.teacher.findUnique({
            where: { id: slot.teacherId },
            include: { user: true },
          });

          teacherLoads[slot.teacherId] = {
            teacherId: slot.teacherId,
            teacher: {
              id: teacher?.id,
              firstName: teacher?.user?.firstName,
              lastName: teacher?.user?.lastName,
              email: teacher?.user?.email,
            },
            totalLessons: 0,
            totalHours: 0,
            classes: [] as any[],
            subjects: [] as any[],
            conflicts: [],
          };
        }

        teacherLoads[slot.teacherId].totalLessons++;

        const classEntry = teacherLoads[slot.teacherId].classes.find(
          (c: any) => c.classId === timetable.classId
        );
        if (classEntry) {
          classEntry.lessonsPerWeek++;
        } else {
          teacherLoads[slot.teacherId].classes.push({
            classId: timetable.classId,
            className: timetable.class.name,
            lessonsPerWeek: 1,
          });
        }

        const subjEntry = teacherLoads[slot.teacherId].subjects.find(
          (s: any) => s.subjectId === slot.subjectId
        );
        if (subjEntry) {
          subjEntry.lessonsPerWeek++;
        } else {
          teacherLoads[slot.teacherId].subjects.push({
            subjectId: slot.subjectId,
            subjectName: '',
            lessonsPerWeek: 1,
          });
        }
      }
    }

    for (const teacherId of Object.keys(teacherLoads)) {
      teacherLoads[teacherId].totalHours = teacherLoads[teacherId].totalLessons * 0.75;
      teacherLoads[teacherId].avgLessonsPerDay = teacherLoads[teacherId].totalLessons / 5;
      teacherLoads[teacherId].workloadLevel = this.calculateWorkloadLevel(teacherLoads[teacherId].totalLessons);
      teacherLoads[teacherId].conflicts = this.detectConflicts(
        timetables.flatMap(t => t.slots.filter(s => s.teacherId === teacherId))
      );
    }

    return Object.values(teacherLoads);
  }

  async getClassLoad(classId: string, termId?: string) {
    const term = termId
      ? await this.prisma.term.findUnique({ where: { id: termId } })
      : await this.prisma.term.findFirst({ where: { isCurrent: true } });

    if (!term) return null;

    const timetable = await this.prisma.timetable.findFirst({
      where: { classId, termId: term.id },
      include: {
        slots: {
          include: {
            subject: true,
            teacher: { include: { user: true } },
          },
        },
      },
    });

    const subjectMap: Record<string, any> = {};

    timetable?.slots?.forEach(slot => {
      if (!subjectMap[slot.subjectId]) {
        subjectMap[slot.subjectId] = {
          subjectId: slot.subjectId,
          subjectName: slot.subject.name,
          lessonsPerWeek: 0,
          teachers: new Set(),
        };
      }
      subjectMap[slot.subjectId].lessonsPerWeek++;
      subjectMap[slot.subjectId].teachers.add(slot.teacherId);
    });

    return {
      classId,
      totalLessons: timetable?.slots?.length || 0,
      subjects: Object.values(subjectMap).map((s: any) => ({
        ...s,
        teachers: Array.from(s.teachers),
      })),
    };
  }

  async getBalancingSuggestions(termId?: string) {
    const teachers = await this.getAllTeachers(termId);

    const suggestions: Array<{
      type: string;
      fromTeacher: string;
      toTeacher?: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
    }> = [];

    const overloaded = teachers.filter((t: any) => t.workloadLevel === 'heavy' || t.workloadLevel === 'overloaded');
    const light = teachers.filter((t: any) => t.workloadLevel === 'light');

    for (const heavy of overloaded) {
      for (const lightTeacher of light) {
        if (heavy.totalLessons - lightTeacher.totalLessons >= 5) {
          suggestions.push({
            type: 'move',
            fromTeacher: `${heavy.teacher.firstName} ${heavy.teacher.lastName}`,
            toTeacher: `${lightTeacher.teacher.firstName} ${lightTeacher.teacher.lastName}`,
            description: `Consider moving some lessons from ${heavy.teacher.firstName} to ${lightTeacher.teacher.firstName} to balance workload`,
            impact: 'high',
          });
          break;
        }
      }
    }

    return suggestions;
  }

  async getConflicts(termId?: string) {
    const term = termId
      ? await this.prisma.term.findUnique({ where: { id: termId } })
      : await this.prisma.term.findFirst({ where: { isCurrent: true } });

    if (!term) return [];

    const timetables = await this.prisma.timetable.findMany({
      where: { termId: term.id },
      include: {
        slots: {
          include: { teacher: { include: { user: true } }, classroom: true },
        },
        class: true,
      },
    });

    const conflicts: Array<{
      teacherId: string;
      teacherName: string;
      day: number;
      period: number;
      className: string;
    }> = [];

    const teacherSchedule: Record<string, Array<{ day: number; period: number; className: string }>> = {};

    for (const timetable of timetables) {
      for (const slot of timetable.slots) {
        const key = slot.teacherId;
        if (!teacherSchedule[key]) teacherSchedule[key] = [];

        const existing = teacherSchedule[key].find(s => s.day === slot.day && s.period === slot.period);
        if (existing) {
          conflicts.push({
            teacherId: slot.teacherId,
            teacherName: `${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`,
            day: slot.day,
            period: slot.period,
            className: timetable.class.name,
          });
        } else {
          teacherSchedule[key].push({
            day: slot.day,
            period: slot.period,
            className: timetable.class.name,
          });
        }
      }
    }

    return conflicts;
  }

  async getUtilization(termId?: string) {
    const term = termId
      ? await this.prisma.term.findUnique({ where: { id: termId } })
      : await this.prisma.term.findFirst({ where: { isCurrent: true } });

    if (!term) return { rooms: [] };

    const rooms = await this.prisma.classroom.findMany();

    const timetables = await this.prisma.timetable.findMany({
      where: { termId: term.id },
      include: { slots: true },
    });

    const totalSlotsPerWeek = 5 * 10;

    const roomUtilization = rooms.map(room => {
      const usedSlots = timetables.reduce(
        (sum, t) => sum + t.slots.filter(s => s.classroomId === room.id).length,
        0
      );
      const utilizationPercent = Math.round((usedSlots / totalSlotsPerWeek) * 100);

      return {
        roomId: room.id,
        roomName: room.name,
        usedSlots,
        totalSlots: totalSlotsPerWeek,
        utilizationPercent,
      };
    });

    return { rooms: roomUtilization };
  }

  private detectConflicts(slots: Array<{ day: number; period: number; timetableId: string }>) {
    const conflicts: Array<{ day: number; period: number; className: string }> = [];
    const seen: Record<string, boolean> = {};

    for (const slot of slots) {
      const key = `${slot.day}-${slot.period}`;
      if (seen[key]) {
        conflicts.push({ day: slot.day, period: slot.period, className: slot.timetableId });
      }
      seen[key] = true;
    }

    return conflicts;
  }
}
