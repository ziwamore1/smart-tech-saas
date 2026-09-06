import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as puppeteer from 'puppeteer';
import { AnalyticsService } from '../analytics/analytics.service';
import { ReportCardEngineService } from '../report-card-engine/report-card-engine.service';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';
import { CompositeSubjectService } from '../composite-subject/composite-subject.service';
import { SchoolActivityService } from '../common/services/school-activity.service';
import { ActivityEventType, ActivityCategory, ActivitySeverity } from '../common/types/activity-event.types';
import { checkEczEligibility, detectEczGradingSystem, ECZ_MAX_BEST_SIX_POINTS } from '../ecz-eligibility/ecz-eligibility.util';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import * as os from 'os';
import * as crypto from 'crypto';

handlebars.registerHelper('math', (lhs: any, operator: string, rhs: any) => {
  const a = parseFloat(lhs) || 0;
  const b = parseFloat(rhs) || 0;
  switch (operator) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? a / b : 0;
    default: return 0;
  }
});

handlebars.registerHelper('gte', (a: any, b: any) => {
  return parseFloat(a) >= parseFloat(b);
});

handlebars.registerHelper('lt', (a: any, b: any) => {
  return parseFloat(a) < parseFloat(b);
});

handlebars.registerHelper('minus', (a: any, b: any) => {
  return Math.abs(parseFloat(a) - parseFloat(b)).toFixed(1);
});

handlebars.registerHelper('ne', (a: any, b: any) => {
  return a !== b;
});

handlebars.registerHelper('present', function(value: any) {
  return value != null && value !== '';
});

@Injectable()
export class ReportCardService {
  constructor(
    private prisma: PrismaService,
    private analyticsService: AnalyticsService,
    private reportCardEngineService: ReportCardEngineService,
    private cloudinary: CloudinaryService,
    private compositeSubjectService: CompositeSubjectService,
    @Optional() private schoolEvents?: SchoolEventsGateway,
    @Optional() private readonly activityService?: SchoolActivityService,
  ) {}

  private async uploadToCloudinary(buffer: Buffer, publicId: string): Promise<{ url: string | null; publicId: string | null }> {
    try {
      const result = await this.cloudinary.uploadBuffer(buffer, {
        folder: `${FOLDERS.system}/report-cards`,
        publicId,
        resourceType: 'raw',
      });
      return { url: result.secureUrl, publicId: result.publicId };
    } catch {
      return { url: null, publicId: null };
    }
  }

