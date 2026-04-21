// src/timetable/timetable.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import _ from 'lodash';
import { expandLessons } from './solver/lesson-expander';
import { buildConstraints } from './solver/constraint-builder';
import { TimetableGateway } from './timetable.gateway';
import { solveTimetable } from './solver/solver';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

// ---------------- Types ----------------
type LessonRequirement = {
  subjectId: string;
  teacherId: string;
  lessonsPerWeek: number;
};

type Slot = {
  day: number;
  period: number;
};

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timetableGateway: TimetableGateway,
    @InjectQueue('timetable') private timetableQueue: Queue,
  ) {}

  async queueTimetableGeneration(schoolId: string) {
    await this.timetableQueue.add('generate', { schoolId });
    return { message: 'Timetable generation started' };
  }

  // ---------------- Lesson Requirement ----------------
  async createLessonRequirement(
    schoolId: string,
    classId: string,
    subjectId: string,
    teacherId: string,
    lessonsPerWeek: number,
  ) {
    return this.prisma.lessonRequirement.create({
      data: { schoolId, classId, subjectId, teacherId, lessonsPerWeek },
    });
  }

  async deleteLessonRequirement(id: string) {
    return this.prisma.lessonRequirement.delete({
      where: { id },
    });
  }

  async getLessonRequirements(classId: string) {
    return this.prisma.lessonRequirement.findMany({
      where: { classId },
      include: { subject: true, teacher: true },
    });
  }

  async getAllLessonRequirements(schoolId: string) {
    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      select: { id: true },
    });
    
    const requirements = await this.prisma.lessonRequirement.findMany({
      where: { classId: { in: classes.map(c => c.id) } },
      include: { 
        subject: true, 
        teacher: { include: { user: true } },
        class: true,
      },
    });

    const timetables = await this.prisma.timetable.findMany({
      where: { classId: { in: classes.map(c => c.id) } },
      include: {
        slots: {
          select: {
            subjectId: true,
            teacherId: true,
          },
        },
      },
    });

    const slotsByRequirement = new Map<string, number>();
    
    timetables.forEach(tt => {
      tt.slots.forEach(slot => {
        const key = `${tt.classId}-${slot.subjectId}-${slot.teacherId}`;
        slotsByRequirement.set(key, (slotsByRequirement.get(key) || 0) + 1);
      });
    });

    return requirements.map(req => {
      const key = `${req.classId}-${req.subjectId}-${req.teacherId}`;
      const lessonsAssigned = slotsByRequirement.get(key) || 0;
      return {
        ...req,
        lessonsAssigned,
        remainingLessons: req.lessonsPerWeek - lessonsAssigned,
      };
    });
  }

  // ---------------- Timetable ----------------
  async getClassTimetable(classId: string, termId: string) {
    return this.prisma.timetable.findFirst({
      where: { classId, termId },
      include: {
        slots: {
          include: { 
            subject: true, 
            teacher: { include: { user: true } },
            classroom: true,
          },
          orderBy: [{ day: 'asc' }, { period: 'asc' }],
        },
      },
    });
  }

  async deleteTimetable(timetableId: string) {
    await this.prisma.timetableSlot.deleteMany({ where: { timetableId } });
    return this.prisma.timetable.delete({ where: { id: timetableId } });
  }

  async moveSlot(slotId: string, day: number, period: number) {
    const slot = await this.prisma.timetableSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new Error('Slot not found');

    const conflict = await this.prisma.timetableSlot.findFirst({
      where: {
        day,
        period,
        teacherId: slot.teacherId,
        timetableId: slot.timetableId,
      },
    });
    if (conflict) throw new Error('Teacher conflict');

    return this.prisma.timetableSlot.update({
      where: { id: slotId },
      data: { day, period },
    });
  }

  // ---------------- Break Periods ----------------
  private async getBreakPeriods(schoolId: string) {
    const breaks = await this.prisma.breakPeriod.findMany({
      where: { schoolId },
    });
    return breaks.map((b) => ({ day: b.day, period: b.period }));
  }

  // ---------------- Timetable Generation ----------------
  async generateTimetable(schoolId: string, termId: string, classId: string) {
    if (!classId) {
      throw new Error('ClassId is required');
    }

    // 1️⃣ Get lesson requirements
    const requirements = await this.prisma.lessonRequirement.findMany({
      where: { classId },
    });

    console.log('Requirements:', requirements.length);

    // 2️⃣ Expand weekly lessons into individual lessons
    const lessons = expandLessons(
      requirements.map((r) => ({
        classId: r.classId,
        subjectId: r.subjectId,
        teacherId: r.teacherId,
        lessonsPerWeek: r.lessonsPerWeek,
      })),
    );

    console.log('Lessons Expanded:', lessons.length);

    // 3️⃣ Load timetable constraints
    const context = await buildConstraints(this.prisma, schoolId);

    // Load scheduling rules
    const constraints = await this.prisma.timetableConstraint.findUnique({
      where: { schoolId },
    });

    // 4️⃣ Run solver
    const solution = solveTimetable(
      lessons,
      context.days,
      context.periods,
      context.breakPeriods,
      constraints,
    );

    console.log('Slots Generated:', solution?.length);

    if (!solution || solution.length === 0) {
      throw new Error('Timetable solver returned no slots');
    }

    // Find existing timetable
    const existing = await this.prisma.timetable.findFirst({
      where: {
        classId,
        termId,
      },
    });

    // Delete old slots first
    if (existing) {
      await this.prisma.timetableSlot.deleteMany({
        where: {
          timetableId: existing.id,
        },
      });

      await this.prisma.timetable.delete({
        where: {
          id: existing.id,
        },
      });
    }

    // 6️⃣ Create new timetable
    const timetable = await this.prisma.timetable.create({
      data: {
        school: {
          connect: { id: schoolId },
        },
        term: {
          connect: { id: termId },
        },
        class: {
          connect: { id: classId },
        },
      },
    });

    // 7️⃣ Save slots
    await this.prisma.timetableSlot.createMany({
      data: solution.map((s) => ({
        timetableId: timetable.id,
        subjectId: s.subjectId,
        teacherId: s.teacherId,
        day: s.day,
        period: s.period,
      })),
    });

    // 8️⃣ Return timetable with slots
    return this.prisma.timetable.findUnique({
      where: { id: timetable.id },
      include: {
        slots: {
          include: {
            subject: true,
            teacher: true,
          },
          orderBy: [{ day: 'asc' }, { period: 'asc' }],
        },
      },
    });
  }

  // ---------------- Optimized CSP Solver ----------------
  private async solveTimetableOptimized(
    timetableId: string,
    requirements: LessonRequirement[],
    availableSlots: Slot[],
    teacherSlotsCache: Record<string, Slot[]>,
    maxLessonsPerDay = 3, // Max lessons per teacher per day
  ): Promise<any[] | null> {
    const slotsSoFar: {
      day: number;
      period: number;
      subjectId: string;
      teacherId: string;
    }[] = [];

    // Precompute available slots for each teacher
    for (const req of requirements) {
      if (!teacherSlotsCache[req.teacherId]) {
        const teacherAvailable: Slot[] = [];
        for (const slot of availableSlots) {
          const conflict = await this.prisma.timetableSlot.findFirst({
            where: {
              teacherId: req.teacherId,
              timetableId,
              day: slot.day,
              period: slot.period,
            },
          });
          if (!conflict) teacherAvailable.push(slot);
        }
        teacherSlotsCache[req.teacherId] = _.shuffle(teacherAvailable);
      }
    }

    // Track number of lessons per teacher per day
    const teacherDayCount: Record<string, Record<number, number>> = {};

    // Track subject distribution per class per day
    const subjectDayCount: Record<string, Record<number, number>> = {};

    const backtrack = (index = 0): boolean => {
      if (index >= requirements.length) return true;

      const req = requirements[index];
      if (!teacherDayCount[req.teacherId]) teacherDayCount[req.teacherId] = {};
      if (!subjectDayCount[req.subjectId]) subjectDayCount[req.subjectId] = {};

      let lessonsScheduled = 0;

      for (const slot of teacherSlotsCache[req.teacherId]) {
        // Check class conflict
        if (
          slotsSoFar.some((s) => s.day === slot.day && s.period === slot.period)
        )
          continue;

        // Max lessons per day for teacher
        const teacherCount = teacherDayCount[req.teacherId][slot.day] || 0;
        if (teacherCount >= maxLessonsPerDay) continue;

        // Subject distribution: prefer days with fewer of the same subject
        const subjectCount = subjectDayCount[req.subjectId][slot.day] || 0;
        if (subjectCount >= Math.ceil(req.lessonsPerWeek / 5)) continue;

        // Place slot
        slotsSoFar.push({
          day: slot.day,
          period: slot.period,
          subjectId: req.subjectId,
          teacherId: req.teacherId,
        });
        teacherDayCount[req.teacherId][slot.day] = teacherCount + 1;
        subjectDayCount[req.subjectId][slot.day] = subjectCount + 1;

        lessonsScheduled++;

        if (lessonsScheduled < req.lessonsPerWeek) {
          if (backtrack(index)) return true;
        } else {
          if (backtrack(index + 1)) return true;
        }

        // Backtrack
        slotsSoFar.pop();
        teacherDayCount[req.teacherId][slot.day]--;
        subjectDayCount[req.subjectId][slot.day]--;
        lessonsScheduled--;
      }

      return false;
    };

    const success = backtrack();
    return success ? slotsSoFar : null;
  }
  // ---------------- Move / Swap Slot ----------------
  async swapSlot(
    sourceSlotId: string,
    targetDay: number,
    targetPeriod: number,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.timetableSlot.findUnique({
        where: { id: sourceSlotId },
        include: {
          timetable: true,
        },
      });

      if (!source) throw new Error('Source slot not found');
      // Check if target already exists
      const target = await tx.timetableSlot.findFirst({
        where: {
          timetableId: source.timetableId,
          day: targetDay,
          period: targetPeriod,
        },
      });

      // ---------------- CASE 1: Empty Target → Move ----------------
      if (!target) {
        // Reuse teacher conflict validation from move logic
        const conflict = await tx.timetableSlot.findFirst({
          where: {
            day: targetDay,
            period: targetPeriod,
            teacherId: source.teacherId,
            timetableId: source.timetableId,
            NOT: { id: source.id },
          },
        });

        if (conflict) throw new Error('Teacher conflict');

        return tx.timetableSlot.update({
          where: { id: source.id },
          data: {
            day: targetDay,
            period: targetPeriod,
          },
        });
      }

      // ---------------- CASE 2: Swap ----------------

      // Prevent teacher conflict after swap
      const teacherConflict = await tx.timetableSlot.findFirst({
        where: {
          timetableId: source.timetableId,
          day: target.day,
          period: target.period,
          teacherId: source.teacherId,
          NOT: { id: target.id },
        },
      });

      if (teacherConflict) throw new Error('Teacher conflict on swap');

      // Perform atomic swap
      const tempDay = source.day;
      const tempPeriod = source.period;

      await tx.timetableSlot.update({
        where: { id: source.id },
        data: {
          day: target.day,
          period: target.period,
        },
      });

      await tx.timetableSlot.update({
        where: { id: target.id },
        data: {
          day: tempDay,
          period: tempPeriod,
        },
      });

      // Broadcast realtime update
      this.timetableGateway.broadcastSlotUpdate({
        type: 'slotUpdated',
        timetableId: source.timetableId,
      });

      await this.logAudit(tx, {
        schoolId: source.timetable.schoolId,
        timetableId: source.timetableId,
        slotId: source.id,
        userId,
        action: target ? 'SWAP' : 'MOVE',
        fromDay: tempDay,
        fromPeriod: tempPeriod,
        toDay: targetDay,
        toPeriod: targetPeriod,
      });

      return { success: true };
    });
  }
  private async logAudit(
    tx,
    {
      schoolId,
      timetableId,
      slotId,
      userId,
      action,
      fromDay,
      fromPeriod,
      toDay,
      toPeriod,
    },
  ) {
    await tx.timetableAuditLog.create({
      data: {
        schoolId,
        timetableId,
        slotId,
        userId,
        action,
        fromDay,
        fromPeriod,
        toDay,
        toPeriod,
      },
    });
  }
  async previewMove(slotId: string, targetDay: number, targetPeriod: number) {
    const slot = await this.prisma.timetableSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) throw new Error('Slot not found');

    const teacherConflict = await this.prisma.timetableSlot.findFirst({
      where: {
        teacherId: slot.teacherId,
        day: targetDay,
        period: targetPeriod,
        timetableId: slot.timetableId,
        NOT: { id: slotId },
      },
    });

    const classConflict = await this.prisma.timetableSlot.findFirst({
      where: {
        timetableId: slot.timetableId,
        day: targetDay,
        period: targetPeriod,
        NOT: { id: slotId },
      },
    });

    return {
      teacherConflict: !!teacherConflict,
      classConflict: !!classConflict,
      allowed: !teacherConflict,
    };
  }
  async createTimetableSnapshot(timetableId: string) {
    const timetable = await this.prisma.timetable.findUnique({
      where: { id: timetableId },
      include: {
        slots: true,
      },
    });

    if (!timetable) {
      throw new Error('Timetable not found');
    }

    return this.prisma.timetableVersion.create({
      data: {
        timetableId,
        snapshot: timetable as any, // Store entire timetable with slots as JSON
      },
    });
  }
  async getVersions(timetableId: string) {
    return this.prisma.timetableVersion.findMany({
      where: { timetableId },
      orderBy: { createdAt: 'desc' },
    });
  }
  async restoreVersion(versionId: string) {
    const version = await this.prisma.timetableVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) throw new Error('Version not found');

    const snapshot: any = version.snapshot;

    await this.prisma.timetableSlot.deleteMany({
      where: { timetableId: snapshot.id },
    });

    await this.prisma.timetableSlot.createMany({
      data: snapshot.slots.map((s) => ({
        timetableId: snapshot.id,
        day: s.day,
        period: s.period,
        teacherId: s.teacherId,
        subjectId: s.subjectId,
      })),
    });

    return { restored: true };
  }
  async getTeacherTimetable(teacherId: string, termId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        teacherId,
        timetable: {
          termId,
        },
      },
      include: {
        subject: true,
        teacher: { include: { user: true } },
        timetable: {
          include: {
            class: true,
          },
        },
        classroom: true,
      },
      orderBy: [{ day: 'asc' }, { period: 'asc' }],
    });
    return { slots };
  }

  // ==================== STUDENT TIMETABLE ====================
  async getStudentByUserId(userId: string) {
    return this.prisma.student.findFirst({
      where: {
        user: {
          id: userId,
        },
      },
    });
  }

  async getStudentTimetable(studentId: string, termId: string) {
    // Get student's enrollment to find their class
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        academicYear: {
          terms: {
            some: {
              id: termId,
            },
          },
        },
        status: 'ACTIVE',
      },
      include: {
        class: true,
        student: true,
      },
    });

    if (!enrollment) {
      return {
        student: null,
        class: null,
        slots: [],
        message: 'No active enrollment found for this term',
      };
    }

    const timetable = await this.prisma.timetable.findFirst({
      where: {
        classId: enrollment.classId,
        termId,
      },
      include: {
        slots: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            classroom: true,
          },
          orderBy: [{ day: 'asc' }, { period: 'asc' }],
        },
      },
    });

    return {
      student: {
        id: studentId,
        firstName: enrollment.student.firstName,
        lastName: enrollment.student.lastName,
        admissionNumber: enrollment.student.admissionNumber,
      },
      class: enrollment.class,
      timetable: timetable,
      slots: timetable?.slots || [],
    };
  }

  // ==================== PARENT TIMETABLE ====================
  async getParentByUserId(userId: string) {
    // Find parent by email - parents have User records too
    const parent = await this.prisma.parent.findFirst({
      where: {
        email: userId, // In our system, parent email is used as user identifier
      },
    });

    // Alternative: Check if there's a user with parent role
    if (!parent) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (user && user.userRoles.some((ur) => ur.role.name === 'Parent')) {
        // Find parent by matching email or phone
        return this.prisma.parent.findFirst({
          where: {
            OR: [{ email: user.email }, { phone: user.phone }],
          },
        });
      }
    }

    return parent;
  }

  async verifyParentChildAccess(parentId: string, studentId: string) {
    const parentStudent = await this.prisma.parentStudent.findFirst({
      where: {
        parentId,
        studentId,
      },
    });
    return !!parentStudent;
  }

  async getChildrenTimetables(parentId: string, termId: string) {
    const children = await this.prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: true,
      },
    });

    const timetables = await Promise.all(
      children.map(async (child) => {
        const timetableData = await this.getStudentTimetable(
          child.studentId,
          termId,
        );
        return {
          student: {
            id: child.student.id,
            firstName: child.student.firstName,
            lastName: child.student.lastName,
            admissionNumber: child.student.admissionNumber,
          },
          class: timetableData.class,
          slots: timetableData.slots,
        };
      }),
    );

    return timetables;
  }

  // ==================== HELPER METHODS ====================
  async getCurrentTerm(schoolId: string) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: {
        schoolId,
        isCurrent: true,
      },
      include: {
        terms: {
          where: { isCurrent: true },
          take: 1,
        },
      },
    });

    if (!academicYear || academicYear.terms.length === 0) {
      return null;
    }

    return academicYear.terms[0];
  }

  async getCurrentTermId(schoolId: string) {
    const term = await this.getCurrentTerm(schoolId);
    if (!term) {
      throw new Error('No current term found for this school');
    }
    return term.id;
  }

  async getTeacherByUserId(userId: string) {
    return this.prisma.teacher.findFirst({
      where: {
        userId,
      },
    });
  }

  async getClassesWithTimetables(termId: string, schoolId: string) {
    const timetables = await this.prisma.timetable.findMany({
      where: {
        termId,
        schoolId,
      },
      include: {
        class: {
          include: {
            levelType: true,
          },
        },
        _count: {
          select: { slots: true },
        },
      },
    });

    return timetables.map((t) => ({
      id: t.id,
      classId: t.class.id,
      className: t.class.name,
      levelType: t.class.levelType?.name,
      slotCount: t._count.slots,
      createdAt: t.createdAt,
    }));
  }

  async getTeachersWithTimetables(termId: string, schoolId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        timetable: {
          termId,
          schoolId,
        },
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      distinct: ['teacherId'],
    });

    const teacherMap = new Map();
    slots.forEach((slot) => {
      if (!teacherMap.has(slot.teacherId)) {
        teacherMap.set(slot.teacherId, {
          teacherId: slot.teacherId,
          firstName: slot.teacher.user.firstName,
          lastName: slot.teacher.user.lastName,
          email: slot.teacher.user.email,
          employeeNo: slot.teacher.employeeNo,
        });
      }
    });

    return Array.from(teacherMap.values());
  }

  async getRooms(schoolId: string) {
    return this.prisma.classroom.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }

  async getRoomTimetable(roomId: string, termId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        classroomId: roomId,
        timetable: {
          termId,
        },
      },
      include: {
        subject: true,
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        timetable: {
          include: {
            class: true,
          },
        },
        classroom: true,
      },
      orderBy: [{ day: 'asc' }, { period: 'asc' }],
    });
    return { slots };
  }
}
