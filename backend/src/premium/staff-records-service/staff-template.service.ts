import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CANONICAL_HR_FIELDS, detectCanonicalField, MOE_NON_TEACHING_HEADERS, INSTITUTIONAL_LOOKUP_SEEDS, ZAMBIA_GEOGRAPHY_SEEDS } from './institutional-returns.registry';

@Injectable()
export class StaffTemplateService {
  private readonly logger = new Logger(StaffTemplateService.name);

  constructor(private prisma: PrismaService) {}

  getCanonicalFields() {
    return CANONICAL_HR_FIELDS;
  }

  async getInstitutionalReturns(schoolId: string) {
    await this.ensureInstitutionalLookups(schoolId);
    await this.ensureOfficialTemplates(schoolId);
    const [templates, submissions] = await Promise.all([
      this.prisma.staffReturnTemplate.findMany({ where: { schoolId, isActive: true }, include: { _count: { select: { submissions: true } } }, orderBy: { updatedAt: 'desc' } }),
      this.findAllSubmissions(schoolId),
    ]);
    return { templates, submissions };
  }

  async getInstitutionalLookups(schoolId: string, category?: string) {
    await this.ensureInstitutionalLookups(schoolId);
    return this.prisma.institutionalLookupValue.findMany({
      where: { active: true, ...(category ? { category } : {}), OR: [{ schoolId: null }, { schoolId }] },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async addInstitutionalLookup(schoolId: string, data: { category: string; label: string; parentCode?: string }) {
    const label = String(data.label || '').trim();
    if (!label) throw new BadRequestException('Lookup value is required');
    const code = label.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    return this.prisma.institutionalLookupValue.upsert({
      where: { schoolId_category_code: { schoolId, category: data.category, code } },
      update: { label, parentCode: data.parentCode, active: true },
      create: { schoolId, category: data.category, code, label, parentCode: data.parentCode, sortOrder: 9999 },
    });
  }

  private async ensureInstitutionalLookups(schoolId: string) {
    const seeds = [...INSTITUTIONAL_LOOKUP_SEEDS, ...ZAMBIA_GEOGRAPHY_SEEDS];
    const existing = await this.prisma.institutionalLookupValue.findMany({
      where: { schoolId: null },
      select: { category: true, code: true },
    });
    const existingKeys = new Set(existing.map((value) => `${value.category}:${value.code}`));
    const missing = seeds.filter((seed) => !existingKeys.has(`${seed.category}:${seed.code}`));
    if (missing.length) {
      await this.prisma.institutionalLookupValue.createMany({
        data: missing.map((seed) => ({ ...seed, schoolId: null })),
        skipDuplicates: true,
      });
    }
  }

  private async ensureOfficialTemplates(schoolId: string) {
    const definitions = [
      { code: 'DISTRICT_TEACHING_STAFF_2026', name: '2026 District Teaching Staff Return', sheetName: 'Teacher Info', nonTeaching: false, workbook: '2026 Teaching Staff Template-September.xlsx', headerRow: 1 },
      { code: 'MOE_TEACHING_STAFF_2026', name: '2026 MoE Teaching Staffing Return', sheetName: '8 A. Teaching Staffing', nonTeaching: false, workbook: '2026 MoE Revised ASC and Statistical Tables Final-September.xlsx', headerRow: 4 },
      { code: 'MOE_NON_TEACHING_STAFF_2026', name: '2026 MoE Non-Teaching Staffing Return', sheetName: '8 B. Non- Teaching Staffing', nonTeaching: true, workbook: '2026 MoE Revised ASC and Statistical Tables Final-September.xlsx', headerRow: 4 },
    ];
    for (const definition of definitions) {
      const existing = await this.prisma.staffReturnTemplate.findFirst({ where: { schoolId, templateCode: definition.code, version: '2026-v1' } });
      if (existing) continue;
      const headers = definition.code === 'DISTRICT_TEACHING_STAFF_2026' ? [
        'SN','Province','District','School Name','EMIS NO.','Location (Rural/Urban/Remote)','Running Agency','Surname','First Name','NRC Number','MAN/TS Number','Employee Number','Date of Birth (DD/MM/YYYY)','Sex','Date of First Appointment to the Teaching Service (DD/MM/YYYY)','Date of Appointment to the Current Post (DD/MM/YYYY)','Marital Status','Differently Abled','Nationality','Substantive Position','Current Position','Highest Level of Education','Highest Teacher Qualification','Additional Responsibilities','Type of In-ServiceTraining Attended (Include CPDs)','Employment Status ','Main Grade Taught ','Staff Presence','Employer','Subject Being Taught (A)','Subject Being Taught (B)','Subject Qualified to Teach (A)','Subject Qualified to Teach (B)','Number of Days Absent',
      ] : definition.nonTeaching ? MOE_NON_TEACHING_HEADERS : [
        'SN','School Name','Province','District','Constituency','Ward','Zone','Location (Rural/Urban)','Running Agency','Type of School (Secondary, Primary, ECE Centre)','EMIS No.','DISTANCE FROM DEB OFFICE','Surname','First Name','NRC Number','MAN/TS Number','Employee Number','Date of Birth (DD/MM/YYYY)','Sex','Date of First Appointment to the Teaching Service (DD/MM/YYYY)','Date of Appointment to the Current Post (DD/MM/YYYY)','Marital Status','Differently Abled','Nationality','Substantive Position','Current Position','Highest Level of Education','Highest Teacher Qualification','Additional Responsibilities','Type of In-ServiceTraining Attended (Include CPDs)','Employment Status ','Main Grade Taught ','Staff Presence','Employer','Subject Being Taught (A)','Subject Being Taught (B)','Subject Qualified to Teach (A)','Subject Qualified to Teach (B)','Number of Days Absent',
      ];
      await this.prisma.staffReturnTemplate.create({
        data: {
          schoolId, templateCode: definition.code, version: '2026-v1', status: 'PUBLISHED', authority: 'MINISTRY_OF_EDUCATION',
          name: definition.name, returnType: 'ANNUAL', category: definition.nonTeaching ? 'NON_TEACHING_STAFF' : 'TEACHING_STAFF',
          config: { sheetName: definition.sheetName, headerRow: definition.headerRow, dataStartRow: definition.headerRow + 1, workbookAsset: definition.workbook, staffType: definition.nonTeaching ? 'NON_TEACHING' : 'TEACHING' } as any,
          columns: { create: headers.map((label, index) => {
            const match = detectCanonicalField(label);
            const key = label.trim().toLowerCase() === 'sn' ? 'return.serialNumber' : (match?.field.key || `unmapped.${index + 1}`);
            return { columnName: key, columnLabel: label, columnOrder: index, dataType: match?.field.type || 'text', isRequired: label.trim().toLowerCase() !== 'sn', validationRules: { source: key, confidence: match?.confidence || 0 } as any };
          }) },
        },
      });
    }
  }

  async quickCompile(data: { templateId: string; schoolId: string; period: string; performedBy?: string }) {
    const template = await this.prisma.staffReturnTemplate.findFirst({
      where: { id: data.templateId, schoolId: data.schoolId },
      include: { columns: { orderBy: { columnOrder: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Return template not found');
    const config = (template.config || {}) as any;
    const school = await this.prisma.school.findUnique({ where: { id: data.schoolId } });
    if (!school) throw new NotFoundException('School profile not found');
    const staffType = config.staffType || 'TEACHING';
    const profiles = await this.prisma.staffHrProfile.findMany({
      where: {
        schoolId: data.schoolId,
        ...(staffType === 'NON_TEACHING' ? { employmentType: 'NON_TEACHING' } : { employmentType: { not: 'NON_TEACHING' } }),
        employmentStatus: { notIn: ['INACTIVE', 'TERMINATED', 'TRANSFERRED', 'RETIRED', 'RESIGNED'] },
      },
      include: { qualifications: true, positions: true }, orderBy: { teacherName: 'asc' },
    });
    const rows = profiles.map((profile: any, index) => {
      const name = String(profile.teacherName || '').trim().split(/\s+/);
      const canonical: Record<string, any> = {
        'staff.surname': name.length > 1 ? name.pop() : '', 'staff.firstName': name.join(' '),
        'staff.nrcNumber': profile.nrcNumber, 'staff.manTsNumber': profile.tsNumber, 'staff.employeeNumber': profile.employeeNumber,
        'staff.dateOfBirth': profile.dateOfBirth, 'staff.gender': profile.gender, 'staff.firstAppointmentDate': profile.dateOfFirstAppointment,
        'staff.currentPostAppointmentDate': profile.dateOfPresentAppointment, 'staff.maritalStatus': profile.maritalStatus,
        'staff.differentlyAbled': profile.dynamicFields?.differentlyAbled, 'staff.nationality': profile.nationality,
        'staff.substantivePosition': profile.substantivePosition, 'staff.currentPosition': profile.currentPosition || profile.actingPosition,
        'staff.highestLevelOfEducation': profile.academicQualification, 'staff.highestTeacherQualification': profile.professionalQualification || profile.qualifications?.[0]?.qualificationName,
        'staff.additionalResponsibilities': profile.administration, 'staff.inServiceTraining': profile.dynamicFields?.inServiceTraining,
        'staff.employmentStatus': profile.employmentStatus, 'staff.mainGradeTaught': profile.gradeLevel,
        'staff.staffPresence': profile.dynamicFields?.staffPresence, 'staff.employer': profile.dynamicFields?.employer,
        'staff.subjectBeingTaughtA': profile.dynamicFields?.subjectBeingTaughtA, 'staff.subjectBeingTaughtB': profile.dynamicFields?.subjectBeingTaughtB,
        'staff.subjectQualifiedToTeachA': profile.dynamicFields?.subjectQualifiedToTeachA, 'staff.subjectQualifiedToTeachB': profile.dynamicFields?.subjectQualifiedToTeachB,
        'staff.numberOfDaysAbsent': profile.dynamicFields?.numberOfDaysAbsent ?? 0,
        'staff.phoneNumber': profile.phoneNumber,
        'staff.highestAcademicQualification': profile.academicQualification,
        'school.name': school.name, 'school.province': school.province, 'school.district': school.district,
        'school.constituency': (school as any).constituency, 'school.ward': (school as any).ward, 'school.zone': (school as any).zone,
        'school.location': (school as any).locationType, 'school.runningAgency': (school as any).runningAgency,
        'school.type': (school as any).schoolType, 'school.emisNumber': (school as any).emisNumber,
        'school.distanceFromDebOffice': (school as any).distanceFromDebOffice, 'return.serialNumber': index + 1,
      };
      const values: Record<string, any> = {};
      for (const column of template.columns) values[column.columnName] = canonical[column.columnName] ?? '';
      const missing = template.columns.filter((column) => column.isRequired && (values[column.columnName] === '' || values[column.columnName] === null || values[column.columnName] === undefined)).map((column) => ({ key: column.columnName, label: column.columnLabel }));
      return { staffId: profile.staffId, staffName: profile.teacherName || 'Staff member', status: missing.length ? 'INCOMPLETE' : 'COMPLETE', missing, values };
    });
    const duplicateIssues = this.findDuplicateIdentityIssues(profiles);
    const snapshot = { templateId: template.id, templateCode: template.templateCode, templateVersion: template.version, period: data.period, school, generatedAt: new Date().toISOString(), generatedBy: data.performedBy, staffPopulation: rows.map((row) => row.staffId), validationIssues: duplicateIssues, rows };
    const submission = await this.prisma.staffReturnSubmission.create({
      data: { templateId: template.id, schoolId: data.schoolId, period: data.period, academicYear: data.period, status: duplicateIssues.length ? 'DRAFT' : 'DRAFT', data: rows as any, snapshot: snapshot as any, templateVersion: template.version },
    });
    await this.createAuditLog({ submissionId: submission.id, schoolId: data.schoolId, action: 'QUICK_COMPILE', entityType: 'INSTITUTIONAL_RETURN', entityId: submission.id, performedBy: data.performedBy, metadata: { templateVersion: template.version, detectedStaff: rows.length, missingFields: rows.reduce((count, row) => count + row.missing.length, 0) } });
    return { ...submission, summary: { detected: rows.length, complete: rows.filter((row) => row.status === 'COMPLETE').length, incomplete: rows.filter((row) => row.status === 'INCOMPLETE').length, invalid: duplicateIssues.length }, validationIssues: duplicateIssues };
  }

  private findDuplicateIdentityIssues(profiles: any[]) {
    const issues: { message: string; staffIds: string[] }[] = [];
    for (const field of ['nrcNumber', 'tsNumber', 'employeeNumber']) {
      const groups = new Map<string, string[]>();
      for (const profile of profiles) {
        const value = String(profile[field] || '').trim().toLowerCase();
        if (value) groups.set(value, [...(groups.get(value) || []), profile.staffId]);
      }
      for (const ids of groups.values()) if (ids.length > 1) issues.push({ message: `Duplicate ${field} found for ${ids.length} staff records.`, staffIds: ids });
    }
    return issues;
  }

  // ── Templates ──

  async findAllTemplates(schoolId: string) {
    return this.prisma.staffReturnTemplate.findMany({
      where: { schoolId },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findTemplateById(id: string) {
    const template = await this.prisma.staffReturnTemplate.findUnique({
      where: { id },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
        submissions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async createTemplate(data: {
    name: string;
    description?: string;
    schoolId: string;
    returnType?: string;
    category?: string;
    columns?: {
      columnName: string;
      columnLabel: string;
      columnOrder: number;
      dataType?: string;
      isRequired?: boolean;
      width?: number;
      alignment?: string;
    }[];
  }) {
    const template = await this.prisma.staffReturnTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        schoolId: data.schoolId,
        returnType: data.returnType || 'MONTHLY',
        category: data.category || 'DISTRICT',
        columns: data.columns
          ? {
              create: data.columns.map((col) => ({
                columnName: col.columnName,
                columnLabel: col.columnLabel,
                columnOrder: col.columnOrder,
                dataType: col.dataType || 'string',
                isRequired: col.isRequired || false,
                width: col.width || 120,
                alignment: col.alignment || 'left',
              })),
            }
          : undefined,
      },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
      },
    });

    return template;
  }

  async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      returnType?: string;
      isActive?: boolean;
      isDefault?: boolean;
      category?: string;
      config?: any;
    },
  ) {
    const existing = await this.prisma.staffReturnTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.staffReturnTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        returnType: data.returnType,
        isActive: data.isActive,
        isDefault: data.isDefault,
        category: data.category,
        config: data.config !== undefined ? (data.config as any) : undefined,
      },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
      },
    });
  }

  async deleteTemplate(id: string) {
    const existing = await this.prisma.staffReturnTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.staffReturnTemplate.delete({ where: { id } });

    return { message: 'Template deleted successfully' };
  }

  async duplicateTemplate(id: string, newName: string) {
    const existing = await this.prisma.staffReturnTemplate.findUnique({
      where: { id },
      include: { columns: true },
    });

    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.staffReturnTemplate.create({
      data: {
        name: newName || `${existing.name} (Copy)`,
        description: existing.description,
        schoolId: existing.schoolId,
        returnType: existing.returnType,
        category: existing.category,
        config: existing.config as any,
        columns: {
          create: existing.columns.map((col) => ({
            columnName: col.columnName,
            columnLabel: col.columnLabel,
            columnOrder: col.columnOrder,
            dataType: col.dataType,
            isRequired: col.isRequired,
            isVisible: col.isVisible,
            isEditable: col.isEditable,
            width: col.width,
            alignment: col.alignment,
            fontStyle: col.fontStyle,
            backgroundColor: col.backgroundColor,
            defaultValue: col.defaultValue,
            options: col.options as any,
            validationRules: col.validationRules as any,
          })),
        },
      },
      include: {
        columns: { orderBy: { columnOrder: 'asc' } },
      },
    });
  }

  // ── Columns ──

  async addColumn(
    templateId: string,
    data: {
      columnName: string;
      columnLabel: string;
      columnOrder: number;
      dataType?: string;
      isRequired?: boolean;
      width?: number;
      alignment?: string;
      defaultValue?: string;
    },
  ) {
    const template = await this.prisma.staffReturnTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.staffReturnColumn.create({
      data: {
        templateId,
        columnName: data.columnName,
        columnLabel: data.columnLabel,
        columnOrder: data.columnOrder,
        dataType: data.dataType || 'string',
        isRequired: data.isRequired || false,
        width: data.width || 120,
        alignment: data.alignment || 'left',
        defaultValue: data.defaultValue,
      },
    });
  }

  async updateColumn(
    id: string,
    data: {
      columnName?: string;
      columnLabel?: string;
      columnOrder?: number;
      dataType?: string;
      isRequired?: boolean;
      isVisible?: boolean;
      isEditable?: boolean;
      width?: number;
      alignment?: string;
      fontStyle?: string;
      backgroundColor?: string;
      defaultValue?: string;
      options?: any[];
      validationRules?: any;
    },
  ) {
    const existing = await this.prisma.staffReturnColumn.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Column not found');
    }

    return this.prisma.staffReturnColumn.update({
      where: { id },
      data: {
        columnName: data.columnName,
        columnLabel: data.columnLabel,
        columnOrder: data.columnOrder,
        dataType: data.dataType,
        isRequired: data.isRequired,
        isVisible: data.isVisible,
        isEditable: data.isEditable,
        width: data.width,
        alignment: data.alignment,
        fontStyle: data.fontStyle,
        backgroundColor: data.backgroundColor,
        defaultValue: data.defaultValue,
        options: data.options !== undefined ? (data.options as any) : undefined,
        validationRules: data.validationRules !== undefined ? (data.validationRules as any) : undefined,
      },
    });
  }

  async deleteColumn(id: string) {
    const existing = await this.prisma.staffReturnColumn.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Column not found');
    }

    await this.prisma.staffReturnColumn.delete({ where: { id } });

    return { message: 'Column deleted successfully' };
  }

  async reorderColumns(templateId: string, columnOrder: { id: string; order: number }[]) {
    const template = await this.prisma.staffReturnTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    for (const item of columnOrder) {
      await this.prisma.staffReturnColumn.update({
        where: { id: item.id },
        data: { columnOrder: item.order },
      });
    }

    return this.prisma.staffReturnColumn.findMany({
      where: { templateId },
      orderBy: { columnOrder: 'asc' },
    });
  }

  // ── Submissions ──

  async findAllSubmissions(schoolId: string, templateId?: string) {
    const where: any = { schoolId };
    if (templateId) where.templateId = templateId;

    return this.prisma.staffReturnSubmission.findMany({
      where,
      include: {
        template: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findSubmissionById(id: string) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id },
      include: {
        template: {
          include: { columns: { orderBy: { columnOrder: 'asc' } } },
        },
        logs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  async createSubmission(data: {
    templateId: string;
    schoolId: string;
    period: string;
    academicYear?: string;
    term?: string;
    data?: any[];
  }) {
    const template = await this.prisma.staffReturnTemplate.findUnique({
      where: { id: data.templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.staffReturnSubmission.create({
      data: {
        templateId: data.templateId,
        schoolId: data.schoolId,
        period: data.period,
        academicYear: data.academicYear,
        term: data.term,
        data: (data.data || []) as any,
        status: 'DRAFT',
      },
      include: {
        template: {
          include: { columns: { orderBy: { columnOrder: 'asc' } } },
        },
      },
    });
  }

  async updateSubmission(id: string, data: any[]) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (['SUBMITTED', 'APPROVED', 'EXPORTED', 'ARCHIVED'].includes(submission.status)) {
      throw new BadRequestException('Historical returns are immutable. Duplicate the return to make changes.');
    }

    return this.prisma.staffReturnSubmission.update({
      where: { id },
      data: {
        data: data as any,
        status: 'DRAFT',
      },
    });
  }

  async updateSubmissionStaffField(id: string, staffId: string, key: string, value: any, performedBy?: string) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id },
      include: { template: { include: { columns: true } } },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (['SUBMITTED', 'APPROVED', 'EXPORTED', 'ARCHIVED'].includes(submission.status)) {
      throw new BadRequestException('Historical returns are immutable. Duplicate the return to make changes.');
    }
    const rows = ((submission.data as any[]) || []).map((row) => ({ ...row }));
    const row = rows.find((candidate) => candidate.staffId === staffId);
    if (!row) throw new NotFoundException('Staff member is not part of this return snapshot');
    const column = submission.template.columns.find((candidate) => candidate.columnName === key);
    if (!column) throw new BadRequestException('Field is not configured for this return template');
    const oldValue = row.values?.[key] ?? '';
    row.values = { ...(row.values || {}), [key]: value ?? '' };
    row.missing = (row.missing || []).filter((missing: any) => missing.key !== key);
    if (column.isRequired && (value === null || value === undefined || value === '')) {
      row.missing.push({ key, label: column.columnLabel });
    }
    row.status = row.missing.length ? 'INCOMPLETE' : 'COMPLETE';
    await this.updateCanonicalField(staffId, submission.schoolId, key, value);
    const updated = await this.prisma.staffReturnSubmission.update({
      where: { id },
      data: { data: rows as any, snapshot: { ...((submission.snapshot as any) || {}), rows } as any, status: 'DRAFT' },
      include: { template: { select: { id: true, name: true } } },
    });
    await this.createAuditLog({ submissionId: id, profileId: staffId, schoolId: submission.schoolId, action: 'UPDATE_RETURN_FIELD', entityType: 'INSTITUTIONAL_RETURN_FIELD', entityId: key, performedBy, changes: { key, oldValue, newValue: value } });
    return updated;
  }

  async updateSubmissionStaffFields(id: string, staffId: string, fields: Record<string, any>, performedBy?: string) {
    if (!Object.keys(fields || {}).length) throw new BadRequestException('At least one field is required');
    const submission = await this.prisma.staffReturnSubmission.findUnique({ where: { id }, include: { template: { include: { columns: true } } } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (['SUBMITTED', 'APPROVED', 'EXPORTED', 'ARCHIVED'].includes(submission.status)) throw new BadRequestException('Historical returns are immutable. Duplicate the return to make changes.');
    const row = ((submission.data as any[]) || []).map((candidate) => ({ ...candidate })).find((candidate) => candidate.staffId === staffId);
    if (!row) throw new NotFoundException('Staff member is not part of this return snapshot');
    const columns = new Map(submission.template.columns.map((column) => [column.columnName, column]));
    const oldValues: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (!columns.has(key)) throw new BadRequestException(`Field ${key} is not configured for this return template`);
      oldValues[key] = row.values?.[key] ?? '';
      row.values = { ...(row.values || {}), [key]: value ?? '' };
    }
    row.missing = submission.template.columns.filter((column) => column.isRequired && !row.values?.[column.columnName]).map((column) => ({ key: column.columnName, label: column.columnLabel }));
    row.status = row.missing.length ? 'INCOMPLETE' : 'COMPLETE';

    const profile = await this.prisma.staffHrProfile.findUnique({ where: { staffId } });
    if (!profile) throw new NotFoundException('Canonical staff profile not found');
    const directFields: Record<string, string> = {
      'staff.nrcNumber': 'nrcNumber', 'staff.manTsNumber': 'tsNumber', 'staff.employeeNumber': 'employeeNumber', 'staff.gender': 'gender',
      'staff.maritalStatus': 'maritalStatus', 'staff.nationality': 'nationality', 'staff.substantivePosition': 'substantivePosition',
      'staff.currentPosition': 'currentPosition', 'staff.highestLevelOfEducation': 'academicQualification', 'staff.highestAcademicQualification': 'academicQualification',
      'staff.highestTeacherQualification': 'professionalQualification', 'staff.employmentStatus': 'employmentStatus', 'staff.mainGradeTaught': 'gradeLevel',
      'staff.dateOfBirth': 'dateOfBirth', 'staff.firstAppointmentDate': 'dateOfFirstAppointment', 'staff.currentPostAppointmentDate': 'dateOfPresentAppointment', 'staff.phoneNumber': 'phoneNumber',
    };
    const profileData: Record<string, any> = {};
    const dynamicFields = { ...((profile.dynamicFields as any) || {}) };
    const schoolData: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'staff.surname' || key === 'staff.firstName') continue;
      if (directFields[key]) {
        const field = directFields[key];
        profileData[field] = field === 'phoneNumber' ? this.normalizeZambianPhone(value) : ['dateOfBirth', 'dateOfFirstAppointment', 'dateOfPresentAppointment'].includes(field) && value ? new Date(value) : value || null;
      } else if (key.startsWith('school.')) {
        const schoolField: Record<string, string> = { 'school.province': 'province', 'school.district': 'district', 'school.constituency': 'constituency', 'school.ward': 'ward', 'school.zone': 'zone', 'school.location': 'locationType', 'school.runningAgency': 'runningAgency', 'school.type': 'schoolType', 'school.emisNumber': 'emisNumber', 'school.distanceFromDebOffice': 'distanceFromDebOffice' };
        if (schoolField[key]) schoolData[schoolField[key]] = key === 'school.distanceFromDebOffice' && value !== '' ? Number(value) : value || null;
      } else {
        dynamicFields[key.replace(/^staff\./, '')] = value ?? null;
      }
    }
    if (fields['staff.surname'] !== undefined || fields['staff.firstName'] !== undefined) {
      const currentName = String(profile.teacherName || '').trim().split(/\s+/);
      const firstName = fields['staff.firstName'] ?? currentName.slice(0, -1).join(' ');
      const surname = fields['staff.surname'] ?? currentName[currentName.length - 1] ?? '';
      profileData.teacherName = `${firstName} ${surname}`.trim();
    }
    profileData.dynamicFields = dynamicFields;
    await this.prisma.staffHrProfile.update({ where: { staffId }, data: profileData });
    if (Object.keys(schoolData).length) await this.prisma.school.update({ where: { id: submission.schoolId }, data: schoolData });
    const rows = ((submission.data as any[]) || []).map((candidate) => candidate.staffId === staffId ? row : candidate);
    const updated = await this.prisma.staffReturnSubmission.update({ where: { id }, data: { data: rows as any, snapshot: { ...((submission.snapshot as any) || {}), rows } as any, status: 'DRAFT' }, include: { template: { select: { id: true, name: true } } } });
    await this.createAuditLog({ submissionId: id, profileId: profile.id, schoolId: submission.schoolId, action: 'UPDATE_RETURN_FIELDS', entityType: 'INSTITUTIONAL_RETURN_FIELDS', entityId: staffId, performedBy, changes: { oldValues, newValues: fields } });
    return updated;
  }

  private async updateCanonicalField(staffId: string, schoolId: string, key: string, value: any) {
    const profile = await this.prisma.staffHrProfile.findUnique({ where: { staffId } });
    if (!profile) throw new NotFoundException('Canonical staff profile not found');
    const directFields: Record<string, string> = {
      'staff.nrcNumber': 'nrcNumber', 'staff.manTsNumber': 'tsNumber', 'staff.employeeNumber': 'employeeNumber',
      'staff.gender': 'gender', 'staff.maritalStatus': 'maritalStatus', 'staff.nationality': 'nationality',
      'staff.substantivePosition': 'substantivePosition', 'staff.currentPosition': 'currentPosition',
      'staff.highestLevelOfEducation': 'academicQualification', 'staff.highestAcademicQualification': 'academicQualification',
      'staff.highestTeacherQualification': 'professionalQualification', 'staff.employmentStatus': 'employmentStatus',
      'staff.mainGradeTaught': 'gradeLevel', 'staff.dateOfBirth': 'dateOfBirth',
      'staff.firstAppointmentDate': 'dateOfFirstAppointment', 'staff.currentPostAppointmentDate': 'dateOfPresentAppointment',
      'staff.phoneNumber': 'phoneNumber',
    };
    if (key.startsWith('school.')) {
      const schoolField: Record<string, string> = {
        'school.province': 'province', 'school.district': 'district', 'school.constituency': 'constituency', 'school.ward': 'ward',
        'school.zone': 'zone', 'school.location': 'locationType', 'school.runningAgency': 'runningAgency', 'school.type': 'schoolType',
        'school.emisNumber': 'emisNumber', 'school.distanceFromDebOffice': 'distanceFromDebOffice',
      };
      const field = schoolField[key];
      if (field) await this.prisma.school.update({ where: { id: schoolId }, data: { [field]: key === 'school.distanceFromDebOffice' && value !== '' ? Number(value) : value || null } });
      return;
    }
    if (directFields[key]) {
      const field = directFields[key];
      const dateField = ['dateOfBirth', 'dateOfFirstAppointment', 'dateOfPresentAppointment'].includes(field);
      const normalizedValue = field === 'phoneNumber' ? this.normalizeZambianPhone(value) : value;
      await this.prisma.staffHrProfile.update({ where: { staffId }, data: { [field]: dateField && value ? new Date(value) : normalizedValue || null } });
      return;
    }
    if (key === 'staff.surname' || key === 'staff.firstName') {
      const current = String(profile.teacherName || '').trim().split(/\s+/);
      const firstName = key === 'staff.firstName' ? String(value || '') : current.slice(0, -1).join(' ');
      const surname = key === 'staff.surname' ? String(value || '') : current.at(-1) || '';
      await this.prisma.staffHrProfile.update({ where: { staffId }, data: { teacherName: `${firstName} ${surname}`.trim() } });
      return;
    }
    const dynamicFields = { ...((profile.dynamicFields as any) || {}), [key.replace(/^staff\./, '')]: value ?? null };
    await this.prisma.staffHrProfile.update({ where: { staffId }, data: { dynamicFields } });
  }

  private normalizeZambianPhone(value: any) {
    const input = String(value || '').trim().replace(/[\s()-]/g, '');
    if (!input) return null;
    if (input.startsWith('+')) return input;
    if (input.startsWith('260')) return `+${input}`;
    if (input.startsWith('0')) return `+260${input.slice(1)}`;
    return `+260${input}`;
  }

  async submitSubmission(id: string, performedBy?: string) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (['APPROVED', 'ARCHIVED'].includes(submission.status)) {
      throw new BadRequestException('This return cannot be submitted again.');
    }

    await this.createAuditLog({
      submissionId: id,
      schoolId: submission.schoolId,
      action: 'SUBMIT',
      entityType: 'STAFF_RETURN',
      entityId: id,
      performedBy: performedBy || 'system',
    });

    return this.prisma.staffReturnSubmission.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        generatedBy: performedBy,
        generatedAt: new Date(),
      },
    });
  }

  async approveSubmission(id: string, approvedBy: string) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    await this.createAuditLog({
      submissionId: id,
      schoolId: submission.schoolId,
      action: 'APPROVE',
      entityType: 'STAFF_RETURN',
      entityId: id,
      performedBy: approvedBy,
    });

    return this.prisma.staffReturnSubmission.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  async deleteSubmission(id: string) {
    const submission = await this.prisma.staffReturnSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (['SUBMITTED', 'APPROVED', 'EXPORTED', 'ARCHIVED'].includes(submission.status)) {
      throw new BadRequestException('Historical returns are immutable and cannot be deleted.');
    }
    await this.prisma.staffReturnSubmission.delete({ where: { id } });
    return { message: 'Submission deleted successfully' };
  }

  // ── Audit Log ──

  async createAuditLog(data: {
    submissionId?: string;
    profileId?: string;
    schoolId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    performedBy?: string;
    performedByName?: string;
    changes?: any;
    metadata?: any;
  }) {
    return this.prisma.staffAuditLog.create({
      data: {
        submissionId: data.submissionId,
        profileId: data.profileId,
        schoolId: data.schoolId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        performedBy: data.performedBy,
        performedByName: data.performedByName,
        changes: data.changes as any,
        metadata: data.metadata as any,
      },
    });
  }

  async getAuditLogs(schoolId: string, limit = 50) {
    return this.prisma.staffAuditLog.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
