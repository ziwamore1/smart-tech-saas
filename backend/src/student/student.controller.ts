import { Controller, Post, Get, Put, Patch, Delete, Body, Param, Req, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(private readonly service: StudentService) {}

  @Post()
  @Roles('Director', 'Teacher')
  create(@Body() dto: CreateStudentDto, @Req() req: any) {
    return this.service.create(dto, req.user.schoolId);
  }

  @Get()
  @Roles('Director', 'Teacher')
  findAll(@Req() req: any, @Query('classId') classId?: string) {
    return this.service.findAll(req.user.schoolId, classId);
  }

  @Get(':id')
  @Roles('Director', 'Teacher')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Put(':id')
  @Roles('Director')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('Director')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/upload-photo')
  @Roles('Director', 'Teacher')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/students',
        filename: (req, file, cb) => {
          const ext = file.originalname.split('.').pop();
          cb(null, `student-${req.params.id}-${Date.now()}.${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const photoUrl = `${baseUrl}/uploads/students/${file.filename}`;
    return this.service.uploadPhoto(id, photoUrl, req.user.schoolId);
  }

  @Post('enroll')
  @Roles('Director', 'Teacher')
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
  @Roles('Director')
  linkParent(
    @Param('id') id: string,
    @Body() body: { parentId: string },
  ) {
    return this.service.linkStudentToParent(id, body.parentId);
  }

  @Post(':id/unlink-parent')
  @Roles('Director')
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
