import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassService {
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

  async findAll(schoolId: string) {
    if (!schoolId) return [];
    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      include: {
        levelType: true,
        gradingSystem: {
          select: { id: true, name: true },
        },
        classTeacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              select: { id: true, gender: true },
            },
          },
        },
      },
      orderBy: [
        { levelTypeId: 'asc' },
        { order: 'asc' }
      ]
    });

    return classes.map((c) => {
      const males = c.enrollments.filter((e) => e.student.gender === 'MALE' || e.student.gender === 'Male' || e.student.gender === 'M').length;
      const females = c.enrollments.filter((e) => e.student.gender === 'FEMALE' || e.student.gender === 'Female' || e.student.gender === 'F').length;
      return {
        id: c.id,
        name: c.name,
        capacity: c.capacity,
        schoolId: c.schoolId,
        levelTypeId: c.levelTypeId,
        order: c.order,
        levelType: c.levelType,
        gradingSystem: c.gradingSystem,
        classTeacher: c.classTeacher,
        totalStudents: c.enrollments.length,
        maleCount: males,
        femaleCount: females,
      };
    });
  }

  async findByLevel(levelTypeId: string, schoolId: string) {
    return this.prisma.class.findMany({
      where: {
        levelTypeId,
        schoolId,
      },
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

    if (teacherId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: teacherId },
      });
      if (!teacher) throw new NotFoundException('Teacher not found');
      if (teacher.schoolId !== schoolId) throw new ForbiddenException('Teacher does not belong to this school');
    }

    return this.prisma.class.update({
      where: { id },
      data: { classTeacherId: teacherId },
      include: {
        classTeacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}
