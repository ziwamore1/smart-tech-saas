import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompositeSubjectService {
  private readonly logger = new Logger(CompositeSubjectService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    code: string;
    curriculumId: string;
    calculationMethod?: string;
    schoolId?: string;
    components: { subjectId: string; weight: number }[];
  }) {
    const existing = await this.prisma.compositeSubject.findUnique({
      where: { code_curriculumId: { code: data.code, curriculumId: data.curriculumId } },
    });
    if (existing) {
      throw new ConflictException(`Composite subject with code "${data.code}" already exists in this curriculum`);
    }

    return this.prisma.compositeSubject.create({
      data: {
        name: data.name,
        code: data.code,
        curriculumId: data.curriculumId,
        calculationMethod: data.calculationMethod || 'WEIGHTED_AVERAGE',
        schoolId: data.schoolId,
        components: {
          create: data.components.map(c => ({
            subjectId: c.subjectId,
            weight: c.weight,
          })),
        },
      },
      include: {
        components: {
          include: { subject: true },
        },
        curriculum: true,
      },
    });
  }

  async findAll(filters: { curriculumId?: string; schoolId?: string; isActive?: boolean }) {
    const where: any = {};
    if (filters.curriculumId) where.curriculumId = filters.curriculumId;
    if (filters.schoolId) where.schoolId = filters.schoolId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return this.prisma.compositeSubject.findMany({
      where,
      include: {
        components: {
          include: { subject: true },
          orderBy: { weight: 'desc' },
        },
        curriculum: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const composite = await this.prisma.compositeSubject.findUnique({
      where: { id },
      include: {
        components: {
          include: { subject: true },
          orderBy: { weight: 'desc' },
        },
        curriculum: true,
      },
    });
    if (!composite) throw new NotFoundException('Composite subject not found');
    return composite;
  }

  async update(id: string, data: {
    name?: string;
    code?: string;
    calculationMethod?: string;
    isActive?: boolean;
    components?: { subjectId: string; weight: number }[];
  }) {
    const existing = await this.prisma.compositeSubject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Composite subject not found');

    if (data.code && data.code !== existing.code) {
      const duplicate = await this.prisma.compositeSubject.findUnique({
        where: { code_curriculumId: { code: data.code, curriculumId: existing.curriculumId } },
      });
      if (duplicate) throw new ConflictException('Code already exists in this curriculum');
    }

    if (data.components) {
      await this.prisma.compositeSubjectComponent.deleteMany({ where: { compositeSubjectId: id } });
      await this.prisma.compositeSubjectComponent.createMany({
        data: data.components.map(c => ({
          compositeSubjectId: id,
          subjectId: c.subjectId,
          weight: c.weight,
        })),
      });
    }

    return this.prisma.compositeSubject.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
        ...(data.calculationMethod && { calculationMethod: data.calculationMethod }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        components: {
          include: { subject: true },
          orderBy: { weight: 'desc' },
        },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.compositeSubject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Composite subject not found');
    await this.prisma.compositeSubject.delete({ where: { id } });
    return { deleted: true };
  }

  async computeCompositeForStudent(
    compositeSubjectId: string,
    studentId: string,
    termId: string,
    classId: string,
    schoolId: string,
  ) {
    const composite = await this.prisma.compositeSubject.findUnique({
      where: { id: compositeSubjectId },
      include: { components: true },
    });
    if (!composite) throw new NotFoundException('Composite subject not found');

    let totalWeighted = 0;
    let totalWeight = 0;
    const componentResults: { subjectId: string; subjectName: string; percentage: number | null; weight: number }[] = [];

    for (const component of composite.components) {
      const computed = await this.prisma.computedResult.findUnique({
        where: {
          studentId_subjectId_termId: {
            studentId,
            subjectId: component.subjectId,
            termId,
          },
        },
        include: { subject: true },
      });

      componentResults.push({
        subjectId: component.subjectId,
        subjectName: computed?.subject?.name || component.subjectId,
        percentage: computed?.finalPercentage ?? null,
        weight: component.weight,
      });

      if (computed?.finalPercentage != null) {
        totalWeighted += computed.finalPercentage * component.weight;
        totalWeight += component.weight;
      }
    }

    if (totalWeight === 0) {
      return { composite, finalPercentage: null, finalGrade: null, components: componentResults };
    }

    const finalPct = parseFloat((totalWeighted / totalWeight).toFixed(2));
    const finalGrade = await this.computeGrade(finalPct, classId, compositeSubjectId, termId, schoolId);

    return {
      composite: { id: composite.id, name: composite.name, code: composite.code },
      finalPercentage: finalPct,
      finalGrade,
      components: componentResults,
    };
  }

  async recomputeAllComposites(
    componentSubjectId: string,
    classId: string,
    termId: string,
    schoolId: string,
  ) {
    const composites = await this.prisma.compositeSubject.findMany({
      where: {
        isActive: true,
        components: { some: { subjectId: componentSubjectId } },
      },
      include: { components: true },
    });

    if (composites.length === 0) return [];

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, academicYear: { terms: { some: { id: termId } } }, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const results: any[] = [];
    for (const composite of composites) {
      for (const enrollment of enrollments) {
        const result = await this.computeCompositeForStudent(
          composite.id,
          enrollment.studentId,
          termId,
          classId,
          schoolId,
        );
        if (result) results.push(result);
      }
    }
    return results;
  }

  async findEnrollments(classId: string, termId: string) {
    return this.prisma.enrollment.findMany({
      where: { classId, academicYear: { terms: { some: { id: termId } } }, status: 'ACTIVE' },
      select: { studentId: true },
    });
  }

  async getCompositeResultsForStudent(studentId: string, termId: string, classId: string, schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        schoolCurricula: {
          where: { isActive: true },
          include: {
            curriculumVersion: {
              include: {
                compositeSubjects: {
                  where: { isActive: true },
                  include: { components: { include: { subject: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!school) return [];

    const results: any[] = [];
    for (const sc of school.schoolCurricula) {
      for (const composite of sc.curriculumVersion.compositeSubjects) {
        const computed = await this.computeCompositeForStudent(
          composite.id, studentId, termId, classId, schoolId,
        );
        if (computed) results.push(computed);
      }
    }
    return results;
  }

  private async computeGrade(
    percentage: number,
    classId: string,
    subjectId: string,
    termId: string,
    schoolId: string,
  ): Promise<string | null> {
    try {
      const config = await this.prisma.termAssessmentConfiguration.findFirst({
        where: { classId, subjectId, termId },
      });

      const maxScore = config?.maxScore || 100;
      const rawScore = (percentage / 100) * maxScore;

      const policies = await this.prisma.gradingPolicy.findMany({
        where: { schoolId, isActive: true },
        orderBy: { minPercentage: 'desc' },
      });

      for (const policy of policies) {
        if (percentage >= policy.minPercentage) return policy.grade;
      }
      return null;
    } catch {
      return null;
    }
  }
}
