import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
import { SocketGateway } from '../messaging/socket.gateway';
import { CompositeSubjectService } from '../composite-subject/composite-subject.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';
import { normalizeExamType } from '../common/utils/exam-type.util';

export interface CreateAssessmentDefinitionDto {
  name: string;
  code: string;
  category?: string;
  examType?: string;
  description?: string;
  defaultMaxScore?: number;
  defaultWeight?: number;
  contributesToFinal?: boolean;
  termBased?: boolean;
  sortOrder?: number;
  active?: boolean;
}

export interface ConfigureTermAssessmentDto {
  classId: string;
  subjectId: string;
  termId: string;
  configurations: {
    assessmentDefId: string;
    maxScore: number;
    weightPercentage: number;
    mandatory?: boolean;
    sequenceOrder?: number;
    allowHalfMarks?: boolean;
    allowNegative?: boolean;
    decimalPlaces?: number;
  }[];
}

export interface BulkScoreEntryDto {
  batchId?: string;
  classId: string;
  subjectId: string;
  termId: string;
  assessmentDefId: string;
  title?: string;
  description?: string;
  maxScore: number;
  scores: {
    studentId: string;
    rawScore: number | null;
    isAbsent?: boolean;
    absentCode?: 'X' | 'A';
    remarks?: string;
  }[];
  enteredBy: string;
}

export interface ScoreEntryDto {
  studentId: string;
  subjectId: string;
  termId: string;
  classId: string;
  assessmentDefId: string;
  rawScore: number | null;
  isAbsent?: boolean;
  absentCode?: 'X' | 'A';
  maxScore?: number;
  remarks?: string;
  enteredBy: string;
}

@Injectable()
export class AssessmentEngineService {
  private readonly logger = new Logger(AssessmentEngineService.name);

  constructor(
    private prisma: PrismaService,
    private gradingEngine: GradingEngineService,
    private socketGateway: SocketGateway,
    private compositeSubjectService: CompositeSubjectService,
    @Optional() private schoolEvents?: SchoolEventsGateway,
  ) {}

  private async emitLiveResult(schoolId: string, data: { classId: string; subjectId: string; termId: string; studentId?: string; score?: number | null; enteredBy?: string }) {
    const [teacher, subject, classEntity] = await Promise.all([
      data.enteredBy ? this.prisma.user.findUnique({ where: { id: data.enteredBy }, select: { id: true, firstName: true, lastName: true } }) : null,
      this.prisma.subject.findUnique({ where: { id: data.subjectId }, select: { id: true, name: true, code: true } }),
      this.prisma.class.findUnique({ where: { id: data.classId }, select: { id: true, name: true } }),
    ]);
    this.schoolEvents?.emitResultsLive(schoolId, {
      id: `${data.studentId || data.classId}-${data.subjectId}-${Date.now()}`,
      ...data,
      timestamp: new Date(),
      teacher,
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : 'Teacher',
      subject,
      subjectName: subject?.name || 'Subject',
      class: classEntity,
      className: classEntity?.name || 'Class',
    });
  }

  async createAssessmentDefinition(schoolId: string, data: CreateAssessmentDefinitionDto) {
    const existing = await this.prisma.assessmentDefinition.findUnique({
      where: { schoolId_code: { schoolId, code: data.code } },
    });

    if (existing) {
      throw new BadRequestException(`Assessment definition with code "${data.code}" already exists`);
    }

    return this.prisma.assessmentDefinition.create({
      data: {
        schoolId,
        name: data.name,
        code: data.code,
        category: data.category || 'continuous',
        examType: data.examType as any || undefined,
        description: data.description,
        defaultMaxScore: data.defaultMaxScore || 100,
        defaultWeight: data.defaultWeight || 0,
        contributesToFinal: data.contributesToFinal ?? true,
        termBased: data.termBased ?? true,
        sortOrder: data.sortOrder || 0,
      },
    });
  }

