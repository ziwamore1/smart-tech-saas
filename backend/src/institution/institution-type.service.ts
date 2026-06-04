import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstitutionTypeService {
  private readonly logger = new Logger(InstitutionTypeService.name);

  constructor(private prisma: PrismaService) {}

  async getAllTypes() {
    return this.prisma.institutionType.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            modules: true,
            features: true,
            roles: true,
            dashboards: true,
            schools: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getTypeByCode(code: string) {
    const type = await this.prisma.institutionType.findUnique({
      where: { code: code as any },
      include: {
        modules: {
          include: { module: true },
          orderBy: { sortOrder: 'asc' },
        },
        features: {
          include: { feature: true },
        },
        roles: {
          include: { role: true },
        },
        dashboards: {
          include: { dashboard: true, role: true },
        },
        settings: true,
      },
    });

    if (!type) {
      throw new NotFoundException(`Institution type '${code}' not found`);
    }

    return type;
  }

  async getTypeById(id: string) {
    const type = await this.prisma.institutionType.findUnique({
      where: { id },
      include: {
        modules: {
          include: { module: true },
          orderBy: { sortOrder: 'asc' },
        },
        features: {
          include: { feature: true },
        },
        roles: {
          include: { role: true },
        },
        dashboards: {
          include: { dashboard: true, role: true },
        },
        settings: true,
      },
    });

    if (!type) {
      throw new NotFoundException(`Institution type with id '${id}' not found`);
    }

    return type;
  }

  async getModulesForType(code: string) {
    const type = await this.prisma.institutionType.findUnique({
      where: { code: code as any },
    });

    if (!type) {
      throw new NotFoundException(`Institution type '${code}' not found`);
    }

    return this.prisma.institutionTypeModule.findMany({
      where: { institutionTypeId: type.id, isActive: true },
      include: { module: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getFeaturesForType(code: string) {
    const type = await this.prisma.institutionType.findUnique({
      where: { code: code as any },
    });

    if (!type) {
      throw new NotFoundException(`Institution type '${code}' not found`);
    }

    return this.prisma.institutionTypeFeature.findMany({
      where: { institutionTypeId: type.id, isEnabled: true },
      include: { feature: true },
    });
  }

  async getRolesForType(code: string) {
    const type = await this.prisma.institutionType.findUnique({
      where: { code: code as any },
    });

    if (!type) {
      throw new NotFoundException(`Institution type '${code}' not found`);
    }

    return this.prisma.institutionTypeRole.findMany({
      where: { institutionTypeId: type.id, isActive: true },
      include: { role: true },
    });
  }

  async getDashboardsForType(code: string) {
    const type = await this.prisma.institutionType.findUnique({
      where: { code: code as any },
    });

    if (!type) {
      throw new NotFoundException(`Institution type '${code}' not found`);
    }

    return this.prisma.institutionTypeDashboard.findMany({
      where: { institutionTypeId: type.id },
      include: { dashboard: true, role: true },
    });
  }

  async getSettingsForType(code: string) {
    const type = await this.prisma.institutionType.findUnique({
      where: { code: code as any },
    });

    if (!type) {
      throw new NotFoundException(`Institution type '${code}' not found`);
    }

    return this.prisma.institutionSetting.findMany({
      where: { institutionTypeId: type.id },
    });
  }

  async getInstitutionTypeBySchoolId(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { institutionType: true },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return school.institutionType;
  }
}
