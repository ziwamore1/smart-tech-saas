import { Injectable, NotFoundException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessCalendarAnalyticsService, CalendarAnalytics } from './business-calendar-analytics.service';

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (v: Date | string | null) => v ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : '—';

const STATUS_COLOUR: Record<string, [string, string]> = {
  PLANNED:              ['#475569', '#f1f5f9'],
  SCHEDULED:            ['#1e40af', '#dbeafe'],
  IN_PROGRESS:          ['#0369a1', '#e0f2fe'],
  COMPLETED:            ['#047857', '#d1fae5'],
  PARTIALLY_COMPLETED:  ['#92400e', '#fef3c7'],
  DELAYED:              ['#c2410c', '#ffedd5'],
  POSTPONED:            ['#7c3aed', '#ede9fe'],
  CANCELLED:            ['#991b1b', '#fee2e2'],
  NOT_COMPLETED:        ['#991b1b', '#fee2e2'],
  RESCHEDULED:          ['#a16207', '#fef3c7'],
};

const GOAL_COLOUR: Record<string, [string, string]> = {
  ON_TRACK:  ['#047857', '#d1fae5'],
  AT_RISK:   ['#a16207', '#fef3c7'],
  OFF_TRACK: ['#991b1b', '#fee2e2'],
  ACHIEVED:  ['#0e7490', '#cffafe'],
};

const chip = (text: string, fg: string, bg: string) => `<span style="display:inline-block;border-radius:999px;padding:2px 9px;font-size:8px;font-weight:700;color:${fg};background:${bg};letter-spacing:.06em;text-transform:uppercase;white-space:nowrap">${esc(text)}</span>`;
const num = (v: number, suffix = '') => v == null ? '—' : `${Math.round(v * 10) / 10}${suffix}`;

const sectionStyle = `page-break-before:always;padding-top:6px;`;
const sectionHeaderStyle = `border-bottom:2px solid #0e7490;padding-bottom:5px;margin:0 0 12px;color:#0e7490;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase`;

function statusChip(status: string) {
  const [fg, bg] = STATUS_COLOUR[status] || ['#475569', '#f1f5f9'];
  return chip(status.replace(/_/g, ' '), fg, bg);
}

function goalChip(status: string) {
  const [fg, bg] = GOAL_COLOUR[status] || ['#475569', '#f1f5f9'];
  return chip(status.replace(/_/g, ' '), fg, bg);
}

@Injectable()
export class BusinessCalendarReportService {
  constructor(private readonly prisma: PrismaService, private readonly analytics: BusinessCalendarAnalyticsService) {}

  async buildAnalytics(calendarId: string, schoolId: string): Promise<CalendarAnalytics> {
    const calendar = await this.prisma.schoolBusinessCalendar.findFirst({ where: { id: calendarId, schoolId } });
    if (!calendar) throw new NotFoundException('Calendar not found');
    return this.analytics.analyse(schoolId, calendarId, { calendarId });
  }

