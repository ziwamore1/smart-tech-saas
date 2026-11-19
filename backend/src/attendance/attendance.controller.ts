import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res, Req, NotFoundException, BadGatewayException, ForbiddenException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Response } from 'express';

const CLASS_LIST_ROLES = [
  'Director',
  'Deputy Director',
  'Head Teacher',
  'Deputy Head Teacher',
  'Deputy Head',
  'Deputy',
  'HOD',
  'Teacher',
  'Class Teacher',
  'SuperAdmin',
];

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  private schoolIdFromRequest(req: any): string {
    const schoolId = req?.user?.schoolId;
    if (!schoolId) throw new ForbiddenException('School context is missing');
    return schoolId;
  }

  private safeFilename(value: string, fallback: string): string {
    const cleaned = String(value || '')
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    return cleaned || fallback;
  }

  private classListOrientation(data: any): 'portrait' | 'landscape' {
    const columns = Number(data?.columnCount) || 9;
    const students = Array.isArray(data?.students) ? data.students.length : 0;
    return columns > 8 || students > 40 ? 'landscape' : 'portrait';
  }

  private textWidth(value: any): number {
    const text = String(value ?? '');
    let width = 0;
    for (const char of text) width += char.charCodeAt(0) > 255 ? 2 : 1;
    return width;
  }

  private async buildClassListExcel(data: any): Promise<ExcelJS.Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SmartTech SaaS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Class List', { properties: { defaultRowHeight: 20 } });

    const headers = ['#', 'Admission No', 'Last Name', 'First Name', 'Full Name', 'Gender', 'Date of Birth', 'Age', 'Status'];
    const columnCount = headers.length;
    const border: ExcelJS.Borders = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      diagonal: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
    const darkFill = 'FF1F2937';
    const brandFill = 'FFEA6645';
    const softFill = 'FFFEF3C7';
    const stripeFill = 'FFF9FAFB';

    const styleRange = (
      row: number,
      from: number,
      to: number,
      fill?: string,
      font?: Partial<ExcelJS.Font>,
      horizontal: 'left' | 'center' | ((column: number) => 'left' | 'center') = 'center',
    ) => {
      for (let column = from; column <= to; column += 1) {
        const cell = sheet.getCell(row, column);
        cell.alignment = {
          vertical: 'middle',
          horizontal: typeof horizontal === 'function' ? horizontal(column) : horizontal,
          wrapText: true,
        };
        cell.border = border;
        if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        if (font) cell.font = font as ExcelJS.Font;
      }
    };

    const writeMerged = (
      row: number,
      from: number,
      to: number,
      value: string,
      fill?: string,
      font?: Partial<ExcelJS.Font>,
      horizontal: 'left' | 'center' = 'center',
    ) => {
      sheet.mergeCells(row, from, row, to);
      sheet.getCell(row, from).value = value;
      styleRange(row, from, to, fill, font, horizontal);
      sheet.getRow(row).height = 24;
    };

    const writePair = (row: number, column: number, label: string, value: any) => {
      sheet.getCell(row, column).value = label;
      sheet.getCell(row, column + 1).value = value ?? '-';
      styleRange(row, column, column + 1, softFill, { bold: true, size: 10, color: { argb: 'FF374151' } }, 'left');
      sheet.getCell(row, column + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      sheet.getCell(row, column + 1).font = { bold: true, size: 10, color: { argb: 'FF111827' } };
    };

    const summary = data?.summary || {};
    const ageBands = Array.isArray(summary.ageBands)
      ? summary.ageBands.map((band: any) => `${band.label}: ${band.total} (M ${band.male}, F ${band.female}, O ${band.other})`).join('   |   ')
      : '-';

    writeMerged(1, 1, columnCount, 'CLASS LIST', darkFill, { bold: true, size: 18, color: { argb: 'FFFFFFFF' } });
    sheet.getRow(1).height = 32;
    writeMerged(2, 1, columnCount, data?.school?.name || '', brandFill, { bold: true, size: 13, color: { argb: 'FFFFFFFF' } });
    writeMerged(3, 1, columnCount, data?.school?.address || '-', undefined, { size: 10, color: { argb: 'FF374151' } });
    writeMerged(4, 1, columnCount, data?.school?.contact || '-', undefined, { size: 10, color: { argb: 'FF374151' } });
    writeMerged(5, 1, columnCount, `CURRENT TERM: ${data?.currentTerm || 'N/A'}    ACADEMIC YEAR: ${data?.academicYear || 'N/A'}`, undefined, { size: 10, color: { argb: 'FF111827' } }, 'left');
    writeMerged(6, 1, columnCount, `CLASS: ${data?.className || 'N/A'}    LEVEL: ${data?.levelType || 'N/A'}`, undefined, { size: 10, color: { argb: 'FF111827' } }, 'left');
    writeMerged(7, 1, columnCount, `CLASS TEACHER: ${data?.classTeacher || 'N/A'}    GENERATED: ${data?.generatedAt || '-'}`, undefined, { size: 10, color: { argb: 'FF111827' } }, 'left');

    sheet.getRow(8).height = 8;
    writeMerged(9, 1, columnCount, 'SUMMARY', darkFill, { bold: true, size: 11, color: { argb: 'FFFFFFFF' } });
    writePair(10, 1, 'Total Students', summary.total ?? 0);
    writePair(10, 4, 'Male', `${summary.male ?? 0} (${summary.malePercent ?? 0}%)`);
    writePair(10, 7, 'Female', `${summary.female ?? 0} (${summary.femalePercent ?? 0}%)`);
    writePair(11, 1, 'Other / Unspecified', `${summary.other ?? 0} (${summary.otherPercent ?? 0}%)`);
    writePair(11, 4, 'Capacity', summary.capacity ?? '-');
    writePair(11, 7, 'Missing DOB', summary.missingDob ?? 0);
    writePair(12, 1, 'Male %', `${summary.malePercent ?? 0}%`);
    writePair(12, 4, 'Female %', `${summary.femalePercent ?? 0}%`);
    writePair(12, 7, 'Other %', `${summary.otherPercent ?? 0}%`);
    sheet.getCell(13, 1).value = 'Age Bands';
    styleRange(13, 1, 1, softFill, { bold: true, size: 10, color: { argb: 'FF374151' } }, 'left');
    writeMerged(13, 2, columnCount, ageBands, undefined, { size: 10, color: { argb: 'FF111827' } }, 'left');
    sheet.getRow(13).height = 30;

    sheet.getRow(14).height = 8;
    const headerRow = 15;
    headers.forEach((header, index) => {
      sheet.getCell(headerRow, index + 1).value = header;
    });
    styleRange(headerRow, 1, columnCount, brandFill, { bold: true, size: 10, color: { argb: 'FFFFFFFF' } });
    sheet.getRow(headerRow).height = 28;

    const students = Array.isArray(data?.students) ? data.students : [];
    const rowValues = (student: any, index: number) => [
      index + 1,
      student.admNo || student.admissionNumber || '-',
      student.lastName || '-',
      student.firstName || '-',
      student.name || student.fullName || '-',
      student.genderLabel || '-',
      student.dob || student.dateOfBirth || '-',
      student.age ?? '-',
      student.status || '-',
    ];

    students.forEach((student: any, index: number) => {
      const row = headerRow + 1 + index;
      const values = rowValues(student, index);
      values.forEach((value: any, column: number) => {
        sheet.getCell(row, column + 1).value = value;
      });
      styleRange(
        row,
        1,
        columnCount,
        index % 2 === 0 ? undefined : stripeFill,
        { size: 10, color: { argb: 'FF111827' } },
        (column: number): 'left' | 'center' => ([2, 3, 4, 5, 7].includes(column) ? 'left' : 'center'),
      );
      sheet.getRow(row).height = 24;
    });

    const widths = headers.map((header, index) => {
      let width = this.textWidth(header);
      for (const student of students) width = Math.max(width, this.textWidth(rowValues(student, 0)[index]));
      return Math.min(45, Math.max(9, width + 3));
    });
    widths[0] = 6;
    widths[7] = Math.min(12, widths[7]);
    sheet.columns = widths.map(width => ({
      width,
      style: { alignment: { vertical: 'middle', wrapText: true } },
    }));

    if (students.length > 0) {
      sheet.autoFilter = {
        from: { row: headerRow, column: 1 },
        to: { row: headerRow + students.length, column: columnCount },
      };
    }
    sheet.views = [{
      state: 'frozen',
      ySplit: headerRow,
      topLeftCell: `A${headerRow + 1}`,
      activeCell: `A${headerRow + 1}`,
    }];
    sheet.pageSetup = {
      paperSize: 9,
      orientation: this.classListOrientation({ ...data, columnCount }),
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.4, bottom: 0.4, left: 0.3, right: 0.3, header: 0.2, footer: 0.2 },
      printTitlesRow: `${headerRow}:${headerRow}`,
    };
    sheet.headerFooter.oddFooter = '&CClass List - &A | Page &P of &N';

    return workbook.xlsx.writeBuffer();
  }

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
  @UseGuards(RolesGuard)
  @Roles(...CLASS_LIST_ROLES)
  async getClassListPdf(
    @Param('classId') classId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    try {
      const schoolId = this.schoolIdFromRequest(req);
      const data: any = await this.attendanceService.getClassListData(classId, schoolId);
      data.layout = { orientation: this.classListOrientation(data) };
      const reportServiceUrl = process.env.REPORT_SERVICE_URL || 'http://localhost:3005';

      const response = await fetch(`${reportServiceUrl}/render/class-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const rawError = await response.text();
        let message = rawError;
        try {
          const parsed = JSON.parse(rawError);
          message = parsed?.message || parsed?.error?.message || parsed?.error || rawError;
        } catch {}
        throw new Error(`Report service error: ${typeof message === 'string' ? message : JSON.stringify(message)}`);
      }

      const pdfBuffer = await response.arrayBuffer();
      const filename = this.safeFilename(data.className, 'class-list');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="class-list-${filename}.pdf"`,
        'Content-Length': pdfBuffer.byteLength,
        'Cache-Control': 'no-store',
      });
      res.send(Buffer.from(pdfBuffer));
    } catch (err: any) {
      if (err instanceof ForbiddenException) throw err;
      throw new BadGatewayException(`Failed to generate class list PDF: ${err?.message || err}`);
    }
  }

  @Get('class-list/:classId/excel')
  @UseGuards(RolesGuard)
  @Roles(...CLASS_LIST_ROLES)
  async getClassListExcel(
    @Param('classId') classId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    try {
      const schoolId = this.schoolIdFromRequest(req);
      const data = await this.attendanceService.getClassListData(classId, schoolId);
      const buffer = await this.buildClassListExcel(data);
      const filename = this.safeFilename(data.className, 'class-list');
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="class-list-${filename}.xlsx"`,
        'Content-Length': buffer.byteLength,
        'Cache-Control': 'no-store',
      });
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      if (err instanceof ForbiddenException) throw err;
      throw new BadGatewayException(`Failed to generate class list Excel: ${err?.message || err}`);
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
