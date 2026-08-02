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

@Injectable()
export class ResultService {
  private readonly logger = new Logger(ResultService.name);

  constructor(private prisma: PrismaService) {}

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
    return this.prisma.result.findMany({
      where: {
        studentId,
        termId,
        schoolId,
        student: { status: 'ACTIVE' },
      },
      include: {
        student: true,
        subject: true,
        term: true,
      },
      orderBy: { subject: { name: 'asc' } },
    });
  }

  async create(
    userId: string,
    schoolId: string,
    studentId: string,
    subjectId: string,
    termId: string,
    score: number,
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
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('Student not enrolled in this academic year');
    }

    // Find teaching assignment for this subject and class
    let assignment = await this.prisma.teachingAssignment.findFirst({
      where: {
        subjectId,
        classId: enrollment.classId,
        academicYearId: term.academicYearId,
        schoolId,
      },
    });

    // If no assignment found, try to find by userId
    if (!assignment) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId },
      });
      if (teacher) {
        assignment = await this.prisma.teachingAssignment.findFirst({
          where: {
            teacherId: teacher.id,
            subjectId,
            academicYearId: term.academicYearId,
            schoolId,
          },
        });
      }
    }

    // For directors, teaching assignment is not required — use userId as fallback
    const teacherId = assignment?.teacherId || userId;

    const gradeData = await this.calculateGrade(score, schoolId, enrollment.classId);

    const existing = await this.prisma.result.findFirst({
      where: { studentId, subjectId, termId, student: { status: 'ACTIVE' } },
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

      // Update ResultSheet enteredCount
      await this.prisma.resultSheet.updateMany({
        where: { classId: enrollment.classId, termId, schoolId },
        data: { enteredCount: { increment: 1 } },
      }).catch(() => {});

      return created;
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
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: results[0].termId },
      include: { academicYear: true },
    });

    if (!term || term.resultsLocked) {
      throw new ForbiddenException('Results are locked or term not found');
    }

    const created: any[] = [];
    const errors: any[] = [];

    const enrollmentMap = new Map<string, string>();
    const uniqueStudentIds = [...new Set(results.map(r => r.studentId))];
    const allEnrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: { in: uniqueStudentIds },
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      select: { studentId: true, classId: true },
    });
    for (const e of allEnrollments) {
      enrollmentMap.set(e.studentId, e.classId);
    }

    for (const item of results) {
      try {
        const classId = enrollmentMap.get(item.studentId);
        const gradeData = await this.calculateGrade(item.score, schoolId, classId);
        const result = await this.prisma.result.upsert({
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
        created.push(result);

        await this.prisma.computedResult.upsert({
          where: {
            studentId_subjectId_termId: {
              studentId: item.studentId,
              subjectId: item.subjectId,
              termId: item.termId,
            },
          },
          update: {
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
      } catch (error: any) {
        errors.push({
          studentId: item.studentId,
          subjectId: item.subjectId,
          error: error.message,
        });
      }
    }

    if (created.length > 0) {
      const firstTermId = results[0].termId;
      const classIds = [...new Set(created.map(r => enrollmentMap.get(r.studentId)).filter(Boolean))] as string[];
      for (const classId of classIds) {
        const enrolled = await this.prisma.enrollment.count({
          where: { classId, academicYearId: term.academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
        });
        const entered = created.filter(r => enrollmentMap.get(r.studentId) === classId).length;
        await this.prisma.resultSheet.updateMany({
          where: { classId, termId: firstTermId, examType: 'END_TERM' },
          data: { totalStudents: enrolled, enteredCount: { increment: entered } },
        });
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
    teacherId: string,
    schoolId: string,
    score: number,
  ) {
    const result = await this.prisma.result.findUnique({
      where: { id },
      include: { term: true },
    });

    if (!result || result.schoolId !== schoolId) {
      throw new NotFoundException('Result not found');
    }

    if (result.term.resultsLocked) {
      throw new ForbiddenException('Results are locked. Contact administrator.');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: result.studentId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      select: { classId: true },
    });

    const gradeData = await this.calculateGrade(score, schoolId, enrollment?.classId);

    const updated = await this.prisma.result.update({
      where: { id },
      data: {
        score,
        grade: gradeData.grade,
        remark: gradeData.remark,
        teacherId,
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
      (s) => score >= s.minScore && score <= s.maxScore,
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

    if (assignments.length === 0) {
      throw new ForbiddenException('No teaching assignments found');
    }

    // Deduplicate subjects while preserving first-seen order.
    const subjectById = new Map<string, { id: string; name: string }>();
    for (const a of assignments) {
      if (!subjectById.has(a.subjectId)) {
        subjectById.set(a.subjectId, { id: a.subjectId, name: a.subject.name });
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
    subjects: Array<{ id: string; name: string; editable: boolean }>;
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

    // Row 7: Column headers
    const headers = ['AdmissionNumber', 'FirstName', 'LastName', 'Class', ...subjectNames];
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

    const subjectMap = new Map(
      subjects.map((s) => [s.name.toLowerCase(), s.id]),
    );

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
