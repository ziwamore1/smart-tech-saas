import * as ExcelJS from 'exceljs';
import { StaffExcelService } from './staff-excel.service';
import { MOE_TEACHING_FIELDS } from './institutional-returns.registry';

describe('StaffExcelService school headers', () => {
  it('adds school details without losing district headers, staff values, or lookup validations', async () => {
    const submission = {
      id: 'submission-1',
      schoolId: 'school-1',
      period: '2026',
      status: 'DRAFT',
      data: [{ values: { 'staff.surname': 'Teacher', 'staff.firstName': 'Example' } }],
      template: {
        name: 'District Teaching Staff Return',
        config: {
          workbookAsset: '2026 Teaching Staff Template-September.xlsx',
          sheetName: 'Teacher Info',
          headerRow: 1,
          dataStartRow: 2,
        },
        columns: [
          { columnName: 'staff.surname', columnLabel: 'Surname', columnOrder: 0, dataType: 'text' },
          { columnName: 'staff.firstName', columnLabel: 'First Name', columnOrder: 1, dataType: 'text' },
        ],
      },
    };
    const prisma = {
      staffReturnSubmission: {
        findUnique: jest.fn().mockResolvedValue(submission),
        update: jest.fn().mockResolvedValue(submission),
      },
    };
    const service = new StaffExcelService(prisma as any);

    const buffer = await service.generateInstitutionalReturnExcel('submission-1', 'school-1', {
      schoolName: 'Example Primary School',
      address: 'Plot 10, Main Road',
      district: 'Kabwe',
      province: 'Central',
      emisNumber: '12345',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet('Teacher Info')!;

    expect(worksheet.getCell('A1').value).toBe('EXAMPLE PRIMARY SCHOOL');
    expect(worksheet.getCell('A2').value).toContain('Plot 10, Main Road');
    expect(worksheet.getCell('A5').value).toBe('SN');
    expect(worksheet.getCell('A6').value).toBe('Teacher');
    expect(worksheet.getCell('B6').value).toBe('Example');
    expect(worksheet.dataValidations.model.B6?.formulae).toEqual(['$AJ$7:$AS$7']);
    expect(worksheet.dataValidations.model.B2).toBeUndefined();
    expect(workbook.definedNames.model.find((name) => name.name === 'Central')?.ranges).toEqual(["'Teacher Info'!$AJ$8:$AJ$18"]);
  });

  it('rewrites all MoE headers visibly and aligns compiled values with the template columns', async () => {
    const labels = MOE_TEACHING_FIELDS.map(([, label]) => label);
    const submission = {
      id: 'submission-2',
      schoolId: 'school-1',
      period: '2026',
      status: 'DRAFT',
      data: [{ values: {
        'return.serialNumber': 1,
        'school.name': 'Example School',
        'field.17': '1981-03-15T00:00:00.000Z',
        'field.19': '2002-08-01T00:00:00.000Z',
      } }],
      template: {
        name: 'MoE Teaching Staffing Return',
        config: {
          workbookAsset: '2026 MoE Revised ASC and Statistical Tables Final-September.xlsx',
          sheetName: '8 A. Teaching Staffing',
          headerRow: 4,
          dataStartRow: 5,
        },
        columns: labels.map((label, index) => ({
          columnName: index === 0 ? 'return.serialNumber' : index === 1 ? 'school.name' : `field.${index}`,
          columnLabel: label,
          columnOrder: index,
          dataType: [17, 19].includes(index) ? 'date' : 'text',
        })),
      },
    };
    const prisma = {
      staffReturnSubmission: {
        findUnique: jest.fn().mockResolvedValue(submission),
        update: jest.fn().mockResolvedValue(submission),
      },
    };
    const service = new StaffExcelService(prisma as any);

    const buffer = await service.generateInstitutionalReturnExcel('submission-2', 'school-1', { schoolName: 'Example School' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet('8 A. Teaching Staffing')!;

    expect(worksheet.getCell('B8').value).toBe('SN');
    expect(worksheet.getCell('C8').value).toBe('School Name');
    expect(worksheet.getCell('AN8').value).toBe('Number of Days Absent');
    expect(worksheet.getCell('B9').value).toBe(1);
    expect(worksheet.getCell('C9').value).toBe('Example School');
    expect(worksheet.getCell('S9').value).toBeInstanceOf(Date);
    expect(worksheet.getCell('U9').value).toBeInstanceOf(Date);
    expect(worksheet.getCell('S9').numFmt).toBe('dd/mm/yyyy');
    expect(worksheet.getCell('U9').numFmt).toBe('dd/mm/yyyy');
    expect(worksheet.getCell('AN8').font?.color).toEqual({ argb: '1A1A2E' });
    expect(worksheet.getRow(8).height).toBeGreaterThanOrEqual(30);
  });

  it('writes DOB and appointment dates as real Excel dates with an explicit day/month/year format', async () => {
    const columns = [
      { columnName: 'staff.dateOfBirth', columnLabel: 'Date of Birth', columnOrder: 0, dataType: 'date' },
      { columnName: 'staff.firstAppointmentDate', columnLabel: 'Date of First Appointment', columnOrder: 1, dataType: 'date' },
    ];
    const submission = {
      id: 'submission-3',
      schoolId: 'school-1',
      period: '2026',
      status: 'DRAFT',
      data: [{ values: { 'staff.dateOfBirth': '1981-03-15T00:00:00.000Z', 'staff.firstAppointmentDate': '2002-08-01T00:00:00.000Z' } }],
      template: {
        name: 'Date Test Return',
        config: { sheetName: '', headerRow: 1, dataStartRow: 2 },
        columns,
      },
    };
    const prisma = {
      staffReturnSubmission: {
        findUnique: jest.fn().mockResolvedValue(submission),
      },
    };
    const service = new StaffExcelService(prisma as any);

    const buffer = await service.generateStaffReturnExcel('submission-3', 'school-1');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    const dob = worksheet.getCell('A6');
    const appointment = worksheet.getCell('B6');

    expect(dob.value).toBeInstanceOf(Date);
    expect(appointment.value).toBeInstanceOf(Date);
    expect(dob.numFmt).toBe('dd/mm/yyyy');
    expect(appointment.numFmt).toBe('dd/mm/yyyy');
    expect((dob.value as Date).toISOString().slice(0, 10)).toBe('1981-03-15');
    expect((appointment.value as Date).toISOString().slice(0, 10)).toBe('2002-08-01');
  });
});
