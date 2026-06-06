import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationService } from '../push-notification/push-notification.service';
import { AiTutorService } from '../intelligence/services/ai-tutor.service';

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    private prisma: PrismaService,
    private pushNotificationService: PushNotificationService,
    private aiTutorService: AiTutorService,
  ) {}

  async getDashboard(userId: string, schoolId: string, roles: string[]) {
    this.logger.log(`Getting dashboard for user: ${userId}, roles: ${roles.join(', ')}`);

    const isParent = roles.includes('Parent');
    const isStudent = roles.includes('Student');
    const isTeacher = roles.includes('Teacher');
    const isClassTeacher = roles.includes('Class Teacher');

    const currentTerm = await this.prisma.term.findFirst({
      where: {
        academicYear: {
          schoolId,
          isCurrent: true,
        },
        isCurrent: true,
      },
      include: {
        academicYear: true,
      },
    });

    const dashboard: any = {
      currentTerm: currentTerm
        ? {
            id: currentTerm.id,
            name: currentTerm.name,
            academicYear: currentTerm.academicYear.name,
          }
        : null,
      userType: isParent ? 'parent' : isStudent ? 'student' : isTeacher ? 'teacher' : 'other',
    };

    if (isParent) {
      const parent = await this.prisma.parent.findFirst({
        where: { email: (await this.getUserEmail(userId)) || '' },
      });

      if (parent) {
        const children = await this.prisma.parentStudent.findMany({
          where: { parentId: parent.id },
          include: {
            student: {
              include: {
                enrollments: {
                  where: {
                    academicYear: { schoolId, isCurrent: true },
                  },
                  include: { class: true },
                },
              },
            },
          },
        });

        dashboard.children = children.map((ps) => ({
          id: ps.student.id,
          name: `${ps.student.firstName} ${ps.student.lastName}`,
          admissionNumber: ps.student.admissionNumber,
          class: ps.student.enrollments[0]?.class?.name || 'Not assigned',
        }));

        dashboard.stats = {
          totalChildren: children.length,
        };
      }
    }

    if (isStudent) {
      const student = await this.prisma.student.findFirst({
        where: {
          user: { id: userId },
        },
      });

      if (student) {
        const enrollment = await this.prisma.enrollment.findFirst({
          where: {
            studentId: student.id,
            academicYear: { schoolId, isCurrent: true },
          },
          include: { class: true },
        });

        const resultsCount = await this.prisma.result.count({
          where: {
            studentId: student.id,
            termId: currentTerm?.id,
          },
        });

        const attendanceRate = await this.getAttendanceRate(
          student.id,
          currentTerm?.id,
        );

        dashboard.student = {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          admissionNumber: student.admissionNumber,
          class: enrollment?.class?.name || 'Not assigned',
        };

        dashboard.stats = {
          resultsCount,
          attendanceRate,
        };
      }
    }

    if (isTeacher || isClassTeacher) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId },
      });

      if (teacher) {
        const myClasses = await this.prisma.teachingAssignment.groupBy({
          by: ['classId'],
          where: {
            teacherId: teacher.id,
            academicYear: { schoolId, isCurrent: true },
          },
        });

        const classes = await Promise.all(
          myClasses.map((c) =>
            this.prisma.class.findUnique({
              where: { id: c.classId },
              select: { id: true, name: true },
            }),
          ),
        );

        const today = new Date();
        const dayOfWeek = today.getDay();
        const todayLessons = await this.prisma.timetableSlot.count({
          where: {
            teacherId: teacher.id,
            timetable: {
              termId: currentTerm?.id,
            },
            day: dayOfWeek,
          },
        });

        dashboard.teacher = {
          id: teacher.id,
          employeeNo: teacher.employeeNo,
        };

        dashboard.stats = {
          totalClasses: classes.length,
          classes: classes.filter(Boolean),
          todayLessons,
        };
      }
    }

    const recentAnnouncements = await this.prisma.noticeBoard.findMany({
      where: {
        schoolId,
        isPublished: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        priority: true,
        createdAt: true,
      },
    });

    dashboard.recentAnnouncements = recentAnnouncements;

    return dashboard;
  }

  private async getUserEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || null;
  }

  private async getAttendanceRate(
    studentId: string,
    termId?: string,
  ): Promise<number> {
    const where: any = { studentId };
    if (termId) {
      const term = await this.prisma.term.findUnique({ where: { id: termId } });
      if (term) {
        where.date = {
          gte: term.startDate,
          lte: term.endDate,
        };
      }
    }

    const attendance = await this.prisma.attendance.findMany({ where });
    if (attendance.length === 0) return 100;

    const present = attendance.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE',
    ).length;
    return Math.round((present / attendance.length) * 100);
  }

  async getProfile(userId: string, schoolId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        school: {
          select: {
            id: true,
            name: true,
            logo: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const roles = user.userRoles.map((ur) => ur.role.name);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      roles,
      school: user.school
        ? {
            id: user.school.id,
            name: user.school.name,
            logo: user.school.logo,
            primaryColor: user.school.primaryColor || '#1E3A8A',
          }
        : null,
    };
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    return this.pushNotificationService.getNotifications(userId, page, limit);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    await this.pushNotificationService.markAsRead(userId, notificationId);
    return { success: true };
  }

  async markAllNotificationsRead(userId: string) {
    await this.pushNotificationService.markAllAsRead(userId);
    return { success: true };
  }

  async getUnreadNotificationCount(userId: string) {
    const count = await this.pushNotificationService.getUnreadCount(userId);
    return { count };
  }

  async logoutDevice(userId: string, deviceToken: string) {
    await this.pushNotificationService.removeDeviceToken(userId, deviceToken);
    return { success: true };
  }

  async getStudentTimetable(userId: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { user: { id: userId } },
    });

    if (!student) {
      return null;
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        academicYear: { schoolId, isCurrent: true },
      },
      include: { class: true },
    });

    if (!enrollment) {
      return { timetable: [], className: student.firstName + ' ' + student.lastName };
    }

    const currentTerm = await this.prisma.term.findFirst({
      where: {
        academicYear: { schoolId, isCurrent: true },
        isCurrent: true,
      },
    });

    const timetable = await this.prisma.timetable.findFirst({
      where: {
        classId: enrollment.classId,
        termId: currentTerm?.id,
      },
      include: {
        slots: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            teacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: [{ day: 'asc' }, { period: 'asc' }],
        },
      },
    });

    return {
      className: enrollment.class.name,
      timetable: timetable?.slots || [],
    };
  }

  async getTeacherTimetable(userId: string, schoolId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId },
    });

    if (!teacher) {
      return null;
    }

    const currentTerm = await this.prisma.term.findFirst({
      where: {
        academicYear: { schoolId, isCurrent: true },
        isCurrent: true,
      },
    });

    const assignments = await this.prisma.teachingAssignment.findMany({
      where: {
        teacherId: teacher.id,
        academicYear: { schoolId, isCurrent: true },
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        teacherId: teacher.id,
        timetable: {
          termId: currentTerm?.id,
        },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        timetable: {
          include: {
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ day: 'asc' }, { period: 'asc' }],
    });

    return {
      assignments,
      timetable: slots.map(slot => ({
        ...slot,
        className: slot.timetable?.class?.name,
      })),
    };
  }

  async getStudentAssignments(userId: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { user: { id: userId } },
    });

    if (!student) {
      return [];
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        academicYear: { schoolId, isCurrent: true },
      },
    });

    if (enrollments.length === 0) return [];

    const classIds = enrollments.map((e) => e.classId);

    const homeworks = await this.prisma.homework.findMany({
      where: { classId: { in: classIds } },
      include: {
        subject: { select: { id: true, name: true } },
        submissions: { where: { studentId: student.id } },
      },
      orderBy: { dueDate: 'desc' },
      take: 20,
    });

    return homeworks.map((h) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      subject: h.subject.name,
      dueDate: h.dueDate,
      maxScore: h.maxScore,
      status: h.submissions[0] ? 'submitted' : 'pending',
      submission: h.submissions[0]?.submission,
      score: h.submissions[0]?.score,
      feedback: h.submissions[0]?.feedback,
    }));
  }

  async getStudentGrades(userId: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { user: { id: userId } },
    });

    if (!student) return [];

    const currentTerm = await this.prisma.term.findFirst({
      where: {
        academicYear: { schoolId, isCurrent: true },
        isCurrent: true,
      },
      include: { academicYear: true },
    });

    const results = await this.prisma.result.findMany({
      where: {
        studentId: student.id,
        termId: currentTerm?.id,
      },
      include: {
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
      },
    });

    return results.map((r) => ({
      id: r.id,
      subject: r.subject.name,
      subjectId: r.subject.id,
      term: r.term.name,
      score: r.score,
      grade: r.grade,
      remark: r.remark,
    }));
  }

  async getTeacherActivity(userId: string, schoolId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId },
    });

    if (!teacher) return [];

    const currentTerm = await this.prisma.term.findFirst({
      where: {
        academicYear: { schoolId, isCurrent: true },
        isCurrent: true,
      },
    });

    const recentHomework = await this.prisma.homework.findMany({
      where: {
        createdById: userId,
      },
      include: { subject: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentResults = await this.prisma.result.findMany({
      where: {
        teacherId: userId,
      },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        subject: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const homeworkActivity = recentHomework.map((h) => ({
      type: 'homework',
      title: h.title,
      subject: h.subject.name,
      action: 'created',
      date: h.createdAt,
    }));

    const resultActivity = recentResults.map((r) => ({
      type: 'result',
      title: `${r.student.firstName} ${r.student.lastName}`,
      subject: r.subject.name,
      action: 'grade entered',
      date: r.createdAt,
    }));

    const combined = [...homeworkActivity, ...resultActivity]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    return combined;
  }

  async getTeacherClasses(userId: string, schoolId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId },
    });

    if (!teacher) return [];

    const assignments = await this.prisma.teachingAssignment.findMany({
      where: {
        teacherId: teacher.id,
        academicYear: { schoolId, isCurrent: true },
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    const classMap = new Map();
    for (const a of assignments) {
      if (!classMap.has(a.classId)) {
        classMap.set(a.classId, {
          classId: a.classId,
          className: a.class.name,
          subjects: [],
        });
      }
      classMap.get(a.classId).subjects.push({
        subjectId: a.subject.id,
        subjectName: a.subject.name,
      });
    }

    return Array.from(classMap.values());
  }

  async getAiTutorSessions(userId: string, schoolId: string, roles: string[]) {
    let studentId: string | null = null;

    if (roles.includes('Student')) {
      const student = await this.prisma.student.findFirst({ where: { user: { id: userId } } });
      studentId = student?.id || null;
    }

    if (!studentId) {
      return { sessions: [], hasStudentProfile: false };
    }

    const sessions = await this.prisma.aiTutorSession.findMany({
      where: { studentId, schoolId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    return {
      hasStudentProfile: true,
      sessions: sessions.map(s => ({
        id: s.id,
        subjectId: s.subjectId,
        topic: s.topic,
        status: s.status,
        createdAt: s.createdAt,
        lastActive: s.updatedAt,
        lastMessage: s.messages[0]?.content || null,
      })),
    };
  }

  async startAiTutorSession(userId: string, schoolId: string, roles: string[], options?: {
    subjectId?: string;
    topic?: string;
    studentId?: string;
    context?: { role?: string; screen?: string; subject?: string; topic?: string };
  }) {
    let studentId: string | null = options?.studentId || null;

    if (!studentId && roles.includes('Student')) {
      const student = await this.prisma.student.findFirst({ where: { user: { id: userId } } });
      studentId = student?.id || null;
    }

    const contextPayload = {
      role: (options?.context?.role || roles[0]?.toLowerCase().replace(' ', '_') || 'student') as any,
      screen: options?.context?.screen,
      subject: options?.context?.subject || options?.subjectId,
      topic: options?.context?.topic || options?.topic,
      studentId: studentId || undefined,
      userId,
    };

    if (!studentId) {
      const greeting = this.generateGeneralGreeting(options?.topic, options?.subjectId);
      const session = await this.prisma.aiTutorSession.create({
        data: {
          schoolId,
          subjectId: options?.subjectId,
          topic: options?.topic,
          userId,
        },
      });

      await this.prisma.aiTutorMessage.create({
        data: { sessionId: session.id, role: 'tutor', content: greeting },
      });

      return { sessionId: session.id, message: greeting, isGeneral: true };
    }

    return this.aiTutorService.startSession(studentId, schoolId, {
      subjectId: options?.subjectId,
      topic: options?.topic,
      context: contextPayload,
    });
  }

  async sendAiTutorMessage(userId: string, schoolId: string, sessionId: string, message: string, context?: {
    role?: string; screen?: string; subject?: string; topic?: string; studentId?: string;
  }) {
    const session = await this.prisma.aiTutorSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session || session.schoolId !== schoolId) {
      return { error: 'Session not found' };
    }

    const contextPayload = context ? {
      role: (context.role || 'student') as any,
      screen: context.screen,
      subject: context.subject || session.subjectId || undefined,
      topic: context.topic || session.topic || undefined,
      studentId: context.studentId || session.studentId || undefined,
      userId,
    } : { studentId: session.studentId || undefined, userId };

    await this.prisma.aiTutorMessage.create({
      data: { sessionId, role: 'user', content: message },
    });

    const response = await this.generateTutorResponse(message, session, contextPayload);

    await this.prisma.aiTutorMessage.create({
      data: { sessionId, role: 'tutor', content: response },
    });

    return { response };
  }

  async askAiTutor(userId: string, schoolId: string, roles: string[], question: string, subjectId?: string, context?: {
    role?: string; screen?: string; subject?: string; topic?: string; studentId?: string;
  }) {
    let studentId: string | null = null;

    if (roles.includes('Student')) {
      const student = await this.prisma.student.findFirst({ where: { user: { id: userId } } });
      studentId = student?.id || null;
    }

    const contextPayload = {
      role: (context?.role || roles[0]?.toLowerCase().replace(' ', '_') || 'student') as any,
      screen: context?.screen,
      subject: context?.subject || subjectId,
      topic: context?.topic,
      studentId: context?.studentId || studentId || undefined,
      userId,
    };

    if (!studentId) {
      const response = await this.generateTutorResponse(question, null, contextPayload);
      return { response, isGeneral: true };
    }

    return this.aiTutorService.askQuestion(studentId, schoolId, question, subjectId, contextPayload);
  }

  private async generateTutorResponse(message: string, session: any, context?: any): Promise<string> {
    if (!session) {
      return this.generateGeneralTutorResponse(message, context?.subject);
    }
    const result = await this.aiTutorService.sendMessage(
      session.id,
      session.studentId || 'unknown',
      message,
      session.schoolId,
      context || {},
    );
    return result.response;
  }

  private generateGeneralGreeting(topic?: string, subjectId?: string): string {
    if (topic && subjectId) {
      return `Hello! I'm your AI tutor. Let's explore ${topic} together. What would you like to learn?`;
    }
    if (topic) {
      return `Hi! I'm your AI tutor. Let's discuss ${topic}. What specific aspect would you like to explore?`;
    }
    return `Welcome! I'm your AI tutor. I can help with concepts, practice questions, study tips, and more. What would you like to learn today?`;
  }

  private generateGeneralTutorResponse(question: string, subjectId?: string): string {
    const subjectHint = subjectId ? 'this subject' : 'your studies';
    return `Based on your question about ${subjectHint}:\n\nThe key is to approach this systematically. Start with the fundamentals and build up gradually.\n\nWould you like me to:\n1. Explain a specific concept?\n2. Give you a practice problem?\n3. Provide study tips for ${subjectHint}?`;
  }

  async getClasses(schoolId: string) {
    const currentAcademicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });

    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      include: {
        levelType: { select: { name: true } },
        enrollments: {
          where: currentAcademicYear ? { academicYearId: currentAcademicYear.id } : {},
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
        teachingAssignments: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return classes.map(c => ({
      id: c.id,
      name: c.name,
      levelType: c.levelType?.name || null,
      studentCount: c.enrollments.length,
      students: c.enrollments.map(e => ({
        id: e.student.id,
        name: `${e.student.firstName} ${e.student.lastName}`,
      })),
      teachers: c.teachingAssignments.map(ta => ({
        id: ta.teacher.id,
        name: `${ta.teacher.firstName} ${ta.teacher.lastName}`,
        email: ta.teacher.email,
        subject: ta.subject.name,
      })),
    }));
  }

  async getStudents(schoolId: string, classId?: string) {
    const currentAcademicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });

    const where: any = {
      enrollments: {
        some: currentAcademicYear ? { academicYearId: currentAcademicYear.id } : {},
      },
    };
    if (classId) {
      where.enrollments.some.classId = classId;
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        enrollments: {
          where: currentAcademicYear ? { academicYearId: currentAcademicYear.id } : {},
          include: { class: { select: { id: true, name: true } } },
        },
        user: { select: { id: true, email: true, isActive: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    return students.map(s => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      admissionNumber: s.admissionNumber,
      email: s.user?.email || null,
      isActive: s.user?.isActive ?? true,
      class: s.enrollments[0]?.class?.name || 'Not assigned',
      classId: s.enrollments[0]?.class?.id || null,
    }));
  }

  async getStaff(schoolId: string) {
    const teachers = await this.prisma.teacher.findMany({
      where: { schoolId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true },
        },
      },
    });

    const teacherIds = teachers.map(t => t.userId);

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: { in: teacherIds } },
      include: { role: { select: { name: true } } },
    });

    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId: { in: teacherIds } },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    });

    const rolesByUser = new Map<string, string[]>();
    userRoles.forEach(ur => {
      const existing = rolesByUser.get(ur.userId) || [];
      existing.push(ur.role.name);
      rolesByUser.set(ur.userId, existing);
    });

    const assignmentsByTeacher = new Map<string, typeof assignments>();
    assignments.forEach(a => {
      const existing = assignmentsByTeacher.get(a.teacherId) || [];
      existing.push(a);
      assignmentsByTeacher.set(a.teacherId, existing);
    });

    return teachers.map(t => {
      const ta = assignmentsByTeacher.get(t.userId) || [];
      return {
        id: t.user.id,
        firstName: t.user.firstName,
        lastName: t.user.lastName,
        email: t.user.email,
        phone: t.user.phone,
        isActive: t.user.isActive,
        employeeNo: t.employeeNo,
        roles: rolesByUser.get(t.userId) || [],
        subjects: [...new Set(ta.map(a => a.subject.name))],
        classes: [...new Set(ta.map(a => a.class.name))],
      };
    });
  }

  async getSubjects(schoolId: string) {
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });

    const subjectIds = subjects.map(s => s.id);
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { subjectId: { in: subjectIds } },
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
      },
    });

    const assignmentsBySubject = new Map<string, typeof assignments>();
    assignments.forEach(a => {
      const existing = assignmentsBySubject.get(a.subjectId) || [];
      existing.push(a);
      assignmentsBySubject.set(a.subjectId, existing);
    });

    return subjects.map(s => {
      const ta = assignmentsBySubject.get(s.id) || [];
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        teacherCount: ta.length,
        assignments: ta.map(ta => ({
          teacher: `${ta.teacher.firstName} ${ta.teacher.lastName}`,
          class: ta.class.name,
        })),
      };
    });
  }

  async getUsers(schoolId: string, role?: string) {
    const where: any = { schoolId };
    if (role) {
      where.userRoles = { some: { role: { name: role } } };
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        userRoles: { include: { role: { select: { name: true } } } },
        teacher: { select: { id: true, employeeNo: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    return users.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      roles: u.userRoles.map(ur => ur.role.name),
      employeeNo: u.teacher?.employeeNo || null,
    }));
  }

  async createUser(creatorId: string, schoolId: string, data: { firstName: string; lastName: string; email: string; password: string; roles: string[] }) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.email.toLowerCase() },
    });
    if (existingUser) {
      throw new Error('Email already in use');
    }

    const hashedPassword = require('bcrypt').hashSync(data.password, 10);

    const roles = await this.prisma.role.findMany({
      where: { name: { in: data.roles } },
    });

    const user = await this.prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        schoolId,
        userRoles: {
          create: roles.map(role => ({
            role: { connect: { id: role.id } },
          })),
        },
      },
      include: {
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.userRoles.map(ur => ur.role.name),
    };
  }

  async updateUser(schoolId: string, userId: string, data: { firstName?: string; lastName?: string; email?: string; roles?: string[]; isActive?: boolean }) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });

    if (data.roles && data.roles.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: { name: { in: data.roles } },
      });
      await this.prisma.userRole.deleteMany({ where: { userId } });
      await this.prisma.userRole.createMany({
        data: roles.map(role => ({
          userId,
          roleId: role.id,
        })),
      });
    }

    const finalRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true } } },
    });

    return {
      id: updatedUser.id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      isActive: updatedUser.isActive,
      roles: finalRoles.map(ur => ur.role.name),
    };
  }

  async deleteUser(schoolId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    await this.prisma.userRole.deleteMany({ where: { userId } });
    await this.prisma.user.delete({ where: { id: userId } });

    return { message: 'User deleted successfully' };
  }

  async getAttendanceRegister(schoolId: string, classId: string, date: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { student: { firstName: 'asc' } },
    });

    const attendanceDate = new Date(date);
    const existingRecords = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: enrollments.map(e => e.studentId) },
        date: attendanceDate,
      },
    });

    const recordMap = new Map(existingRecords.map(r => [r.studentId, r]));

    const students = enrollments.map(e => {
      const record = recordMap.get(e.student.id);
      return {
        id: e.student.id,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        admissionNumber: e.student.admissionNumber,
        photoUrl: e.student.photoUrl,
        status: record?.status || 'PRESENT',
      };
    });

    const stats = {
      total: students.length,
      present: students.filter(s => s.status === 'PRESENT').length,
      absent: students.filter(s => s.status === 'ABSENT').length,
      late: students.filter(s => s.status === 'LATE').length,
      excused: students.filter(s => s.status === 'EXCUSED').length,
      unmarked: students.filter(s => !s.status).length,
    };

    return { students, stats, date };
  }

  async submitBulkAttendance(schoolId: string, classId: string, date: string, records: { studentId: string; status: string; remarks?: string }[]) {
    const attendanceDate = new Date(date);

    const studentIds = records.map(r => r.studentId);
    await this.prisma.attendance.deleteMany({
      where: {
        studentId: { in: studentIds },
        date: attendanceDate,
      },
    });

    const results = await this.prisma.attendance.createMany({
      data: records.map(r => ({
        studentId: r.studentId,
        date: attendanceDate,
        status: r.status.toUpperCase() as any,
        remarks: r.remarks,
        schoolId,
      })),
    });

    return { message: 'Attendance saved', count: results.count };
  }

  async markAllAttendance(schoolId: string, classId: string, date: string, status: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const attendanceDate = new Date(date);

    await this.prisma.attendance.deleteMany({
      where: {
        studentId: { in: enrollments.map(e => e.studentId) },
        date: attendanceDate,
      },
    });

    const results = await this.prisma.attendance.createMany({
      data: enrollments.map(e => ({
        studentId: e.studentId,
        date: attendanceDate,
        status: status.toUpperCase() as any,
        schoolId,
      })),
    });

    return { message: `All marked as ${status}`, count: results.count };
  }

  async getTeacherByUserId(userId: string) {
    return this.prisma.teacher.findUnique({
      where: { userId },
      select: { id: true, departmentId: true, employeeNo: true },
    });
  }
}
