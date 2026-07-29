import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Prisma, EnrollmentStatus, StudentStatus } from '@prisma/client';
import { PasswordGenerationService } from '../identity-service/password-generation.service';
import { UsernameGenerationService } from '../identity-service/username-generation.service';
import { CredentialDeliveryService } from '../identity-service/credential-delivery.service';
import { AdmissionNumberService } from '../admission-number/admission-number.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    private prisma: PrismaService,
    private passwordGenService: PasswordGenerationService,
    private usernameGenService: UsernameGenerationService,
    private credentialDeliveryService: CredentialDeliveryService,
    private admissionNumberService: AdmissionNumberService,
    @Optional() private schoolEvents?: SchoolEventsGateway,
  ) {}

  async create(dto: CreateStudentDto, schoolId: string, userId: string, userRoles: string[]) {
    const academicYearId = dto.academicYearId || await this.getCurrentAcademicYearId(schoolId);

    let admissionNumber = dto.admissionNumber;

    if (dto.manualOverride) {
      if (!this.canOverrideAdmission(userRoles)) {
        throw new ForbiddenException('Only Directors and SuperAdmin may manually override admission numbers');
      }
      if (!admissionNumber) {
        throw new Error('admissionNumber is required when manualOverride is true');
      }
      await this.admissionNumberService.setManualAdmissionNumber(schoolId, academicYearId, admissionNumber, dto.classId);
    } else {
      admissionNumber = await this.admissionNumberService.getNextAdmissionNumber(schoolId, academicYearId, dto.classId);
    }

    const existing = await this.prisma.student.findFirst({
      where: {
        schoolId,
        firstName: { equals: dto.firstName, mode: 'insensitive' },
        lastName: { equals: dto.lastName, mode: 'insensitive' },
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        NOT: { status: 'WITHDRAWN' as StudentStatus },
      },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, dateOfBirth: true, status: true },
    });

    if (existing) {
      throw new ConflictException(
        `A student with the name "${existing.firstName} ${existing.lastName}" and date of birth ${dto.dateOfBirth} already exists (Admission: ${existing.admissionNumber}, Status: ${existing.status.toLowerCase()}). Please verify before registering.`
      );
    }

    const createData: any = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      admissionNumber,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      gender: dto.gender,
      status: (dto.status as StudentStatus) || StudentStatus.ACTIVE,
      schoolId,
      classId: dto.classId || null,
    };

    if (dto.grade) createData.grade = dto.grade;
    if (dto.className) createData.className = dto.className;

    let student;
    try {
      student = await this.prisma.student.create({
        data: createData,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          `A student with admission number "${admissionNumber}" already exists in this school. Duplicate registration prevented.`
        );
      }
      if (error.code === 'P2022' || error.message?.includes('column') || error.message?.includes('grade') || error.message?.includes('className')) {
        this.logger.warn(`Student create failed with grade/className columns, retrying without: ${error.message}`);
        delete createData.grade;
        delete createData.className;
        student = await this.prisma.student.create({
          data: createData,
        });
      } else {
        throw error;
      }
    }

    await this.createAuditLog(userId, schoolId, 'ADMISSION_GENERATED', 'Student', student.id, {
      admissionNumber,
      method: dto.manualOverride ? 'MANUAL_OVERRIDE' : 'AUTO_GENERATED',
    });

    if (dto.classId) {
      try {
        await this.enroll(student.id, academicYearId, dto.classId, schoolId);
      } catch (err) {
        this.logger.warn(`Auto-enrollment failed for student ${student.id}: ${err.message}`);
      }
    }

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
      update: {
        studentId: student.id,
        password: hashedStudentPwd,
        mustChangePassword: true,
      },
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

    if (this.schoolEvents) {
      this.schoolEvents.emitStudentEnrolled(schoolId, {
        studentId: student.id,
        classId: dto.classId || '',
      });
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

  private canOverrideAdmission(roles: string[]): boolean {
    const overrideRoles = ['Director', 'SuperAdmin'];
    return roles.some(role => overrideRoles.includes(role));
  }

  async getCurrentAcademicYearId(schoolId: string): Promise<string> {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!year) throw new NotFoundException('No current academic year found for this school');
    return year.id;
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
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: {
      id: true, admissionNumber: true, studentUuid: true, status: true, schoolId: true,
      firstName: true, lastName: true, gender: true, photoUrl: true,
    }});
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
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: {
      id: true, admissionNumber: true, studentUuid: true, status: true, schoolId: true,
      firstName: true, lastName: true, gender: true, photoUrl: true,
    }});
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

  async linkStudentToParent(studentId: string, parentId: string) {
    return this.linkStudentToParentWithCredentials(studentId, parentId);
  }

  async linkStudentToParentWithCredentials(studentId: string, parentId: string) {
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

  async findAll(
    schoolId: string,
    options?: {
      classId?: string;
      status?: string;
      includeInactive?: boolean;
      search?: string;
    },
  ) {
    const where: Prisma.StudentWhereInput = { schoolId };

    if (!options?.includeInactive) {
      where.status = StudentStatus.ACTIVE;
    } else if (options?.status) {
      where.status = options.status as StudentStatus;
    }

    if (options?.classId) {
      where.enrollments = {
        some: {
          classId: options.classId,
          ...(options.includeInactive ? {} : { status: EnrollmentStatus.ACTIVE }),
        },
      };
    }

    if (options?.search) {
      const search = options.search;
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { admissionNumber: { contains: search, mode: 'insensitive' } },
        { studentUuid: { contains: search, mode: 'insensitive' } },
      ];
    }

    const enrollmentIncludes = {
      include: { class: true, academicYear: true },
      orderBy: { academicYear: { startDate: 'desc' } as const },
    };

    return this.prisma.student.findMany({
      where,
      select: {
        id: true, admissionNumber: true, studentUuid: true, status: true,
        dateOfBirth: true, schoolId: true, firstName: true, lastName: true,
        gender: true, photoUrl: true, photoPublicId: true,
        enrollments: enrollmentIncludes,
        parents: { include: { parent: true } },
      },
    }).then(students => students.map(s => {
      const latestEnrollment = (s as any).enrollments?.[0];
      return {
        ...s,
        className: latestEnrollment?.class?.name || null,
        grade: null,
      };
    }));
  }

  async findOne(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: {
        id: true, admissionNumber: true, studentUuid: true, status: true,
        dateOfBirth: true, schoolId: true, firstName: true, lastName: true,
        gender: true, photoUrl: true, photoPublicId: true,
        enrollments: {
          include: { class: true, academicYear: true },
          orderBy: { academicYear: { startDate: 'desc' } },
        },
        parents: { include: { parent: true } },
        user: { select: { username: true, email: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return { ...student, className: null, grade: null };
  }

  async findByAdmissionNumber(admissionNumber: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { admissionNumber, schoolId },
      select: {
        id: true, admissionNumber: true, studentUuid: true, status: true,
        dateOfBirth: true, schoolId: true, firstName: true, lastName: true,
        gender: true, photoUrl: true, photoPublicId: true,
        enrollments: { include: { class: true, academicYear: true }, orderBy: { academicYear: { startDate: 'desc' } } },
        parents: { include: { parent: true } },
        FeePayment: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return { ...student, className: null, grade: null };
  }

  async comprehensiveSearch(query: string, schoolId: string) {
    return await this.prisma.student.findMany({
      where: {
        schoolId,
        OR: [
          { admissionNumber: { contains: query, mode: 'insensitive' } },
          { studentUuid: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, admissionNumber: true, studentUuid: true, status: true,
        dateOfBirth: true, schoolId: true, firstName: true, lastName: true,
        gender: true, photoUrl: true, photoPublicId: true,
        enrollments: { include: { class: true, academicYear: true }, orderBy: { academicYear: { startDate: 'desc' } } },
        parents: { include: { parent: true } },
        user: { select: { username: true, email: true } },
        results: { include: { subject: true, term: true }, orderBy: { createdAt: 'desc' }, take: 10 },
        attendances: { orderBy: { date: 'desc' }, take: 10 },
        FeePayment: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    }).then(students => students.map(s => ({ ...s, className: null, grade: null })));
  }

  async update(id: string, dto: UpdateStudentDto, userId: string, userRoles: string[]) {
    const student = await this.prisma.student.findUnique({ where: { id }, select: {
      id: true, admissionNumber: true, studentUuid: true, status: true, schoolId: true,
      firstName: true, lastName: true, gender: true,
    }});
    if (!student) throw new NotFoundException('Student not found');

    if (dto.admissionNumber && dto.admissionNumber !== student.admissionNumber) {
      if (!this.canOverrideAdmission(userRoles)) {
        throw new ForbiddenException('Only Directors and SuperAdmin may change admission numbers');
      }
      const valid = await this.admissionNumberService.validateAdmissionNumber(
        student.schoolId, dto.admissionNumber,
      );
      if (!valid) {
        throw new ConflictException(`Admission number ${dto.admissionNumber} already exists in this school`);
      }
    }

    const allowedFields = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'photoUrl'];
    const data: any = {};

    if (dto.admissionNumber && this.canOverrideAdmission(userRoles)) {
      data.admissionNumber = dto.admissionNumber;
    }

    if (dto.status) {
      data.status = dto.status as StudentStatus;
    }

    for (const key of allowedFields) {
      if (dto[key]) data[key] = dto[key];
    }
    if (dto.dateOfBirth) {
      data.dateOfBirth = new Date(dto.dateOfBirth);
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data,
    });

    if (dto.admissionNumber && dto.admissionNumber !== student.admissionNumber) {
      await this.createAuditLog(userId, student.schoolId, 'ADMISSION_OVERRIDDEN', 'Student', student.id, {
        oldAdmissionNumber: student.admissionNumber,
        newAdmissionNumber: dto.admissionNumber,
        overriddenBy: userId,
      });
    }

    if (dto.status && dto.status !== student.status) {
      await this.createAuditLog(userId, student.schoolId, 'STATUS_CHANGED', 'Student', student.id, {
        oldStatus: student.status,
        newStatus: dto.status,
      });
    }

    return updated;
  }

  async uploadPhoto(id: string, photoUrl: string, photoPublicId: string, schoolId: string): Promise<string | null> {
    const student = await this.prisma.student.findUnique({ where: { id }, select: {
      id: true, admissionNumber: true, studentUuid: true, status: true, schoolId: true,
      firstName: true, lastName: true, gender: true, photoUrl: true,
    }});
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
    const student = await this.prisma.student.findUnique({ where: { id }, select: {
      id: true, admissionNumber: true, studentUuid: true, status: true, schoolId: true,
      firstName: true, lastName: true, gender: true, photoUrl: true,
    }});
    if (!student) throw new NotFoundException('Student not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.deleteMany({ where: { studentId: id } });
      await tx.studentAssessmentResult.deleteMany({ where: { studentId: id } });
      await tx.computedResult.deleteMany({ where: { studentId: id } });
      await tx.termSummary.deleteMany({ where: { studentId: id } });
      await tx.attendance.deleteMany({ where: { studentId: id } });
      await tx.studentSubject.deleteMany({ where: { studentId: id } });
      await tx.result.deleteMany({ where: { studentId: id } });
      await tx.student.delete({ where: { id } });
    });

    return { message: 'Student deleted successfully' };
  }

  async enroll(studentId: string, academicYearId: string, classId: string, schoolId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    if (student.schoolId !== schoolId) throw new ForbiddenException('Invalid student');

    const existing = await this.prisma.enrollment.findFirst({
      where: { studentId, academicYearId },
    });
    if (existing) throw new ForbiddenException('Student already enrolled in this academic year');

    const enrollment = await this.prisma.enrollment.create({
      data: {
        studentId,
        academicYearId,
        classId,
        schoolId,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    if (student.status !== StudentStatus.ACTIVE) {
      await this.prisma.student.update({
        where: { id: studentId },
        data: { status: StudentStatus.ACTIVE },
      });
    }

    return enrollment;
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
      const existing = await this.prisma.enrollment.findFirst({
        where: { studentId: enrollment.studentId, academicYearId: toAcademicYearId },
      });
      if (existing) continue;

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

  async changeStatus(studentId: string, newStatus: StudentStatus, userId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: {
      id: true, admissionNumber: true, studentUuid: true, status: true, schoolId: true,
      firstName: true, lastName: true, gender: true, photoUrl: true,
    }});
    if (!student) throw new NotFoundException('Student not found');

    const oldStatus = student.status;

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: { status: newStatus },
    });

    if (newStatus === StudentStatus.TRANSFERRED || newStatus === StudentStatus.WITHDRAWN || newStatus === StudentStatus.GRADUATED) {
      await this.prisma.enrollment.updateMany({
        where: { studentId, status: EnrollmentStatus.ACTIVE },
        data: { status: EnrollmentStatus.INACTIVE },
      });
    }

    if (oldStatus !== newStatus) {
      await this.createAuditLog(userId, student.schoolId, 'STATUS_CHANGED', 'Student', student.id, {
        oldStatus,
        newStatus,
        changedBy: userId,
      });
    }

    return updated;
  }

  async getStatusHistory(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: {
      id: true, admissionNumber: true, studentUuid: true, status: true, schoolId: true,
      firstName: true, lastName: true, gender: true, photoUrl: true,
    }});
    if (!student) throw new NotFoundException('Student not found');

    const logs = await this.prisma.auditLog.findMany({
      where: {
        recordId: studentId,
        model: 'Student',
        action: { in: ['STATUS_CHANGED', 'ADMISSION_GENERATED', 'ADMISSION_OVERRIDDEN'] },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs;
  }

  private async createAuditLog(
    userId: string,
    schoolId: string,
    action: string,
    model: string,
    recordId: string,
    changes?: any,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, schoolId, action, model, recordId, changes },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
    }
  }
}
