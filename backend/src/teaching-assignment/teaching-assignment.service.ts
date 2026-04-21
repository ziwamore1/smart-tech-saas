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
    const user = await this.prisma.user.findUnique({
      where: { id: teacherId },
    });

    if (!user) throw new NotFoundException('Teacher not found');

    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: user.id },
      include: { user: true },
    });

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
        teacherId,
        subjectId,
        classId,
        academicYearId,
        schoolId,
      },
    });
  }

  async findAll(schoolId: string) {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { schoolId },
      include: {
        teacher: true,
        subject: true,
        class: true,
        academicYear: true,
      },
    });
    return assignments;
  }

  async findByTeacher(teacherId: string) {
    return this.prisma.teachingAssignment.findMany({
      where: { teacherId },
      include: {
        teacher: true,
        subject: true,
        class: true,
        academicYear: true,
      },
    });
  }

  async delete(id: string) {
    await this.prisma.teachingAssignment.delete({ where: { id } });
    return { message: 'Assignment deleted successfully' };
  }
}
