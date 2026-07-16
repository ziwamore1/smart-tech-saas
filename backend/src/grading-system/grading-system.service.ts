import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GradingSystemService {
  private readonly logger = new Logger(GradingSystemService.name);
  private seeded = false;
  constructor(private prisma: PrismaService) {}

  async ensureG7PolicyExists(schoolId: string) {
    const existing = await this.prisma.gradingPolicy.findFirst({
      where: { schoolId, code: 'ECZ_G7' },
    });
    if (existing) return true;
    try {
      await this.seedG7GradingPolicy(schoolId);
      return true;
    } catch {
      return false;
    }
  }

  async ensureG7PolicyForAllSchools() {
    if (this.seeded) return;
    try {
      const schools = await this.prisma.school.findMany({ select: { id: true } });
      for (const school of schools) {
        await this.ensureG7PolicyExists(school.id);
      }
      this.seeded = true;
      if (schools.length > 0) this.logger.log(`ECZ Grade 7 policies ensured for ${schools.length} schools`);
    } catch (err: any) {
      this.logger.warn(`Could not ensure ECZ Grade 7 policies: ${err?.message}`);
    }
  }

  async findAll(schoolId: string) {
    return this.prisma.gradingSystem.findMany({
      where: { schoolId },
      include: { gradeScales: { orderBy: { minScore: 'desc' } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findDefault(schoolId: string) {
    const system = await this.prisma.gradingSystem.findFirst({
      where: { schoolId, isDefault: true },
      include: { gradeScales: { orderBy: { minScore: 'desc' } } },
    });
    if (!system) {
      const any = await this.prisma.gradingSystem.findFirst({
        where: { schoolId },
        include: { gradeScales: { orderBy: { minScore: 'desc' } } },
      });
      if (!any) throw new NotFoundException('No grading system found for this school');
      return any;
    }
    return system;
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

  private primaryGradingScales = [
    { grade: 'A', points: 5, minScore: 80, maxScore: 100, remark: 'Excellent' },
    { grade: 'B', points: 4, minScore: 70, maxScore: 79, remark: 'Very Good' },
    { grade: 'C', points: 3, minScore: 60, maxScore: 69, remark: 'Good' },
    { grade: 'D', points: 2, minScore: 50, maxScore: 59, remark: 'Satisfactory' },
    { grade: 'E', points: 1, minScore: 40, maxScore: 49, remark: 'Fair' },
    { grade: 'F', points: 0, minScore: 0, maxScore: 39, remark: 'Fail' },
  ];

  private grade7EczScales = [
    { grade: 'One', points: 1, minScore: 75, maxScore: 100, remark: 'Excellent' },
    { grade: 'Two', points: 2, minScore: 60, maxScore: 74, remark: 'Very Good' },
    { grade: 'Three', points: 3, minScore: 50, maxScore: 59, remark: 'Good' },
    { grade: 'Four', points: 4, minScore: 40, maxScore: 49, remark: 'Satisfactory' },
    { grade: 'Five', points: 5, minScore: 0, maxScore: 39, remark: 'Fail' },
  ];

  private secondaryEczScales = [
    { grade: '1', points: 1, minScore: 75, maxScore: 100, remark: 'Distinction' },
    { grade: '2', points: 2, minScore: 70, maxScore: 74, remark: 'Distinction' },
    { grade: '3', points: 3, minScore: 65, maxScore: 69, remark: 'Merit' },
    { grade: '4', points: 4, minScore: 60, maxScore: 64, remark: 'Merit' },
    { grade: '5', points: 5, minScore: 55, maxScore: 59, remark: 'Credit' },
    { grade: '6', points: 6, minScore: 50, maxScore: 54, remark: 'Credit' },
    { grade: '7', points: 7, minScore: 45, maxScore: 49, remark: 'Satisfactory' },
    { grade: '8', points: 8, minScore: 40, maxScore: 44, remark: 'Satisfactory' },
    { grade: '9', points: 9, minScore: 0, maxScore: 39, remark: 'Unsatisfactory' },
  ];

  private async ensureGradingSystem(
    schoolId: string,
    name: string,
    scales: Array<{ grade: string; points: number; minScore: number; maxScore: number; remark: string }>,
    isDefault: boolean,
  ) {
    const existing = await this.prisma.gradingSystem.findFirst({
      where: { schoolId, name },
    });
    if (existing) return existing;

    const system = await this.prisma.gradingSystem.create({
      data: { name, schoolId, isDefault },
    });

    await this.prisma.gradeScale.createMany({
      data: scales.map(s => ({ gradingSystemId: system.id, ...s })),
    });

    return system;
  }

  private formsGradingScales = [
    { grade: '1', points: 1, minScore: 70, maxScore: 100, remark: 'Outstanding' },
    { grade: '2', points: 2, minScore: 60, maxScore: 69, remark: 'Advanced' },
    { grade: '3', points: 3, minScore: 50, maxScore: 59, remark: 'Basic' },
    { grade: '4', points: 4, minScore: 40, maxScore: 49, remark: 'Satisfactory' },
    { grade: '5', points: 5, minScore: 0, maxScore: 39, remark: 'Unsatisfactory' },
  ];

  private collegeGradingScales = [
    { grade: 'A', points: 4, minScore: 85, maxScore: 100, remark: 'Distinction' },
    { grade: 'B', points: 3, minScore: 70, maxScore: 84, remark: 'Merit' },
    { grade: 'C', points: 2, minScore: 55, maxScore: 69, remark: 'Pass' },
    { grade: 'D', points: 1, minScore: 40, maxScore: 54, remark: 'Marginal Fail' },
    { grade: 'F', points: 0, minScore: 0, maxScore: 39, remark: 'Fail' },
  ];

  private universityGradingScales = [
    { grade: 'A+', points: 4.5, minScore: 90, maxScore: 100, remark: 'Exceptional' },
    { grade: 'A', points: 4, minScore: 80, maxScore: 89, remark: 'Excellent' },
    { grade: 'B+', points: 3.5, minScore: 75, maxScore: 79, remark: 'Very Good' },
    { grade: 'B', points: 3, minScore: 70, maxScore: 74, remark: 'Good' },
    { grade: 'C+', points: 2.5, minScore: 65, maxScore: 69, remark: 'Above Average' },
    { grade: 'C', points: 2, minScore: 60, maxScore: 64, remark: 'Average' },
    { grade: 'D+', points: 1.5, minScore: 55, maxScore: 59, remark: 'Below Average' },
    { grade: 'D', points: 1, minScore: 50, maxScore: 54, remark: 'Marginal' },
    { grade: 'F', points: 0, minScore: 0, maxScore: 49, remark: 'Fail' },
  ];

  async seedDefaultGradingSystems(schoolId: string) {
    await this.ensureGradingSystem(schoolId, 'Primary Grading System', this.primaryGradingScales, true);
    await this.ensureGradingSystem(schoolId, 'ECZ Grade 7 Grading System', this.grade7EczScales, false);
    await this.ensureGradingSystem(schoolId, 'ECZ Secondary Grading System', this.secondaryEczScales, false);
    await this.ensureGradingSystem(schoolId, 'ECZ Forms Grading System', this.formsGradingScales, false);
    await this.ensureGradingSystem(schoolId, 'College GPA Grading System', this.collegeGradingScales, false);
    await this.ensureGradingSystem(schoolId, 'University CGPA Grading System', this.universityGradingScales, false);
  }

  async seedG7GradingPolicy(schoolId: string) {
    const existing = await this.prisma.gradingPolicy.findFirst({
      where: { schoolId, code: 'ECZ_G7' },
    });
    if (existing) return;
      await this.prisma.gradingPolicy.create({
      data: {
        schoolId,
        name: 'ECZ Grade 7 National Examination Grading',
        code: 'ECZ_G7',
        type: 'ECZ_ZAMBIA',
        isDefault: false,
        active: true,
        scales: {
          create: [
            { minScore: 75, maxScore: 100, grade: 'One', remark: 'Excellent', points: 1, gpa: 5.0, sortOrder: 1 },
            { minScore: 60, maxScore: 74, grade: 'Two', remark: 'Very Good', points: 2, gpa: 4.0, sortOrder: 2 },
            { minScore: 50, maxScore: 59, grade: 'Three', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
            { minScore: 40, maxScore: 49, grade: 'Four', remark: 'Satisfactory', points: 4, gpa: 2.0, sortOrder: 4 },
            { minScore: 0, maxScore: 39, grade: 'Five', remark: 'Fail', points: 5, gpa: 0, sortOrder: 5 },
          ],
        },
      },
    });
    this.logger.log(`ECZ_G7 grading policy created for school ${schoolId}`);
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
