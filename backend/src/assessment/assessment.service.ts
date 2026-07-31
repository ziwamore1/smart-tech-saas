import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssessmentService {
  constructor(private prisma: PrismaService) {}

  async getAssessmentTypes(schoolId: string, subjectId?: string, termId?: string) {
    const where: any = { schoolId };
    if (subjectId) where.subjectId = subjectId;
    if (termId) where.termId = termId;

    return this.prisma.assessmentType.findMany({
      where,
      include: { subject: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getSubjectWeights(schoolId: string, subjectId: string, termId: string) {
    const types = await this.prisma.assessmentType.findMany({
      where: { schoolId, subjectId, termId },
      select: { id: true, name: true, weight: true, maxScore: true },
    });

    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);

    return {
      types,
      totalWeight,
      isValid: Math.abs(totalWeight - 1.0) < 0.001,
      needsAdjustment: totalWeight !== 1.0,
    };
  }

  async createAssessmentType(
    schoolId: string,
    subjectId: string,
    termId: string,
    name: string,
    maxScore: number,
    weight: number,
  ) {
    console.log('Creating assessment type:', { schoolId, subjectId, termId, name, maxScore, weight, types: typeof weight });
    
    if (weight <= 0 || weight > 1) {
      throw new BadRequestException('Weight must be between 0 and 1');
    }

    if (maxScore <= 0) {
      throw new BadRequestException('Max score must be positive');
    }

    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid term');
    }

    if (term.resultsLocked) {
      throw new ForbiddenException('Cannot modify assessments for locked term');
    }

    const existingTypes = await this.prisma.assessmentType.findMany({
      where: { schoolId, subjectId, termId },
    });

    const currentTotal = existingTypes.reduce((sum, t) => sum + t.weight, 0);
    if (currentTotal + weight > 1.001) {
      throw new BadRequestException(
        `Total weight would exceed 100%. Current: ${(currentTotal * 100).toFixed(1)}%, Adding: ${(weight * 100).toFixed(1)}%`,
      );
    }

    try {
      const result = await this.prisma.assessmentType.create({
        data: {
          schoolId,
          subjectId,
          termId,
          name,
          maxScore,
          weight,
        },
      });
      console.log('Assessment type created:', result);
      return result;
    } catch (error) {
      console.error('Prisma error creating assessment type:', error);
      throw error;
    }
  }

  async createBulkAssessmentTypes(
    schoolId: string,
    subjectId: string,
    termId: string,
    types: Array<{ name: string; maxScore: number; weight: number }>,
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
    });

    if (!term) {
      throw new NotFoundException('Term not found');
    }

    if (term.resultsLocked) {
      throw new ForbiddenException('Cannot modify assessments for locked term');
    }

    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new BadRequestException(
        `Total weight must equal 100%. Got: ${(totalWeight * 100).toFixed(1)}%`,
      );
    }

    const created = await this.prisma.$transaction(
      types.map((t) =>
        this.prisma.assessmentType.create({
          data: {
            schoolId,
            subjectId,
            termId,
            name: t.name,
            maxScore: t.maxScore,
            weight: t.weight,
          },
        }),
      ),
    );

    return { created: created.length, types: created };
  }

  async updateAssessmentType(
    id: string,
    schoolId: string,
    data: { name?: string; maxScore?: number; weight?: number },
  ) {
    const type = await this.prisma.assessmentType.findUnique({
      where: { id },
      include: { term: true },
    });

    if (!type || type.schoolId !== schoolId) {
      throw new NotFoundException('Assessment type not found');
    }

    if (type.term.resultsLocked) {
      throw new ForbiddenException('Cannot modify locked assessments');
    }

    if (data.weight !== undefined && (data.weight <= 0 || data.weight > 1)) {
      throw new BadRequestException('Weight must be between 0 and 1');
    }

    const allTypes = await this.prisma.assessmentType.findMany({
      where: { subjectId: type.subjectId, termId: type.termId },
    });

    const otherTotal = allTypes
      .filter((t) => t.id !== id)
      .reduce((sum, t) => sum + t.weight, 0);

    const newWeight = data.weight ?? type.weight;
    if (otherTotal + newWeight > 1.001) {
      throw new BadRequestException(
        `Total weight would exceed 100%. Other types: ${(otherTotal * 100).toFixed(1)}%`,
      );
    }

    return this.prisma.assessmentType.update({
      where: { id },
      data,
    });
  }

  async deleteAssessmentType(id: string, schoolId: string) {
    const type = await this.prisma.assessmentType.findUnique({
      where: { id },
      include: { term: true },
    });

    if (!type || type.schoolId !== schoolId) {
      throw new NotFoundException('Assessment type not found');
    }

    if (type.term.resultsLocked) {
      throw new ForbiddenException('Cannot delete locked assessments');
    }

    await this.prisma.assessmentScore.deleteMany({
      where: { assessmentTypeId: id },
    });

    await this.prisma.assessmentType.delete({ where: { id } });

    return { message: 'Assessment type deleted' };
  }

  async enterScore(
    studentId: string,
    assessmentTypeId: string,
    teacherId: string,
    schoolId: string,
    score: number,
  ) {
    const assessmentType = await this.prisma.assessmentType.findUnique({
      where: { id: assessmentTypeId },
      include: { term: true },
    });

    if (!assessmentType || assessmentType.schoolId !== schoolId) {
      throw new NotFoundException('Assessment type not found');
    }

    if (assessmentType.term.resultsLocked) {
      throw new ForbiddenException('Cannot enter scores for locked term');
    }

    if (score < 0 || score > assessmentType.maxScore) {
      throw new BadRequestException(
        `Score must be between 0 and ${assessmentType.maxScore}`,
      );
    }

    const record = await this.prisma.assessmentScore.upsert({
      where: {
        studentId_assessmentTypeId: { studentId, assessmentTypeId },
      },
      update: { score, teacherId },
      create: {
        studentId,
        assessmentTypeId,
        teacherId,
        schoolId,
        score,
      },
    });

    await this.aggregateStudentSubjectScore(
      studentId,
      assessmentType.subjectId,
      assessmentType.termId,
      schoolId,
      teacherId,
    );

    return record;
  }

  async enterBulkScores(
    scores: Array<{
      studentId: string;
      assessmentTypeId: string;
      score: number;
    }>,
    teacherId: string,
    schoolId: string,
  ) {
    const results: any[] = [];
    const errors: any[] = [];

    for (const item of scores) {
      try {
        const assessmentType = await this.prisma.assessmentType.findUnique({
          where: { id: item.assessmentTypeId },
          include: { term: true },
        });

        if (!assessmentType || assessmentType.schoolId !== schoolId) {
          errors.push({ ...item, error: 'Assessment type not found' });
          continue;
        }

        if (assessmentType.term.resultsLocked) {
          errors.push({ ...item, error: 'Term is locked' });
          continue;
        }

        const record = await this.prisma.assessmentScore.upsert({
          where: {
            studentId_assessmentTypeId: {
              studentId: item.studentId,
              assessmentTypeId: item.assessmentTypeId,
            },
          },
          update: { score: item.score, teacherId },
          create: {
            studentId: item.studentId,
            assessmentTypeId: item.assessmentTypeId,
            teacherId,
            schoolId,
            score: item.score,
          },
        });

        results.push(record);
      } catch (error: any) {
        errors.push({ ...item, error: error.message });
      }
    }

    for (const item of scores) {
      try {
        const assessmentType = await this.prisma.assessmentType.findUnique({
          where: { id: item.assessmentTypeId },
        });
        if (assessmentType) {
          await this.aggregateStudentSubjectScore(
            item.studentId,
            assessmentType.subjectId,
            assessmentType.termId,
            schoolId,
            teacherId,
          );
        }
      } catch (error) {
        // Ignore aggregation errors
      }
    }

    return { entered: results.length, errors: errors.length > 0 ? errors : undefined };
  }

  async updateScore(id: string, teacherId: string, schoolId: string, score: number) {
    const existing = await this.prisma.assessmentScore.findUnique({
      where: { id },
      include: { assessmentType: { include: { term: true } } },
    });

    if (!existing || existing.schoolId !== schoolId) {
      throw new NotFoundException('Score not found');
    }

    if (existing.assessmentType.term.resultsLocked) {
      throw new ForbiddenException('Cannot update scores for locked term');
    }

    if (score < 0 || score > existing.assessmentType.maxScore) {
      throw new BadRequestException(
        `Score must be between 0 and ${existing.assessmentType.maxScore}`,
      );
    }

    const updated = await this.prisma.assessmentScore.update({
      where: { id },
      data: { score, teacherId },
    });

    await this.aggregateStudentSubjectScore(
      existing.studentId,
      existing.assessmentType.subjectId,
      existing.assessmentType.termId,
      schoolId,
      teacherId,
    );

    return updated;
  }

  async getStudentAssessments(studentId: string, termId: string) {
    return this.prisma.assessmentScore.findMany({
      where: {
        studentId,
        assessmentType: { termId },
      },
      include: { assessmentType: true },
      orderBy: { assessmentType: { createdAt: 'asc' } },
    });
  }

  async aggregateStudentSubjectScore(
    studentId: string,
    subjectId: string,
    termId: string,
    schoolId: string,
    teacherId: string,
  ) {
    const assessments = await this.prisma.assessmentScore.findMany({
      where: {
        studentId,
        assessmentType: { subjectId, termId },
      },
      include: { assessmentType: true },
    });

    if (assessments.length === 0) {
      await this.prisma.result.deleteMany({
        where: { studentId, subjectId, termId },
      });
      return { message: 'No assessments found, result cleared' };
    }

    const allTypes = await this.prisma.assessmentType.findMany({
      where: { subjectId, termId },
    });

    const hasAllAssessments = allTypes.every((type) =>
      assessments.some((s) => s.assessmentTypeId === type.id),
    );

    if (!hasAllAssessments) {
      return { message: 'Waiting for more assessments' };
    }

    let totalWeightedScore = 0;

    for (const a of assessments) {
      const normalizedScore = (a.score / a.assessmentType.maxScore) * 100;
      totalWeightedScore += normalizedScore * a.assessmentType.weight;
    }

    const finalScore = Math.round(totalWeightedScore * 100) / 100;

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      select: { classId: true },
    });

    const gradeData = await this.calculateGrade(finalScore, schoolId, enrollment?.classId);

    const result = await this.prisma.result.upsert({
      where: {
        studentId_subjectId_termId: { studentId, subjectId, termId },
      },
      update: {
        score: finalScore,
        grade: gradeData.grade,
        remark: gradeData.remark,
        teacherId,
      },
      create: {
        studentId,
        subjectId,
        termId,
        teacherId,
        schoolId,
        score: finalScore,
        grade: gradeData.grade,
        remark: gradeData.remark,
      },
    });

    return result;
  }

  async computeAllClassResults(
    classId: string,
    subjectId: string,
    termId: string,
    schoolId: string,
    teacherId: string,
  ) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYear: {
          terms: { some: { id: termId } },
        },
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      select: { studentId: true },
    });

    const results: any[] = [];
    for (const enrollment of enrollments) {
      try {
        const result = await this.aggregateStudentSubjectScore(
          enrollment.studentId,
          subjectId,
          termId,
          schoolId,
          teacherId,
        );
        results.push({ studentId: enrollment.studentId, ...result });
      } catch (error: any) {
        results.push({ studentId: enrollment.studentId, error: error.message });
      }
    }

    return { computed: results.length, results };
  }

  private async calculateGrade(score: number, schoolId: string, classId?: string) {
    const codeToName: Record<string, string> = {
      PRIMARY_ECZ: 'Primary Grading System',
      GRADE7_ECZ: 'ECZ Grade 7 Grading System',
      SECONDARY_ECZ: 'ECZ Secondary Grading System',
      FORMS_ECZ: 'ECZ Forms Grading System',
      ADVANCED_A_LEVEL: 'ECZ Secondary Grading System',
      COLLEGE_GPA: 'College GPA Grading System',
      UNIVERSITY_CGPA: 'University CGPA Grading System',
    };

    let gradingSystem: any;

    if (classId) {
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
        select: { gradingSystemId: true },
      });
      if (cls?.gradingSystemId) {
        gradingSystem = await this.prisma.gradingSystem.findUnique({
          where: { id: cls.gradingSystemId },
          include: { gradeScales: true },
        });
      }
    }

    if (!gradingSystem) {
      const schoolSetting = await this.prisma.schoolSetting.findUnique({
        where: { schoolId },
      });
      const preferredName = schoolSetting?.gradingSystem
        ? codeToName[schoolSetting.gradingSystem]
        : undefined;
      gradingSystem = preferredName
        ? await this.prisma.gradingSystem.findFirst({
            where: { schoolId, name: preferredName },
            include: { gradeScales: true },
          })
        : undefined;
    }

    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId, isDefault: true },
        include: { gradeScales: true },
      });
    }

    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId },
        include: { gradeScales: true },
      });
    }

    if (!gradingSystem) {
      return { grade: 'N/A', remark: 'No grading system' };
    }

    const scale = gradingSystem.gradeScales.find(
      (s) => score >= s.minScore && score <= s.maxScore,
    );

    return {
      grade: scale?.grade || 'N/A',
      remark: scale?.remark || '',
    };
  }

  async getClassAssessmentDashboard(
    classId: string,
    subjectId: string,
    termId: string,
  ) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYear: {
          terms: { some: { id: termId } },
        },
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      include: { student: true },
    });

    const assessments = await this.prisma.assessmentType.findMany({
      where: { subjectId, termId },
      orderBy: { createdAt: 'asc' },
    });

    const scores = await this.prisma.assessmentScore.findMany({
      where: {
        assessmentType: { subjectId, termId },
        studentId: { in: enrollments.map((e) => e.studentId) },
      },
    });

    const scoreMap = new Map<string, number>();
    for (const s of scores) {
      scoreMap.set(`${s.studentId}_${s.assessmentTypeId}`, s.score);
    }

    const students = enrollments.map((e) => {
      const studentScores = assessments.map((a) => {
        const key = `${e.studentId}_${a.id}`;
        const score = scoreMap.get(key) ?? null;

        return {
          assessmentId: a.id,
          assessmentName: a.name,
          score,
          maxScore: a.maxScore,
          weight: a.weight,
          missing: score === null,
        };
      });

      const submittedCount = studentScores.filter((s) => !s.missing).length;

      return {
        studentId: e.studentId,
        studentName: `${e.student.firstName} ${e.student.lastName}`,
        submittedAssessments: submittedCount,
        totalAssessments: assessments.length,
        scores: studentScores,
      };
    });

    const assessmentStats = assessments.map((a) => {
      const typeScores = scores.filter((s) => s.assessmentTypeId === a.id);
      const avg =
        typeScores.length > 0
          ? typeScores.reduce((sum, s) => sum + s.score, 0) / typeScores.length
          : null;

      return {
        assessmentId: a.id,
        assessmentName: a.name,
        classAverage: avg !== null ? Math.round(avg * 100) / 100 : null,
        submissions: typeScores.length,
        totalStudents: enrollments.length,
      };
    });

    return { assessments, assessmentStats, students };
  }

  async getTeacherPerformanceHeatmap(
    classId: string,
    subjectId: string,
    termId: string,
  ) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYear: {
          terms: { some: { id: termId } },
        },
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      include: { student: true },
    });

    const results = await this.prisma.result.findMany({
      where: {
        subjectId,
        termId,
        studentId: { in: enrollments.map((e) => e.studentId) },
      },
    });

    return enrollments.map((e) => {
      const result = results.find((r) => r.studentId === e.studentId);
      const score = result?.score ?? null;

      let status = 'NO DATA';
      if (score !== null) {
        if (score < 40) status = 'FAIL';
        else if (score < 60) status = 'PASS';
        else if (score < 75) status = 'GOOD';
        else status = 'EXCELLENT';
      }

      return {
        studentId: e.studentId,
        studentName: `${e.student.firstName} ${e.student.lastName}`,
        score,
        grade: result?.grade ?? null,
        status,
      };
    });
  }
}
