import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcademicYearService {
  constructor(private prisma: PrismaService) {}

  async create(data: any, schoolId: string) {
    return this.prisma.academicYear.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        schoolId,
      },
    });
  }

  async findAll(schoolId: string) {
    return this.prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year || year.schoolId !== schoolId) throw new NotFoundException('Academic year not found');
    return year;
  }

  async update(id: string, data: any, schoolId: string) {
    await this.findOne(id, schoolId);
    return this.prisma.academicYear.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
      },
    });
  }

  async delete(id: string, schoolId: string) {
    await this.findOne(id, schoolId);
    const termCount = await this.prisma.term.count({ where: { academicYearId: id } });
    if (termCount > 0) {
      throw new ForbiddenException('Cannot delete academic year with existing terms. Delete all terms first.');
    }
    return this.prisma.academicYear.delete({ where: { id } });
  }

  async setCurrent(id: string, schoolId: string) {
    await this.prisma.academicYear.updateMany({
      where: { schoolId },
      data: { isCurrent: false },
    });

    return this.prisma.academicYear.update({
      where: { id },
      data: { isCurrent: true },
    });
  }
}
