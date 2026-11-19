import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res, Req, NotFoundException, BadGatewayException, ForbiddenException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AttendanceController.name);

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

  private escapeHtml(value: any): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private classListHtml(data: any): string {
    const summary = data?.summary || {};
    const students = Array.isArray(data?.students) ? data.students : [];
    const value = (item: any, fallback = '-') => this.escapeHtml(item ?? fallback);
    const rows = students.map((student: any, index: number) => `
      <tr>
        <td>${index + 1}</td>
        <td>${value(student.admNo || student.admissionNumber)}</td>
        <td class="left">${value(student.lastName)}</td>
        <td class="left">${value(student.firstName)}</td>
        <td class="left name">${value(student.name || student.fullName)}</td>
        <td>${value(student.genderLabel)}</td>
        <td>${value(student.dob || student.dateOfBirth)}</td>
        <td>${value(student.age)}</td>
        <td>${value(student.status)}</td>
      </tr>`).join('');
    const orientation = this.classListOrientation(data);

    return `<!doctype html>
      <html><head><meta charset="utf-8"><title>Class List - ${value(data?.className)}</title>
      <style>
        @page { size: A4 ${orientation}; margin: 12mm 10mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #111827; font-size: 10px; }
        h1, h2, p { margin: 0; }
        .header { text-align: center; border-bottom: 3px solid #ea6645; padding-bottom: 9px; margin-bottom: 10px; }
        .header h1 { color: #ea6645; font-size: 20px; }
        .header p, .title p { color: #4b5563; margin-top: 3px; }
        .title { text-align: center; margin-bottom: 9px; }
        .title h2 { font-size: 16px; }
        .meta, .summary, .students { width: 100%; border-collapse: collapse; }
        .meta { table-layout: fixed; margin-bottom: 9px; }
        .meta td { border: 1px solid #d1d5db; padding: 5px 7px; overflow-wrap: anywhere; }
        .meta .label { width: 15%; background: #f3f4f6; font-weight: 700; text-transform: uppercase; }
        .summary { margin-bottom: 8px; table-layout: fixed; }
        .summary td { border: 1px solid #9ca3af; padding: 7px 4px; text-align: center; }
        .summary strong { display: block; font-size: 16px; }
        .summary span { color: #4b5563; font-size: 8px; text-transform: uppercase; }
        .stats { padding: 6px 8px; margin-bottom: 8px; border: 1px solid #d1d5db; overflow-wrap: anywhere; }
        .students { table-layout: fixed; }
        .students th { background: #1f2937; color: #fff; padding: 5px 3px; font-size: 8px; }
        .students td { border: 1px solid #9ca3af; padding: 4px 3px; text-align: center; overflow-wrap: anywhere; }
        .students tr:nth-child(even) { background: #f9fafb; }
        .students .left { text-align: left; }
        .students .name { font-weight: 700; }
        .footer { margin-top: 10px; padding-top: 5px; border-top: 1px solid #9ca3af; text-align: center; color: #6b7280; font-size: 8px; }
      </style></head><body>
      <div class="header"><h1>${value(data?.school?.name)}</h1><p>${value(data?.school?.address)}</p><p>${value(data?.school?.contact)}</p></div>
      <div class="title"><h2>CLASS LIST - ${value(data?.className)}</h2><p>${value(data?.levelType)} | Generated on ${value(data?.generatedAt)}</p></div>
      <table class="meta"><tr><td class="label">Term</td><td>${value(data?.currentTerm)}</td><td class="label">Academic Year</td><td>${value(data?.academicYear)}</td></tr>
      <tr><td class="label">Class</td><td>${value(data?.className)}</td><td class="label">Class Teacher</td><td>${value(data?.classTeacher)}</td></tr></table>
      <table class="summary"><tr><td><strong>${value(summary.total, 0)}</strong><span>Total Students</span></td><td><strong>${value(summary.male, 0)}</strong><span>Male (${value(summary.malePercent, 0)}%)</span></td><td><strong>${value(summary.female, 0)}</strong><span>Female (${value(summary.femalePercent, 0)}%)</span></td><td><strong>${value(summary.other, 0)}</strong><span>Other (${value(summary.otherPercent, 0)}%)</span></td><td><strong>${value(summary.capacity)}</strong><span>Capacity</span></td><td><strong>${value(summary.missingDob, 0)}</strong><span>Missing DOB</span></td></tr></table>
      <div class="stats"><strong>Gender distribution:</strong> Male ${value(summary.male, 0)} (${value(summary.malePercent, 0)}%) | Female ${value(summary.female, 0)} (${value(summary.femalePercent, 0)}%) | Other ${value(summary.other, 0)} (${value(summary.otherPercent, 0)}%)</div>
      <table class="students"><thead><tr><th>#</th><th>Admission No</th><th>Last Name</th><th>First Name</th><th>Full Name</th><th>Gender</th><th>Date of Birth</th><th>Age</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No students found</td></tr>'}</tbody></table>
      <div class="footer">${value(data?.school?.name)} | ${value(data?.generatedAt)}</div>
      </body></html>`;
  }

  private async buildClassListPdfLocally(data: any): Promise<Buffer> {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true,
      timeout: 120000,
    });
    const page = await browser.newPage();
    try {
      page.setDefaultTimeout(60000);
      await page.setContent(this.classListHtml(data), { waitUntil: 'domcontentloaded', timeout: 30000 });
      return Buffer.from(await page.pdf({
        format: 'A4',
        landscape: this.classListOrientation(data) === 'landscape',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: '<div style="width:100%;font-size:8px;color:#6b7280;text-align:center"><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
        margin: { top: '12mm', bottom: '15mm', left: '10mm', right: '10mm' },
      }));
    } finally {
      await page.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
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
    sheet.getRow(13).height = 8;
    const headerRow = 14;
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
      const reportServiceUrl = process.env.REPORT_SERVICE_URL?.trim();
      let pdfBuffer: Buffer;

      if (reportServiceUrl) {
        try {
          const response = await fetch(`${reportServiceUrl.replace(/\/+$/, '')}/render/class-list`, {
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

          pdfBuffer = Buffer.from(await response.arrayBuffer());
        } catch (error: any) {
          this.logger.warn(`Class-list report service unavailable; using local renderer: ${error?.message || error}`);
          pdfBuffer = await this.buildClassListPdfLocally(data);
        }
      } else {
        pdfBuffer = await this.buildClassListPdfLocally(data);
      }

      const filename = this.safeFilename(data.className, 'class-list');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="class-list-${filename}.pdf"`,
        'Content-Length': pdfBuffer.length,
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
