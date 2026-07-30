import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdmissionNumberService } from '../admission-number/admission-number.service';
import { EnrollmentStatus, StudentStatus } from '@prisma/client';

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

    const existing = await this.prisma.enrollment.findFirst({
      where: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
      },
    });

    if (existing) throw new ForbiddenException('Student already enrolled in this academic year');

    const enrollment = await this.prisma.enrollment.create({
      data: {
        studentId: data.studentId,
        classId: data.classId,
        academicYearId: data.academicYearId,
        schoolId: data.schoolId,
        streamId: data.streamId,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    const updateData: any = { classId: data.classId };
    if (student.status !== StudentStatus.ACTIVE) {
      updateData.status = StudentStatus.ACTIVE;
    }

    try {
      const newAdmissionNumber = await this.admissionNumberService.getNextAdmissionNumber(
        data.schoolId, data.academicYearId, data.classId,
      );
      updateData.admissionNumber = newAdmissionNumber;
      this.logger.log(`Re-sequenced student ${data.studentId} admission number to ${newAdmissionNumber} for class ${data.classId}`);
    } catch (error) {
      this.logger.error(`Failed to re-sequence admission number for student ${data.studentId}: ${(error as Error).message}`);
    }

    await this.prisma.student.update({
      where: { id: data.studentId },
      data: updateData,
    });

    return enrollment;
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

    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status },
    });
  }
}
