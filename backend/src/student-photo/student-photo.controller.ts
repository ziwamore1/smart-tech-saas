import { Controller, Post, Get, Delete, Param, Req, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException, Logger } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { StudentPhotoService } from './student-photo.service';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
import { cloudinaryMemoryStorage, CLOUDINARY_FILE_FILTER } from '../cloudinary/multer-cloudinary';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('student-photo')
@UseGuards(JwtAuthGuard)
export class StudentPhotoController {
  private readonly logger = new Logger(StudentPhotoController.name);

  constructor(
    private studentPhotoService: StudentPhotoService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Post('upload/:studentId')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: cloudinaryMemoryStorage(),
      fileFilter: CLOUDINARY_FILE_FILTER,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadStudentPhoto(
    @Param('studentId') studentId: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.cloudinary.upload(file, FOLDERS.users.students);
    const { oldPublicId, ...data } = await this.studentPhotoService.uploadStudentPhoto(studentId, req.user.id, result.secureUrl, result.publicId, req.user.schoolId);
    if (oldPublicId) {
      await this.cloudinary.delete(oldPublicId).catch(() => {});
    }
    return data;
  }

  @Post('bulk-upload')
  @UseInterceptors(
    FilesInterceptor('photos', 50, {
      storage: cloudinaryMemoryStorage(),
      fileFilter: CLOUDINARY_FILE_FILTER,
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
        const cloudResult = await this.cloudinary.upload(file, FOLDERS.users.students);
        const { oldPublicId, ...result } = await this.studentPhotoService.uploadStudentPhoto(studentId, req.user.id, cloudResult.secureUrl, cloudResult.publicId, req.user.schoolId);
        if (oldPublicId) {
          await this.cloudinary.delete(oldPublicId).catch(() => {});
        }
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
