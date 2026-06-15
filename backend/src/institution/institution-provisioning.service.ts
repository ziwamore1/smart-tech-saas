import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstitutionProvisioningService {
  private readonly logger = new Logger(InstitutionProvisioningService.name);

  constructor(private prisma: PrismaService) {}

  async provisionInstitution(schoolId: string, institutionTypeCode: string) {
    this.logger.log(`Provisioning institution ${schoolId} of type ${institutionTypeCode}`);

    const type = await this.prisma.institutionType.findUnique({
      where: { code: institutionTypeCode as any },
      include: {
        modules: { include: { module: true } },
        features: { include: { feature: true } },
        roles: { include: { role: true } },
        dashboards: { include: { dashboard: true } },
        settings: true,
      },
    });

    if (!type) {
      throw new Error(`Institution type '${institutionTypeCode}' not found`);
    }

    await this.provisionModules(schoolId, type);
    await this.provisionRoles(schoolId, type);
    await this.provisionDashboard(schoolId, type);
    await this.provisionSettings(schoolId, type);
    await this.provisionGradingPolicies(schoolId, institutionTypeCode);
    await this.provisionAssessmentDefinitions(schoolId, institutionTypeCode);

    this.logger.log(`Institution ${schoolId} provisioned successfully`);
    return { success: true, type: type.code, modules: type.modules.length };
  }

  private async provisionGradingPolicies(schoolId: string, institutionTypeCode: string) {
    if (institutionTypeCode === 'PRIMARY_SCHOOL') {
      this.logger.log(`Provisioning primary grading policies for ${schoolId}`);

      const existingPolicies = await this.prisma.gradingPolicy.findMany({
        where: { schoolId },
      });

      if (existingPolicies.length > 0) {
        this.logger.log(`Grading policies already exist for ${schoolId}, skipping`);
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        const primaryScales = [
          { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5, gpa: 4.0, sortOrder: 1 },
          { minScore: 65, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4, gpa: 3.5, sortOrder: 2 },
          { minScore: 50, maxScore: 64, grade: 'C', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
          { minScore: 35, maxScore: 49, grade: 'D', remark: 'Pass', points: 2, gpa: 2.0, sortOrder: 4 },
          { minScore: 0, maxScore: 34, grade: 'F', remark: 'Fail', points: 1, gpa: 0, sortOrder: 5 },
        ];

        await tx.gradingPolicy.create({
          data: {
            schoolId,
            name: 'Primary School Default Grading',
            code: 'PRIMARY_DEFAULT',
            type: 'PERCENTAGE',
            isDefault: true,
            active: true,
            scales: { create: primaryScales },
          },
        });

        const lowerPrimaryScales = [
          { minScore: 80, maxScore: 100, grade: 'A', remark: 'Outstanding', points: 5, gpa: 4.0, sortOrder: 1 },
          { minScore: 65, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4, gpa: 3.5, sortOrder: 2 },
          { minScore: 50, maxScore: 64, grade: 'C', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
          { minScore: 35, maxScore: 49, grade: 'D', remark: 'Needs Improvement', points: 2, gpa: 2.0, sortOrder: 4 },
          { minScore: 0, maxScore: 34, grade: 'E', remark: 'Below Expectation', points: 1, gpa: 1.0, sortOrder: 5 },
        ];

        await tx.gradingPolicy.create({
          data: {
            schoolId,
            name: 'Primary Lower (Grades 1-4) - Competency Based',
            code: 'PRIMARY_LOWER',
            type: 'COMPETENCY',
            isDefault: false,
            active: true,
            scales: { create: lowerPrimaryScales },
          },
        });

        const upperPrimaryScales = [
          { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5, gpa: 4.0, sortOrder: 1 },
          { minScore: 65, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4, gpa: 3.5, sortOrder: 2 },
          { minScore: 50, maxScore: 64, grade: 'C', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
          { minScore: 35, maxScore: 49, grade: 'D', remark: 'Pass', points: 2, gpa: 2.0, sortOrder: 4 },
          { minScore: 0, maxScore: 34, grade: 'F', remark: 'Fail', points: 1, gpa: 0, sortOrder: 5 },
        ];

        await tx.gradingPolicy.create({
          data: {
            schoolId,
            name: 'Primary Upper (Grades 5-6) - Standard',
            code: 'PRIMARY_UPPER',
            type: 'PERCENTAGE',
            isDefault: false,
            active: true,
            scales: { create: upperPrimaryScales },
          },
        });

        this.logger.log(`Created 3 primary grading policies for ${schoolId}`);
      });
    } else {
      this.logger.log(`Provisioning secondary grading policy for ${schoolId}`);
      const existingPolicy = await this.prisma.gradingPolicy.findFirst({
        where: { schoolId, code: 'ECZ_ZM' },
      });

      if (existingPolicy) {
        this.logger.log(`ECZ grading policy already exists for ${schoolId}, skipping`);
        return;
      }

      await this.prisma.gradingPolicy.create({
        data: {
          schoolId,
          name: 'ECZ Zambia Grading System',
          code: 'ECZ_ZM',
          type: 'ECZ_ZAMBIA',
          isDefault: true,
          active: true,
          scales: {
            create: [
              { minScore: 75, maxScore: 100, grade: '1', remark: 'Distinction', points: 1, gpa: 4.0, sortOrder: 1 },
              { minScore: 70, maxScore: 74, grade: '2', remark: 'Distinction', points: 2, gpa: 3.75, sortOrder: 2 },
              { minScore: 65, maxScore: 69, grade: '3', remark: 'Merit', points: 3, gpa: 3.5, sortOrder: 3 },
              { minScore: 60, maxScore: 64, grade: '4', remark: 'Merit', points: 4, gpa: 3.25, sortOrder: 4 },
              { minScore: 55, maxScore: 59, grade: '5', remark: 'Credit', points: 5, gpa: 3.0, sortOrder: 5 },
              { minScore: 50, maxScore: 54, grade: '6', remark: 'Credit', points: 6, gpa: 2.75, sortOrder: 6 },
              { minScore: 45, maxScore: 49, grade: '7', remark: 'Satisfactory', points: 7, gpa: 2.5, sortOrder: 7 },
              { minScore: 40, maxScore: 44, grade: '8', remark: 'Satisfactory', points: 8, gpa: 2.0, sortOrder: 8 },
              { minScore: 0, maxScore: 39, grade: '9', remark: 'Unsatisfactory', points: 9, gpa: 0, sortOrder: 9 },
            ],
          },
        },
      });
    }
  }

  private async provisionModules(schoolId: string, type: any) {
    const moduleCodes = type.modules.map((tm: any) => tm.module.code);
    this.logger.log(`Provisioning modules for ${schoolId}: ${moduleCodes.join(', ')}`);

    const dashboardConfig = await this.prisma.dashboardConfig.upsert({
      where: { schoolId },
      update: {
        enabledModules: moduleCodes as any,
      },
      create: {
        schoolId,
        enabledModules: moduleCodes as any,
      },
    });

    return dashboardConfig;
  }

  private async provisionRoles(schoolId: string, type: any) {
    const roleNames = type.roles.map((tr: any) => tr.role.name);
    this.logger.log(`Provisioning roles for ${schoolId}: ${roleNames.join(', ')}`);

    for (const roleName of roleNames) {
      await this.prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
    }
  }

  private async provisionDashboard(schoolId: string, type: any) {
    const dashboardCodes = type.dashboards.map((td: any) => td.dashboard.code);
    this.logger.log(`Provisioning dashboards for ${schoolId}: ${dashboardCodes.join(', ')}`);

    await this.prisma.dashboardConfig.upsert({
      where: { schoolId },
      update: {
        enabledDashboards: dashboardCodes as any,
      },
      create: {
        schoolId,
        enabledDashboards: dashboardCodes as any,
      },
    });
  }

  private async provisionSettings(schoolId: string, type: any) {
    const settingsMap: Record<string, string> = {
      grading_system: 'gradingSystem',
      academic_structure: 'academicStructure',
      terms_per_year: 'termsPerYear',
      min_attendance_percentage: 'minAttendancePercentage',
    };

    const data: any = { schoolId };
    for (const setting of type.settings) {
      const field = settingsMap[setting.key];
      if (field) {
        data[field] = setting.value;
      }
    }

    const existing = await this.prisma.schoolSetting.findUnique({
      where: { schoolId },
    });

    if (existing) {
      await this.prisma.schoolSetting.update({
        where: { schoolId },
        data,
      });
    } else {
      await this.prisma.schoolSetting.create({ data });
    }
  }

  async getProvisionedModules(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        institutionType: {
          include: {
            modules: {
              include: { module: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!school?.institutionType) {
      return [];
    }

    return school.institutionType.modules
      .filter((tm) => tm.isActive)
      .map((tm) => tm.module);
  }

  async getProvisionedFeatures(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        institutionType: {
          include: {
            features: {
              include: { feature: true },
            },
          },
        },
      },
    });

    if (!school?.institutionType) {
      return [];
    }

    return school.institutionType.features
      .filter((tf) => tf.isEnabled)
      .map((tf) => tf.feature);
  }

  async getProvisionedRoles(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        institutionType: {
          include: {
            roles: {
              include: { role: true },
            },
          },
        },
      },
    });

    if (!school?.institutionType) {
      return [];
    }

    return school.institutionType.roles
      .filter((tr) => tr.isActive)
      .map((tr) => tr.role);
  }

  async checkModuleAccess(schoolId: string, moduleCode: string): Promise<boolean> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        institutionType: {
          include: {
            modules: {
              where: { isActive: true },
              include: { module: true },
            },
          },
        },
      },
    });

    if (!school?.institutionType) {
      return false;
    }

    return school.institutionType.modules.some(
      (tm) => tm.module.code === moduleCode,
    );
  }

  async provisionAssessmentDefinitions(schoolId: string, institutionTypeCode: string) {
    const existing = await this.prisma.assessmentDefinition.findFirst({
      where: { schoolId },
    });

    if (existing) {
      this.logger.log(`Assessment definitions already exist for ${schoolId}, skipping`);
      return;
    }

    const isPrimary = institutionTypeCode === 'PRIMARY_SCHOOL';

    const definitions = isPrimary
      ? [
          {
            name: 'Continuous Assessment',
            code: 'CONTINUOUS',
            category: 'continuous',
            description: 'Ongoing class assessments, quizzes, and assignments',
            defaultMaxScore: 100,
            defaultWeight: 70,
            contributesToFinal: true,
            sortOrder: 1,
          },
          {
            name: 'End of Term Examination',
            code: 'END_TERM',
            category: 'end_of_term',
            description: 'End of term summative examination',
            defaultMaxScore: 100,
            defaultWeight: 30,
            contributesToFinal: true,
            sortOrder: 2,
          },
        ]
      : [
          {
            name: 'Test 1',
            code: 'TEST_1',
            category: 'continuous',
            description: 'First continuous assessment test',
            defaultMaxScore: 50,
            defaultWeight: 15,
            contributesToFinal: true,
            sortOrder: 1,
          },
          {
            name: 'Test 2',
            code: 'TEST_2',
            category: 'continuous',
            description: 'Second continuous assessment test',
            defaultMaxScore: 50,
            defaultWeight: 15,
            contributesToFinal: true,
            sortOrder: 2,
          },
          {
            name: 'Mid-Term Examination',
            code: 'MID_TERM',
            category: 'midterm',
            description: 'Mid-term examination',
            defaultMaxScore: 100,
            defaultWeight: 20,
            contributesToFinal: true,
            sortOrder: 3,
          },
          {
            name: 'End of Term Examination',
            code: 'END_TERM',
            category: 'end_of_term',
            description: 'End of term summative examination',
            defaultMaxScore: 100,
            defaultWeight: 40,
            contributesToFinal: true,
            sortOrder: 4,
          },
          {
            name: 'Project Work',
            code: 'PROJECT',
            category: 'project',
            description: 'Term project or research work',
            defaultMaxScore: 100,
            defaultWeight: 10,
            contributesToFinal: true,
            sortOrder: 5,
          },
        ];

    await this.prisma.assessmentDefinition.createMany({
      data: definitions.map(d => ({ ...d, schoolId })),
    });

    this.logger.log(`Created ${definitions.length} assessment definitions for ${schoolId} (${institutionTypeCode})`);
  }
}
