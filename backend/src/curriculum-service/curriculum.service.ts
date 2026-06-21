import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EducationLevelCategory, CurriculumStatus, SubjectCategory, PathwayType } from '@prisma/client';

@Injectable()
export class CurriculumService {
  constructor(private prisma: PrismaService) {}

  // ===================== EDUCATION LEVELS =====================

  async createEducationLevel(data: {
    name: string;
    code: EducationLevelCategory;
    description?: string;
    schoolId?: string;
  }) {
    return this.prisma.educationLevel.create({ data });
  }

  async getEducationLevels(schoolId?: string) {
    const where = schoolId ? { OR: [{ schoolId }, { schoolId: null }] } : {};
    return this.prisma.educationLevel.findMany({
      where,
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { code: 'asc' },
    });
  }

  async getEducationLevel(id: string) {
    const level = await this.prisma.educationLevel.findUnique({
      where: { id },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!level) throw new NotFoundException('Education level not found');
    return level;
  }

  async updateEducationLevel(id: string, data: any) {
    return this.prisma.educationLevel.update({ where: { id }, data });
  }

  async deleteEducationLevel(id: string) {
    return this.prisma.educationLevel.delete({ where: { id } });
  }

  // ===================== CURRICULUM VERSIONS =====================

  async createCurriculumVersion(data: {
    name: string;
    code: string;
    description?: string;
    educationLevelId: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    isCurrent?: boolean;
    schoolId?: string;
  }) {
    if (data.isCurrent) {
      await this.prisma.curriculumVersion.updateMany({
        where: { educationLevelId: data.educationLevelId, schoolId: data.schoolId || null, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    return this.prisma.curriculumVersion.create({
      data: {
        ...data,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        status: data.isCurrent ? 'CURRENT' as CurriculumStatus : 'DRAFT' as CurriculumStatus,
      },
      include: { educationLevel: true, stages: true },
    });
  }

  async getCurriculumVersions(educationLevelId?: string, schoolId?: string) {
    const where: any = {};
    if (educationLevelId) where.educationLevelId = educationLevelId;
    if (schoolId) where.OR = [{ schoolId }, { schoolId: null }];
    return this.prisma.curriculumVersion.findMany({
      where,
      include: { educationLevel: true, stages: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ isCurrent: 'desc' }, { effectiveFrom: 'desc' }],
    });
  }

  async getCurriculumVersion(id: string) {
    const version = await this.prisma.curriculumVersion.findUnique({
      where: { id },
      include: { educationLevel: true, stages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!version) throw new NotFoundException('Curriculum version not found');
    return version;
  }

  async updateCurriculumVersion(id: string, data: any) {
    if (data.isCurrent) {
      const version = await this.prisma.curriculumVersion.findUnique({ where: { id } });
      if (version) {
        await this.prisma.curriculumVersion.updateMany({
          where: { educationLevelId: version.educationLevelId, id: { not: id } },
          data: { isCurrent: false },
        });
      }
    }
    return this.prisma.curriculumVersion.update({
      where: { id },
      data: {
        ...data,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
      },
      include: { educationLevel: true, stages: true },
    });
  }

  async deleteCurriculumVersion(id: string) {
    return this.prisma.curriculumVersion.delete({ where: { id } });
  }

  // ===================== ACADEMIC STAGES =====================

  async createAcademicStage(data: {
    name: string;
    code: string;
    sortOrder: number;
    educationLevelId: string;
    curriculumVersionId?: string;
    schoolId?: string;
  }) {
    return this.prisma.academicStage.create({ data });
  }

  async getAcademicStages(educationLevelId?: string, curriculumVersionId?: string, schoolId?: string) {
    const where: any = {};
    if (educationLevelId) where.educationLevelId = educationLevelId;
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    if (schoolId) where.OR = [{ schoolId }, { schoolId: null }];
    return this.prisma.academicStage.findMany({
      where,
      include: { educationLevel: true, curriculumVersion: true, examStructures: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getAcademicStage(id: string) {
    const stage = await this.prisma.academicStage.findUnique({
      where: { id },
      include: { educationLevel: true, curriculumVersion: true, examStructures: true },
    });
    if (!stage) throw new NotFoundException('Academic stage not found');
    return stage;
  }

  async updateAcademicStage(id: string, data: any) {
    return this.prisma.academicStage.update({ where: { id }, data });
  }

  async deleteAcademicStage(id: string) {
    return this.prisma.academicStage.delete({ where: { id } });
  }

  // ===================== SUBJECT GROUPS =====================

  async createSubjectGroup(data: {
    name: string;
    code: string;
    description?: string;
    category: SubjectCategory;
    curriculumVersionId?: string;
    minSelection?: number;
    maxSelection?: number;
    schoolId?: string;
  }) {
    return this.prisma.subjectGroup.create({ data });
  }

  async getSubjectGroups(curriculumVersionId?: string, schoolId?: string) {
    const where: any = {};
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    if (schoolId) where.OR = [{ schoolId }, { schoolId: null }];
    return this.prisma.subjectGroup.findMany({
      where,
      include: {
        subjectGroupSubjects: {
          include: { subject: true },
          orderBy: { sortOrder: 'asc' },
        },
        subjectCombinationRules: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async assignSubjectToGroup(data: {
    subjectGroupId: string;
    subjectId: string;
    isCompulsory?: boolean;
    sortOrder?: number;
    schoolId?: string;
  }) {
    return this.prisma.subjectGroupSubject.create({ data });
  }

  async removeSubjectFromGroup(subjectGroupId: string, subjectId: string) {
    return this.prisma.subjectGroupSubject.delete({
      where: { subjectGroupId_subjectId: { subjectGroupId, subjectId } },
    });
  }

  // ===================== SUBJECT COMBINATION RULES =====================

  async createSubjectCombinationRule(data: {
    name: string;
    code: string;
    description?: string;
    subjectGroupId: string;
    includedSubjects: string[];
    allowedAlternatives?: string[];
    schoolId?: string;
  }) {
    return this.prisma.subjectCombinationRule.create({ data });
  }

  async getSubjectCombinationRules(subjectGroupId?: string, schoolId?: string) {
    const where: any = {};
    if (subjectGroupId) where.subjectGroupId = subjectGroupId;
    return this.prisma.subjectCombinationRule.findMany({ where, orderBy: { name: 'asc' } });
  }

  // ===================== SUBJECT CONVERSION RULES =====================

  async createConversionRule(data: {
    name: string;
    subjectId: string;
    actualMaxScore?: number;
    standardizedMax?: number;
    conversionMultiplier?: number;
    conversionFormula?: string;
    effectiveYear?: number;
    curriculumVersionId?: string;
    schoolId?: string;
  }) {
    return this.prisma.subjectConversionRule.create({ data });
  }

  async getConversionRules(subjectId?: string, curriculumVersionId?: string) {
    const where: any = {};
    if (subjectId) where.subjectId = subjectId;
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    return this.prisma.subjectConversionRule.findMany({
      where,
      include: { subject: true, curriculumVersion: true },
      orderBy: { effectiveYear: 'desc' },
    });
  }

  async updateConversionRule(id: string, data: any) {
    return this.prisma.subjectConversionRule.update({ where: { id }, data });
  }

  async deleteConversionRule(id: string) {
    return this.prisma.subjectConversionRule.delete({ where: { id } });
  }

  // ===================== DIVISION RULES =====================

  async createDivisionRule(data: {
    name: string;
    code: string;
    division: string;
    minScore: number;
    maxScore: number;
    description?: string;
    label?: string;
    color?: string;
    curriculumVersionId?: string;
    examStructureId?: string;
    schoolId?: string;
    sortOrder?: number;
  }) {
    return this.prisma.divisionRule.create({ data });
  }

  async getDivisionRules(curriculumVersionId?: string, examStructureId?: string) {
    const where: any = {};
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    if (examStructureId) where.examStructureId = examStructureId;
    return this.prisma.divisionRule.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateDivisionRule(id: string, data: any) {
    return this.prisma.divisionRule.update({ where: { id }, data });
  }

  // ===================== PERFORMANCE CATEGORIES =====================

  async createPerformanceCategory(data: {
    name: string;
    label: string;
    labelLocal?: string;
    minScore?: number;
    maxScore?: number;
    description?: string;
    color?: string;
    curriculumVersionId?: string;
    schoolId?: string;
    sortOrder?: number;
  }) {
    return this.prisma.performanceCategory.create({ data });
  }

  async getPerformanceCategories(curriculumVersionId?: string) {
    const where: any = {};
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    return this.prisma.performanceCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ===================== EXAM STRUCTURES =====================

  async createExamStructure(data: {
    name: string;
    code: string;
    description?: string;
    academicStageId: string;
    curriculumVersionId?: string;
    totalMarks?: number;
    passMark?: number;
    duration?: number;
    schoolId?: string;
  }) {
    return this.prisma.examStructure.create({ data });
  }

  async getExamStructures(academicStageId?: string, curriculumVersionId?: string) {
    const where: any = {};
    if (academicStageId) where.academicStageId = academicStageId;
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    return this.prisma.examStructure.findMany({
      where,
      include: {
        academicStage: true,
        components: { orderBy: { sortOrder: 'asc' } },
        divisionRules: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getExamStructure(id: string) {
    const structure = await this.prisma.examStructure.findUnique({
      where: { id },
      include: {
        academicStage: true,
        components: { orderBy: { sortOrder: 'asc' } },
        divisionRules: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!structure) throw new NotFoundException('Exam structure not found');
    return structure;
  }

  async updateExamStructure(id: string, data: any) {
    return this.prisma.examStructure.update({ where: { id }, data });
  }

  async deleteExamStructure(id: string) {
    return this.prisma.examStructure.delete({ where: { id } });
  }

  // ===================== EXAM COMPONENTS =====================

  async createExamComponent(data: {
    name: string;
    code: string;
    description?: string;
    examStructureId: string;
    maxScore: number;
    weight?: number;
    sortOrder?: number;
    isGroupComponent?: boolean;
    groupId?: string;
    schoolId?: string;
  }) {
    return this.prisma.examComponent.create({ data });
  }

  async getExamComponents(examStructureId: string) {
    return this.prisma.examComponent.findMany({
      where: { examStructureId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateExamComponent(id: string, data: any) {
    return this.prisma.examComponent.update({ where: { id }, data });
  }

  async deleteExamComponent(id: string) {
    return this.prisma.examComponent.delete({ where: { id } });
  }

  // ===================== BEST SUBJECT SELECTION RULES =====================

  async createBestSubjectRule(data: {
    name: string;
    code: string;
    description?: string;
    count?: number;
    mustIncludeSubjectIds: string[];
    excludeSubjectIds?: string[];
    priorityGroupIds?: string[];
    curriculumVersionId?: string;
    examStructureId?: string;
    schoolId?: string;
  }) {
    return this.prisma.bestSubjectSelectionRule.create({ data });
  }

  async getBestSubjectRules(curriculumVersionId?: string) {
    const where: any = {};
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    return this.prisma.bestSubjectSelectionRule.findMany({ where });
  }

  // ===================== CERTIFICATION RULES =====================

  async createCertificationRule(data: {
    name: string;
    code: string;
    description?: string;
    minSubjects?: number;
    maxFailingSubjects?: number;
    minPassScore?: number;
    mustIncludeSubjectIds: string[];
    minTotalScore?: number;
    maxTotalScore?: number;
    curriculumVersionId?: string;
    examStructureId?: string;
    schoolId?: string;
  }) {
    return this.prisma.certificationRule.create({ data });
  }

  async getCertificationRules(curriculumVersionId?: string) {
    const where: any = {};
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    return this.prisma.certificationRule.findMany({ where });
  }

  // ===================== PROMOTION RULES =====================

  async createPromotionRule(data: {
    name: string;
    code: string;
    description?: string;
    fromStageId?: string;
    toStageId?: string;
    minAverageScore?: number;
    maxFailingSubjects?: number;
    mustPassSubjectIds: string[];
    curriculumVersionId?: string;
    schoolId?: string;
  }) {
    return this.prisma.promotionRule.create({ data });
  }

  async getPromotionRules(curriculumVersionId?: string) {
    const where: any = {};
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    return this.prisma.promotionRule.findMany({
      where,
      include: { fromStage: true, toStage: true },
    });
  }

  // ===================== PATHWAY RULES =====================

  async createPathwayRule(data: {
    name: string;
    code: string;
    description?: string;
    pathwayType: PathwayType;
    entryStageId?: string;
    exitStageId?: string;
    minEntryScore?: number;
    recommendedSubjects?: string[];
    compulsorySubjects?: string[];
    curriculumVersionId?: string;
    schoolId?: string;
  }) {
    return this.prisma.pathwayRule.create({ data });
  }

  async getPathwayRules(curriculumVersionId?: string) {
    const where: any = {};
    if (curriculumVersionId) where.curriculumVersionId = curriculumVersionId;
    return this.prisma.pathwayRule.findMany({
      where,
      include: { entryStage: true, exitStage: true },
    });
  }

  // ===================== SCHOOL CURRICULUM MAPPING =====================

  async setSchoolEducationLevels(schoolId: string, levelIds: string[]) {
    await this.prisma.schoolEducationLevel.deleteMany({ where: { schoolId } });
    return this.prisma.schoolEducationLevel.createMany({
      data: levelIds.map((educationLevelId) => ({ schoolId, educationLevelId })),
    });
  }

  async getSchoolEducationLevels(schoolId: string) {
    return this.prisma.schoolEducationLevel.findMany({
      where: { schoolId, isActive: true },
      include: {
        educationLevel: {
          include: { stages: { orderBy: { sortOrder: 'asc' } } },
        },
        curriculumVersion: true,
      },
    });
  }

  async setSchoolCurriculum(schoolId: string, curriculumVersionId: string) {
    await this.prisma.schoolCurriculum.create({ data: { schoolId, curriculumVersionId, isActive: true } });
  }

  async getSchoolCurricula(schoolId: string) {
    return this.prisma.schoolCurriculum.findMany({
      where: { schoolId },
      include: { curriculumVersion: { include: { educationLevel: true } } },
    });
  }

  // ===================== UTILITY METHODS =====================

  async getFullCurriculumTree(schoolId?: string) {
    const where = schoolId ? {} : {};
    return this.prisma.educationLevel.findMany({
      where,
      include: {
        stages: {
          include: {
            curriculumVersion: true,
            examStructures: {
              include: {
                components: { orderBy: { sortOrder: 'asc' } },
                divisionRules: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        curricula: {
          include: {
            stages: { orderBy: { sortOrder: 'asc' } },
            subjectGroups: {
              include: {
                subjectGroupSubjects: {
                  include: { subject: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });
  }
}
