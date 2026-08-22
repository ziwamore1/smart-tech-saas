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
import { SchoolActivityService } from '../common/services/school-activity.service';
import { ActivityEventType, ActivityCategory, ActivitySeverity } from '../common/types/activity-event.types';
import * as bcrypt from 'bcrypt';
import { normalizeZambianPhone } from '../common/utils/phone.util';

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
    @Optional() private readonly activityService?: SchoolActivityService,
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

    // Guard against accidental double-registration (teacher unsure whether the
    // first submission went through): block the same name in the same class
    // unless a date of birth clearly distinguishes the two students.
    if (dto.classId && dto.firstName?.trim() && dto.lastName?.trim()) {
      const sameClassDuplicate = await this.prisma.student.findFirst({
        where: {
          schoolId,
          firstName: { equals: dto.firstName.trim(), mode: 'insensitive' },
          lastName: { equals: dto.lastName.trim(), mode: 'insensitive' },
          NOT: { status: 'WITHDRAWN' as StudentStatus },
          enrollments: { some: { classId: dto.classId, status: 'ACTIVE' as any } },
        },
        select: { id: true, firstName: true, lastName: true, admissionNumber: true, dateOfBirth: true },
      });

      if (sameClassDuplicate) {
        const dobProvided = !!dto.dateOfBirth;
        const dobMatches =
          dobProvided &&
          !!sameClassDuplicate.dateOfBirth &&
          new Date(dto.dateOfBirth).getTime() === new Date(sameClassDuplicate.dateOfBirth).getTime();

        if (!dobProvided || dobMatches || !sameClassDuplicate.dateOfBirth) {
          throw new ConflictException(
            `"${sameClassDuplicate.firstName} ${sameClassDuplicate.lastName}" is already registered in this class (Admission ${sameClassDuplicate.admissionNumber}). ` +
              (dobProvided
                ? 'A student with this name and date of birth already exists — no duplicate was created.'
                : 'If this is genuinely a DIFFERENT student with the same name, enter their date of birth to register them.')
          );
        }
      }
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
        this.logger.error(`Auto-enrollment failed for student ${student.id}: ${err.message}`);
        throw err;
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
        // Re-registration under a new student number must preserve the student's
        // first login credentials — never overwrite the existing password.
        studentId: student.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: true,
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

    this.activityService?.publish({
      type: ActivityEventType.STUDENT_ENROLLED,
      category: ActivityCategory.ENROLLMENT,
      severity: ActivitySeverity.SUCCESS,
      schoolId,
      title: 'Student enrolled',
      description: `New student enrolled`,
      metadata: { studentId: student.id, classId: dto.classId || '' },
    });

    const enrolledClass = dto.classId
      ? await this.prisma.class.findUnique({ where: { id: dto.classId }, select: { id: true, name: true } })
      : null;

    return {
      ...student,
      enrolledClass: enrolledClass ? { id: enrolledClass.id, name: enrolledClass.name } : null,
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
    const parentPhone = normalizeZambianPhone(info.parentPhone);
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
        if (parentPhone) {
          await this.prisma.parent.update({ where: { id: existingParent.id }, data: { phone: parentPhone } });
          await this.prisma.user.update({ where: { id: existingParentUser.id }, data: { phone: parentPhone } });
        }
        await this.prisma.parentStudent.upsert({
          where: { parentId_studentId: { parentId: existingParent.id, studentId } },
          create: { parentId: existingParent.id, studentId },
          update: {},
        });
        this.credentialDeliveryService.deliverBundledCredentials({
          parentUserId: existingParentUser.id,
          studentUserId: studentId,
          parentEmail: info.parentEmail,
          parentPhone,
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
           phone: parentPhone || normalizeZambianPhone(existingParentUser.phone),
          password: existingParentUser.password,
          schoolId,
          children: { create: { studentId } },
        },
      });
      this.credentialDeliveryService.deliverBundledCredentials({
        parentUserId: existingParentUser.id,
        studentUserId: studentId,
        parentEmail: existingParentUser.email || undefined,
         parentPhone,
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
         phone: parentPhone,
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
         phone: parentPhone,
        password: hashedParentPwd,
        schoolId,
        children: { create: { studentId } },
      },
    });

    this.credentialDeliveryService.deliverBundledCredentials({
      parentUserId: parentUser.id,
      studentUserId: studentId,
      parentEmail: info.parentEmail,
       parentPhone,
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
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.StudentWhereInput = { schoolId };

    if (options?.status) {
      where.status = options.status as StudentStatus;
    } else if (!options?.includeInactive) {
      where.status = StudentStatus.ACTIVE;
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

    const page = options?.page || 1;
    const limit = Math.min(options?.limit && options.limit > 0 ? options.limit : 10000, 10000);
    const skip = (page - 1) * limit;
    const sortByClassSequence = Boolean(options?.classId);

    const [students, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        ...(sortByClassSequence ? {} : { skip, take: limit, orderBy: { lastName: 'asc' as const } }),
        select: {
          id: true, admissionNumber: true, studentUuid: true, status: true,
          dateOfBirth: true, schoolId: true, firstName: true, lastName: true,
          gender: true, photoUrl: true, photoPublicId: true,
          enrollments: {
            where: options?.classId
              ? {
                  classId: options.classId,
                  ...(options.includeInactive ? {} : { status: EnrollmentStatus.ACTIVE }),
                }
              : options?.includeInactive ? undefined : { status: EnrollmentStatus.ACTIVE },
            take: 1,
            orderBy: options?.classId
              ? [{ sequenceNumber: 'asc' as const }, { academicYear: { startDate: 'desc' as const } }]
              : { academicYear: { startDate: 'desc' as const } },
            select: {
              id: true,
              status: true,
              sequenceNumber: true,
              classId: true,
              class: { select: { id: true, name: true } },
              academicYear: { select: { id: true, name: true } },
            },
          },
          parents: { select: { parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    if (sortByClassSequence) {
      students.sort((a, b) => {
        const aSequence = a.enrollments[0]?.sequenceNumber;
        const bSequence = b.enrollments[0]?.sequenceNumber;
        if (aSequence != null && bSequence != null && aSequence !== bSequence) return aSequence - bSequence;
        if (aSequence != null) return -1;
        if (bSequence != null) return 1;
        return a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true });
      });
    }

    return {
      data: students.slice(sortByClassSequence ? skip : 0, sortByClassSequence ? skip + limit : undefined).map(s => ({
        ...s,
        sequenceNumber: (s as any).enrollments?.[0]?.sequenceNumber ?? null,
        className: (s as any).enrollments?.[0]?.class?.name || null,
        grade: null,
        parentCount: (s as any).parents?.length || 0,
      })),
      total,
      page,
      limit,
    };
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

  async findByUserId(userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { user: { id: userId } },
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
    if (!student) throw new NotFoundException('No student profile linked to your account');
    const latest = student.enrollments?.[0];
    return {
      ...student,
      class: latest?.class || null,
      classId: latest?.classId || null,
      className: latest?.class?.name || null,
      grade: null,
    };
  }

  async findByParent(parentId: string, userId: string) {
    let parent: { id: string } | null = null;
    if (parentId === 'me') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      parent = user?.email
        ? await this.prisma.parent.findFirst({
            where: { email: user.email },
            select: { id: true },
          })
        : null;
    } else {
      parent = await this.prisma.parent.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
    }
    if (!parent) throw new NotFoundException('Parent not found');

    const links = await this.prisma.parentStudent.findMany({
      where: { parentId: parent.id },
      select: {
        student: {
          select: {
            id: true, admissionNumber: true, studentUuid: true, status: true,
            dateOfBirth: true, schoolId: true, firstName: true, lastName: true,
            gender: true, photoUrl: true, photoPublicId: true,
            enrollments: {
              include: { class: true, academicYear: true },
              orderBy: { academicYear: { startDate: 'desc' } },
              take: 1,
            },
          },
        },
      },
    });

    return links.map((l) => {
      const latest = l.student.enrollments?.[0];
      return {
        ...l.student,
        class: latest?.class || null,
        classId: latest?.classId || null,
        className: latest?.class?.name || null,
        grade: null,
      };
    });
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

    if (dto.parentName || dto.parentPhone || dto.parentEmail) {
      const parentNameParts = (dto.parentName || '').trim().split(/\s+/);
      const parentFirstName = parentNameParts[0] || '';
      const parentLastName = parentNameParts.slice(1).join(' ') || '';

      if (parentFirstName) {
        const existingParents = await this.prisma.parentStudent.findMany({
          where: { studentId: id },
          include: { parent: true },
        });
        const existingParent = existingParents.length > 0 ? existingParents[0].parent : null;

        if (existingParent) {
          const parentUpdateData: any = {};
          if (parentFirstName) parentUpdateData.firstName = parentFirstName;
          if (parentLastName) parentUpdateData.lastName = parentLastName;
          if (dto.parentPhone) parentUpdateData.phone = dto.parentPhone;
          if (dto.parentEmail) parentUpdateData.email = dto.parentEmail;
          await this.prisma.parent.update({ where: { id: existingParent.id }, data: parentUpdateData });
        } else {
          const parentEmail = dto.parentEmail || `parent-${id}@placeholder.local`;
          const newParent = await this.prisma.parent.create({
            data: {
              firstName: parentFirstName,
              lastName: parentLastName,
              phone: dto.parentPhone || null,
              email: parentEmail,
              schoolId: student.schoolId,
            },
          });
          await this.prisma.parentStudent.create({
            data: { parentId: newParent.id, studentId: id },
          });
        }
      }
    }

    return updated;
  }

  async uploadPhoto(id: string, photoUrl: string, photoPublicId: string, schoolId: string): Promise<string | null> {
    const student = await this.prisma.student.findUnique({ where: { id }, select: {
      id: true, admissionNumber: true, studentUuid: true, status: true, schoolId: true,
      firstName: true, lastName: true, gender: true, photoUrl: true, photoPublicId: true,
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

  async delete(id: string, schoolId?: string) {
    const student = await this.prisma.student.findUnique({ where: { id }, select: {
      id: true, admissionNumber: true, studentUuid: true, status: true, schoolId: true,
      firstName: true, lastName: true, gender: true, photoUrl: true,
    }});
    if (!student) throw new NotFoundException('Student not found');
    if (schoolId && student.schoolId !== schoolId) throw new ForbiddenException('Invalid student');

    // Capture the classes this student was enrolled in so their admission
    // sequences can be reset after the record is removed.
    const enrolledClasses = await this.prisma.enrollment.findMany({
      where: { studentId: id },
      select: { classId: true, academicYearId: true, schoolId: true },
    });

    // Deleting one student touches every table that references them (~20 queries).
    // On slow connections (e.g. Supabase pooler) that exceeds Prisma's default
    // 5s interactive-transaction timeout and silently rolls the delete back,
    // so give the transaction generous time to finish.
    await this.prisma.$transaction(
      async (tx) => {
      // Detach any linked login account without deleting it, so the student's
      // original credentials survive re-registration under a new student number.
      await tx.user.updateMany({
        where: { studentId: id },
        data: { studentId: null },
      });
      await tx.parentStudent.deleteMany({ where: { studentId: id } });
      await tx.enrollment.deleteMany({ where: { studentId: id } });
      await tx.studentAssessmentResult.deleteMany({ where: { studentId: id } });
      await tx.computedResult.deleteMany({ where: { studentId: id } });
      await tx.termSummary.deleteMany({ where: { studentId: id } });
      await tx.attendance.deleteMany({ where: { studentId: id } });
      await tx.studentSubject.deleteMany({ where: { studentId: id } });
      await tx.result.deleteMany({ where: { studentId: id } });
      await tx.resultAuditLog.deleteMany({ where: { studentId: id } });
      await tx.feePayment.deleteMany({ where: { studentId: id } });
      await tx.homeworkSubmission.deleteMany({ where: { studentId: id } });
      await tx.assessmentScore.deleteMany({ where: { studentId: id } });
      await tx.examAttempt.deleteMany({ where: { studentId: id } });
      await tx.longitudinalRecord.deleteMany({ where: { studentId: id } });
      await tx.grade7Result.deleteMany({ where: { studentId: id } });
      await tx.resultSmsLog.deleteMany({ where: { studentId: id } });
      await tx.generatedReport.deleteMany({ where: { studentId: id } });
      await tx.student.delete({ where: { id } });
    },
      { timeout: 120000, maxWait: 10000 },
    );

    // Auto-reset class sequencing for every class the student was removed from,
    // so the remaining registers stay contiguous without manual backfilling.
    for (const enrolled of enrolledClasses) {
      try {
        await this.admissionNumberService.resequenceClass(
          enrolled.schoolId,
          enrolled.academicYearId,
          enrolled.classId,
        );
      } catch (error) {
        this.logger.error(
          `Failed to re-sequence class ${enrolled.classId} after deleting student ${id}: ${(error as Error).message}`,
        );
      }
    }

    return { message: 'Student deleted successfully' };
  }

  async enroll(studentId: string, academicYearId: string, classId: string, schoolId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    if (student.schoolId !== schoolId) throw new ForbiddenException('Invalid student');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.enrollment.findFirst({ where: { studentId, academicYearId } });
          if (existing) throw new ForbiddenException('Student already enrolled in this academic year');

          const enrollment = await tx.enrollment.create({
            data: { studentId, academicYearId, classId, schoolId, status: EnrollmentStatus.ACTIVE },
          });

          await tx.student.update({
            where: { id: studentId },
            data: {
              classId,
              ...(student.status !== StudentStatus.ACTIVE ? { status: StudentStatus.ACTIVE } : {}),
            },
          });

          await this.admissionNumberService.resequenceClassInTransaction(tx, schoolId, academicYearId, classId);
          return enrollment;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 10000 });
      } catch (error: any) {
        const message = String(error?.message || '').toLowerCase();
        const retryable = error?.code === 'P2034' || message.includes('write conflict') || message.includes('deadlock');
        if (!retryable || attempt === 3) throw error;
        this.logger.warn(`Retrying enrollment for student ${studentId} after transaction conflict (attempt ${attempt + 1}/3)`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }

    throw new Error('Student enrollment could not be completed');
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

      const newEnrollment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.enrollment.create({
          data: {
            studentId: enrollment.studentId,
            academicYearId: toAcademicYearId,
            classId: enrollment.classId,
            schoolId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
        await this.admissionNumberService.resequenceClassInTransaction(
          tx, schoolId, toAcademicYearId, enrollment.classId,
        );
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 10000 });
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.student.update({
        where: { id: studentId },
        data: { status: newStatus },
      });

      if (newStatus !== StudentStatus.ACTIVE) {
        const activeEnrollments = await tx.enrollment.findMany({
          where: { studentId, status: EnrollmentStatus.ACTIVE },
          select: { schoolId: true, academicYearId: true, classId: true },
        });
        await tx.enrollment.updateMany({
          where: { studentId, status: EnrollmentStatus.ACTIVE },
          data: { status: EnrollmentStatus.INACTIVE },
        });
        for (const enrollment of activeEnrollments) {
          await this.admissionNumberService.resequenceClassInTransaction(
            tx, enrollment.schoolId, enrollment.academicYearId, enrollment.classId,
          );
        }
      }

      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 10000 });

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
