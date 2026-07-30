import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassService {
  private readonly logger = new Logger(ClassService.name);
  constructor(private prisma: PrismaService) {}

  async create(
    name: string,
    levelTypeId: string,
    order: number,
    schoolId: string,
    capacity?: number,
    gradingSystemId?: string,
  ) {
    const levelType = await this.prisma.levelType.findUnique({
      where: { id: levelTypeId },
    });

    if (!levelType) throw new NotFoundException('Level type not found');

    if (levelType.schoolId !== schoolId)
      throw new ForbiddenException('Invalid level type');

    if (gradingSystemId) {
      const gs = await this.prisma.gradingSystem.findUnique({
        where: { id: gradingSystemId },
      });
      if (!gs || gs.schoolId !== schoolId)
        throw new NotFoundException('Grading system not found');
    }

    return this.prisma.class.create({
      data: {
        name,
        order,
        levelTypeId,
        schoolId,
        capacity,
        gradingSystemId: gradingSystemId || null,
      },
    });
  }

  async findAll(user: { id: string; schoolId: string; roles?: string[] }) {
    try {
      if (!user.schoolId) return [];

      const classIds = await this.getTeacherClassIds(user);

      const where: any = { schoolId: user.schoolId };
      if (classIds) {
        where.id = { in: classIds };
      }

      const classes = await this.prisma.class.findMany({
        where,
        select: {
          id: true,
          name: true,
          capacity: true,
          schoolId: true,
          levelTypeId: true,
          gradingSystemId: true,
          order: true,
          levelType: { select: { id: true, name: true } },
          gradingSystem: { select: { id: true, name: true } },
          classTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [
          { levelTypeId: 'asc' },
          { order: 'asc' }
        ]
      });

      const classIdsList = classes.map(c => c.id);
      const enrollments = classIdsList.length > 0 ? await this.prisma.enrollment.findMany({
        where: { classId: { in: classIdsList }, status: 'ACTIVE' },
        select: { classId: true, student: { select: { gender: true } } },
      }) : [];

      const enrollmentCountMap = new Map<string, number>();
      const genderMap = new Map<string, { male: number; female: number }>();
      for (const e of enrollments) {
        enrollmentCountMap.set(e.classId, (enrollmentCountMap.get(e.classId) || 0) + 1);
        if (!genderMap.has(e.classId)) genderMap.set(e.classId, { male: 0, female: 0 });
        const g = e.student?.gender || '';
        const entry = genderMap.get(e.classId)!;
        if (g === 'MALE' || g === 'Male' || g === 'M') entry.male++;
        else if (g === 'FEMALE' || g === 'Female' || g === 'F') entry.female++;
      }

      return classes.map((c) => {
        const counts = genderMap.get(c.id) || { male: 0, female: 0 };
        return {
          id: c.id,
          name: c.name,
          capacity: c.capacity,
          schoolId: c.schoolId,
          levelTypeId: c.levelTypeId,
          gradingSystemId: c.gradingSystemId,
          order: c.order,
          levelType: c.levelType,
          gradingSystem: c.gradingSystem,
          classTeacher: c.classTeacher,
          totalStudents: enrollmentCountMap.get(c.id) || 0,
          maleCount: counts.male,
          femaleCount: counts.female,
        };
      });
    } catch (error) {
      this.logger.error(`findAll error: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  async findByLevel(levelTypeId: string, user: { id: string; schoolId: string; roles?: string[] }) {
    const classIds = await this.getTeacherClassIds(user);

    const where: any = { levelTypeId, schoolId: user.schoolId };
    if (classIds) {
      where.id = { in: classIds };
    }

    return this.prisma.class.findMany({
      where,
      include: {
        gradingSystem: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async update(id: string, data: { name?: string; capacity?: number | null; order?: number; gradingSystemId?: string | null }, schoolId: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
    });

    if (!classEntity) throw new NotFoundException('Class not found');
    if (classEntity.schoolId !== schoolId) throw new ForbiddenException('Access denied');

    if (data.gradingSystemId) {
      const gs = await this.prisma.gradingSystem.findUnique({
        where: { id: data.gradingSystemId },
      });
      if (!gs || gs.schoolId !== schoolId)
        throw new NotFoundException('Grading system not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.gradingSystemId !== undefined) updateData.gradingSystemId = data.gradingSystemId;

    return this.prisma.class.update({
      where: { id },
      data: updateData,
    });
  }

  async setClassTeacher(id: string, teacherId: string | null, schoolId: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
    });

    if (!classEntity) throw new NotFoundException('Class not found');
    if (classEntity.schoolId !== schoolId) throw new ForbiddenException('Access denied');

    let resolvedUserId = teacherId;

    if (teacherId) {
      const user = await this.prisma.user.findUnique({
        where: { id: teacherId },
      });

      if (!user) {
        const teacher = await this.prisma.teacher.findUnique({
          where: { id: teacherId },
          include: { user: { select: { id: true } } },
        });
        if (!teacher) throw new NotFoundException('Teacher not found');
        resolvedUserId = teacher.userId;
        if (teacher.schoolId !== schoolId) throw new ForbiddenException('Teacher does not belong to this school');
      } else {
        if (user.schoolId !== schoolId) throw new ForbiddenException('Teacher does not belong to this school');
      }
    }

    return this.prisma.class.update({
      where: { id },
      data: { classTeacherId: resolvedUserId },
      include: {
        classTeacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async delete(id: string, schoolId: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      include: {
        enrollments: { where: { status: 'ACTIVE' }, select: { id: true } },
        teachingAssignments: { select: { id: true } },
        timetableSlots: { select: { id: true } },
      },
    });

    if (!classEntity) throw new NotFoundException('Class not found');
    if (classEntity.schoolId !== schoolId) throw new ForbiddenException('Access denied');

    if (classEntity.enrollments.length > 0) {
      throw new BadRequestException(
        `Cannot delete "${classEntity.name}" — it has ${classEntity.enrollments.length} active student(s). Remove or transfer them first.`,
      );
    }

    await this.prisma.classTeacherAssignment.deleteMany({ where: { classId: id } });
    await this.prisma.teachingAssignment.deleteMany({ where: { classId: id } });
    await this.prisma.timetableSlot.deleteMany({ where: { classId: id } });

    await this.prisma.class.delete({ where: { id } });

    return { message: `Class "${classEntity.name}" deleted successfully` };
  }

  private async getTeacherClassIds(user: { id: string; schoolId: string; roles?: string[] }): Promise<string[] | null> {
    const roles = (user.roles ?? []).map((r) => r.toUpperCase());
    if (roles.includes('DIRECTOR') || roles.includes('SUPERADMIN')) {
      return null;
    }
    if (!roles.includes('TEACHER') && !roles.includes('CLASS_TEACHER')) {
      return null;
    }

    const [teachingAssignments, classTeacherAssignments, directClasses] = await Promise.all([
      this.prisma.teachingAssignment.findMany({
        where: { teacherId: user.id, schoolId: user.schoolId },
        select: { classId: true },
      }),
      this.prisma.classTeacherAssignment.findMany({
        where: { teacherId: user.id, isActive: true },
        select: { classId: true },
      }),
      this.prisma.class.findMany({
        where: { classTeacherId: user.id, schoolId: user.schoolId },
        select: { id: true },
      }),
    ]);

    const ids = new Set<string>();
    for (const ta of teachingAssignments) ids.add(ta.classId);
    for (const cta of classTeacherAssignments) ids.add(cta.classId);
    for (const dc of directClasses) ids.add(dc.id);

    return ids.size > 0 ? Array.from(ids) : [];
  }
}
