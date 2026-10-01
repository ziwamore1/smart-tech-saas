import * as ExcelJS from 'exceljs';
import { StaffExcelService } from './staff-excel.service';

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
    expect(worksheet.getCell('B5').value).toBe('SN');
    expect(worksheet.getCell('A6').value).toBe('Teacher');
    expect(worksheet.getCell('B6').value).toBe('Example');
    expect(worksheet.dataValidations.model.B6?.formulae).toEqual(['$AJ$7:$AS$7']);
    expect(worksheet.dataValidations.model.B2).toBeUndefined();
    expect(workbook.definedNames.model.find((name) => name.name === 'Central')?.ranges).toEqual(["'Teacher Info'!$AJ$8:$AJ$18"]);
  });
});