  private async getBrowser() {
    const userDataDir = path.join(os.tmpdir(), `puppeteer_${crypto.randomBytes(8).toString('hex')}`);
    return puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      userDataDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true,
      timeout: 120000,
    });
  }

  private async getPage(browser: puppeteer.Browser): Promise<puppeteer.Page> {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    return page;
  }

  private async getGradeFromScore(schoolId: string, score: number, classId?: string) {
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

    // Level 1: Check class-level grading system
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

    // Level 2: Check school's default grading system (isDefault = true)
    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId, isDefault: true },
        include: { gradeScales: true },
      });
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
    }

    // Level 4: Any grading system for the school
    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId },
        include: { gradeScales: true },
      });
    }

    if (!gradingSystem) {
      throw new Error('No grading system configured');
    }

    const gradeScale = gradingSystem.gradeScales.find(
      (s) => score >= s.minScore && score < s.maxScore + 1,
    );

    if (!gradeScale) {
      throw new Error('Score not covered by grading scale');
    }

    return gradeScale;
  }

  async getReportCard(schoolId: string, studentId: string, termId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }
    
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid student - student belongs to different school');
    }

    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid term');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
    });

    if (!enrollment) {
      throw new Error('Student not enrolled in this academic year');
    }

    const classInfo = await this.prisma.class.findUnique({
      where: { id: enrollment.classId },
      include: { levelType: true },
    });

    const classEnrollments = await this.prisma.enrollment.findMany({
      where: {
        classId: enrollment.classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      select: {
        studentId: true,
      },
    });

    const studentIds = classEnrollments.map((e) => e.studentId);

    let allComputed = await this.prisma.computedResult.findMany({
      where: {
        studentId: { in: studentIds },
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      },
    });

    if (allComputed.length === 0) {
      const legacyResults = await this.prisma.result.findMany({
        where: {
          studentId: { in: studentIds },
          termId,
          schoolId,
          student: { status: 'ACTIVE' },
        },
      });
      allComputed = legacyResults.map(r => ({
        ...r,
        finalPercentage: r.score,
        finalGrade: r.grade,
        finalRemark: r.remark,
        points: null,
      })) as any;
    }

    const pointsMap: Record<string, number> = {};

    for (const r of allComputed) {
      const grade = r.points != null
        ? { points: r.points }
        : await this.getGradeFromScore(schoolId, r.finalPercentage ?? r.score, enrollment.classId);

      if (!pointsMap[r.studentId]) {
        pointsMap[r.studentId] = 0;
      }

      pointsMap[r.studentId] += grade.points;
    }

    const ranking = Object.entries(pointsMap)
      .map(([studentId, totalPoints]) => ({
        studentId,
        totalPoints,
      }))
      .sort((a, b) => a.totalPoints - b.totalPoints);

    const position = ranking.findIndex((r) => r.studentId === studentId) + 1;

    let results = await this.prisma.computedResult.findMany({
      where: {
        studentId,
        termId,
        schoolId,
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        isAbsent: false,
        student: { status: 'ACTIVE' },
      },
      include: {
        subject: true,
      },
    });

    if (results.length === 0) {
      const legacyResults = await this.prisma.result.findMany({
        where: {
          studentId,
          termId,
          schoolId,
          student: { status: 'ACTIVE' },
        },
        include: {
          subject: true,
        },
      });
      results = legacyResults.map(r => ({
        ...r,
        finalPercentage: r.score,
        finalGrade: r.grade,
        finalRemark: r.remark,
        points: null,
      })) as any;
    }

    if (results.length === 0) {
      throw new NotFoundException('No results found');
    }

    // Apply composite subject transform: replace component subjects with composites
    const composites = await this.compositeSubjectService.getCompositeResultsForStudent(
      studentId, termId, classId, schoolId,
    );
    if (composites.length > 0) {
      const componentIds = new Set<string>();
      for (const comp of composites) {
        for (const c of comp.components) componentIds.add(c.subjectId);
      }
      const filtered = results.filter((r: any) => !componentIds.has(r.subjectId));
      for (const comp of composites) {
        filtered.push({
          subject: { id: comp.composite.id, name: comp.composite.name, code: comp.composite.code },
          finalPercentage: comp.finalPercentage,
          finalGrade: comp.finalGrade,
          finalRemark: null,
          points: null,
          totalRawScore: comp.finalPercentage,
          isComposite: true,
        } as any);
      }
      results = filtered;
    }

    let totalMarks = 0;
    let totalPoints = 0;

    const subjectsWithGrades: {
      subject: string;
      score: number;
      grade: string;
      remark: string;
      points: number;
    }[] = [];

    for (const r of results) {
      const gradeScale = r.finalGrade != null && r.points != null
        ? { grade: r.finalGrade, remark: r.finalRemark ?? '', points: r.points }
        : await this.getGradeFromScore(schoolId, r.finalPercentage ?? 0, enrollment.classId);

      totalMarks += r.finalPercentage ?? 0;
      totalPoints += gradeScale.points;

      subjectsWithGrades.push({
        subject: r.subject.name,
        score: r.finalPercentage ?? 0,
        grade: gradeScale.grade,
        remark: gradeScale.remark,
        points: gradeScale.points,
      });
    }

    const average = totalMarks / results.length;

    const eligibility = checkEczEligibility(
      subjectsWithGrades.map((s) => ({
        name: s.subject,
        score: s.score,
        grade: s.grade,
        points: s.points,
        remark: s.remark,
      })),
      detectEczGradingSystem(classInfo?.levelType?.name ?? classInfo?.name ?? null),
    );

    const bestSixTotal = eligibility.bestSixTotal;

    const eligibleForUniversity = eligibility.universityEligible;

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNumber: student.admissionNumber,
      },
      term: {
        id: term.id,
        name: term.name,
        academicYear: term.academicYear.name,
      },
      subjects: subjectsWithGrades,
      summary: {
        totalMarks,
        totalPoints,
        average,
        numberOfSubjects: results.length,
        bestSixTotal,
        eligibleForUniversity,
        universityEligible: eligibility.universityEligible,
        certificateEligible: eligibility.certificateAwarded,
        eligibilityStatus: eligibility.status,
        certificateName: eligibility.certificateName,
        gradingSystem: eligibility.gradingSystem,
        maxBestSixPoints: ECZ_MAX_BEST_SIX_POINTS[eligibility.gradingSystem],
        englishPassed: eligibility.englishPassed,
        mathPassed: eligibility.mathPassed,
        sciencePassed: eligibility.sciencePassed,
        scienceSubject: eligibility.scienceSubject
          ? {
              name: eligibility.scienceSubject.name,
              score: eligibility.scienceSubject.score,
              grade: eligibility.scienceSubject.grade,
              points: eligibility.scienceSubject.points,
            }
          : null,
        bestSix: eligibility.bestSix.map((s) => ({
          subject: s.name,
          score: s.score,
          grade: s.grade,
          points: s.points,
          remark: s.remark,
        })),
        eligibilityDetails: eligibility.details,
        positionInClass: position,
        totalStudents: ranking.length,
      },
    };
  }

  async generateReportCardPdf(
    schoolId: string,
    studentId: string,
    termId: string,
  ): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const report = await this.getReportCard(schoolId, studentId, termId);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, academicYear: { terms: { some: { id: termId } } }, status: 'ACTIVE' },
      select: { classId: true },
    });
    const resultSheet = enrollment ? await this.prisma.resultSheet.findFirst({
      where: { schoolId, classId: enrollment.classId, termId },
      orderBy: { updatedAt: 'desc' },
      select: { examType: true },
    }) : null;

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new Error('School not found');
    }

    const template = await this.prisma.reportTemplate.findFirst({
      where: { schoolId, isDefault: true },
    });

    const reportTemplate = template || await this.prisma.reportTemplate.findFirst({
      where: { schoolId },
    });
    const primaryContext = await this.getPrimaryReportContext(studentId, termId, reportTemplate);

    const templatePath = path.join(
      process.cwd(),
      'src',
      'templates',
      'report-card.hbs',
    );

    let templateHtml = fs.readFileSync(templatePath, 'utf8');

    const commentData = await this.analyticsService.generateStudentComment(
      schoolId,
      studentId,
      termId,
    );

    const teacherComment = commentData.teacherComment;
    const headComment = commentData.headComment;

    const templateData = {
      schoolName: school.name,
      schoolLogo: reportTemplate?.includeLogo !== false ? (school.logoUrl || school.logo) : undefined,

      academicYear: report.term.academicYear,
      termName: report.term.name,
      examType: resultSheet?.examType || 'END_TERM',

      student: report.student,

      subjects: report.subjects,

      summary: {
        ...report.summary,
        average: report.summary.average.toFixed(2),
        eligibleForUniversity: report.summary.eligibleForUniversity
          ? 'YES'
          : 'NO',
        eligibilityStatus: report.summary.eligibilityStatus
          ?? (report.summary.eligibleForUniversity ? 'UNIVERSITY' : 'NONE'),
        eligibilityDisplay: report.summary.eligibilityDisplay
          ?? (report.summary.eligibilityStatus === 'CERTIFICATE'
            ? 'School Certificate Only'
            : (report.summary.eligibleForUniversity ? 'Eligible for University' : 'Not Eligible')),
      },

      teacherComment: reportTemplate?.includeComments !== false ? teacherComment : undefined,
      headComment: reportTemplate?.includeComments !== false ? headComment : undefined,

      includeStamp: reportTemplate?.includeStamp || false,
      includeSignature: reportTemplate?.includeSignature || false,
      stampUrl: reportTemplate?.stampUrl,
      signatureUrl: reportTemplate?.signatureUrl,
      directorName: reportTemplate?.directorName || '',
      headerText: reportTemplate?.headerText || '',
      footerText: reportTemplate?.footerText || '',

      primaryColor: reportTemplate?.primaryColor || '#1976d2',
      secondaryColor: reportTemplate?.secondaryColor || '#f5f5f5',

      showRankings: reportTemplate?.includeRankings !== false,
      showBestSix: reportTemplate?.includeBestSix !== false,
      showUniversity: reportTemplate?.includeUniversity !== false,
      showGrading: reportTemplate?.includeGrading !== false,
      showRemarks: reportTemplate?.remarksEnabled !== false,
    };

    const compiledTemplate = handlebars.compile(templateHtml);
    const html = compiledTemplate(templateData);

    const browser = await this.getBrowser();
    const page = await this.getPage(browser);

    await page.setContent(html);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    const buffer = Buffer.from(pdf);
    const { url, publicId } = await this.uploadToCloudinary(buffer, `report-card-${studentId}-${termId}`);
    return { buffer, url, publicId };
  }

  async generateClassReportCardsPdf(
    schoolId: string,
    classId: string,
    termId: string,
  ): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
    });

    if (!term) {
      throw new Error('Invalid term');
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new Error('School not found');
    }

    const reportTemplate = await this.prisma.reportTemplate.findFirst({
      where: { schoolId, isDefault: true },
    }) || await this.prisma.reportTemplate.findFirst({
      where: { schoolId },
    });

    const templatePath = path.join(
      process.cwd(),
      'src',
      'templates',
      'report-card.hbs',
    );

    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      include: {
        student: true,
      },
    });

    if (enrollments.length === 0) {
      throw new Error('No students found in class');
    }

    const resultSheet = await this.prisma.resultSheet.findFirst({
      where: { schoolId, classId, termId },
      orderBy: { updatedAt: 'desc' },
      select: { examType: true },
    });

    let allHtml = '';

    for (const e of enrollments) {
      const report = await this.getReportCard(schoolId, e.studentId, termId);

      const commentData = await this.analyticsService.generateStudentComment(
        schoolId,
        e.studentId,
        termId,
      );

      const teacherComment = commentData.teacherComment;
      const headComment = commentData.headComment;

      const templateData = {
        schoolName: school.name,
        schoolLogo: reportTemplate?.includeLogo !== false ? (school.logoUrl || school.logo) : undefined,

        academicYear: report.term.academicYear,
        termName: report.term.name,
        examType: resultSheet?.examType || 'END_TERM',

        student: report.student,

        subjects: report.subjects,

        summary: {
          ...report.summary,
          average: report.summary.average.toFixed(2),
          eligibleForUniversity: report.summary.eligibleForUniversity
            ? 'YES'
            : 'NO',
          eligibilityStatus: report.summary.eligibilityStatus
            ?? (report.summary.eligibleForUniversity ? 'UNIVERSITY' : 'NONE'),
          eligibilityDisplay: report.summary.eligibilityDisplay
            ?? (report.summary.eligibilityStatus === 'CERTIFICATE'
              ? 'School Certificate Only'
              : (report.summary.eligibleForUniversity ? 'Eligible for University' : 'Not Eligible')),
        },

        teacherComment: reportTemplate?.includeComments !== false ? teacherComment : undefined,
        headComment: reportTemplate?.includeComments !== false ? headComment : undefined,

        includeStamp: reportTemplate?.includeStamp || false,
        includeSignature: reportTemplate?.includeSignature || false,
        stampUrl: reportTemplate?.stampUrl,
        signatureUrl: reportTemplate?.signatureUrl,
        directorName: reportTemplate?.directorName || '',
        headerText: reportTemplate?.headerText || '',
        footerText: reportTemplate?.footerText || '',

        primaryColor: reportTemplate?.primaryColor || '#1976d2',
        secondaryColor: reportTemplate?.secondaryColor || '#f5f5f5',

        showRankings: reportTemplate?.includeRankings !== false,
        showBestSix: reportTemplate?.includeBestSix !== false,
        showUniversity: reportTemplate?.includeUniversity !== false,
        showGrading: reportTemplate?.includeGrading !== false,
        showRemarks: reportTemplate?.remarksEnabled !== false,
      };

      const compiledTemplate = handlebars.compile(templateHtml);
      const studentHtml = `<div style="page-break-after:always">${compiledTemplate(templateData)}</div>`;

      allHtml += studentHtml;
    }

    const html = `
    <html>
    <body>
    ${allHtml}
    </body>
    </html>
    `;

    const browser = await this.getBrowser();
    const page = await this.getPage(browser);

    await page.setContent(html);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    const buffer = Buffer.from(pdf);
    const { url, publicId } = await this.uploadToCloudinary(buffer, `class-report-cards-${classId}-${termId}`);

    if (this.schoolEvents) {
      this.schoolEvents.emitReportCardGenerated(schoolId, { classId, termId });
    }

    this.activityService?.publish({
      type: ActivityEventType.REPORT_CARD_GENERATED,
      category: ActivityCategory.REPORTS,
      severity: ActivitySeverity.SUCCESS,
      schoolId,
      title: 'Report cards generated',
      description: `Report cards generated for class`,
      metadata: { classId, termId },
    });

    return { buffer, url, publicId };
  }

  async generateStudentTranscript(
    schoolId: string,
    studentId: string,
    examType?: string,
  ): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }
    
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid student - student belongs to different school');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
      },
      include: {
        academicYear: {
          include: {
            terms: true,
          },
        },
        class: true,
      },
      orderBy: {
        academicYear: {
          startDate: 'asc',
        },
      },
    });

    let transcriptRows = '';
    const allScores: number[] = [];
    let totalPoints = 0;
    let rowCount = 0;
    const gradeDistribution: Record<string, number> = {};

    for (const enrollment of enrollments) {
      for (const term of enrollment.academicYear.terms) {
        let results = await this.prisma.computedResult.findMany({
          where: {
            studentId,
            termId: term.id,
            schoolId,
            status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
            student: { status: 'ACTIVE' },
          },
          include: {
            subject: true,
          },
        });

        if (results.length === 0) {
          const legacyResults = await this.prisma.result.findMany({
            where: {
              studentId,
              termId: term.id,
              schoolId,
              student: { status: 'ACTIVE' },
            },
            include: { subject: true },
          });
          results = legacyResults.map(r => ({
            ...r,
            finalPercentage: r.score,
            finalGrade: r.grade,
            finalRemark: r.remark,
          }));
        }

        for (const r of results) {
          const finalPercentage = r.finalPercentage ?? 0;
          const grade = (r.finalGrade != null && r.points != null)
            ? { grade: r.finalGrade, points: r.points }
            : await this.getGradeFromScore(schoolId, finalPercentage, enrollment.classId);

          allScores.push(finalPercentage);
          totalPoints += grade.points || 0;
          rowCount++;
          gradeDistribution[grade.grade] = (gradeDistribution[grade.grade] || 0) + 1;

          const pctColor = finalPercentage >= 75 ? '#059669' : finalPercentage >= 50 ? '#3b82f6' : finalPercentage >= 40 ? '#d97706' : '#dc2626';
          transcriptRows += `
            <tr>
              <td>${enrollment.academicYear.name}</td>
              <td>${term.name}</td>
              <td style="text-align:left">${enrollment.class.name}</td>
              <td style="text-align:left">${r.subject.name}</td>
              <td class="text-center font-bold" style="color:${pctColor}">${Number(finalPercentage).toFixed(1)}</td>
              <td class="text-center"><span class="grade-badge">${grade.grade}</span></td>
              <td class="text-center font-semibold">${grade.points}</td>
            </tr>
          `;
        }
      }
    }

    if (!transcriptRows) {
      transcriptRows = '<tr><td colspan="7" style="text-align:center;color:#9ca3af">No results found</td></tr>';
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const schoolName = school?.name || 'SCHOOL NAME';
    const overallAvg = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '0';
    const highest = allScores.length > 0 ? Math.max(...allScores).toFixed(1) : '0';
    const lowest = allScores.length > 0 ? Math.min(...allScores).toFixed(1) : '0';
    const maxGradeCount = Math.max(...Object.values(gradeDistribution), 1);
    const gradeChart = Object.entries(gradeDistribution).map(([grade, count]) => {
      const width = Math.max(4, (count / maxGradeCount) * 100);
      const color = grade.startsWith('A') ? '#059669' : grade.startsWith('B') ? '#2563eb' : grade.startsWith('C') ? '#d97706' : '#dc2626';
      return `<div class="chart-row"><span class="chart-label">${grade}</span><div class="chart-track"><div class="chart-fill" style="width:${width}%;background:${color}"></div></div><strong>${count}</strong></div>`;
    }).join('');

    const html = `
    <html>
    <head>
    <style>
      @page { margin: 15mm; size: A4 portrait; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif; color: #1f2937; background: white; padding: 24px; line-height: 1.4; }
      .report-header { text-align: center; margin-bottom: 24px; padding: 16px 20px; background: linear-gradient(135deg, #5f4b3a 0%, #7a6b5a 100%); border-radius: 8px; color: white; }
      .school-name { font-size: 22px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
      .report-title { font-size: 16px; font-weight: 600; color: white; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.95; }
      .report-meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; font-size: 13px; color: #374151; background: #f5f0eb; padding: 10px 16px; border-radius: 6px; border: 1px solid #e8ddd0; }
      .report-meta strong { color: #5f4b3a; }
      .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 20px 0; }
      .summary-card { background: #faf7f4; border: 1px solid #e8ddd0; border-radius: 8px; padding: 12px 16px; text-align: center; }
      .summary-value { font-size: 24px; font-weight: 700; color: #5f4b3a; }
      .summary-label { font-size: 11px; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 20px; }
      th { background: #5f4b3a; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #7a6b5a; }
      td { padding: 6px 10px; border: 1px solid #e5e7eb; }
      tr:nth-child(even) { background: #faf7f4; }
      .text-center { text-align: center; }
      .font-bold { font-weight: 700; }
      .font-semibold { font-weight: 600; }
       .grade-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; background: #d1fae5; color: #059669; }
       .chart { margin: 20px 0; padding: 14px 16px; background: #faf7f4; border: 1px solid #e8ddd0; border-radius: 8px; }
       .chart-title { color: #5f4b3a; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
       .chart-row { display: flex; align-items: center; gap: 8px; margin: 5px 0; font-size: 11px; }
       .chart-label { width: 32px; font-weight: 700; }
       .chart-track { flex: 1; height: 12px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
       .chart-fill { height: 100%; border-radius: 4px; }
      .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
      .sig { text-align: center; flex: 1; }
      .sig-line { width: 200px; border-top: 1px solid #1f2937; margin: 40px auto 0; padding-top: 6px; font-size: 11px; color: #6b7280; }
      .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; }
    </style>
    </head>
    <body>
    <div class="report-header">
      <div class="school-name">${schoolName}</div>
      <div class="report-title">Official Academic Transcript</div>
    </div>
    <div class="report-meta">
      <span><strong>Student:</strong> ${student.firstName} ${student.lastName}</span>
      <span><strong>Admission No:</strong> ${student.admissionNumber}</span>
       <span><strong>Exam Type:</strong> ${examType || 'END_TERM'}</span>
      <span><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </div>
     <div class="summary-grid">
      <div class="summary-card"><div class="summary-value">${enrollments.length}</div><div class="summary-label">Academic Years</div></div>
      <div class="summary-card"><div class="summary-value">${rowCount}</div><div class="summary-label">Subject Entries</div></div>
      <div class="summary-card"><div class="summary-value" style="color:#059669">${overallAvg}%</div><div class="summary-label">Overall Average</div></div>
      <div class="summary-card"><div class="summary-value" style="color:#7c3aed">${highest}%</div><div class="summary-label">Highest Score</div></div>
      <div class="summary-card"><div class="summary-value" style="color:#dc2626">${lowest}%</div><div class="summary-label">Lowest Score</div></div>
       <div class="summary-card"><div class="summary-value" style="color:#2563eb">${totalPoints}</div><div class="summary-label">Total Points</div></div>
     </div>
     ${gradeChart ? `<div class="chart"><div class="chart-title">Grade Distribution</div>${gradeChart}</div>` : ''}
     <table>
      <thead><tr>
        <th>Academic Year</th>
        <th>Term</th>
        <th>Class</th>
        <th>Subject</th>
        <th class="text-center">Score</th>
        <th class="text-center">Grade</th>
        <th class="text-center">Points</th>
      </tr></thead>
      <tbody>
      ${transcriptRows}
      </tbody>
    </table>
    <div class="signatures">
      <div class="sig"><div class="sig-line">Head Teacher</div></div>
      <div class="sig"><div class="sig-line">Director of Studies</div></div>
      <div class="sig"><div class="sig-line">School Stamp</div></div>
    </div>
    <div class="footer">Smart Tech SaaS - Results Management System | Confidential</div>
    </body>
    </html>
    `;

    const browser = await this.getBrowser();
    const page = await this.getPage(browser);

    await page.setContent(html);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    const buffer = Buffer.from(pdf);
    const { url, publicId } = await this.uploadToCloudinary(buffer, `transcript-${studentId}`);
    return { buffer, url, publicId };
  }

  async generateCurriculumReportCardPdf(
    schoolId: string,
    studentId: string,
    termId: string,
    examType?: string,
  ): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const engineData = await this.reportCardEngineService.generateReportCardData(
      studentId,
      termId,
      schoolId,
      examType,
    );

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) throw new Error('School not found');

    const template = await this.prisma.reportTemplate.findFirst({
      where: { schoolId, isDefault: true },
    });
    const reportTemplate = template || await this.prisma.reportTemplate.findFirst({
      where: { schoolId },
    });

    // Select enhanced template (always use enhanced for curriculum reports)
    const primaryContext = await this.getPrimaryReportContext(studentId, termId, reportTemplate);
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'report-card-enhanced.hbs');
    let templateHtml = fs.readFileSync(templatePath, 'utf8');

    const commentData = await this.analyticsService.generateStudentComment(schoolId, studentId, termId);

    // Get enhanced data: mid-term comparison, class comparison, charts, grading legend
    const [midTermData, classComparison, classStats, gradingLegend] = await Promise.all([
      this.reportCardEngineService.getMidTermComparison(studentId, termId, schoolId).catch(() => null),
      this.reportCardEngineService.getClassComparison(studentId, termId, engineData.class?.id).catch(() => null),
      this.reportCardEngineService.getClassStatistics(termId, engineData.class?.id, schoolId).catch(() => null),
      this.reportCardEngineService.getGradingLegend(schoolId, engineData.class?.id).catch(() => null),
    ]);
    const effectiveGradingLegend = primaryContext.isGrade7Ecz
      ? await this.getGrade7GradingLegend(schoolId)
      : gradingLegend;

    const now = new Date();
    const generatedAtFormatted = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const templateData = {
      schoolName: school.name,
      schoolLogo: reportTemplate?.includeLogo !== false ? (school.logoUrl || school.logo) : undefined,
      primaryColor: reportTemplate?.primaryColor || '#1976d2',
      secondaryColor: reportTemplate?.secondaryColor || '#f5f5f5',
      academicYear: engineData.academicYear?.name || '',
      termName: engineData.term?.name || '',
      examType: engineData.examType || examType || 'END_TERM',
      student: engineData.student,
      class: engineData.class,
      subjectBreakdown: engineData.subjectBreakdown || [],
      bestSubjects: engineData.bestSubjects || [],
      totalPoints: engineData.totalPoints ?? 0,
      bestSix: engineData.bestSix || null,
      bestSixTotal: engineData.bestSixTotal ?? null,
      universityEligible: engineData.universityEligible ?? null,
      certificateAwarded: engineData.certificateAwarded ?? null,
      eligibilityStatus: engineData.eligibilityStatus ?? null,
      eligibility: engineData.eligibility ?? null,
      bestSubjectsAverage: engineData.bestSubjectsAverage != null ? Math.round(engineData.bestSubjectsAverage * 100) / 100 : null,
      division: engineData.division,
      performanceCategory: engineData.performanceCategory,
      attendance: engineData.attendance || { totalDays: 0, presentDays: 0, attendanceRate: 0 },
      termSummary: engineData.termSummary,
      curriculum: engineData.curriculum || { version: null, bestSubjectRule: null },
      teacherComment: reportTemplate?.includeComments !== false ? commentData.teacherComment : undefined,
      headComment: reportTemplate?.includeComments !== false ? commentData.headComment : undefined,
      includeStamp: reportTemplate?.includeStamp || false,
      includeSignature: reportTemplate?.includeSignature || false,
      stampUrl: reportTemplate?.stampUrl,
      signatureUrl: reportTemplate?.signatureUrl,
      directorName: reportTemplate?.directorName || '',
      headerText: reportTemplate?.headerText || '',
      footerText: reportTemplate?.footerText || '',
      showRemarks: reportTemplate?.remarksEnabled !== false,
      reportTitle: this.getProfessionalReportTitle(reportTemplate),
      ...primaryContext,
      generatedAt: engineData.generatedAt,
      generatedAtFormatted,
      // Enhanced data for charts and analysis
      classAverage: classStats?.classAverage ?? null,
      midTermData,
      classComparison,
      gradeDistribution: classStats?.gradeDistribution ?? null,
      histogramData: classStats?.histogramData ?? null,
      gradingLegend: gradingLegend ?? [
        { grade: 'A', range: '80-100', label: 'Distinction', color: '#10b981' },
        { grade: 'B', range: '70-79', label: 'Merit', color: '#3b82f6' },
        { grade: 'C', range: '60-69', label: 'Credit', color: '#f59e0b' },
        { grade: 'D', range: '50-59', label: 'Pass', color: '#f97316' },
        { grade: 'E', range: '40-49', label: 'Marginal Pass', color: '#fb923c' },
        { grade: 'F', range: '0-39', label: 'Fail', color: '#ef4444' },
      ],
    };

    const compiledTemplate = handlebars.compile(templateHtml);
    const html = compiledTemplate(templateData);

    const browser = await this.getBrowser();
    const page = await this.getPage(browser);
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    const buffer = Buffer.from(pdf);
    const { url, publicId } = await this.uploadToCloudinary(buffer, `curriculum-report-${studentId}-${termId}`);
    return { buffer, url, publicId };
  }

  /**
   * Render the enhanced HBS report card for in-app previews and the report engine.
   * Enhanced templates are document templates, not absolute-positioned builder canvases.
   */
  async generateEnhancedReportCardHtml(
    schoolId: string,
    studentId: string,
    termId: string,
    templateId?: string,
    examType?: string,
  ): Promise<{ html: string; data: any }> {
    const engineData = await this.reportCardEngineService.generateReportCardData(studentId, termId, schoolId, examType);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    const reportTemplate = (templateId
      ? await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } })
      : null) || await this.prisma.reportTemplate.findFirst({
        where: { schoolId, isDefault: true },
      }) || await this.prisma.reportTemplate.findFirst({ where: { schoolId } });
    const primaryContext = await this.getPrimaryReportContext(studentId, termId, reportTemplate);
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'report-card-enhanced.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const commentData = await this.analyticsService.generateStudentComment(schoolId, studentId, termId);

    const [midTermData, classComparison, classStats, gradingLegend] = await Promise.all([
      this.reportCardEngineService.getMidTermComparison(studentId, termId, schoolId).catch(() => null),
      this.reportCardEngineService.getClassComparison(studentId, termId, engineData.class?.id).catch(() => null),
      this.reportCardEngineService.getClassStatistics(termId, engineData.class?.id, schoolId).catch(() => null),
      this.reportCardEngineService.getGradingLegend(schoolId, engineData.class?.id).catch(() => null),
    ]);
    const effectiveGradingLegend = primaryContext.isGrade7Ecz
      ? await this.getGrade7GradingLegend(schoolId)
      : gradingLegend;

    const now = new Date();
    const generatedAtFormatted = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const templateData = {
      schoolName: school.name,
      schoolLogo: reportTemplate?.includeLogo !== false ? (school.logoUrl || school.logo) : undefined,
      primaryColor: reportTemplate?.primaryColor || '#1976d2',
      secondaryColor: reportTemplate?.secondaryColor || '#f5f5f5',
      academicYear: engineData.academicYear?.name || '',
      termName: engineData.term?.name || '',
      examType: engineData.examType || examType || 'END_TERM',
      student: engineData.student,
      class: engineData.class,
      subjectBreakdown: engineData.subjectBreakdown || [],
      bestSubjects: engineData.bestSubjects || [],
      totalPoints: engineData.totalPoints ?? 0,
      bestSubjectsAverage: engineData.bestSubjectsAverage != null ? Math.round(engineData.bestSubjectsAverage * 100) / 100 : null,
      division: engineData.division,
      performanceCategory: engineData.performanceCategory,
      attendance: engineData.attendance || { totalDays: 0, presentDays: 0, attendanceRate: 0 },
      termSummary: engineData.termSummary,
      curriculum: engineData.curriculum || { version: null, bestSubjectRule: null },
      teacherComment: reportTemplate?.includeComments !== false ? commentData.teacherComment : undefined,
      headComment: reportTemplate?.includeComments !== false ? commentData.headComment : undefined,
      includeStamp: reportTemplate?.includeStamp || false,
      includeSignature: reportTemplate?.includeSignature || false,
      stampUrl: reportTemplate?.stampUrl,
      signatureUrl: reportTemplate?.signatureUrl,
      directorName: reportTemplate?.directorName || '',
      headerText: reportTemplate?.headerText || '',
      footerText: reportTemplate?.footerText || '',
      showRemarks: reportTemplate?.remarksEnabled !== false,
      reportTitle: this.getProfessionalReportTitle(reportTemplate),
      templateVariant: this.getProfessionalReportVariant(reportTemplate),
      isAssessmentVariant: this.getProfessionalReportVariant(reportTemplate).includes('assessment'),
      isSelectionVariant: this.getProfessionalReportVariant(reportTemplate).includes('selection'),
      isAdvancedVariant: ['form-5-report', 'form-6-report'].includes(this.getProfessionalReportVariant(reportTemplate)),
      isExaminationVariant: ['grade-7-ecz', 'grade-7-mock'].includes(this.getProfessionalReportVariant(reportTemplate)),
      isTranscriptVariant: this.getProfessionalReportVariant(reportTemplate).includes('transcript'),
      isForm1Variant: this.getProfessionalReportVariant(reportTemplate).includes('form-1'),
      isForm2Variant: this.getProfessionalReportVariant(reportTemplate).includes('form-2'),
      isGrade10Variant: this.getProfessionalReportVariant(reportTemplate).includes('grade-10'),
      isGrade11Variant: this.getProfessionalReportVariant(reportTemplate).includes('grade-11'),
      isGrade12Variant: this.getProfessionalReportVariant(reportTemplate).includes('grade-12'),
      ...primaryContext,
      generatedAt: engineData.generatedAt,
      generatedAtFormatted,
      classAverage: classStats?.classAverage ?? null,
      midTermData,
      classComparison,
      gradeDistribution: classStats?.gradeDistribution ?? null,
      histogramData: classStats?.histogramData ?? null,
      gradingLegend: effectiveGradingLegend ?? [
        { grade: 'A', range: '80-100', label: 'Distinction', color: '#10b981' },
        { grade: 'B', range: '70-79', label: 'Merit', color: '#3b82f6' },
        { grade: 'C', range: '60-69', label: 'Credit', color: '#f59e0b' },
        { grade: 'D', range: '50-59', label: 'Pass', color: '#f97316' },
        { grade: 'E', range: '40-49', label: 'Marginal Pass', color: '#fb923c' },
        { grade: 'F', range: '0-39', label: 'Fail', color: '#ef4444' },
      ],
    };

    return { html: handlebars.compile(templateHtml)(templateData), data: engineData };
  }

  private getProfessionalReportVariant(template: any): string {
    return String(template?.metadata?.hbsVariant || template?.name || 'secondary-report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async getPrimaryReportContext(studentId: string, termId: string, template: any) {
    const variant = this.getProfessionalReportVariant(template);
    const isPrimarySchool = template?.metadata?.educationLevel === 'primary-school'
      || variant.includes('grade-1-6')
      || variant.includes('grade-7');
    const grade7Result = isPrimarySchool
      ? await this.prisma.grade7Result.findUnique({
        where: { studentId_termId: { studentId, termId } },
      })
      : null;

    return {
      isPrimarySchool,
      isGrade7Ecz: Boolean(grade7Result) || variant.includes('grade-7'),
      grade7Result,
    };
  }

  private async getGrade7GradingLegend(schoolId: string) {
    const gradingSystem = await this.prisma.gradingSystem.findFirst({
      where: { schoolId, name: 'ECZ Grade 7 Grading System' },
      include: { gradeScales: true },
    });
    if (!gradingSystem?.gradeScales?.length) return null;

    const colors: Record<string, string> = {
      One: '#16a34a',
      Two: '#2563eb',
      Three: '#ca8a04',
      Four: '#ea580c',
      Five: '#dc2626',
    };
    return [...gradingSystem.gradeScales]
      .sort((a, b) => (b.minScore ?? 0) - (a.minScore ?? 0))
      .map((scale) => ({
        grade: scale.grade,
        range: `${scale.minScore ?? 0}-${scale.maxScore ?? 100}`,
        label: scale.remark || scale.grade,
        color: colors[scale.grade] || '#6b7280',
      }));
  }

  private getProfessionalReportTitle(template: any): string {
    const variant = this.getProfessionalReportVariant(template);
    if (variant.includes('assessment')) return variant.includes('term') ? 'TERM ASSESSMENT SUMMARY' : 'CONTINUOUS ASSESSMENT REPORT';
    if (variant.includes('selection')) return 'GRADE 7 SELECTION REPORT';
    if (variant.includes('mock')) return 'GRADE 7 MOCK EXAMINATION REPORT';
    if (variant.includes('ecz')) return 'GRADE 7 ECZ EXAMINATION REPORT';
    if (variant.includes('transcript')) return variant.includes('abridged') ? 'ABRIDGED ACADEMIC TRANSCRIPT' : 'OFFICIAL ACADEMIC TRANSCRIPT';
    if (variant.includes('form-5') || variant.includes('form-6')) return 'ADVANCED SECONDARY REPORT CARD';
    if (variant.includes('form-1')) return 'FORM 1 ACADEMIC REPORT CARD';
    if (variant.includes('form-2')) return 'FORM 2 ACADEMIC REPORT CARD';
    if (variant.includes('grade-10')) return 'GRADE 10 ACADEMIC REPORT CARD';
    if (variant.includes('grade-11')) return 'GRADE 11 ACADEMIC REPORT CARD';
    if (variant.includes('grade-12')) return 'GRADE 12 ACADEMIC REPORT CARD';
    if (variant.includes('grade-1-6')) return 'GRADE 1-6 CONTINUOUS ASSESSMENT REPORT';
    return 'STUDENT REPORT CARD';
  }

  async generateClassCurriculumReportCardsPdf(
    schoolId: string,
    classId: string,
    termId: string,
    examType?: string,
  ): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (!term) throw new Error('Invalid term');

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, academicYearId: term.academicYearId, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      include: { student: true },
    });

    if (enrollments.length === 0) throw new Error('No students found in class');

    const reportTemplate = await this.prisma.reportTemplate.findFirst({
      where: { schoolId, isDefault: true },
    }) || await this.prisma.reportTemplate.findFirst({ where: { schoolId } });

    const templatePath = path.join(process.cwd(), 'src', 'templates', 'report-card-enhanced.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    // Pre-fetch class-level data shared across all students
    const [classStats, gradingLegend] = await Promise.all([
      this.reportCardEngineService.getClassStatistics(termId, classId, schoolId).catch(() => null),
      this.reportCardEngineService.getGradingLegend(schoolId, classId).catch(() => null),
    ]);
    const classPrimaryContext = await this.getPrimaryReportContext(
      enrollments[0].studentId,
      termId,
      reportTemplate,
    );
    const effectiveClassGradingLegend = classPrimaryContext.isGrade7Ecz
      ? await this.getGrade7GradingLegend(schoolId)
      : gradingLegend;

    const now = new Date();
    const generatedAtFormatted = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    let allHtml = '';

    for (const e of enrollments) {
      const engineData = await this.reportCardEngineService.generateReportCardData(
        e.studentId, termId, schoolId, examType,
      );
      const commentData = await this.analyticsService.generateStudentComment(schoolId, e.studentId, termId);
      const primaryContext = await this.getPrimaryReportContext(e.studentId, termId, reportTemplate);

      // Per-student enhanced data
      const [midTermData, classComparison] = await Promise.all([
        this.reportCardEngineService.getMidTermComparison(e.studentId, termId, schoolId).catch(() => null),
        this.reportCardEngineService.getClassComparison(e.studentId, termId, classId).catch(() => null),
      ]);

      const templateData = {
        schoolName: school.name,
        schoolLogo: reportTemplate?.includeLogo !== false ? (school.logoUrl || school.logo) : undefined,
        primaryColor: reportTemplate?.primaryColor || '#1976d2',
        secondaryColor: reportTemplate?.secondaryColor || '#f5f5f5',
        academicYear: engineData.academicYear?.name || '',
        termName: engineData.term?.name || '',
        examType: engineData.examType || examType || 'END_TERM',
        student: engineData.student,
        class: engineData.class,
        subjectBreakdown: engineData.subjectBreakdown || [],
        bestSubjects: engineData.bestSubjects || [],
        totalPoints: engineData.totalPoints ?? 0,
        bestSubjectsAverage: engineData.bestSubjectsAverage != null ? Math.round(engineData.bestSubjectsAverage * 100) / 100 : null,
        division: engineData.division,
        performanceCategory: engineData.performanceCategory,
        attendance: engineData.attendance || { totalDays: 0, presentDays: 0, attendanceRate: 0 },
        termSummary: engineData.termSummary,
        curriculum: engineData.curriculum || { version: null, bestSubjectRule: null },
        teacherComment: reportTemplate?.includeComments !== false ? commentData.teacherComment : undefined,
        headComment: reportTemplate?.includeComments !== false ? commentData.headComment : undefined,
        includeStamp: reportTemplate?.includeStamp || false,
        includeSignature: reportTemplate?.includeSignature || false,
        stampUrl: reportTemplate?.stampUrl,
        signatureUrl: reportTemplate?.signatureUrl,
        directorName: reportTemplate?.directorName || '',
        headerText: reportTemplate?.headerText || '',
        footerText: reportTemplate?.footerText || '',
        showRemarks: reportTemplate?.remarksEnabled !== false,
        reportTitle: this.getProfessionalReportTitle(reportTemplate),
        ...primaryContext,
        generatedAt: engineData.generatedAt,
        generatedAtFormatted,
        // Enhanced data
        classAverage: classStats?.classAverage ?? null,
        midTermData,
        classComparison,
        gradeDistribution: classStats?.gradeDistribution ?? null,
        histogramData: classStats?.histogramData ?? null,
        gradingLegend: effectiveClassGradingLegend ?? [
          { grade: 'A', range: '80-100', label: 'Distinction', color: '#10b981' },
          { grade: 'B', range: '70-79', label: 'Merit', color: '#3b82f6' },
          { grade: 'C', range: '60-69', label: 'Credit', color: '#f59e0b' },
          { grade: 'D', range: '50-59', label: 'Pass', color: '#f97316' },
          { grade: 'E', range: '40-49', label: 'Marginal Pass', color: '#fb923c' },
          { grade: 'F', range: '0-39', label: 'Fail', color: '#ef4444' },
        ],
      };

      const compiledTemplate = handlebars.compile(templateHtml);
      allHtml += `<div style="page-break-after:always">${compiledTemplate(templateData)}</div>`;
    }

    const html = `<html><body>${allHtml}</body></html>`;
    const browser = await this.getBrowser();
    const page = await this.getPage(browser);
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    const buffer = Buffer.from(pdf);
    const { url, publicId } = await this.uploadToCloudinary(buffer, `class-curriculum-${classId}-${termId}`);
    return { buffer, url, publicId };
  }
}
