import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res, Req, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Get()
  async getAll(
    @Query('schoolId') schoolId: string,
    @Query('classId') classId?: string,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.getAll(schoolId, {
      classId,
      date,
      startDate,
      endDate,
      status: status as any,
    });
  }

  @Get('student/:studentId')
  async getByStudent(
    @Param('studentId') studentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getByStudent(studentId, startDate, endDate);
  }

  @Get('class')
  async getByClass(
    @Query('classId') classId: string,
    @Query('date') date: string,
    @Query('slotId') slotId?: string,
  ) {
    return this.attendanceService.getByClass(classId, date, slotId);
  }

  @Get('slot')
  async getBySlot(
    @Query('slotId') slotId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getBySlot(slotId, date);
  }

  @Get('stats')
  async getStats(
    @Query('schoolId') schoolId: string,
    @Query('classId') classId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getStats(schoolId, classId, startDate, endDate);
  }

  @Get('student/:studentId/summary')
  async getStudentSummary(
    @Param('studentId') studentId: string,
    @Query('termId') termId?: string,
  ) {
    return this.attendanceService.getStudentSummary(studentId, termId);
  }

  @Get('class/:classId/summary')
  async getClassSummary(
    @Param('classId') classId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getClassSummary(classId, startDate, endDate);
  }

  @Get('calendar')
  async getCalendar(
    @Query('schoolId') schoolId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('classId') classId?: string,
  ) {
    return this.attendanceService.getCalendar(schoolId, startDate, endDate, classId);
  }

  @Post()
  async create(
    @Body() data: {
      studentId: string;
      slotId?: string;
      date: string;
      status: string;
      remarks?: string;
      schoolId: string;
    },
  ) {
    return this.attendanceService.create({
      ...data,
      status: data.status as any,
    });
  }

  @Post('bulk')
  async createBulk(
    @Body() data: {
      schoolId: string;
      records: Array<{
        studentId: string;
        slotId?: string;
        date: string;
        status: string;
        remarks?: string;
      }>;
    },
  ) {
    return this.attendanceService.createBulk(data.schoolId, data.records as any[]);
  }

  @Post('class')
  async createByClass(
    @Body() data: {
      classId: string;
      slotId?: string;
      date: string;
      records: Array<{ studentId: string; status: string; remarks?: string }>;
      schoolId: string;
    },
  ) {
    return this.attendanceService.createByClass(data);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: { status?: string; remarks?: string },
  ) {
    return this.attendanceService.update(id, {
      status: data.status as any,
      remarks: data.remarks,
    });
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.attendanceService.delete(id);
  }

  @Post('check-in')
  async checkIn(
    @Body() data: {
      studentId: string;
      schoolId: string;
      slotId?: string;
      date: string;
      checkInMethod?: string;
      biometricId?: string;
      lateThresholdMinutes?: number;
    },
  ) {
    return this.attendanceService.checkIn(data);
  }

  @Post('check-out')
  async checkOut(
    @Body() data: {
      studentId: string;
      schoolId: string;
      slotId?: string;
      date: string;
    },
  ) {
    return this.attendanceService.checkOut(data);
  }

  @Get('biometric/:biometricId')
  async getBiometricAttendance(
    @Param('biometricId') biometricId: string,
    @Query('date') date: string,
    @Query('schoolId') schoolId: string,
  ) {
    return this.attendanceService.getBiometricAttendance(schoolId, biometricId, date);
  }

  @Get('late-report')
  async getLateArrivalReport(
    @Query('schoolId') schoolId: string,
    @Query('classId') classId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getLateArrivalReport(schoolId, { classId, startDate, endDate });
  }

  @Get('heatmap')
  async getAttendanceHeatmap(
    @Query('schoolId') schoolId: string,
    @Query('classId') classId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.attendanceService.getAttendanceHeatmap(schoolId, classId, startDate, endDate);
  }

  @Get('longitudinal/:studentId')
  async getStudentLongitudinalAnalysis(@Param('studentId') studentId: string) {
    return this.attendanceService.getStudentLongitudinalAnalysis(studentId);
  }

  @Get('performance-correlation')
  async getAttendancePerformanceCorrelation(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.attendanceService.getAttendancePerformanceCorrelation(classId, termId);
  }

  @Get('chronic-absenteeism')
  async getChronicAbsenteeismReport(
    @Query('schoolId') schoolId: string,
    @Query('threshold') threshold?: string,
  ) {
    return this.attendanceService.getChronicAbsenteeismReport(schoolId, threshold ? parseInt(threshold) : undefined);
  }

  @Get('punctuality-trends')
  async getPunctualityTrends(
    @Query('classId') classId: string,
    @Query('termId') termId?: string,
  ) {
    return this.attendanceService.getPunctualityTrends(classId, termId);
  }

  @Get('register/:classId/pdf')
  async getAttendanceRegisterPdf(
    @Param('classId') classId: string,
    @Query('date') date: string,
    @Query('schoolId') schoolId: string,
    @Res() res: Response,
  ) {
    const data = await this.attendanceService.getAttendanceRegisterData(classId, date, schoolId);
    const reportServiceUrl = process.env.REPORT_SERVICE_URL || 'http://localhost:3005';

    try {
      const response = await fetch(`${reportServiceUrl}/render/attendance-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Report service error: ${error}`);
      }

      const pdfBuffer = await response.arrayBuffer();
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="attendance-register-${data.className?.replace(/\s+/g, '_') || 'report'}.pdf"`,
        'Content-Length': pdfBuffer.byteLength,
      });
      res.send(Buffer.from(pdfBuffer));
    } catch (err: any) {
      throw new NotFoundException(`Failed to generate PDF: ${err.message}`);
    }
  }

  @Get('student/:studentId/pdf')
  async getStudentAttendancePdf(
    @Param('studentId') studentId: string,
    @Query('schoolId') schoolId: string,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.attendanceService.getStudentAttendanceReportData(studentId, schoolId, startDate, endDate);
    const reportServiceUrl = process.env.REPORT_SERVICE_URL || 'http://localhost:3005';

    try {
      const response = await fetch(`${reportServiceUrl}/render/student-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Report service error: ${error}`);
      }

      const pdfBuffer = await response.arrayBuffer();
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="student-attendance-${studentId}.pdf"`,
        'Content-Length': pdfBuffer.byteLength,
      });
      res.send(Buffer.from(pdfBuffer));
    } catch (err: any) {
      throw new NotFoundException(`Failed to generate PDF: ${err.message}`);
    }
  }

  @Get('class-list/:classId/pdf')
  async getClassListPdf(
    @Param('classId') classId: string,
    @Query('schoolId') schoolId: string,
    @Res() res: Response,
  ) {
    const data = await this.attendanceService.getClassListData(classId, schoolId);
    const reportServiceUrl = process.env.REPORT_SERVICE_URL || 'http://localhost:3005';

    try {
      const response = await fetch(`${reportServiceUrl}/render/class-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Report service error: ${error}`);
      }

      const pdfBuffer = await response.arrayBuffer();
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="class-list-${data.className?.replace(/\s+/g, '_') || 'report'}.pdf"`,
        'Content-Length': pdfBuffer.byteLength,
      });
      res.send(Buffer.from(pdfBuffer));
    } catch (err: any) {
      throw new NotFoundException(`Failed to generate PDF: ${err.message}`);
    }
  }

  @Post('auto-mark-today')
  async autoMarkToday(@Req() req: any) {
    return this.attendanceService.autoMarkTodayAttendance(req.user.schoolId);
  }

  @Post('auto-mark-today-all')
  async autoMarkTodayAll() {
    return this.attendanceService.autoMarkTodayAttendanceAllSchools();
  }
}
