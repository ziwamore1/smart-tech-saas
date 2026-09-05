import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportCardService } from '../report-card/report-card.service';
import { PushNotificationService } from '../push-notification/push-notification.service';
import pLimit from 'p-limit';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private prisma: PrismaService,
    private reportCardService: ReportCardService,
    private pushNotificationService: PushNotificationService,
  ) {}

  async publishResults(schoolId: string, classId: string, termId: string, userId?: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new BadRequestException('Invalid term');
    }

    if (term.resultsLocked) {
      throw new ForbiddenException('Results are already locked');
    }

    const classInfo = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { levelType: true },
    });

    if (!classInfo) {
      throw new BadRequestException('Class not found');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
      },
      include: { student: true },
    });

    if (enrollments.length === 0) {
      throw new BadRequestException('No students enrolled in this class');
    }

    const teachingAssignments = await this.prisma.teachingAssignment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
      },
    });

    if (teachingAssignments.length === 0) {
      throw new BadRequestException('No teaching assignments found for this class. Please set up subject assignments first.');
    }

    const completeness = await this.checkResultsCompletenessByClass(
      schoolId,
      classId,
      termId,
    );

    if (!completeness.isComplete) {
      throw new BadRequestException(
        `Results not complete. ${completeness.totalStudents - completeness.completeStudents} of ${completeness.totalStudents} students have missing subjects.`,
      );
    }

    const limit = pLimit(10);

    const generationJobs = enrollments.map((enrollment) =>
      limit(() =>
        this.reportCardService.generateCurriculumReportCardPdf(
          schoolId,
          enrollment.studentId,
          termId,
        ),
      ),
    );

    const reports = await Promise.all(generationJobs);

    await this.prisma.resultPublication.upsert({
      where: { classId_termId: { classId, termId } },
      update: {
        published: true,
        publishedAt: new Date(),
      },
      create: {
        schoolId,
        classId,
        termId,
        published: true,
        publishedAt: new Date(),
      },
    });

    await this.prisma.term.update({
      where: { id: termId },
      data: { resultsLocked: true },
    });

    // Auto-sync to Results Management (Central Hub): mark the class/term
    // result sheet as PUBLISHED and its computed results as PUBLISHED.
    await this.syncResultSheetToHub(schoolId, classId, termId, userId, 'PUBLISHED');
    await this.prisma.computedResult.updateMany({
      where: { classId, termId, schoolId },
      data: { status: 'PUBLISHED' },
    });

    if (userId) {
      await this.prisma.resultAuditLog.create({
        data: {
          schoolId,
          action: 'PUBLISHED',
          entityType: 'COMPUTED_RESULT',
          entityId: `${classId}-${termId}`,
          classId,
          termId,
          performedBy: userId,
        },
      });
    }

    // Send results-published notifications in the background so the endpoint
    // returns promptly after the publish work has committed.
    void (async () => {
      try {
        for (const enrollment of enrollments) {
          const studentUser = enrollment.student?.user;
          if (studentUser) {
            await this.pushNotificationService.sendToUser(studentUser.id, {
              title: 'Results Published',
              body: `Your results for ${classInfo.name} - ${term.name} are now available.`,
              data: { type: 'result_published', classId, termId },
            });
          }

          const parentLinks = await this.prisma.parentStudent.findMany({
            where: { studentId: enrollment.studentId },
            include: { parent: { select: { email: true } } },
          });

          for (const link of parentLinks) {
            const parentUser = await this.prisma.user.findFirst({
              where: { email: link.parent.email },
              select: { id: true },
            });
            if (parentUser) {
              await this.pushNotificationService.sendToUser(parentUser.id, {
                title: `${enrollment.student.firstName} ${enrollment.student.lastName}'s Results Published`,
                body: `Results for ${classInfo.name} - ${term.name} are now available.`,
                data: { type: 'result_published', classId, termId, studentId: enrollment.studentId },
              });
            }
          }
        }

        // Notify all Directors of the school so they can monitor result publications.
        await this.pushNotificationService.sendByRole(
          'Director',
          {
            title: 'Results Published',
            body: `Results for ${classInfo.name} - ${term.name} were published (${enrollments.length} students).`,
            data: { type: 'result_published', classId, termId },
          },
          schoolId,
        );
      } catch (error: any) {
        this.logger.error(`[Results Published Notification] Failed: ${error.message}`);
      }
    })();

    return {
      message: 'Results published successfully',
      reportsGenerated: reports.length,
      className: classInfo.name,
      termName: term.name,
    };
  }

  async publishAllClasses(schoolId: string, termId: string, userId?: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
    });

    if (!term) {
      throw new BadRequestException('Term not found');
    }

    if (term.resultsLocked) {
      throw new ForbiddenException('Results are already locked');
    }

    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      include: {
        enrollments: {
          where: {
            academicYearId: term.academicYearId,
            status: 'ACTIVE',
          },
        },
      },
    });

    const results: any[] = [];

    for (const cls of classes) {
      if (cls.enrollments.length === 0) continue;

      try {
        await this.publishResults(schoolId, cls.id, termId, userId);
        results.push({ classId: cls.id, className: cls.name, status: 'success' });
      } catch (error: any) {
        results.push({ classId: cls.id, className: cls.name, status: 'failed', error: error.message });
      }
    }

    return {
      message: 'Batch publishing completed',
      results,
      successful: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
    };
  }

  async unpublishResults(schoolId: string, classId: string, termId: string, userId?: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new BadRequestException('Invalid term');
    }

    if (!term.resultsLocked) {
      throw new ForbiddenException('Results are not locked');
    }

    await this.prisma.resultPublication.updateMany({
      where: { classId, termId, schoolId },
      data: { published: false },
    });

    await this.prisma.term.update({
      where: { id: termId },
      data: { resultsLocked: false },
    });

    // Auto-sync to Results Management (Central Hub): revert the sheet to DRAFT
    // and computed results back to COMPUTED so the workflow can run again.
    await this.syncResultSheetToHub(schoolId, classId, termId, userId, 'DRAFT');
    await this.prisma.computedResult.updateMany({
      where: { classId, termId, schoolId },
      data: { status: 'COMPUTED' },
    });

    if (userId) {
      await this.prisma.resultAuditLog.create({
        data: {
          schoolId,
          action: 'UNLOCKED',
          entityType: 'COMPUTED_RESULT',
          entityId: `${classId}-${termId}`,
          classId,
          termId,
          performedBy: userId,
        },
      });
    }

    return { message: 'Results unpublished successfully' };
  }

  private async syncResultSheetToHub(
    schoolId: string,
    classId: string,
    termId: string,
    userId?: string,
    status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'PUBLISHED' | 'LOCKED' = 'DRAFT',
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term) return;

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
      },
    });

    const studentIds = enrollments.map((e) => e.studentId);
    const enteredCount = studentIds.length > 0
      ? await this.prisma.result.count({
          where: { termId, studentId: { in: studentIds } },
        })
      : 0;

    const classInfo = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    const base = {
      status,
      totalStudents: enrollments.length,
      enteredCount,
    } as any;

    if (status === 'PUBLISHED') {
      base.publishedAt = new Date();
    }
    if (status === 'LOCKED') {
      base.lockedAt = new Date();
      base.lockedBy = userId || null;
    }
    if (status === 'DRAFT') {
      base.publishedAt = null;
      base.lockedAt = null;
      base.lockedBy = null;
    }

    await this.prisma.resultSheet.upsert({
      where: {
        classId_termId_examType: { classId, termId, examType: 'END_TERM' },
      },
      update: base,
      create: {
        schoolId,
        classId,
        termId,
        academicYearId: term.academicYearId,
        examType: 'END_TERM',
        title: `${classInfo?.name || 'Class'} - ${term.name} (END OF TERM)`,
        status,
        createdBy: userId || 'system',
        totalStudents: enrollments.length,
        enteredCount,
        ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      },
    });
  }

  async checkResultsCompleteness(
    studentIds: string[],
    subjectIds: string[],
    termId: string,
  ) {
    const results = await this.prisma.result.findMany({
      where: {
        termId,
        studentId: { in: studentIds },
        subjectId: { in: subjectIds },
      },
    });

    const resultMap = new Map<string, Set<string>>();
    for (const r of results) {
      if (!resultMap.has(r.studentId)) {
        resultMap.set(r.studentId, new Set());
      }
      resultMap.get(r.studentId)!.add(r.subjectId);
    }

    let completeStudents = 0;
    const incompleteStudents: any[] = [];

    for (const studentId of studentIds) {
      const studentSubjects = resultMap.get(studentId) || new Set();
      const hasAllSubjects = subjectIds.every((s) => studentSubjects.has(s));

      if (hasAllSubjects) {
        completeStudents++;
      } else {
        const missing = subjectIds.filter((s) => !studentSubjects.has(s));
        incompleteStudents.push({ studentId, missingSubjects: missing.length });
      }
    }

    return {
      totalStudents: studentIds.length,
      completeStudents,
      incompleteStudents,
      isComplete: completeStudents === studentIds.length,
      percentageComplete: studentIds.length > 0
        ? Math.round((completeStudents / studentIds.length) * 100)
        : 0,
    };
  }

  async checkResultsCompletenessByClass(
    schoolId: string,
    classId: string,
    termId: string,
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term) {
      throw new BadRequestException('Term not found');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
      },
      include: { student: true },
    });

    if (enrollments.length === 0) {
      return {
        totalStudents: 0,
        completeStudents: 0,
        incompleteStudents: [],
        isComplete: true,
        percentageComplete: 100,
        message: 'No students enrolled in this class',
      };
    }

    const teachingAssignments = await this.prisma.teachingAssignment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
      },
      include: { subject: true },
    });

    const subjectIds = [...new Set(teachingAssignments.map((a) => a.subjectId))];

    if (subjectIds.length === 0) {
      return {
        totalStudents: enrollments.length,
        completeStudents: 0,
        incompleteStudents: enrollments.map((e) => ({
          studentId: e.studentId,
          studentName: `${e.student.firstName} ${e.student.lastName}`,
          missingSubjects: [],
        })),
        isComplete: false,
        percentageComplete: 0,
        message: 'No teaching assignments for this class. Please set up subject assignments first.',
      };
    }

    const studentIds = enrollments.map((e) => e.studentId);

    const [results, absentMarks] = await Promise.all([
      this.prisma.result.findMany({
        where: {
          termId,
          studentId: { in: studentIds },
          subjectId: { in: subjectIds },
        },
      }),
      this.prisma.computedResult.findMany({
        where: {
          termId,
          classId,
          studentId: { in: studentIds },
          subjectId: { in: subjectIds },
          isAbsent: true,
        },
        select: { studentId: true, subjectId: true },
      }),
    ]);

    const resultMap = new Map<string, Set<string>>();
    for (const r of results) {
      if (!resultMap.has(r.studentId)) {
        resultMap.set(r.studentId, new Set());
      }
      resultMap.get(r.studentId)!.add(r.subjectId);
    }
    for (const a of absentMarks) {
      if (!resultMap.has(a.studentId)) {
        resultMap.set(a.studentId, new Set());
      }
      resultMap.get(a.studentId)!.add(a.subjectId);
    }

    let completeStudents = 0;
    const incompleteStudents: any[] = [];

    for (const enrollment of enrollments) {
      const studentSubjects = resultMap.get(enrollment.studentId) || new Set();
      const hasAllSubjects = (subjectIds as string[]).every((s) => studentSubjects.has(s));

      if (hasAllSubjects) {
        completeStudents++;
      } else {
        const missingSubjectIds = (subjectIds as string[]).filter((s) => !studentSubjects.has(s));
        const missingSubjects = teachingAssignments
          .filter((a) => missingSubjectIds.includes(a.subjectId))
          .map((a) => ({ id: a.subjectId, name: a.subject.name }));
        
        incompleteStudents.push({
          studentId: enrollment.studentId,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          missingSubjects,
          enteredSubjects: studentSubjects.size,
          totalSubjects: subjectIds.length,
        });
      }
    }

    return {
      totalStudents: enrollments.length,
      completeStudents,
      incompleteStudents,
      isComplete: completeStudents === enrollments.length,
      percentageComplete: enrollments.length > 0
        ? Math.round((completeStudents / enrollments.length) * 100)
        : 100,
      subjectsRequired: subjectIds.length,
      subjectNames: [...new Set(teachingAssignments.map((a) => a.subject.name))],
      message: completeStudents === enrollments.length
        ? 'All results are complete! Ready to publish.'
        : `${enrollments.length - completeStudents} student(s) missing results`,
    };
  }

  async getResultsSummaryByClass(
    schoolId: string,
    classId: string,
    termId: string,
  ) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term) {
      throw new BadRequestException('Term not found');
    }

    const classInfo = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
      },
      include: { student: true },
    });

    const teachingAssignments = await this.prisma.teachingAssignment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
      },
      include: { subject: true },
    });

    const subjectIds = [...new Set(teachingAssignments.map((a) => a.subjectId))];
    const subjects = [...new Set(teachingAssignments.map((a) => a.subject.name))];

    const [results, absentMarks] = await Promise.all([
      this.prisma.result.findMany({
        where: {
          termId,
          studentId: { in: enrollments.map((e) => e.studentId) },
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          subject: { select: { id: true, name: true } },
        },
      }),
      this.prisma.computedResult.findMany({
        where: {
          termId,
          classId,
          studentId: { in: enrollments.map((e) => e.studentId) },
          isAbsent: true,
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          subject: { select: { id: true, name: true } },
        },
      }),
    ]);

    const studentResultsMap = new Map<string, Map<string, any>>();
    const enteredPairs = new Set<string>();
    for (const r of results) {
      if (!studentResultsMap.has(r.studentId)) {
        studentResultsMap.set(r.studentId, new Map());
      }
      studentResultsMap.get(r.studentId)!.set(r.subjectId, r);
      enteredPairs.add(`${r.studentId}::${r.subjectId}`);
    }
    for (const a of absentMarks) {
      if (!studentResultsMap.has(a.studentId)) {
        studentResultsMap.set(a.studentId, new Map());
      }
      studentResultsMap.get(a.studentId)!.set(a.subjectId, {
        score: null,
        grade: null,
        subjectId: a.subjectId,
        subject: a.subject,
        isAbsent: true,
      });
      enteredPairs.add(`${a.studentId}::${a.subjectId}`);
    }

    const studentsWithResults = enrollments.map((enrollment) => {
      const studentResults = studentResultsMap.get(enrollment.studentId) || new Map();
      const resultsPerStudent = Array.from(studentResults.values()).map((r: any) => ({
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        score: r.score,
        grade: r.grade,
        isAbsent: r.isAbsent ?? false,
      }));

      return {
        studentId: enrollment.studentId,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        admissionNumber: enrollment.student.admissionNumber,
        resultsEntered: studentResults.size,
        totalSubjects: subjectIds.length,
        results: resultsPerStudent,
      };
    });

    const publication = await this.prisma.resultPublication.findFirst({
      where: { classId, termId },
    });

    return {
      classId,
      className: classInfo?.name,
      termId,
      termName: term.name,
      totalStudents: enrollments.length,
      totalSubjects: subjects.length,
      subjects,
      students: studentsWithResults,
      resultsEntered: enteredPairs.size,
      expectedResults: enrollments.length * subjectIds.length,
      percentageComplete: enrollments.length * subjectIds.length > 0
        ? Math.round((enteredPairs.size / (enrollments.length * subjectIds.length)) * 100)
        : 100,
      isPublished: publication?.published || false,
      publishedAt: publication?.publishedAt,
      resultsLocked: term.resultsLocked,
    };
  }

  async downloadClassReportsZip(
    schoolId: string,
    classId: string,
    termId: string,
  ) {
    const publication = await this.prisma.resultPublication.findFirst({
      where: { classId, termId, published: true },
    });

    if (!publication) {
      throw new ForbiddenException('Results have not been published for this class');
    }

    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    const classInfo = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: term?.academicYearId,
        status: 'ACTIVE',
      },
      include: { student: true },
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();

    archive.pipe(stream);

    for (const enrollment of enrollments) {
      try {
        const pdf = await this.reportCardService.generateCurriculumReportCardPdf(
          schoolId,
          enrollment.studentId,
          termId,
        );

        const fileName = `${enrollment.student.lastName}_${enrollment.student.firstName}_${classInfo?.name || 'class'}.pdf`
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_.-]/g, '');

        archive.append(pdf, { name: fileName });
      } catch (error) {
        // Skip failed generations
      }
    }

    await archive.finalize();

    return stream;
  }

  async getPublicationStatus(schoolId: string) {
    const publications = await this.prisma.resultPublication.findMany({
      where: { schoolId },
      include: {
        class: true,
        term: { include: { academicYear: true } },
      },
    });

    return publications.map((p) => ({
      classId: p.classId,
      className: p.class?.name,
      termId: p.termId,
      termName: p.term?.name,
      academicYearId: p.term?.academicYearId,
      published: p.published,
      publishedAt: p.publishedAt,
    }));
  }

  async getTermLockStatus(schoolId: string, termId: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new BadRequestException('Term not found');
    }

    return {
      termId: term.id,
      termName: term.name,
      resultsLocked: term.resultsLocked,
      resultsFinalized: term.resultsFinalized,
      isCurrent: term.isCurrent,
    };
  }

  async generateClassSummaryPdf(schoolId: string, classId: string, termId: string): Promise<Buffer> {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term) {
      throw new BadRequestException('Term not found');
    }

    const classInfo = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
      },
      include: { student: true },
    });

    const teachingAssignments = await this.prisma.teachingAssignment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
      },
      include: { subject: true, teacher: true },
    });

    const subjectIds = [...new Set(teachingAssignments.map((a) => a.subjectId))];
    const results = await this.prisma.result.findMany({
      where: {
        termId,
        studentId: { in: enrollments.map((e) => e.studentId) },
      },
      include: {
        student: true,
        subject: true,
        teacher: true,
      },
    });

    const subjectStats: Record<string, any> = {};
    for (const r of results) {
      if (!subjectStats[r.subjectId]) {
        subjectStats[r.subjectId] = {
          subject: r.subject.name,
          totalScore: 0,
          count: 0,
          highest: r.score,
          lowest: r.score,
          teachers: new Set(),
        };
      }
      subjectStats[r.subjectId].teachers.add(`Teacher`);
      subjectStats[r.subjectId].totalScore += r.score;
      subjectStats[r.subjectId].count++;
      if (r.score > subjectStats[r.subjectId].highest) subjectStats[r.subjectId].highest = r.score;
      if (r.score < subjectStats[r.subjectId].lowest) subjectStats[r.subjectId].lowest = r.score;
    }

    const subjectRows = Object.values(subjectStats).map((s: any) => `
      <tr>
        <td>${s.subject}</td>
        <td>${Array.from(s.teachers).join(', ')}</td>
        <td>${s.count}</td>
        <td>${(s.totalScore / s.count).toFixed(1)}</td>
        <td>${s.highest.toFixed(1)}</td>
        <td>${s.lowest.toFixed(1)}</td>
      </tr>
    `).join('');

    const html = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .school-name { font-size: 24px; font-weight: bold; }
        .report-title { font-size: 18px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #4a5568; color: white; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .summary-box { display: flex; justify-content: space-around; margin: 20px 0; }
        .summary-item { text-align: center; padding: 15px; background: #f3f4f6; border-radius: 8px; }
        .summary-value { font-size: 24px; font-weight: bold; color: #2563eb; }
        .summary-label { font-size: 14px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="school-name">SCHOOL NAME</div>
        <div class="report-title">Class Summary Report</div>
        <p>Class: ${classInfo?.name || 'N/A'} | Term: ${term.name} | Academic Year: ${term.academicYear.name}</p>
      </div>
      
      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-value">${enrollments.length}</div>
          <div class="summary-label">Total Students</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${subjectIds.length}</div>
          <div class="summary-label">Subjects</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${results.length}</div>
          <div class="summary-label">Results Entered</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${enrollments.length > 0 ? Math.round((results.length / (enrollments.length * subjectIds.length)) * 100) : 0}%</div>
          <div class="summary-label">Completion</div>
        </div>
      </div>

      <h3>Subject Performance</h3>
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Teacher(s)</th>
            <th>Entries</th>
            <th>Average</th>
            <th>Highest</th>
            <th>Lowest</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows || '<tr><td colspan="6" style="text-align:center">No data available</td></tr>'}
        </tbody>
      </table>
    </body>
    </html>
    `;

    return Buffer.from(html);
  }
}
