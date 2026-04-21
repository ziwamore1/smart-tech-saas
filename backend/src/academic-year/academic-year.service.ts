import { Injectable } from '@nestjs/common';
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
