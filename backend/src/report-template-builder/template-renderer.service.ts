import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DigitalStampService } from './digital-stamp.service';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

@Injectable()
export class TemplateRendererService {
  constructor(
    private prisma: PrismaService,
    private digitalStampService: DigitalStampService,
  ) {}

  async getSchool(schoolId: string) {
    return this.prisma.school.findUnique({ where: { id: schoolId } });
  }

  async renderPdfFromHtml(schoolId: string, templateId: string, html: string): Promise<Buffer> {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, schoolId },
    });
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setContent(html, { waitUntil: 'networkidle0' as any });
    const pdf = await page.pdf({
      format: (template?.pageSize || 'A4') as any,
      landscape: (template?.orientation || 'portrait') === 'landscape',
      printBackground: true,
    });
    await browser.close();
    return Buffer.from(pdf);
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

  private registerHelpers() {
    handlebars.registerHelper('ifCond', function (v1: any, operator: string, v2: any, options: any) {
      switch (operator) {
        case '===': return v1 === v2;
        case '!==': return v1 !== v2;
        case '<': return v1 < v2;
        case '<=': return v1 <= v2;
        case '>': return v1 > v2;
        case '>=': return v1 >= v2;
        case '&&': return v1 && v2;
        case '||': return v1 || v2;
        default: return false;
      }
    });

    handlebars.registerHelper('json', function (context: any) {
      return JSON.stringify(context);
    });

    handlebars.registerHelper('eq', function (a: any, b: any) {
      return a === b;
    });

    handlebars.registerHelper('range', function (n: number, block: any) {
      let accum = '';
      for (let i = 0; i < n; i++) {
        accum += block.fn(i);
      }
      return accum;
    });

    handlebars.registerHelper('add', function (a: number, b: number) {
      return a + b;
    });

    handlebars.registerHelper('subtract', function (a: number, b: number) {
      return a - b;
    });

    handlebars.registerHelper('multiply', function (a: number, b: number) {
      return a * b;
    });

    handlebars.registerHelper('divide', function (a: number, b: number) {
      return b !== 0 ? a / b : 0;
    });

    handlebars.registerHelper('percent', function (a: number, b: number) {
      return b !== 0 ? ((a / b) * 100).toFixed(1) : '0';
    });

    handlebars.registerHelper('round', function (value: number, decimals: number) {
      return Number(value).toFixed(decimals || 0);
    });

    handlebars.registerHelper('dateFormat', function (date: string, format: string) {
      if (!date) return '';
      const d = new Date(date);
      if (format === 'short') return d.toLocaleDateString();
      if (format === 'long') return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      return d.toLocaleDateString();
    });

    handlebars.registerHelper('uppercase', function (str: string) {
      return (str || '').toUpperCase();
    });

    handlebars.registerHelper('lowercase', function (str: string) {
      return (str || '').toLowerCase();
    });

    handlebars.registerHelper('capitalize', function (str: string) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
  }

  private generateSvgBarChart(data: { labels: string[]; values: number[]; title?: string; color?: string; height?: number; width?: number }): string {
    const h = data.height || 200;
    const w = data.width || 400;
    const color = data.color || '#1976d2';
    const maxVal = Math.max(...data.values, 1);
    const barWidth = Math.max(20, (w - 60) / data.labels.length - 8);
    const bars = data.labels.map((label, i) => {
      const barH = (data.values[i] / maxVal) * (h - 40);
      const x = 40 + i * (barWidth + 8);
      const y = h - 20 - barH;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="2"/>
        <text x="${x + barWidth / 2}" y="${h - 5}" text-anchor="middle" font-size="9" fill="#666">${label}</text>
        <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-size="8" fill="#333">${data.values[i]}</text>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="white"/>
      ${data.title ? `<text x="${w / 2}" y="14" text-anchor="middle" font-size="11" font-weight="bold" fill="#333">${data.title}</text>` : ''}
      ${bars}</svg>`;
  }

  private generateSvgRadarChart(data: { labels: string[]; values: number[]; title?: string; color?: string; size?: number }): string {
    const size = data.size || 200;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.35;
    const color = data.color || '#1976d2';
    const numAxes = data.labels.length;
    const angleStep = (2 * Math.PI) / numAxes;

    const axes = data.labels.map((label, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const labelX = cx + (radius + 20) * Math.cos(angle);
      const labelY = cy + (radius + 20) * Math.sin(angle);
      return { x, y, label, labelX, labelY, angle };
    });

    const gridCircles = [0.25, 0.5, 0.75, 1].map(ratio =>
      `<circle cx="${cx}" cy="${cy}" r="${radius * ratio}" fill="none" stroke="#eee" stroke-width="1"/>`
    ).join('');

    const gridLines = axes.map(a =>
      `<line x1="${cx}" y1="${cy}" x2="${a.x}" y2="${a.y}" stroke="#eee" stroke-width="1"/>`
    ).join('');

    const maxVal = Math.max(...data.values, 1);
    const points = data.values.map((val, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const r = (val / maxVal) * radius;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');

    const labels = axes.map(a =>
      `<text x="${a.labelX}" y="${a.labelY}" text-anchor="middle" font-size="8" fill="#555" dominant-baseline="middle">${a.label}</text>`
    ).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="white"/>
      ${data.title ? `<text x="${cx}" y="12" text-anchor="middle" font-size="11" font-weight="bold" fill="#333">${data.title}</text>` : ''}
      ${gridCircles}${gridLines}
      <polygon points="${points}" fill="${color}33" stroke="${color}" stroke-width="2"/>
      ${labels}</svg>`;
  }

  private generateSvgLineChart(data: { labels: string[]; values: number[]; title?: string; color?: string; height?: number; width?: number }): string {
    const h = data.height || 200;
    const w = data.width || 400;
    const color = data.color || '#1976d2';
    const maxVal = Math.max(...data.values, 1);
    const padding = { top: 25, right: 15, bottom: 25, left: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const points = data.values.map((val, i) => {
      const x = padding.left + (i / (data.labels.length - 1 || 1)) * plotW;
      const y = padding.top + plotH - (val / maxVal) * plotH;
      return `${x},${y}`;
    }).join(' ');

    const dots = data.values.map((val, i) => {
      const x = padding.left + (i / (data.labels.length - 1 || 1)) * plotW;
      const y = padding.top + plotH - (val / maxVal) * plotH;
      return `<circle cx="${x}" cy="${y}" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>`;
    }).join('');

    const labels = data.labels.map((label, i) => {
      const x = padding.left + (i / (data.labels.length - 1 || 1)) * plotW;
      return `<text x="${x}" y="${h - 5}" text-anchor="middle" font-size="8" fill="#666">${label}</text>`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="white"/>
      ${data.title ? `<text x="${w / 2}" y="12" text-anchor="middle" font-size="11" font-weight="bold" fill="#333">${data.title}</text>` : ''}
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
      ${dots}${labels}</svg>`;
  }

  private generateSvgHeatmap(data: { matrix: number[][]; rowLabels: string[]; colLabels: string[]; title?: string; width?: number; height?: number }): string {
    const rows = data.matrix.length;
    const cols = data.matrix[0]?.length || 0;
    const cellW = Math.max(20, ((data.width || 400) - 80) / cols);
    const cellH = Math.max(16, ((data.height || 300) - 40) / rows);

    const getColor = (val: number) => {
      if (val >= 80) return '#22c55e';
      if (val >= 60) return '#3b82f6';
      if (val >= 40) return '#eab308';
      if (val >= 20) return '#f97316';
      return '#ef4444';
    };

    let cells = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 70 + c * cellW;
        const y = 25 + r * cellH;
        const val = data.matrix[r][c];
        const color = getColor(val);
        cells += `<rect x="${x}" y="${y}" width="${cellW - 1}" height="${cellH - 1}" fill="${color}" rx="1"/>
          <text x="${x + cellW / 2}" y="${y + cellH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="white">${val}</text>`;
      }
    }

    const rowLabels = data.rowLabels.map((label, i) =>
      `<text x="65" y="${25 + i * cellH + cellH / 2}" text-anchor="end" dominant-baseline="middle" font-size="7" fill="#333">${label}</text>`
    ).join('');

    const colLabels = data.colLabels.map((label, i) =>
      `<text x="${70 + i * cellW + cellW / 2}" y="18" text-anchor="middle" font-size="7" fill="#333">${label}</text>`
    ).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${data.width || 400}" height="${data.height || 300}" viewBox="0 0 ${data.width || 400} ${data.height || 300}">
      <rect width="${data.width || 400}" height="${data.height || 300}" fill="white"/>
      ${data.title ? `<text x="${(data.width || 400) / 2}" y="10" text-anchor="middle" font-size="10" font-weight="bold" fill="#333">${data.title}</text>` : ''}
      ${rowLabels}${colLabels}${cells}</svg>`;
  }

  private generateSvgDistributionCurve(data: { values: number[]; title?: string; color?: string; height?: number; width?: number }): string {
    const h = data.height || 200;
    const w = data.width || 400;
    const color = data.color || '#1976d2';
    const maxVal = Math.max(...data.values, 1);
    const padding = { top: 25, right: 15, bottom: 25, left: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const points = data.values.map((val, i) => {
      const x = padding.left + (i / (data.values.length - 1 || 1)) * plotW;
      const y = padding.top + plotH - (val / maxVal) * plotH;
      return `${x},${y}`;
    }).join(' ');

    const areaPoints = `${padding.left},${padding.top + plotH} ${points} ${padding.left + plotW},${padding.top + plotH}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="white"/>
      ${data.title ? `<text x="${w / 2}" y="12" text-anchor="middle" font-size="11" font-weight="bold" fill="#333">${data.title}</text>` : ''}
      <polygon points="${areaPoints}" fill="${color}22" stroke="none"/>
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
      </svg>`;
  }

  generateChartSvg(type: string, data: any): string {
    switch (type) {
      case 'bar': return this.generateSvgBarChart(data);
      case 'radar': return this.generateSvgRadarChart(data);
      case 'line': return this.generateSvgLineChart(data);
      case 'heatmap': return this.generateSvgHeatmap(data);
      case 'distribution': return this.generateSvgDistributionCurve(data);
      default: return this.generateSvgBarChart(data);
    }
  }

  renderComponentsToHtml(components: any[], data: any, school?: any): string {
    return components.map((c: any) => this.renderComponent(c, data, school)).join('\n');
  }

  private renderComponent(component: any, data: any, school?: any): string {
    const styles = component.styles || {};
    const content = component.content || {};
    const pos = component.position || {};
    const size = component.size || {};
    const styleStr = this.styleObjectToString({ ...styles, ...pos, ...size });
    const placeholder = component.placeholder;

    switch (component.type) {
      case 'TEXT_BLOCK':
      case 'CUSTOM_TEXT':
        return `<div style="${styleStr}">${this.resolvePlaceholders(content.text || '', data)}</div>`;

      case 'HEADING':
        const level = content.level || 2;
        return `<h${level} style="${styleStr}">${this.resolvePlaceholders(content.text || '', data)}</h${level}>`;

      case 'PARAGRAPH':
        return `<p style="${styleStr}">${this.resolvePlaceholders(content.text || '', data)}</p>`;

      case 'DIVIDER':
        return `<hr style="${styleStr}border:none;border-top:1px solid #ddd;" />`;

      case 'SPACER':
        return `<div style="${styleStr};height:${content.height || 20}px"></div>`;

      case 'SCHOOL_LOGO':
        const logoUrl = school?.logoUrl || school?.logo;
        if (!logoUrl) return '';
        return `<img src="${logoUrl}" alt="School Logo" style="${styleStr}" />`;

      case 'SCHOOL_NAME':
        return `<div style="${styleStr}">${school?.name || ''}</div>`;

      case 'SCHOOL_INFO':
        return `<div style="${styleStr}">
          ${school?.name || ''}<br/>
          ${school?.address || ''}<br/>
          ${school?.email || ''}<br/>
          ${school?.phone || ''}
        </div>`;

      case 'STUDENT_NAME':
        return `<div style="${styleStr}">${data?.student?.firstName || ''} ${data?.student?.lastName || ''}</div>`;

      case 'STUDENT_PHOTO':
        if (!data?.student?.photoUrl) return '';
        return `<img src="${data.student.photoUrl}" alt="Student Photo" style="${styleStr}" />`;

      case 'STUDENT_INFO':
        return `<div style="${styleStr};font-size:11px;">
          <strong>Name:</strong> ${data?.student?.firstName || ''} ${data?.student?.lastName || ''}<br/>
          <strong>Admission No:</strong> ${data?.student?.admissionNumber || ''}<br/>
          <strong>DOB:</strong> ${data?.student?.dateOfBirth ? new Date(data.student.dateOfBirth).toLocaleDateString() : ''}
        </div>`;

      case 'STUDENT_PROFILE_CARD':
        return this.renderStudentProfileCard(component, data, school);

      case 'CLASS_NAME':
        return `<div style="${styleStr}">${data?.class?.name || ''}</div>`;

      case 'TERM_INFO':
        return `<div style="${styleStr}">${data?.term?.name || ''} - ${data?.term?.academicYear || ''}</div>`;

      case 'RESULTS_TABLE':
        return this.renderResultsTable(component, data, styleStr);

      case 'GRADE_TABLE':
        return this.renderGradeTable(component, data, styleStr);

      case 'SUBJECT_TABLE':
        return this.renderSubjectTable(component, data, styleStr);

      case 'ATTENDANCE_TABLE':
        return this.renderAttendanceTable(component, data, styleStr);

      case 'RANKING_TABLE':
        return this.renderRankingTable(component, data, styleStr);

      case 'PERFORMANCE_CHART':
        if (!data?.charts?.bar) return '';
        return this.generateSvgBarChart(data.charts.bar);

      case 'RADAR_CHART':
        if (!data?.charts?.radar) return '';
        return this.generateSvgRadarChart(data.charts.radar);

      case 'LINE_CHART':
        if (!data?.charts?.line) return '';
        return this.generateSvgLineChart(data.charts.line);

      case 'HEATMAP':
        if (!data?.charts?.heatmap) return '';
        return this.generateSvgHeatmap(data.charts.heatmap);

      case 'DISTRIBUTION_CURVE':
        if (!data?.charts?.distribution) return '';
        return this.generateSvgDistributionCurve(data.charts.distribution);

      case 'COMPETENCY_HEATMAP':
        if (!data?.charts?.competency) return '';
        return this.generateSvgHeatmap(data.charts.competency);

      case 'ATTENDANCE_CHART':
        if (!data?.charts?.attendance) return '';
        return this.generateSvgBarChart(data.charts.attendance);

      case 'ANALYTICS_SUMMARY':
        return this.renderAnalyticsSummary(component, data, styleStr);

      case 'TEACHER_REMARKS':
        return `<div style="${styleStr}">
          <strong>Teacher's Remarks:</strong><br/>
          ${data?.teacherComment || ''}
        </div>`;

      case 'AI_NARRATIVE':
        return `<div style="${styleStr};background:#f0f9ff;padding:10px;border-radius:4px;border-left:3px solid #3b82f6;">
          <strong>AI Analysis:</strong><br/>
          ${data?.aiNarrative || ''}
        </div>`;

      case 'RECOMMENDATIONS':
        return this.renderRecommendations(component, data, styleStr);

      case 'STRENGTHS_WEAKNESSES':
        return this.renderStrengthsWeaknesses(component, data, styleStr);

      case 'SIGNATURE':
        const sigUrl = content.signatureUrl || data?.signatureUrl;
        return sigUrl
          ? `<img src="${sigUrl}" alt="Signature" style="${styleStr}" />`
          : `<div style="${styleStr};border-top:1px solid #000;width:150px;margin-top:20px;"></div>`;

      case 'STAMP':
        const stampUrl = content.stampUrl || data?.stampUrl;
        return stampUrl
          ? `<img src="${stampUrl}" alt="Stamp" style="${styleStr}" />`
          : '';

      case 'QR_CODE':
        const qrData = content.qrData || data?.student?.id || '';
        return `<div style="${styleStr};text-align:center;">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <rect width="80" height="80" fill="white"/>
            <rect x="10" y="10" width="10" height="10" fill="black"/>
            <rect x="10" y="30" width="10" height="10" fill="black"/>
            <rect x="10" y="50" width="10" height="10" fill="black"/>
            <rect x="30" y="10" width="10" height="10" fill="black"/>
            <rect x="50" y="10" width="10" height="10" fill="black"/>
            <rect x="50" y="30" width="10" height="10" fill="black"/>
            <rect x="50" y="50" width="10" height="10" fill="black"/>
            <rect x="30" y="50" width="10" height="10" fill="black"/>
          </svg>
          <div style="font-size:7px;margin-top:2px;">${qrData.substring(0, 20)}</div>
        </div>`;

      case 'BADGE':
        return this.renderBadge(component, data, styleStr);

      case 'AWARD_TEXT':
        return `<div style="${styleStr};font-size:${content.fontSize || 16}px;font-weight:${content.bold ? 'bold' : 'normal'};font-style:${content.italic ? 'italic' : 'normal'};">
          ${this.resolvePlaceholders(content.text || 'This certificate is awarded to', data)}
        </div>`;

      case 'SEAL':
        return `<div style="${styleStr};text-align:center;">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="28" fill="none" stroke="#1a365d" stroke-width="2"/>
            <circle cx="30" cy="30" r="24" fill="none" stroke="#1a365d" stroke-width="1"/>
            <text x="30" y="30" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="bold" fill="#1a365d">SEAL</text>
          </svg>
        </div>`;

      case 'HEADER':
        return `<div style="${styleStr};border-bottom:2px solid ${content.color || '#1976d2'};padding-bottom:5px;margin-bottom:10px;">
          ${this.resolvePlaceholders(content.text || '', data)}
        </div>`;

      case 'FOOTER':
        const pageNum = data?.pageNumber || '';
        return `<div style="${styleStr};border-top:1px solid #ddd;padding-top:5px;margin-top:10px;font-size:9px;color:#999;">
          ${this.resolvePlaceholders(content.text || '', data)} ${pageNum ? `| Page ${pageNum}` : ''}
        </div>`;

      case 'PAGE_NUMBER':
        return `<span style="${styleStr}">${data?.pageNumber || ''}</span>`;

      case 'WATERMARK':
        return `<div style="${styleStr};position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)rotate(-30deg);font-size:${content.fontSize || 60}px;color:${content.color || '#ddd'};opacity:0.15;pointer-events:none;white-space:nowrap;">
          ${this.resolvePlaceholders(content.text || 'SAMPLE', data)}
        </div>`;

      case 'TABLE':
        return this.renderGenericTable(component, data, styleStr);

      case 'DYNAMIC_PLACEHOLDER':
        return `<span style="${styleStr}">${this.resolvePlaceholders(placeholder || '{{' + content.field + '}}', data)}</span>`;

      case 'IMAGE':
        const imgUrl = content.url || '';
        return imgUrl ? `<img src="${imgUrl}" alt="${content.alt || ''}" style="${styleStr}" />` : '';

      default:
        return `<!-- Unknown component type: ${component.type} -->`;
    }
  }

  private renderStudentProfileCard(component: any, data: any, school?: any): string {
    const s = data?.student || {};
    return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:15px;background:white;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:80px;vertical-align:top;">
            ${s.photoUrl ? `<img src="${s.photoUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;" />` : `<div style="width:70px;height:70px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;color:#999;font-size:24px;">👤</div>`}
          </td>
          <td style="padding-left:15px;vertical-align:top;">
            <div style="font-size:16px;font-weight:bold;">${s.firstName || ''} ${s.lastName || ''}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">Admission: ${s.admissionNumber || ''}</div>
            <div style="font-size:12px;color:#666;">Class: ${data?.class?.name || ''}</div>
            <div style="font-size:12px;color:#666;">Term: ${data?.term?.name || ''} - ${data?.term?.academicYear || ''}</div>
          </td>
        </tr>
      </table>
    </div>`;
  }

  private renderResultsTable(component: any, data: any, styleStr: string): string {
    const subjects = data?.subjects || [];
    if (!subjects.length) return '<div>No results</div>';

    const showRemarks = component.settings?.showRemarks !== false;
    const showPoints = component.settings?.showPoints !== false;
    const showGrade = component.settings?.showGrade !== false;
    const headerBg = component.styles?.headerBg || '#1a365d';
    const headerColor = component.styles?.headerColor || '#ffffff';
    const altRowBg = component.styles?.altRowBg || '#f8fafc';

    const rows = subjects.map((s: any, i: number) =>
      `<tr style="background:${i % 2 === 0 ? 'white' : altRowBg};">
        <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;">${s.subject || ''}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-size:10px;font-weight:bold;">${s.score ?? ''}</td>
        ${showGrade ? `<td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-size:10px;">${s.grade || ''}</td>` : ''}
        ${showPoints ? `<td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-size:10px;">${s.points ?? ''}</td>` : ''}
        ${showRemarks ? `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:9px;color:#666;">${s.remark || ''}</td>` : ''}
      </tr>`
    ).join('');

    return `<table style="width:100%;border-collapse:collapse;${styleStr}">
      <thead>
        <tr style="background:${headerBg};color:${headerColor};">
          <th style="padding:7px 8px;border:1px solid ${headerBg};text-align:left;font-size:10px;">Subject</th>
          <th style="padding:7px 8px;border:1px solid ${headerBg};text-align:center;font-size:10px;">Score</th>
          ${showGrade ? `<th style="padding:7px 8px;border:1px solid ${headerBg};text-align:center;font-size:10px;">Grade</th>` : ''}
          ${showPoints ? `<th style="padding:7px 8px;border:1px solid ${headerBg};text-align:center;font-size:10px;">Points</th>` : ''}
          ${showRemarks ? `<th style="padding:7px 8px;border:1px solid ${headerBg};text-align:left;font-size:10px;">Remarks</th>` : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private renderGradeTable(component: any, data: any, styleStr: string): string {
    const gradeScales = data?.gradeScales || [];
    if (!gradeScales.length) return '';

    const rows = gradeScales.map((g: any) =>
      `<tr>
        <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;font-weight:bold;">${g.grade || ''}</td>
        <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">${g.minScore || 0}-${g.maxScore || 100}</td>
        <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;">${g.remark || ''}</td>
        <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">${g.points || 0}</td>
      </tr>`
    ).join('');

    return `<table style="width:100%;border-collapse:collapse;font-size:10px;${styleStr}">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:5px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">Grade</th>
          <th style="padding:5px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">Range</th>
          <th style="padding:5px 6px;border:1px solid #e5e7eb;text-align:left;font-size:9px;">Remark</th>
          <th style="padding:5px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">Points</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private renderSubjectTable(component: any, data: any, styleStr: string): string {
    const subjects = data?.subjects || [];
    if (!subjects.length) return '';

    const rows = subjects.map((s: any) =>
      `<tr>
        <td style="padding:5px 8px;border:1px solid #e5e7eb;font-size:10px;">${s.subject || s.name || ''}</td>
        <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center;font-size:10px;">${s.score ?? ''}</td>
        <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center;font-size:10px;">${s.grade || ''}</td>
      </tr>`
    ).join('');

    return `<table style="width:100%;border-collapse:collapse;${styleStr}">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left;font-size:10px;">Subject</th>
          <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center;font-size:10px;">Score</th>
          <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center;font-size:10px;">Grade</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private renderAttendanceTable(component: any, data: any, styleStr: string): string {
    const attendance = data?.attendance || [];
    if (!attendance.length) return '<div>No attendance data</div>';

    const rows = attendance.map((a: any) =>
      `<tr>
        <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;">${a.date ? new Date(a.date).toLocaleDateString() : ''}</td>
        <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">${a.status || ''}</td>
      </tr>`
    ).join('');

    return `<table style="width:100%;border-collapse:collapse;${styleStr}">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:left;font-size:9px;">Date</th>
          <th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private renderRankingTable(component: any, data: any, styleStr: string): string {
    const rankings = data?.rankings || [];
    if (!rankings.length) return '';

    const rows = rankings.map((r: any, i: number) =>
      `<tr style="background:${i === 0 ? '#fef3c7' : i % 2 === 0 ? 'white' : '#f8fafc'};">
        <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;font-weight:bold;">${i + 1}</td>
        <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;">${r.studentName || r.name || ''}</td>
        <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">${r.totalPoints || r.points || ''}</td>
        <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">${r.average ? r.average.toFixed(1) : ''}</td>
      </tr>`
    ).join('');

    return `<table style="width:100%;border-collapse:collapse;${styleStr}">
      <thead>
        <tr style="background:#1a365d;color:white;">
          <th style="padding:4px 6px;border:1px solid #1a365d;text-align:center;font-size:9px;">#</th>
          <th style="padding:4px 6px;border:1px solid #1a365d;text-align:left;font-size:9px;">Student</th>
          <th style="padding:4px 6px;border:1px solid #1a365d;text-align:center;font-size:9px;">Points</th>
          <th style="padding:4px 6px;border:1px solid #1a365d;text-align:center;font-size:9px;">Avg</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private renderAnalyticsSummary(component: any, data: any, styleStr: string): string {
    const s = data?.summary || {};
    return `<div style="${styleStr};display:flex;flex-wrap:wrap;gap:8px;">
      <div style="flex:1;min-width:80px;background:#eff6ff;padding:8px;border-radius:4px;text-align:center;">
        <div style="font-size:18px;font-weight:bold;color:#2563eb;">${s.totalMarks ?? ''}</div>
        <div style="font-size:9px;color:#666;">Total Marks</div>
      </div>
      <div style="flex:1;min-width:80px;background:#f0fdf4;padding:8px;border-radius:4px;text-align:center;">
        <div style="font-size:18px;font-weight:bold;color:#16a34a;">${s.average ?? ''}</div>
        <div style="font-size:9px;color:#666;">Average</div>
      </div>
      <div style="flex:1;min-width:80px;background:#fefce8;padding:8px;border-radius:4px;text-align:center;">
        <div style="font-size:18px;font-weight:bold;color:#ca8a04;">${s.totalPoints ?? ''}</div>
        <div style="font-size:9px;color:#666;">Points</div>
      </div>
      <div style="flex:1;min-width:80px;background:#f5f3ff;padding:8px;border-radius:4px;text-align:center;">
        <div style="font-size:18px;font-weight:bold;color:#7c3aed;">${s.positionInClass ?? ''}/${s.totalStudents ?? ''}</div>
        <div style="font-size:9px;color:#666;">Position</div>
      </div>
    </div>`;
  }

  private renderRecommendations(component: any, data: any, styleStr: string): string {
    const recs = data?.recommendations || [];
    if (!Array.isArray(recs) || !recs.length) return '';

    const items = recs.map((r: string) => `<li style="font-size:10px;margin-bottom:3px;color:#555;">${r}</li>`).join('');
    return `<div style="${styleStr}"><strong>Recommendations</strong><ul style="margin:5px 0;padding-left:18px;">${items}</ul></div>`;
  }

  private renderStrengthsWeaknesses(component: any, data: any, styleStr: string): string {
    const strengths = data?.strengths || [];
    const weaknesses = data?.weaknesses || [];

    let html = `<div style="${styleStr}">`;
    if (Array.isArray(strengths) && strengths.length) {
      html += `<div style="margin-bottom:8px;"><strong style="color:#16a34a;">Strengths</strong><ul style="margin:4px 0;padding-left:18px;">${strengths.map((s: string) => `<li style="font-size:10px;color:#555;">${s}</li>`).join('')}</ul></div>`;
    }
    if (Array.isArray(weaknesses) && weaknesses.length) {
      html += `<div><strong style="color:#dc2626;">Areas for Improvement</strong><ul style="margin:4px 0;padding-left:18px;">${weaknesses.map((w: string) => `<li style="font-size:10px;color:#555;">${w}</li>`).join('')}</ul></div>`;
    }
    html += '</div>';
    return html;
  }

  private renderBadge(component: any, data: any, styleStr: string): string {
    const style = component.settings?.badgeStyle || 'star';
    const color = component.styles?.color || '#f59e0b';

    if (style === 'star') {
      return `<svg width="30" height="30" viewBox="0 0 30 30" style="${styleStr}">
        <polygon points="15,2 18,11 28,11 20,17 23,27 15,21 7,27 10,17 2,11 12,11" fill="${color}"/>
      </svg>`;
    }
    if (style === 'circle') {
      return `<svg width="30" height="30" viewBox="0 0 30 30" style="${styleStr}">
        <circle cx="15" cy="15" r="13" fill="${color}"/>
        <text x="15" y="19" text-anchor="middle" font-size="14" fill="white" font-weight="bold">★</text>
      </svg>`;
    }
    if (style === 'shield') {
      return `<svg width="30" height="30" viewBox="0 0 30 30" style="${styleStr}">
        <path d="M15 2L5 8v7c0 7 10 13 10 13s10-6 10-13V8L15 2z" fill="${color}"/>
      </svg>`;
    }
    return `<div style="${styleStr};width:25px;height:25px;border-radius:50%;background:${color};"></div>`;
  }

  private renderGenericTable(component: any, data: any, styleStr: string): string {
    const columns = component.content?.columns || [];
    const rows = component.content?.rows || [];
    if (!columns.length || !rows.length) return '';

    const headers = columns.map((col: string) =>
      `<th style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;background:#f3f4f6;text-align:left;">${col}</th>`
    ).join('');

    const bodyRows = rows.map((row: any) => {
      const cells = columns.map((col: string) =>
        `<td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;">${row[col] || ''}</td>`
      ).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `<table style="width:100%;border-collapse:collapse;${styleStr}"><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  private resolvePlaceholders(text: string, data: any): string {
    if (!text) return '';
    const placeholderMap: Record<string, any> = {
      'student_name': `${data?.student?.firstName || ''} ${data?.student?.lastName || ''}`,
      'student_first_name': data?.student?.firstName || '',
      'student_last_name': data?.student?.lastName || '',
      'student_photo': data?.student?.photoUrl || '',
      'student_admission': data?.student?.admissionNumber || '',
      'class_name': data?.class?.name || '',
      'school_name': data?.schoolName || '',
      'school_logo': data?.schoolLogo || '',
      'attendance_percentage': data?.attendancePercentage ?? '',
      'overall_grade': data?.overallGrade || '',
      'overall_score': data?.summary?.average ?? data?.overallScore ?? '',
      'teacher_comment': data?.teacherComment || '',
      'head_comment': data?.headComment || '',
      'term': data?.term?.name || data?.termName || '',
      'term_name': data?.term?.name || '',
      'year': data?.term?.academicYear || data?.academicYear || '',
      'academic_year': data?.term?.academicYear || data?.academicYear || '',
      'total_marks': data?.summary?.totalMarks ?? '',
      'total_points': data?.summary?.totalPoints ?? '',
      'average_score': data?.summary?.average ?? '',
      'position': data?.summary?.positionInClass ?? '',
      'total_students': data?.summary?.totalStudents ?? '',
      'best_six': data?.summary?.bestSixTotal ?? '',
      'university_eligible': data?.summary?.eligibleForUniversity ?? '',
      'subject_count': data?.subjects?.length ?? '',
      'director_name': data?.directorName || '',
      'certificate_number': data?.certificateNumber || '',
      'award_text': data?.awardText || '',
      'date': new Date().toLocaleDateString(),
      'ranking': data?.summary?.positionInClass ?? '',
      'percentile': data?.percentile ?? '',
      'z_score': data?.zScore ?? '',
      'attendance_rate': data?.attendancePercentage ?? '',
    };

    return text.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string) => {
      const val = placeholderMap[key];
      if (val !== undefined && val !== null) return String(val);
      const deepKey = key.split('.');
      let obj: any = data;
      for (const k of deepKey) {
        if (obj === undefined || obj === null) return `{{${key}}}`;
        obj = obj[k];
      }
      return obj !== undefined && obj !== null ? String(obj) : `{{${key}}}`;
    });
  }

  private styleObjectToString(styles: Record<string, any>): string {
    if (!styles || typeof styles !== 'object') return '';
    const map: Record<string, string> = {
      x: 'left', y: 'top', width: 'width', height: 'height',
      color: 'color', bgColor: 'background-color', fontSize: 'font-size',
      fontWeight: 'font-weight', fontFamily: 'font-family', textAlign: 'text-align',
      padding: 'padding', margin: 'margin', borderRadius: 'border-radius',
      border: 'border', opacity: 'opacity', transform: 'transform',
    };
    return Object.entries(styles)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => {
        const cssKey = map[k] || k.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}:${v}`;
      })
      .join(';');
  }

  async renderPreview(schoolId: string, templateId: string, data?: any): Promise<string> {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, schoolId },
      include: {
        components: { orderBy: { sortOrder: 'asc' } },
        certificate: true,
      },
    });
    if (!template) throw new NotFoundException('Template not found');

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });

    this.registerHelpers();

    const defaultData = data || {
      student: { firstName: 'John', lastName: 'Doe', admissionNumber: '2024-001', photoUrl: '' },
      class: { name: 'Grade 10A' },
      term: { name: 'Term 1', academicYear: '2024' },
      subjects: [
        { subject: 'Mathematics', score: 85, grade: 'A', points: 1, remark: 'Excellent' },
        { subject: 'English', score: 72, grade: 'B', points: 3, remark: 'Good' },
        { subject: 'Science', score: 68, grade: 'C', points: 5, remark: 'Satisfactory' },
        { subject: 'Social Studies', score: 90, grade: 'A', points: 1, remark: 'Outstanding' },
      ],
      summary: { totalMarks: 315, average: 78.75, totalPoints: 10, positionInClass: 3, totalStudents: 35, bestSixTotal: 10, eligibleForUniversity: 'YES' },
      teacherComment: 'A dedicated student who shows great potential.',
      headComment: 'Keep up the good work.',
    };

    const componentsHtml = this.renderComponentsToHtml(template.components, defaultData, school);

    let stampOverlay = '';
    try {
      const templateStamps = await this.digitalStampService.getTemplateStamps(schoolId, templateId);
      if (templateStamps && templateStamps.length > 0) {
        stampOverlay = this.digitalStampService.getStampSvgOverlay(templateStamps);
      }
    } catch {
      // Stamps are optional; continue without overlay on error
    }

    const pageSize = template.pageSize || 'A4';
    const orientation = template.orientation || 'portrait';
    const isLandscape = orientation === 'landscape';
    const pageWidth = isLandscape ? '297mm' : '210mm';
    const pageHeight = isLandscape ? '210mm' : '297mm';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${template.name}</title>
  <style>
    @page { size: ${pageSize} ${orientation}; margin: ${template.marginTop || 15}mm ${template.marginRight || 15}mm ${template.marginBottom || 15}mm ${template.marginLeft || 15}mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${template.fontFamily || 'Arial'}, sans-serif; font-size: ${template.fontSize || 11}px; color: #333; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    img { max-width: 100%; }
    table { page-break-inside: avoid; }
    @media print { body { margin: 0; padding: 0; } }
  </style>
</head>
<body>
  ${template.headerText ? `<div style="text-align:center;margin-bottom:10px;font-size:10px;color:#666;border-bottom:1px solid #ddd;padding-bottom:5px;">${template.headerText}</div>` : ''}
  ${template.certificate ? this.renderCertificateHtml(template, defaultData, school) : componentsHtml}
  ${stampOverlay ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;">${stampOverlay}</div>` : ''}
  ${template.footerText ? `<div style="text-align:center;margin-top:10px;font-size:9px;color:#999;border-top:1px solid #ddd;padding-top:5px;">${template.footerText}</div>` : ''}
</body>
</html>`;
  }

  private renderCertificateHtml(template: any, data: any, school?: any): string {
    const cert = template.certificate;
    if (!cert) return '';

    const borderStyle = cert.borderStyle || 'classic';
    const borderColor = cert.borderColor || '#1a365d';
    const isLandscape = template.orientation === 'landscape';

    const borderMap: Record<string, string> = {
      classic: `10px double ${borderColor}`,
      modern: `3px solid ${borderColor}`,
      elegant: `1px solid ${borderColor};box-shadow:0 0 0 5px ${borderColor}22,0 0 0 6px ${borderColor}`,
      ornate: `4px double ${borderColor};box-shadow:inset 0 0 20px ${borderColor}11`,
      minimal: `1px solid ${borderColor}`,
      gold: `3px solid #b8860b;box-shadow:0 0 0 4px #ffd70033`,
    };

    const borderCss = borderMap[borderStyle] || borderMap.classic;

    const s = data?.student || {};
    const studentName = `${s.firstName || ''} ${s.lastName || ''}`;

    return `<div style="position:relative;width:100%;min-height:${isLandscape ? '190' : '260'}mm;padding:30px;border:${borderCss};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:white;">
      ${cert.showWatermark && cert.watermarkText ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)rotate(-30deg);font-size:80px;color:${borderColor};opacity:0.04;pointer-events:none;white-space:nowrap;font-weight:bold;">${cert.watermarkText}</div>` : ''}
      ${school?.logoUrl ? `<img src="${school.logoUrl}" style="height:60px;margin-bottom:10px;" />` : ''}
      <div style="font-size:28px;font-weight:bold;color:${borderColor};margin-bottom:5px;">${school?.name || 'School Name'}</div>
      <div style="font-size:10px;color:#666;margin-bottom:20px;text-transform:uppercase;letter-spacing:3px;">Certificate of Achievement</div>
      <hr style="width:200px;border:1px solid ${borderColor};margin:10px auto;" />
      <div style="font-size:14px;color:#555;margin:10px 0;">${cert.awardText || 'This certificate is awarded to'}</div>
      <div style="font-size:32px;font-weight:bold;color:${borderColor};margin:8px 0;font-family:'Georgia',serif;">${studentName}</div>
      <div style="font-size:13px;color:#555;margin:8px 0;">For outstanding academic performance</div>
      <div style="font-size:11px;color:#777;margin:5px 0;">Class: ${data?.class?.name || ''} | Term: ${data?.term?.name || ''} ${data?.term?.academicYear || ''}</div>
      ${cert.showBadge ? `<div style="margin:15px 0;">
        <svg width="50" height="50" viewBox="0 0 50 50"><polygon points="25,3 31,18 47,19 35,30 38,47 25,38 12,47 15,30 3,19 19,18" fill="#f59e0b"/></svg>
      </div>` : ''}
      ${cert.showQrCode ? `<div style="margin:10px 0;"><svg width="50" height="50" viewBox="0 0 50 50"><rect width="50" height="50" fill="white"/><rect x="8" y="8" width="6" height="6" fill="black"/><rect x="8" y="20" width="6" height="6" fill="black"/><rect x="8" y="32" width="6" height="6" fill="black"/><rect x="20" y="8" width="6" height="6" fill="black"/><rect x="32" y="8" width="6" height="6" fill="black"/><rect x="32" y="20" width="6" height="6" fill="black"/><rect x="32" y="32" width="6" height="6" fill="black"/><rect x="20" y="32" width="6" height="6" fill="black"/></svg></div>` : ''}
      <div style="display:flex;justify-content:space-between;width:80%;margin-top:25px;font-size:10px;">
        <div style="text-align:center;">
          <div style="border-top:1px solid #333;width:150px;margin-bottom:4px;"></div>
          ${cert.signature1Label || 'Head Teacher'}<br/>${cert.signature1Name || ''}
        </div>
        <div style="text-align:center;">
          <div style="border-top:1px solid #333;width:150px;margin-bottom:4px;"></div>
          ${cert.signature2Label || 'Director'}<br/>${cert.signature2Name || ''}
        </div>
      </div>
      <div style="font-size:9px;color:#999;margin-top:15px;">Certificate No: ${data?.certificateNumber || 'XXXXXXXX'}</div>
    </div>`;
  }

  async renderPdf(schoolId: string, templateId: string, data?: any): Promise<Buffer> {
    const html = await this.renderPreview(schoolId, templateId, data);

    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, schoolId },
    });

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    await page.setContent(html, { waitUntil: 'networkidle0' as any });

    const pdf = await page.pdf({
      format: (template?.pageSize || 'A4') as any,
      landscape: (template?.orientation || 'portrait') === 'landscape',
      printBackground: true,
      margin: {
        top: `${template?.marginTop || 15}mm`,
        bottom: `${template?.marginBottom || 15}mm`,
        left: `${template?.marginLeft || 15}mm`,
        right: `${template?.marginRight || 15}mm`,
      },
    });

    await browser.close();
    return Buffer.from(pdf);
  }
}
