import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportCardService } from '../report-card/report-card.service';
import { IdentityService } from '../identity-service/identity.service';
import { normalizeZambianPhone, validateZambianPhone } from '../common/utils/phone.util';
import { CreateParentDto } from './dto/create-parent.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

@Injectable()
export class ParentService {
  private readonly logger = new Logger(ParentService.name);

  constructor(
    private prisma: PrismaService,
    private reportCardService: ReportCardService,
    private identityService: IdentityService,
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

  async register(dto: CreateParentDto, schoolId: string, requestedById = 'system') {
    const submittedEmail = dto.email?.trim().toLowerCase();
    const submittedPhone = normalizeZambianPhone(dto.phone);
    const existingParent = submittedEmail
      ? await this.prisma.parent.findUnique({ where: { email: submittedEmail } })
      : submittedPhone
        ? await this.prisma.parent.findFirst({ where: { schoolId, phone: submittedPhone, firstName: dto.firstName, lastName: dto.lastName } })
        : null;

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
      const delivery = await this.identityService.deliverParentCredentialsBySms(existingParent.id, requestedById, schoolId);

      return {
        message: delivery.success ? 'Existing parent found, children linked, and credentials sent by SMS' : 'Existing parent found and children linked. Correct the parent phone number before SMS delivery.',
        delivery,
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

    const temporaryPassword = dto.password || `STS-Parent#${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const parentEmail = submittedEmail || `parent_${randomUUID()}@internal.smarttech.edu`;
    const parentUsername = submittedEmail || `parent_${randomUUID().slice(0, 8)}`;
    const phoneStatus = validateZambianPhone(dto.phone);
    const parentRole = await this.prisma.role.findFirst({ where: { name: 'Parent' } });

    const parent = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email: parentEmail } });
      if (existingUser?.schoolId && existingUser.schoolId !== schoolId) {
        throw new ConflictException('The supplied parent email belongs to an account in another school. Use the existing parent account or contact the school administrator.');
      }
      const user = existingUser
        ? await tx.user.update({ where: { id: existingUser.id }, data: { phone: dto.phone?.trim() || null, schoolId: existingUser.schoolId || schoolId } })
        : await tx.user.create({
            data: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              email: parentEmail,
              username: parentUsername,
              phone: dto.phone?.trim() || null,
              password: hashedPassword,
              schoolId,
              mustChangePassword: true,
              ...(parentRole ? { userRoles: { create: { roleId: parentRole.id } } } : {}),
            },
          });
      if (parentRole) {
        await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: parentRole.id } }, create: { userId: user.id, roleId: parentRole.id }, update: {} });
      }
      return tx.parent.create({
        data: {
          userId: user.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: parentEmail,
          phone: dto.phone?.trim() || null,
          password: hashedPassword,
          schoolId,
          phoneStatus: phoneStatus.status,
          phoneStatusReason: phoneStatus.reason,
          phoneValidatedAt: new Date(),
          ...(dto.children?.length ? { children: { create: dto.children.map(child => ({ studentId: child.studentId })) } } : {}),
        },
        include: { children: { include: { student: { include: { user: true } } } } },
      });
    });
    const delivery = await this.identityService.deliverParentCredentialsBySms(parent.id, requestedById, schoolId);

    return {
      message: delivery.success ? 'Parent registered and credentials sent by SMS' : 'Parent registered, but SMS was blocked or failed. Review the phone guidance in Password Hub.',
      delivery,
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

    // Class position = rank by average performance, consistent with report cards.
    // Results may span multiple terms, so rank within each term represented.
    const termIds = [...new Set(results.map(r => r.termId))].filter(Boolean) as string[];
    const rankByTerm = new Map<string, number>();
    if (termIds.length > 0) {
      const peersByTerm = await this.prisma.computedResult.groupBy({
        by: ['termId', 'studentId'],
        where: {
          termId: { in: termIds },
          status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
          student: { status: 'ACTIVE' },
        },
        _avg: { finalPercentage: true },
      });
      for (const tid of termIds) {
        const ranked = peersByTerm
          .filter(p => p.termId === tid && p._avg.finalPercentage != null)
          .map(p => ({ studentId: p.studentId, average: p._avg.finalPercentage as number }))
          .sort((a, b) => b.average - a.average);
        let lastRank = 0;
        let lastAvg: number | null = null;
        for (let i = 0; i < ranked.length; i++) {
          if (lastAvg === null || Math.abs(ranked[i].average - lastAvg) > 0.001) {
            lastRank = i + 1;
            lastAvg = ranked[i].average;
          }
          if (ranked[i].studentId === studentId) {
            rankByTerm.set(tid, lastRank);
            break;
          }
        }
      }
    }

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
      classRank: rankByTerm.get(r.termId) ?? r.classRank,
      subjectRank: r.subjectRank,
      totalRawScore: r.totalRawScore,
      totalWeightedScore: r.totalWeightedScore,
    }));
  }

  async getChildAttendance(studentId: string, schoolId?: string, termId?: string) {
    const termWhere: any = termId
      ? { id: termId }
      : { isCurrent: true, academicYear: { isCurrent: true } };
    if (schoolId) {
      termWhere.academicYear = { ...(termWhere.academicYear || {}), schoolId };
    }
    const term = await this.prisma.term.findFirst({ where: termWhere });

    const where: any = { studentId };
    if (term) {
      where.date = { gte: term.startDate, lte: term.endDate };
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

    const normalizedEmail = data.email === undefined ? undefined : data.email.trim().toLowerCase();
    const phoneCheck = data.phone === undefined ? null : validateZambianPhone(data.phone);
    const updated = await this.prisma.parent.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName.trim() } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName.trim() } : {}),
        ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
        ...(data.phone !== undefined ? {
          phone: data.phone.trim() || null,
          phoneStatus: phoneCheck!.status,
          phoneStatusReason: phoneCheck!.reason,
          phoneValidatedAt: new Date(),
          credentialDeliveryStatus: phoneCheck!.normalized ? parent.credentialDeliveryStatus : 'BLOCKED_INVALID_PHONE',
          credentialDeliveryError: phoneCheck!.normalized ? null : phoneCheck!.reason,
          credentialDeliveryUpdatedAt: new Date(),
        } : {}),
      },
      include: {
        children: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          },
        },
      },
    });
    if (parent.userId) {
      await this.prisma.user.update({ where: { id: parent.userId }, data: {
        ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
        ...(data.firstName !== undefined ? { firstName: data.firstName.trim() } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName.trim() } : {}),
      } });
    }
    return updated;
  }
}
