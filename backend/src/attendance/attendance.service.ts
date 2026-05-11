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

  private normalizeStatus(status: string): AttendanceStatus {
    const upper = status.toUpperCase() as AttendanceStatus;
    const validStatuses: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'SUSPENDED', 'ACTIVITY', 'PARTIAL_ATTENDANCE'];
    return validStatuses.includes(upper) ? upper : 'PRESENT';
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
            status: this.normalizeStatus(record.status as string),
            remarks: record.remarks,
          },
          create: {
            studentId: record.studentId,
            slotId: record.slotId,
            date: new Date(record.date),
            status: this.normalizeStatus(record.status as string),
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
        status: this.normalizeStatus(r.status),
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
      data: {
        status: data.status ? this.normalizeStatus(data.status as string) : undefined,
        remarks: data.remarks,
      },
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
    const sick = records.filter(r => r.status === 'SICK').length;
    const suspended = records.filter(r => r.status === 'SUSPENDED').length;
    const activity = records.filter(r => r.status === 'ACTIVITY').length;
    const partial = records.filter(r => r.status === 'PARTIAL_ATTENDANCE').length;

    const attendanceRate = total > 0 ? Math.round(((present + partial) / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      sick,
      suspended,
      activity,
      partial,
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
    const sick = records.filter(r => r.status === 'SICK').length;
    const suspended = records.filter(r => r.status === 'SUSPENDED').length;
    const activity = records.filter(r => r.status === 'ACTIVITY').length;
    const partial = records.filter(r => r.status === 'PARTIAL_ATTENDANCE').length;

    return {
      total,
      present,
      absent,
      late,
      excused,
      sick,
      suspended,
      activity,
      partial,
      attendanceRate: total > 0 ? Math.round(((present + partial) / total) * 100) : 0,
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
    const sick = records.filter(r => r.status === 'SICK').length;
    const suspended = records.filter(r => r.status === 'SUSPENDED').length;
    const activity = records.filter(r => r.status === 'ACTIVITY').length;
    const partial = records.filter(r => r.status === 'PARTIAL_ATTENDANCE').length;

    return {
      classId,
      totalStudents: studentIds.length,
      totalRecords: total,
      present,
      absent,
      late,
      excused,
      sick,
      suspended,
      activity,
      partial,
      attendanceRate: total > 0 ? Math.round(((present + partial) / total) * 100) : 0,
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
      heatmap[studentId] = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, SICK: 0, SUSPENDED: 0, ACTIVITY: 0, PARTIAL_ATTENDANCE: 0 };
      
      for (const att of attendances.filter(a => a.studentId === studentId)) {
        heatmap[studentId][att.status]++;
      }
    }

    return enrollments.map(e => ({
      student: e.student,
      attendance: heatmap[e.studentId] || { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, SICK: 0, SUSPENDED: 0, ACTIVITY: 0, PARTIAL_ATTENDANCE: 0 },
    }));
  }

  async getStudentLongitudinalAnalysis(studentId: string) {
    const records = await this.prisma.attendance.findMany({
      where: { studentId },
      include: {
        slot: { include: { subject: true } },
      },
      orderBy: { date: 'asc' },
    });

    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const excused = records.filter(r => r.status === 'EXCUSED').length;
    const sick = records.filter(r => r.status === 'SICK').length;
    const suspended = records.filter(r => r.status === 'SUSPENDED').length;

    const attendanceRate = total > 0 ? Math.round(((present) / total) * 100) : 0;

    const monthlyTrends: Record<string, { total: number; present: number }> = {};
    for (const r of records) {
      const monthKey = r.date.toISOString().slice(0, 7);
      if (!monthlyTrends[monthKey]) monthlyTrends[monthKey] = { total: 0, present: 0 };
      monthlyTrends[monthKey].total++;
      if (r.status === 'PRESENT') monthlyTrends[monthKey].present++;
    }

    const trend = Object.entries(monthlyTrends).map(([month, data]) => ({
      month,
      rate: Math.round((data.present / data.total) * 100),
    }));

    const insights: string[] = [];
    if (absent > 5) insights.push(`${absent} absences recorded — may impact academic performance.`);
    if (late > 3) insights.push(`${late} late arrivals suggest punctuality concerns.`);
    if (sick > 3) insights.push(`Frequent sick leaves (${sick}) may indicate health concerns.`);
    if (suspended > 0) insights.push(`Suspension recorded ${suspended} time(s) — requires disciplinary follow-up.`);
    if (attendanceRate >= 95) insights.push('Excellent attendance record.');
    else if (attendanceRate < 80) insights.push('Critical attendance rate — intervention recommended.');
    else if (attendanceRate < 90) insights.push('Moderate attendance rate — monitor closely.');

    if (trend.length >= 2) {
      const first = trend[0].rate;
      const last = trend[trend.length - 1].rate;
      const diff = last - first;
      if (diff < -10) insights.push(`Attendance dropped ${Math.abs(diff)}% from ${trend[0].month} to ${trend[trend.length - 1].month}.`);
      else if (diff > 10) insights.push(`Attendance improved ${diff}% from ${trend[0].month} to ${trend[trend.length - 1].month}.`);
    }

    return {
      studentId,
      totalRecords: total,
      attendanceRate,
      breakdown: { present, absent, late, excused, sick, suspended },
      trend,
      insights,
    };
  }

  async getAttendancePerformanceCorrelation(classId: string, termId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const studentIds = enrollments.map(e => e.studentId);

    const [attendanceRecords, examResults] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { studentId: { in: studentIds } },
      }),
      this.prisma.result.findMany({
        where: {
          studentId: { in: studentIds },
          termId,
        },
      }),
    ]);

    const studentData: Record<string, { attendanceRate: number; avgScore: number; totalExams: number }> = {};

    for (const sid of studentIds) {
      const attRecords = attendanceRecords.filter(a => a.studentId === sid);
      const attTotal = attRecords.length;
      const attPresent = attRecords.filter(a => a.status === 'PRESENT').length;
      const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

      const sResults = examResults.filter(r => r.studentId === sid);
      const avgScore = sResults.length > 0
        ? Math.round(sResults.reduce((sum, r) => sum + (r.score || 0), 0) / sResults.length)
        : 0;

      studentData[sid] = { attendanceRate, avgScore, totalExams: sResults.length };
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true },
    });

    const correlation = students.map(s => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      admissionNumber: s.admissionNumber,
      ...studentData[s.id],
    }));

    const withData = correlation.filter(c => c.totalExams > 0);
    const avgAttendees = withData.filter(c => c.attendanceRate >= 90);
    const lowAttendees = withData.filter(c => c.attendanceRate < 80);
    const avgScoreHighAtt = avgAttendees.length > 0
      ? Math.round(avgAttendees.reduce((s, c) => s + c.avgScore, 0) / avgAttendees.length)
      : 0;
    const avgScoreLowAtt = lowAttendees.length > 0
      ? Math.round(lowAttendees.reduce((s, c) => s + c.avgScore, 0) / lowAttendees.length)
      : 0;

    return {
      classId,
      termId,
      totalStudents: studentIds.length,
      correlation,
      insight: `Students with ≥90% attendance average ${avgScoreHighAtt}% vs students with <80% attendance average ${avgScoreLowAtt}%.`,
      highAttendanceAvgScore: avgScoreHighAtt,
      lowAttendanceAvgScore: avgScoreLowAtt,
    };
  }

  async getChronicAbsenteeismReport(schoolId: string, threshold: number = 80) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, status: 'ACTIVE' },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
        class: {
          select: { id: true, name: true },
        },
      },
    });

    const studentIds = enrollments.map(e => e.studentId);

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: { studentId: { in: studentIds } },
    });

    const atRisk: Array<{
      studentId: string;
      studentName: string;
      admissionNumber: string;
      className: string;
      attendanceRate: number;
      totalDays: number;
      absentDays: number;
      riskLevel: string;
    }> = [];

    for (const enrollment of enrollments) {
      const sid = enrollment.studentId;
      const records = attendanceRecords.filter(a => a.studentId === sid);
      const total = records.length;
      if (total === 0) continue;

      const present = records.filter(a => a.status === 'PRESENT').length;
      const absent = records.filter(a => a.status === 'ABSENT').length;
      const rate = Math.round((present / total) * 100);

      if (rate < threshold) {
        const riskLevel = rate < 60 ? 'CRITICAL' : rate < 75 ? 'HIGH' : 'MODERATE';
        atRisk.push({
          studentId: sid,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          admissionNumber: enrollment.student.admissionNumber,
          className: enrollment.class?.name || 'N/A',
          attendanceRate: rate,
          totalDays: total,
          absentDays: absent,
          riskLevel,
        });
      }
    }

    return {
      threshold,
      totalAtRisk: atRisk.length,
      totalEnrolled: enrollments.length,
      atRiskPercentage: enrollments.length > 0 ? Math.round((atRisk.length / enrollments.length) * 100) : 0,
      students: atRisk.sort((a, b) => a.attendanceRate - b.attendanceRate),
    };
  }

  async getAttendanceRegisterData(classId: string, date: string, schoolId: string) {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { levelType: true, school: true },
    });

    if (!classData) throw new NotFoundException('Class not found');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, schoolId, status: 'ACTIVE' },
      include: { student: true },
    });

    const attendanceDate = new Date(date);
    const existingRecords = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: enrollments.map(e => e.studentId) },
        date: attendanceDate,
      },
    });

    const recordMap = new Map(existingRecords.map(r => [r.studentId, r]));

    const records = enrollments.map(e => {
      const s = e.student;
      const record = recordMap.get(s.id);
      const status = record?.status || null;

      return {
        admNo: s.admissionNumber,
        name: `${s.firstName} ${s.lastName}`,
        photoUrl: s.photoUrl || '',
        status: status ? status.toLowerCase() : 'unmarked',
        statusLabel: status ? status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unmarked',
        checkIn: record?.checkInTime ? record.checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
        checkOut: record?.checkOutTime ? record.checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
        remarks: record?.remarks || '-',
      };
    });

    const stats = {
      total: records.length,
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      excused: records.filter(r => r.status === 'excused').length,
      sick: records.filter(r => r.status === 'sick').length,
      suspended: records.filter(r => r.status === 'suspended').length,
      activity: records.filter(r => r.status === 'activity').length,
      partial: records.filter(r => r.status === 'partial_attendance').length,
      unmarked: records.filter(r => r.status === 'unmarked').length,
    };

    return {
      schoolName: classData.school.name,
      school: {
        name: classData.school.name,
        address: classData.school.address || '',
        logo: classData.school.logo || '',
      },
      className: classData.name,
      levelType: classData.levelType?.name || '',
      date: attendanceDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      generatedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      stats,
      records,
      template: {
        primaryColor: '#ea6645',
        secondaryColor: '#fef3c7',
      },
    };
  }

  async getStudentAttendanceReportData(studentId: string, schoolId: string, startDate?: string, endDate?: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { class: { include: { levelType: true } } },
          take: 1,
        },
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    const enrollment = student.enrollments[0];
    const records = await this.prisma.attendance.findMany({
      where: {
        studentId,
        date: startDate && endDate ? {
          gte: new Date(startDate),
          lte: new Date(endDate),
        } : undefined,
      },
      include: {
        slot: { include: { subject: true } },
      },
      orderBy: { date: 'desc' },
    });

    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const excused = records.filter(r => r.status === 'EXCUSED').length;
    const sick = records.filter(r => r.status === 'SICK').length;
    const suspended = records.filter(r => r.status === 'SUSPENDED').length;
    const activity = records.filter(r => r.status === 'ACTIVITY').length;
    const partial = records.filter(r => r.status === 'PARTIAL_ATTENDANCE').length;

    const attendanceRate = total > 0 ? Math.round(((present + partial) / total) * 100) : 0;
    const rateClass = attendanceRate >= 90 ? 'high' : attendanceRate >= 75 ? 'mid' : 'low';

    const insights = [];
    if (attendanceRate < 75) {
      insights.push({ type: 'warning', title: 'Low Attendance', text: `Student attendance rate is ${attendanceRate}%, which is below the recommended 75% threshold.` });
    } else if (attendanceRate >= 90) {
      insights.push({ type: 'success', title: 'Excellent Attendance', text: `Student has maintained a ${attendanceRate}% attendance rate.` });
    }
    if (late > 5) {
      insights.push({ type: 'warning', title: 'Punctuality Concern', text: `Student has been late ${late} times.` });
    }

    return {
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNumber: student.admissionNumber,
        photoUrl: student.photoUrl || '',
        className: enrollment?.class?.name || 'N/A',
        classLevel: enrollment?.class?.levelType?.name || '',
      },
      startDate: startDate || 'All time',
      endDate: endDate || 'Present',
      generatedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      attendanceRate,
      rateClass,
      stats: { total, present, absent, late, excused, sick, suspended, activity, partial },
      records: records.map(r => ({
        date: r.date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
        subject: r.slot?.subject?.name || 'General',
        status: r.status,
        statusLabel: r.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
        checkIn: r.checkInTime ? r.checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
        checkOut: r.checkOutTime ? r.checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
        lateMinutes: r.lateMinutes || 0,
        remarks: r.remarks || '-',
      })),
      insights,
      schoolName: '',  // Caller should populate
      template: {
        primaryColor: '#ea6645',
        secondaryColor: '#fef3c7',
      },
    };
  }

  async getClassListData(classId: string, schoolId: string) {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { levelType: true, school: true },
    });

    if (!classData) throw new NotFoundException('Class not found');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, schoolId },
      include: {
        student: true,
      },
    });

    const students = enrollments.map(e => {
      const s = e.student;
      const dob = s.dateOfBirth;
      const age = dob ? Math.floor((new Date().getTime() - new Date(dob).getTime()) / 31557600000) : null;
      const genderRaw = s.gender || '';
      const isMale = genderRaw.toLowerCase() === 'male' || genderRaw === 'M';
      const isFemale = genderRaw.toLowerCase() === 'female' || genderRaw === 'F';

      return {
        admNo: s.admissionNumber,
        name: `${s.firstName} ${s.lastName}`,
        photoUrl: s.photoUrl || '',
        genderClass: isMale ? 'male' : isFemale ? 'female' : '',
        genderLabel: isMale ? 'Male' : isFemale ? 'Female' : s.gender || 'N/A',
        dob: dob ? dob.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-',
        age: age !== null ? age : '-',
        status: e.status,
        statusClass: e.status === 'ACTIVE' ? 'active' : 'inactive',
      };
    });

    const male = students.filter(s => s.genderClass === 'male').length;
    const female = students.filter(s => s.genderClass === 'female').length;
    const total = students.length;

    return {
      school: {
        name: classData.school.name,
        address: classData.school.address || '',
        logo: classData.school.logo || '',
      },
      className: classData.name,
      levelType: classData.levelType?.name || '',
      generatedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      summary: {
        total,
        male,
        female,
        capacity: classData.capacity || null,
        maleRatio: total > 0 ? male : 0,
        femaleRatio: total > 0 ? female : 0,
      },
      students,
      primaryColor: '#ea6645',
      secondaryColor: '#fef3c7',
    };
  }

  async getPunctualityTrends(classId: string, termId?: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const studentIds = enrollments.map(e => e.studentId);

    const records = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        isLate: true,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const totalLate = records.length;

    const monthlyBreakdown: Record<string, number> = {};
    for (const r of records) {
      const monthKey = r.date.toISOString().slice(0, 7);
      monthlyBreakdown[monthKey] = (monthlyBreakdown[monthKey] || 0) + 1;
    }

    const byStudent = records.reduce((acc, r) => {
      const sid = r.studentId;
      if (!acc[sid]) {
        acc[sid] = {
          student: r.student,
          lateCount: 0,
          totalLateMinutes: 0,
        };
      }
      acc[sid].lateCount++;
      acc[sid].totalLateMinutes += r.lateMinutes || 0;
      return acc;
    }, {} as Record<string, any>);

    const lateFrequency = {
      none: studentIds.length - Object.keys(byStudent).length,
      occasional: 0,
      frequent: 0,
      chronic: 0,
    };

    for (const data of Object.values(byStudent) as Array<{ lateCount: number }>) {
      if (data.lateCount <= 2) lateFrequency.occasional++;
      else if (data.lateCount <= 5) lateFrequency.frequent++;
      else lateFrequency.chronic++;
    }

    return {
      classId,
      totalLateArrivals: totalLate,
      byStudent: Object.values(byStudent),
      monthlyTrend: Object.entries(monthlyBreakdown).map(([month, count]) => ({ month, count })),
      lateFrequency,
      averageLateMinutes: totalLate > 0
        ? Math.round(records.reduce((s, r) => s + (r.lateMinutes || 0), 0) / totalLate)
        : 0,
    };
  }
}
