import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getCurriculumData } from '../common/curriculum-data';

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
    await this.provisionEducationLevels(schoolId, institutionTypeCode);
    await this.provisionSubjects(schoolId, institutionTypeCode);
    await this.provisionAdmissionSequence(schoolId);
    await this.provisionPerformanceCategories(schoolId);

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

        const eczG7Scales = [
          { minScore: 75, maxScore: 100, grade: 'One', remark: 'Excellent', points: 1, gpa: 5.0, sortOrder: 1 },
          { minScore: 60, maxScore: 74, grade: 'Two', remark: 'Very Good', points: 2, gpa: 4.0, sortOrder: 2 },
          { minScore: 50, maxScore: 59, grade: 'Three', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
          { minScore: 25, maxScore: 49, grade: 'Four', remark: 'Satisfactory', points: 4, gpa: 2.0, sortOrder: 4 },
          { minScore: 0, maxScore: 24, grade: 'Five', remark: 'Fail', points: 5, gpa: 0, sortOrder: 5 },
        ];

        await tx.gradingPolicy.create({
          data: {
            schoolId,
            name: 'ECZ Grade 7 National Examination Grading',
            code: 'ECZ_G7',
            type: 'ECZ_ZAMBIA',
            isDefault: false,
            active: true,
            scales: { create: eczG7Scales },
          },
        });

        this.logger.log(`Created 4 primary grading policies for ${schoolId}`);
      });
    } else {
      this.logger.log(`Provisioning secondary grading policies for ${schoolId}`);

      await this.prisma.$transaction(async (tx) => {
        const eczZm = await tx.gradingPolicy.findFirst({
          where: { schoolId, code: 'ECZ_ZM' },
        });

        if (!eczZm) {
          this.logger.log(`Creating ECZ_ZM policy for ${schoolId}`);
          await tx.gradingPolicy.create({
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

        const eczCompetency = await tx.gradingPolicy.findFirst({
          where: { schoolId, code: 'ECZ_COMPETENCY' },
        });

        if (!eczCompetency) {
          this.logger.log(`Creating ECZ_COMPETENCY policy for ${schoolId}`);
          await tx.gradingPolicy.create({
            data: {
              schoolId,
              name: 'ECZ Competency Based (Forms 1-4)',
              code: 'ECZ_COMPETENCY',
              type: 'COMPETENCY',
              isDefault: false,
              active: true,
              scales: {
                create: [
                  { minScore: 70, maxScore: 100, grade: '1', remark: 'Outstanding', points: 1, gpa: 4.0, sortOrder: 1 },
                  { minScore: 60, maxScore: 69, grade: '2', remark: 'Advanced', points: 2, gpa: 3.5, sortOrder: 2 },
                  { minScore: 50, maxScore: 59, grade: '3', remark: 'Basic', points: 3, gpa: 3.0, sortOrder: 3 },
                  { minScore: 40, maxScore: 49, grade: '4', remark: 'Satisfactory', points: 4, gpa: 2.0, sortOrder: 4 },
                  { minScore: 0, maxScore: 39, grade: '5', remark: 'Unsatisfactory', points: 5, gpa: 0, sortOrder: 5 },
                ],
              },
            },
          });
        }
      });

      this.logger.log(`Secondary grading policies provisioned for ${schoolId}`);
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

  async provisionSubjects(schoolId: string, institutionTypeCode: string) {
    const curriculum = getCurriculumData(institutionTypeCode);
    if (!curriculum) {
      this.logger.log(`No curriculum data for ${institutionTypeCode}, skipping subject provisioning`);
      return;
    }

    this.logger.log(`Provisioning ${curriculum.subjects.length} subjects for ${schoolId}`);

    let createdCount = 0;
    let eocsAdded = 0;
    let aosAdded = 0;

    for (const subjectDef of curriculum.subjects) {
      let subject = await this.prisma.subject.findFirst({
        where: { name: subjectDef.name, schoolId },
      });

      if (!subject) {
        try {
          subject = await this.prisma.subject.create({
            data: {
              name: subjectDef.name,
              code: subjectDef.code,
              isCore: subjectDef.isCore,
              schoolId,
            },
          });
          createdCount++;
        } catch (e: any) {
          if (e?.code === 'P2002') {
            subject = await this.prisma.subject.findFirst({
              where: { name: subjectDef.name, schoolId },
            });
          }
          if (!subject) {
            this.logger.error(`Failed to create subject ${subjectDef.name} for ${schoolId}: ${e.message}`);
            continue;
          }
        }
      }

      const subjectEocs = curriculum.eocs[subjectDef.name] || [];
      for (const eoc of subjectEocs) {
        try {
          const existingEoc = await this.prisma.elementOfConstruct.findFirst({
            where: { name: eoc.name, subjectId: subject.id },
          });
          if (!existingEoc) {
            await this.prisma.elementOfConstruct.create({
              data: {
                name: eoc.name,
                construct: eoc.construct,
                subjectId: subject.id,
                schoolId,
              },
            });
            eocsAdded++;
          }
        } catch (e: any) {
          if (e?.code !== 'P2002') {
            this.logger.debug(`EoC "${eoc.name}" issue for subject ${subjectDef.name}: ${e.message}`);
          }
        }
      }

      const subjectAos = curriculum.aos[subjectDef.name] || [];
      for (const ao of subjectAos) {
        try {
          const existingAo = await this.prisma.assessmentObjective.findFirst({
            where: { name: ao.name, subjectId: subject.id },
          });
          if (!existingAo) {
            await this.prisma.assessmentObjective.create({
              data: {
                name: ao.name,
                weight: ao.weight,
                subjectId: subject.id,
                schoolId,
              },
            });
            aosAdded++;
          }
        } catch (e: any) {
          if (e?.code !== 'P2002') {
            this.logger.debug(`AO "${ao.name}" issue for subject ${subjectDef.name}: ${e.message}`);
          }
        }
      }
    }

    this.logger.log(
      `Subject provisioning for ${schoolId}: ${createdCount} subjects, ${eocsAdded} EoCs, ${aosAdded} AOs added`,
    );
  }

  private async provisionEducationLevels(schoolId: string, institutionTypeCode: string) {
    const mapping: Record<string, string[]> = {
      PRIMARY_SCHOOL: ['ECE', 'PRIMARY'],
      SECONDARY_SCHOOL: ['SECONDARY'],
      ADVANCED_SECONDARY: ['ADVANCED_SECONDARY'],
      COLLEGE: ['TERTIARY'],
      UNIVERSITY: ['TERTIARY'],
    };

    const levelCodes = mapping[institutionTypeCode];
    if (!levelCodes || levelCodes.length === 0) {
      this.logger.warn(`No education level mapping for ${institutionTypeCode}`);
      return;
    }

    const levels = await this.prisma.educationLevel.findMany({
      where: { code: { in: levelCodes as any }, schoolId: null },
    });

    for (const level of levels) {
      await this.prisma.schoolEducationLevel.upsert({
        where: { schoolId_educationLevelId: { schoolId, educationLevelId: level.id } },
        update: { isActive: true },
        create: { schoolId, educationLevelId: level.id, isActive: true },
      });
    }

    this.logger.log(`Provisioned ${levels.length} education levels for ${schoolId} (${institutionTypeCode})`);
  }

  async ensureCompleteProvisioning(schoolId: string, institutionTypeCode: string) {
    this.logger.log(`Ensuring complete provisioning for ${schoolId} (${institutionTypeCode})`);

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
    await this.provisionEducationLevels(schoolId, institutionTypeCode);
    await this.provisionSubjects(schoolId, institutionTypeCode);
    await this.provisionAdmissionSequence(schoolId);
    await this.provisionPerformanceCategories(schoolId);

    this.logger.log(`Complete provisioning ensured for ${schoolId}`);
    return { success: true };
  }

  async backfillAllSchools() {
    this.logger.log('Starting backfill for all schools...');

    const schools = await this.prisma.school.findMany({
      include: { institutionType: true },
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const school of schools) {
      const typeCode = school.institutionType?.code;
      if (!typeCode) {
        this.logger.warn(`School ${school.name} (${school.id}) has no institution type, skipping`);
        continue;
      }

      try {
        await this.ensureCompleteProvisioning(school.id, typeCode);
        succeeded++;
        this.logger.log(`Backfilled school: ${school.name} (${typeCode})`);
      } catch (error) {
        failed++;
        this.logger.error(`Failed to backfill school ${school.name}: ${error}`);
      }

      processed++;
    }

    this.logger.log(`Backfill complete: ${processed} processed, ${succeeded} succeeded, ${failed} failed`);
    return { processed, succeeded, failed };
  }

  private async provisionAdmissionSequence(schoolId: string) {
    const currentAcademicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });

    if (!currentAcademicYear) {
      this.logger.warn(`No current academic year found for school ${schoolId}, skipping admission sequence provisioning`);
      return;
    }

    const existing = await this.prisma.admissionSequence.findUnique({
      where: { schoolId_academicYearId: { schoolId, academicYearId: currentAcademicYear.id } },
    });

    if (existing) {
      this.logger.log(`Admission sequence already exists for school ${schoolId}, skipping`);
      return;
    }

    await this.prisma.admissionSequence.create({
      data: {
        schoolId,
        academicYearId: currentAcademicYear.id,
        year: currentAcademicYear.startDate.getFullYear(),
        currentSequence: 0,
      },
    });

    this.logger.log(`Admission sequence provisioned for school ${schoolId}`);
  }

  async provisionPerformanceCategories(schoolId: string) {
    const existing = await this.prisma.performanceCategory.findMany({
      where: { schoolId },
    });
    if (existing.length > 0) {
      this.logger.log(`Performance categories already exist for school ${schoolId}, skipping`);
      return;
    }

    const categories = [
      { name: 'One', label: 'Excellent', minScore: 80, maxScore: 100, color: '#10b981', sortOrder: 1 },
      { name: 'Two', label: 'Very Good', minScore: 70, maxScore: 79.99, color: '#22c55e', sortOrder: 2 },
      { name: 'Three', label: 'Good', minScore: 60, maxScore: 69.99, color: '#3b82f6', sortOrder: 3 },
      { name: 'Four', label: 'Average', minScore: 50, maxScore: 59.99, color: '#f59e0b', sortOrder: 4 },
      { name: 'Five', label: 'Below Average', minScore: 40, maxScore: 49.99, color: '#f97316', sortOrder: 5 },
      { name: 'Six', label: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', sortOrder: 6 },
    ];

    await this.prisma.performanceCategory.createMany({
      data: categories.map(c => ({
        schoolId,
        name: c.name,
        label: c.label,
        minScore: c.minScore,
        maxScore: c.maxScore,
        color: c.color,
        sortOrder: c.sortOrder,
        isActive: true,
      })),
    });

    this.logger.log(`Performance categories provisioned for school ${schoolId}`);
  }
}
