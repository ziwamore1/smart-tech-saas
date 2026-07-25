import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DirectorService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(user: any) {
    const schoolId = user.schoolId;

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const studentsCount = await this.prisma.student.count({
      where: { schoolId },
    });

    const teachersCount = await this.prisma.teacher.count({
      where: { schoolId },
    });

    const classesCount = await this.prisma.class.count({
      where: { schoolId },
    });

    const currentTerm = await this.prisma.term.findFirst({
      where: {
        academicYear: { schoolId, isCurrent: true },
        isCurrent: true,
      },
    });

    let averageScore: number | null = null;
    let attendanceRate: number | null = null;

    if (currentTerm) {
      const computedResults = await this.prisma.computedResult.findMany({
        where: {
          schoolId,
          termId: currentTerm.id,
          status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
          finalPercentage: { not: null },
        },
        select: { finalPercentage: true },
      });

      if (computedResults.length > 0) {
        const sum = computedResults.reduce((acc, r) => acc + (r.finalPercentage || 0), 0);
        averageScore = Math.round((sum / computedResults.length) * 10) / 10;
      }

      const attendanceRecords = await this.prisma.attendance.findMany({
        where: {
          student: { enrollments: { some: { academicYear: { schoolId, isCurrent: true } } } },
          date: { gte: currentTerm.startDate, lte: currentTerm.endDate },
        },
        select: { status: true },
      });

      if (attendanceRecords.length > 0) {
        const present = attendanceRecords.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
        attendanceRate = Math.round((present / attendanceRecords.length) * 100);
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

    const recentResults = await this.prisma.computedResult.findMany({
      where: {
        schoolId,
        status: 'PUBLISHED',
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: {
        id: true,
        studentId: true,
        updatedAt: true,
        student: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
      },
    });

    const recentActivity = [
      ...recentAnnouncements.map(a => ({
        type: 'announcement' as const,
        title: a.title,
        detail: a.content?.substring(0, 80) || '',
        icon: a.category === 'EXAM' ? '📋' : a.category === 'EVENT' ? '📅' : a.category === 'FEES' ? '💰' : '📢',
        timestamp: a.createdAt,
      })),
      ...recentResults.map(r => ({
        type: 'result' as const,
        title: 'Results Published',
        detail: `${r.student.firstName} ${r.student.lastName} - ${r.subject?.name || 'Subject'}`,
        icon: '📊',
        timestamp: r.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    return {
      schoolName: school?.name,
      subscriptionStatus: school?.subscriptionStatus,
      totalStudents: studentsCount,
      totalTeachers: teachersCount,
      totalClasses: classesCount,
      averageScore,
      attendanceRate,
      recentActivity,
    };
  }
}
