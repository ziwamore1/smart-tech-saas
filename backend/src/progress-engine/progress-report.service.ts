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
}
