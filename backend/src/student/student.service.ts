import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Prisma, EnrollmentStatus } from '@prisma/client';

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStudentDto, schoolId: string) {
    const allowedFields = ['firstName', 'lastName', 'admissionNumber', 'dateOfBirth', 'gender'];
    const data: any = {};
    for (const key of allowedFields) {
      if (dto[key]) data[key] = dto[key];
    }
    data.schoolId = schoolId;
    if (dto.dateOfBirth) {
      data.dateOfBirth = new Date(dto.dateOfBirth);
    }
    return this.prisma.student.create({
      data,
    });
  }

  async findAll(schoolId: string, classId?: string) {
    const where: Prisma.StudentWhereInput = { schoolId };
    if (classId) {
      where.enrollments = {
        some: {
          classId,
          status: EnrollmentStatus.ACTIVE,
        },
      };
    }
    return this.prisma.student.findMany({
      where,
      include: {
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          include: { class: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: { class: true, academicYear: true },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async update(id: string, dto: UpdateStudentDto) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    const allowedFields = ['firstName', 'lastName', 'admissionNumber', 'dateOfBirth', 'gender', 'photoUrl'];
    const data: any = {};
    for (const key of allowedFields) {
      if (dto[key]) data[key] = dto[key];
    }
    if (dto.dateOfBirth) {
      data.dateOfBirth = new Date(dto.dateOfBirth);
    }
    return this.prisma.student.update({
      where: { id },
      data,
    });
  }

  async uploadPhoto(id: string, photoUrl: string, schoolId: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    if (student.schoolId !== schoolId) throw new ForbiddenException('Invalid student');
    return this.prisma.student.update({
      where: { id },
      data: { photoUrl },
    });
  }

  async delete(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    try {
      await this.prisma.student.delete({ where: { id } });
      return { message: 'Student deleted successfully' };
    } catch (error: any) {
      console.error('Delete student error:', error);
      if (error.code === 'P2003' || error.code === 'P2014') {
        throw new ConflictException('Cannot delete student - it has related records like enrollments, results, or attendance. Please remove related data first.');
      }
      throw error;
    }
  }

  async enroll(studentId: string, academicYearId: string, classId: string, schoolId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    if (student.schoolId !== schoolId) throw new ForbiddenException('Invalid student');

    const existing = await this.prisma.enrollment.findFirst({
      where: { studentId, academicYearId },
    });
    if (existing) throw new ForbiddenException('Student already enrolled in this academic year');

    return this.prisma.enrollment.create({
      data: {
        studentId,
        academicYearId,
        classId,
        schoolId,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  async promoteStudent(fromAcademicYearId: string, toAcademicYearId: string, schoolId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        academicYearId: fromAcademicYearId,
        schoolId,
        status: EnrollmentStatus.ACTIVE,
      },
      include: { student: true },
    });

    const promotions = [];
    for (const enrollment of enrollments) {
      const newEnrollment = await this.prisma.enrollment.create({
        data: {
          studentId: enrollment.studentId,
          academicYearId: toAcademicYearId,
          classId: enrollment.classId,
          schoolId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      promotions.push(newEnrollment);
    }
    return promotions;
  }
}
