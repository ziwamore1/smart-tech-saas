import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

export interface ExportOptions {
  schoolName?: string;
  province?: string;
  district?: string;
  academicYear?: string;
  term?: string;
  generatedBy?: string;
  schoolLogo?: string;
}

@Injectable()
export class StaffExcelService {
  private readonly logger = new Logger(StaffExcelService.name);

  constructor(private prisma: PrismaService) {}

  async generateStaffReturnExcel(
    submissionId: string,
    options: ExportOptions = {},
  ): Promise<ExcelJS.Buffer> {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id: submissionId },
      include: {
        template: {
          include: {
            columns: { where: { isVisible: true }, orderBy: { columnOrder: 'asc' } },
          },
        },
      },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    const columns = submission.template.columns;
    const rows = (submission.data as any[]) || [];
    const workbook = new ExcelJS.Workbook();
    workbook.creator = options.generatedBy || 'SmartTech SaaS';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(
      `${submission.template.name} - ${submission.period}`,
      { pageSetup: { orientation: 'landscape', fitToPage: true, margins: {
        left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3,
      }}}
    );

    // ── Branding Header ──
    const brandColor = 'EA6645';
    const headerBgColor = '1A1A2E';
    const secondaryBg = 'F5EFE8';
    const whiteText = 'FFFFFF';
    const darkText = '1A1A2E';

