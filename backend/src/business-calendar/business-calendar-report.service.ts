import { Injectable, NotFoundException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BusinessCalendarReportService {
  constructor(private readonly prisma: PrismaService) {}

  async html(calendarId: string, schoolId: string) {
    const calendar = await this.prisma.schoolBusinessCalendar.findFirst({ where: { id: calendarId, schoolId }, include: { school: true, academicYear: true, term: true, activities: { include: { category: true, department: true, officer: true, subItems: { orderBy: { sortOrder: 'asc' } } }, orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }] } } });
    if (!calendar) throw new NotFoundException('Calendar not found');
    const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
    const fmt = (value: Date | string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
    const statusChip = (status: string) => {
      const variant = ({ PLANNED: ['#1e40af', '#dbeafe'], COMPLETED: ['#047857', '#d1fae5'], RESCHEDULED: ['#a16207', '#fef3c7'], CANCELLED: ['#b91c1c', '#fee2e2'] } as Record<string, [string, string]>)[status] || ['#0e7490', '#cffafe'];
      return `<span class="chip" style="color:${variant[0]};background:${variant[1]}">${esc(status)}</span>`;
    };
     const effectiveStatus = (item: any) => item.status === 'PLANNED' && new Date(item.endDate) < new Date() ? 'COMPLETED' : item.status;
     const rows = calendar.activities.map((item: any, index) => `<tr><td class="num">${index + 1}</td><td><strong class="title">${esc(item.title)}</strong>${item.description ? `<span class="desc">${esc(item.description)}</span>` : ''}${item.subItems?.length ? `<div class="subs"><strong>Milestones:</strong><ul>${item.subItems.map((sub: any) => `<li>${esc(sub.title)}${sub.dueDate ? ` <em>(${fmt(sub.dueDate)})</em>` : ''}</li>`).join('')}</ul></div>` : ''}</td><td><span class="pcat">${esc(item.category?.name || 'Other')}</span></td><td>${fmt(item.startDate)}${item.endDate && new Date(item.endDate).getTime() !== new Date(item.startDate).getTime() ? `<span class="dash"> → </span>${fmt(item.endDate)}` : ''}</td><td>${esc(item.startTime || 'All day')}${item.endTime ? ` — ${esc(item.endTime)}` : ''}</td><td>${esc(item.venue || '—')}</td><td>${esc(item.department?.name || 'All school')}</td><td>${esc(item.officer ? `${item.officer.firstName} ${item.officer.lastName}` : '—')}</td><td>${statusChip(effectiveStatus(item))}</td></tr>`).join('');
    const firstDate = calendar.activities[0]?.startDate ? fmt(calendar.activities[0].startDate) : '—';
    const lastDate = calendar.activities[calendar.activities.length - 1]?.startDate ? fmt(calendar.activities[calendar.activities.length - 1].startDate) : '—';
    const total = calendar.activities.length;
     const planned = calendar.activities.filter((item: any) => effectiveStatus(item) === 'PLANNED').length;
     const completed = calendar.activities.filter((item: any) => effectiveStatus(item) === 'COMPLETED').length;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(calendar.name)} — School Business Calendar</title><style>
      @page{size:A4 landscape;margin:12mm 12mm 18mm 12mm}
      *{box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0f1e2d;font-size:10px;margin:0;background:#eef2f6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .sheet{max-width:1200px;margin:0 auto;background:#ffffff;padding:26px 30px;box-shadow:0 2px 18px rgba(15,30,45,.12)}
      .toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0 14px;border-bottom:1px solid #e2e8f0;margin-bottom:20px}
      .brand{display:flex;align-items:center;gap:10px}
      .brand-mark{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#123047,#0e7490);color:#fff;font-weight:900;font-size:15px;display:flex;align-items:center;justify-content:center;letter-spacing:.04em}
      .brand-name{font-weight:800;color:#123047;font-size:13px;letter-spacing:.05em}
      .brand-sub{color:#64748b;font-size:10px;margin-top:1px}
      .print-btn{background:#0e7490;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-weight:700;font-size:11px;cursor:pointer;letter-spacing:.03em;box-shadow:0 1px 3px rgba(0,0,0,.18)}
      .print-btn:hover{background:#155e75}
      header{text-align:center;border-bottom:3px solid #123047;padding-bottom:16px;margin-bottom:16px}
      .eyebrow{color:#0e7490;font-weight:800;letter-spacing:.3em;text-transform:uppercase;font-size:9px;margin:0 0 6px}
      h1{margin:0;font-size:26px;letter-spacing:.05em;color:#123047;text-transform:uppercase}
      h2{margin:6px 0 0;font-size:15px;font-weight:700;color:#334155}
      .meta{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:14px}
      .meta span{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:5px 14px;font-weight:700;font-size:10px;color:#334155}
      .meta b{color:#0e7490}
      .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
      .sum{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;text-align:center}
      .sum b{display:block;font-size:22px;color:#123047;line-height:1.2}
      .sum span{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b}
      table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border-radius:10px;border:1px solid #dbe3ea}
      thead th{background:linear-gradient(180deg,#123047,#0d2637);color:#fff;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.1em;padding:10px 9px;white-space:nowrap}
      tbody td{border-top:1px solid #e5ebf1;padding:9px;vertical-align:top;line-height:1.45}
      tbody tr:nth-child(even){background:#f7fafc}
      tbody tr:hover{background:#eaf6fb}
      td.num{text-align:center;font-weight:800;color:#94a3b8;width:30px}
      .title{font-size:11px;color:#0f1e2d}
      .desc{display:block;color:#64748b;margin-top:2px;max-width:330px}
      .pcat{display:inline-block;background:#e0f2fe;color:#0369a1;border-radius:999px;padding:2px 10px;font-weight:700;font-size:9px;white-space:nowrap}
      .chip{display:inline-block;border-radius:999px;padding:3px 11px;font-weight:800;font-size:9px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
      .dash{color:#94a3b8}
      .subs{margin-top:5px}
      .subs strong{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#0e7490}
      .subs ul{margin:3px 0 0 16px;padding:0;color:#475569}
      .subs em{color:#94a3b8;font-style:normal;font-size:9px}
      footer{margin-top:14px;display:flex;justify-content:space-between;gap:12px;color:#94a3b8;font-size:9px;border-top:1px dashed #cbd5e1;padding-top:10px}
      @media print{
        body{background:#fff}
        .sheet{box-shadow:none;padding:0}
        .toolbar{display:none}
        thead th{background:#123047 !important;-webkit-print-color-adjust:exact}
      }
    </style></head><body><div class="sheet"><div class="toolbar"><div class="brand"><div class="brand-mark">ST</div><div><div class="brand-name">SMART_TECH</div><div class="brand-sub">School Business Calendar · Printable Sheet</div></div></div><button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button></div><header><p class="eyebrow">${esc(calendar.school.name)}</p><h1>School Business Calendar</h1><h2>${esc(calendar.name)}</h2><div class="meta"><span>Academic Year: <b>${esc(calendar.academicYear.name)}</b></span><span>Term: <b>${esc(calendar.term?.name || 'All terms')}</b></span><span>Version: <b>${calendar.version}</b></span><span>Generated: <b>${new Date().toLocaleString()}</b></span></div></header><div class="summary"><div class="sum"><b>${total}</b><span>Activities</span></div><div class="sum"><b>${planned}</b><span>Planned</span></div><div class="sum"><b>${completed}</b><span>Completed</span></div><div class="sum"><b>${calendar.activities.length ? `${planned} / ${total}` : '—'}</b><span>Completion</span></div></div><table><thead><tr><th>#</th><th>Activity &amp; Milestones</th><th>Category</th><th>Date</th><th>Time</th><th>Venue</th><th>Department</th><th>Responsible Officer</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:28px">No activities recorded for this calendar yet.</td></tr>'}</tbody></table><footer><span>${esc(calendar.school.name)} · ${esc(calendar.name)}</span><span>Date scope of sheet: ${esc(firstDate)} — ${esc(lastDate)}</span></footer></div></body></html>`;
  }

  async pdf(calendarId: string, schoolId: string) {
    const html = await this.html(calendarId, schoolId);
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try { const page = await browser.newPage(); await page.setContent(html, { waitUntil: 'domcontentloaded' }); return Buffer.from(await page.pdf({ format: 'A4', landscape: true, printBackground: true, displayHeaderFooter: true, footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#64748b">SMART_TECH School Business Calendar · <span class="pageNumber"></span>/<span class="totalPages"></span></div>', margin: { top: '12mm', bottom: '16mm', left: '10mm', right: '10mm' } })); } finally { await browser.close(); }
  }
}
