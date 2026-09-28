import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClassAccessService } from '../common/access/class-access.service';
import { DEFAULT_AGE_BANDS } from './age-band.defaults';

@Injectable()
export class ClassService {
  private readonly logger = new Logger(ClassService.name);
  constructor(
    private prisma: PrismaService,
    private classAccess: ClassAccessService,
  ) {}

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

  async update(id: string, data: { name?: string; capacity?: number | null; order?: number; gradingSystemId?: string | null; includeDigitalStamp?: boolean; includeDigitalSignature?: boolean }, schoolId: string) {
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
    if (data.includeDigitalStamp !== undefined) updateData.includeDigitalStamp = data.includeDigitalStamp;
    if (data.includeDigitalSignature !== undefined) updateData.includeDigitalSignature = data.includeDigitalSignature;

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
    const roles = (user.roles ?? []).map((r) => r.toUpperCase().replace(/\s+/g, ''));
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
        where: { teacherId: user.id, schoolId: user.schoolId, isActive: true },
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

    if (ids.size > 0) return Array.from(ids);

    // No assignment-based classes. If this user is permitted to view classes /
    // class students or enter results (role default or explicit grant), fall
    // back to all school classes so the feature works instead of showing an
    // empty list when assignments are missing or stale.
    if (await this.classAccess.canAccessClasses(user)) return null;

    return [];
  }

  async getAgeBands(schoolId: string) {
    let bands = await this.prisma.ageBand.findMany({
      where: { schoolId, isActive: true },
      orderBy: [{ order: 'asc' }, { minAge: 'asc' }],
    });

    if (bands.length === 0) {
      await this.prisma.ageBand.createMany({
        data: DEFAULT_AGE_BANDS.map((band) => ({ ...band, schoolId })),
        skipDuplicates: true,
      });
      bands = await this.prisma.ageBand.findMany({
        where: { schoolId, isActive: true },
        orderBy: [{ order: 'asc' }, { minAge: 'asc' }],
      });
    }

    return bands;
  }

  async createAgeBand(data: { label: string; minAge: number; maxAgeExclusive?: number | null; order?: number }, schoolId: string) {
    if (!data.label?.trim()) throw new BadRequestException('Age band label is required');
    this.validateAgeBand(data);
    return this.prisma.ageBand.create({
      data: {
        schoolId,
        label: data.label.trim(),
        minAge: data.minAge,
        maxAgeExclusive: data.maxAgeExclusive ?? null,
        order: data.order ?? 0,
      },
    });
  }

  async updateAgeBand(id: string, data: { label?: string; minAge?: number; maxAgeExclusive?: number | null; order?: number; isActive?: boolean }, schoolId: string) {
    const band = await this.prisma.ageBand.findFirst({ where: { id, schoolId } });
    if (!band) throw new NotFoundException('Age band not found');
    if (data.label !== undefined && !data.label.trim()) throw new BadRequestException('Age band label is required');
    this.validateAgeBand({ minAge: data.minAge ?? band.minAge, maxAgeExclusive: data.maxAgeExclusive === undefined ? band.maxAgeExclusive : data.maxAgeExclusive });
    return this.prisma.ageBand.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label.trim() } : {}),
        ...(data.minAge !== undefined ? { minAge: data.minAge } : {}),
        ...(data.maxAgeExclusive !== undefined ? { maxAgeExclusive: data.maxAgeExclusive } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async getAgeSummary(classId: string, schoolId: string) {
    if (!classId) throw new BadRequestException('classId is required');
    const selectedClass = await this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true, levelTypeId: true, levelType: { select: { id: true, name: true } } },
    });
    if (!selectedClass) throw new NotFoundException('Class not found');

    const bands = await this.getAgeBands(schoolId);
    const classes = await this.prisma.class.findMany({
      where: { schoolId, levelTypeId: selectedClass.levelTypeId },
      select: { id: true, name: true },
      orderBy: { order: 'asc' },
    });
    const classIds = classes.map((item) => item.id);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, classId: { in: classIds }, status: 'ACTIVE' },
      select: { classId: true, student: { select: { dateOfBirth: true, gender: true, status: true } } },
    });

    const today = new Date();
    const getAge = (dob: Date) => {
      let age = today.getFullYear() - dob.getFullYear();
      if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age -= 1;
      return age;
    };
    const empty = () => ({ male: 0, female: 0, other: 0, total: 0 });
    const build = (classFilter?: string) => {
      const rows = bands.map((band) => ({ label: band.label, minAge: band.minAge, maxAgeExclusive: band.maxAgeExclusive, ...empty() }));
      let missingDob = 0;
      let totalStudents = 0;
      for (const enrollment of enrollments) {
        if (classFilter && enrollment.classId !== classFilter) continue;
        totalStudents += 1;
        if (!enrollment.student.dateOfBirth) { missingDob += 1; continue; }
        const age = getAge(enrollment.student.dateOfBirth);
        const row = rows.find((band) => age >= band.minAge && (band.maxAgeExclusive == null || age < band.maxAgeExclusive));
        if (!row) { missingDob += 1; continue; }
        const gender = String(enrollment.student.gender || '').toLowerCase();
        if (gender === 'male' || gender === 'm') row.male += 1;
        else if (gender === 'female' || gender === 'f') row.female += 1;
        else row.other += 1;
        row.total += 1;
      }
      return { totalStudents, missingDob, bands: rows };
    };

    return {
      bands,
      selectedClass,
      level: { ...selectedClass.levelType, classes, ...build() },
      class: { id: selectedClass.id, name: selectedClass.name, ...build(selectedClass.id) },
    };
  }

  private validateAgeBand(data: { minAge: number; maxAgeExclusive?: number | null }) {
    if (!Number.isInteger(data.minAge) || data.minAge < 0 || (data.maxAgeExclusive != null && (!Number.isInteger(data.maxAgeExclusive) || data.maxAgeExclusive <= data.minAge))) {
      throw new BadRequestException('Age band boundaries are invalid');
    }
  }
}
