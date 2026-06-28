import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class StudentPhotoService {
  private readonly logger = new Logger(StudentPhotoService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

  async uploadStudentPhoto(studentId: string, uploadedById: string, imageUrl: string, imagePublicId: string, schoolId: string): Promise<{ id: string; studentId: string; imageUrl: string; thumbnailUrl: string; oldPublicId: string | null }> {
    if (!imageUrl) throw new BadRequestException('No image URL provided');

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.schoolId !== schoolId) {
      throw new NotFoundException('Student not found');
    }

    const oldPublicId = student.photoPublicId;

    const thumbnailUrl = imageUrl;

    const photo = await this.prisma.studentPhoto.create({
      data: { studentId, imageUrl, thumbnailUrl, uploadedById, photoPublicId: imagePublicId },
    });

    await this.prisma.student.update({
      where: { id: studentId },
      data: { photoUrl: imageUrl, photoPublicId: imagePublicId },
    });

    return {
      id: photo.id,
      studentId,
      imageUrl,
      thumbnailUrl,
      oldPublicId,
    };
  }

  async getStudentPhoto(studentId: string) {
    const resolvedId = await this.resolveStudentId(studentId);

    const photo = await this.prisma.studentPhoto.findFirst({
      where: { studentId: resolvedId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, imageUrl: true, thumbnailUrl: true, createdAt: true },
    });

    return photo || { studentId: resolvedId, imageUrl: null, thumbnailUrl: null };
  }

  private async resolveStudentId(id: string): Promise<string> {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (student) return id;
    const user = await this.prisma.user.findUnique({ where: { id, studentId: { not: null } } });
    if (user?.studentId) return user.studentId;
    return id;
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
      if (p.imageUrl) {
        const imagePath = path.join(__dirname, '../../', p.imageUrl.replace(/^\//, ''));
        try { await fs.promises.unlink(imagePath); } catch {}
      }
      if (p.thumbnailUrl) {
        const thumbPath = path.join(__dirname, '../../', p.thumbnailUrl.replace(/^\//, ''));
        try { await fs.promises.unlink(thumbPath); } catch {}
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
