import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

export interface ExportOptions {
  schoolName?: string;
  address?: string;
  province?: string;
  district?: string;
  constituency?: string;
  ward?: string;
  zone?: string;
  schoolType?: string;
  emisNumber?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  motto?: string;
  academicYear?: string;
  term?: string;
  generatedBy?: string;
  schoolLogo?: string;
}

@Injectable()
export class StaffExcelService {
  private readonly logger = new Logger(StaffExcelService.name);
  private readonly schoolHeaderRows = 4;

  constructor(private prisma: PrismaService) {}

  async generateInstitutionalReturnExcel(submissionId: string, schoolId: string, options: ExportOptions = {}): Promise<ExcelJS.Buffer> {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id: submissionId },
      include: { template: { include: { columns: { orderBy: { columnOrder: 'asc' } } } } },
    });
    if (!submission || submission.schoolId !== schoolId) throw new Error('Submission not found');
    const config = (submission.template.config || {}) as any;
    const asset = config.workbookAsset;
    if (!asset || !config.sheetName) return this.generateStaffReturnExcel(submissionId, schoolId, options);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(process.cwd(), 'hr_profile_docs', asset));
    const worksheet = workbook.getWorksheet(config.sheetName);
    if (!worksheet) throw new Error(`Template worksheet not found: ${config.sheetName}`);
    const rows = (submission.data as any[]) || [];
    const headerRow = Number(config.headerRow || 4);
    let dataStartRow = Number(config.dataStartRow || headerRow + 1);
    const columns = submission.template.columns;
    worksheet.spliceRows(1, 0, ...Array.from({ length: this.schoolHeaderRows }, () => []));
    this.shiftWorksheetValidations(workbook, worksheet, this.schoolHeaderRows);
    dataStartRow += this.schoolHeaderRows;
    this.writeSchoolHeader(worksheet, options, submission.template.name, submission.period, columns.length);
    worksheet.pageSetup.printTitlesRow = `1:${headerRow + this.schoolHeaderRows}`;
    rows.forEach((rowData: any, rowIndex: number) => {
      const row = rowData?.values || rowData;
      const target = worksheet.getRow(dataStartRow + rowIndex);
      columns.forEach((column: any, columnIndex: number) => {
        const value = row[column.columnName] ?? '';
        const cell = target.getCell(columnIndex + 1);
        cell.value = value instanceof Date ? value : this.coerceExcelValue(value, column.dataType);
      });
    });
    workbook.creator = options.generatedBy || 'SmartTech SaaS';
    workbook.modified = new Date();
    const buffer = await workbook.xlsx.writeBuffer();
    await this.prisma.staffReturnSubmission.update({
      where: { id: submissionId },
      data: { status: submission.status === 'APPROVED' ? 'APPROVED' : 'EXPORTED', generatedBy: options.generatedBy, generatedAt: new Date() },
    });
    return buffer;
  }

  private coerceExcelValue(value: any, dataType?: string) {
    if (value === null || value === undefined || value === '') return '';
    if (dataType === 'number' && typeof value === 'string' && !Number.isNaN(Number(value))) return Number(value);
    if (dataType === 'date' && typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return value;
  }

  async generateStaffReturnExcel(
    submissionId: string,
    schoolId: string,
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

    if (!submission || submission.schoolId !== schoolId) {
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

    this.writeSchoolHeader(worksheet, options, submission.template.name, submission.period, columns.length);

    // ── Column Headers ──
    const headerBgColor = '1A1A2E';
    const whiteText = 'FFFFFF';
    const darkText = '1A1A2E';

    const columnHeaderRowIndex = this.schoolHeaderRows + 1;
    const headerRow = worksheet.getRow(columnHeaderRowIndex);
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
    let rowIndex = columnHeaderRowIndex + 1;
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
      const width = col.width ? Math.max(col.width / 7, 10) : 18;
      worksheet.getColumn(index + 1).width = width;
    });

    // ── Auto-filter ──
    if (rows.length > 0 && columns.length > 0) {
      const lastCol = columns.length;
      const lastRow = columnHeaderRowIndex + rows.length;
      worksheet.autoFilter = {
        from: { row: columnHeaderRowIndex, column: 1 },
        to: { row: lastRow, column: lastCol },
      };
    }

    // ── Print settings ──
    worksheet.pageSetup.printTitlesRow = `1:${columnHeaderRowIndex}`;
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

    this.writeSchoolHeader(worksheet, options, `Staff Profiles (${profiles.length})`, undefined, 8);

    const headers = [
      'Employee #', 'Name', 'Gender', 'Position', 'Grade', 'Status', 'Phone', 'Email',
    ];

    const columnHeaderRowIndex = this.schoolHeaderRows + 1;
    const headerRow = worksheet.getRow(columnHeaderRowIndex);
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

    let rowIdx = columnHeaderRowIndex + 1;
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
    worksheet.pageSetup.printTitlesRow = `1:${columnHeaderRowIndex}`;

    return await workbook.xlsx.writeBuffer();
  }

  async generateTemplateExcel(
    templateId: string,
    schoolId: string,
    options: ExportOptions = {},
  ): Promise<ExcelJS.Buffer> {
    const template = await this.prisma.staffReturnTemplate.findFirst({
      where: { id: templateId, schoolId },
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

    this.writeSchoolHeader(worksheet, options, template.name, options.academicYear, columns.length);

    // Column headers
    const columnHeaderRowIndex = this.schoolHeaderRows + 1;
    const headerRow = worksheet.getRow(columnHeaderRowIndex);
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
      const row = worksheet.getRow(columnHeaderRowIndex + 1 + i);
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
    worksheet.pageSetup.printTitlesRow = `1:${columnHeaderRowIndex}`;
    return await workbook.xlsx.writeBuffer();
  }

  private writeSchoolHeader(
    worksheet: ExcelJS.Worksheet,
    options: ExportOptions,
    returnName: string,
    period: string | undefined,
    requestedColumns: number,
  ) {
    const columnCount = Math.max(1, worksheet.columnCount, requestedColumns);
    const detailParts = [
      options.address,
      options.ward && `Ward: ${options.ward}`,
      options.constituency && `Constituency: ${options.constituency}`,
      options.district && `District: ${options.district}`,
      options.province && `Province: ${options.province}`,
      options.zone && `Zone: ${options.zone}`,
      options.schoolType && `School Type: ${options.schoolType}`,
    ].filter(Boolean);
    const contactParts = [
      options.emisNumber && `EMIS: ${options.emisNumber}`,
      options.registrationNumber && `Registration No.: ${options.registrationNumber}`,
      options.phone && `Tel: ${options.phone}`,
      options.email && `Email: ${options.email}`,
      options.website,
    ].filter(Boolean);
    const title = String(options.schoolName || 'School').trim();
    const brandColor = '17324D';
    const accentColor = 'D8A54A';

    for (let rowIndex = 1; rowIndex <= this.schoolHeaderRows; rowIndex++) {
      worksheet.mergeCells(rowIndex, 1, rowIndex, columnCount);
      const row = worksheet.getRow(rowIndex);
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      row.getCell(1).border = { bottom: { style: rowIndex === this.schoolHeaderRows ? 'medium' : 'thin', color: { argb: accentColor } } };
    }

    const schoolTitleCell = worksheet.getCell(1, 1);
    schoolTitleCell.value = title.toLocaleUpperCase();
    schoolTitleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFF' } };
    schoolTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandColor } };
    worksheet.getRow(1).height = 34;

    const detailsText = detailParts.join('   |   ') || 'School details';
    const detailsCell = worksheet.getCell(2, 1);
    detailsCell.value = detailsText;
    detailsCell.font = { name: 'Arial', size: 10, color: { argb: '263746' } };
    detailsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF3F7' } };
    worksheet.getRow(2).height = Math.min(48, Math.max(24, Math.ceil(detailsText.length / 90) * 16));

    const contactCell = worksheet.getCell(3, 1);
    const contactText = [options.motto && `“${options.motto}”`, ...contactParts].filter(Boolean).join('   |   ') || 'School contact and registration details';
    contactCell.value = contactText;
    contactCell.font = { name: 'Arial', size: 9, color: { argb: '455A64' }, italic: Boolean(options.motto) };
    contactCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F7F9FB' } };
    worksheet.getRow(3).height = Math.min(42, Math.max(22, Math.ceil(contactText.length / 100) * 14));

    const reportCell = worksheet.getCell(4, 1);
    const reportParts = [returnName, period && `Period: ${period}`, options.academicYear && `Academic Year: ${options.academicYear}`, options.term && `Term: ${options.term}`, `Generated: ${new Date().toLocaleDateString()}`].filter(Boolean);
    reportCell.value = reportParts.join('   |   ');
    reportCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: brandColor } };
    reportCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8E8' } };
    worksheet.getRow(4).height = 26;
  }

  private shiftWorksheetValidations(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, rowsInserted: number) {
    workbook.definedNames.spliceRows(worksheet.name, 1, 0, rowsInserted);
    const existing = worksheet.dataValidations.model as Record<string, any>;
    const shifted: Record<string, any> = {};
    const shiftReferences = (references: string) => references.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g, (_match, column: string, row: string) => `${column}${Number(row) + rowsInserted}`);

    for (const [range, rule] of Object.entries(existing)) {
      shifted[shiftReferences(range)] = {
        ...rule,
        formulae: Array.isArray(rule.formulae) ? rule.formulae.map((formula: any) => typeof formula === 'string' ? shiftReferences(formula) : formula) : rule.formulae,
      };
    }
    worksheet.dataValidations.model = shifted;
  }
}
