import { Controller, Post, Body, Req, UseGuards, Logger, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { LoginDto } from './dto/login.dto';
import { MobileLoginDto } from './dto/mobile-login.dto';
import { RegisterSuperAdminDto, CreateSchoolDto, CreateDirectorDto, RegisterTeacherDto } from './dto/registration.dto';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('register-super-admin')
  async registerSuperAdmin(@Body() body: RegisterSuperAdminDto) {
    this.logger.log(`Register super admin request: ${body.email}`);
    return this.authService.registerSuperAdmin(body);
  }

  @Post('super-admin/login')
  async superAdminLogin(@Body() body: LoginDto) {
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

  @Post('login')
  async login(@Body() body: LoginDto) {
    this.logger.log(
      `Login request - email: ${body.email}, password length: ${body.password?.length}`,
    );
    return this.authService.login(body.email, body.password);
  }

  @Post('mobile-login')
  async mobileLogin(@Body() body: MobileLoginDto) {
    this.logger.log(
      `Mobile login request - email: ${body.email}, platform: ${body.platform || 'android'}`,
    );
    return this.authService.mobileLogin(
      body.email,
      body.password,
      body.deviceToken,
      body.deviceId,
      body.platform,
    );
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
}
