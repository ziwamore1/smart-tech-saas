import { Body, Controller, Post, Req, Get, UseGuards, Query, Param, Delete, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SchoolService } from './school.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';

const LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const logoFileFilter = (req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
  if (!LOGO_MIME_TYPES.includes(file.mimetype)) {
    cb(new BadRequestException('Logo must be a JPEG, PNG, WEBP or SVG image'), false);
    return;
  }
  cb(null, true);
};

@Controller('school')
export class SchoolController {
  constructor(
    private schoolService: SchoolService,
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  /**
   * SCHOOL BRANDING (logo + identity). Every route below resolves the school
   * exclusively from the JWT (`req.user.schoolId`) — never from a query/body
   * parameter — so a school can only ever see or change its own logo.
   * NOTE: declared before @Get(':id') so 'branding' is not captured as an id.
   */

  @Get('branding')
  @UseGuards(JwtAuthGuard)
  async getBranding(@Req() req?: any) {
    return this.schoolService.getBranding(req?.user?.schoolId);
  }

  @Post('branding/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: logoFileFilter,
    }),
  )
  async uploadLogo(@Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    const schoolId = req?.user?.schoolId;
    if (!schoolId) throw new BadRequestException('No school associated with your account');
    if (!file) throw new BadRequestException('No logo file provided');

    const result = await this.cloudinary.upload(file, FOLDERS.schools.logos, {
      publicId: `school-logo-${schoolId}-${Date.now()}`,
      resourceType: 'image',
    });

    const { previousPublicId } = await this.schoolService.updateLogo(
      schoolId,
      result.secureUrl || result.url,
      result.publicId,
    );

    if (previousPublicId && previousPublicId !== result.publicId) {
      await this.cloudinary.delete(previousPublicId).catch(() => {});
    }

    return {
      message: 'School logo updated',
      logoUrl: result.secureUrl || result.url,
      logoPublicId: result.publicId,
    };
  }

  @Delete('branding/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  async removeLogo(@Req() req: any) {
    const schoolId = req?.user?.schoolId;
    if (!schoolId) throw new BadRequestException('No school associated with your account');
    const { previousPublicId } = await this.schoolService.removeLogo(schoolId);
    if (previousPublicId) {
      await this.cloudinary.delete(previousPublicId).catch(() => {});
    }
    return { message: 'School logo removed' };
  }

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
  @Roles('SuperAdmin')
  async fixClassGradingSystems() {
    return this.schoolService.fixClassGradingSystems();
  }

  @Get('diagnose-grading/:className')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  async diagnoseGrading(@Param('className') className: string) {
    return this.schoolService.diagnoseGradingForClass(className);
  }
}
