import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus } from '@prisma/client';

@Injectable()
export class EnrollmentService {
  constructor(private prisma: PrismaService) {}

  async enrollStudent(data: {
    studentId: string;
    classId: string;
    academicYearId: string;
    schoolId: string;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
    });

    if (!student) throw new NotFoundException('Student not found');
    if (student.schoolId !== data.schoolId) throw new ForbiddenException('Invalid student');

    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
    });

    if (!academicYear) throw new NotFoundException('Academic year not found');
    if (academicYear.schoolId !== data.schoolId) throw new ForbiddenException('Invalid academic year');

    const classEntity = await this.prisma.class.findUnique({
      where: { id: data.classId },
    });

    if (!classEntity) throw new NotFoundException('Class not found');
    if (classEntity.schoolId !== data.schoolId) throw new ForbiddenException('Invalid class');

    const existing = await this.prisma.enrollment.findFirst({
      where: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
      },
    });

    if (existing) throw new ForbiddenException('Student already enrolled in this academic year');

    return this.prisma.enrollment.create({
      data: {
        studentId: data.studentId,
        classId: data.classId,
        academicYearId: data.academicYearId,
        schoolId: data.schoolId,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  async getActiveEnrollmentsByClass(classId: string) {
    return this.prisma.enrollment.findMany({
      where: {
        classId,
        status: EnrollmentStatus.ACTIVE,
      },
      include: {
        student: true,
      },
    });
  }
}