  async getAssessmentDefinitions(schoolId: string, activeOnly = true) {
    return this.prisma.assessmentDefinition.findMany({
      where: {
        schoolId,
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateAssessmentDefinition(id: string, data: Partial<CreateAssessmentDefinitionDto>) {
    const existing = await this.prisma.assessmentDefinition.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assessment definition not found');
    }

    return this.prisma.assessmentDefinition.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.examType !== undefined && { examType: data.examType as any || null }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.defaultMaxScore !== undefined && { defaultMaxScore: data.defaultMaxScore }),
        ...(data.defaultWeight !== undefined && { defaultWeight: data.defaultWeight }),
        ...(data.contributesToFinal !== undefined && { contributesToFinal: data.contributesToFinal }),
        ...(data.termBased !== undefined && { termBased: data.termBased }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
  }

  async deleteAssessmentDefinition(id: string) {
    const existing = await this.prisma.assessmentDefinition.findUnique({
      where: { id },
      include: { configurations: true },
    });

    if (!existing) {
      throw new NotFoundException('Assessment definition not found');
    }

    if (existing.configurations.length > 0) {
      throw new BadRequestException('Cannot delete assessment definition with active configurations');
    }

    return this.prisma.assessmentDefinition.delete({ where: { id } });
  }

  async configureTermAssessment(schoolId: string, data: ConfigureTermAssessmentDto) {
    const { classId, subjectId, termId, configurations } = data;

    const classExists = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true },
    });

    if (!classExists || classExists.schoolId !== schoolId) {
      throw new NotFoundException('Class not found or access denied');
    }

    const termExists = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: { select: { schoolId: true } } },
    });

    if (!termExists || termExists.academicYear.schoolId !== schoolId) {
      throw new NotFoundException('Term not found or access denied');
    }

    const results = [];

    for (const config of configurations) {
      const assessmentDef = await this.prisma.assessmentDefinition.findUnique({
        where: { id: config.assessmentDefId },
        select: { schoolId: true },
      });

      if (!assessmentDef || assessmentDef.schoolId !== schoolId) {
        throw new NotFoundException(`Assessment definition "${config.assessmentDefId}" not found`);
      }

      const result = await this.prisma.termAssessmentConfiguration.upsert({
        where: {
          classId_subjectId_termId_assessmentDefId: {
            classId,
            subjectId,
            termId,
            assessmentDefId: config.assessmentDefId,
          },
        },
        update: {
          maxScore: config.maxScore,
          weightPercentage: config.weightPercentage,
          mandatory: config.mandatory ?? false,
          sequenceOrder: config.sequenceOrder ?? 0,
          allowHalfMarks: config.allowHalfMarks ?? true,
          allowNegative: config.allowNegative ?? false,
          decimalPlaces: config.decimalPlaces ?? 0,
        },
        create: {
          classId,
          subjectId,
          termId,
          assessmentDefId: config.assessmentDefId,
          maxScore: config.maxScore,
          weightPercentage: config.weightPercentage,
          mandatory: config.mandatory ?? false,
          sequenceOrder: config.sequenceOrder ?? 0,
          allowHalfMarks: config.allowHalfMarks ?? true,
          allowNegative: config.allowNegative ?? false,
          decimalPlaces: config.decimalPlaces ?? 0,
        },
        include: {
          assessmentDef: true,
        },
      });

      results.push(result);
    }

    this.logger.log(`Configured ${results.length} assessment types for class ${classId}, subject ${subjectId}, term ${termId}`);

    return results;
  }

  async getTermAssessmentConfigurations(classId: string, subjectId: string, termId: string) {
    return this.prisma.termAssessmentConfiguration.findMany({
      where: { classId, subjectId, termId },
      include: {
        assessmentDef: true,
      },
      orderBy: { sequenceOrder: 'asc' },
    });
  }

  async updateTermAssessmentConfiguration(
    schoolId: string,
    classId: string,
    subjectId: string,
    termId: string,
    assessmentDefId: string,
    data: { weightPercentage?: number; maxScore?: number; mandatory?: boolean }
  ) {
    const config = await this.prisma.termAssessmentConfiguration.findUnique({
      where: {
        classId_subjectId_termId_assessmentDefId: {
          classId,
          subjectId,
          termId,
          assessmentDefId,
        },
      },
    });

    if (!config) {
      throw new NotFoundException('Configuration not found');
    }

    return this.prisma.termAssessmentConfiguration.update({
      where: {
        classId_subjectId_termId_assessmentDefId: {
          classId,
          subjectId,
          termId,
          assessmentDefId,
        },
      },
      data: {
        ...(data.weightPercentage !== undefined && { weightPercentage: data.weightPercentage }),
        ...(data.maxScore !== undefined && { maxScore: data.maxScore }),
        ...(data.mandatory !== undefined && { mandatory: data.mandatory }),
      },
      include: {
        assessmentDef: true,
      },
    });
  }

  private async syncComputedResult(
    classId: string,
    subjectId: string,
    termId: string,
    schoolId: string,
  ) {
    const configs = await this.prisma.termAssessmentConfiguration.findMany({
      where: { classId, subjectId, termId },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, academicYear: { terms: { some: { id: termId } } }, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      select: { studentId: true },
    });

    for (const enrollment of enrollments) {
      const results = await this.prisma.studentAssessmentResult.findMany({
        where: {
          studentId: enrollment.studentId,
          subjectId,
          termId,
          classId,
          rawScore: { not: null },
        },
      });

      if (configs.length === 0) {
        if (results.length > 0) {
          const totalRaw = results.reduce((s, r) => s + (r.rawScore ?? 0), 0);
          const totalMax = results.reduce((s, r) => s + (r.maxScore ?? 100), 0);
          const pct = totalMax > 0 ? parseFloat(((totalRaw / totalMax) * 100).toFixed(2)) : null;
          const grade = pct != null
            ? await this.gradingEngine.computeGrade(pct, classId, subjectId, termId, schoolId)
            : null;

          await this.prisma.computedResult.upsert({
            where: {
              studentId_subjectId_termId: {
                studentId: enrollment.studentId,
                subjectId,
                termId,
              },
            },
            update: { totalRawScore: totalRaw, finalPercentage: pct, finalGrade: grade, status: 'COMPUTED', computedAt: new Date() },
            create: {
              studentId: enrollment.studentId,
              subjectId, termId, classId, schoolId,
              totalRawScore: totalRaw, finalPercentage: pct, finalGrade: grade, status: 'COMPUTED', computedAt: new Date(),
            },
          });
        }
        continue;
      }

      let totalWeighted = 0;
      let totalWeight = 0;

      for (const config of configs) {
        const result = results.find(r => r.assessmentDefId === config.assessmentDefId);
        if (result?.rawScore != null) {
          const pct = (result.rawScore / (config.maxScore || 100)) * 100;
          totalWeighted += pct * (config.weightPercentage / 100);
          totalWeight += config.weightPercentage;
        }
      }

      const finalPct = totalWeight > 0
        ? parseFloat(((totalWeighted / totalWeight) * 100).toFixed(2))
        : null;

      const finalGrade = finalPct != null
        ? await this.gradingEngine.computeGrade(finalPct, classId, subjectId, termId, schoolId)
        : null;

      const allFilled = configs.every(c => {
        const result = results.find(r => r.assessmentDefId === c.assessmentDefId);
        return result && (result.rawScore != null || result.isAbsent);
      });

      await this.prisma.computedResult.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId: enrollment.studentId,
            subjectId,
            termId,
          },
        },
        update: {
          totalRawScore: results.reduce((s, r) => s + (r.rawScore ?? 0), 0),
          totalWeightedScore: totalWeighted,
          finalPercentage: finalPct,
          finalGrade,
          status: allFilled ? 'COMPUTED' : 'PENDING',
          computedAt: allFilled ? new Date() : null,
        },
        create: {
          studentId: enrollment.studentId,
          subjectId, termId, classId, schoolId,
          totalRawScore: results.reduce((s, r) => s + (r.rawScore ?? 0), 0),
          totalWeightedScore: totalWeighted,
          finalPercentage: finalPct,
          finalGrade,
          status: allFilled ? 'COMPUTED' : 'PENDING',
          computedAt: allFilled ? new Date() : null,
        },
      });
    }
  }

  private async syncResultSheet(
    schoolId: string,
    classId: string,
    termId: string,
    userId: string,
    examType?: string,
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });
    if (!term) return;

    const resolvedExamType = normalizeExamType(examType);

    const sheet = await this.prisma.resultSheet.upsert({
      where: {
        classId_termId_examType: {
          classId,
          termId,
          examType: resolvedExamType,
        },
      },
      update: {},
      create: {
        schoolId,
        classId,
        termId,
        academicYearId: term.academicYearId,
        examType: resolvedExamType,
        createdBy: userId || 'SYSTEM',
        status: 'DRAFT',
        totalStudents: 0,
      },
    });

    const totalStudents = await this.prisma.enrollment.count({
      where: { classId, academicYearId: term.academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
    });

    // Find all assessment definitions matching this exam type
    const matchingDefs = await this.prisma.assessmentDefinition.findMany({
      where: { schoolId, examType: resolvedExamType as any },
      select: { id: true },
    });
    const defIds = matchingDefs.map(d => d.id);

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId },
      select: { subjectId: true },
    });

    const scoredStudents = new Set<string>();
    for (const cs of classSubjects) {
      const results = await this.prisma.studentAssessmentResult.findMany({
        where: {
          classId,
          subjectId: cs.subjectId,
          termId,
          ...(defIds.length > 0 ? { assessmentDefId: { in: defIds } } : {}),
          OR: [
            { rawScore: { not: null } },
            { isAbsent: true },
          ],
        },
        select: { studentId: true },
      });
      results.forEach(r => scoredStudents.add(r.studentId));
    }

    await this.prisma.resultSheet.update({
      where: { id: sheet.id },
      data: {
        totalStudents,
        enteredCount: scoredStudents.size,
      },
    });

    try {
      await this.prisma.resultAuditLog.create({
        data: {
          schoolId,
          action: 'SCORES_UPDATED',
          entityType: 'RESULT_SHEET',
          entityId: sheet.id,
          classId,
          termId,
          performedBy: userId || 'SYSTEM',
          metadata: { scoredStudents: scoredStudents.size, totalStudents },
        },
      });
    } catch { }

    return sheet;
  }

  async bulkEnterScores(schoolId: string, data: BulkScoreEntryDto) {
    const { classId, subjectId, termId, assessmentDefId, maxScore, scores, enteredBy } = data;

    const config = await this.prisma.termAssessmentConfiguration.findUnique({
      where: {
        classId_subjectId_termId_assessmentDefId: {
          classId,
          subjectId,
          termId,
          assessmentDefId,
        },
      },
    });

    const effectiveMaxScore = config?.maxScore || maxScore;
    const decimalPlaces = config?.decimalPlaces ?? 0;
    const allowNegative = config?.allowNegative ?? false;
    const allowHalfMarks = config?.allowHalfMarks ?? true;

    const batch = await this.prisma.assessmentBatch.create({
      data: {
        schoolId,
        classId,
        subjectId,
        termId,
        assessmentDefId,
        title: data.title || `${assessmentDefId} Entry`,
        description: data.description,
        maxScore: effectiveMaxScore,
        totalStudents: scores.length,
        createdBy: enteredBy,
      },
    });

    const results = [];

    for (const scoreEntry of scores) {
      const { rawScore, remarks } = scoreEntry;

      const isAbsent = scoreEntry.isAbsent || scoreEntry.absentCode === 'X' || scoreEntry.absentCode === 'A';

      if (isAbsent) {
        const absentRemarks = scoreEntry.absentCode
          ? `[Absent-${scoreEntry.absentCode}] ${remarks || ''}`.trim()
          : `[Absent] ${remarks || ''}`.trim();

        const result = await this.prisma.studentAssessmentResult.upsert({
          where: {
            studentId_subjectId_termId_assessmentDefId: {
              studentId: scoreEntry.studentId,
              subjectId,
              termId,
              assessmentDefId,
            },
          },
          update: {
            rawScore: null,
            maxScore: effectiveMaxScore,
            weightedScore: null,
            percentage: null,
            grade: null,
            isAbsent: true,
            remarks: absentRemarks || null,
            enteredBy,
            status: 'SUBMITTED',
            batchId: batch.id,
          },
          create: {
            studentId: scoreEntry.studentId,
            subjectId,
            termId,
            classId,
            assessmentDefId,
            rawScore: null,
            maxScore: effectiveMaxScore,
            weightedScore: null,
            percentage: null,
            grade: null,
            isAbsent: true,
            remarks: absentRemarks || null,
            enteredBy,
            status: 'SUBMITTED',
            batchId: batch.id,
          },
        });

        results.push(result);
        continue;
      }

      if (rawScore !== null) {
        if (!allowNegative && rawScore < 0) {
          throw new BadRequestException(`Negative scores not allowed. Student: ${scoreEntry.studentId}`);
        }

        if (rawScore > effectiveMaxScore) {
          throw new BadRequestException(`Score ${rawScore} exceeds max score ${effectiveMaxScore}. Student: ${scoreEntry.studentId}`);
        }

        if (!allowHalfMarks && !Number.isInteger(rawScore)) {
          throw new BadRequestException(`Half marks not allowed. Student: ${scoreEntry.studentId}`);
        }
      }

      const roundedScore = rawScore !== null
        ? parseFloat(rawScore.toFixed(decimalPlaces))
        : null;

      const weightedScore = roundedScore !== null
        ? (roundedScore / effectiveMaxScore) * 100
        : null;

      const grade = weightedScore !== null
        ? await this.gradingEngine.computeGrade(weightedScore, classId, subjectId, termId, schoolId)
        : null;

      const result = await this.prisma.studentAssessmentResult.upsert({
        where: {
          studentId_subjectId_termId_assessmentDefId: {
            studentId: scoreEntry.studentId,
            subjectId,
            termId,
            assessmentDefId,
          },
        },
        update: {
          rawScore: roundedScore,
          maxScore: effectiveMaxScore,
          weightedScore,
          percentage: weightedScore,
          grade,
          isAbsent: false,
          remarks: remarks || null,
          enteredBy,
          status: 'SUBMITTED',
          batchId: batch.id,
        },
        create: {
          studentId: scoreEntry.studentId,
          subjectId,
          termId,
          classId,
          assessmentDefId,
          rawScore: roundedScore,
          maxScore: effectiveMaxScore,
          weightedScore,
          percentage: weightedScore,
          grade,
          isAbsent: false,
          remarks: remarks || null,
          enteredBy,
          status: 'SUBMITTED',
          batchId: batch.id,
        },
      });

      results.push(result);
    }

    await this.prisma.assessmentBatch.update({
      where: { id: batch.id },
      data: {
        enteredCount: results.filter(r => r.rawScore !== null).length,
        status: 'IN_PROGRESS',
      },
    });

    this.logger.log(`Bulk entered ${results.length} scores for batch ${batch.id}`);

    // Sync computed results and result sheet for real-time web analytics
    await this.syncComputedResult(classId, subjectId, termId, schoolId).catch(e =>
      this.logger.error(`syncComputedResult failed: ${e.message}`),
    );
    // Recompute any composite subjects that include this subject
    await this.compositeSubjectService.recomputeAllComposites(subjectId, classId, termId, schoolId).catch(e =>
      this.logger.error(`composite recompute failed: ${e.message}`),
    );
    const def = await this.prisma.assessmentDefinition.findUnique({
      where: { id: assessmentDefId },
      select: { examType: true },
    });
    const sheet = await this.syncResultSheet(
      schoolId, classId, termId, enteredBy,
      def?.examType as string | undefined,
    ).catch(e => {
      this.logger.error(`syncResultSheet failed: ${e.message}`);
      return null;
    });

    // Emit real-time WebSocket event
    this.socketGateway.server?.emit(`result:updated:${schoolId}`, {
      classId,
      subjectId,
      termId,
      batchId: batch.id,
      sheetId: sheet?.id,
      enteredCount: results.filter(r => r.rawScore !== null).length,
      timestamp: new Date(),
      });
      await this.emitLiveResult(schoolId, { classId, subjectId, termId, enteredBy, score: results[0]?.rawScore ?? null });

      return {
      batch,
      results,
      summary: {
        total: results.length,
        entered: results.filter(r => r.rawScore !== null).length,
        absent: results.filter(r => r.isAbsent).length,
        missing: results.filter(r => r.rawScore === null && !r.isAbsent).length,
      },
    };
  }

  async enterSingleScore(schoolId: string, data: ScoreEntryDto) {
    const config = await this.prisma.termAssessmentConfiguration.findUnique({
      where: {
        classId_subjectId_termId_assessmentDefId: {
          classId: data.classId,
          subjectId: data.subjectId,
          termId: data.termId,
          assessmentDefId: data.assessmentDefId,
        },
      },
    });

    const effectiveMaxScore = config?.maxScore || data.maxScore || 100;
    const decimalPlaces = config?.decimalPlaces ?? 0;

    const isAbsent = data.isAbsent || data.absentCode === 'X' || data.absentCode === 'A';

    if (isAbsent) {
      const absentRemarks = data.absentCode
        ? `[Absent-${data.absentCode}] ${data.remarks || ''}`.trim()
        : `[Absent] ${data.remarks || ''}`.trim();

      const result = await this.prisma.studentAssessmentResult.upsert({
        where: {
          studentId_subjectId_termId_assessmentDefId: {
            studentId: data.studentId,
            subjectId: data.subjectId,
            termId: data.termId,
            assessmentDefId: data.assessmentDefId,
          },
        },
        update: {
          rawScore: null,
          maxScore: effectiveMaxScore,
          weightedScore: null,
          percentage: null,
          grade: null,
          isAbsent: true,
          remarks: absentRemarks || null,
          enteredBy: data.enteredBy,
          status: 'SUBMITTED',
        },
        create: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          termId: data.termId,
          classId: data.classId,
          assessmentDefId: data.assessmentDefId,
          rawScore: null,
          maxScore: effectiveMaxScore,
          weightedScore: null,
          percentage: null,
          grade: null,
          isAbsent: true,
          remarks: absentRemarks || null,
          enteredBy: data.enteredBy,
          status: 'SUBMITTED',
        },
      });

      // Sync computed results and result sheet for real-time web analytics
      await this.syncComputedResult(data.classId, data.subjectId, data.termId, schoolId).catch(e =>
        this.logger.error(`syncComputedResult failed: ${e.message}`),
      );
      await this.compositeSubjectService.recomputeAllComposites(data.subjectId, data.classId, data.termId, schoolId).catch(e =>
        this.logger.error(`composite recompute failed: ${e.message}`),
      );
      const absentDef = await this.prisma.assessmentDefinition.findUnique({
        where: { id: data.assessmentDefId },
        select: { examType: true },
      });
      await this.syncResultSheet(
        schoolId, data.classId, data.termId, data.enteredBy,
        absentDef?.examType as string | undefined,
      ).catch(e => {
        this.logger.error(`syncResultSheet failed: ${e.message}`);
      });

      this.socketGateway.server?.emit(`result:updated:${schoolId}`, {
        classId: data.classId,
        subjectId: data.subjectId,
        termId: data.termId,
        studentId: data.studentId,
        timestamp: new Date(),
      });
      await this.emitLiveResult(schoolId, { classId: data.classId, subjectId: data.subjectId, termId: data.termId, studentId: data.studentId, enteredBy: data.enteredBy, score: null });

      return result;
    }

    if (data.rawScore !== null) {
      if (data.rawScore < 0 && !(config?.allowNegative)) {
        throw new BadRequestException('Negative scores not allowed');
      }

      if (data.rawScore > effectiveMaxScore) {
        throw new BadRequestException(`Score exceeds max score ${effectiveMaxScore}`);
      }
    }

    const roundedScore = data.rawScore !== null
      ? parseFloat(data.rawScore.toFixed(decimalPlaces))
      : null;

    const weightedScore = roundedScore !== null
      ? (roundedScore / effectiveMaxScore) * 100
      : null;

    const grade = weightedScore !== null
      ? await this.gradingEngine.computeGrade(weightedScore, data.classId, data.subjectId, data.termId, schoolId)
      : null;

    const result = await this.prisma.studentAssessmentResult.upsert({
      where: {
        studentId_subjectId_termId_assessmentDefId: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          termId: data.termId,
          assessmentDefId: data.assessmentDefId,
        },
      },
      update: {
        rawScore: roundedScore,
        maxScore: effectiveMaxScore,
        weightedScore,
        percentage: weightedScore,
        grade,
        isAbsent: false,
        remarks: data.remarks || null,
        enteredBy: data.enteredBy,
        status: 'SUBMITTED',
      },
      create: {
        studentId: data.studentId,
        subjectId: data.subjectId,
        termId: data.termId,
        classId: data.classId,
        assessmentDefId: data.assessmentDefId,
        rawScore: roundedScore,
        maxScore: effectiveMaxScore,
        weightedScore,
        percentage: weightedScore,
        grade,
        isAbsent: false,
        remarks: data.remarks || null,
        enteredBy: data.enteredBy,
        status: 'SUBMITTED',
      },
    });

    // Sync computed results and result sheet for real-time web analytics
    await this.syncComputedResult(data.classId, data.subjectId, data.termId, schoolId).catch(e =>
      this.logger.error(`syncComputedResult failed: ${e.message}`),
    );
    // Recompute any composite subjects that include this subject
    await this.compositeSubjectService.recomputeAllComposites(data.subjectId, data.classId, data.termId, schoolId).catch(e =>
      this.logger.error(`composite recompute failed: ${e.message}`),
    );
    const scoreDef = await this.prisma.assessmentDefinition.findUnique({
      where: { id: data.assessmentDefId },
      select: { examType: true },
    });
    await this.syncResultSheet(
      schoolId, data.classId, data.termId, data.enteredBy,
      scoreDef?.examType as string | undefined,
    ).catch(e => {
      this.logger.error(`syncResultSheet failed: ${e.message}`);
    });

    // Emit real-time WebSocket event
    this.socketGateway.server?.emit(`result:updated:${schoolId}`, {
      classId: data.classId,
      subjectId: data.subjectId,
      termId: data.termId,
      studentId: data.studentId,
      timestamp: new Date(),
    });
    await this.emitLiveResult(schoolId, { classId: data.classId, subjectId: data.subjectId, termId: data.termId, studentId: data.studentId, enteredBy: data.enteredBy, score: data.rawScore });

    return result;
  }

  async getStudentResults(studentId: string, termId?: string) {
    return this.prisma.studentAssessmentResult.findMany({
      where: {
        studentId,
        ...(termId ? { termId } : {}),
      },
      include: {
        assessmentDef: true,
        subject: { select: { id: true, name: true, code: true } },
        term: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: [
        { term: { startDate: 'asc' } },
        { subject: { name: 'asc' } },
        { assessmentDef: { sortOrder: 'asc' } },
      ],
    });
  }

  async getClassResults(classId: string, subjectId: string, termId: string, assessmentDefId?: string) {
    const where: any = { classId, subjectId, termId };
    if (assessmentDefId) {
      where.assessmentDefId = assessmentDefId;
    }

    return this.prisma.studentAssessmentResult.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
        assessmentDef: true,
      },
      orderBy: [
        { student: { lastName: 'asc' } },
        { assessmentDef: { sortOrder: 'asc' } },
      ],
    });
  }

  async getBatchResults(batchId: string) {
    const batch = await this.prisma.assessmentBatch.findUnique({
      where: { id: batchId },
      include: {
        assessmentDef: true,
        class: true,
        subject: true,
        term: true,
        results: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
              },
            },
          },
          orderBy: { student: { lastName: 'asc' } },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    return batch;
  }

  async verifyBatch(batchId: string, verifiedBy: string) {
    const batch = await this.prisma.assessmentBatch.findUnique({
      where: { id: batchId },
      include: { results: true },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    const missingScores = batch.results.filter(r => r.rawScore === null && !r.isAbsent);

    if (missingScores.length > 0) {
      throw new BadRequestException(`${missingScores.length} scores are missing. Cannot verify batch.`);
    }

    await this.prisma.$transaction([
      this.prisma.assessmentBatch.update({
        where: { id: batchId },
        data: {
          status: 'VERIFIED',
          verifiedCount: batch.results.length,
          completedAt: new Date(),
        },
      }),
      this.prisma.studentAssessmentResult.updateMany({
        where: { batchId },
        data: {
          status: 'VERIFIED',
          verifiedBy,
          verifiedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(`Batch ${batchId} verified by ${verifiedBy}`);

    return this.getBatchResults(batchId);
  }

  async lockBatch(batchId: string) {
    await this.prisma.$transaction([
      this.prisma.assessmentBatch.update({
        where: { id: batchId },
        data: { status: 'LOCKED' },
      }),
      this.prisma.studentAssessmentResult.updateMany({
        where: { batchId },
        data: { status: 'LOCKED' },
      }),
    ]);

    this.logger.log(`Batch ${batchId} locked`);

    return this.getBatchResults(batchId);
  }

  async getTeacherPendingAssessments(teacherId: string, schoolId: string) {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId, schoolId },
      include: {
        class: true,
        subject: true,
      },
    });

    const pending = [];

    for (const assignment of assignments) {
      const currentTerm = await this.prisma.term.findFirst({
        where: {
          academicYear: { schoolId },
          isCurrent: true,
        },
      });

      if (!currentTerm) continue;

      const configs = await this.prisma.termAssessmentConfiguration.findMany({
        where: {
          classId: assignment.classId,
          subjectId: assignment.subjectId,
          termId: currentTerm.id,
        },
        include: { assessmentDef: true },
        orderBy: { sequenceOrder: 'asc' },
      });

      for (const config of configs) {
        const enrolledStudents = await this.prisma.enrollment.count({
          where: {
            classId: assignment.classId,
            academicYearId: currentTerm.academicYearId,
            status: 'ACTIVE',
            student: { status: 'ACTIVE' },
          },
        });

        const enteredCount = await this.prisma.studentAssessmentResult.count({
          where: {
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            termId: currentTerm.id,
            assessmentDefId: config.assessmentDefId,
            OR: [
              { rawScore: { not: null } },
              { isAbsent: true },
            ],
            enteredBy: teacherId,
          },
        });

        if (enteredCount < enrolledStudents) {
          pending.push({
            classId: assignment.classId,
            className: assignment.class.name,
            subjectId: assignment.subjectId,
            subjectName: assignment.subject.name,
            termId: currentTerm.id,
            termName: currentTerm.name,
            assessmentDefId: config.assessmentDefId,
            assessmentName: config.assessmentDef.name,
            maxScore: config.maxScore,
            weightPercentage: config.weightPercentage,
            totalStudents: enrolledStudents,
            enteredCount,
            missingCount: enrolledStudents - enteredCount,
            completionRate: enrolledStudents > 0 ? (enteredCount / enrolledStudents) * 100 : 0,
          });
        }
      }
    }

    return pending;
  }

  async getAssessmentCompletionStats(classId: string, subjectId: string, termId: string) {
    const configs = await this.prisma.termAssessmentConfiguration.findMany({
      where: { classId, subjectId, termId },
      include: { assessmentDef: true },
      orderBy: { sequenceOrder: 'asc' },
    });

    const enrolledStudents = await this.prisma.enrollment.count({
      where: { classId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
    });

    const stats = [];

    for (const config of configs) {
      const enteredCount = await this.prisma.studentAssessmentResult.count({
          where: {
            classId,
            subjectId,
            termId,
            assessmentDefId: config.assessmentDefId,
            OR: [
              { rawScore: { not: null } },
              { isAbsent: true },
            ],
          },
        });

      stats.push({
        assessmentDefId: config.assessmentDefId,
        assessmentName: config.assessmentDef.name,
        assessmentCode: config.assessmentDef.code,
        maxScore: config.maxScore,
        weightPercentage: config.weightPercentage,
        totalStudents: enrolledStudents,
        enteredCount,
        missingCount: enrolledStudents - enteredCount,
        completionRate: enrolledStudents > 0 ? (enteredCount / enrolledStudents) * 100 : 0,
      });
    }

    return {
      classId,
      subjectId,
      termId,
      totalStudents: enrolledStudents,
      assessments: stats,
      overallCompletionRate: stats.length > 0
        ? stats.reduce((sum, s) => sum + s.completionRate, 0) / stats.length
        : 0,
    };
  }
}
