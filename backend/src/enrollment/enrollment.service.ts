import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdmissionNumberService } from '../admission-number/admission-number.service';
import { EnrollmentStatus, Prisma, StudentStatus } from '@prisma/client';

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private prisma: PrismaService,
    private admissionNumberService: AdmissionNumberService,
  ) {}

  async enrollStudent(data: {
    studentId: string;
    classId: string;
    academicYearId: string;
    schoolId: string;
    streamId?: string;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
    });

    if (!student) throw new NotFoundException('Student not found');
    if (student.schoolId !== data.schoolId) throw new ForbiddenException('Invalid student');

    if (student.status === StudentStatus.TRANSFERRED) {
      throw new ForbiddenException('Cannot enroll a transferred student. Reactivate first.');
    }

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

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.enrollment.findFirst({
        where: { studentId: data.studentId, academicYearId: data.academicYearId },
      });

      if (existing) throw new ForbiddenException('Student already enrolled in this academic year');

      const enrollment = await tx.enrollment.create({
        data: {
          studentId: data.studentId,
          classId: data.classId,
          academicYearId: data.academicYearId,
          schoolId: data.schoolId,
          streamId: data.streamId,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      await tx.student.update({
        where: { id: data.studentId },
        data: {
          classId: data.classId,
          ...(student.status !== StudentStatus.ACTIVE ? { status: StudentStatus.ACTIVE } : {}),
        },
      });

      await this.admissionNumberService.resequenceClassInTransaction(
        tx, data.schoolId, data.academicYearId, data.classId,
      );

      return enrollment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 10000 });
  }

  async getActiveEnrollmentsByClass(classId: string) {
    return this.prisma.enrollment.findMany({
      where: {
        classId,
        status: EnrollmentStatus.ACTIVE,
      },
      include: { student: true },
      orderBy: [{ sequenceNumber: 'asc' }, { student: { admissionNumber: 'asc' } }],
    });
  }

  async getEnrollmentsByStudent(studentId: string) {
    return this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        class: true,
        academicYear: true,
      },
      orderBy: { academicYear: { startDate: 'desc' } },
    });
  }

  async getEnrollmentsByAcademicYear(academicYearId: string, schoolId: string, includeInactive = false) {
    const where: any = {
      academicYearId,
      schoolId,
    };

    if (!includeInactive) {
      where.status = EnrollmentStatus.ACTIVE;
    }

    return this.prisma.enrollment.findMany({
      where,
      include: {
        student: true,
        class: true,
      },
    });
  }

  async updateEnrollmentStatus(enrollmentId: string, status: EnrollmentStatus) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { status },
      });
      if (enrollment.status !== status) {
        await this.admissionNumberService.resequenceClassInTransaction(
          tx, enrollment.schoolId, enrollment.academicYearId, enrollment.classId,
        );
      }
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 10000 });
  }

  /**
   * Removes a student from a single class. The student record, its other
   * enrollments and its login credentials are all preserved — only the given
   * enrollment is deleted. The class admission sequence is then automatically
   * reset so the remaining students stay contiguously numbered.
   */
  async removeEnrollment(enrollmentId: string, schoolId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.schoolId !== schoolId) throw new ForbiddenException('Invalid enrollment');

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.delete({ where: { id: enrollmentId } });

      const remainingActive = await tx.enrollment.findMany({
        where: {
          studentId: enrollment.studentId,
          status: EnrollmentStatus.ACTIVE,
        },
        select: { classId: true, academicYearId: true },
        orderBy: { academicYear: { startDate: 'desc' } },
      });

      if (remainingActive.length === 0) {
        await tx.student.update({
          where: { id: enrollment.studentId },
          data: { classId: null },
        });
      } else {
        await tx.student.update({
          where: { id: enrollment.studentId },
          data: { classId: remainingActive[0].classId },
        });
      }

      await this.admissionNumberService.resequenceClassInTransaction(
        tx, enrollment.schoolId, enrollment.academicYearId, enrollment.classId,
      );
      if (remainingActive.length > 0) {
        const current = remainingActive[0];
        await this.admissionNumberService.resequenceClassInTransaction(
          tx, enrollment.schoolId, current.academicYearId, current.classId,
        );
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 10000 });

    return { message: 'Student removed from class successfully' };
  }
}
