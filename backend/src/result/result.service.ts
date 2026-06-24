import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

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

    return this.prisma.result.findMany({
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

    if (!assignment) {
      throw new ForbiddenException('Teacher not assigned to this subject/class');
    }

    const existing = await this.prisma.result.findFirst({
      where: { studentId, subjectId, termId },
    });

    if (existing) {
      throw new BadRequestException('Result already recorded. Use update instead.');
    }

    const gradeData = await this.calculateGrade(score, schoolId);

    return this.prisma.result.create({
      data: {
        studentId,
        subjectId,
        termId,
        teacherId: assignment.teacherId,
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

    for (const item of results) {
      try {
        const gradeData = await this.calculateGrade(item.score, schoolId);
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
      } catch (error: any) {
        errors.push({
          studentId: item.studentId,
          subjectId: item.subjectId,
          error: error.message,
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

    const gradeData = await this.calculateGrade(score, schoolId);

    return this.prisma.result.update({
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

  async calculateGrade(score: number, schoolId: string) {
    const codeToName: Record<string, string> = {
      PRIMARY_ECZ: 'ECZ Primary Grading System',
      SECONDARY_ECZ: 'ECZ Secondary Grading System',
      FORMS_ECZ: 'ECZ Forms Grading System',
      COLLEGE_GPA: 'College GPA Grading System',
      UNIVERSITY_CGPA: 'University CGPA Grading System',
    };

    const schoolSetting = await this.prisma.schoolSetting.findUnique({
      where: { schoolId },
    });

    const preferredName = schoolSetting?.gradingSystem
      ? codeToName[schoolSetting.gradingSystem]
      : undefined;

    let gradingSystem = preferredName
      ? await this.prisma.gradingSystem.findFirst({
          where: { schoolId, name: preferredName },
          include: { gradeScales: true },
        })
      : undefined;

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
      return { grade: 'N/A', remark: 'No grading system configured' };
    }

    const scale = gradingSystem.gradeScales.find(
      (s) => score >= s.minScore && score <= s.maxScore,
    );

    if (!scale) {
      return { grade: 'N/A', remark: 'Score out of range' };
    }

    return {
      grade: scale.grade,
      remark: scale.remark,
    };
  }

  async generateResultTemplate(
    teacherId: string,
    schoolId: string,
    termId: string,
    classId?: string,
  ) {
    this.logger.log(`generateResultTemplate: teacherId=${teacherId}, schoolId=${schoolId}, termId=${termId}, classId=${classId}`);

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

    let className = '';
    let classEntity: any = null;

    if (classId) {
      classEntity = await this.prisma.class.findUnique({
        where: { id: classId },
      });
      if (!classEntity) throw new NotFoundException('Class not found');
      className = classEntity.name;
    }

    let assignments = await this.prisma.teachingAssignment.findMany({
      where: {
        ...(teacherId ? { teacherId } : {}),
        schoolId,
        academicYearId: term.academicYearId,
        ...(classId ? { classId } : {}),
      },
      include: { subject: true, class: true },
    });

    if (assignments.length === 0 && classId) {
      assignments = await this.prisma.teachingAssignment.findMany({
        where: { classId, academicYearId: term.academicYearId },
        include: { subject: true, class: true },
      });
    }

    if (assignments.length === 0) {
      throw new ForbiddenException('No teaching assignments found');
    }

    const subjectNames = [...new Set(assignments.map((a) => a.subject.name))];

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        ...(classId ? { classId } : { classId: { in: [...new Set(assignments.map((a) => a.classId))] } }),
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
      },
      include: { student: true, class: true },
      orderBy: { student: { firstName: 'asc' } },
    });

    return this.createExcelTemplate({
      school,
      term,
      classId,
      className,
      subjectNames,
      enrollments,
    });
  }

  private createExcelTemplate(data: {
    school: any;
    term: any;
    classId?: string;
    className: string;
    subjectNames: string[];
    enrollments: any[];
  }) {
    const { school, term, className, subjectNames, enrollments } = data;
    const wsName = 'Results';
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, size: 11 },
      fill: { fgColor: { rgb: '5F4B3A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'D4C5B0' } },
        bottom: { style: 'thin', color: { rgb: 'D4C5B0' } },
        left: { style: 'thin', color: { rgb: 'D4C5B0' } },
        right: { style: 'thin', color: { rgb: 'D4C5B0' } },
      },
    };

    const subHeaderStyle = {
      font: { bold: true, color: { rgb: '5F4B3A' }, size: 10 },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    const dataStyle = {
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'E8DDD0' } },
        bottom: { style: 'thin', color: { rgb: 'E8DDD0' } },
        left: { style: 'thin', color: { rgb: 'E8DDD0' } },
        right: { style: 'thin', color: { rgb: 'E8DDD0' } },
      },
    };

    // Row 1: School name header
    wsData.push([school?.name || 'School Name', null, null, null, null, null, null, null]);

    // Row 2: School details
    const detailsStr = [
      `Academic Year: ${term.academicYear?.name || ''}`,
      `Term: ${term.name || ''}`,
      `Class: ${className || 'All Classes'}`,
      `Generated: ${new Date().toLocaleDateString()}`,
    ].join('  |  ');
    wsData.push([detailsStr, null, null, null, null, null, null, null]);

    // Row 3: Empty
    wsData.push([]);

    // Row 4: Instructions
    wsData.push(['INSTRUCTIONS: Fill in scores (0-100) for each student and subject. Do not modify student names or admission numbers.', null, null, null, null, null, null, null]);

    // Row 5: Empty
    wsData.push([]);

    // Row 6: Column headers
    const headers = ['AdmissionNumber', 'FirstName', 'LastName', 'Class', ...subjectNames];
    wsData.push(headers);

    // Data rows
    for (const e of enrollments) {
      const row = [
        e.student.admissionNumber || '',
        e.student.firstName || '',
        e.student.lastName || '',
        e.class?.name || className || '',
        ...subjectNames.map(() => ''),
      ];
      wsData.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
      { wch: 18 },  // AdmissionNumber
      { wch: 15 },  // FirstName
      { wch: 15 },  // LastName
      { wch: 12 },  // Class
      ...subjectNames.map(() => ({ wch: 14 })),
    ];

    // Merge school name header
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 + subjectNames.length } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 + subjectNames.length } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 3 + subjectNames.length } },
    ];

    // Apply styles via xlsx-style-compatible approach
    // For the header row (row index 5, 0-based = the header column row)
    const headerRow = 5;
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: headerRow, c });
      if (ws[cellRef]) {
        ws[cellRef].s = { ...headerStyle };
      }
    }

    // Style data cells
    for (let r = headerRow + 1; r < wsData.length; r++) {
      for (let c = 0; c < headers.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (ws[cellRef]) {
          const style: any = { ...dataStyle };
          if (c >= 4) {
            // Subject score cells - numeric
            style.numFmt = '0.0';
          }
          ws[cellRef].s = style;
        }
      }
    }

    // Freeze panes below header (freeze row 5 + 1 = row 6)
    ws['!freeze'] = { xSplit: 3, ySplit: headerRow + 1 };

    XLSX.utils.book_append_sheet(wb, ws, wsName);

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async uploadExcelResults(
    userId: string,
    schoolId: string,
    termId: string,
    file: Express.Multer.File,
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
    let errors: string[] = [];

    for (const row of rows) {
      const admissionNumber = row['AdmissionNumber'];

      if (!admissionNumber) {
        errors.push('Missing AdmissionNumber in row');
        continue;
      }

      const student = await this.prisma.student.findFirst({
        where: { admissionNumber, schoolId },
      });

      if (!student) {
        errors.push(`Student not found: ${admissionNumber}`);
        continue;
      }

      for (const column in row) {
        if (column === 'AdmissionNumber' || column === 'FirstName' || column === 'LastName') continue;

        const subjectId = subjectMap.get(column.toLowerCase());

        if (!subjectId) continue;

        const score = Number(row[column]);

        if (isNaN(score) || score < 0 || score > 100) {
          errors.push(`Invalid score for ${student.admissionNumber} in ${column}`);
          continue;
        }

        // Find the correct teacher from teaching assignments
        // First, find the student's enrollment for this academic year
        const enrollment = await this.prisma.enrollment.findFirst({
          where: {
            studentId: student.id,
            academicYearId: term.academicYearId,
            status: 'ACTIVE',
          },
        });

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

        const gradeData = await this.calculateGrade(score, schoolId);

        const existing = await this.prisma.result.findFirst({
          where: { studentId: student.id, subjectId, termId },
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
      }
    }

    return {
      message: 'Results uploaded successfully',
      rowsProcessed: rows.length,
      resultsInserted: inserted,
      resultsUpdated: updated,
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
      },
    });

    const studentIds = enrollments.map((e) => e.studentId);

    const results = await this.prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        termId,
        schoolId,
      },
    });

    let updated = 0;

    for (const result of results) {
      const gradeData = await this.calculateGrade(result.score, schoolId);

      await this.prisma.result.update({
        where: { id: result.id },
        data: {
          grade: gradeData.grade,
          remark: gradeData.remark,
          teacherId,
        },
      });
      updated++;
    }

    return {
      message: 'Grades recalculated successfully',
      resultsUpdated: updated,
    };
  }
}
