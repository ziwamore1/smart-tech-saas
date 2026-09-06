import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportCardService } from '../report-card/report-card.service';
import { UnifiedMessagingService } from '../messaging/unified-messaging.service';
import { CredentialDeliveryService } from '../identity-service/credential-delivery.service';
import { PasswordGenerationService } from '../identity-service/password-generation.service';
import { normalizeZambianPhone } from '../common/utils/phone.util';
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

  private async resolveParentId(userId: string): Promise<string | null> {
    const direct = await this.prisma.parent.findUnique({ where: { id: userId }, select: { id: true } });
    if (direct) return direct.id;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      const parent = await this.prisma.parent.findFirst({ where: { email: user.email }, select: { id: true } });
      if (parent) return parent.id;
    }

    return null;
  }

  async getChildren(userId: string) {
    const parentId = await this.resolveParentId(userId);
    const parentStudents = parentId
      ? await this.prisma.parentStudent.findMany({
          where: { parentId },
          include: {
            student: {
              include: {
                enrollments: {
                  include: {
                    class: {
                      include: {
                        classTeacher: {
                          select: { id: true, firstName: true, lastName: true },
                        },
                      },
                    },
                    academicYear: true,
                  },
                },
              },
            },
          },
        })
      : [];

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
        const classTeacher = currentEnrollment?.class?.classTeacher
          ? {
              userId: currentEnrollment.class.classTeacher.id,
              name: `${currentEnrollment.class.classTeacher.firstName} ${currentEnrollment.class.classTeacher.lastName}`.trim(),
            }
          : null;

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
          classTeacher,
          attendancePercentage: attendanceRate,
          upcomingActivity,
          photoUrl: ps.student.photoUrl || null,
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
      if (dto.children && dto.children.length > 0) {
        for (const child of dto.children) {
          await this.prisma.parentStudent.upsert({
            where: { parentId_studentId: { parentId: existingParent.id, studentId: child.studentId } },
            create: { parentId: existingParent.id, studentId: child.studentId },
            update: {},
          });
        }
      }

      const updatedParent = await this.prisma.parent.findUnique({
        where: { id: existingParent.id },
        include: { children: { include: { student: true } } },
      });

      return {
        message: 'Existing parent found — children linked successfully',
        data: {
          id: updatedParent.id,
          firstName: updatedParent.firstName,
          lastName: updatedParent.lastName,
          email: updatedParent.email,
          phone: updatedParent.phone,
          children: updatedParent.children.map(c => ({
            studentId: c.studentId,
            studentName: `${c.student.firstName} ${c.student.lastName}`,
          })),
        },
      };
    }

    const temporaryPassword = dto.password || 'Parent123!';
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const parent = await this.prisma.parent.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: normalizeZambianPhone(dto.phone),
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

  async getChildResults(studentId: string, schoolId?: string, termId?: string) {
    const where: any = {
      studentId,
      status: { in: ['PUBLISHED', 'LOCKED'] },
    };
    if (schoolId) {
      where.schoolId = schoolId;
    }
    if (termId) {
      where.termId = termId;
    }

    const results = await this.prisma.computedResult.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true } },
        term: { select: { id: true, name: true, academicYearId: true, academicYear: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return results.map((r) => ({
      id: r.id,
      subject: r.subject.name,
      term: r.term.name,
      academicYear: r.term.academicYear?.name || r.term.academicYearId,
      score: r.finalPercentage,
      grade: r.finalGrade,
      remark: r.finalRemark,
      points: r.points,
      gpa: r.gpa,
      classRank: r.classRank,
      subjectRank: r.subjectRank,
      totalRawScore: r.totalRawScore,
      totalWeightedScore: r.totalWeightedScore,
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
    try {
      // Use the same enhanced curriculum report card as the web Report Hub
      return await this.reportCardService.generateCurriculumReportCardPdf(
        schoolId,
        studentId,
        termId,
      );
    } catch (error: any) {
      this.logger.warn(
        `Enhanced report card generation failed (${error?.message}), falling back to basic`,
      );
      return this.reportCardService.generateReportCardPdf(
        schoolId,
        studentId,
        termId,
      );
    }
  }

  async getAllChildrenResults(parentId: string) {
    const children = await this.getChildren(parentId);

    const results = await Promise.all(
      children.map(async (child) => {
        const childResults = await this.getChildResults(child.id);
        return {
          child: {
            id: child.id,
            firstName: child.firstName,
            lastName: child.lastName,
            admissionNumber: child.admissionNumber,
            class: child.class,
          },
          results: childResults,
        };
      }),
    );

    const currentTerm = await this.prisma.term.findFirst({
      where: {
        isCurrent: true,
        academicYear: { isCurrent: true },
      },
      include: { academicYear: { select: { id: true, name: true } } },
    });

    return {
      term: currentTerm?.name || null,
      academicYear: currentTerm?.academicYear?.name || currentTerm?.academicYearId || null,
      children: results,
    };
  }

  async linkChild(parentId: string, studentId: string) {
    const parent = await this.prisma.parent.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Parent not found');

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    await this.prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId, studentId } },
      create: { parentId, studentId },
      update: {},
    });

    return { message: 'Child linked successfully' };
  }

  async findAll(schoolId: string, search?: string) {
    const where: any = { schoolId };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    return this.prisma.parent.findMany({
      where,
      include: {
        children: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, admissionNumber: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        children: {
          include: {
            student: {
              include: {
                enrollments: {
                  where: { status: 'ACTIVE' },
                  include: { class: true, academicYear: true },
                },
              },
            },
          },
        },
      },
    });
    if (!parent) throw new NotFoundException('Parent not found');
    return parent;
  }

  async getStats(schoolId: string) {
    const [total, withMultiple] = await Promise.all([
      this.prisma.parent.count({ where: { schoolId } }),
      this.prisma.parent.count({
        where: {
          schoolId,
          children: { some: {} },
        },
      }),
    ]);

    return { total, withLinkedChildren: withMultiple };
  }

  async unlinkChild(parentId: string, studentId: string) {
    await this.prisma.parentStudent.deleteMany({
      where: { parentId, studentId },
    });
    return { message: 'Child unlinked successfully' };
  }

  async update(id: string, data: { firstName?: string; lastName?: string; email?: string; phone?: string }) {
    const parent = await this.prisma.parent.findUnique({ where: { id } });
    if (!parent) throw new NotFoundException('Parent not found');

    const payload: { firstName?: string; lastName?: string; email?: string; phone?: string } = { ...data };
    if (data.phone !== undefined) payload.phone = normalizeZambianPhone(data.phone) ?? undefined;

    return this.prisma.parent.update({
      where: { id },
      data: payload,
      include: {
        children: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          },
        },
      },
    });
  }
}
