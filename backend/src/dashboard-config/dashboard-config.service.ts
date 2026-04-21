import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(schoolId: string) {
    let config = await this.prisma.dashboardConfig.findUnique({
      where: { schoolId },
    });

    if (!config) {
      config = await this.prisma.dashboardConfig.create({
        data: { schoolId },
      });
    }

    return config;
  }

  async updateConfig(
    schoolId: string,
    data: {
      widgets?: any[];
      showStudentStats?: boolean;
      showTeacherStats?: boolean;
      showFeeStats?: boolean;
      showAttendance?: boolean;
      showNotices?: boolean;
      showTimetable?: boolean;
      themeColor?: string;
      accentColor?: string;
      dashboardLayout?: string;
    },
  ) {
    return this.prisma.dashboardConfig.upsert({
      where: { schoolId },
      update: data,
      create: { schoolId, ...data },
    });
  }

  async updateWidgets(schoolId: string, widgets: any[]) {
    return this.prisma.dashboardConfig.upsert({
      where: { schoolId },
      update: { widgets },
      create: { schoolId, widgets },
    });
  }

  async getPublicSettings() {
    return this.prisma.systemSetting.findMany({
      where: { isPublic: true },
    });
  }

  async getSystemSetting(key: string) {
    return this.prisma.systemSetting.findUnique({
      where: { key },
    });
  }

  async setSystemSetting(key: string, value: any, isPublic: boolean = false) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, isPublic },
      create: { key, value, isPublic },
    });
  }
}
