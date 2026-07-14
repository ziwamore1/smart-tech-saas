import { Body, Controller, Post, Req, Get, UseGuards, Query, Param } from '@nestjs/common';
import { SchoolService } from './school.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('school')
export class SchoolController {
  constructor(
    private schoolService: SchoolService,
    private prisma: PrismaService,
  ) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Query('schoolId') schoolId?: string, @Req() req?: any) {
    const targetSchoolId = schoolId || req?.user?.schoolId;
    console.log(`[School Profile] Query: "${schoolId}", req.user.schoolId: "${req?.user?.schoolId}", resolved: "${targetSchoolId}"`);
    const result = await this.schoolService.getProfile(targetSchoolId);
    console.log(`[School Profile] Returning:`, JSON.stringify(result));
    return result;
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  async getCurrentSchool(@Req() req?: any) {
    const schoolId = req?.user?.schoolId;
    console.log(`[School Current] req.user.schoolId: ${schoolId}, full user:`, JSON.stringify(req?.user));
    return this.schoolService.getProfile(schoolId);
  }

  @Get()
  async findAll() {
    const schools = await this.prisma.school.findMany({
      take: 100,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, phone: true },
    });
    return { data: schools };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, address: true },
    });
    return { data: school };
  }

  @Post('register')
  async registerSchool(@Body() dto: RegisterSchoolDto) {
    return this.schoolService.registerSchool(dto);
  }

  @Get('debug')
  @UseGuards(JwtAuthGuard)
  async debugSchool(@Req() req?: any) {
    const schoolId = req?.user?.schoolId;
    console.log(`[School Debug] schoolId from JWT: ${schoolId}`);
    
    const allSchools = await this.prisma.school.findMany({ select: { id: true, name: true } });
    console.log(`[School Debug] All schools in DB:`, JSON.stringify(allSchools));
    
    if (schoolId) {
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      console.log(`[School Debug] School lookup result:`, JSON.stringify(school));
    }
    
    return {
      schoolIdFromJWT: schoolId,
      userRoles: req?.user?.roles,
      schoolExists: !!schoolId && !!await this.prisma.school.findUnique({ where: { id: schoolId } }),
    };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@Req() req: any, @Body() body: any) {
    return this.schoolService.updateProfile(req.user.schoolId, body);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  getStats(@Req() req: any) {
    return this.schoolService.getStats(req.user.schoolId);
  }

  @Get('time-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  getTimeSettings(@Req() req: any) {
    return this.schoolService.getTimeSettings(req.user.schoolId);
  }

  @Patch('time-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  updateTimeSettings(@Req() req: any, @Body() body: any) {
    return this.schoolService.updateTimeSettings(req.user.schoolId, body);
  }

  @Patch('grading-system')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  updateGradingSystem(@Req() req: any, @Body() body: { gradingSystem: string }) {
    return this.schoolService.updateTimeSettings(req.user.schoolId, { gradingSystem: body.gradingSystem });
  }

  @Post('fix-class-grading-systems')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'SuperAdmin')
  async fixClassGradingSystems() {
    return this.schoolService.fixClassGradingSystems();
  }
}
