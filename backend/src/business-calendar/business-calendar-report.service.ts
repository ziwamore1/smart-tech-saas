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
    const fmt = (value: Date) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
    const rows = calendar.activities.map((item: any, index) => `<tr><td>${index + 1}</td><td><strong>${esc(item.title)}</strong>${item.description ? `<small>${esc(item.description)}</small>` : ''}${item.subItems?.length ? `<ul>${item.subItems.map((sub: any) => `<li>${esc(sub.title)}${sub.dueDate ? ` (${fmt(sub.dueDate)})` : ''}</li>`).join('')}</ul>` : ''}</td><td>${esc(item.category?.name || 'Other')}</td><td>${fmt(item.startDate)}${item.endDate.getTime() !== item.startDate.getTime() ? ` - ${fmt(item.endDate)}` : ''}</td><td>${esc(item.startTime || 'All day')}${item.endTime ? ` - ${esc(item.endTime)}` : ''}</td><td>${esc(item.department?.name || '')}</td><td>${esc(item.officer ? `${item.officer.firstName} ${item.officer.lastName}` : '')}</td><td><span class="status">${esc(item.status)}</span></td></tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(calendar.name)}</title><style>@page{size:A4 landscape;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172b3a;font-size:10px}header{text-align:center;border-bottom:3px solid #123047;padding-bottom:12px;margin-bottom:14px}h1{margin:4px 0;font-size:22px;letter-spacing:.04em}h2{margin:4px 0;font-size:15px;color:#0e7490;text-transform:uppercase}p{margin:4px;color:#52606d}.meta{display:flex;justify-content:center;gap:24px;font-weight:bold;margin-top:9px}table{width:100%;border-collapse:collapse}th{background:#123047;color:#fff;text-align:left;font-size:10px;padding:8px 6px}td{border:1px solid #cbd5e1;padding:7px 6px;vertical-align:top}tr:nth-child(even){background:#f6f9fb}td:first-child{text-align:center;font-weight:bold;width:32px}small{display:block;color:#52606d;margin-top:3px}ul{margin:5px 0 0 15px;padding:0;color:#52606d}.status{font-weight:bold;text-transform:uppercase;color:#0e7490}</style></head><body><header><p>${esc(calendar.school.name)}</p><h1>SCHOOL BUSINESS CALENDAR</h1><h2>${esc(calendar.name)}</h2><div class="meta"><span>Academic Year: ${esc(calendar.academicYear.name)}</span><span>Term: ${esc(calendar.term?.name || 'All terms')}</span><span>Version: ${calendar.version}</span></div><p>Generated: ${esc(new Date().toLocaleString())}</p></header><table><thead><tr><th>#</th><th>Activity</th><th>Category</th><th>Date</th><th>Time</th><th>Department</th><th>Responsible Officer</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No activities recorded.</td></tr>'}</tbody></table></body></html>`;
  }

  async pdf(calendarId: string, schoolId: string) {
    const html = await this.html(calendarId, schoolId);
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try { const page = await browser.newPage(); await page.setContent(html, { waitUntil: 'domcontentloaded' }); return Buffer.from(await page.pdf({ format: 'A4', landscape: true, printBackground: true, displayHeaderFooter: true, footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#64748b">SMART_TECH School Business Calendar · <span class="pageNumber"></span>/<span class="totalPages"></span></div>', margin: { top: '12mm', bottom: '16mm', left: '10mm', right: '10mm' } })); } finally { await browser.close(); }
  }
}
