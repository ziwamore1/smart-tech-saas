import { Controller, Post, Get, Put, Patch, Delete, Body, Param, Req, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentService } from './student.service';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
import { cloudinaryMemoryStorage, CLOUDINARY_FILE_FILTER } from '../cloudinary/multer-cloudinary';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { AdmissionNumberService } from '../admission-number/admission-number.service';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(
    private readonly service: StudentService,
    private readonly cloudinary: CloudinaryService,
    private readonly admissionNumberService: AdmissionNumberService,
  ) {}

  @Get('preview-admission')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async previewAdmissionNumber(@Req() req: any, @Query('academicYearId') academicYearId?: string) {
    const schoolId = req.user.schoolId;
    const yearId = academicYearId || await this.service.getCurrentAcademicYearId(schoolId);
    const preview = await this.admissionNumberService.previewNextAdmissionNumber(schoolId, yearId);
    return { admissionNumber: preview };
  }

  @Post()
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  create(@Body() dto: CreateStudentDto, @Req() req: any) {
    return this.service.create(dto, req.user.schoolId, req.user.id, req.user.roles);
  }

  @Get()
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  findAll(
    @Req() req: any,
    @Query('classId') classId?: string,
    @Query('status') status?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(req.user.schoolId, {
      classId,
      status,
      includeInactive: includeInactive === 'true',
      search,
    });
  }

  @Get('search')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  search(@Req() req: any, @Query('q') query: string) {
    return this.service.comprehensiveSearch(query, req.user.schoolId);
  }

  @Get('admission/:admissionNumber')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  findByAdmissionNumber(@Param('admissionNumber') admissionNumber: string, @Req() req: any) {
    return this.service.findByAdmissionNumber(admissionNumber, req.user.schoolId);
  }

  @Get(':id')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Put(':id')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.id, req.user.roles);
  }

  @Delete(':id')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/status')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  changeStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    return this.service.changeStatus(id, body.status as any, req.user.id);
  }

  @Get(':id/status-history')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  getStatusHistory(@Param('id') id: string) {
    return this.service.getStatusHistory(id);
  }

  @Post(':id/upload-photo')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: cloudinaryMemoryStorage(),
      fileFilter: CLOUDINARY_FILE_FILTER,
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const result = await this.cloudinary.upload(file, FOLDERS.users.students);
    const oldPublicId = await this.service.uploadPhoto(id, result.secureUrl, result.publicId, req.user.schoolId);
    if (oldPublicId) {
      await this.cloudinary.delete(oldPublicId).catch(() => {});
    }
    return { photoUrl: result.secureUrl, photoPublicId: result.publicId };
  }

  @Post('enroll')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  enroll(
    @Body()
    body: {
      studentId: string;
      academicYearId: string;
      classId: string;
      termId?: string;
    },
    @Req() req: any,
  ) {
    return this.service.enroll(
      body.studentId,
      body.academicYearId,
      body.classId,
      req.user.schoolId,
    );
  }

  @Post(':id/link-parent')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  linkParent(
    @Param('id') id: string,
    @Body() body: { parentId: string },
  ) {
    return this.service.linkStudentToParent(id, body.parentId);
  }

  @Post(':id/unlink-parent')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  unlinkParent(
    @Param('id') id: string,
    @Body() body: { parentId: string },
  ) {
    return this.service.unlinkStudentFromParent(id, body.parentId);
  }

  @Post('promoteStudent')
  @Roles('Director')
  promoteStudent(
    @Body()
    body: {
      fromAcademicYearId: string;
      toAcademicYearId: string;
    },
    @Req() req: any,
  ) {
    return this.service.promoteStudent(
      body.fromAcademicYearId,
      body.toAcademicYearId,
      req.user.schoolId,
    );
  }
}
