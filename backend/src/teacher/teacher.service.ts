import { Injectable, ForbiddenException, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnifiedMessagingService } from '../messaging/unified-messaging.service';
import { SocketGateway } from '../messaging/socket.gateway';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
import { StaffSyncEngineService } from '../shared/staff-sync-engine/staff-sync-engine.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';
import { Teacher } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TeacherService {
  private readonly logger = new Logger(TeacherService.name);

  constructor(
    private prisma: PrismaService,
    private unifiedMessaging: UnifiedMessagingService,
    private socketGateway: SocketGateway,
    private gradingEngine: GradingEngineService,
    private syncEngine: StaffSyncEngineService,
    @Optional() private schoolEvents?: SchoolEventsGateway,
  ) {}

  async findAll(schoolId?: string) {
    this.logger.log(`findAll called with schoolId=${schoolId}`);
    const teachers = await this.prisma.teacher.findMany({
      where: schoolId ? { schoolId } : undefined,
      include: { 
        user: {
          include: { userRoles: { include: { role: true } } }
        }
      },
      orderBy: { user: { firstName: 'asc' } },
    });
    this.logger.log(`findAll returned ${teachers.length} teachers`);
    return teachers;
  }

  async findOne(id: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    return teacher;
  }

  async create(data: any, schoolId: string) {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      phone,
      qualification,
      specialization,
      yearsOfExperience,
      emergencyContact,
      emergencyPhone,
      staffType,
      ...teacherData 
    } = data;
    
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      throw new ForbiddenException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password || 'Teacher123!', 10);

    const directorRole = await this.prisma.role.findFirst({
      where: { name: { equals: 'Teacher', mode: 'insensitive' } },
    });

    const teacher = await this.prisma.teacher.create({
      data: {
        employeeNo: teacherData.employeeId || teacherData.employeeNo || null,
        hireDate: teacherData.hireDate ? new Date(teacherData.hireDate) : null,
        department: teacherData.department || null,
        departmentRel: teacherData.departmentId ? { connect: { id: teacherData.departmentId } } : undefined,
        gender: teacherData.gender || null,
        staffType: staffType || 'TEACHING',
        qualification: qualification || null,
        specialization: specialization || null,
        yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
        emergencyContact: emergencyContact || null,
        emergencyPhone: emergencyPhone || null,
        school: {
          connect: { id: schoolId },
        },
        user: {
          create: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            schoolId,
            userRoles: directorRole ? {
              create: {
                roleId: directorRole.id,
              },
            } : undefined,
          },
        },
      },
      include: { user: true },
    });

    // Ensure SchoolUser membership exists
    const existingMembership = await this.prisma.schoolUser.findFirst({
      where: { userId: teacher.user.id, schoolId },
    });
    if (!existingMembership) {
      const membership = await this.prisma.schoolUser.create({
        data: { userId: teacher.user.id, schoolId, isPrimary: true },
      });
      // Create SchoolRoleAssignment for Teacher
      await this.prisma.schoolRoleAssignment.create({
        data: { schoolMembershipId: membership.id, role: 'Teacher', isActive: true },
      });
    } else {
      // Ensure Teacher SchoolRoleAssignment exists even if membership already exists
      const existingTeacherRole = await this.prisma.schoolRoleAssignment.findFirst({
        where: { schoolMembershipId: existingMembership.id, role: 'Teacher' },
      });
      if (!existingTeacherRole) {
        await this.prisma.schoolRoleAssignment.create({
          data: { schoolMembershipId: existingMembership.id, role: 'Teacher', isActive: true },
        });
      }
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });

    // Auto-sync to StaffHrProfile for Staff Return Hub
    this.syncEngine.syncStaffProfile(teacher.id, schoolId)
      .then(result => this.logger.log(`Auto-sync to HR profile for teacher ${teacher.id}: created=${result.created}, updated=${result.updated}`))
      .catch(err => this.logger.error(`Auto-sync to HR profile failed for teacher ${teacher.id}:`, err.message));

    const plainPassword = password || 'Teacher123!';
    const teacherWithUser = teacher as any;
    this.unifiedMessaging
      .sendTeacherWelcome(
        {
          id: teacherWithUser.user.id,
          email: teacherWithUser.user.email,
          phone: teacherWithUser.user.phone || undefined,
          firstName: teacherWithUser.user.firstName,
          lastName: teacherWithUser.user.lastName,
        },
        { username: email, password: plainPassword },
        school?.name || 'Your School',
      )
      .catch((err) => this.logger.error('Failed to send teacher welcome message:', err));
    
    if (this.schoolEvents) {
      this.schoolEvents.emitTeacherCreated(schoolId, {
        teacherId: teacher.id,
        userId: teacher.user.id,
      });
    }

    return {
      message: 'Teacher created successfully',
      data: teacher,
    };
  }

  async update(id: string, data: any) {
    const { user, dateOfBirth, address, ...rest } = data;

    const allowedTeacherFields: Record<string, any> = {};
    const validKeys = [
      'employeeNo', 'hireDate', 'department', 'departmentId', 'gender',
      'staffType', 'qualification', 'specialization', 'yearsOfExperience',
      'emergencyContact', 'emergencyPhone', 'photoUrl', 'photoPublicId',
    ];
    for (const key of Object.keys(rest)) {
      if (validKeys.includes(key)) {
        allowedTeacherFields[key] = rest[key];
      }
    }

    if (allowedTeacherFields.yearsOfExperience !== undefined && allowedTeacherFields.yearsOfExperience !== null) {
      allowedTeacherFields.yearsOfExperience = parseInt(allowedTeacherFields.yearsOfExperience) || null;
    }
    if (allowedTeacherFields.hireDate) {
      allowedTeacherFields.hireDate = new Date(allowedTeacherFields.hireDate);
    }

    const updateData: any = { ...allowedTeacherFields };

    if (user) {
      const allowedUserFields: Record<string, any> = {};
      const validUserKeys = ['firstName', 'lastName', 'email', 'phone'];
      for (const key of Object.keys(user)) {
        if (validUserKeys.includes(key)) {
          allowedUserFields[key] = user[key];
        }
      }
      if (Object.keys(allowedUserFields).length > 0) {
        updateData.user = { update: allowedUserFields };
      }
    }

    const updated = await this.prisma.teacher.update({
      where: { id },
      data: updateData,
      include: { user: true },
    });

    // Auto-sync updated data to StaffHrProfile for Staff Return Hub
    this.syncEngine.syncStaffProfile(id, updated.schoolId)
      .then(result => this.logger.log(`Auto-sync after teacher update ${id}: updated=${result.updated}`))
      .catch(err => this.logger.error(`Auto-sync after teacher update failed for ${id}:`, err.message));

    return updated;
  }

  async delete(id: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });
    
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const userId = teacher.userId;

    // Use a transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete Teacher-specific records (no cascade from Teacher)
      await tx.timetableSlot.deleteMany({ where: { teacherId: id } });
      await tx.lessonRequirement.deleteMany({ where: { teacherId: id } });

      // 2. Delete StaffHrProfile (cascades its own children)
      const staffProfile = await tx.staffHrProfile.findFirst({ where: { staffId: id } });
      if (staffProfile) {
        await tx.staffHrProfile.delete({ where: { id: staffProfile.id } });
      }

      // 3. Delete User-related records (no cascade from User)
      await tx.classTeacherAssignment.deleteMany({ where: { teacherId: userId } });
      await tx.userCredential.deleteMany({ where: { OR: [{ userId }, { generatedById: userId }] } });
      await tx.auditLog.deleteMany({ where: { userId } });
      await tx.readingSession.deleteMany({ where: { userId } });
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.schoolUser.deleteMany({ where: { userId } });
      await tx.loginSession.deleteMany({ where: { userId } });
      await tx.otpVerification.deleteMany({ where: { userId } });
      await tx.deviceSession.deleteMany({ where: { userId } });

      // 4. Delete the Teacher record
      await tx.teacher.delete({ where: { id } });

      // 5. Delete the User record (cascades: PlatformRoleAssignment, RefreshToken, LoginSession, DeviceSession, etc.)
      await tx.user.delete({ where: { id: userId } });
    });

    return { message: 'Teacher deleted successfully' };
  }

  async getDashboard(
    userId: string,
    schoolId: string,
    academicYearId?: string,
    termId?: string,
  ) {
    // 1️⃣ Get teacher profile
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId, schoolId },
      include: { user: true },
    });

    if (!teacher) {
      throw new ForbiddenException('Teacher profile not found');
    }

    // 2️⃣ Determine Academic Year
    let academicYear;

    if (academicYearId) {
      academicYear = await this.prisma.academicYear.findUnique({
        where: { id: academicYearId },
      });
    } else {
      academicYear = await this.prisma.academicYear.findFirst({
        where: { schoolId },
        orderBy: { startDate: 'desc' },
      });
    }

    // 3️⃣ Determine Term
    let term;

    if (termId) {
      term = await this.prisma.term.findUnique({
        where: { id: termId },
      });
    } else {
      term = await this.prisma.term.findFirst({
        where: { academicYearId: academicYear.id },
        orderBy: { startDate: 'desc' },
      });
    }

    // 4️⃣ Get teaching assignments
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: {
        teacherId: userId,
        academicYearId: academicYear.id,
      },
      include: {
        subject: true,
        class: {
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                student: true,
              },
            },
          },
        },
      },
    });

    const formattedAssignments = assignments.map((a) => ({
      subjectName: a.subject.name,
      className: a.class.name,
      totalStudents: a.class.enrollments.length,
    }));

    const totalStudents = formattedAssignments.reduce(
      (sum, a) => sum + a.totalStudents,
      0,
    );

    return {
      teacherName: teacher.user.firstName + ' ' + teacher.user.lastName,
      academicYear: academicYear.name,
      term: term.name,
      totalClasses: assignments.length,
      totalStudents,
      assignedSubjects: formattedAssignments,
    };
  }
  async getTeacherClasses(teacherId: string, schoolId: string) {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId },
      include: {
        class: {
          include: {
            levelType: true,
            gradingSystem: { select: { id: true, name: true } },
            classTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  select: {
                    id: true, firstName: true, lastName: true, gender: true,
                    admissionNumber: true, photoUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const ctaRecords = await this.prisma.classTeacherAssignment.findMany({
      where: { teacherId, isActive: true },
      include: {
        class: {
          include: {
            levelType: true,
            gradingSystem: { select: { id: true, name: true } },
            classTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  select: {
                    id: true, firstName: true, lastName: true, gender: true,
                    admissionNumber: true, photoUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const directClasses = await this.prisma.class.findMany({
      where: { classTeacherId: teacherId, schoolId },
      include: {
        levelType: true,
        gradingSystem: { select: { id: true, name: true } },
        classTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true, gender: true,
                admissionNumber: true, photoUrl: true,
              },
            },
          },
        },
      },
    });

    const classMap = new Map<string, any>();
    for (const a of assignments) {
      classMap.set(a.class.id, a.class);
    }
    for (const cta of ctaRecords) {
      classMap.set(cta.class.id, cta.class);
    }
    for (const dc of directClasses) {
      classMap.set(dc.id, dc);
    }

    return Array.from(classMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => {
        const males = c.enrollments.filter((e: any) => e.student.gender === 'MALE' || e.student.gender === 'Male' || e.student.gender === 'M').length;
        const females = c.enrollments.filter((e: any) => e.student.gender === 'FEMALE' || e.student.gender === 'Female' || e.student.gender === 'F').length;
        const students = c.enrollments.map((e: any) => ({
          id: e.student.id,
          firstName: e.student.firstName,
          lastName: e.student.lastName,
          admissionNumber: e.student.admissionNumber,
        }));
        return {
          id: c.id,
          classId: c.id,
          _id: c.id,
          name: c.name,
          className: c.name,
          capacity: c.capacity,
          schoolId: c.schoolId,
          levelTypeId: c.levelTypeId,
          gradingSystemId: c.gradingSystemId,
          order: c.order,
          levelType: c.levelType,
          gradingSystem: c.gradingSystem,
          classTeacher: c.classTeacher,
          students,
          totalStudents: c.enrollments.length,
          studentCount: c.enrollments.length,
          maleCount: males,
          femaleCount: females,
        };
      });
  }
  async getAssignedSubjects(teacherId: string) {
    return this.prisma.teachingAssignment.findMany({
      where: { teacherId },
      include: {
        class: true,
        subject: true,
      },
    });
  }
  async getClassStudents(classId: string) {
    return this.prisma.enrollment.findMany({
      where: {
        classId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
      },
    });
  }
  async enterMarks(data: {
    studentId: string;
    subjectId: string;
    termId: string;
    teacherId: string;
    schoolId: string;
    score: number;
  }) {
    const result = await this.prisma.result.upsert({
      where: {
        studentId_subjectId_termId: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          termId: data.termId,
        },
      },
      update: {
        score: data.score,
      },
      create: {
        studentId: data.studentId,
        subjectId: data.subjectId,
        termId: data.termId,
        teacherId: data.teacherId,
        schoolId: data.schoolId,
        score: data.score,
      },
    });

    // Resolve classId from active enrollment
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: data.studentId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    const classId = enrollment?.classId || null;

    // Sync ComputedResult for real-time analytics
    const gradeResult = await this.gradingEngine.computeGradeFull(
      data.score, classId, data.subjectId, data.termId, data.schoolId,
    ).catch(() => null);

    await this.prisma.computedResult.upsert({
      where: {
        studentId_subjectId_termId: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          termId: data.termId,
        },
      },
      update: {
        classId: classId || '',
        totalRawScore: data.score,
        finalPercentage: data.score,
        finalGrade: gradeResult?.grade ?? null,
        finalRemark: gradeResult?.remark ?? null,
        points: gradeResult?.points ?? null,
        gpa: gradeResult?.gpa ?? null,
        status: 'COMPUTED',
        computedAt: new Date(),
      },
      create: {
        studentId: data.studentId,
        subjectId: data.subjectId,
        termId: data.termId,
        classId: classId || '',
        schoolId: data.schoolId,
        totalRawScore: data.score,
        finalPercentage: data.score,
        finalGrade: gradeResult?.grade ?? null,
        finalRemark: gradeResult?.remark ?? null,
        points: gradeResult?.points ?? null,
        gpa: gradeResult?.gpa ?? null,
        status: 'COMPUTED',
        computedAt: new Date(),
      },
    }).catch(() => {});

    // Emit real-time WebSocket event
    this.socketGateway.server?.emit(`result:updated:${data.schoolId}`, {
      studentId: data.studentId,
      subjectId: data.subjectId,
      termId: data.termId,
      score: data.score,
      timestamp: new Date(),
    });

    return result;
  }
  async enterBulkScores(data: {
    teacherId: string;
    schoolId: string;
    classId: string;
    subjectId: string;
    termId: string;
    scores: {
      studentId: string;
      score: number;
    }[];
  }) {
    const { teacherId, schoolId, classId, subjectId, termId, scores } = data;

    // 1️⃣ Verify teacher teaches this class & subject
    const assignment = await this.prisma.teachingAssignment.findFirst({
      where: {
        teacherId,
        subjectId,
        classId,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'You are not assigned to teach this subject in this class',
      );
    }

    // 2️⃣ Extract student IDs
    const studentIds = scores.map((s) => s.studentId);

    // 3️⃣ Validate students belong to this class
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        studentId: { in: studentIds },
        status: 'ACTIVE',
      },
    });

    if (enrollments.length !== studentIds.length) {
      throw new ForbiddenException(
        'Some students are not enrolled in this class',
      );
    }

    // 4️⃣ Prepare bulk operations
    const operations = scores.map((s) =>
      this.prisma.result.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId: s.studentId,
            subjectId,
            termId,
          },
        },
        update: {
          score: s.score,
        },
        create: {
          studentId: s.studentId,
          subjectId,
          termId,
          teacherId,
          schoolId,
          score: s.score,
        },
      }),
    );

    // 5️⃣ Execute transaction
    const results = await this.prisma.$transaction(operations);

    // Sync ComputedResults for real-time analytics
    for (const s of scores) {
      const gradeResult = await this.gradingEngine.computeGradeFull(
        s.score, classId, subjectId, termId, schoolId,
      ).catch(() => null);

      await this.prisma.computedResult.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId: s.studentId,
            subjectId,
            termId,
          },
        },
        update: {
          totalRawScore: s.score,
          finalPercentage: s.score,
          finalGrade: gradeResult?.grade ?? null,
          finalRemark: gradeResult?.remark ?? null,
          points: gradeResult?.points ?? null,
          gpa: gradeResult?.gpa ?? null,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
        create: {
          studentId: s.studentId,
          subjectId,
          termId,
          classId: classId || '',
          schoolId,
          totalRawScore: s.score,
          finalPercentage: s.score,
          finalGrade: gradeResult?.grade ?? null,
          finalRemark: gradeResult?.remark ?? null,
          points: gradeResult?.points ?? null,
          gpa: gradeResult?.gpa ?? null,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
      }).catch(() => {});
    }

    // Emit real-time WebSocket event
    this.socketGateway.server?.emit(`result:updated:${schoolId}`, {
      classId,
      subjectId,
      termId,
      processedCount: results.length,
      timestamp: new Date(),
    });

    return {
      message: 'Bulk scores saved successfully',
      processed: results.length,
    };
  }
  async getGradebook(classId: string, subjectId: string, termId: string) {
    // 1️⃣ Get students
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
      },
    });

    // 2️⃣ Get assessments
    const assessments = await this.prisma.assessmentType.findMany({
      where: {
        subjectId,
        termId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 3️⃣ Get scores
    const scores = await this.prisma.assessmentScore.findMany({
      where: {
        assessmentType: {
          subjectId,
          termId,
        },
      },
    });

    // 4️⃣ Fast lookup map
    const scoreMap = new Map<string, number>();

    for (const s of scores) {
      scoreMap.set(`${s.studentId}_${s.assessmentTypeId}`, s.score);
    }

    // 5️⃣ Build editable gradebook
    const students = enrollments.map((e) => {
      let total = 0;
      let count = 0;

      const studentScores = assessments.map((a) => {
        const key = `${e.studentId}_${a.id}`;
        const score = scoreMap.get(key) ?? null;

        if (score !== null) {
          total += score;
          count++;
        }

        return {
          studentId: e.studentId,
          assessmentTypeId: a.id,
          assessmentName: a.name,
          maxScore: a.maxScore,
          weight: a.weight,
          score,
        };
      });

      const average = count > 0 ? total / count : null;

      return {
        studentId: e.studentId,
        studentName: `${e.student.firstName} ${e.student.lastName}`,
        average,
        scores: studentScores,
      };
    });

    return {
      assessments,
      students,
    };
  }
}
