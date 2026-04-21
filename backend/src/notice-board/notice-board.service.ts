import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NoticeBoardService {
  constructor(private prisma: PrismaService) {}

  async createNoticeBoard(
    schoolId: string,
    data: {
      title: string;
      content: string;
      category?: string;
      priority?: string;
      isPublished?: boolean;
      publishAt?: Date;
      expiresAt?: Date;
      createdById?: string;
    },
  ) {
    return this.prisma.noticeBoard.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category || 'general',
        priority: data.priority || 'normal',
        isPublished: data.isPublished || false,
        publishAt: data.publishAt,
        expiresAt: data.expiresAt,
        schoolId,
        createdById: data.createdById,
      },
    });
  }

  async getAllNotices(
    schoolId: string,
    filters?: {
      category?: string;
      isPublished?: boolean;
    },
  ) {
    return this.prisma.noticeBoard.findMany({
      where: {
        schoolId,
        ...(filters?.category && { category: filters.category }),
        ...(filters?.isPublished !== undefined && {
          isPublished: filters.isPublished,
        }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPublishedNotices(schoolId: string) {
    const now = new Date();
    return this.prisma.noticeBoard.findMany({
      where: {
        schoolId,
        isPublished: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNoticeById(id: string) {
    return this.prisma.noticeBoard.findUnique({
      where: { id },
    });
  }

  async updateNotice(
    id: string,
    data: Partial<{
      title: string;
      content: string;
      category: string;
      priority: string;
      isPublished: boolean;
      publishAt: Date;
      expiresAt: Date;
    }>,
  ) {
    return this.prisma.noticeBoard.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async deleteNotice(id: string) {
    return this.prisma.noticeBoard.delete({
      where: { id },
    });
  }

  async publishNotice(id: string) {
    return this.prisma.noticeBoard.update({
      where: { id },
      data: {
        isPublished: true,
        publishAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}
