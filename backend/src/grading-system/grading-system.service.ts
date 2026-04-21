import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GradingSystemService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string) {
    return this.prisma.gradingSystem.findMany({
      where: { schoolId },
      include: { gradeScales: { orderBy: { minScore: 'desc' } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, schoolId: string) {
    const system = await this.prisma.gradingSystem.findUnique({
      where: { id },
      include: { gradeScales: { orderBy: { minScore: 'desc' } } },
    });

    if (!system || system.schoolId !== schoolId) {
      throw new NotFoundException('Grading system not found');
    }

    return system;
  }

  async create(schoolId: string, data: {
    name: string;
    isDefault?: boolean;
    gradeScales: Array<{
      grade: string;
      points: number;
      minScore: number;
      maxScore: number;
      remark?: string;
      description?: string;
    }>;
  }) {
    if (!data.name) {
      throw new BadRequestException('Name is required');
    }

    if (!data.gradeScales || data.gradeScales.length === 0) {
      throw new BadRequestException('At least one grade scale is required');
    }

    if (data.isDefault) {
      await this.prisma.gradingSystem.updateMany({
        where: { schoolId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if grading system already exists
    const existing = await this.prisma.gradingSystem.findFirst({
      where: { schoolId, name: data.name },
    });

    if (existing) {
      // Delete old grade scales and create new ones
      await this.prisma.gradeScale.deleteMany({ where: { gradingSystemId: existing.id } });
      
      return this.prisma.gradingSystem.update({
        where: { id: existing.id },
        data: {
          isDefault: data.isDefault ?? false,
          gradeScales: {
            create: data.gradeScales.map((scale) => ({
              grade: scale.grade,
              points: scale.points,
              minScore: scale.minScore,
              maxScore: scale.maxScore,
              remark: scale.description || scale.remark || `${scale.grade} Grade`,
            })),
          },
        },
        include: { gradeScales: true },
      });
    }

    return this.prisma.gradingSystem.create({
      data: {
        schoolId,
        name: data.name,
        isDefault: data.isDefault ?? false,
        gradeScales: {
          create: data.gradeScales.map((scale) => ({
            grade: scale.grade,
            points: scale.points,
            minScore: scale.minScore,
            maxScore: scale.maxScore,
            remark: scale.description || scale.remark || `${scale.grade} Grade`,
          })),
        },
      },
      include: { gradeScales: true },
    });
  }

  async update(id: string, schoolId: string, data: {
    name?: string;
    isDefault?: boolean;
    gradeScales?: Array<{
      grade: string;
      points: number;
      minScore: number;
      maxScore: number;
      remark?: string;
      description?: string;
    }>;
  }) {
    const existing = await this.prisma.gradingSystem.findUnique({
      where: { id },
      include: { gradeScales: true },
    });

    if (!existing || existing.schoolId !== schoolId) {
      throw new NotFoundException('Grading system not found');
    }

    if (data.isDefault && !existing.isDefault) {
      await this.prisma.gradingSystem.updateMany({
        where: { schoolId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    let gradeScalesUpdate: any = undefined;
    if (data.gradeScales) {
      await this.prisma.gradeScale.deleteMany({ where: { gradingSystemId: id } });
      gradeScalesUpdate = {
        create: data.gradeScales.map((scale) => ({
          grade: scale.grade,
          points: scale.points,
          minScore: scale.minScore,
          maxScore: scale.maxScore,
          remark: scale.description || scale.remark || `${scale.grade} Grade`,
        })),
      };
    }

    return this.prisma.gradingSystem.update({
      where: { id },
      data: {
        name: data.name,
        isDefault: data.isDefault,
        gradeScales: gradeScalesUpdate,
      },
      include: { gradeScales: { orderBy: { minScore: 'desc' } } },
    });
  }

  async delete(id: string, schoolId: string) {
    const existing = await this.prisma.gradingSystem.findUnique({
      where: { id },
    });

    if (!existing || existing.schoolId !== schoolId) {
      throw new NotFoundException('Grading system not found');
    }

    await this.prisma.gradeScale.deleteMany({ where: { gradingSystemId: id } });
    await this.prisma.gradingSystem.delete({ where: { id } });

    return { message: 'Grading system deleted' };
  }

  async setDefault(id: string, schoolId: string) {
    const existing = await this.prisma.gradingSystem.findUnique({
      where: { id },
    });

    if (!existing || existing.schoolId !== schoolId) {
      throw new NotFoundException('Grading system not found');
    }

    await this.prisma.gradingSystem.updateMany({
      where: { schoolId, isDefault: true },
      data: { isDefault: false },
    });

    return this.prisma.gradingSystem.update({
      where: { id },
      data: { isDefault: true },
      include: { gradeScales: { orderBy: { minScore: 'desc' } } },
    });
  }
}
