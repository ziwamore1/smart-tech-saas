import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getAll(schoolId: string, filters: {
    classId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: AttendanceStatus;
    studentId?: string;
  }) {
    const { classId, date, startDate, endDate, status, studentId } = filters;

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        schoolId,
        classId,
        status: 'ACTIVE',
      },
      select: { studentId: true },
    });

    const studentIds = enrollments.map(e => e.studentId);

    return this.prisma.attendance.findMany({
      where: {
        schoolId,
        studentId: studentId || (studentIds.length > 0 ? { in: studentIds } : undefined),
        status,
        date: startDate && endDate ? {
          gte: new Date(startDate),
          lte: new Date(endDate),
        } : date ? new Date(date) : undefined,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
        slot: {
          include: {
            subject: true,
            teacher: {
              include: { user: true },
            },
            classroom: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getByStudent(studentId: string, startDate?: string, endDate?: string) {
    return this.prisma.attendance.findMany({
      where: {
        studentId,
        date: startDate && endDate ? {
          gte: new Date(startDate),
          lte: new Date(endDate),
        } : undefined,
      },
      include: {
        slot: {
          include: {
            subject: true,
            classroom: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getByClass(classId: string, date: string, slotId?: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const studentIds = enrollments.map(e => e.studentId);

    return this.prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        date: new Date(date),
        slotId: slotId || undefined,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
      },
    });
  }

  async getBySlot(slotId: string, date: string) {
    return this.prisma.attendance.findMany({
      where: {
        slotId,
        date: new Date(date),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
      },
    });
  }

  async create(data: {
    studentId: string;
    slotId?: string;
    date: string;
    status: AttendanceStatus;
    remarks?: string;
    schoolId: string;
  }) {
    return this.prisma.attendance.upsert({
      where: {
        studentId_slotId_date: {
          studentId: data.studentId,
          slotId: data.slotId || null as any,
          date: new Date(data.date),
        },
      },
      update: {
        status: data.status,
        remarks: data.remarks,
      },
      create: {
        studentId: data.studentId,
        slotId: data.slotId,
        date: new Date(data.date),
        status: data.status,
        remarks: data.remarks,
        schoolId: data.schoolId,
      },
    });
  }

  async createBulk(schoolId: string, records: Array<{
    studentId: string;
    slotId?: string;
    date: string;
    status: AttendanceStatus;
    remarks?: string;
  }>) {
    const results = await Promise.all(
      records.map(record =>
        this.prisma.attendance.upsert({
          where: {
            studentId_slotId_date: {
              studentId: record.studentId,
              slotId: record.slotId || null as any,
              date: new Date(record.date),
            },
          },
          update: {
            status: record.status,
            remarks: record.remarks,
          },
          create: {
            studentId: record.studentId,
            slotId: record.slotId,
            date: new Date(record.date),
            status: record.status,
            remarks: record.remarks,
            schoolId,
          },
        })
      )
    );

    return results;
  }

  async createByClass(data: {
    classId: string;
    slotId?: string;
    date: string;
    records: Array<{ studentId: string; status: string; remarks?: string }>;
    schoolId: string;
  }) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId: data.classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const studentIds = enrollments.map(e => e.studentId);
    const date = new Date(data.date);

    await this.prisma.attendance.deleteMany({
      where: {
        studentId: { in: studentIds },
        slotId: data.slotId || null as any,
        date,
      },
    });

    const recordsToCreate = data.records
      .filter(r => studentIds.includes(r.studentId))
      .map(r => ({
        studentId: r.studentId,
        slotId: data.slotId,
        date,
        status: r.status as AttendanceStatus,
        remarks: r.remarks,
        schoolId: data.schoolId,
      }));

    return this.prisma.attendance.createMany({
      data: recordsToCreate,
    });
  }

  async update(id: string, data: { status?: AttendanceStatus; remarks?: string }) {
    return this.prisma.attendance.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.attendance.delete({
      where: { id },
    });
  }

  async getStats(schoolId: string, classId?: string, startDate?: string, endDate?: string) {
    const enrollments = classId
      ? await this.prisma.enrollment.findMany({
          where: { classId, status: 'ACTIVE' },
          select: { studentId: true },
        })
      : [];

    const studentIds = enrollments.map(e => e.studentId);

    const records = await this.prisma.attendance.findMany({
      where: {
        schoolId,
        studentId: classId ? { in: studentIds } : undefined,
        date: startDate && endDate ? {
          gte: new Date(startDate),
          lte: new Date(endDate),
        } : undefined,
      },
    });

    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const excused = records.filter(r => r.status === 'EXCUSED').length;

    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate,
      totalPresent: present,
      totalAbsent: absent,
      totalLate: late,
    };
  }

  async getStudentSummary(studentId: string, termId?: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        status: 'ACTIVE',
        ...(termId ? { academicYearId: termId } : {}),
      },
    });

    if (enrollments.length === 0) {
      return { total: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 0 };
    }

    const records = await this.prisma.attendance.findMany({
      where: { studentId },
    });

    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const excused = records.filter(r => r.status === 'EXCUSED').length;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  async getClassSummary(classId: string, startDate?: string, endDate?: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const studentIds = enrollments.map(e => e.studentId);

    const records = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        date: startDate && endDate ? {
          gte: new Date(startDate),
          lte: new Date(endDate),
        } : undefined,
      },
    });

    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const excused = records.filter(r => r.status === 'EXCUSED').length;

    return {
      classId,
      totalStudents: studentIds.length,
      totalRecords: total,
      present,
      absent,
      late,
      excused,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  async getCalendar(schoolId: string, startDate: string, endDate: string, classId?: string) {
    const enrollments = classId
      ? await this.prisma.enrollment.findMany({
          where: { classId, status: 'ACTIVE' },
          select: { studentId: true },
        })
      : [];

    const studentIds = enrollments.map(e => e.studentId);

    const records = await this.prisma.attendance.groupBy({
      by: ['date', 'status'],
      where: {
        schoolId,
        studentId: classId ? { in: studentIds } : undefined,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      _count: true,
    });

    return records.map(r => ({
      date: r.date,
      status: r.status,
      count: r._count,
    }));
  }

  async checkIn(data: {
    studentId: string;
    schoolId: string;
    slotId?: string;
    date: string;
    checkInMethod?: string;
    biometricId?: string;
    lateThresholdMinutes?: number;
  }) {
    const checkInTime = new Date();
    let isLate = false;
    let lateMinutes = 0;

    if (data.slotId) {
      const slot = await this.prisma.timetableSlot.findUnique({
        where: { id: data.slotId },
      });
      if (slot) {
        const slotStartTime = new Date(data.date);
        slotStartTime.setHours(
          Math.floor(slot.period / 10) || 8,
          (slot.period % 10) * 6,
          0,
          0,
        );
        const threshold = data.lateThresholdMinutes || 15;
        if (checkInTime > new Date(slotStartTime.getTime() + threshold * 60000)) {
          isLate = true;
          lateMinutes = Math.floor((checkInTime.getTime() - slotStartTime.getTime()) / 60000);
        }
      }
    }

    return this.prisma.attendance.upsert({
      where: {
        studentId_slotId_date: {
          studentId: data.studentId,
          slotId: data.slotId || null as any,
          date: new Date(data.date),
        },
      },
      update: {
        checkInTime,
        checkInMethod: data.checkInMethod,
        biometricId: data.biometricId,
        isLate,
        lateMinutes,
      },
      create: {
        studentId: data.studentId,
        slotId: data.slotId,
        date: new Date(data.date),
        status: isLate ? 'LATE' : 'PRESENT',
        schoolId: data.schoolId,
        checkInTime,
        checkInMethod: data.checkInMethod,
        biometricId: data.biometricId,
        isLate,
        lateMinutes,
      },
    });
  }

  async checkOut(data: {
    studentId: string;
    schoolId: string;
    slotId?: string;
    date: string;
  }) {
    const checkOutTime = new Date();

    return this.prisma.attendance.updateMany({
      where: {
        studentId: data.studentId,
        slotId: data.slotId,
        date: new Date(data.date),
      },
      data: {
        checkOutTime,
      },
    });
  }

  async getBiometricAttendance(
    schoolId: string,
    biometricId: string,
    date: string,
  ) {
    return this.prisma.attendance.findFirst({
      where: {
        biometricId,
        date: new Date(date),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
      },
    });
  }

  async getLateArrivalReport(schoolId: string, filters: {
    classId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const enrollments = filters.classId
      ? await this.prisma.enrollment.findMany({
          where: { classId: filters.classId, status: 'ACTIVE' },
          select: { studentId: true },
        })
      : [];

    const studentIds = enrollments.map(e => e.studentId);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        schoolId,
        studentId: filters.classId ? { in: studentIds } : undefined,
        isLate: true,
        date: filters.startDate && filters.endDate ? {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        } : undefined,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const lateByStudent = attendances.reduce((acc, att) => {
      const sid = att.studentId;
      if (!acc[sid]) {
        acc[sid] = { student: att.student, count: 0, totalLateMinutes: 0 };
      }
      acc[sid].count++;
      acc[sid].totalLateMinutes += att.lateMinutes || 0;
      return acc;
    }, {} as Record<string, any>);

    return {
      totalLateArrivals: attendances.length,
      byStudent: Object.values(lateByStudent),
    };
  }

  async getAttendanceHeatmap(schoolId: string, classId: string, startDate: string, endDate: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const attendances = await this.prisma.attendance.findMany({
      where: {
        schoolId,
        studentId: { in: enrollments.map(e => e.studentId) },
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    const heatmap: Record<string, Record<string, number>> = {};
    
    for (const enrollment of enrollments) {
      const studentId = enrollment.studentId;
      heatmap[studentId] = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      
      for (const att of attendances.filter(a => a.studentId === studentId)) {
        heatmap[studentId][att.status]++;
      }
    }

    return enrollments.map(e => ({
      student: e.student,
      attendance: heatmap[e.studentId] || { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 },
    }));
  }
}
