import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InstitutionTypeService } from '../institution/institution-type.service';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly institutionTypeService: InstitutionTypeService,
  ) {}

  @Get('institution-types')
  async getInstitutionTypes() {
    return this.institutionTypeService.getAllTypes();
  }

  @Get('schools')
  async getAllSchools(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.superAdminService.getAllSchools(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      search,
    );
  }

  @Post('schools')
  async createSchool(@Body() data: any) {
    return this.superAdminService.createSchool(data);
  }

  @Get('schools/:id')
  async getSchoolById(@Param('id') id: string) {
    return this.superAdminService.getSchoolById(id);
  }

  @Patch('schools/:id')
  async updateSchool(@Param('id') id: string, @Body() data: any) {
    return this.superAdminService.updateSchool(id, data);
  }

  @Put('schools/:id/subscription')
  async updateSubscription(
    @Param('id') id: string,
    @Body() data: { subscriptionStatus?: string; trialEndsAt?: Date },
  ) {
    return this.superAdminService.updateSchoolSubscription(id, data);
  }

  @Post('schools/:id/activate')
  async activateSchool(@Param('id') id: string) {
    return this.superAdminService.activateSchool(id);
  }

  @Post('schools/:id/deactivate')
  async deactivateSchool(@Param('id') id: string) {
    return this.superAdminService.deactivateSchool(id);
  }

  @Delete('schools/:id')
  async deleteSchool(@Param('id') id: string) {
    return this.superAdminService.deleteSchool(id);
  }

  @Post('schools/:schoolId/directors')
  async createDirector(
    @Param('schoolId') schoolId: string,
    @Body()
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    },
  ) {
    return this.superAdminService.createDirector(schoolId, data);
  }

  @Get('schools/:schoolId/directors')
  async getSchoolDirectors(@Param('schoolId') schoolId: string) {
    return this.superAdminService.getSchoolDirectors(schoolId);
  }

  @Post('schools/:schoolId/directors/:directorId/send-link')
  async sendSchoolLink(
    @Param('schoolId') schoolId: string,
    @Param('directorId') directorId: string,
    @Body() data: { method: 'email' | 'whatsapp' | 'both' },
  ) {
    return this.superAdminService.sendSchoolLink(
      schoolId,
      directorId,
      data.method,
    );
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('schoolId') schoolId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.superAdminService.getAllAuditLogs(
      schoolId,
      limit ? Number(limit) : 100,
    );
  }

  @Get('stats')
  async getSystemStats() {
    return this.superAdminService.getSystemStats();
  }

  @Get('results-analytics')
  async getResultsAnalytics() {
    return this.superAdminService.getResultsAnalytics();
  }

  @Get('settings')
  async getAllSettings() {
    return this.superAdminService.getAllSettings();
  }

  @Get('settings/public')
  async getPublicSettings() {
    return this.superAdminService.getPublicSettings();
  }

  @Put('settings/public')
  async setPublicSetting(@Body() body: { key: string; value: any }) {
    return this.superAdminService.setPublicSetting(body.key, body.value);
  }

  @Put('settings')
  async updateSetting(
    @Body() body: { key: string; value: any; isPublic?: boolean },
  ) {
    return this.superAdminService.updateSetting(
      body.key,
      body.value,
      body.isPublic,
    );
  }

  @Get('settings/:key')
  async getSetting(@Param('key') key: string) {
    return this.superAdminService.getSetting(key);
  }

  @Get('schools/:schoolId/users')
  async getSchoolUsers(@Param('schoolId') schoolId: string) {
    return this.superAdminService.getSchoolUsers(schoolId);
  }

  @Patch('schools/:schoolId/users/:userId/roles')
  async updateUserRoles(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() data: { roles: string[] },
  ) {
    return this.superAdminService.updateUserRoles(schoolId, userId, data.roles);
  }

  @Get('roles')
  async getAllRoles() {
    return this.superAdminService.getAllRoles();
  }

  @Post('enroll-self-as-staff')
  async enrollSelfAsStaff(
    @Request() req: any,
    @Body() data: any,
  ) {
    return this.superAdminService.enrollAsStaff(
      req.user.id,
      data.schoolId,
      data.role,
    );
  }

  @Post('backfill-provisioning')
  async backfillProvisioning() {
    return this.superAdminService.backfillAllSchools();
  }

  @Post('schools/:schoolId/re-provision')
  async reProvisionSchool(@Param('schoolId') schoolId: string) {
    return this.superAdminService.reProvisionSchool(schoolId);
  }

  @Post('seed-performance-categories')
  async seedPerformanceCategories() {
    return this.superAdminService.seedPerformanceCategories();
  }
}

@Controller('public')
export class SuperAdminPublicController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post('seed-performance-categories')
  async seedPerformanceCategories() {
    try {
      const result = await this.superAdminService.seedPerformanceCategories();
      return result;
    } catch (error: any) {
      return { error: error.message };
    }
  }
}

@Controller('super-admin/setup')
export class SuperAdminSetupController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post('create-admin')
  async createSuperAdmin(
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    },
  ) {
    return this.superAdminService.createSuperAdmin(
      body.email,
      body.password,
      body.firstName,
      body.lastName,
    );
  }
}
