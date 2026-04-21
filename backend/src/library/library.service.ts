import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    title: string;
    description?: string;
    category: string;
    fileType?: string;
  }, schoolId: string) {
    console.log('[LibraryService] Creating with schoolId:', schoolId);
    if (!schoolId) {
      throw new Error('School ID is required. Please log in again.');
    }
    const result = await this.prisma.library.create({
      data: {
        title: data.title,
        description: data.description || null,
        category: data.category,
        fileType: data.fileType || null,
        schoolId,
      },
    });
    console.log('[LibraryService] Created document:', result.id);
    return result;
  }

  async findAll(schoolId: string) {
    console.log('[LibraryService] findAll with schoolId:', schoolId);
    if (!schoolId) {
      return [];
    }
    const docs = await this.prisma.library.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
    console.log('[LibraryService] Found documents:', docs.length);
    return docs;
  }

  async findOne(id: string, schoolId: string) {
    const document = await this.prisma.library.findFirst({
      where: { id, schoolId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      category?: string;
    },
    schoolId: string,
  ) {
    const document = await this.prisma.library.findFirst({
      where: { id, schoolId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return this.prisma.library.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.category && { category: data.category }),
      },
    });
  }

  async delete(id: string, schoolId: string) {
    const document = await this.prisma.library.findFirst({
      where: { id, schoolId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    await this.prisma.library.delete({ where: { id } });
    return { message: 'Document deleted successfully' };
  }

  async uploadFile(
    id: string,
    fileUrl: string,
    fileSize: number,
    schoolId: string,
  ) {
    const document = await this.prisma.library.findFirst({
      where: { id, schoolId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return this.prisma.library.update({
      where: { id },
      data: {
        fileUrl,
        fileSize,
      },
    });
  }

  async findByCategory(category: string, schoolId: string) {
    return this.prisma.library.findMany({
      where: { category, schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async logReadingSession(
    documentId: string,
    data: { durationSeconds: number; pagesViewed: string[]; completedAt: string },
    schoolId: string,
    userId: string,
  ) {
    const document = await this.prisma.library.findFirst({
      where: { id: documentId, schoolId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return this.prisma.readingSession.create({
      data: {
        documentId,
        userId,
        schoolId,
        durationSeconds: data.durationSeconds,
        pagesViewed: data.pagesViewed,
        completedAt: new Date(data.completedAt),
      },
    });
  }
}