import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeachingAssignmentService {
  constructor(private prisma: PrismaService) {}

  async assign(
    teacherId: string,
    subjectId: string,
    classId: string,
    academicYearId: string,
    schoolId: string,
  ) {
    let resolvedUserId = teacherId;
    let teacher;

    const user = await this.prisma.user.findUnique({
      where: { id: teacherId },
    });

    if (user) {
      teacher = await this.prisma.teacher.findFirst({
        where: { userId: user.id },
        include: { user: true },
      });
    } else {
      teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        include: { user: true },
      });
      if (teacher) {
        resolvedUserId = teacher.userId;
      }
    }

    if (!teacher) throw new NotFoundException('Teacher not found');
    if (teacher.schoolId !== schoolId) throw new ForbiddenException('Teacher does not belong to this school');

    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.schoolId !== schoolId)
      throw new ForbiddenException('Invalid subject or subject does not belong to this school');

    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity || classEntity.schoolId !== schoolId)
      throw new ForbiddenException('Invalid class or class does not belong to this school');

    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear || academicYear.schoolId !== schoolId)
      throw new ForbiddenException('Invalid academic year or academic year does not belong to this school');

    return this.prisma.teachingAssignment.create({
      data: {
        teacherId: resolvedUserId,
        subjectId,
        classId,
        academicYearId,
        schoolId,
      },
    });
  }

  async findAll(schoolId: string, page = 1, limit = 100) {
    const skip = (page - 1) * limit;
    const [assignments, total] = await this.prisma.$transaction([
      this.prisma.teachingAssignment.findMany({
        where: { schoolId },
        skip,
        take: limit,
        orderBy: { class: { name: 'asc' } },
        select: {
          id: true,
          teacherId: true,
          classId: true,
          subjectId: true,
          academicYearId: true,
          schoolId: true,
          teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
      }),
      this.prisma.teachingAssignment.count({ where: { schoolId } }),
    ]);
    return { data: assignments, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByTeacher(teacherId: string) {
    return this.prisma.teachingAssignment.findMany({
      where: { teacherId },
      select: {
        id: true,
        teacherId: true,
        classId: true,
        subjectId: true,
        academicYearId: true,
        schoolId: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  async delete(id: string) {
    await this.prisma.teachingAssignment.delete({ where: { id } });
    return { message: 'Assignment deleted successfully' };
  }
}
