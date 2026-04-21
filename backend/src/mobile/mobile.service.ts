import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationService } from '../push-notification/push-notification.service';

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    private prisma: PrismaService,
    private pushNotificationService: PushNotificationService,
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
}
