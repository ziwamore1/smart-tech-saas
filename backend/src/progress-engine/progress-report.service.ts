import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressEngineService } from './progress-engine.service';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));

@Injectable()
export class ProgressReportService {
  constructor(private readonly prisma: PrismaService, private readonly progress: ProgressEngineService) {}

  async generateStudentPdf(studentId: string, schoolId: string, generatedById: string) {
    const data = await this.progress.getStudentProgress(studentId, schoolId);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, address: true, logoUrl: true } });
    const rows = data.timeline.map((item: any) => `<tr><td>${escapeHtml(item.academicYear)}</td><td>${escapeHtml(item.term)}</td><td>${escapeHtml(item.subject?.name)}</td><td>${item.averagePercentage === null ? 'Not assessed' : `${item.averagePercentage.toFixed(1)}%`}</td><td>${escapeHtml(item.grade || '—')}</td></tr>`).join('');
    const journey = data.student.enrollments.map((item: any) => `<li><strong>${escapeHtml(item.academicYear)}</strong><span>${escapeHtml(item.class)} · ${escapeHtml(item.status)}</span></li>`).join('');
    const evidence = data.evidence.slice(0, 200).map((item: any) => `<tr><td>${escapeHtml(item.assessmentId || 'Assessment')}</td><td>${item.score ?? 'Not assessed'} / ${item.maxScore ?? '—'}</td><td>${item.percentage === null || item.percentage === undefined ? 'Not assessed' : `${item.percentage.toFixed(1)}%`}</td><td>${escapeHtml(item.grade || '—')}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:A4;margin:16mm 14mm 18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;font-size:10px;line-height:1.45;margin:0}header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #6d28d9;padding-bottom:12px;margin-bottom:18px}header img{width:48px;height:48px;object-fit:contain}h1{font-size:21px;margin:0;color:#172033}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#5b21b6;border-bottom:1px solid #ddd6fe;padding-bottom:5px;margin:22px 0 9px}.muted{color:#64748b}.profile{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#f5f3ff;padding:12px;border-radius:8px}.profile strong{display:block;font-size:8px;text-transform:uppercase;color:#6b7280}.profile span{font-size:11px;font-weight:bold}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.card{border:1px solid #e2e8f0;border-radius:7px;padding:9px}.card strong{display:block;color:#6d28d9;font-size:8px;text-transform:uppercase}.card span{display:block;font-size:17px;font-weight:bold;margin-top:3px}table{width:100%;border-collapse:collapse}th{background:#172033;color:#fff;text-align:left;font-size:8px;text-transform:uppercase}td,th{padding:6px;border:1px solid #dbe2ea}tr:nth-child(even){background:#f8fafc}.journey{list-style:none;padding:0;margin:0;border-left:2px solid #c4b5fd}.journey li{padding:0 0 8px 12px;position:relative}.journey li:before{content:'';position:absolute;left:-7px;top:3px;width:10px;height:10px;background:#7c3aed;border-radius:50%}.journey span{display:block;color:#64748b}.note{background:#fffbeb;border:1px solid #fde68a;padding:9px;border-radius:7px}.footer{position:fixed;bottom:-10mm;left:0;right:0;text-align:center;color:#64748b;font-size:8px}
    </style></head><body><header>${school?.logoUrl ? `<img src="${escapeHtml(school.logoUrl)}"/>` : ''}<div><h1>Individual Student Progress Report</h1><div class="muted">${escapeHtml(school?.name || 'Smart Tech SaaS')} · Longitudinal Academic Record</div></div></header>
    <section class="profile"><div><strong>Student</strong><span>${escapeHtml(data.student.name)}</span></div><div><strong>Admission number</strong><span>${escapeHtml(data.student.admissionNumber)}</span></div><div><strong>Current class</strong><span>${escapeHtml(data.student.className || 'Not recorded')}</span></div><div><strong>Status</strong><span>${escapeHtml(data.student.status)}</span></div></section>
    <h2>Overall progress</h2><div class="cards"><div class="card"><strong>Average</strong><span>${data.summary.average === null ? 'Insufficient data' : `${data.summary.average.toFixed(1)}%`}</span></div><div class="card"><strong>Median</strong><span>${data.summary.median === null ? 'Insufficient data' : `${data.summary.median.toFixed(1)}%`}</span></div><div class="card"><strong>Trend</strong><span>${escapeHtml(data.summary.trend.direction.replace('_', ' '))}</span></div><div class="card"><strong>Evidence</strong><span>${data.evidence.length}</span></div></div>
    <h2>Academic journey</h2><ul class="journey">${journey || '<li>Insufficient enrollment history</li>'}</ul>
    <h2>Subject and term progression</h2><table><thead><tr><th>Academic year</th><th>Term</th><th>Subject</th><th>Average</th><th>Grade</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Insufficient data</td></tr>'}</tbody></table>
    <h2>Assessment evidence</h2><p class="muted">Only recorded evidence is shown. Missing or absent assessments are not treated as zero.</p><table><thead><tr><th>Assessment</th><th>Score</th><th>Percentage</th><th>Grade</th></tr></thead><tbody>${evidence || '<tr><td colspan="4">Insufficient data</td></tr>'}</tbody></table>
    <div class="note"><strong>Report integrity:</strong> This report is generated from verified academic evidence. Underlying results remain immutable and a later correction produces a new report version.</div><div class="footer">Generated ${new Date().toLocaleDateString()} · Smart Tech SaaS · Page <span class="pageNumber"></span></div></body></html>`;
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdf = Buffer.from(await page.pdf({ format: 'A4', printBackground: true, displayHeaderFooter: false }));
      const report = await this.prisma.generatedReport.create({ data: { schoolId, reportType: 'PROGRESS_REPORT', title: `Progress Report - ${data.student.name}`, studentId, fileName: `progress-report-${studentId.slice(0, 8)}.pdf`, fileSize: pdf.length, generatedById, metadata: { reportVersion: 1, reportScope: 'INDIVIDUAL_STUDENT', analyticsVersion: 'progress-engine-v1', evidenceCount: data.evidence.length } } });
      return { pdf, reportId: report.id, fileName: report.fileName, data };
    } finally {
      await browser.close();
    }
  }

  async generateClassPdf(classId: string, schoolId: string, generatedById: string, filters: Record<string, string | undefined> = {}) {
    const data = await this.progress.getClassProgress(classId, schoolId, filters);
    const classEntity = await this.prisma.class.findFirst({ where: { id: classId, schoolId }, select: { name: true } });
    const periods = data.periods.map((period: any) => `<tr><td>${escapeHtml(period.academicYear)}</td><td>${escapeHtml(period.term)}</td><td>${period.average === null ? 'Insufficient data' : `${period.average.toFixed(1)}%`}</td><td>${period.count}</td></tr>`).join('');
    const html = this.summaryHtml(`Class Progress Report`, `${classEntity?.name || 'Class'} · Population Analysis`, `<div class="cards"><div class="card"><strong>Students</strong><span>${data.count}</span></div><div class="card"><strong>Mean</strong><span>${data.statistics.mean === null ? 'Insufficient data' : `${data.statistics.mean.toFixed(1)}%`}</span></div><div class="card"><strong>Pass rate</strong><span>${data.statistics.passRate === null ? 'Insufficient data' : `${data.statistics.passRate.toFixed(1)}%`}</span></div><div class="card"><strong>Trend</strong><span>${escapeHtml(data.trend.direction.replace('_', ' '))}</span></div></div><h2>Progress trend</h2><table><thead><tr><th>Academic year</th><th>Term</th><th>Average</th><th>Observed</th></tr></thead><tbody>${periods || '<tr><td colspan="4">Insufficient data</td></tr>'}</tbody></table><h2>Population statistics</h2><p>Median: ${data.statistics.median ?? 'Insufficient data'} · Standard deviation: ${data.statistics.standardDeviation ?? 'Insufficient data'} · Range: ${data.statistics.min ?? '—'} to ${data.statistics.max ?? '—'}</p>`);
    return this.writePdf(html, schoolId, generatedById, { reportType: 'CLASS_PROGRESS_REPORT', title: `Class Progress Report - ${classEntity?.name || classId}`, classId, fileName: `class-progress-${classId.slice(0, 8)}.pdf`, metadata: { reportScope: 'CLASS', filters } });
  }

  async generateTeacherSubjectPdf(teacherId: string, subjectId: string, schoolId: string, generatedById: string, filters: Record<string, string | undefined> = {}) {
    const data = await this.getTeacherSubjectReportData(teacherId, subjectId, schoolId, filters);
    const html = this.teacherSubjectHtml(data);
    return this.writePdf(html, schoolId, generatedById, { reportType: 'TEACHER_SUBJECT_PROGRESS_REPORT', title: `Teacher Subject Progress Report - ${data.subject.name}`, metadata: { reportScope: 'TEACHER_SUBJECT', teacherId, subjectId, filters, studentCount: data.students.length, assessmentRowCount: data.assessmentRows.length }, fileName: `teacher-subject-progress-${subjectId.slice(0, 8)}.pdf` });
  }

  private async getTeacherSubjectReportData(teacherId: string, subjectId: string, schoolId: string, filters: Record<string, string | undefined>) {
    const [school, teacher, subject, assignments] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, address: true, district: true, province: true, phone: true, email: true, logoUrl: true, motto: true } }),
      this.prisma.user.findUnique({ where: { id: teacherId }, select: { firstName: true, lastName: true, email: true } }),
      this.prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true, name: true, code: true } }),
      this.prisma.teachingAssignment.findMany({ where: { schoolId, teacherId, subjectId, ...(filters.classId ? { classId: filters.classId } : {}), ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}) }, include: { class: { select: { id: true, name: true } }, academicYear: { select: { id: true, name: true } } }, orderBy: { academicYear: { startDate: 'asc' } } }),
    ]);
    if (!subject) throw new Error('Subject not found');
    const classIds = [...new Set(assignments.map(item => item.classId))];
    const academicYearIds = [...new Set(assignments.map(item => item.academicYearId))];
    const terms = await this.prisma.term.findMany({ where: { academicYearId: { in: academicYearIds }, ...(filters.termId ? { id: filters.termId } : {}) }, include: { academicYear: { select: { id: true, name: true } } }, orderBy: { startDate: 'asc' } });
    const termIds = terms.map(term => term.id);
    const [students, results, finalResults, configurations] = await Promise.all([
      this.prisma.enrollment.findMany({ where: { schoolId, classId: { in: classIds }, academicYearId: { in: academicYearIds }, status: 'ACTIVE' }, include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } }, class: { select: { id: true, name: true } }, academicYear: { select: { id: true, name: true } } }, orderBy: [{ class: { name: 'asc' } }, { student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }] }),
      this.prisma.studentAssessmentResult.findMany({ where: { subjectId, classId: { in: classIds }, termId: { in: termIds }, status: { in: ['VERIFIED', 'APPROVED', 'PUBLISHED'] as any } }, include: { assessmentDef: { select: { id: true, name: true, category: true, defaultWeight: true, defaultMaxScore: true } }, term: { include: { academicYear: { select: { id: true, name: true } } } }, student: { select: { id: true } } } }),
      this.prisma.computedResult.findMany({ where: { schoolId, subjectId, classId: { in: classIds }, termId: { in: termIds }, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] as any } }, include: { term: { include: { academicYear: { select: { id: true, name: true } } } } } }),
      this.prisma.termAssessmentConfiguration.findMany({ where: { subjectId, classId: { in: classIds }, termId: { in: termIds } }, include: { assessmentDef: { select: { id: true, name: true, category: true, defaultWeight: true, defaultMaxScore: true } }, term: { include: { academicYear: { select: { id: true, name: true } } } } }, orderBy: { sequenceOrder: 'asc' } }),
    ]);
    const scope = (classId: string, academicYearId: string, termId: string) => `${classId}:${academicYearId}:${termId}`;
    const assignmentScopes = new Set(assignments.flatMap(item => terms.filter(term => term.academicYearId === item.academicYearId).map(term => scope(item.classId, item.academicYearId, term.id))));
    const definitions = new Map<string, any[]>();
    configurations.forEach(config => { const key = scope(config.classId, config.term.academicYearId, config.termId); definitions.set(key, [...(definitions.get(key) || []), { ...config.assessmentDef, maxScore: config.maxScore, weight: config.weightPercentage }]); });
    results.forEach(result => { const key = scope(result.classId, result.term.academicYearId, result.termId); if (!definitions.get(key)?.some(item => item.id === result.assessmentDefId)) definitions.set(key, [...(definitions.get(key) || []), { ...result.assessmentDef, maxScore: result.maxScore, weight: result.assessmentDef.defaultWeight }]); });
    const resultMap = new Map(results.map(result => [`${result.studentId}:${scope(result.classId, result.term.academicYearId, result.termId)}:${result.assessmentDefId}`, result]));
    const finalMap = new Map(finalResults.map(result => [`${result.studentId}:${scope(result.classId, result.term.academicYearId, result.termId)}`, result]));
    const assessmentRows: any[] = [];
    const finalRows: any[] = [];
    for (const enrollment of students) {
      for (const term of terms.filter(item => assignmentScopes.has(scope(enrollment.classId, enrollment.academicYearId, item.id)))) {
        const key = scope(enrollment.classId, enrollment.academicYearId, term.id);
        const items = definitions.get(key) || [];
        for (const definition of items.length ? items : [{ id: '', name: 'No verified assessment recorded', category: '', maxScore: null, weight: null }]) {
          const result = definition.id ? resultMap.get(`${enrollment.studentId}:${key}:${definition.id}`) : null;
          const percentage = result?.percentage;
          const weighted = typeof percentage === 'number' && typeof definition.weight === 'number' ? percentage * definition.weight / 100 : null;
          assessmentRows.push({ student: enrollment.student, className: enrollment.class.name, academicYear: enrollment.academicYear.name, term: term.name, assessment: definition.name, category: definition.category, weight: definition.weight, maxScore: definition.maxScore, rawScore: result?.rawScore, percentage, weighted, status: result ? (result.isAbsent ? 'ABSENT' : 'VERIFIED') : 'NOT SUBMITTED' });
        }
        const final = finalMap.get(`${enrollment.studentId}:${key}`);
        const recorded = items.filter(item => resultMap.has(`${enrollment.studentId}:${key}:${item.id}`));
        finalRows.push({ student: enrollment.student, className: enrollment.class.name, academicYear: enrollment.academicYear.name, term: term.name, finalPercentage: final?.finalPercentage, grade: final?.finalGrade, assessed: recorded.length, missing: Math.max(0, items.length - recorded.length), absent: recorded.filter(item => resultMap.get(`${enrollment.studentId}:${key}:${item.id}`)?.isAbsent).length });
      }
    }
    return { school, teacher, subject, assignments, students, assessmentRows, finalRows };
  }

  private teacherSubjectHtml(data: any) {
    const teacherName = `${data.teacher?.firstName || ''} ${data.teacher?.lastName || ''}`.trim() || data.teacher?.email || 'Teacher';
    const location = [data.school?.address, data.school?.district, data.school?.province].filter(Boolean).join(' · ');
    const assignmentText = data.assignments.map((item: any) => `${item.class.name} · ${item.academicYear.name}`).join(' | ');
    const assessmentRows = data.assessmentRows.map((row: any) => `<tr><td>${escapeHtml(`${row.student.firstName || ''} ${row.student.lastName || ''}`.trim())}<br><span class="muted">${escapeHtml(row.student.admissionNumber || '')}</span></td><td>${escapeHtml(row.className)}</td><td>${escapeHtml(row.academicYear)}</td><td>${escapeHtml(row.term)}</td><td><strong>${escapeHtml(row.assessment)}</strong><br><span class="muted">${escapeHtml(row.category || '')}</span></td><td>${row.weight === null || row.weight === undefined ? '—' : `${row.weight}%`}</td><td>${row.rawScore === null || row.rawScore === undefined ? '—' : `${row.rawScore} / ${row.maxScore ?? '—'}`}</td><td>${row.percentage === null || row.percentage === undefined ? '—' : `${row.percentage.toFixed(1)}%`}</td><td>${row.weighted === null ? '—' : `${row.weighted.toFixed(1)}%`}</td><td class="${row.status === 'VERIFIED' ? 'ok' : 'warning'}">${row.status}</td></tr>`).join('');
    const finalRows = data.finalRows.map((row: any) => `<tr><td>${escapeHtml(`${row.student.firstName || ''} ${row.student.lastName || ''}`.trim())}</td><td>${escapeHtml(row.academicYear)}</td><td>${escapeHtml(row.term)}</td><td>${row.finalPercentage === null || row.finalPercentage === undefined ? 'Not computed' : `${row.finalPercentage.toFixed(1)}%`}</td><td>${escapeHtml(row.grade || '—')}</td><td>${row.assessed}</td><td>${row.missing}</td><td>${row.absent}</td></tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:13mm 11mm 16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;font-size:9px;line-height:1.35;margin:0}header{display:flex;align-items:center;gap:14px;border-bottom:4px solid #4f46e5;padding-bottom:10px;margin-bottom:12px}header img{width:58px;height:58px;object-fit:contain}h1{font-size:20px;margin:0;color:#172033}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#3730a3;border-bottom:1px solid #c7d2fe;padding-bottom:5px;margin:17px 0 8px}.muted{color:#64748b}.identity{font-size:10px;color:#475569}.profile{display:grid;grid-template-columns:2fr 2fr 1fr 1fr;gap:8px;background:#eef2ff;padding:10px;border-radius:7px}.profile strong{display:block;font-size:8px;text-transform:uppercase;color:#4f46e5}.profile span{font-size:11px;font-weight:bold}.note{background:#fffbeb;border:1px solid #fcd34d;padding:8px;border-radius:6px;margin:8px 0}.scope{background:#f8fafc;border:1px solid #cbd5e1;padding:8px;border-radius:6px}.table-wrap{overflow:visible}table{width:100%;border-collapse:collapse;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}th{background:#1e293b;color:#fff;text-align:left;font-size:7px;text-transform:uppercase}td,th{padding:5px;border:1px solid #cbd5e1;vertical-align:top}tr:nth-child(even){background:#f8fafc}.ok{color:#166534;font-weight:bold}.warning{color:#92400e;font-weight:bold}.footer{position:fixed;bottom:-9mm;left:0;right:0;text-align:center;color:#64748b;font-size:8px}</style></head><body><header>${data.school?.logoUrl ? `<img src="${escapeHtml(data.school.logoUrl)}"/>` : ''}<div><h1>${escapeHtml(data.school?.name || 'School')}</h1><div class="identity">${escapeHtml(location || 'School address not recorded')} ${data.school?.phone ? ` · ${escapeHtml(data.school.phone)}` : ''} ${data.school?.email ? ` · ${escapeHtml(data.school.email)}` : ''}</div><div class="identity">${escapeHtml(data.school?.motto || 'Verified longitudinal academic record')}</div></div></header><section class="profile"><div><strong>Report</strong><span>Teacher Subject Progress</span></div><div><strong>Teacher</strong><span>${escapeHtml(teacherName)}</span></div><div><strong>Subject</strong><span>${escapeHtml(data.subject.name)}${data.subject.code ? ` (${escapeHtml(data.subject.code)})` : ''}</span></div><div><strong>Generated</strong><span>${new Date().toLocaleDateString()}</span></div></section><div class="scope"><strong>Assignment scope:</strong> ${escapeHtml(assignmentText || 'No teaching assignment found')}<br><span class="muted">Only verified, approved, published, or locked source records are included. A missing score is shown as NOT SUBMITTED and is not converted to zero.</span></div><h2>Assessment evidence by student</h2><div class="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Academic year</th><th>Term</th><th>Assessment</th><th>Weight</th><th>Score / max</th><th>Percentage</th><th>Weighted contribution</th><th>Status</th></tr></thead><tbody>${assessmentRows || '<tr><td colspan="10">No verified assessment evidence found.</td></tr>'}</tbody></table></div><h2>Final subject trajectory</h2><p class="muted">Use this table with the assessment evidence above to identify whether a final percentage was affected by missing work or absence.</p><table><thead><tr><th>Student</th><th>Academic year</th><th>Term</th><th>Final percentage</th><th>Grade</th><th>Assessed</th><th>Missing</th><th>Absent</th></tr></thead><tbody>${finalRows || '<tr><td colspan="8">No enrolled students found for this assignment scope.</td></tr>'}</tbody></table><div class="footer">${escapeHtml(data.school?.name || 'School')} · Teacher Subject Progress · Generated ${new Date().toLocaleDateString()}</div></body></html>`;
  }

  private summaryHtml(title: string, subtitle: string, content: string) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:16mm 14mm 18mm}*{box-sizing:border-box}body{font-family:Arial;color:#172033;font-size:10px;line-height:1.45}header{border-bottom:3px solid #6d28d9;padding-bottom:12px;margin-bottom:18px}h1{font-size:21px;margin:0}h2{font-size:13px;text-transform:uppercase;color:#5b21b6;border-bottom:1px solid #ddd6fe;padding-bottom:5px;margin:22px 0 9px}.muted{color:#64748b}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.card{border:1px solid #e2e8f0;border-radius:7px;padding:9px}.card strong{display:block;color:#6d28d9;font-size:8px;text-transform:uppercase}.card span{display:block;font-size:17px;font-weight:bold;margin-top:3px}table{width:100%;border-collapse:collapse}th{background:#172033;color:#fff;text-align:left;font-size:8px;text-transform:uppercase}td,th{padding:6px;border:1px solid #dbe2ea}tr:nth-child(even){background:#f8fafc}</style></head><body><header><h1>${escapeHtml(title)}</h1><div class="muted">${escapeHtml(subtitle)} · Smart Tech SaaS</div></header>${content}<p class="muted">Generated ${new Date().toLocaleDateString()} from server-side verified progress snapshots.</p></body></html>`;
  }

  private async writePdf(html: string, schoolId: string, generatedById: string, details: { reportType: string; title: string; fileName: string; classId?: string; metadata: Record<string, any> }) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdf = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
      const report = await this.prisma.generatedReport.create({ data: { schoolId, reportType: details.reportType, title: details.title, classId: details.classId, fileName: details.fileName, fileSize: pdf.length, generatedById, metadata: details.metadata } });
      return { pdf, reportId: report.id, fileName: report.fileName };
    } finally {
      await browser.close();
    }
  }
}
