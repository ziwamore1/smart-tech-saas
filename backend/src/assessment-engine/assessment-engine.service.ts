import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
import { SocketGateway } from '../messaging/socket.gateway';
import { CompositeSubjectService } from '../composite-subject/composite-subject.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';
import { normalizeExamType } from '../common/utils/exam-type.util';
import { SchoolActivityService } from '../common/services/school-activity.service';
import { ActivityEventType, ActivityCategory, ActivitySeverity } from '../common/types/activity-event.types';

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
    @Optional() private readonly activityService?: SchoolActivityService,
  ) {}

  private async emitLiveResult(schoolId: string, data: { classId: string; subjectId: string; termId: string; studentId?: string; score?: number | null; enteredBy?: string }) {
    try {
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
    } catch (e: any) {
      this.logger.warn(`emitLiveResult failed: ${e.message}`);
    }
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

    const submittedDefIds = configurations.map((c) => c.assessmentDefId);
    const deleted = await this.prisma.termAssessmentConfiguration.deleteMany({
      where: {
        classId,
        subjectId,
        termId,
        assessmentDefId: { notIn: submittedDefIds },
      },
    });

    if (deleted.count > 0) {
      this.logger.log(`Removed ${deleted.count} deleted assessment configs for class ${classId}, subject ${subjectId}, term ${termId}`);
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

    // Resolve the academic year for this term so the enrollment query is
    // reliable even when the Term ↔ AcademicYear join is missing or the
    // nested Prisma query doesn't traverse correctly.
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      select: { academicYearId: true },
    });
    const enrollmentWhere: any = { classId, status: 'ACTIVE', student: { status: 'ACTIVE' } };
    if (term?.academicYearId) {
      enrollmentWhere.academicYearId = term.academicYearId;
    } else {
      // Fallback: derive academic year via the term relation
      enrollmentWhere.academicYear = { terms: { some: { id: termId } } };
    }
    const enrollments = await this.prisma.enrollment.findMany({
      where: enrollmentWhere,
      select: { studentId: true },
    });

    for (const enrollment of enrollments) {
      // Include absent entries (rawScore is null when isAbsent) so that
      // students who were absent for every component are recognised instead
      // of being treated as having no data at all.
      const results = await this.prisma.studentAssessmentResult.findMany({
        where: {
          studentId: enrollment.studentId,
          subjectId,
          termId,
          classId,
          OR: [{ rawScore: { not: null } }, { isAbsent: true }],
        },
      });

      if (configs.length === 0) {
        const scoredResults = results.filter(r => r.rawScore != null);
        if (scoredResults.length > 0) {
          const totalRaw = scoredResults.reduce((s, r) => s + (r.rawScore ?? 0), 0);
          const totalMax = scoredResults.reduce((s, r) => s + (r.maxScore ?? 100), 0);
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
            update: { classId, schoolId, totalRawScore: totalRaw, finalPercentage: pct, finalGrade: grade, isAbsent: false, status: 'COMPUTED', computedAt: new Date() },
            create: {
              studentId: enrollment.studentId,
              subjectId, termId, classId, schoolId,
              totalRawScore: totalRaw, finalPercentage: pct, finalGrade: grade, isAbsent: false, status: 'COMPUTED', computedAt: new Date(),
            },
          });
        } else if (results.length > 0) {
          // Absence-only data without configured assessments — keep the
          // subject flagged as ABSENT rather than silently scoring zero.
          await this.prisma.computedResult.upsert({
            where: {
              studentId_subjectId_termId: {
                studentId: enrollment.studentId,
                subjectId,
                termId,
              },
            },
            update: { classId, schoolId, totalRawScore: 0, finalPercentage: null, finalGrade: null, finalRemark: 'ABSENT (X)', points: null, isAbsent: true, status: 'COMPUTED', metadata: { absentCode: 'X' }, computedAt: new Date() },
            create: {
              studentId: enrollment.studentId,
              subjectId, termId, classId, schoolId,
              totalRawScore: 0, finalPercentage: null, finalGrade: null, finalRemark: 'ABSENT (X)', points: null, isAbsent: true, status: 'COMPUTED', metadata: { absentCode: 'X' }, computedAt: new Date(),
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

      // The student has an entry for every configured component and all of
      // them are absences (entered as X/A) — the subject is ABSENT, not
      // missing. Persist an authoritative absent ComputedResult so entry
      // tables, view results and reports show Absent instead of a dash.
      const allComponentsAbsent =
        results.length > 0 &&
        configs.every(c => {
          const result = results.find(r => r.assessmentDefId === c.assessmentDefId);
          return result && result.isAbsent && result.rawScore == null;
        });

      if (totalWeight > 0) {
        await this.prisma.computedResult.upsert({
          where: {
            studentId_subjectId_termId: {
              studentId: enrollment.studentId,
              subjectId,
              termId,
            },
          },
          update: {
            classId,
            schoolId,
            totalRawScore: results.reduce((s, r) => s + (r.rawScore ?? 0), 0),
            totalWeightedScore: totalWeighted,
            finalPercentage: finalPct,
            finalGrade,
            isAbsent: false,
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
            isAbsent: false,
            status: allFilled ? 'COMPUTED' : 'PENDING',
            computedAt: allFilled ? new Date() : null,
          },
        });
      } else if (results.some(r => r.isAbsent)) {
        // Entries exist but none carry a usable score (absence-only data).
        const metadata = allComponentsAbsent ? { absentCode: 'X' } : {};
        await this.prisma.computedResult.upsert({
          where: {
            studentId_subjectId_termId: {
              studentId: enrollment.studentId,
              subjectId,
              termId,
            },
          },
          update: {
            classId,
            schoolId,
            totalRawScore: 0,
            totalWeightedScore: null,
            finalPercentage: null,
            finalGrade: null,
            finalRemark: allComponentsAbsent ? 'ABSENT (X)' : null,
            points: null,
            isAbsent: true,
            status: allComponentsAbsent && allFilled ? 'COMPUTED' : 'PENDING',
            metadata,
            computedAt: allComponentsAbsent && allFilled ? new Date() : null,
          },
          create: {
            studentId: enrollment.studentId,
            subjectId, termId, classId, schoolId,
            totalRawScore: 0,
            totalWeightedScore: null,
            finalPercentage: null,
            finalGrade: null,
            finalRemark: allComponentsAbsent ? 'ABSENT (X)' : null,
            points: null,
            isAbsent: true,
            status: allComponentsAbsent && allFilled ? 'COMPUTED' : 'PENDING',
            metadata,
            computedAt: allComponentsAbsent && allFilled ? new Date() : null,
          },
        });
      } else {
        // No components entered yet — remove any stale ComputedResult so
        // getSheetStudents falls back to StudentAssessmentResult data.
        await this.prisma.computedResult.deleteMany({
          where: {
            studentId: enrollment.studentId,
            subjectId,
            termId,
          },
        });
      }
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

    const totalStudents = await this.prisma.enrollment.count({
      where: { classId, academicYearId: term.academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
    });

    const sheet = await this.prisma.resultSheet.upsert({
      where: {
        classId_termId_examType: {
          classId,
          termId,
          examType: resolvedExamType,
        },
      },
      update: { totalStudents },
      create: {
        schoolId,
        classId,
        termId,
        academicYearId: term.academicYearId,
        examType: resolvedExamType,
        createdBy: userId || 'SYSTEM',
        status: 'DRAFT',
        totalStudents,
      },
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

    // ── Pre-fetch grading system once (avoid N+1 DB calls per student) ──
    let gradingSystem: any = null;
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

    // ── Pre-validate and compute grades in-memory ──
    const validScores: Array<{ entry: typeof scores[0]; roundedScore: number; weightedScore: number; grade: string | null }> = [];
    const validationErrors: Array<{ studentId: string; error: string }> = [];

    for (const scoreEntry of scores) {
      const isAbsent = scoreEntry.isAbsent || scoreEntry.absentCode === 'X' || scoreEntry.absentCode === 'A';
      if (isAbsent) {
        validScores.push({ entry: scoreEntry, roundedScore: 0, weightedScore: 0, grade: null });
        continue;
      }

      if (scoreEntry.rawScore !== null && scoreEntry.rawScore !== undefined) {
        if (!allowNegative && scoreEntry.rawScore < 0) {
          validationErrors.push({ studentId: scoreEntry.studentId, error: 'Negative scores not allowed' });
          continue;
        }
        if (scoreEntry.rawScore > effectiveMaxScore) {
          validationErrors.push({ studentId: scoreEntry.studentId, error: `Score ${scoreEntry.rawScore} exceeds max score ${effectiveMaxScore}` });
          continue;
        }
        if (!allowHalfMarks && !Number.isInteger(scoreEntry.rawScore)) {
          validationErrors.push({ studentId: scoreEntry.studentId, error: 'Half marks not allowed' });
          continue;
        }
      }

      const rawScore = scoreEntry.rawScore ?? null;
      const roundedScore = rawScore !== null ? parseFloat(rawScore.toFixed(decimalPlaces)) : null;
      const weightedScore = roundedScore !== null ? (roundedScore / effectiveMaxScore) * 100 : null;

      // In-memory grade lookup
      let grade: string | null = null;
      if (weightedScore !== null && gradingSystem?.gradeScales?.length > 0) {
        const scale = gradingSystem.gradeScales.find(
          (s: any) => weightedScore >= s.minScore && weightedScore < s.maxScore + 1,
        );
        grade = scale?.grade ?? null;
      }

      validScores.push({ entry: scoreEntry, roundedScore: roundedScore ?? 0, weightedScore: weightedScore ?? 0, grade });
    }

    // ── Execute upserts in transaction chunks ──
    const results: any[] = [];
    const CHUNK_SIZE = 50;

    for (let i = 0; i < validScores.length; i += CHUNK_SIZE) {
      const chunk = validScores.slice(i, i + CHUNK_SIZE);
      const chunkResults = await this.prisma.$transaction(async (tx) => {
        const upserted: any[] = [];
        for (const { entry, roundedScore, weightedScore, grade } of chunk) {
          const isAbsent = entry.isAbsent || entry.absentCode === 'X' || entry.absentCode === 'A';
          const absentRemarks = isAbsent && entry.absentCode
            ? `[Absent-${entry.absentCode}] ${entry.remarks || ''}`.trim()
            : isAbsent ? `[Absent] ${entry.remarks || ''}`.trim() : null;

          const result = await tx.studentAssessmentResult.upsert({
            where: {
              studentId_subjectId_termId_assessmentDefId: {
                studentId: entry.studentId,
                subjectId,
                termId,
                assessmentDefId,
              },
            },
            update: {
              rawScore: isAbsent ? null : roundedScore,
              maxScore: effectiveMaxScore,
              weightedScore: isAbsent ? null : weightedScore,
              percentage: isAbsent ? null : weightedScore,
              grade: isAbsent ? null : grade,
              isAbsent,
              remarks: absentRemarks || entry.remarks || null,
              enteredBy,
              status: 'SUBMITTED',
              batchId: batch.id,
            },
            create: {
              studentId: entry.studentId,
              subjectId,
              termId,
              classId,
              assessmentDefId,
              rawScore: isAbsent ? null : roundedScore,
              maxScore: effectiveMaxScore,
              weightedScore: isAbsent ? null : weightedScore,
              percentage: isAbsent ? null : weightedScore,
              grade: isAbsent ? null : grade,
              isAbsent,
              remarks: absentRemarks || entry.remarks || null,
              enteredBy,
              status: 'SUBMITTED',
              batchId: batch.id,
            },
          });
          upserted.push(result);
        }
        return upserted;
      }, { maxWait: 30000, timeout: 60000 });

      results.push(...chunkResults);
    }

    await this.prisma.assessmentBatch.update({
      where: { id: batch.id },
      data: {
        enteredCount: results.filter(r => r.rawScore !== null).length,
        status: 'IN_PROGRESS',
      },
    });

    this.logger.log(`Bulk entered ${results.length} scores for batch ${batch.id}`);

    // Sync computed results and result sheet for real-time web analytics (fire-and-forget)
    this.syncComputedResult(classId, subjectId, termId, schoolId).catch(e =>
      this.logger.error(`syncComputedResult failed: ${e.message}`),
    );
    this.compositeSubjectService.recomputeAllComposites(subjectId, classId, termId, schoolId).catch(e =>
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

    // Emit real-time WebSocket event (safe — server may be null in serverless)
    try {
      this.socketGateway.server?.emit?.(`result:updated:${schoolId}`, {
        classId,
        subjectId,
        termId,
        batchId: batch.id,
        sheetId: sheet?.id,
        enteredCount: results.filter(r => r.rawScore !== null).length,
        timestamp: new Date(),
      });
    } catch (e: any) {
      this.logger.warn(`WebSocket emit failed: ${e.message}`);
    }
    await this.emitLiveResult(schoolId, { classId, subjectId, termId, enteredBy, score: results[0]?.rawScore ?? null }).catch(() => {});

    const [enteredUser, enteredClass, enteredSubject] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: enteredBy }, select: { firstName: true, lastName: true } }),
      this.prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
      this.prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } }),
    ]).catch(() => [null, null, null] as any);
    const enteredByName = enteredUser ? `${enteredUser.firstName ?? ''} ${enteredUser.lastName ?? ''}`.trim() : undefined;
    const className = enteredClass?.name;
    const subjectName = enteredSubject?.name;

    this.activityService?.publish({
      type: ActivityEventType.RESULT_BULK_ENTERED,
      category: ActivityCategory.RESULTS,
      severity: ActivitySeverity.SUCCESS,
      schoolId,
      userId: enteredBy,
      userName: enteredByName || undefined,
      title: 'Bulk results entered',
      description: `${results?.length || 0} scores entered for ${className || 'class'} - ${subjectName || 'subject'}`,
      metadata: { classId, subjectId, termId, count: results?.length || 0, teacherName: enteredByName, className, subjectName },
    });

    return {
      batch,
      results,
      validationErrors,
      summary: {
        total: scores.length,
        entered: results.filter(r => r.rawScore !== null).length,
        absent: results.filter(r => r.isAbsent).length,
        missing: results.filter(r => r.rawScore === null && !r.isAbsent).length,
        validationErrors: validationErrors.length,
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

      // Emit real-time WebSocket event (safe — server may be null in serverless)
      try {
        this.socketGateway.server?.emit?.(`result:updated:${schoolId}`, {
          classId: data.classId,
          subjectId: data.subjectId,
          termId: data.termId,
          studentId: data.studentId,
          timestamp: new Date(),
        });
      } catch (e: any) {
        this.logger.warn(`WebSocket emit failed: ${e.message}`);
      }
      await this.emitLiveResult(schoolId, { classId: data.classId, subjectId: data.subjectId, termId: data.termId, studentId: data.studentId, enteredBy: data.enteredBy, score: null }).catch(() => {});

      this.activityService?.publish({
        type: ActivityEventType.RESULT_ENTERED,
        category: ActivityCategory.RESULTS,
        severity: ActivitySeverity.SUCCESS,
        schoolId,
        userId: data.enteredBy,
        title: 'Score entered',
        description: `Absent marked for a student`,
        metadata: { classId: data.classId, subjectId: data.subjectId, termId: data.termId, studentId: data.studentId, isAbsent: true },
      });

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

    // Emit real-time WebSocket event (safe — server may be null in serverless)
    try {
      this.socketGateway.server?.emit?.(`result:updated:${schoolId}`, {
        classId: data.classId,
        subjectId: data.subjectId,
        termId: data.termId,
        studentId: data.studentId,
        timestamp: new Date(),
      });
    } catch (e: any) {
      this.logger.warn(`WebSocket emit failed: ${e.message}`);
    }
    await this.emitLiveResult(schoolId, { classId: data.classId, subjectId: data.subjectId, termId: data.termId, studentId: data.studentId, enteredBy: data.enteredBy, score: data.rawScore }).catch(() => {});

    const [enteredClass, enteredSubject] = await Promise.all([
      this.prisma.class.findUnique({ where: { id: data.classId }, select: { name: true } }),
      this.prisma.subject.findUnique({ where: { id: data.subjectId }, select: { name: true } }),
    ]).catch(() => [null, null] as any);

    this.activityService?.publish({
      type: ActivityEventType.RESULT_ENTERED,
      category: ActivityCategory.RESULTS,
      severity: ActivitySeverity.SUCCESS,
      schoolId,
      userId: data.enteredBy,
      title: 'Score entered',
      description: `${data.rawScore ?? 'No'} score for ${enteredClass?.name || 'class'} - ${enteredSubject?.name || 'subject'}`,
      metadata: { classId: data.classId, subjectId: data.subjectId, termId: data.termId, studentId: data.studentId, score: data.rawScore },
    });

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

  async getTeacherPendingAssessments(
    teacherId: string,
    schoolId: string,
    termId?: string,
    teacherIds?: string[],
    includeCompleted = false,
  ) {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId: { in: teacherIds?.length ? teacherIds : [teacherId] }, schoolId },
      include: {
        class: true,
        subject: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const pending = [];
    const selectedTerm = termId
      ? await this.prisma.term.findFirst({ where: { id: termId, academicYear: { schoolId } } })
      : await this.prisma.term.findFirst({ where: { academicYear: { schoolId }, isCurrent: true } });
    if (!selectedTerm) return pending;
    const classIds = [...new Set(assignments.map((assignment) => assignment.classId))];
    const subjectIds = [...new Set(assignments.map((assignment) => assignment.subjectId))];
    const [configs, enrollmentCounts, enteredCounts] = await Promise.all([
      this.prisma.termAssessmentConfiguration.findMany({
        where: { termId: selectedTerm.id, classId: { in: classIds }, subjectId: { in: subjectIds } },
        include: { assessmentDef: true },
        orderBy: { sequenceOrder: 'asc' },
      }),
      this.prisma.enrollment.groupBy({
        by: ['classId'],
        where: { classId: { in: classIds }, academicYearId: selectedTerm.academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
        _count: { _all: true },
      }),
      this.prisma.studentAssessmentResult.groupBy({
        by: ['classId', 'subjectId', 'assessmentDefId', 'enteredBy'],
        where: {
          classId: { in: classIds },
          subjectId: { in: subjectIds },
          termId: selectedTerm.id,
          enteredBy: { in: teacherIds?.length ? teacherIds : [teacherId] },
          OR: [{ rawScore: { not: null } }, { isAbsent: true }],
        },
        _count: { _all: true },
      }),
    ]);
    const enrolledByClass = new Map(enrollmentCounts.map((row) => [row.classId, row._count._all]));
    const enteredByKey = new Map(enteredCounts.map((row) => [`${row.classId}:${row.subjectId}:${row.assessmentDefId}:${row.enteredBy}`, row._count._all]));
    const configsByPair = new Map<string, typeof configs>();
    for (const config of configs) {
      const key = `${config.classId}:${config.subjectId}`;
      const current = configsByPair.get(key) || [];
      current.push(config);
      configsByPair.set(key, current);
    }

    for (const assignment of assignments) {
      const enrolledStudents = enrolledByClass.get(assignment.classId) || 0;
      for (const config of configsByPair.get(`${assignment.classId}:${assignment.subjectId}`) || []) {
        const enteredCount = enteredByKey.get(`${assignment.classId}:${assignment.subjectId}:${config.assessmentDefId}:${assignment.teacherId}`) || 0;
        if (includeCompleted || enteredCount < enrolledStudents) {
          pending.push({
            teacherId: assignment.teacherId,
            teacherName: `${assignment.teacher.firstName || ''} ${assignment.teacher.lastName || ''}`.trim(),
            classId: assignment.classId,
            className: assignment.class.name,
            subjectId: assignment.subjectId,
            subjectName: assignment.subject.name,
            termId: selectedTerm.id,
            termName: selectedTerm.name,
            assessmentDefId: config.assessmentDefId,
            assessmentName: config.assessmentDef.name,
            maxScore: config.maxScore,
            weightPercentage: config.weightPercentage,
            totalStudents: enrolledStudents,
            enteredCount,
            missingCount: enrolledStudents - enteredCount,
            completionRate: enrolledStudents > 0 ? (enteredCount / enrolledStudents) * 100 : 0,
            completed: enteredCount >= enrolledStudents,
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
