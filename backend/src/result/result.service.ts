import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { getSubjectShortcut } from '../common/subject-shortcuts';
import { ClassAccessService } from '../common/access/class-access.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';

@Injectable()
export class ResultService {
  private readonly logger = new Logger(ResultService.name);

  constructor(
    private prisma: PrismaService,
    private classAccess: ClassAccessService,
    private schoolEvents?: SchoolEventsGateway,
  ) {}

  async findAll(
    schoolId: string,
    classId?: string,
    termId?: string,
    subjectId?: string,
  ) {
    const where: any = { schoolId };

    if (classId) {
      where.student = {
        enrollments: {
          some: {
            classId,
            academicYear: {
              terms: {
                some: { id: termId },
              },
            },
          },
        },
      };
    }

    if (termId) {
      where.termId = termId;
    }

    if (subjectId) {
      where.subjectId = subjectId;
    }

    where.student = { ...where.student, status: 'ACTIVE' };

    const results = await this.prisma.result.findMany({
      where,
      include: {
        student: true,
        subject: true,
        term: true,
      },
      orderBy: [
        { student: { firstName: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });

    // Attach grading/absence info from ComputedResult so the UI can show
    // points and respect "X"/"A" absent students in analytics.
    const studentIds = [...new Set(results.map((r) => r.studentId))];
    const subjectIds = [...new Set(results.map((r) => r.subjectId))];
    const computedMap = new Map<string, any>();

    if (studentIds.length > 0 && subjectIds.length > 0) {
      const computed = await this.prisma.computedResult.findMany({
        where: {
          schoolId,
          ...(termId ? { termId } : {}),
          studentId: { in: studentIds },
          subjectId: { in: subjectIds },
        },
        select: {
          studentId: true,
          subjectId: true,
          termId: true,
          points: true,
          isAbsent: true,
          finalGrade: true,
          finalRemark: true,
          metadata: true,
        },
      });
      for (const c of computed) {
        computedMap.set(`${c.studentId}|${c.subjectId}|${c.termId}`, c);
      }
    }

    return results.map((r) => {
      const c = computedMap.get(`${r.studentId}|${r.subjectId}|${r.termId}`);
      const metadata = (c?.metadata || {}) as any;
      return {
        ...r,
        points: c?.isAbsent ? null : (c?.points ?? null),
        isAbsent: c?.isAbsent ?? false,
        absentCode: metadata?.absentCode ?? null,
        computed: c
          ? {
              points: c.points,
              isAbsent: c.isAbsent,
              finalGrade: c.finalGrade,
              finalRemark: c.finalRemark,
            }
          : null,
      };
    });
  }

  async findOne(id: string, schoolId: string) {
    const result = await this.prisma.result.findUnique({
      where: { id },
      include: {
        student: true,
        subject: true,
        term: true,
      },
    });

    if (!result || result.schoolId !== schoolId) {
      throw new NotFoundException('Result not found');
    }

    return result;
  }

  async findByStudent(studentId: string, termId: string, schoolId: string) {
    const results = await this.prisma.computedResult.findMany({
      where: {
        studentId,
        termId,
        schoolId,
        status: { in: ['PUBLISHED', 'LOCKED'] },
        student: { status: 'ACTIVE' },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    });

    return results.map(r => ({
      id: r.id,
      studentId: r.studentId,
      subjectId: r.subjectId,
      subject: { id: r.subject.id, name: r.subject.name, code: r.subject.code },
      score: r.finalPercentage,
      finalPercentage: r.finalPercentage,
      totalRawScore: r.totalRawScore,
      totalWeightedScore: r.totalWeightedScore,
      grade: r.finalGrade,
      remark: r.finalRemark,
      points: r.points,
      gradePoints: r.points,
      gpa: r.gpa,
      classRank: r.classRank,
      subjectRank: r.subjectRank,
      isAbsent: r.isAbsent,
    }));
  }

  async create(
    userId: string,
    schoolId: string,
    studentId: string,
    subjectId: string,
    termId: string,
    score: number,
    roles: string[] = [],
    isSuperAdmin = false,
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid term');
    }

    if (term.resultsLocked) {
      throw new ForbiddenException('Results are locked. Contact administrator.');
    }

    // Find the student's enrollment to get their class
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        academicYearId: term.academicYearId,
        schoolId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('Student not enrolled in this academic year');
    }

    await this.classAccess.assertCanEnterResults(
      { id: userId, schoolId, roles, isSuperAdmin },
      enrollment.classId,
      subjectId,
      term.academicYearId,
    );

    const assignment = await this.prisma.teachingAssignment.findFirst({
      where: {
        teacherId: userId,
        subjectId,
        classId: enrollment.classId,
        academicYearId: term.academicYearId,
        schoolId,
      },
    });
    const teacherId = assignment?.teacherId || userId;

    const gradeData = await this.calculateGrade(score, schoolId, enrollment.classId);

    const existing = await this.prisma.result.findFirst({
      where: { studentId, subjectId, termId, schoolId, student: { status: 'ACTIVE' } },
    });

    if (existing) {
      const updated = await this.prisma.result.update({
        where: { id: existing.id },
        data: {
          score,
          grade: gradeData.grade,
          remark: gradeData.remark,
          teacherId,
        },
        include: { student: true, subject: true },
      });

      await this.prisma.computedResult.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId,
            subjectId,
            termId,
          },
        },
        update: {
          classId: enrollment.classId,
          schoolId,
          totalRawScore: score,
          finalPercentage: score,
          finalGrade: gradeData.grade,
          finalRemark: gradeData.remark,
          points: gradeData.points,
          gpa: gradeData.gpa,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
        create: {
          studentId,
          subjectId,
          termId,
          classId: enrollment.classId,
          schoolId,
          totalRawScore: score,
          finalPercentage: score,
          finalGrade: gradeData.grade,
          finalRemark: gradeData.remark,
          points: gradeData.points,
          gpa: gradeData.gpa,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
      });

      return updated;
    }

    const created = await this.prisma.result.create({
      data: {
        studentId,
        subjectId,
        termId,
        teacherId,
        schoolId,
        score,
        grade: gradeData.grade,
        remark: gradeData.remark,
      },
      include: {
        student: true,
        subject: true,
      },
    });

      await this.prisma.computedResult.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId,
            subjectId,
            termId,
          },
        },
        update: {
          totalRawScore: score,
          finalPercentage: score,
          finalGrade: gradeData.grade,
          finalRemark: gradeData.remark,
          points: gradeData.points,
          gpa: gradeData.gpa,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
        create: {
          studentId,
          subjectId,
          termId,
          classId: enrollment.classId,
          schoolId,
          totalRawScore: score,
          finalPercentage: score,
          finalGrade: gradeData.grade,
          finalRemark: gradeData.remark,
          points: gradeData.points,
          gpa: gradeData.gpa,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
      });

      // Ensure ResultSheet exists, then update counts and auto-submit
      const sheetInfo = await this.ensureSheet(schoolId, enrollment.classId, termId, term.academicYearId, userId);
      if (!sheetInfo.justCreated) {
        await this.prisma.resultSheet.updateMany({
          where: { classId: enrollment.classId, termId, schoolId },
          data: { enteredCount: { increment: 1 } },
        }).catch(() => {});
      }

      // Auto-submit DRAFT sheet so results become visible immediately
      await this.autoSubmitSheet(schoolId, enrollment.classId, termId, userId);

      // Emit real-time event so Director and other teachers see the update instantly
      if (this.schoolEvents) {
        const [teacher, classObj] = await Promise.all([
          this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
          this.prisma.class.findUnique({ where: { id: enrollment.classId }, select: { name: true } }),
        ]);
        this.schoolEvents.emitResultsSaved(schoolId, {
          classId: enrollment.classId,
          termId,
          subjectId,
          savedBy: userId,
          count: 1,
        });
        this.schoolEvents.emitResultsLive(schoolId, {
          id: created.id,
          classId: enrollment.classId,
          termId,
          subjectId,
          score,
          savedBy: userId,
          timestamp: new Date(),
          action: 'result-saved',
          teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : undefined,
          className: classObj?.name,
          subjectName: created.subject?.name,
          teacher: teacher ? { id: userId, firstName: teacher.firstName, lastName: teacher.lastName } : undefined,
          class: classObj ? { id: enrollment.classId, name: classObj.name } : undefined,
          subject: created.subject ? { id: subjectId, name: created.subject.name } : undefined,
        });
      }

      return created;
    }

  private async autoSubmitSheet(
    schoolId: string,
    classId: string,
    termId: string,
    userId: string,
  ): Promise<void> {
    try {
      const sheet = await this.prisma.resultSheet.findFirst({
        where: { schoolId, classId, termId, status: { not: 'LOCKED' } },
      });
      if (!sheet) return;

      if (sheet.status === 'SUBMITTED') return;

      const previousStatus = sheet.status;

      await this.prisma.$transaction(async (tx) => {
        await tx.resultSheet.update({
          where: { id: sheet.id },
          data: {
            status: 'SUBMITTED',
            submittedAt: new Date(),
            submittedBy: userId,
            verifiedBy: null,
            verifiedAt: null,
          },
        });
        await tx.resultAuditLog.create({
          data: {
            schoolId,
            action: 'SUBMITTED',
            entityType: 'RESULT_SHEET',
            entityId: sheet.id,
            classId,
            termId,
            performedBy: userId,
            metadata: {
              autoSubmitted: true,
              previousStatus,
              reason: `Auto-submitted: new results added while sheet was ${previousStatus}`,
            },
          },
        });
      });

      this.logger.log(`Auto-submitted result sheet ${sheet.id} for class ${classId}, term ${termId} (was ${previousStatus})`);

      if (this.schoolEvents) {
        this.schoolEvents.emitResultsLive(schoolId, {
          classId,
          termId,
          sheetId: sheet.id,
          status: 'SUBMITTED',
          action: 'auto-submitted',
          previousStatus,
          by: userId,
        });
      }
    } catch (error: any) {
      this.logger.warn(`Auto-submit failed for class ${classId}, term ${termId}: ${error.message}`);
    }
  }

  private async ensureSheet(
    schoolId: string,
    classId: string,
    termId: string,
    academicYearId: string,
    userId: string,
  ): Promise<{ sheetId: string | null; justCreated: boolean }> {
    try {
      const existing = await this.prisma.resultSheet.findFirst({
        where: { schoolId, classId, termId },
        select: { id: true },
      });
      if (existing) return { sheetId: existing.id, justCreated: false };

      const totalStudents = await this.prisma.enrollment.count({
        where: { classId, academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      });
      const enteredStudents = await this.prisma.result.groupBy({
        by: ['studentId'],
        where: { schoolId, termId, student: { enrollments: { some: { classId, academicYearId, status: 'ACTIVE' } }, status: 'ACTIVE' } },
      });

      const sheet = await this.prisma.resultSheet.create({
        data: {
          schoolId,
          classId,
          termId,
          academicYearId,
          examType: 'END_TERM',
          status: 'SUBMITTED',
          totalStudents,
          enteredCount: enteredStudents.length,
          createdBy: userId,
          submittedAt: new Date(),
          submittedBy: userId,
        },
      });
      await this.prisma.resultAuditLog.create({
        data: {
          schoolId,
          action: 'SUBMITTED',
          entityType: 'RESULT_SHEET',
          entityId: sheet.id,
          classId,
          termId,
          performedBy: userId,
          metadata: { autoCreated: true, reason: 'Auto-created and submitted on result save' },
        },
      });
      this.logger.log(`Auto-created and submitted ResultSheet ${sheet.id} for class ${classId}, term ${termId}`);
      return { sheetId: sheet.id, justCreated: true };
    } catch (error: any) {
      this.logger.warn(`ensureSheet failed for class ${classId}, term ${termId}: ${error.message}`);
      return { sheetId: null, justCreated: false };
    }
  }

  async createBulk(
    teacherId: string,
    schoolId: string,
    results: Array<{
      studentId: string;
      subjectId: string;
      termId: string;
      score: number;
    }>,
    roles: string[] = [],
    isSuperAdmin = false,
  ) {
    if (results.length === 0) return { created: 0, errors: 0, details: [] };

    const term = await this.prisma.term.findUnique({
      where: { id: results[0].termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId || term.resultsLocked) {
      throw new ForbiddenException('Results are locked or term not found');
    }

    const academicYearId = term.academicYearId;
    const firstTermId = results[0].termId;

    // ── Batch 1: Fetch all enrollments in one query ──
    const uniqueStudentIds = [...new Set(results.map(r => r.studentId))];
    const allEnrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: { in: uniqueStudentIds },
        academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      select: { studentId: true, classId: true },
    });
    const enrollmentMap = new Map(allEnrollments.map(e => [e.studentId, e.classId]));

    // ── Batch 2: Pre-check permissions once per unique (classId, subjectId) ──
    const uniqueClassSubjectPairs = new Set<string>();
    const missingEnrollment: any[] = [];
    for (const item of results) {
      const cid = enrollmentMap.get(item.studentId);
      if (!cid) {
        missingEnrollment.push({ studentId: item.studentId, subjectId: item.subjectId, error: 'Student not enrolled in this academic year' });
        continue;
      }
      uniqueClassSubjectPairs.add(`${cid}::${item.subjectId}`);
    }

    const permissionErrors: any[] = [];
    for (const pair of uniqueClassSubjectPairs) {
      const [classId, subjectId] = pair.split('::');
      try {
        await this.classAccess.assertCanEnterResults(
          { id: teacherId, schoolId, roles, isSuperAdmin },
          classId,
          subjectId,
          academicYearId,
        );
      } catch (e: any) {
        permissionErrors.push({ classId, subjectId, error: e.message });
      }
    }

    if (permissionErrors.length > 0 || missingEnrollment.length > 0) {
      const allErrors = [...missingEnrollment, ...permissionErrors];
      if (permissionErrors.length > 0 && missingEnrollment.length === 0) {
        throw new ForbiddenException(`Permission denied: ${permissionErrors[0].error}`);
      }
      // If some students are missing enrollments but permissions are fine, filter them out
      const unauthorizedPairs = new Set(permissionErrors.map(e => `${e.classId}::${e.subjectId}`));
      const blockedStudentIds = new Set(results
        .filter(r => {
          const cid = enrollmentMap.get(r.studentId);
          return !cid || unauthorizedPairs.has(`${cid}::${r.subjectId}`);
        })
        .map(r => r.studentId));
      if (blockedStudentIds.size > 0 && blockedStudentIds.size === uniqueStudentIds.length) {
        throw new ForbiddenException(allErrors[0].error);
      }
    }

    // ── Batch 3: Pre-fetch grading systems (one per unique classId) ──
    const uniqueClassIds = [...new Set(results.map(r => enrollmentMap.get(r.studentId)).filter(Boolean))] as string[];
    const gradingCache = new Map<string, any>();

    const classGradingSystems = await this.prisma.class.findMany({
      where: { id: { in: uniqueClassIds } },
      select: { id: true, gradingSystemId: true },
    });
    const classSystemIds = classGradingSystems
      .filter(c => c.gradingSystemId)
      .map(c => c.gradingSystemId);
    const uniqueSystemIds = [...new Set(classSystemIds)];

    if (uniqueSystemIds.length > 0) {
      const systems = await this.prisma.gradingSystem.findMany({
        where: { id: { in: uniqueSystemIds } },
        include: { gradeScales: true },
      });
      const systemMap = new Map(systems.map(s => [s.id, s]));
      for (const c of classGradingSystems) {
        if (c.gradingSystemId) gradingCache.set(c.id, systemMap.get(c.gradingSystemId));
      }
    }

    // Fallback: school-level grading systems (batch once)
    const schoolDefault = await this.prisma.gradingSystem.findFirst({
      where: { schoolId, isDefault: true },
      include: { gradeScales: true },
    });
    const anySchoolSystem = !schoolDefault
      ? await this.prisma.gradingSystem.findFirst({ where: { schoolId }, include: { gradeScales: true } })
      : null;
    const fallbackSystem = schoolDefault || anySchoolSystem;

    // Grade computation helper (pure in-memory, no DB calls)
    const computeGradeInMemory = (score: number, classId?: string): { grade: string; remark: string; points: number | null; gpa: number | null } => {
      let system: any = classId ? gradingCache.get(classId) : undefined;
      if (!system && fallbackSystem) system = fallbackSystem;
      if (!system) return { grade: 'N/A', remark: 'No grading system configured', points: null, gpa: null };

      const scale = system.gradeScales.find(
        (s: any) => score >= s.minScore && score < s.maxScore + 1,
      );
      if (!scale) return { grade: 'N/A', remark: 'Score out of range', points: null, gpa: null };
      return {
        grade: scale.grade,
        remark: scale.remark,
        points: (scale as any).points ?? null,
        gpa: (scale as any).gpa ?? null,
      };
    };

    // ── Batch 4: Execute upserts inside a transaction ──
    const created: any[] = [];
    const errors: any[] = [...missingEnrollment];
    const permBlockedPairs = new Set(permissionErrors.map(e => `${e.classId}::${e.subjectId}`));

    // Process in chunks of 50 to avoid transaction timeout
    const CHUNK_SIZE = 50;
    for (let i = 0; i < results.length; i += CHUNK_SIZE) {
      const chunk = results.slice(i, i + CHUNK_SIZE);
      const chunkResult = await this.prisma.$transaction(async (tx) => {
        const chunkCreated: any[] = [];
        const chunkErrors: any[] = [];

        for (const item of chunk) {
          try {
            const classId = enrollmentMap.get(item.studentId);
            if (!classId) continue; // already recorded in errors

            const pairKey = `${classId}::${item.subjectId}`;
            if (permBlockedPairs.has(pairKey)) continue;

            const gradeData = computeGradeInMemory(item.score, classId);

            const result = await tx.result.upsert({
              where: {
                studentId_subjectId_termId: {
                  studentId: item.studentId,
                  subjectId: item.subjectId,
                  termId: item.termId,
                },
              },
              update: {
                score: item.score,
                grade: gradeData.grade,
                remark: gradeData.remark,
                teacherId,
              },
              create: {
                studentId: item.studentId,
                subjectId: item.subjectId,
                termId: item.termId,
                teacherId,
                schoolId,
                score: item.score,
                grade: gradeData.grade,
                remark: gradeData.remark,
              },
            });

            await tx.computedResult.upsert({
              where: {
                studentId_subjectId_termId: {
                  studentId: item.studentId,
                  subjectId: item.subjectId,
                  termId: item.termId,
                },
              },
              update: {
                classId,
                schoolId,
                totalRawScore: item.score,
                finalPercentage: item.score,
                finalGrade: gradeData.grade,
                finalRemark: gradeData.remark,
                points: gradeData.points,
                gpa: gradeData.gpa,
                status: 'COMPUTED',
                computedAt: new Date(),
              },
              create: {
                studentId: item.studentId,
                subjectId: item.subjectId,
                termId: item.termId,
                classId: classId || '',
                schoolId,
                totalRawScore: item.score,
                finalPercentage: item.score,
                finalGrade: gradeData.grade,
                finalRemark: gradeData.remark,
                points: gradeData.points,
                gpa: gradeData.gpa,
                status: 'COMPUTED',
                computedAt: new Date(),
              },
            });

            chunkCreated.push(result);
          } catch (error: any) {
            chunkErrors.push({
              studentId: item.studentId,
              subjectId: item.subjectId,
              error: error.message,
            });
          }
        }
        return { created: chunkCreated, errors: chunkErrors };
      }, { maxWait: 30000, timeout: 60000 });

      created.push(...chunkResult.created);
      errors.push(...chunkResult.errors);
    }

    // ── Post-batch: Update result sheets ──
    if (created.length > 0) {
      const classIds = [...new Set(created.map(r => enrollmentMap.get(r.studentId)).filter(Boolean))] as string[];

      // Batch-fetch enrollment counts
      const enrollmentCounts = await this.prisma.enrollment.groupBy({
        by: ['classId'],
        where: {
          classId: { in: classIds },
          academicYearId,
          status: 'ACTIVE',
          student: { status: 'ACTIVE' },
        },
        _count: { id: true },
      });
      const enrollmentCountMap = new Map(enrollmentCounts.map(e => [e.classId, e._count.id]));

      // Batch-fetch existing sheets
      const existingSheets = await this.prisma.resultSheet.findMany({
        where: { classId: { in: classIds }, termId: firstTermId, schoolId },
        select: { classId: true, id: true },
      });
      const sheetMap = new Map(existingSheets.map(s => [s.classId, s]));

      for (const classId of classIds) {
        const enrolled = enrollmentCountMap.get(classId) || 0;
        const entered = created.filter(r => enrollmentMap.get(r.studentId) === classId).length;
        const sheetInfo = await this.ensureSheet(schoolId, classId, firstTermId, academicYearId, teacherId);
        if (sheetInfo.justCreated) {
          await this.prisma.resultSheet.updateMany({
            where: { classId, termId: firstTermId, schoolId },
            data: { totalStudents: enrolled },
          });
        } else {
          await this.prisma.resultSheet.updateMany({
            where: { classId, termId: firstTermId, schoolId },
            data: { totalStudents: enrolled, enteredCount: { increment: entered } },
          });
        }
        await this.autoSubmitSheet(schoolId, classId, firstTermId, teacherId);
      }

      // ── Emit real-time events (fire-and-forget) ──
      if (this.schoolEvents) {
        const [teacher, ...classNames] = await Promise.all([
          this.prisma.user.findUnique({ where: { id: teacherId }, select: { firstName: true, lastName: true } }),
          ...classIds.map(cid => this.prisma.class.findUnique({ where: { id: cid }, select: { id: true, name: true } })),
        ]);
        const classNamesMap = new Map(classNames.filter(Boolean).map((c: any) => [c.id, c.name]));
        const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : undefined;

        for (const classId of classIds) {
          const classResults = created.filter(r => enrollmentMap.get(r.studentId) === classId);
          const subjectIds = [...new Set(classResults.map(r => r.subjectId))];
          this.schoolEvents.emitResultsSaved(schoolId, {
            classId,
            termId: firstTermId,
            subjectId: subjectIds.length === 1 ? subjectIds[0] : undefined,
            savedBy: teacherId,
            count: classResults.length,
          });
          this.schoolEvents.emitResultsLive(schoolId, {
            id: `${classId}-${firstTermId}-${Date.now()}`,
            classId,
            termId: firstTermId,
            subjectId: subjectIds.length === 1 ? subjectIds[0] : undefined,
            score: classResults[0]?.score ?? null,
            count: classResults.length,
            savedBy: teacherId,
            timestamp: new Date(),
            action: 'result-saved',
            teacherName,
            className: classNamesMap.get(classId),
            subjectName: classResults[0]?.subject?.name,
            teacher: teacher ? { id: teacherId, firstName: teacher.firstName, lastName: teacher.lastName } : undefined,
            class: classId ? { id: classId, name: classNamesMap.get(classId) } : undefined,
          });
        }
      }
    }

    return {
      created: created.length,
      errors: errors.length,
      details: errors,
    };
  }

  async update(
    id: string,
    userId: string,
    schoolId: string,
    score: number,
    roles: string[] = [],
    isSuperAdmin = false,
  ) {
    const result = await this.prisma.result.findUnique({
      where: { id },
      include: { term: { include: { academicYear: true } } },
    });

    if (!result || result.schoolId !== schoolId) {
      throw new NotFoundException('Result not found');
    }

    if (result.term.resultsLocked) {
      throw new ForbiddenException('Results are locked. Contact administrator.');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: result.studentId,
        schoolId,
        academicYearId: result.term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      select: { classId: true },
    });

    if (!enrollment) throw new ForbiddenException('Student is not enrolled in this academic year');

    await this.classAccess.assertCanEnterResults(
      { id: userId, schoolId, roles, isSuperAdmin },
      enrollment.classId,
      result.subjectId,
      result.term.academicYearId,
    );

    const gradeData = await this.calculateGrade(score, schoolId, enrollment?.classId);

    const updated = await this.prisma.result.update({
      where: { id },
      data: {
        score,
        grade: gradeData.grade,
        remark: gradeData.remark,
        teacherId: userId,
      },
      include: {
        student: true,
        subject: true,
      },
    });

    await this.prisma.computedResult.upsert({
      where: {
        studentId_subjectId_termId: {
          studentId: result.studentId,
          subjectId: result.subjectId,
          termId: result.termId,
        },
      },
      update: {
        totalRawScore: score,
        finalPercentage: score,
        finalGrade: gradeData.grade,
        finalRemark: gradeData.remark,
        points: gradeData.points,
        gpa: gradeData.gpa,
        status: 'COMPUTED',
        computedAt: new Date(),
      },
      create: {
        studentId: result.studentId,
        subjectId: result.subjectId,
        termId: result.termId,
        classId: enrollment?.classId || '',
        schoolId,
        totalRawScore: score,
        finalPercentage: score,
        finalGrade: gradeData.grade,
        finalRemark: gradeData.remark,
        points: gradeData.points,
        gpa: gradeData.gpa,
        status: 'COMPUTED',
        computedAt: new Date(),
      },
    });

    return updated;
  }

  async delete(id: string, schoolId: string) {
    const result = await this.prisma.result.findUnique({
      where: { id },
      include: { term: true },
    });

    if (!result || result.schoolId !== schoolId) {
      throw new NotFoundException('Result not found');
    }

    if (result.term.resultsLocked) {
      throw new ForbiddenException('Cannot delete locked results');
    }

    await this.prisma.result.delete({ where: { id } });

    return { message: 'Result deleted successfully' };
  }

  async calculateGrade(score: number, schoolId: string, classId?: string) {
    const codeToName: Record<string, string> = {
      PRIMARY_ECZ: 'Primary Grading System',
      GRADE7_ECZ: 'ECZ Grade 7 Grading System',
      SECONDARY_ECZ: 'ECZ Secondary Grading System',
      ADVANCED_A_LEVEL: 'ECZ Secondary Grading System',
      FORMS_ECZ: 'ECZ Forms Grading System',
      COLLEGE_GPA: 'College GPA Grading System',
      UNIVERSITY_CGPA: 'University CGPA Grading System',
    };

    let gradingSystem: any;
    let resolvedVia = 'none';

    // Level 1: Check class-level grading system
    if (classId) {
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
        select: { gradingSystemId: true, name: true },
      });
      if (cls?.gradingSystemId) {
        gradingSystem = await this.prisma.gradingSystem.findUnique({
          where: { id: cls.gradingSystemId },
          include: { gradeScales: true },
        });
        if (gradingSystem) resolvedVia = `class (${cls.name})`;
      }
    }

    // Level 2: Check school's default grading system (isDefault = true)
    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId, isDefault: true },
        include: { gradeScales: true },
      });
      if (gradingSystem) resolvedVia = 'school default (isDefault)';
    }

    // Level 3: Check SchoolSetting.gradingSystem code mapping
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
      if (gradingSystem) resolvedVia = `school setting (${schoolSetting?.gradingSystem})`;
    }

    // Level 4: Any grading system for the school
    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId },
        include: { gradeScales: true },
      });
      if (gradingSystem) resolvedVia = 'any school grading system';
    }

    if (!gradingSystem) {
      this.logger.warn(`No grading system found for school ${schoolId}, classId ${classId}`);
      return { grade: 'N/A', remark: 'No grading system configured', points: null, gpa: null };
    }

    this.logger.debug(
      `Grading resolved via "${resolvedVia}" (system: ${gradingSystem.name}), score: ${score}, schoolId: ${schoolId}, classId: ${classId}`,
    );

    const scale = gradingSystem.gradeScales.find(
      (s) => score >= s.minScore && score < s.maxScore + 1,
    );

    if (!scale) {
      this.logger.warn(
        `Score ${score} not covered by any grade scale in "${gradingSystem.name}" (${gradingSystem.gradeScales.map(s => `${s.minScore}-${s.maxScore}=${s.grade}`).join(', ')})`,
      );
      return { grade: 'N/A', remark: 'Score out of range', points: null, gpa: null };
    }

    return {
      grade: scale.grade,
      remark: scale.remark,
      points: (scale as any).points ?? null,
      gpa: (scale as any).gpa ?? null,
    };
  }

  async generateResultTemplate(
    userId: string,
    schoolId: string,
    termId: string,
    classId: string | undefined,
    roles: string[],
  ) {
    this.logger.log(`generateResultTemplate: userId=${userId}, schoolId=${schoolId}, termId=${termId}, classId=${classId}, roles=${JSON.stringify(roles)}`);

    const [school, term] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId } }),
      this.prisma.term.findUnique({
        where: { id: termId },
        include: { academicYear: true },
      }),
    ]);

    if (!term) {
      throw new NotFoundException('Term not found');
    }

    if (term.resultsLocked) {
      throw new ForbiddenException('Results for this term have been finalized');
    }

    const normalizedRoles = (roles || []).map((r) => r.toUpperCase());
    const isFullAccess =
      normalizedRoles.includes('DIRECTOR') ||
      normalizedRoles.includes('CLASS TEACHER');

    let className = '';
    let classEntity: any = null;

    if (classId) {
      classEntity = await this.prisma.class.findUnique({
        where: { id: classId },
      });
      if (!classEntity) throw new NotFoundException('Class not found');
      className = classEntity.name;
    }

    // When a class is selected, pull every subject assigned to that class so
    // non-assigned subjects can be rendered as read-only columns. Without a
    // class, fall back to the current user's own assignments.
    let assignments = await this.prisma.teachingAssignment.findMany({
      where: {
        schoolId,
        academicYearId: term.academicYearId,
        ...(classId ? { classId } : { teacherId: userId }),
      },
      include: { subject: true, class: true },
    });

    // Full-access users (Director/Class Teacher) see every subject assigned
    // for this term even when no class is selected.
    if (!classId && isFullAccess && assignments.length === 0) {
      assignments = await this.prisma.teachingAssignment.findMany({
        where: { schoolId, academicYearId: term.academicYearId },
        include: { subject: true, class: true },
      });
    }

    // Directors may not have teaching assignments at all. When a class is
    // selected and the user has full access, fall back to ClassSubject records
    // so they can still download and fill the template.
    if (classId && isFullAccess && assignments.length === 0) {
      const classSubjects = await this.prisma.classSubject.findMany({
        where: { classId, schoolId },
        include: { subject: true, class: true },
      });
      if (classSubjects.length > 0) {
        assignments = classSubjects.map((cs) => ({
          ...cs,
          teacherId: userId,
          academicYearId: term.academicYearId,
        })) as any;
      }
    }

    if (assignments.length === 0) {
      throw new ForbiddenException('No teaching assignments found');
    }

    // Deduplicate subjects while preserving first-seen order.
    const subjectById = new Map<string, { id: string; name: string; code?: string }>();
    for (const a of assignments) {
      if (!subjectById.has(a.subjectId)) {
        subjectById.set(a.subjectId, {
          id: a.subjectId,
          name: a.subject.name,
          code: a.subject.code || undefined,
        });
      }
    }

    // Subject teachers may only edit subjects from their own teaching
    // assignment; Directors and Class Teachers may edit every column.
    const editableSubjectIds = new Set<string>();
    if (isFullAccess) {
      for (const id of subjectById.keys()) editableSubjectIds.add(id);
    } else {
      for (const a of assignments) {
        if (a.teacherId === userId) editableSubjectIds.add(a.subjectId);
      }
    }

    const subjects = [...subjectById.values()].map((s) => ({
      ...s,
      editable: editableSubjectIds.has(s.id),
    }));

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        ...(classId ? { classId } : { classId: { in: [...new Set(assignments.map((a) => a.classId))] } }),
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      include: { student: true, class: true },
      orderBy: { student: { firstName: 'asc' } },
    });

    return this.createExcelTemplate({
      school,
      term,
      classId,
      className,
      subjects,
      enrollments,
    });
  }

  private async createExcelTemplate(data: {
    school: any;
    term: any;
    classId?: string;
    className: string;
    subjects: Array<{ id: string; name: string; code?: string; editable: boolean }>;
    enrollments: any[];
  }): Promise<Buffer> {
    const { school, term, className, subjects, enrollments } = data;
    const subjectNames = subjects.map((s) => s.name);
    const totalCols = 4 + subjectNames.length;

    const brandColor = '5F4B3A';
    const darkColor = '1A1A2E';
    const secondaryBg = 'F5EFE8';
    const lightBg = 'FDFAF7';
    const whiteText = 'FFFFFF';
    const borderColor = 'D8CDBF';

    const thinBorder = {
      top: { style: 'thin' as const, color: { argb: borderColor } },
      left: { style: 'thin' as const, color: { argb: borderColor } },
      bottom: { style: 'thin' as const, color: { argb: borderColor } },
      right: { style: 'thin' as const, color: { argb: borderColor } },
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SmartTech SaaS';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Results', {
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
    });

    ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 7 }];

    // Column widths
    const widths = [18, 16, 16, 14, ...subjectNames.map(() => 15)];
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    // Row 1: School name banner
    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = school?.name || 'SCHOOL NAME';
    titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: whiteText } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandColor } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = thinBorder;
    ws.getRow(1).height = 36;

    // Row 2: School details
    const schoolLine = [
      school?.address,
      school?.phone,
      school?.email,
      school?.motto,
    ].filter(Boolean).join('   |   ');
    if (schoolLine) {
      ws.mergeCells(2, 1, 2, totalCols);
      const subCell = ws.getCell(2, 1);
      subCell.value = schoolLine;
      subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '6B7280' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 20;
    }

    // Row 3: spacer
    ws.getRow(3).height = 6;

    // Row 4: Academic info block (term, year, class, assessment type)
    ws.mergeCells(4, 1, 4, totalCols);
    const infoCell = ws.getCell(4, 1);
    infoCell.value = [
      `ACADEMIC YEAR: ${term.academicYear?.name || ''}`,
      `TERM: ${term.name || ''}`,
      `CLASS: ${className || 'All Classes'}`,
      `ASSESSMENT TYPE: END OF TERM EXAM`,
    ].join('    |    ');
    infoCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: darkColor } };
    infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: secondaryBg } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    infoCell.border = thinBorder;
    ws.getRow(4).height = 26;

    // Row 5: Generated note
    ws.mergeCells(5, 1, 5, totalCols);
    const genCell = ws.getCell(5, 1);
    genCell.value = `Generated: ${new Date().toLocaleString()}   |   Enter scores from 0 to 100. Use X or A for absent students.`;
    genCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '6B7280' } };
    genCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(5).height = 18;

    // Row 6: spacer
    ws.getRow(6).height = 6;

    // Row 7: Column headers (use subject shortcuts, never the numeric codes)
    const subjectLabels = subjects.map((s) => getSubjectShortcut(s.name));
    const headers = ['AdmissionNumber', 'FirstName', 'LastName', 'Class', ...subjectLabels];
    const headerRow = ws.getRow(7);
    headerRow.height = 28;
    headers.forEach((name, idx) => {
      const cell = headerRow.getCell(idx + 1);
      const isSubject = idx >= 4;
      const subjectMeta = isSubject ? subjects[idx - 4] : null;
      const isReadOnly = !!subjectMeta && !subjectMeta.editable;
      cell.value = isReadOnly ? `${name} (READ-ONLY)` : name;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: whiteText } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isReadOnly ? '8A8578' : idx >= 4 ? brandColor : darkColor },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
      cell.protection = { locked: true };
    });

    // Data rows
    let rowIndex = 8;
    enrollments.forEach((e, i) => {
      const row = ws.getRow(rowIndex);
      row.height = 20;
      const studentCols = [
        e.student.admissionNumber || '',
        e.student.firstName || '',
        e.student.lastName || '',
        e.class?.name || className || '',
      ];
      studentCols.forEach((val, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 11, color: { argb: darkColor } };
        cell.alignment = { horizontal: idx === 0 ? 'center' : 'left', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? lightBg : secondaryBg } };
        cell.border = thinBorder;
        cell.protection = { locked: true };
      });
      subjects.forEach((subject, idx) => {
        const col = idx + 5;
        const cell = row.getCell(col);
        cell.font = { name: 'Calibri', size: 11, color: { argb: darkColor } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? lightBg : secondaryBg } };
        cell.border = thinBorder;
        cell.numFmt = '0.0';
        // Only subjects the current user is assigned to teach (plus full-access
        // roles) are editable; the rest stay locked/read-only.
        cell.protection = { locked: !subject.editable };
      });
      rowIndex++;
    });

    // Row after data: legend note
    ws.mergeCells(rowIndex + 1, 1, rowIndex + 1, totalCols);
    const legendCell = ws.getCell(rowIndex + 1, 1);
    legendCell.value =
      'LEGEND:  X = absent (excused)  |  A = absent (unexcused)  |  blank = not yet entered  |  Do NOT modify the AdmissionNumber, FirstName, LastName or Class columns.  Columns marked READ-ONLY are protected and cannot be edited.';
    legendCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '6B7280' } };
    legendCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(rowIndex + 1).height = 18;

    // Protect the worksheet so locked (read-only) cells cannot be edited.
    await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true });

    // ── Instructions sheet ──
    const instructions = workbook.addWorksheet('Instructions');
    instructions.getColumn(1).width = 110;
    instructions.getCell(1, 1).value = 'HOW TO USE THIS RESULTS TEMPLATE';
    instructions.getCell(1, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: brandColor } };
    instructions.getRow(1).height = 28;

    const steps = [
      '1. Do not change the AdmissionNumber, FirstName, LastName or Class columns. The student data is pre-filled.',
      '2. Enter each student\u2019s score (0 - 100) under the correct subject column.',
      '3. Use the letter X (excused absence) or A (unexcused absence) for students who were absent for a subject.',
      '4. Leave a cell blank if the subject has not been entered yet. Blank cells are skipped on upload.',
      '5. Scores are graded automatically using the school\u2019s grading system (grades and points are computed for you).',
      '6. Save the file, then upload it on the "Upload Results" page. Existing results are updated, new ones are added.',
      '7. After uploading, verify entries on the "Review Results" tab, then publish from the "Publish Results" tab.',
      '8. Absent students (X/A) are respected in analytics and reports - they are not counted as zero scores.',
      '9. Subject columns marked READ-ONLY are protected. You can only enter scores for subjects you are assigned to teach.',
    ];
    steps.forEach((step, i) => {
      const cell = instructions.getCell(i + 2, 1);
      cell.value = step;
      cell.font = { name: 'Calibri', size: 11, color: { argb: darkColor } };
      instructions.getRow(i + 2).height = 22;
    });

    // Subject shortcut legend (shortcuts used as column headers)
    const legendStart = steps.length + 3;
    const legendTitle = instructions.getCell(legendStart, 1);
    legendTitle.value = 'SUBJECT SHORTCUTS USED IN THIS TEMPLATE:';
    legendTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: brandColor } };
    instructions.getRow(legendStart).height = 22;
    subjects.forEach((s, i) => {
      const cell = instructions.getCell(legendStart + 1 + i, 1);
      cell.value = `${getSubjectShortcut(s.name)}   =   ${s.name}`;
      cell.font = { name: 'Calibri', size: 11, color: { argb: darkColor } };
      instructions.getRow(legendStart + 1 + i).height = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async uploadExcelResults(
    userId: string,
    schoolId: string,
    termId: string,
    file: Express.Multer.File,
    roles: string[],
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid term');
    }

    if (term.resultsLocked) {
      throw new ForbiddenException(
        'Results are locked. Contact administrator to unlock.',
      );
    }

    const normalizedRoles = (roles || []).map((r) => r.toUpperCase());
    const isFullAccess =
      normalizedRoles.includes('DIRECTOR') ||
      normalizedRoles.includes('CLASS TEACHER');

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      throw new BadRequestException('Excel file is empty');
    }

    const subjects = await this.prisma.subject.findMany({
      where: { schoolId },
    });

    // Match subject columns by shortcut, name OR code so templates using
    // shortcuts (new), full names (older) or numeric codes all upload correctly.
    const subjectMap = new Map<string, string>();
    for (const s of subjects) {
      subjectMap.set(s.name.toLowerCase(), s.id);
      subjectMap.set(getSubjectShortcut(s.name).toLowerCase(), s.id);
      if (s.code) subjectMap.set(s.code.toLowerCase(), s.id);
    }

    let inserted = 0;
    let updated = 0;
    let absentCount = 0;
    let errors: string[] = [];

    for (const row of rows) {
      const admissionNumber = String(row['AdmissionNumber'] || '').trim();

      if (!admissionNumber) {
        errors.push('Missing AdmissionNumber in row');
        continue;
      }

      const student = await this.prisma.student.findFirst({
        where: { admissionNumber, schoolId, status: 'ACTIVE' },
      });

      if (!student) {
        errors.push(`Student not found: ${admissionNumber}`);
        continue;
      }

      // Resolve the student's class once per row.
      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          academicYearId: term.academicYearId,
          status: 'ACTIVE',
          student: { status: 'ACTIVE' },
        },
        include: { class: true },
      });

      for (const column in row) {
        // Read-only columns carry a "(READ-ONLY)" suffix on the template
        // header; strip it so the subject can still be validated and rejected
        // with a clear error if a subject teacher tries to fill it in.
        const rawColLower = column.toLowerCase();
        const colLower = rawColLower.replace(/\s*\(read-only\)\s*$/, '').trim();
        if (['admissionnumber', 'firstname', 'lastname', 'class'].includes(colLower)) continue;

        const subjectId = subjectMap.get(colLower);

        if (!subjectId) continue;

        const val = row[column];
        if (val === undefined || val === '' || val === null) continue;

        // Subject-level access control: subject teachers may only enter
        // results for the subject/class they are assigned to teach.
        if (!isFullAccess) {
          const allowed = await this.prisma.teachingAssignment.findFirst({
            where: {
              teacherId: userId,
              subjectId,
              academicYearId: term.academicYearId,
              schoolId,
              ...(enrollment ? { classId: enrollment.classId } : {}),
            },
          });
          if (!allowed) {
            const subject = subjects.find((s) => s.id === subjectId);
            const context = enrollment?.class?.name
              ? ` in ${enrollment.class.name}`
              : '';
            errors.push(
              `Not allowed: you are not assigned to teach ${subject?.name || column}${context}`,
            );
            continue;
          }
        }

        const valStr = String(val).trim();
        const isAbsent = /^(X|A)$/i.test(valStr);
        const absentCode = isAbsent ? valStr.toUpperCase() : null;

        let score: number;
        if (isAbsent) {
          score = 0;
        } else {
          score = Number(val);
          if (isNaN(score) || score < 0 || score > 100) {
            errors.push(`Invalid score for ${student.admissionNumber} in ${column} (got "${valStr}")`);
            continue;
          }
        }

        let assignedTeacherId = userId;

        if (enrollment) {
          // Find teaching assignment for this subject and class
          const assignment = await this.prisma.teachingAssignment.findFirst({
            where: {
              subjectId,
              classId: enrollment.classId,
              academicYearId: term.academicYearId,
              schoolId,
            },
          });

          if (assignment) {
            assignedTeacherId = assignment.teacherId;
          }
        }

        const gradeData = isAbsent
          ? { grade: null, remark: `ABSENT (${absentCode})`, points: null, gpa: null }
          : await this.calculateGrade(score, schoolId, enrollment?.classId);

        const existing = await this.prisma.result.findFirst({
          where: { studentId: student.id, subjectId, termId, student: { status: 'ACTIVE' } },
        });

        if (existing) {
          await this.prisma.result.update({
            where: { id: existing.id },
            data: {
              score,
              grade: gradeData.grade,
              remark: gradeData.remark,
              teacherId: assignedTeacherId,
            },
          });
          updated++;
        } else {
          await this.prisma.result.create({
            data: {
              score,
              studentId: student.id,
              subjectId,
              termId,
              schoolId,
              teacherId: assignedTeacherId,
              grade: gradeData.grade,
              remark: gradeData.remark,
            },
          });
          inserted++;
        }

        // Keep ComputedResult in sync (respect X/A absent students for analytics)
        await this.prisma.computedResult.upsert({
          where: {
            studentId_subjectId_termId: {
              studentId: student.id,
              subjectId,
              termId,
            },
          },
          update: {
            totalRawScore: score,
            finalPercentage: isAbsent ? null : score,
            finalGrade: gradeData.grade,
            finalRemark: gradeData.remark,
            points: gradeData.points,
            gpa: gradeData.gpa,
            isAbsent,
            metadata: isAbsent ? { absentCode } : {},
            status: 'COMPUTED',
            computedAt: new Date(),
          },
          create: {
            studentId: student.id,
            subjectId,
            termId,
            classId: enrollment?.classId || '',
            schoolId,
            totalRawScore: score,
            finalPercentage: isAbsent ? null : score,
            finalGrade: gradeData.grade,
            finalRemark: gradeData.remark,
            points: gradeData.points,
            gpa: gradeData.gpa,
            isAbsent,
            metadata: isAbsent ? { absentCode } : {},
            status: 'COMPUTED',
            computedAt: new Date(),
          },
        });

        if (isAbsent) absentCount++;
      }
    }

    return {
      message: 'Results uploaded successfully',
      rowsProcessed: rows.length,
      resultsInserted: inserted,
      resultsUpdated: updated,
      resultsAbsent: absentCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async recalculateGrades(
    teacherId: string,
    schoolId: string,
    classId: string,
    termId: string,
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid term');
    }

    if (term.resultsLocked) {
      throw new ForbiddenException('Results are locked. Contact administrator.');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
    });

    const studentIds = enrollments.map((e) => e.studentId);

    const results = await this.prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        termId,
        schoolId,
        student: { status: 'ACTIVE' },
      },
    });

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        studentId: { in: studentIds },
        termId,
        schoolId,
      },
      select: { studentId: true, subjectId: true, isAbsent: true },
    });
    const absentKeys = new Set(
      computedResults.filter((c) => c.isAbsent).map((c) => `${c.studentId}|${c.subjectId}`),
    );

    let updated = 0;

    for (const result of results) {
      const isAbsent = absentKeys.has(`${result.studentId}|${result.subjectId}`);
      const gradeData = isAbsent
        ? { grade: null, remark: 'ABSENT', points: null, gpa: null }
        : await this.calculateGrade(result.score, schoolId, classId);

      await this.prisma.result.update({
        where: { id: result.id },
        data: {
          grade: gradeData.grade,
          remark: gradeData.remark,
          teacherId,
        },
      });

      // Keep ComputedResult in sync so points/grades stay consistent for
      // reports and the Results Management (Central Hub) workflow.
      await this.prisma.computedResult.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId: result.studentId,
            subjectId: result.subjectId,
            termId,
          },
        },
        update: {
          totalRawScore: result.score,
          finalPercentage: isAbsent ? null : result.score,
          finalGrade: gradeData.grade,
          finalRemark: gradeData.remark,
          points: gradeData.points,
          gpa: gradeData.gpa,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
        create: {
          studentId: result.studentId,
          subjectId: result.subjectId,
          termId,
          classId,
          schoolId,
          totalRawScore: result.score,
          finalPercentage: isAbsent ? null : result.score,
          finalGrade: gradeData.grade,
          finalRemark: gradeData.remark,
          points: gradeData.points,
          gpa: gradeData.gpa,
          isAbsent,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
      });

      updated++;
    }

    return {
      message: 'Grades recalculated successfully',
      resultsUpdated: updated,
    };
  }

  async recalculatePoints(
    teacherId: string,
    schoolId: string,
    classId: string,
    termId: string,
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid term');
    }

    if (term.resultsLocked) {
      throw new ForbiddenException('Results are locked. Contact administrator.');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
    });

    const studentIds = enrollments.map((e) => e.studentId);

    const results = await this.prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        termId,
        schoolId,
        student: { status: 'ACTIVE' },
      },
    });

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        studentId: { in: studentIds },
        termId,
        schoolId,
      },
      select: { studentId: true, subjectId: true, isAbsent: true },
    });
    const absentKeys = new Set(
      computedResults.filter((c) => c.isAbsent).map((c) => `${c.studentId}|${c.subjectId}`),
    );

    let updated = 0;

    for (const result of results) {
      const isAbsent = absentKeys.has(`${result.studentId}|${result.subjectId}`);
      const gradeData = isAbsent
        ? { grade: null, remark: 'ABSENT', points: null, gpa: null }
        : await this.calculateGrade(result.score, schoolId, classId);

      await this.prisma.computedResult.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId: result.studentId,
            subjectId: result.subjectId,
            termId,
          },
        },
        update: {
          totalRawScore: result.score,
          finalPercentage: isAbsent ? null : result.score,
          finalGrade: gradeData.grade,
          finalRemark: gradeData.remark,
          points: gradeData.points,
          gpa: gradeData.gpa,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
        create: {
          studentId: result.studentId,
          subjectId: result.subjectId,
          termId,
          classId,
          schoolId,
          totalRawScore: result.score,
          finalPercentage: isAbsent ? null : result.score,
          finalGrade: gradeData.grade,
          finalRemark: gradeData.remark,
          points: gradeData.points,
          gpa: gradeData.gpa,
          isAbsent,
          status: 'COMPUTED',
          computedAt: new Date(),
        },
      });

      updated++;
    }

    return {
      message: 'Points recalculated successfully',
      resultsUpdated: updated,
    };
  }
}
