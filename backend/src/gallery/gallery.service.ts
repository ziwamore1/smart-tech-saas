import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GalleryService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    title: string;
    description?: string;
    eventDate?: string;
  }, schoolId: string) {
    return this.prisma.gallery.create({
      data: {
        title: data.title,
        description: data.description || null,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        schoolId,
      },
    });
  }

  async findAll(schoolId: string) {
    return this.prisma.gallery.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const event = await this.prisma.gallery.findFirst({
      where: { id, schoolId },
      include: { photos: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      eventDate?: string;
    },
    schoolId: string,
  ) {
    const event = await this.prisma.gallery.findFirst({
      where: { id, schoolId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return this.prisma.gallery.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.eventDate && { eventDate: new Date(data.eventDate) }),
      },
    });
  }

  async delete(id: string, schoolId: string) {
    const event = await this.prisma.gallery.findFirst({
      where: { id, schoolId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    
    // Delete all photos first
    await this.prisma.galleryPhoto.deleteMany({
      where: { galleryId: id },
    });
    
    await this.prisma.gallery.delete({ where: { id } });
    return { message: 'Event deleted successfully' };
  }

  async uploadPhoto(
    galleryId: string,
    photoUrl: string,
    caption: string | undefined,
    schoolId: string,
  ) {
    const event = await this.prisma.gallery.findFirst({
      where: { id: galleryId, schoolId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return this.prisma.galleryPhoto.create({
      data: {
        url: photoUrl,
        caption: caption || null,
        galleryId,
      },
    });
  }

  async deletePhoto(galleryId: string, photoId: string, schoolId: string) {
    const event = await this.prisma.gallery.findFirst({
      where: { id: galleryId, schoolId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    await this.prisma.galleryPhoto.delete({ where: { id: photoId } });
    return { message: 'Photo deleted successfully' };
  }
}