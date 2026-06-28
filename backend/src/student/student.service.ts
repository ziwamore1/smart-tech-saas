import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Prisma, EnrollmentStatus } from '@prisma/client';
import { PasswordGenerationService } from '../identity-service/password-generation.service';
import { UsernameGenerationService } from '../identity-service/username-generation.service';
import { CredentialDeliveryService } from '../identity-service/credential-delivery.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    private prisma: PrismaService,
    private passwordGenService: PasswordGenerationService,
    private usernameGenService: UsernameGenerationService,
    private credentialDeliveryService: CredentialDeliveryService,
  ) {}

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

    const student = await this.prisma.student.create({ data });

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const schoolUrl = `${frontendUrl}/login?school=${schoolId}`;

    const studentPassword = this.passwordGenService.generateRoleBasedPassword('Student');
    const studentUsername = this.usernameGenService.generateUsername(
      dto.firstName, dto.lastName, 'Student', schoolId,
    );
    const hashedStudentPwd = await bcrypt.hash(studentPassword.password, 10);

    const studentUser = await this.prisma.user.upsert({
      where: { email: `${studentUsername}@student.smarttech.edu` },
      create: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: `${studentUsername}@student.smarttech.edu`,
        username: studentUsername,
        password: hashedStudentPwd,
        schoolId,
        studentId: student.id,
        mustChangePassword: true,
      },
      update: {},
    });

    const studentRole = await this.prisma.role.findFirst({ where: { name: 'Student' } });
    if (studentRole) {
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId: studentUser.id, roleId: studentRole.id } },
        create: { userId: studentUser.id, roleId: studentRole.id },
        update: {},
      });
    }

    if (dto.linkingParentId) {
      await this.linkStudentToParent(student.id, dto.linkingParentId);
    } else if (dto.parentEmail || dto.parentPhone) {
      try {
        await this.createParentWithCredentials({
          parentName: dto.parentName,
          parentEmail: dto.parentEmail,
          parentPhone: dto.parentPhone,
          studentFirstName: dto.firstName,
          studentName: `${dto.firstName} ${dto.lastName}`,
          studentUsername,
          studentPassword: studentPassword.password,
        }, student.id, schoolId, school, schoolUrl);
      } catch (parentErr) {
        this.logger.warn(`Parent account creation skipped for student ${student.id}: ${parentErr.message}`);
      }
    }

    return {
      ...student,
      credentials: {
        student: {
          username: studentUsername,
          password: studentPassword.password,
          mustChangePassword: true,
        },
      },
    };
  }

  private async createParentWithCredentials(
    info: {
      parentName?: string;
      parentEmail?: string;
      parentPhone?: string;
      studentFirstName: string;
      studentName: string;
      studentUsername: string;
      studentPassword: string;
    },
    studentId: string,
    schoolId: string,
    school: { id: string; name: string } | null,
    schoolUrl: string,
  ) {
    const parentName = info.parentName || `${info.studentFirstName}'s Parent`;
    const nameParts = parentName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Parent';

    const existingParentUser = info.parentEmail
      ? await this.prisma.user.findFirst({ where: { email: info.parentEmail } })
      : null;

    if (existingParentUser) {
      const existingParent = await this.prisma.parent.findFirst({ where: { email: info.parentEmail } });
      if (existingParent) {
        await this.prisma.parentStudent.upsert({
          where: { parentId_studentId: { parentId: existingParent.id, studentId } },
          create: { parentId: existingParent.id, studentId },
          update: {},
        });
        // Send bundled credentials to existing parent
        this.credentialDeliveryService.deliverBundledCredentials({
          parentUserId: existingParentUser.id,
          studentUserId: studentId,
          parentEmail: info.parentEmail,
          parentPhone: info.parentPhone,
          parentUsername: existingParentUser.username || existingParentUser.email,
          parentPassword: 'Use existing password',
          parentName: `${existingParent.firstName} ${existingParent.lastName}`,
          studentUsername: info.studentUsername,
          studentPassword: info.studentPassword,
          studentName: info.studentName,
          schoolName: school?.name,
          schoolUrl,
          channel: info.parentEmail ? 'EMAIL' : 'SMS',
        }).catch(err => this.logger.error(`Failed to send bundled credentials to existing parent: ${err.message}`));
        return;
      }
      // User exists but no Parent record — re-use the user and create Parent record
      const parentRole = await this.prisma.role.findFirst({ where: { name: 'Parent' } });
      if (parentRole) {
        await this.prisma.userRole.upsert({
          where: { userId_roleId: { userId: existingParentUser.id, roleId: parentRole.id } },
          create: { userId: existingParentUser.id, roleId: parentRole.id },
          update: {},
        });
      }
      const parentRecord = await this.prisma.parent.create({
        data: {
          firstName: existingParentUser.firstName,
          lastName: existingParentUser.lastName,
          email: existingParentUser.email,
          phone: info.parentPhone || existingParentUser.phone,
          password: existingParentUser.password,
          schoolId,
          children: { create: { studentId } },
        },
      });
      // Send bundled credentials to the newly created parent record
      this.credentialDeliveryService.deliverBundledCredentials({
        parentUserId: existingParentUser.id,
        studentUserId: studentId,
        parentEmail: existingParentUser.email || undefined,
        parentPhone: info.parentPhone,
        parentUsername: existingParentUser.username || existingParentUser.email,
        parentPassword: 'See admin for password reset',
        parentName: `${parentRecord.firstName} ${parentRecord.lastName}`,
        studentUsername: info.studentUsername,
        studentPassword: info.studentPassword,
        studentName: info.studentName,
        schoolName: school?.name,
        schoolUrl,
        channel: existingParentUser.email ? 'EMAIL' : 'SMS',
      }).catch(err => this.logger.error(`Failed to send bundled credentials: ${err.message}`));
      return;
    }

    const parentPassword = this.passwordGenService.generateRoleBasedPassword('Parent');
    const parentUsername = info.parentEmail
      ? info.parentEmail
      : this.usernameGenService.generateUsername(firstName, lastName, 'Parent', schoolId);

    const hashedParentPwd = await bcrypt.hash(parentPassword.password, 10);

    const parentEmail = info.parentEmail
      || `parent_${firstName.toLowerCase()}.${lastName.toLowerCase()}.${schoolId.slice(0, 6)}@internal.smarttech.edu`;

    const parentUser = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email: parentEmail,
        phone: info.parentPhone,
        password: hashedParentPwd,
        username: parentUsername,
        schoolId,
        mustChangePassword: true,
      },
    });

    const parentRole = await this.prisma.role.findFirst({ where: { name: 'Parent' } });
    if (parentRole) {
      await this.prisma.userRole.create({
        data: { userId: parentUser.id, roleId: parentRole.id },
      });
    }

    const parentRecord = await this.prisma.parent.create({
      data: {
        firstName,
        lastName,
        email: parentEmail,
        phone: info.parentPhone,
        password: hashedParentPwd,
        schoolId,
        children: { create: { studentId } },
      },
    });

    this.credentialDeliveryService.deliverBundledCredentials({
      parentUserId: parentUser.id,
      studentUserId: studentId,
      parentEmail: info.parentEmail,
      parentPhone: info.parentPhone,
      parentUsername,
      parentPassword: parentPassword.password,
      parentName,
      studentUsername: info.studentUsername,
      studentPassword: info.studentPassword,
      studentName: info.studentName,
      schoolName: school?.name,
      schoolUrl,
      channel: info.parentEmail ? 'EMAIL' : 'SMS',
    }).catch(err => this.logger.error(`Failed to send bundled credentials: ${err.message}`));
  }

  async getStudentCredentials(studentId: string, requesterId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const user = await this.prisma.user.findFirst({
      where: { studentId },
      select: { username: true, mustChangePassword: true, id: true },
    });

    if (!user) throw new NotFoundException('Student user account not found. Generate credentials first.');

    const latestCredential = await this.prisma.userCredential.findFirst({
      where: { userId: user.id },
      orderBy: { generatedAt: 'desc' },
    });

    return {
      username: user.username,
      mustChangePassword: user.mustChangePassword,
      lastGenerated: latestCredential?.generatedAt || null,
      lastDelivered: latestCredential?.deliveredAt || null,
      deliveryStatus: latestCredential?.deliveryStatus || 'NEVER',
    };
  }

  async generateAndDeliverStudentCredentials(
    studentId: string,
    requesterId: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' = 'EMAIL',
  ) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const school = await this.prisma.school.findUnique({ where: { id: student.schoolId } });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const schoolUrl = `${frontendUrl}/login?school=${student.schoolId}`;

    let user = await this.prisma.user.findFirst({ where: { studentId } });
    if (!user) {
      const generated = this.passwordGenService.generateRoleBasedPassword('Student');
      const username = this.usernameGenService.generateUsername(
        student.firstName, student.lastName, 'Student', student.schoolId,
      );
      const hashedPwd = await bcrypt.hash(generated.password, 10);

      user = await this.prisma.user.create({
        data: {
          firstName: student.firstName,
          lastName: student.lastName,
          email: `${username}@student.smarttech.edu`,
          username,
          password: hashedPwd,
          schoolId: student.schoolId,
          studentId: student.id,
          mustChangePassword: true,
        },
      });

      const studentRole = await this.prisma.role.findFirst({ where: { name: 'Student' } });
      if (studentRole) {
        await this.prisma.userRole.create({
          data: { userId: user.id, roleId: studentRole.id },
        });
      }
    }

    return this.credentialDeliveryService.deliverStudentCredentialsOnRequest({
      userId: user.id,
      recipientEmail: user.email || undefined,
      recipientPhone: user.phone || undefined,
      username: user.username || '',
      password: 'See admin for password reset',
      recipientName: `${student.firstName} ${student.lastName}`,
      role: 'Student',
      schoolName: school?.name,
      schoolUrl,
      channel,
    });
  }

  linkStudentToParentWithCredentials
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

  async uploadPhoto(id: string, photoUrl: string, photoPublicId: string, schoolId: string): Promise<string | null> {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    if (student.schoolId !== schoolId) throw new ForbiddenException('Invalid student');
    const oldPublicId = student.photoPublicId;
    await this.prisma.student.update({
      where: { id },
      data: { photoUrl, photoPublicId },
    });
    return oldPublicId;
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
