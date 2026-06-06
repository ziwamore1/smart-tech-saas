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

    this.logger.log(`Institution ${schoolId} provisioned successfully`);
    return { success: true, type: type.code, modules: type.modules.length };
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
}
