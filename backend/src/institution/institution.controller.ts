import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InstitutionTypeService } from './institution-type.service';
import { InstitutionProvisioningService } from './institution-provisioning.service';
import { InstitutionRegistrationService } from './institution-registration.service';
import { RegisterInstitutionDto, CreateInstitutionDto } from './dto/institution-type.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('institution')
export class InstitutionController {
  constructor(
    private readonly institutionTypeService: InstitutionTypeService,
    private readonly provisioningService: InstitutionProvisioningService,
    private readonly registrationService: InstitutionRegistrationService,
  ) {}

  @Get('types')
  async getInstitutionTypes() {
    return this.institutionTypeService.getAllTypes();
  }

  @Get('types/:code')
  async getTypeByCode(@Param('code') code: string) {
    return this.institutionTypeService.getTypeByCode(code);
  }

  @Get('types/:code/modules')
  async getTypeModules(@Param('code') code: string) {
    return this.institutionTypeService.getModulesForType(code);
  }

  @Get('types/:code/roles')
  async getTypeRoles(@Param('code') code: string) {
    return this.institutionTypeService.getRolesForType(code);
  }

  @Get('types/:code/dashboards')
  async getTypeDashboards(@Param('code') code: string) {
    return this.institutionTypeService.getDashboardsForType(code);
  }

  @Get('types/:code/features')
  async getTypeFeatures(@Param('code') code: string) {
    return this.institutionTypeService.getFeaturesForType(code);
  }

  @Get('types/:code/settings')
  async getTypeSettings(@Param('code') code: string) {
    return this.institutionTypeService.getSettingsForType(code);
  }

  @Post('register')
  async registerInstitution(@Body() dto: RegisterInstitutionDto) {
    return this.registrationService.registerInstitution(dto);
  }

  @Get('registration/steps')
  async getRegistrationSteps() {
    return this.registrationService.getRegistrationSteps();
  }

  @Get(':schoolId/modules')
  @UseGuards(JwtAuthGuard)
  async getSchoolModules(@Param('schoolId') schoolId: string) {
    return this.provisioningService.getProvisionedModules(schoolId);
  }

  @Get(':schoolId/features')
  @UseGuards(JwtAuthGuard)
  async getSchoolFeatures(@Param('schoolId') schoolId: string) {
    return this.provisioningService.getProvisionedFeatures(schoolId);
  }

  @Get(':schoolId/roles')
  @UseGuards(JwtAuthGuard)
  async getSchoolRoles(@Param('schoolId') schoolId: string) {
    return this.provisioningService.getProvisionedRoles(schoolId);
  }

  @Get(':schoolId/type')
  @UseGuards(JwtAuthGuard)
  async getSchoolType(@Param('schoolId') schoolId: string) {
    return this.institutionTypeService.getInstitutionTypeBySchoolId(schoolId);
  }
}
