import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { DashboardConfigService } from './dashboard-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('dashboard-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardConfigController {
  constructor(private readonly configService: DashboardConfigService) {}

  @Get()
  async getConfig(@Request() req) {
    return this.configService.getConfig(req.user.schoolId);
  }

  @Put()
  async updateConfig(
    @Request() req,
    @Body()
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
    return this.configService.updateConfig(req.user.schoolId, data);
  }

  @Put('widgets')
  async updateWidgets(@Request() req, @Body() body: { widgets: any[] }) {
    return this.configService.updateWidgets(req.user.schoolId, body.widgets);
  }
}

@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly configService: DashboardConfigService) {}

  @Get('public')
  async getPublicSettings() {
    return this.configService.getPublicSettings();
  }

  @Get(':key')
  @UseGuards(JwtAuthGuard)
  async getSetting(@Request() req, @Body() body: { key: string }) {
    const setting = await this.configService.getSystemSetting(body.key);
    if (!setting) {
      return { key: body.key, value: null };
    }
    return setting;
  }
}
