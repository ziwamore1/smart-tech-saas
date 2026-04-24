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

  @Get('profile')
  getProfile(@Query('schoolId') schoolId?: string, @Req() req?: any) {
    const targetSchoolId = schoolId || req?.user?.schoolId;
    return this.schoolService.getProfile(targetSchoolId);
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

  @Patch('branding')
  @Roles('Director')
  updateBranding(@Req() req: any, @Body() body: any) {
    return this.schoolService.updateBranding(req.user.schoolId, body);
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
}
