import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnifiedMessagingService } from '../messaging/unified-messaging.service';
import { SocketGateway } from '../messaging/socket.gateway';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
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

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });

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
    
    return {
      message: 'Teacher created successfully',
      data: teacher,
    };
  }

  async update(id: string, data: any) {
    const { user, ...teacherData } = data;
    
    const updateData: any = { ...teacherData };
    if (user) {
      updateData.user = { update: user };
    }
    
    return this.prisma.teacher.update({
      where: { id },
      data: updateData,
      include: { user: true },
    });
  }

  async delete(id: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });
    
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    
    await this.prisma.user.delete({ where: { id: teacher.userId } });
    await this.prisma.teacher.delete({ where: { id } });
    
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
