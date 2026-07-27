import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SubjectService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; code?: string; category?: string; description?: string; credits?: string }, schoolId: string) {
    if (data.code) {
      const existing = await this.prisma.subject.findFirst({
        where: { schoolId, name: data.name, code: data.code },
      });
      if (existing) {
        throw new ConflictException(`A subject with name "${data.name}" and code "${data.code}" already exists`);
      }
    }

    try {
      return await this.prisma.subject.create({
        data: {
          name: data.name,
          code: data.code || null,
          category: data.category || null,
          description: data.description || null,
          credits: data.credits ? parseInt(data.credits) : null,
          schoolId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`A subject with this name and code combination already exists in this school`);
      }
      throw error;
    }
  }

  async findAll(schoolId: string) {
    if (!schoolId) return [];
    return this.prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
    });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }

  async update(id: string, data: { name?: string; code?: string; category?: string; description?: string; credits?: string }, schoolId: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    if (subject.schoolId !== schoolId) {
      throw new NotFoundException('Subject not found');
    }
    return this.prisma.subject.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code !== undefined && { code: data.code || null }),
        ...(data.category && { category: data.category }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.credits !== undefined && { credits: parseInt(data.credits) || null }),
      },
    });
  }

  async delete(id: string, schoolId: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    if (subject.schoolId !== schoolId) {
      throw new NotFoundException('Subject not found');
    }
    try {
      await this.prisma.subject.delete({ where: { id } });
      return { message: 'Subject deleted successfully' };
    } catch (error: any) {
      console.error('Delete subject error:', error);
      if (error.code === 'P2003' || error.code === 'P2014') {
        throw new ConflictException('Cannot delete subject - it has related records. Please remove related data first.');
      }
      throw error;
    }
  }
}
