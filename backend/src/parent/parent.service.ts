import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportCardService } from '../report-card/report-card.service';
import { UnifiedMessagingService } from '../messaging/unified-messaging.service';
import { CreateParentDto } from './dto/create-parent.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ParentService {
  private readonly logger = new Logger(ParentService.name);

  constructor(
    private prisma: PrismaService,
    private reportCardService: ReportCardService,
    private unifiedMessaging: UnifiedMessagingService,
  ) {}

  async getChildren(parentId: string) {
    const parentStudents = await this.prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: {
          include: {
            enrollments: {
              include: {
                class: true,
                academicYear: true,
              },
            },
          },
        },
      },
    });

    const currentTerm = await this.prisma.term.findFirst({
      where: {
        isCurrent: true,
        academicYear: { isCurrent: true },
      },
    });

    const children = await Promise.all(
      parentStudents.map(async (ps) => {
        const enrollments = ps.student.enrollments.filter(
          (e) => e.academicYear.isCurrent,
        );
        const currentEnrollment = enrollments[0];
        const classId = currentEnrollment?.classId;

        const attendance = await this.prisma.attendance.findMany({
          where: {
            studentId: ps.student.id,
            ...(currentTerm && {
              date: { gte: currentTerm.startDate, lte: currentTerm.endDate },
            }),
          },
        });

        const present = attendance.filter(
          (a) => a.status === 'PRESENT' || a.status === 'LATE',
        ).length;
        const attendanceRate =
          attendance.length > 0
            ? Math.round((present / attendance.length) * 100)
            : 100;

        let upcomingActivity = null;
        if (classId && currentTerm) {
          const upcomingHomework = await this.prisma.homework.findFirst({
            where: {
              classId,
              dueDate: { gte: new Date() },
            },
            orderBy: { dueDate: 'asc' },
            include: { subject: true },
          });
          if (upcomingHomework) {
            upcomingActivity = {
              type: 'homework',
              title: upcomingHomework.title,
              subject: upcomingHomework.subject.name,
              dueDate: upcomingHomework.dueDate,
            };
          }
        }

        return {
          id: ps.student.id,
          firstName: ps.student.firstName,
          lastName: ps.student.lastName,
          admissionNumber: ps.student.admissionNumber,
          class: currentEnrollment?.class?.name || 'Not assigned',
          attendancePercentage: attendanceRate,
          upcomingActivity,
        };
      }),
    );

    return children;
  }

  async register(dto: CreateParentDto, schoolId: string) {
    const existingParent = await this.prisma.parent.findUnique({
      where: { email: dto.email },
    });

    if (existingParent) {
      throw new ForbiddenException('Parent with this email already exists');
    }

    const temporaryPassword = dto.password || 'Parent123!';
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const parent = await this.prisma.parent.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        schoolId,
        ...(dto.children && dto.children.length > 0 && {
          children: {
            create: dto.children.map(c => ({
              studentId: c.studentId,
            })),
          },
        }),
      },
      include: {
        children: {
          include: {
            student: true,
          },
        },
      },
    });

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });

    const childName = parent.children.length > 0
      ? `${parent.children[0].student.firstName} ${parent.children[0].student.lastName}`
      : 'your child';

    this.unifiedMessaging
      .sendParentWelcome(
        {
          email: parent.email,
          phone: parent.phone || undefined,
          firstName: parent.firstName,
          lastName: parent.lastName,
        },
        { username: parent.email, password: temporaryPassword },
        childName,
        school?.name || 'Your School',
      )
      .catch((err) => this.logger.error('Failed to send parent welcome message:', err));

    return {
      message: 'Parent registered successfully',
      data: {
        id: parent.id,
        firstName: parent.firstName,
        lastName: parent.lastName,
        email: parent.email,
        phone: parent.phone,
        children: parent.children.map(c => ({
          studentId: c.studentId,
          studentName: `${c.student.firstName} ${c.student.lastName}`,
        })),
      },
      credentials: {
        username: parent.email,
        password: temporaryPassword,
      },
    };
  }

  async getChildResults(studentId: string) {
    const currentTerm = await this.prisma.term.findFirst({
      where: {
        isCurrent: true,
        academicYear: { isCurrent: true },
      },
      include: { academicYear: true },
    });

    const results = await this.prisma.result.findMany({
      where: { studentId },
      include: {
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true, academicYearId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return results.map((r) => ({
      id: r.id,
      subject: r.subject.name,
      term: r.term.name,
      academicYear: r.term.academicYearId,
      score: r.score,
      grade: r.grade,
      remark: r.remark,
    }));
  }

  async getChildAttendance(studentId: string) {
    const currentTerm = await this.prisma.term.findFirst({
      where: {
        isCurrent: true,
        academicYear: { isCurrent: true },
      },
    });

    const where: any = { studentId };
    if (currentTerm) {
      where.date = { gte: currentTerm.startDate, lte: currentTerm.endDate };
    }

    const attendance = await this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const present = attendance.filter((a) => a.status === 'PRESENT').length;
    const absent = attendance.filter((a) => a.status === 'ABSENT').length;
    const late = attendance.filter((a) => a.status === 'LATE').length;
    const excused = attendance.filter((a) => a.status === 'EXCUSED').length;

    return {
      total: attendance.length,
      present,
      absent,
      late,
      excused,
      attendanceRate:
        attendance.length > 0
          ? Math.round((present / attendance.length) * 100)
          : 100,
      records: attendance.map((a) => ({
        id: a.id,
        date: a.date,
        status: a.status,
        remarks: a.remarks,
      })),
    };
  }

  async getChildHomework(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        academicYear: { isCurrent: true },
      },
    });

    if (enrollments.length === 0) return [];

    const classIds = enrollments.map((e) => e.classId);

    const homeworks = await this.prisma.homework.findMany({
      where: { classId: { in: classIds } },
      include: {
        subject: { select: { id: true, name: true } },
        submissions: {
          where: { studentId },
        },
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
    }));
  }

  async getReportCard(schoolId: string, studentId: string, termId: string) {
    return this.reportCardService.generateReportCardPdf(
      schoolId,
      studentId,
      termId,
    );
  }
}
