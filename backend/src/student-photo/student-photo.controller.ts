import { Controller, Post, Get, Delete, Param, Req, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException, Logger } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StudentPhotoService } from './student-photo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('student-photo')
@UseGuards(JwtAuthGuard)
export class StudentPhotoController {
  private readonly logger = new Logger(StudentPhotoController.name);

  constructor(private studentPhotoService: StudentPhotoService) {}

  @Post('upload/:studentId')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: join(__dirname, '../../uploads/students'),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `student-${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Only JPG, PNG, and WebP files are allowed'), false);
      },
    }),
  )
  async uploadStudentPhoto(
    @Param('studentId') studentId: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.studentPhotoService.uploadStudentPhoto(studentId, req.user.id, file, req.user.schoolId);
  }

  @Post('bulk-upload')
  @UseInterceptors(
    FilesInterceptor('photos', 50, {
      storage: diskStorage({
        destination: join(__dirname, '../../uploads/students'),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `student-${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async bulkUploadStudentPhotos(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No files provided');

    const results = [];
    for (const file of files) {
      try {
        const studentId = (file as any).fieldname;
        const result = await this.studentPhotoService.uploadStudentPhoto(studentId, req.user.id, file, req.user.schoolId);
        results.push({ success: true, studentId, ...result });
      } catch (err: any) {
        results.push({ success: false, studentId: (file as any).fieldname, error: err.message });
      }
    }

    return { uploaded: results.length, results };
  }

  @Get(':studentId')
  async getStudentPhoto(@Param('studentId') studentId: string) {
    return this.studentPhotoService.getStudentPhoto(studentId);
  }

  @Get('batch/:studentIds')
  async getBatchStudentPhotos(@Param('studentIds') studentIds: string) {
    const ids = studentIds.split(',');
    return this.studentPhotoService.getBatchStudentPhotos(ids);
  }

  @Delete(':studentId')
  async deleteStudentPhoto(@Param('studentId') studentId: string, @Req() req: any) {
    return this.studentPhotoService.deleteStudentPhoto(studentId, req.user.schoolId);
  }
}
