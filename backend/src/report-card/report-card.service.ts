import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as puppeteer from 'puppeteer';
import { AnalyticsService } from '../analytics/analytics.service';
import { ReportCardEngineService } from '../report-card-engine/report-card-engine.service';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
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

@Injectable()
export class ReportCardService {
  constructor(
    private prisma: PrismaService,
    private analyticsService: AnalyticsService,
    private reportCardEngineService: ReportCardEngineService,
    private cloudinary: CloudinaryService,
  ) {}

  private async uploadToCloudinary(buffer: Buffer, publicId: string): Promise<{ url: string | null; publicId: string | null }> {
    try {
      const result = await this.cloudinary.uploadBuffer(buffer, {
        folder: `${FOLDERS.system}/report-cards`,
        publicId,
        resourceType: 'image',
      });
      return { url: result.secureUrl, publicId: result.publicId };
    } catch {
      return { url: null, publicId: null };
    }
  }

  private async getBrowser() {
    const userDataDir = path.join(os.tmpdir(), `puppeteer_${crypto.randomBytes(8).toString('hex')}`);
    return puppeteer.launch({
      userDataDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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

  private async getGradeFromScore(schoolId: string, score: number) {
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
        })
      : undefined;

    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId, isDefault: true },
      });
    }

    if (!gradingSystem) {
      gradingSystem = await this.prisma.gradingSystem.findFirst({
        where: { schoolId },
      });
    }

    if (!gradingSystem) {
      throw new Error('No grading system configured');
    }

    const gradeScale = await this.prisma.gradeScale.findFirst({
      where: {
        gradingSystemId: gradingSystem.id,
        minScore: { lte: score },
        maxScore: { gte: score },
      },
    });

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
      },
    });

    if (!enrollment) {
      throw new Error('Student not enrolled in this academic year');
    }

    const classEnrollments = await this.prisma.enrollment.findMany({
      where: {
        classId: enrollment.classId,
        academicYearId: term.academicYearId,
        status: 'ACTIVE',
      },
      select: {
        studentId: true,
      },
    });

    const studentIds = classEnrollments.map((e) => e.studentId);

    const allResults = await this.prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        termId,
        schoolId,
      },
    });

    const pointsMap: Record<string, number> = {};

    for (const r of allResults) {
      const grade = await this.getGradeFromScore(schoolId, r.score);

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

    const results = await this.prisma.result.findMany({
      where: {
        studentId,
        termId,
        schoolId,
      },
      include: {
        subject: true,
      },
    });

    if (results.length === 0) {
      throw new NotFoundException('No results found');
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
      const gradeScale = await this.getGradeFromScore(schoolId, r.score);

      console.log('DEBUG gradeScale remark:', gradeScale.remark, 'for score:', r.score);

      totalMarks += r.score;
      totalPoints += gradeScale.points;

      subjectsWithGrades.push({
        subject: r.subject.name,
        score: r.score,
        grade: gradeScale.grade,
        remark: gradeScale.remark,
        points: gradeScale.points,
      });
    }

    const average = totalMarks / results.length;

    const bestSix = subjectsWithGrades
      .map((s) => s.points)
      .sort((a, b) => a - b)
      .slice(0, 6);

    const bestSixTotal = bestSix.reduce((a, b) => a + b, 0);

    const hasFail = subjectsWithGrades.some((s) => s.points === 9);

    const eligibleForUniversity =
      subjectsWithGrades.length >= 6 && !hasFail && bestSixTotal <= 36;

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

      student: report.student,

      subjects: report.subjects,

      summary: {
        ...report.summary,
        average: report.summary.average.toFixed(2),
        eligibleForUniversity: report.summary.eligibleForUniversity
          ? 'YES'
          : 'NO',
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
      },
      include: {
        student: true,
      },
    });

    if (enrollments.length === 0) {
      throw new Error('No students found in class');
    }

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

        student: report.student,

        subjects: report.subjects,

        summary: {
          ...report.summary,
          average: report.summary.average.toFixed(2),
          eligibleForUniversity: report.summary.eligibleForUniversity
            ? 'YES'
            : 'NO',
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
    return { buffer, url, publicId };
  }

  async generateStudentTranscript(
    schoolId: string,
    studentId: string,
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

    for (const enrollment of enrollments) {
      for (const term of enrollment.academicYear.terms) {
        const results = await this.prisma.result.findMany({
          where: {
            studentId,
            termId: term.id,
            schoolId,
          },
          include: {
            subject: true,
          },
        });

        for (const r of results) {
          const grade = await this.getGradeFromScore(schoolId, r.score);

          transcriptRows += `
            <tr>
              <td>${enrollment.academicYear.name}</td>
              <td>${term.name}</td>
              <td>${enrollment.class.name}</td>
              <td>${r.subject.name}</td>
              <td>${r.score}</td>
              <td>${grade.grade}</td>
              <td>${grade.points}</td>
            </tr>
          `;
        }
      }
    }

    if (!transcriptRows) {
      transcriptRows = '<tr><td colspan="7" style="text-align:center">No results found</td></tr>';
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const schoolName = school?.name || 'SCHOOL NAME';

    const html = `
    <html>
    <head>

    <style>

    body{
      font-family: Arial, Helvetica, sans-serif;
      padding:40px;
    }

    .header{
      text-align:center;
      margin-bottom:30px;
    }

    .school-name{
      font-size:26px;
      font-weight:bold;
    }

    table{
      width:100%;
      border-collapse:collapse;
      margin-top:20px;
    }

    th, td{
      border:1px solid #ccc;
      padding:8px;
      text-align:center;
    }

    th{
      background:#f4f4f4;
    }

    .student-info{
      margin-top:20px;
    }

    .footer{
      margin-top:50px;
      display:flex;
      justify-content:space-between;
    }

    .signature-line{
      margin-top:40px;
      border-top:1px solid black;
      width:200px;
    }

    </style>

    </head>

    <body>

    <div class="header">

    <div class="school-name">
    ${schoolName}
    </div>

    <h2>Official Academic Transcript</h2>

    </div>


    <div class="student-info">

    <p><strong>Student:</strong> ${student.firstName} ${student.lastName}</p>
    <p><strong>Admission Number:</strong> ${student.admissionNumber}</p>

    </div>


    <table>

    <tr>
    <th>Academic Year</th>
    <th>Term</th>
    <th>Class</th>
    <th>Subject</th>
    <th>Score</th>
    <th>Grade</th>
    <th>Points</th>
    </tr>

    ${transcriptRows}

    </table>


    <div class="footer">

    <div>
    <div class="signature-line"></div>
    Head Teacher
    </div>

    <div>
    <div class="signature-line"></div>
    School Stamp
    </div>

    </div>

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
  ): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const engineData = await this.reportCardEngineService.generateReportCardData(
      studentId,
      termId,
      schoolId,
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

    const templatePath = path.join(process.cwd(), 'src', 'templates', 'report-card-curriculum.hbs');
    let templateHtml = fs.readFileSync(templatePath, 'utf8');

    const commentData = await this.analyticsService.generateStudentComment(schoolId, studentId, termId);
    const teacherComment = commentData.teacherComment;
    const headComment = commentData.headComment;

    const templateData = {
      schoolName: school.name,
      schoolLogo: reportTemplate?.includeLogo !== false ? (school.logoUrl || school.logo) : undefined,
      primaryColor: reportTemplate?.primaryColor || '#1976d2',
      secondaryColor: reportTemplate?.secondaryColor || '#f5f5f5',
      academicYear: engineData.academicYear?.name || '',
      termName: engineData.term?.name || '',
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
      teacherComment: reportTemplate?.includeComments !== false ? teacherComment : undefined,
      headComment: reportTemplate?.includeComments !== false ? headComment : undefined,
      includeStamp: reportTemplate?.includeStamp || false,
      includeSignature: reportTemplate?.includeSignature || false,
      stampUrl: reportTemplate?.stampUrl,
      signatureUrl: reportTemplate?.signatureUrl,
      directorName: reportTemplate?.directorName || '',
      headerText: reportTemplate?.headerText || '',
      footerText: reportTemplate?.footerText || '',
      showRemarks: reportTemplate?.remarksEnabled !== false,
      generatedAt: engineData.generatedAt,
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

  async generateClassCurriculumReportCardsPdf(
    schoolId: string,
    classId: string,
    termId: string,
  ): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (!term) throw new Error('Invalid term');

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, academicYearId: term.academicYearId, status: 'ACTIVE' },
      include: { student: true },
    });

    if (enrollments.length === 0) throw new Error('No students found in class');

    const reportTemplate = await this.prisma.reportTemplate.findFirst({
      where: { schoolId, isDefault: true },
    }) || await this.prisma.reportTemplate.findFirst({ where: { schoolId } });

    const templatePath = path.join(process.cwd(), 'src', 'templates', 'report-card-curriculum.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    let allHtml = '';

    for (const e of enrollments) {
      const engineData = await this.reportCardEngineService.generateReportCardData(
        e.studentId, termId, schoolId,
      );
      const commentData = await this.analyticsService.generateStudentComment(schoolId, e.studentId, termId);

      const templateData = {
        schoolName: school.name,
        schoolLogo: reportTemplate?.includeLogo !== false ? (school.logoUrl || school.logo) : undefined,
        primaryColor: reportTemplate?.primaryColor || '#1976d2',
        secondaryColor: reportTemplate?.secondaryColor || '#f5f5f5',
        academicYear: engineData.academicYear?.name || '',
        termName: engineData.term?.name || '',
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
        generatedAt: engineData.generatedAt,
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
