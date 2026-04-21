import { Body, Controller, Post, Req, Get, UseGuards } from '@nestjs/common';
import { SchoolService } from './school.service';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('school')
export class SchoolController {
  constructor(private schoolService: SchoolService) {}

  @Post('register')
  async registerSchool(@Body() dto: RegisterSchoolDto) {
    return this.schoolService.registerSchool(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: any) {
    return this.schoolService.getProfile(req.user.schoolId);
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
}
