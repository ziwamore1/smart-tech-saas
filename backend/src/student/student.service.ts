import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Prisma, EnrollmentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

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

    let parentId: string | undefined;

    if (dto.linkingParentId) {
      parentId = dto.linkingParentId;
    }

    const student = await this.prisma.student.create({ data });

    if (parentId || dto.parentEmail || dto.parentPhone) {
      await this.findOrCreateParent({
        parentName: dto.parentName,
        parentEmail: dto.parentEmail,
        parentPhone: dto.parentPhone,
        studentFirstName: dto.firstName,
      }, student.id, schoolId, parentId);
    }

    return student;
  }

  async linkStudentToParent(studentId: string, parentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    const parent = await this.prisma.parent.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Parent not found');
    if (parent.schoolId !== student.schoolId) throw new ForbiddenException('Parent and student must be in the same school');

    await this.prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId, studentId } },
      create: { parentId, studentId },
      update: {},
    });

    return { message: 'Student linked to parent successfully' };
  }

  async unlinkStudentFromParent(studentId: string, parentId: string) {
    await this.prisma.parentStudent.deleteMany({
      where: { parentId, studentId },
    });
    return { message: 'Student unlinked from parent successfully' };
  }

  private async findOrCreateParent(
    info: { parentName?: string; parentEmail?: string; parentPhone?: string; studentFirstName: string },
    studentId: string,
    schoolId: string,
    existingParentId?: string,
  ) {
    if (existingParentId) {
      await this.prisma.parentStudent.upsert({
        where: { parentId_studentId: { parentId: existingParentId, studentId } },
        create: { parentId: existingParentId, studentId },
        update: {},
      });
      return;
    }

    return this.prisma.$transaction(async (tx) => {
      let parent: any = null;

      if (info.parentEmail) {
        parent = await tx.parent.findUnique({ where: { email: info.parentEmail } });
      }

      if (!parent && info.parentPhone) {
        parent = await tx.parent.findFirst({ where: { phone: info.parentPhone, schoolId } });
      }

      if (parent) {
        await tx.parentStudent.upsert({
          where: { parentId_studentId: { parentId: parent.id, studentId } },
          create: { parentId: parent.id, studentId },
          update: {},
        });
        return;
      }

      const tempPassword = 'Parent123!';
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const parentName = info.parentName || `${info.studentFirstName}'s Parent`;
      const nameParts = parentName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Parent';
      const email = info.parentEmail
        || (info.parentPhone ? `parent_${info.parentPhone.replace(/[^0-9]/g, '')}@internal.school` : null)
        || `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${schoolId.slice(0, 6)}@internal.school`;

      await tx.parent.create({
        data: {
          firstName,
          lastName,
          email,
          phone: info.parentPhone,
          password: hashedPassword,
          schoolId,
          children: { create: { studentId } },
        },
      });
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