    // Title block
    worksheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = `${options.schoolName || 'School'} - Staff Return`;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: headerBgColor } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 36;

    // Info block
    worksheet.mergeCells(2, 1, 2, columns.length);
    const infoParts = [];
    if (options.province) infoParts.push(`Province: ${options.province}`);
    if (options.district) infoParts.push(`District: ${options.district}`);
    if (options.academicYear) infoParts.push(`Academic Year: ${options.academicYear}`);
    if (options.term) infoParts.push(`Term: ${options.term}`);
    infoParts.push(`Period: ${submission.period}`);
    infoParts.push(`Generated: ${new Date().toLocaleDateString()}`);

    const infoCell = worksheet.getCell(2, 1);
    infoCell.value = infoParts.join('  |  ');
    infoCell.font = { name: 'Calibri', size: 10, color: { argb: '666666' } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: secondaryBg } };
    worksheet.getRow(2).height = 28;

    // SmartTech branding footer note
    worksheet.mergeCells(3, 1, 3, columns.length);
    const brandCell = worksheet.getCell(3, 1);
    brandCell.value = `Powered by SmartTech SaaS  |  Staff Returns & HR Intelligence Hub`;
    brandCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: '999999' } };
    brandCell.alignment = { horizontal: 'center' };
    worksheet.getRow(3).height = 18;

    // ── Column Headers ──
    const headerRow = worksheet.getRow(4);
    headerRow.height = 32;

    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.columnLabel || col.columnName;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: whiteText } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
      cell.alignment = {
        horizontal: (col.alignment as any) || 'left',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // ── Data Rows ──
    let rowIndex = 5;
    for (const rowData of rows) {
      const row = worksheet.getRow(rowIndex);
      let maxLines = 1;

      columns.forEach((col, index) => {
        const cell = row.getCell(index + 1);
        const value = rowData[col.columnName] !== undefined ? rowData[col.columnName] : '';
        cell.value = value;

        cell.font = { name: 'Calibri', size: 10, color: { argb: darkText } };
        cell.alignment = {
          horizontal: (col.alignment as any) || 'left',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        const strVal = String(value || '');
        const lines = Math.ceil(strVal.length / 30) || 1;
        if (lines > maxLines) maxLines = lines;
      });

      const altBg = rowIndex % 2 === 0 ? { argb: 'FAFAFA' } : { argb: 'FFFFFF' };
      columns.forEach((_, index) => {
        row.getCell(index + 1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: altBg,
        };
      });

      row.height = Math.max(22, maxLines * 16);
      rowIndex++;
    }

    // ── Set column widths ──
    columns.forEach((col, index) => {
      const colLetter = (index + 10).toString(36).toUpperCase();
      const width = col.width ? Math.max(col.width / 7, 10) : 18;
      worksheet.getColumn(index + 1).width = width;
    });

    // ── Auto-filter ──
    if (rows.length > 0 && columns.length > 0) {
      const lastCol = columns.length;
      const lastRow = 4 + rows.length;
      worksheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: lastRow, column: lastCol },
      };
    }

    // ── Print settings ──
    worksheet.pageSetup.printTitlesRow = '1:4';
    worksheet.pageSetup.paperSize = 9; // A4
    worksheet.pageSetup.orientation = 'landscape';
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;

    return await workbook.xlsx.writeBuffer();
  }

  async generateStaffProfileExport(
    schoolId: string,
    options: ExportOptions = {},
  ): Promise<ExcelJS.Buffer> {
    const profiles = await this.prisma.staffHrProfile.findMany({
      where: { schoolId },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Staff Profiles', {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    // Branding header
    worksheet.mergeCells(1, 1, 1, 7);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = `${options.schoolName || 'School'} - Staff Profiles`;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: '1A1A2E' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 36;

    worksheet.mergeCells(2, 1, 2, 7);
    const infoCell = worksheet.getCell(2, 1);
    infoCell.value = `Total Staff: ${profiles.length}  |  Generated: ${new Date().toLocaleDateString()}  |  Powered by SmartTech SaaS`;
    infoCell.font = { name: 'Calibri', size: 10, color: { argb: '666666' } };
    infoCell.alignment = { horizontal: 'center' };
    worksheet.getRow(2).height = 24;

    const headers = [
      'Employee #', 'Name', 'Gender', 'Position', 'Grade', 'Status', 'Phone', 'Email',
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.height = 30;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A1A2E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    });

    let rowIdx = 5;
    for (const p of profiles) {
      const row = worksheet.getRow(rowIdx);
      const name = `${p.teacherName || ''}`;
      row.getCell(1).value = p.employeeNumber || '';
      row.getCell(2).value = name;
      row.getCell(3).value = p.gender || '';
      row.getCell(4).value = p.currentPosition || p.substantivePosition || '';
      row.getCell(5).value = p.gradeLevel || '';
      row.getCell(6).value = p.employmentStatus || '';
      row.getCell(7).value = p.phoneNumber || '';
      row.getCell(8).value = p.emailAddress || '';

      for (let i = 1; i <= headers.length; i++) {
        const cell = row.getCell(i);
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
        if (rowIdx % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FAFAFA' } };
        }
      }
      row.height = 22;
      rowIdx++;
    }

    for (let i = 1; i <= headers.length; i++) {
      worksheet.getColumn(i).width = [18, 28, 10, 24, 12, 12, 16, 28][i - 1] || 18;
    }

    worksheet.pageSetup.orientation = 'landscape';
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;

    return await workbook.xlsx.writeBuffer();
  }

  async generateTemplateExcel(
    templateId: string,
    options: ExportOptions = {},
  ): Promise<ExcelJS.Buffer> {
    const template = await this.prisma.staffReturnTemplate.findUnique({
      where: { id: templateId },
      include: {
        columns: { where: { isVisible: true }, orderBy: { columnOrder: 'asc' } },
      },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    const columns = template.columns;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(template.name, {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    // Header
    worksheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = `${options.schoolName || 'School'} - ${template.name}`;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: '1A1A2E' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 34;

    // Column headers
    const headerRow = worksheet.getRow(3);
    headerRow.height = 30;

    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.columnLabel || col.columnName;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EA6645' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    });

    // Empty data rows (for manual entry)
    for (let i = 0; i < 50; i++) {
      const row = worksheet.getRow(4 + i);
      for (let j = 0; j < columns.length; j++) {
        const cell = row.getCell(j + 1);
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { wrapText: true, vertical: 'middle' };
      }
      row.height = 20;
    }

    columns.forEach((col, index) => {
      worksheet.getColumn(index + 1).width = col.width ? Math.max(col.width / 7, 12) : 20;
    });

    worksheet.pageSetup.orientation = 'landscape';
    return await workbook.xlsx.writeBuffer();
  }
}
