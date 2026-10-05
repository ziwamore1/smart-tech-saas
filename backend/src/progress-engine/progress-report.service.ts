import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressEngineService } from './progress-engine.service';

const fs = require('fs');
async function resolveLogoDataUri(l: any){if(!l)return null;const s=String(l).trim();if(!s)return null;if(s.startsWith('data:'))return s;if(s.startsWith('http://')||s.startsWith('https://')){try{const r=await fetch(s);if(!r.ok)return s;const type=r.headers.get('content-type')||'image/png';const ab=await r.arrayBuffer();const b=Buffer.from(ab);return 'data:'+type+';base64,'+b.toString('base64');}catch(e){return s;}}try{let fp=s.replace(/^file:\/\//,'');if(fs.existsSync(fp)){const b2=fs.readFileSync(fp);const a=fp.split('.');const ext=(a[a.length-1]||'').toLowerCase();const tt=ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='svg'?'image/svg+xml':'image/png';return 'data:'+tt+';base64,'+b2.toString('base64');}}catch(e){}return s;}
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
    if (!filters.classId) throw new Error('Select one class before generating a teacher subject report');
    const data = await this.getTeacherSubjectReportData(teacherId, subjectId, schoolId, filters);
    const html = await this.teacherSubjectHtml(data);
    return this.writePdf(html, schoolId, generatedById, { reportType: 'TEACHER_SUBJECT_PROGRESS_REPORT', title: `Teacher Subject Progress Report - ${data.subject.name}`, metadata: { reportScope: 'TEACHER_SUBJECT', teacherId, subjectId, filters, studentCount: data.students.length, assessmentRowCount: data.assessmentRows.length }, fileName: `teacher-subject-progress-${subjectId.slice(0, 8)}.pdf` });
  }

  private async getTeacherSubjectReportData(teacherId: string, subjectId: string, schoolId: string, filters: Record<string, string | undefined>) {
    const [school, teacher, subject, assignments] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, address: true, district: true, province: true, phone: true, email: true, logoUrl: true, logo: true, motto: true } }),
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
      this.prisma.studentAssessmentResult.findMany({ where: { subjectId, classId: { in: classIds }, termId: { in: termIds } }, include: { assessmentDef: { select: { id: true, name: true, code: true, category: true, defaultWeight: true, defaultMaxScore: true } }, term: { include: { academicYear: { select: { id: true, name: true } } } }, student: { select: { id: true } } } }),
      this.prisma.computedResult.findMany({ where: { schoolId, subjectId, classId: { in: classIds }, termId: { in: termIds }, status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] as any } }, include: { term: { include: { academicYear: { select: { id: true, name: true } } } } } }),
      this.prisma.termAssessmentConfiguration.findMany({ where: { subjectId, classId: { in: classIds }, termId: { in: termIds } }, include: { assessmentDef: { select: { id: true, name: true, code: true, category: true, defaultWeight: true, defaultMaxScore: true } }, term: { include: { academicYear: { select: { id: true, name: true } } } } }, orderBy: { sequenceOrder: 'asc' } }),
    ]);
    const studentIds = [...new Set(students.map(item => item.studentId))];
    const supplementalResults = await this.prisma.studentAssessmentResult.findMany({ where: { studentId: { in: studentIds }, subjectId, termId: { in: termIds } }, include: { assessmentDef: { select: { id: true, name: true, code: true, category: true, defaultWeight: true, defaultMaxScore: true } }, term: { include: { academicYear: { select: { id: true, name: true } } } }, student: { select: { id: true } } } });
    const allResults = [...new Map([...results, ...supplementalResults].map(result => [result.id, result])).values()];
    const verifiedEvidence = await this.prisma.progressEvidence.findMany({ where: { schoolId, subjectId, termId: { in: termIds }, sourceType: { in: ['ASSESSMENT', 'TERM_RESULT'] }, studentId: { in: studentIds } }, select: { studentId: true, classId: true, academicYearId: true, termId: true, assessmentId: true, rawScore: true, maxScore: true, percentage: true, isAbsent: true } });
    const evidenceAssessmentIds = [...new Set(verifiedEvidence.map(item => item.assessmentId).filter((id): id is string => Boolean(id)))];
    const evidenceDefinitions = await this.prisma.assessmentDefinition.findMany({ where: { id: { in: evidenceAssessmentIds } }, select: { id: true, name: true, code: true, category: true, defaultWeight: true, defaultMaxScore: true } });
    const scope = (classId: string, academicYearId: string, termId: string) => `${classId}:${academicYearId}:${termId}`;
    const assignmentScopes = new Set(assignments.flatMap(item => terms.filter(term => term.academicYearId === item.academicYearId).map(term => scope(item.classId, item.academicYearId, term.id))));
    const definitions = new Map<string, any[]>();
    configurations.forEach(config => { const key = scope(config.classId, config.term.academicYearId, config.termId); definitions.set(key, [...(definitions.get(key) || []), { ...config.assessmentDef, maxScore: config.maxScore, weight: config.weightPercentage }]); });
    allResults.forEach(result => { const key = scope(result.classId, result.term.academicYearId, result.termId); if (!definitions.get(key)?.some(item => item.id === result.assessmentDefId)) definitions.set(key, [...(definitions.get(key) || []), { ...result.assessmentDef, maxScore: result.maxScore, weight: result.assessmentDef.defaultWeight }]); });
    const resultMap = new Map<string, any>(allResults.map(result => [`${result.studentId}:${scope(result.classId, result.term.academicYearId, result.termId)}:${result.assessmentDefId}`, result]));
    verifiedEvidence.forEach(result => { if (result.assessmentId) resultMap.set(`${result.studentId}:${scope(result.classId, result.academicYearId, result.termId)}:${result.assessmentId}`, result); });
    const resultByPeriod = new Map<string, any>();const resultByCode = new Map<string, any>();
    allResults.forEach(result => { const def = result.assessmentDef; if (def?.code) resultByCode.set(`${result.studentId}:${result.term.academicYearId}:${result.termId}:${def.code}`, result); });
    verifiedEvidence.forEach(result => { if (result.assessmentId) { const def = evidenceDefinitions.find(d=>d.id===result.assessmentId); if (def?.code) resultByCode.set(`${result.studentId}:${result.academicYearId}:${result.termId}:${def.code}`, result); } });

    allResults.forEach(result => resultByPeriod.set(`${result.studentId}:${result.term.academicYearId}:${result.termId}:${result.assessmentDefId}`, result));
    verifiedEvidence.forEach(result => { if (result.assessmentId) resultByPeriod.set(`${result.studentId}:${result.academicYearId}:${result.termId}:${result.assessmentId}`, result); });
    const finalMap = new Map(finalResults.map(result => [`${result.studentId}:${scope(result.classId, result.term.academicYearId, result.termId)}`, result]));
    const assessmentRows: any[] = [];
    const finalRows: any[] = [];
    for (const enrollment of students) {
      for (const term of terms.filter(item => assignmentScopes.has(scope(enrollment.classId, enrollment.academicYearId, item.id)))) {
        const key = scope(enrollment.classId, enrollment.academicYearId, term.id);
        const items = definitions.get(key) || definitions.get(scope(classIds[0], enrollment.academicYearId, term.id)) || [];
        for (const definition of items.length ? items : [{ id: '', name: 'No verified assessment recorded', category: '', maxScore: null, weight: null }]) {
          const result = definition.id ? (resultMap.get(`${enrollment.studentId}:${key}:${definition.id}`) || resultByPeriod.get(`${enrollment.studentId}:${term.academicYearId}:${term.id}:${definition.id}`)) : null;
          const percentage = result?.percentage;
          const weighted = typeof percentage === 'number' && typeof definition.weight === 'number' ? percentage * definition.weight / 100 : null;
          assessmentRows.push({ student: enrollment.student, className: enrollment.class.name, academicYear: enrollment.academicYear.name, term: term.name, assessment: definition.name, category: definition.category, weight: definition.weight, maxScore: definition.maxScore, rawScore: result?.rawScore, percentage, weighted, status: result ? (result.isAbsent ? 'ABSENT' : 'VERIFIED') : 'NOT SUBMITTED' });
        }
        const final = finalMap.get(`${enrollment.studentId}:${key}`);
        const recorded = items.filter(item => resultMap.has(`${enrollment.studentId}:${key}:${item.id}`) || resultByPeriod.has(`${enrollment.studentId}:${term.academicYearId}:${term.id}:${item.id}`));
        finalRows.push({ student: enrollment.student, className: enrollment.class.name, academicYear: enrollment.academicYear.name, term: term.name, finalPercentage: final?.finalPercentage, grade: final?.finalGrade, assessed: recorded.length, missing: Math.max(0, items.length - recorded.length), absent: recorded.filter(item => (resultMap.get(`${enrollment.studentId}:${key}:${item.id}`) || resultByPeriod.get(`${enrollment.studentId}:${term.academicYearId}:${term.id}:${item.id}`))?.isAbsent).length });
      }
    }
    const yearGroups = academicYearIds.map(yearId => {
      const year = assignments.find(item => item.academicYearId === yearId)?.academicYear;
      const columns = new Map<string, any>();
      configurations.filter(item => item.term.academicYearId === yearId).forEach(item => columns.set(item.assessmentDefId, { ...item.assessmentDef, weight: item.weightPercentage }));
      allResults.filter(item => item.term.academicYearId === yearId).forEach(item => { if (!columns.has(item.assessmentDefId)) columns.set(item.assessmentDefId, { ...item.assessmentDef, weight: item.assessmentDef.defaultWeight, maxScore: item.maxScore }); });
      verifiedEvidence.filter(item => item.academicYearId === yearId && item.assessmentId).forEach(item => { const definition = evidenceDefinitions.find(definitionItem => definitionItem.id === item.assessmentId); if (definition && !columns.has(definition.id)) columns.set(definition.id, { ...definition, weight: definition.defaultWeight, maxScore: item.maxScore || definition.defaultMaxScore }); });
      return { id: yearId, name: year?.name || yearId, columns: [...columns.values()] };
    });
    const pivotStudents = [...new Map(students.map(enrollment => [enrollment.studentId, enrollment.student])).values()].map(student => ({
      student,
      values: yearGroups.map(group => {
        const enrollments = students.filter(item => item.studentId === student.id && item.academicYearId === group.id);
        const enrollmentClassId = enrollments[0]?.classId;
        const termItems = terms.filter(term => term.academicYearId === group.id && assignmentScopes.has(scope(enrollmentClassId, group.id, term.id)));
       return { yearId: group.id, cells: group.columns.map(column => ({ ...column, entries: termItems.map(term => { const result = resultMap.get(`${student.id}:${scope(enrollmentClassId, group.id, term.id)}:${column.id}`) || resultByPeriod.get(`${student.id}:${group.id}:${term.id}:${column.id}`) || (column.code ? resultByCode.get(`${student.id}:${group.id}:${term.id}:${column.code}`) : null); return { term: term.name, result }; }).filter(item => item.result || group.columns.length) })), final: termItems.map(term => finalMap.get(`${student.id}:${scope(enrollmentClassId, group.id, term.id)}`)).filter(Boolean) };
      }),
    }));
    return { school, teacher, subject, assignments, students, assessmentRows, finalRows, yearGroups, pivotStudents, className: assignments[0]?.class.name || 'Class' };
  }

  private async teacherSubjectHtml(data: any) {
    const teacherName = `${data.teacher?.firstName || ''} ${data.teacher?.lastName || ''}`.trim() || data.teacher?.email || 'Teacher';
    const location = [data.school?.address, data.school?.district, data.school?.province].filter(Boolean).join(' · ');
    const assignmentText = `${data.className} · ${data.assignments[0]?.academicYear.name || ''}`;
    const shortName = (column: any) => escapeHtml(column.code || column.name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 8));
    const yearHeaders = data.yearGroups.map((group: any) => `<th colspan="${group.columns.length + 1}" class="year-header">${escapeHtml(group.name)}</th>`).join('');
    const assessmentHeaders = data.yearGroups.map((group: any) => `${group.columns.map((column: any) => `<th title="${escapeHtml(column.name)}">${shortName(column)}<br><span>W:${column.weight ?? '—'}</span></th>`).join('')}<th>Final</th>`).join('');
    const pivotRows = data.pivotStudents.map((row: any) => `<tr><td class="student"><strong>${escapeHtml(`${row.student.firstName || ''} ${row.student.lastName || ''}`.trim())}</strong><br><span>${escapeHtml(row.student.admissionNumber || '')}</span></td>${row.values.map((year: any) => `${year.cells.map((cell: any) => `<td>${cell.entries.length ? cell.entries.map((entry: any) => { const result = entry.result; if (!result) return `<span class="missing">${escapeHtml(entry.term)}: —</span>`; if (result.isAbsent) return `<span class="absent">${escapeHtml(entry.term)}: ABSENT</span>`; const pct = result.percentage === null || result.percentage === undefined ? '—' : `${result.percentage.toFixed(1)}%`; const weighted = typeof cell.weight === 'number' && result.percentage != null ? ` · ${ (result.percentage * cell.weight / 100).toFixed(1)}w` : ''; return `<span>${escapeHtml(entry.term)}: ${result.rawScore ?? '—'}/${result.maxScore ?? '—'} · ${pct}${weighted}</span>`; }).join('<br>') : '<span class="missing">—</span>'}</td>`).join('')}<td>${year.final.length ? year.final.map((item: any) => item.finalPercentage == null ? '—' : `${item.finalPercentage.toFixed(1)}%`).join('<br>') : '—'}</td>`).join('')}</tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:16mm 13mm 18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111827;font-size:14px;line-height:1.45;margin:0}header{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-bottom:4px solid #3730a3;padding-bottom:11px;margin-bottom:13px}header img{width:68px;height:68px;object-fit:contain;margin-bottom:5px}h1{font-size:25px;margin:0;color:#111827}h2{font-size:16px;text-transform:uppercase;letter-spacing:.08em;color:#312e81;border-bottom:1px solid #a5b4fc;padding-bottom:5px;margin:17px 0 9px}.identity{font-size:13px;color:#374151}.profile{display:grid;grid-template-columns:1.5fr 1.5fr 1.5fr 1fr;gap:8px;background:#eef2ff;padding:11px;border-radius:7px}.profile strong{display:block;font-size:10px;text-transform:uppercase;color:#3730a3}.profile span{font-size:15px;font-weight:bold}.scope{background:#f8fafc;border:1px solid #6b7280;padding:9px;border-radius:6px;margin-top:9px;font-size:13px}.table-wrap{width:100%;overflow:visible}table{width:100%;border-collapse:collapse;table-layout:fixed;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}th{background:#1f2937;color:#fff;text-align:center;font-size:12px;text-transform:uppercase}th.year-header{background:#312e81;font-size:13px;border-bottom:2px solid #fff}th span{font-size:10px;font-weight:normal}td,th{padding:7px;border:1px solid #4b5563;vertical-align:top;word-wrap:break-word}td{font-size:13px;color:#111827}td.student{width:18%;font-size:15px}td.student span{font-size:12px;color:#1f2937}.missing{color:#374151}.absent{color:#991b1b;font-weight:bold}.footer{margin-top:14px;color:#1f2937;font-size:12px;border-top:1px solid #6b7280;padding-top:5px}</style></head><body><header>${data.school?.logoUrl || data.school?.logo ? `<img src="${await resolveLogoDataUri(data.school.logoUrl || data.school.logo)}"/>` : ''}<div><h1>${escapeHtml(data.school?.name || 'School')}</h1><div class="identity">${escapeHtml(location || 'School address not recorded')} ${data.school?.phone ? ` · ${escapeHtml(data.school.phone)}` : ''} ${data.school?.email ? ` · ${escapeHtml(data.school.email)}` : ''}</div><div class="identity">${escapeHtml(data.school?.motto || 'Verified longitudinal academic record')}</div></div></header><section class="profile"><div><strong>Report</strong><span>Teacher Subject Progress</span></div><div><strong>Teacher</strong><span>${escapeHtml(teacherName)}</span></div><div><strong>Class</strong><span>${escapeHtml(data.className)}</span></div><div><strong>Subject</strong><span>${escapeHtml(data.subject.name)}${data.subject.code ? ` (${escapeHtml(data.subject.code)})` : ''}</span></div></section><div class="scope"><strong>Assignment scope:</strong> ${escapeHtml(assignmentText)}<br><span>Assessment codes appear in the column headers. Each cell shows term, score/max, percentage, and weighted contribution. ABSENT and missing work are shown explicitly and are not treated as zero.</span></div><h2>Student assessment trajectory</h2><div class="table-wrap"><table><thead><tr><th rowspan="2">Student</th>${yearHeaders}</tr><tr>${assessmentHeaders}</tr></thead><tbody>${pivotRows || '<tr><td colspan="20">No enrolled students found for this assignment scope.</td></tr>'}</tbody></table></div><div class="footer">${escapeHtml(data.school?.name || 'School')} · Teacher Subject Progress · Generated ${new Date().toLocaleString()}</div></body></html>`;
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
