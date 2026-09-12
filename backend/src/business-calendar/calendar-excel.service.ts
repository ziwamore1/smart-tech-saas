import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

export const CALENDAR_TEMPLATE_VERSION = '1.0';
export const CALENDAR_SCHEMA_VERSION = '1.0';
const ACTIVITY_HEADERS = [
  'Activity Code', 'Title', 'Description', 'Start Date', 'End Date', 'Start Time', 'End Time',
  'All Day', 'Category', 'Department', 'Officer', 'Status', 'Priority', 'Deadline', 'Notes', 'Parent Code',
];

const text = (value: any) => String(value ?? '').trim();
const key = (value: any) => text(value).toLowerCase();

@Injectable()
export class CalendarExcelService {
  constructor(private readonly prisma: PrismaService) {}

  private asDate(value: any, field: string): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number') {
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const valueText = text(value);
    if (!valueText) return null;
    const ddmmyyyy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(valueText);
    if (ddmmyyyy) {
      const date = new Date(Date.UTC(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1])));
      return date.getUTCDate() === Number(ddmmyyyy[1]) ? date : null;
    }
    const date = new Date(valueText);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private asTime(value: any): string | null {
    if (value instanceof Date) return value.toISOString().slice(11, 16);
    if (typeof value === 'number' && value >= 0 && value < 1) {
      const minutes = Math.round(value * 1440);
      return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    }
    const valueText = text(value);
    if (!valueText) return null;
    const match = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(valueText);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    let hour = Number(match[1]);
    if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return `${String(hour).padStart(2, '0')}:${match[2]}`;
  }

  private lookup(sheet: ExcelJS.Worksheet, value: any, idIndex: Map<string, string>, nameIndex: Map<string, string>) {
    const valueText = text(value);
    return idIndex.get(valueText) || nameIndex.get(key(valueText)) || null;
  }

  async createWorkbook(schoolId: string, calendarId: string, includeActivities: boolean) {
    const [school, calendar, categories, departments, staff, activities] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, motto: true, logo: true, logoUrl: true } }),
      this.prisma.schoolBusinessCalendar.findFirst({ where: { id: calendarId, schoolId }, include: { academicYear: true, term: true } }),
      this.prisma.calendarCategory.findMany({ where: { schoolId, isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.department.findMany({ where: { schoolId, isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.user.findMany({ where: { schoolId, isActive: true }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { lastName: 'asc' } }),
      includeActivities ? this.prisma.calendarActivity.findMany({ where: { schoolId, calendarId }, include: { category: true, department: true, officer: true, subItems: true }, orderBy: [{ startDate: 'asc' }, { title: 'asc' }] }) : Promise.resolve([]),
    ]);
    if (!calendar) throw new BadRequestException('Calendar not found');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Tech SaaS';
    workbook.properties.date1904 = false;
    const blue = '17365D';
    const lightBlue = 'D9EAF7';
    const setup = (sheet: ExcelJS.Worksheet, title: string, columns: string[]) => {
      sheet.mergeCells(1, 1, 1, Math.max(columns.length, 3));
      sheet.getCell(1, 1).value = `${school?.name || 'School'} | ${title}`;
      sheet.getCell(1, 1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
      sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blue } };
      sheet.getRow(3).values = columns;
      sheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blue } };
      sheet.getRow(3).alignment = { wrapText: true };
      sheet.views = [{ state: 'frozen', ySplit: 3 }];
      sheet.autoFilter = { from: 'A3', to: `${String.fromCharCode(64 + Math.min(columns.length, 26))}3` };
      sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      columns.forEach((column, index) => { sheet.getColumn(index + 1).width = Math.max(14, Math.min(32, column.length + 5)); });
    };

    const activitiesSheet = workbook.addWorksheet('Calendar Activities');
    setup(activitiesSheet, 'Calendar Activities', ACTIVITY_HEADERS);
    if (includeActivities) activities.forEach((activity: any) => activitiesSheet.addRow([
      activity.activityCode || '', activity.title, activity.description || '', activity.startDate, activity.endDate,
      activity.startTime || '', activity.endTime || '', activity.allDay ? 'Yes' : 'No', activity.category?.name || '',
      activity.department?.name || '', activity.officer ? `${activity.officer.firstName} ${activity.officer.lastName}` : '',
      activity.status, activity.priority, activity.deadline || '', activity.notes || '', activity.parentId || '',
    ]));
    activitiesSheet.getColumn(4).numFmt = 'dd/mm/yyyy'; activitiesSheet.getColumn(5).numFmt = 'dd/mm/yyyy'; activitiesSheet.getColumn(14).numFmt = 'dd/mm/yyyy';

    const subItems = workbook.addWorksheet('Activity Sub-Items');
    setup(subItems, 'Activity Sub-Items', ['Activity Code', 'Title', 'Notes', 'Due Date', 'Complete', 'Sort Order']);
    if (includeActivities) activities.forEach((activity: any) => activity.subItems.forEach((item: any) => subItems.addRow([activity.activityCode || activity.title, item.title, item.notes || '', item.dueDate || '', item.isComplete ? 'Yes' : 'No', item.sortOrder])));
    subItems.getColumn(4).numFmt = 'dd/mm/yyyy';

    setup(workbook.addWorksheet('Recurring Week Schedule'), 'Recurring Week Schedule', ['Activity Code', 'Day', 'Start Time', 'End Time', 'Notes']);
    const instructions = workbook.addWorksheet('Instructions');
    instructions.getColumn(1).width = 110;
    instructions.getCell('A1').value = 'Calendar Excel Workflow'; instructions.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }; instructions.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blue } };
    ['Excel is input only. Validate and preview before committing.', 'Do not rename sheets or headers.', 'Dates may be DD/MM/YYYY, ISO, or native Excel dates. Required fields are Activity Code, Title, Start Date, End Date, and Category.', 'The Calendar Activities sheet is editable. Lookup and metadata sheets are protected.'].forEach((line, i) => { instructions.getCell(i + 3, 1).value = line; });

    const metadata = workbook.addWorksheet('Template Information');
    metadata.state = 'veryHidden'; metadata.addRows([['Key', 'Value'], ['templateVersion', CALENDAR_TEMPLATE_VERSION], ['schemaVersion', CALENDAR_SCHEMA_VERSION], ['schoolId', schoolId], ['calendarId', calendarId], ['academicYearId', calendar.academicYearId], ['termId', calendar.termId || ''], ['calendarName', calendar.name]]); await metadata.protect('calendar-metadata', { selectLockedCells: true, selectUnlockedCells: false });
    const lookupData = [
      ['Categories', 'Id', 'Name'], ...categories.map((item) => ['Category', item.id, item.name]),
      ['Departments', 'Id', 'Name'], ...departments.map((item) => ['Department', item.id, item.name]),
      ['Staff', 'Id', 'Name'], ...staff.map((item) => ['Staff', item.id, `${item.firstName} ${item.lastName}`]),
      ['Audiences', 'Value', 'Label'], ['Audience', 'SCHOOL', 'School'], ['Audience', 'STAFF', 'Staff'], ['Audience', 'STUDENTS', 'Students'], ['Audience', 'PARENTS', 'Parents'],
    ];
    const lookup = workbook.addWorksheet('Validation Lists'); lookup.state = 'veryHidden'; lookup.addRows(lookupData); await lookup.protect('calendar-lookups', { selectLockedCells: true, selectUnlockedCells: false });
    const categorySheet = workbook.addWorksheet('Categories'); categorySheet.state = 'hidden'; categorySheet.addRow(['Id', 'Name']); categories.forEach((item) => categorySheet.addRow([item.id, item.name])); await categorySheet.protect('calendar-lookups');
    const departmentSheet = workbook.addWorksheet('Departments'); departmentSheet.state = 'hidden'; departmentSheet.addRow(['Id', 'Name']); departments.forEach((item) => departmentSheet.addRow([item.id, item.name])); await departmentSheet.protect('calendar-lookups');
    const staffSheet = workbook.addWorksheet('Staff'); staffSheet.state = 'hidden'; staffSheet.addRow(['Id', 'Name']); staff.forEach((item) => staffSheet.addRow([item.id, `${item.firstName} ${item.lastName}`])); await staffSheet.protect('calendar-lookups');
    const audienceSheet = workbook.addWorksheet('Audiences'); audienceSheet.state = 'hidden'; audienceSheet.addRows([['Value', 'Label'], ['SCHOOL', 'School'], ['STAFF', 'Staff'], ['STUDENTS', 'Students'], ['PARENTS', 'Parents']]); await audienceSheet.protect('calendar-lookups');
    const validations: Array<[number, string]> = [[9, `Categories!$B$2:$B$${Math.max(categories.length + 1, 2)}`], [10, `Departments!$B$2:$B$${Math.max(departments.length + 1, 2)}`], [11, `Staff!$B$2:$B$${Math.max(staff.length + 1, 2)}`]];
    for (const [column, formula] of validations) activitiesSheet.getColumn(column).eachCell((cell, rowNumber) => { if (rowNumber > 3) cell.dataValidation = { type: 'list', allowBlank: true, formulae: [`'${formula.split('!')[0]}'!${formula.split('!')[1]}`] }; });
    if (school?.logoUrl || school?.logo) { try { const image = await fetch(school.logoUrl || school.logo!).then((response) => response.arrayBuffer()); const imageId = workbook.addImage({ buffer: Buffer.from(image), extension: 'png' }); instructions.addImage(imageId, { tl: { col: 2, row: 0 }, ext: { width: 120, height: 60 } }); } catch { /* branding remains usable when logo is remote/unavailable */ } }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async parse(buffer: Buffer, filename: string, schoolId: string, calendarId: string, mode: 'UPDATE_EXISTING' | 'FULL_SYNC') {
    if (!filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xlsm')) throw new BadRequestException('Only .xlsx workbooks are accepted');
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(buffer); } catch { throw new BadRequestException('The workbook is not a readable xlsx file'); }
    if (workbook.worksheets.some((sheet: any) => sheet.name.toLowerCase().includes('external'))) throw new BadRequestException('External-link sheets are not accepted');
    const activitySheet = workbook.getWorksheet('Calendar Activities');
    const metadata = workbook.getWorksheet('Template Information');
    if (!activitySheet || !metadata || !workbook.getWorksheet('Activity Sub-Items') || !workbook.getWorksheet('Recurring Week Schedule')) throw new BadRequestException('Required calendar sheets are missing');
    const metadataValues = new Map<string, string>(); metadata.eachRow((row) => { if (row.getCell(1).value && row.getCell(1).value !== 'Key') metadataValues.set(text(row.getCell(1).value), text(row.getCell(2).value)); });
    if (metadataValues.get('schoolId') !== schoolId || metadataValues.get('calendarId') !== calendarId) throw new BadRequestException('Workbook metadata does not belong to this school and calendar');
    if (metadataValues.get('templateVersion') !== CALENDAR_TEMPLATE_VERSION || metadataValues.get('schemaVersion') !== CALENDAR_SCHEMA_VERSION) throw new BadRequestException('Unsupported calendar template version');
    const headerRow = activitySheet.getRows(1, activitySheet.rowCount)?.find((row) => text(row.getCell(1).value) === ACTIVITY_HEADERS[0] && text(row.getCell(2).value) === ACTIVITY_HEADERS[1]);
    if (!headerRow) throw new BadRequestException('Calendar Activities headers are missing or changed');
    const headers = ACTIVITY_HEADERS; const rawRows: any[] = [];
    for (let rowNumber = headerRow.number + 1; rowNumber <= activitySheet.rowCount; rowNumber++) { const row = activitySheet.getRow(rowNumber); const raw = Object.fromEntries(headers.map((header, index) => [header, row.getCell(index + 1).value instanceof Date ? row.getCell(index + 1).value.toISOString() : row.getCell(index + 1).value ?? null])); if (Object.values(raw).some((value) => text(value))) rawRows.push({ rowNumber, raw }); }
    const [calendar, categories, departments, staff, existing] = await Promise.all([
      this.prisma.schoolBusinessCalendar.findFirst({ where: { id: calendarId, schoolId } }), this.prisma.calendarCategory.findMany({ where: { schoolId, OR: [{ calendarId }, { calendarId: null }], isActive: true } }), this.prisma.department.findMany({ where: { schoolId, isActive: true } }), this.prisma.user.findMany({ where: { schoolId, isActive: true } }), this.prisma.calendarActivity.findMany({ where: { schoolId, calendarId } }),
    ]);
    if (!calendar) throw new BadRequestException('Calendar not found');
    const categoryIds = new Map(categories.map((item) => [item.id, item.id])); const categoryNames = new Map(categories.map((item) => [key(item.name), item.id]));
    const departmentIds = new Map(departments.map((item) => [item.id, item.id])); const departmentNames = new Map(departments.map((item) => [key(item.name), item.id]));
    const officerIds = new Map(staff.map((item) => [item.id, item.id])); const officerNames = new Map(staff.map((item) => [key(`${item.firstName} ${item.lastName}`), item.id]));
    const allCodes = new Set(rawRows.map(({ raw }) => key(raw['Activity Code'])).filter(Boolean)); const seenCodes = new Set<string>(); const rows = rawRows.map(({ rowNumber, raw }) => {
      const errors: string[] = []; const warnings: string[] = []; const activityCode = text(raw['Activity Code']); const title = text(raw.Title); const startDate = this.asDate(raw['Start Date'], 'Start Date'); const endDate = this.asDate(raw['End Date'], 'End Date') || startDate; const categoryId = this.lookup(activitySheet, raw.Category, categoryIds, categoryNames); const departmentId = this.lookup(activitySheet, raw.Department, departmentIds, departmentNames); const officerId = this.lookup(activitySheet, raw.Officer, officerIds, officerNames); const startTime = raw['Start Time'] ? this.asTime(raw['Start Time']) : null; const endTime = raw['End Time'] ? this.asTime(raw['End Time']) : null;
      if (!activityCode) errors.push('Activity Code is required'); if (!title) errors.push('Title is required'); if (!startDate) errors.push('Start Date is required and invalid'); if (!endDate) errors.push('End Date is required and invalid'); if (startDate && endDate && endDate < startDate) errors.push('End Date is before Start Date'); if (!categoryId) errors.push('Category is required and must be a current school category'); if (raw['Start Time'] && !startTime) errors.push('Start Time is invalid'); if (raw['End Time'] && !endTime) errors.push('End Time is invalid'); if (activityCode && seenCodes.has(key(activityCode))) errors.push('Duplicate Activity Code'); if (activityCode) seenCodes.add(key(activityCode)); if (text(raw['Parent Code']) && !allCodes.has(key(raw['Parent Code']))) errors.push('Parent Code does not exist in this workbook'); if (startDate && (startDate < calendar.startDate || startDate > calendar.endDate)) warnings.push('Date is outside the calendar range');
      const found = existing.find((item: any) => (activityCode && item.activityCode === activityCode) || (!activityCode && item.title === title && item.startDate.getTime() === startDate?.getTime() && item.officerId === officerId));
      const normalizedData = { activityCode, title, description: text(raw.Description) || null, startDate: startDate?.toISOString() || null, endDate: endDate?.toISOString() || null, startTime, endTime, allDay: key(raw['All Day']) !== 'no', categoryId, departmentId, officerId, status: text(raw.Status) || 'PLANNED', priority: text(raw.Priority) || 'NORMAL', deadline: this.asDate(raw.Deadline, 'Deadline')?.toISOString() || null, notes: text(raw.Notes) || null, parentCode: text(raw['Parent Code']) || null };
       const status = errors.length ? 'ERROR' : warnings.length ? 'WARNING' : 'VALID'; const changeType = found ? JSON.stringify(found) === JSON.stringify({ ...found, ...normalizedData }) ? 'UNCHANGED' : 'UPDATE' : 'CREATE';
      return { rowNumber, rawData: raw, normalizedData, status, errors: [...errors, ...warnings], changeType, existingActivityId: found?.id };
    });
    return { metadata: metadataValues, mode, rows, counts: { total: rows.length, valid: rows.filter((row) => row.status === 'VALID').length, warnings: rows.filter((row) => row.status === 'WARNING').length, errors: rows.filter((row) => row.status === 'ERROR').length } };
  }

  async stage(buffer: Buffer, filename: string, schoolId: string, calendarId: string, mode: 'UPDATE_EXISTING' | 'FULL_SYNC', uploadedById?: string) {
    const parsed = await this.parse(buffer, filename, schoolId, calendarId, mode);
    const staged = await this.prisma.calendarImport.create({ data: {
      schoolId, calendarId, uploadedById, filename,
      templateVersion: parsed.metadata.get('templateVersion') || CALENDAR_TEMPLATE_VERSION,
      schemaVersion: parsed.metadata.get('schemaVersion') || CALENDAR_SCHEMA_VERSION,
      mode, status: parsed.counts.errors ? 'FAILED' : 'READY',
      totalRows: parsed.counts.total, validRows: parsed.counts.valid, warningRows: parsed.counts.warnings, errorRows: parsed.counts.errors,
      errorSummary: parsed.counts.errors ? { errors: parsed.rows.filter((row) => row.status === 'ERROR').map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })) } : undefined,
      rows: { create: parsed.rows.map((row) => ({ rowNumber: row.rowNumber, rawData: row.rawData, normalizedData: row.normalizedData, status: row.status, errors: row.errors, changeType: row.changeType, existingActivityId: row.existingActivityId })) },
    }, include: { rows: true } });
    return { importId: staged.id, status: staged.status, counts: parsed.counts, rows: parsed.rows };
  }

  async getImport(id: string, schoolId: string) {
    return this.prisma.calendarImport.findFirst({ where: { id, schoolId }, include: { rows: { orderBy: { rowNumber: 'asc' } } } });
  }
}
