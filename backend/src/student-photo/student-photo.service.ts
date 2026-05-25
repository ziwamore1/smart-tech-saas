import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs-extra';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from '../common/services/image.service';

@Injectable()
export class StudentPhotoService {
  private readonly logger = new Logger(StudentPhotoService.name);

  constructor(
    private prisma: PrismaService,
    private imageService: ImageService,
  ) {}

  async uploadStudentPhoto(studentId: string, uploadedById: string, file: Express.Multer.File, schoolId: string) {
    if (!file) throw new BadRequestException('No file provided');
    if (!this.imageService.validateMimeType(file.mimetype)) {
      await fs.remove(file.path).catch(() => {});
      throw new BadRequestException('Only JPG, PNG, and WebP files are allowed');
    }

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.schoolId !== schoolId) {
      await fs.remove(file.path).catch(() => {});
      throw new NotFoundException('Student not found');
    }

    const optimizedPath = await this.imageService.cropToPassport(file.path);
    const thumbnailPath = await this.imageService.createThumbnail(optimizedPath, 80);

    const imageUrl = this.imageService.getPhotoUrl(optimizedPath);
    const thumbnailUrl = this.imageService.getPhotoUrl(thumbnailPath);

    const photo = await this.prisma.studentPhoto.create({
      data: { studentId, imageUrl, thumbnailUrl, uploadedById },
    });

    await this.prisma.student.update({
      where: { id: studentId },
      data: { photoUrl: imageUrl },
    });

    return {
      id: photo.id,
      studentId,
      imageUrl,
      thumbnailUrl,
    };
  }

  async getStudentPhoto(studentId: string) {
    const photo = await this.prisma.studentPhoto.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, imageUrl: true, thumbnailUrl: true, createdAt: true },
    });

    return photo || { studentId, imageUrl: null, thumbnailUrl: null };
  }

  async getBatchStudentPhotos(studentIds: string[]) {
    const photos = await this.prisma.studentPhoto.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { createdAt: 'desc' },
      select: { studentId: true, imageUrl: true, thumbnailUrl: true },
    });

    const latestPerStudent = new Map<string, { imageUrl: string | null; thumbnailUrl: string | null }>();
    for (const p of photos) {
      if (!latestPerStudent.has(p.studentId)) {
        latestPerStudent.set(p.studentId, { imageUrl: p.imageUrl, thumbnailUrl: p.thumbnailUrl });
      }
    }

    return Object.fromEntries(latestPerStudent);
  }

  async deleteStudentPhoto(studentId: string, schoolId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.schoolId !== schoolId) {
      throw new NotFoundException('Student not found');
    }

    const photos = await this.prisma.studentPhoto.findMany({
      where: { studentId },
      select: { imageUrl: true, thumbnailUrl: true },
    });

    for (const p of photos) {
      const imagePath = path.join(__dirname, '../../', p.imageUrl.replace(/^\//, ''));
      await fs.remove(imagePath).catch(() => {});
      if (p.thumbnailUrl) {
        const thumbPath = path.join(__dirname, '../../', p.thumbnailUrl.replace(/^\//, ''));
        await fs.remove(thumbPath).catch(() => {});
      }
    }

    await this.prisma.studentPhoto.deleteMany({ where: { studentId } });
    await this.prisma.student.update({
      where: { id: studentId },
      data: { photoUrl: null },
    });

    return { success: true };
  }
}
