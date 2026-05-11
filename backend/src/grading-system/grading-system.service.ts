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

  async seedDefaultGradingSystems(schoolId: string) {
    const eczScale = await this.prisma.gradeScale.findFirst({
      where: { gradingSystem: { schoolId, name: 'ECZ Point Grading System' } },
    });

    if (!eczScale) {
      const eczSystem = await this.prisma.gradingSystem.create({
        data: { name: 'ECZ Point Grading System', schoolId, isDefault: true },
      });

      await this.prisma.gradeScale.createMany({
        data: [
          { gradingSystemId: eczSystem.id, minScore: 75, maxScore: 100, grade: '1', remark: 'Distinction', points: 1 },
          { gradingSystemId: eczSystem.id, minScore: 70, maxScore: 74, grade: '2', remark: 'Very Good', points: 2 },
          { gradingSystemId: eczSystem.id, minScore: 65, maxScore: 69, grade: '3', remark: 'Good', points: 3 },
          { gradingSystemId: eczSystem.id, minScore: 60, maxScore: 64, grade: '4', remark: 'Credit', points: 4 },
          { gradingSystemId: eczSystem.id, minScore: 55, maxScore: 59, grade: '5', remark: 'Credit', points: 5 },
          { gradingSystemId: eczSystem.id, minScore: 50, maxScore: 54, grade: '6', remark: 'Pass', points: 6 },
          { gradingSystemId: eczSystem.id, minScore: 45, maxScore: 49, grade: '7', remark: 'Pass', points: 7 },
          { gradingSystemId: eczSystem.id, minScore: 40, maxScore: 44, grade: '8', remark: 'Marginal', points: 8 },
          { gradingSystemId: eczSystem.id, minScore: 0, maxScore: 39, grade: '9', remark: 'Fail', points: 9 },
        ],
      });
    }

    const gpaScale = await this.prisma.gradeScale.findFirst({
      where: { gradingSystem: { schoolId, name: 'GPA (4.0 Scale)' } },
    });

    if (!gpaScale) {
      const gpaSystem = await this.prisma.gradingSystem.create({
        data: { name: 'GPA (4.0 Scale)', schoolId, isDefault: false },
      });

      await this.prisma.gradeScale.createMany({
        data: [
          { gradingSystemId: gpaSystem.id, minScore: 97, maxScore: 100, grade: 'A+', remark: 'Excellent', points: 40 },
          { gradingSystemId: gpaSystem.id, minScore: 93, maxScore: 96, grade: 'A', remark: 'Excellent', points: 40 },
          { gradingSystemId: gpaSystem.id, minScore: 90, maxScore: 92, grade: 'A-', remark: 'Excellent', points: 37 },
          { gradingSystemId: gpaSystem.id, minScore: 87, maxScore: 89, grade: 'B+', remark: 'Good', points: 33 },
          { gradingSystemId: gpaSystem.id, minScore: 83, maxScore: 86, grade: 'B', remark: 'Good', points: 30 },
          { gradingSystemId: gpaSystem.id, minScore: 80, maxScore: 82, grade: 'B-', remark: 'Good', points: 27 },
          { gradingSystemId: gpaSystem.id, minScore: 77, maxScore: 79, grade: 'C+', remark: 'Satisfactory', points: 23 },
          { gradingSystemId: gpaSystem.id, minScore: 73, maxScore: 76, grade: 'C', remark: 'Satisfactory', points: 20 },
          { gradingSystemId: gpaSystem.id, minScore: 70, maxScore: 72, grade: 'C-', remark: 'Satisfactory', points: 17 },
          { gradingSystemId: gpaSystem.id, minScore: 67, maxScore: 69, grade: 'D+', remark: 'Passing', points: 13 },
          { gradingSystemId: gpaSystem.id, minScore: 65, maxScore: 66, grade: 'D', remark: 'Passing', points: 10 },
          { gradingSystemId: gpaSystem.id, minScore: 0, maxScore: 64, grade: 'F', remark: 'Fail', points: 0 },
        ],
      });
    }
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
