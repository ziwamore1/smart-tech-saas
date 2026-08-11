import { Controller, Post, Body, Req, UseGuards, Logger, Get, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { LoginDto } from './dto/login.dto';
import { MobileLoginDto } from './dto/mobile-login.dto';
import { RegisterSuperAdminDto, CreateSchoolDto, CreateDirectorDto, RegisterTeacherDto } from './dto/registration.dto';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { InstitutionRegistrationService } from '../institution/institution-registration.service';
import { InstitutionTypeService } from '../institution/institution-type.service';
import { RegisterInstitutionDto } from '../institution/dto/institution-type.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private institutionRegistrationService: InstitutionRegistrationService,
    private institutionTypeService: InstitutionTypeService,
  ) {}

  @Post('register-super-admin')
  async registerSuperAdmin(@Body() body: RegisterSuperAdminDto) {
    this.logger.log(`Register super admin request: ${body.email}`);
    return this.authService.registerSuperAdmin(body);
  }

  @Post('super-admin/login')
  async superAdminLogin(@Body() body: { email: string; password: string }) {
    console.error(`[probe:login-handler] ${body?.email}`);
    this.logger.log(`Super admin login request: ${body.email}`);
    return this.authService.superAdminLogin(body.email, body.password);
  }

  @Post('school')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async createSchool(@Body() body: CreateSchoolDto, @Req() req: any) {
    this.logger.log(`Create school request: ${JSON.stringify(body)}`);
    return this.authService.createSchool(body, req.user.sub);
  }

  @Post('director')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async createDirector(@Body() body: CreateDirectorDto, @Req() req: any) {
    this.logger.log(`Create director request: ${JSON.stringify(body)}`);
    return this.authService.createDirector(body, req.user.sub);
  }

  @Post('teacher')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'SuperAdmin')
  async createTeacher(@Body() body: RegisterTeacherDto, @Req() req: any) {
    this.logger.log(`Create teacher request: ${JSON.stringify(body)}`);
    const schoolId = req.user.schoolId;
    if (!schoolId && !req.user.roles?.includes('SuperAdmin')) {
      throw new Error('School ID required');
    }
    return this.authService.createTeacher(body, req.user.sub, schoolId);
  }

  @Post('register-school')
  async registerSchool(@Body() body: RegisterSchoolDto) {
    this.logger.log(`Register school request: ${JSON.stringify(body)}`);
    return this.authService.registerSchool(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Get('institution-types')
  async getInstitutionTypes() {
    return this.institutionTypeService.getAllTypes();
  }

  @Post('register-institution')
  async registerInstitution(@Body() body: RegisterInstitutionDto) {
    return this.institutionRegistrationService.registerInstitution(body);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    this.logger.log(
      `Login request - identifier: ${body.identifier}, password length: ${body.password?.length}, schoolId: ${body.schoolId || 'not provided'}`,
    );
    return this.authService.login(body.identifier, body.password, body.schoolId);
  }

  @Post('mobile-login')
  async mobileLogin(@Body() body: MobileLoginDto) {
    this.logger.log(
      `Mobile login request - email: ${body.email}, username: ${body.username}, platform: ${body.platform || 'android'}`,
    );
    return this.authService.mobileLogin(
      body.email,
      body.password,
      body.deviceToken,
      body.deviceId,
      body.platform,
      body.username,
    );
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { identifier: string }) {
    this.logger.log(`Forgot password request for identifier: ${body.identifier}`);
    return this.authService.forgotPassword(body.identifier);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    this.logger.log(`Reset password request with token`);
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Post('register-teacher')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director')
  async registerTeacher(
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    },
    @Req() req: any,
  ) {
    return this.authService.registerTeacher(
      body.email,
      body.password,
      body.firstName,
      body.lastName,
      req.user.schoolId,
    );
  }

  @Post('switch-identity')
  @UseGuards(JwtAuthGuard)
  async switchIdentity(@Req() req: any, @Body() body: { schoolId: string }) {
    this.logger.log(`Switch identity request for user ${req.user.id} to school ${body.schoolId}`);
    return this.authService.switchIdentity(req.user.id, body.schoolId);
  }

  @Get('linked-identities')
  @UseGuards(JwtAuthGuard)
  async getLinkedIdentities(@Req() req: any) {
    return this.authService.getLinkedIdentities(req.user.id);
  }
}