  async html(calendarId: string, schoolId: string) {
    const a = await this.buildAnalytics(calendarId, schoolId);
    const logoTag = a.school.logo ? `<img src="${esc(a.school.logo)}" alt="School logo" style="height:56px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc">` : `<div style="width:56px;height:56px;border-radius:10px;background:linear-gradient(135deg,#0e7490,#123047);color:#fff;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center">${esc(a.school.name?.charAt(0) || 'S')}</div>`;

    const metricsTable = (m: { label: string; value: string | number; highlight?: boolean }[]) =>
      `<table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:6px"><tbody><tr>${m.map((item) => `<td style="padding:5px 7px;text-align:center;border:1px solid #e2e8f0;background:${item.highlight ? '#f0fdfa' : '#f8fafc'}"><div style="font-size:15px;font-weight:800;color:#123047">${item.value}</div><div style="font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-top:1px">${item.label}</div></td>`).join('')}</tr></tbody></table>`;

    const deptRows = a.departments.map((d, i) => `<tr><td class="num">${i + 1}</td><td>${esc(d.departmentName)}</td><td>${d.planned}</td><td>${d.completed}</td><td>${num(d.completionRate, '%')}</td><td>${d.delayed}</td><td>${d.notCompleted}</td><td>${num(d.targetAchievement, '%')}</td><td>${d.overdue}</td></tr>`).join('');
    const catRows = a.categories.map((c, i) => `<tr><td class="num">${i + 1}</td><td>${esc(c.categoryName)}</td><td>${c.planned}</td><td>${c.completed}</td><td>${num(c.completionRate, '%')}</td><td>${c.delayed}</td><td>${num(c.targetAchievement, '%')}</td></tr>`).join('');
    const offRows = a.responsibilities.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${esc(r.officerName)}</td><td>${r.assigned}</td><td>${r.completed}</td><td>${r.delayed}</td><td>${r.overdue}</td><td>${num(r.completionRate, '%')}</td><td>${num(r.targetAchievement, '%')}</td></tr>`).join('');
    const overdueRows = a.overdue.slice(0, 25).map((r, i) => `<tr><td class="num">${i + 1}</td><td>${esc(r.title)}</td><td>${esc(r.departmentName || '—')}</td><td>${esc(r.officerName || '—')}</td><td>${fmt(r.plannedDate)}</td><td>${statusChip(r.status)}</td><td>${num(r.completionPercentage, '%')}</td><td>${r.daysOverdue}d</td><td style="font-size:8px">${esc(r.recommendedAction)}</td></tr>`).join('');
    const upcomingRows = [...a.upcoming.today, ...a.upcoming.within7, ...a.upcoming.within14].slice(0, 30).map((r, i) => {
      const bucket = r.bucket === 'today' ? '🔴 Today' : r.bucket === 'within7' ? '🟡 ≤7 days' : '🟢 ≤14 days';
      return `<tr><td class="num">${i + 1}</td><td>${esc(r.title)}</td><td>${esc(r.departmentName || '—')}</td><td>${esc(r.officerName || '—')}</td><td>${fmt(r.plannedDate)}</td><td>${statusChip(r.status)}</td><td>${chip(r.bucket.toUpperCase(), '#0e7490', '#cffafe')}</td></tr>`;
    }).join('');
    const goalRows = a.goals.map((g, i) => `<tr><td class="num">${i + 1}</td><td><strong>${esc(g.title)}</strong>${g.description ? `<span style="display:block;color:#64748b;margin-top:1px">${esc(g.description)}</span>` : ''}</td><td>${num(g.currentProgress, '%')}</td><td>${num(g.targetPercentage, '%')}</td><td>${num(g.gap)}</td><td>${goalChip(g.status)}</td><td style="font-size:8px">${esc(g.recommendedAction)}</td></tr>`).join('');
    const trendRows = a.monthlyTrend.slice(-12).map((t, i) => `<tr><td>${esc(t.month)}</td><td>${t.planned}</td><td>${t.completed}</td><td>${num(t.planned ? (t.completed / t.planned) * 100 : 0, '%')}</td></tr>`).join('');
    const failureRows = a.failureReasons.slice(0, 10).map((r, i) => `<tr><td class="num">${i + 1}</td><td>${esc(r.reason)}</td><td>${r.count}</td></tr>`).join('');
    const actRows = a.activities.slice(0, 80).map((r: any, i) => `<tr><td class="num">${i + 1}</td><td style="font-size:8px">${esc(r.title)}</td><td>${esc(r.department?.name || '—')}</td><td>${fmt(r.startDate)}<span style="color:#94a3b8"> → </span>${fmt(r.endDate)}</td><td>${statusChip(r.status)}</td><td>${num(r.completionPercentage, '%')}</td><td>${r.target ? `${num(r.target)} ${esc(r.targetUnit || '')}` : '—'}</td><td>${r.actualOutcome ? esc(r.actualOutcome) : '—'}</td><td>${r.achievement != null ? num(r.achievement, '%') : '—'}</td></tr>`).join('');

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(a.school.name)} — Business Calendar Intelligence Report</title><style>
@page{size:A4 portrait;margin:18mm 16mm 20mm 16mm}
*{box-sizing:border-box}
body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0f1e2d;font-size:9.5px;margin:0;background:#eef2f6;-webkit-print-color-adjust:exact;print-color-adjust:exact;line-height:1.45}
.sheet{max-width:900px;margin:0 auto;background:#fff;padding:28px 30px;box-shadow:0 2px 18px rgba(15,30,45,.12)}
.brand-bar{display:flex;align-items:center;gap:12px;border-bottom:3px solid #123047;padding-bottom:12px;margin-bottom:18px}
.brand-bar .title{font-size:20px;font-weight:800;color:#123047;letter-spacing:.03em}
.brand-bar .sub{font-size:10px;color:#64748b;margin-top:1px}
.page-header{margin-bottom:14px}
.page-header h1{margin:0;font-size:17px;color:#123047;letter-spacing:.06em;text-transform:uppercase}
.page-header .meta{color:#64748b;font-size:9px;margin-top:3px}
h2{${sectionHeaderStyle}}
table{width:100%;border-collapse:collapse;font-size:8.5px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
thead th{background:linear-gradient(180deg,#123047,#0d2637);color:#fff;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.08em;padding:6px 7px;white-space:nowrap}
tbody td{border-top:1px solid #f1f5f9;padding:5px 7px;vertical-align:top}
tbody tr:nth-child(even){background:#f8fafc}
tbody tr:hover{background:#f0fdfa}
td.num{text-align:center;font-weight:800;color:#94a3b8;width:26px;font-size:8px}
.table-foot{margin-top:3px;text-align:right;font-size:8px;color:#94a3b8}
.footer{border-top:2px solid #e2e8f0;margin-top:16px;padding-top:10px;font-size:8px;color:#94a3b8;display:flex;justify-content:space-between}
.insight-box{background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:8px 12px;margin:8px 0;font-size:9px;line-height:1.5}
.recommendation-box{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin:8px 0;font-size:9px;line-height:1.5}
.page-break{page-break-before:always}
.no-break{page-break-inside:avoid}
.page-header-print{display:none}
@media print{
  body{background:#fff}
  .sheet{box-shadow:none;padding:0}
  .page-header-print{display:block}
}
@media print{.sheet{box-shadow:none;padding:0}}
@page{size:${a.school.motto?.includes('landscape') ? 'landscape' : 'portrait'};margin:18mm 16mm 20mm 16mm}
</style></head><body><div class="sheet">

<div class="brand-bar">
  ${logoTag}
  <div>
    <div class="title">${esc(a.school.name)}</div>
    <div class="sub">School Business Calendar · Intelligence Report</div>
  </div>
</div>

<div class="page-header">
  <h1>Business Calendar Intelligence Report</h1>
  <div class="meta">
    Calendar: ${esc(a.calendar?.name || 'All')} &nbsp;|&nbsp;
    Academic Year: ${esc(a.calendar?.academicYear || '—')} &nbsp;|&nbsp;
    Term: ${esc(a.calendar?.term || '—')} &nbsp;|&nbsp;
    Report Period: ${esc(a.reportPeriod)} &nbsp;|&nbsp;
    Generated: ${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(a.generatedAt))} &nbsp;|&nbsp;
    Version: ${a.calendar?.version || 1}
  </div>
</div>

${a.school.motto ? `<p style="text-align:center;font-style:italic;color:#0e7490;font-size:10px;margin:0 0 16px">"${esc(a.school.motto)}"</p>` : ''}

<h2>1. Executive Summary</h2>
<div class="no-break">
  <p style="font-size:10px;margin:0 0 10px;line-height:1.6">
    ${a.aiInsights.map((ins) => `&bull; ${esc(ins)}`).join('<br>')}
  </p>
</div>

<h2>2. Key Metrics</h2>
${metricsTable([
  { label: 'Total Activities', value: a.metrics.total },
  { label: 'Completed', value: a.metrics.completed },
  { label: 'In Progress', value: a.metrics.inProgress },
  { label: 'Delayed', value: a.metrics.delayed },
  { label: 'Completion Rate', value: `${num(a.metrics.completionRate, '%')}`, highlight: a.metrics.completionRate >= 80 },
  { label: 'On-Time Rate', value: `${num(a.metrics.onTimeCompletionRate, '%')}` },
  { label: 'Target Achievement', value: `${num(a.metrics.targetAchievementRate, '%')}` },
  { label: 'Weighted Score', value: `${num(a.metrics.weightedCompletionScore, '%')}` },
])}

${metricsTable([
  { label: 'Overdue', value: a.metrics.overdue, highlight: a.metrics.overdue === 0 },
  { label: 'Due Today', value: a.metrics.dueToday },
  { label: 'Due ≤7 days', value: a.metrics.dueSoon7 },
  { label: 'Due ≤14 days', value: a.metrics.dueSoon14 },
  { label: 'Partial Rate', value: `${num(a.metrics.partialCompletionRate, '%')}` },
  { label: 'Failure Rate', value: `${num(a.metrics.failureRate, '%')}`, highlight: a.metrics.failureRate <= 5 },
  { label: 'Avg Completion %', value: `${num(a.metrics.averageCompletionPercentage, '%')}` },
  { label: 'Postponed', value: a.metrics.postponed },
])}

<h2>3. Status Distribution</h2>
<table>
<thead><tr><th>Status</th><th>Count</th><th>% of Total</th></tr></thead>
<tbody>
${Object.entries(a.statusBreakdown).filter(([_, count]) => (count as number) > 0).map(([status, count]) => `<tr><td>${statusChip(status)}</td><td>${count}</td><td>${num((count as number) / a.metrics.total * 100, '%')}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">No activities recorded</td></tr>'}
</tbody>
</table>

<div class="page-break"></div>

<h2>4. Department Analysis</h2>
<table>
<thead><tr><th>#</th><th>Department</th><th>Planned</th><th>Completed</th><th>Rate</th><th>Delayed</th><th>Not Done</th><th>Target Achiev.</th><th>Overdue</th></tr></thead>
<tbody>${deptRows || '<tr><td colspan="9" style="text-align:center;color:#94a3b8">No departmental data</td></tr>'}</tbody>
</table>
${a.departments.length > 0 ? `<div class="table-foot">${a.departments.length} department${a.departments.length > 1 ? 's' : ''} &nbsp;|&nbsp; Best: ${esc(a.departments[a.departments.length - 1]?.departmentName || '—')} (${num(a.departments[a.departments.length - 1]?.completionRate, '%')}) &nbsp;|&nbsp; Weakest: ${esc(a.departments[0]?.departmentName || '—')} (${num(a.departments[0]?.completionRate, '%')})</div>` : ''}

<h2>5. Category Analysis</h2>
<table>
<thead><tr><th>#</th><th>Category</th><th>Planned</th><th>Completed</th><th>Rate</th><th>Delayed</th><th>Target Achiev.</th></tr></thead>
<tbody>${catRows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8">No category data</td></tr>'}</tbody>
</table>

<div class="page-break"></div>

<h2>6. Responsibility Tracking</h2>
<table>
<thead><tr><th>#</th><th>Officer</th><th>Assigned</th><th>Completed</th><th>Delayed</th><th>Overdue</th><th>Rate</th><th>Target Achiev.</th></tr></thead>
<tbody>${offRows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8">No responsibility data</td></tr>'}</tbody>
</table>

<h2>7. Term Goals</h2>
${a.goals.length > 0 ? `
<table>
<thead><tr><th>#</th><th>Goal</th><th>Progress</th><th>Target</th><th>Gap</th><th>Status</th><th>Action</th></tr></thead>
<tbody>${goalRows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8">No goals set</td></tr>'}</tbody>
</table>` : '<div class="insight-box">No term goals have been configured for this calendar period. Goals help leadership track strategic progress and provide early warning when targets are slipping.</div>'}

<div class="page-break"></div>

<h2>8. Overdue Intelligence</h2>
${a.overdue.length > 0 ? `
<table>
<thead><tr><th>#</th><th>Activity</th><th>Dept</th><th>Officer</th><th>Due</th><th>Status</th><th>%</th><th>Days Late</th><th>Recommended Action</th></tr></thead>
<tbody>${overdueRows}</tbody>
</table>
${a.overdue.length > 25 ? `<div class="table-foot">Showing top 25 of ${a.overdue.length} overdue activities</div>` : ''}` : '<div class="insight-box">No overdue activities detected. All current activities are on track or completed.</div>'}

<h2>9. Upcoming Intelligence</h2>
${[...a.upcoming.today, ...a.upcoming.within7, ...a.upcoming.within14].length > 0 ? `
<table>
<thead><tr><th>#</th><th>Activity</th><th>Dept</th><th>Officer</th><th>Date</th><th>Status</th><th>Bucket</th></tr></thead>
<tbody>${upcomingRows}</tbody>
</table>` : '<div class="insight-box">No upcoming activities within the next 14 days.</div>'}

${a.upcoming.later.length > 0 ? `<div class="insight-box">Additionally, ${a.upcoming.later.length} activit${a.upcoming.later.length > 1 ? 'ies are' : 'y is'} scheduled more than 14 days ahead.</div>` : ''}

<div class="page-break"></div>

<h2>10. Failure Analysis</h2>
${a.failureReasons.length > 0 ? `
<table>
<thead><tr><th>#</th><th>Reason</th><th>Count</th></tr></thead>
<tbody>${failureRows}</tbody>
</table>` : '<div class="insight-box">No failure reasons recorded for this period.</div>'}

<h2>11. Monthly Trend</h2>
<table>
<thead><tr><th>Month</th><th>Planned</th><th>Completed</th><th>Completion %</th></tr></thead>
<tbody>${trendRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No trend data</td></tr>'}</tbody>
</table>

<div class="page-break"></div>

<h2>12. AI Insights & Recommendations</h2>
<div class="no-break">
${a.aiInsights.length > 0 ? `<p style="font-size:9.5px;font-weight:700;color:#123047;margin:0 0 4px">Observations:</p>${a.aiInsights.map((ins) => `<div class="insight-box">${esc(ins)}</div>`).join('')}` : ''}
${a.aiRecommendations.length > 0 ? `<p style="font-size:9.5px;font-weight:700;color:#123047;margin:10px 0 4px">Recommendations:</p>${a.aiRecommendations.map((rec) => `<div class="recommendation-box">${esc(rec)}</div>`).join('')}` : ''}
${a.aiInsights.length === 0 && a.aiRecommendations.length === 0 ? '<div class="insight-box">No automated insights available for this dataset. Insights are generated automatically from activity completion, target tracking, and failure analysis data.</div>' : ''}
</div>

<h2>13. Activity Register</h2>
<table>
<thead><tr><th>#</th><th>Title</th><th>Dept</th><th>Dates</th><th>Status</th><th>%</th><th>Target</th><th>Outcome</th><th>Achiev.</th></tr></thead>
<tbody>${actRows || '<tr><td colspan="9" style="text-align:center;color:#94a3b8">No activities recorded</td></tr>'}</tbody>
</table>
${a.activities.length > 80 ? `<div class="table-foot">Showing 80 of ${a.activities.length} activities. Download the Excel report for the complete register.</div>` : ''}

<div class="footer">
  <span>${esc(a.school.name)} ${a.school.address ? `· ${esc(a.school.address)}` : ''}</span>
  <span>Generated by Smart Tech SaaS &nbsp;|&nbsp; Report period: ${esc(a.reportPeriod)}</span>
</div>

</div></body></html>`;
  }

  async pdf(calendarId: string, schoolId: string) {
    const html = await this.html(calendarId, schoolId);
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      return Buffer.from(await page.pdf({
        format: 'A4',
        landscape: false,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:7px;width:100%;padding:4px 16mm 0;color:#94a3b8;display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0"><span>School Business Calendar · Intelligence Report</span><span class="date"></span></div>`,
        footerTemplate: `<div style="font-size:7px;width:100%;padding:0 16mm 4px;color:#94a3b8;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0"><span>Confidential — for school leadership use only</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
      }));
    } finally {
      await browser.close();
    }
  }
}