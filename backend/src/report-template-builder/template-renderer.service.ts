import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateRendererService } from './certificate-renderer.service';
import { DigitalStampService } from './digital-stamp.service';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
import { VerificationService } from '../stamp-engine/verification.service';
import { StampTemplateService } from '../stamp-engine/stamp-template.service';
import { StampRendererService } from '../stamp-engine/stamp-renderer.service';
import { StampAssetService } from '../stamp-engine/stamp-asset.service';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

@Injectable()
export class TemplateRendererService {
  private readonly logger = new Logger(TemplateRendererService.name);

  constructor(
    private prisma: PrismaService,
    private digitalStampService: DigitalStampService,
    private cloudinary: CloudinaryService,
    private certificateRenderer: CertificateRendererService,
    private verification: VerificationService,
    private stampTemplates: StampTemplateService,
    private stampRenderer: StampRendererService,
    private stampAssets: StampAssetService,
  ) {}

  async getSchool(schoolId: string) {
    return this.prisma.school.findUnique({ where: { id: schoolId } });
  }

  async renderPdfFromHtml(schoolId: string, templateId: string, html: string): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, schoolId },
    });
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    try {
      await page.setContent(this.enforceMinimumFontSize(html), { waitUntil: 'networkidle0' as any, timeout: 30000 });
    } catch {
      await page.setContent(this.enforceMinimumFontSize(html), { waitUntil: 'domcontentloaded' as any, timeout: 60000 });
    }
    const pdf = await page.pdf({
      format: (template?.pageSize || 'A4') as any,
      landscape: (template?.orientation || 'portrait') === 'landscape',
      printBackground: true,
    });
    await browser.close();
    const buffer = Buffer.from(pdf);
    try {
      const result = await this.cloudinary.uploadBuffer(buffer, {
        folder: `${FOLDERS.system}/render-templates`,
        publicId: `render-${templateId}-${Date.now()}`,
        resourceType: 'raw',
      });
      return { buffer, url: result.secureUrl, publicId: result.publicId };
    } catch {
      return { buffer, url: null, publicId: null };
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

  private enforceMinimumFontSize(html: string): string {
    return html
      .replace(/(font-size\s*:\s*)(\d+(?:\.\d+)?)(px)/gi, (_match, prefix, value, unit) =>
        `${prefix}${Math.max(14, Number(value))}${unit}`,
      )
      .replace(/(font-size\s*=\s*["'])(\d+(?:\.\d+)?)(["'])/gi, (_match, prefix, value, suffix) =>
        `${prefix}${Math.max(14, Number(value))}${suffix}`,
      );
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

    handlebars.registerHelper('math', (lhs: any, operator: string, rhs: any) => {
      const a = parseFloat(lhs) || 0;
      const b = parseFloat(rhs) || 0;
      if (operator === '+') return a + b;
      if (operator === '-') return a - b;
      return 0;
    });
    handlebars.registerHelper('gte', (a: any, b: any) => parseFloat(a) >= parseFloat(b));
    handlebars.registerHelper('lt', (a: any, b: any) => parseFloat(a) < parseFloat(b));
    handlebars.registerHelper('minus', (a: any, b: any) => Math.abs(parseFloat(a) - parseFloat(b)).toFixed(1));
    handlebars.registerHelper('present', (value: any) => value != null && value !== '');
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

  renderComponentsToHtml(components: any[], data: any, school?: any, pageWidthPx = 680, flowLayout = false): string {
    const inner = components.map((c: any) => this.renderComponent(c, data, school, flowLayout)).join('\n');
    if (flowLayout) {
      return `<div style="position:relative;width:100%;max-width:${pageWidthPx}px;min-height:500px;margin:0 auto;overflow:visible;">${inner}</div>`;
    }
    const bottom = components.reduce((max, c) => {
      const b = (c.position?.y || 0) + (c.size?.height || 0);
      return Math.max(max, b);
    }, 0);
    const height = Math.max(bottom + 20, 500);
    return `<div style="position:relative;width:${pageWidthPx}px;height:${height}px;margin:0 auto;">${inner}</div>`;
  }

  private renderComponent(component: any, data: any, school?: any, flowLayout = false): string {
    const styles = component.styles || {};
    const content = component.content || {};
    const pos = component.position || {};
    const size = component.size || {};
    let componentStyles: any = { ...styles, ...pos, ...size };
    let styleStr: string;
    if (flowLayout) {
      // Enhanced templates contain variable-height tables and narratives. Let
      // those sections grow naturally instead of painting over the next item.
      delete componentStyles.x;
      delete componentStyles.y;
      delete componentStyles.height;
      if (componentStyles.width !== undefined) componentStyles.width = '100%';
      styleStr = `position:relative;min-height:${size.height || 0}px;` + this.styleObjectToString(componentStyles);
    } else {
      styleStr = 'position:absolute;' + this.styleObjectToString(componentStyles);
    }
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
        return `<div style="${styleStr};border-top:${styles.borderTop || '1px solid #ddd'};"></div>`;

      case 'SPACER':
        return `<div style="${styleStr};height:${content.height || 20}px"></div>`;

      case 'SCHOOL_LOGO':
        const logoUrl = school?.logoUrl || school?.logo;
        if (!logoUrl) return '';
        // Slightly larger default footprint on report cards for better legibility,
        // keeping images proportional and never exceeding a sensible maximum.
        const logoW = Math.min(Math.max(size.width || 60, 80), 140);
        const logoH = size.height ? Math.max(size.height, logoW) : logoW;
        return `<img src="${logoUrl}" alt="School Logo" style="${styleStr};width:${logoW}px;height:auto;max-height:${logoH}px;object-fit:contain;" />`;

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
        return `<div style="${styleStr}">${data?.term?.name || ''} - ${data?.term?.academicYear || ''}${data?.examType ? ` | Exam: ${data.examType}` : ''}</div>`;

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
        return `<div style="${styleStr};overflow:hidden;">${this.generateSvgBarChart({ ...data.charts.bar, width: size.width || 250, height: size.height || 130 })}</div>`;

      case 'RADAR_CHART':
        if (!data?.charts?.radar) return '';
        return `<div style="${styleStr};overflow:hidden;">${this.generateSvgRadarChart({ ...data.charts.radar, size: Math.min(size.width || 200, size.height || 200) })}</div>`;

      case 'LINE_CHART':
        if (!data?.charts?.line) return '';
        return `<div style="${styleStr};overflow:hidden;">${this.generateSvgLineChart({ ...data.charts.line, width: size.width || 400, height: size.height || 200 })}</div>`;

      case 'HEATMAP':
        if (!data?.charts?.heatmap) return '';
        return `<div style="${styleStr};overflow:hidden;">${this.generateSvgHeatmap({ ...data.charts.heatmap, width: size.width || 400, height: size.height || 300 })}</div>`;

      case 'DISTRIBUTION_CURVE':
        if (!data?.charts?.distribution) return '';
        return `<div style="${styleStr};overflow:hidden;">${this.generateSvgDistributionCurve({ ...data.charts.distribution, width: size.width || 400, height: size.height || 200 })}</div>`;

      case 'COMPETENCY_HEATMAP':
        if (!data?.charts?.competency) return '';
        return `<div style="${styleStr};overflow:hidden;">${this.generateSvgHeatmap({ ...data.charts.competency, width: size.width || 400, height: size.height || 300 })}</div>`;

      case 'ATTENDANCE_CHART':
        if (!data?.charts?.attendance) return '';
        return `<div style="${styleStr};overflow:hidden;">${this.generateSvgBarChart({ ...data.charts.attendance, width: size.width || 250, height: size.height || 130 })}</div>`;

      case 'ANALYTICS_SUMMARY':
        return this.renderAnalyticsSummary(component, data, styleStr);

      case 'TEACHER_REMARKS':
        return `<div style="${styleStr}">
          <strong>Teacher's Remarks:</strong><br/>
          ${data?.teacherComment || ''}
        </div>`;

      case 'HEAD_TEACHER_REMARKS':
        return `<div style="${styleStr}">
          <strong>Head Teacher's Remarks:</strong><br/>
          ${data?.headComment || data?.headTeacherComment || ''}
        </div>`;

      case 'PROMOTION_STATUS':
        return `<div style="${styleStr}">
          ${data?.promotionStatus || ''}
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
        const safeSigUrl = typeof sigUrl === 'string' && (/^https:\/\//i.test(sigUrl) || /^data:image\/(png|jpe?g|webp);base64,/i.test(sigUrl))
          ? this.escapeHtml(sigUrl)
          : '';
        return safeSigUrl
          ? `<img src="${safeSigUrl}" alt="Signature" style="${styleStr}" />`
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

    if (!Array.isArray(attendance)) {
      const present = attendance.presentDays ?? 0;
      const late = attendance.lateDays ?? 0;
      const absent = attendance.absentDays ?? 0;
      const total = attendance.totalDays ?? present + late + absent;
      const rate = attendance.attendanceRate != null
        ? attendance.attendanceRate + '%'
        : (total ? Math.round(((present + late) / total) * 100) + '%' : '—');
      const cell = 'padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;';
      const head = 'padding:4px 6px;border:1px solid #1a365d;text-align:center;font-size:9px;';
      return `<table style="width:100%;border-collapse:collapse;${styleStr}">
        <thead>
          <tr style="background:#1a365d;color:white;">
            <th style="${head}">Total Days</th>
            <th style="${head}">Present</th>
            <th style="${head}">Absent</th>
            <th style="${head}">Late</th>
            <th style="${head}">Attendance Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="${cell}">${total || ''}</td>
            <td style="${cell}">${present || ''}</td>
            <td style="${cell}">${absent || ''}</td>
            <td style="${cell}">${late || ''}</td>
            <td style="${cell}font-weight:bold;color:#047857;">${rate}</td>
          </tr>
        </tbody>
      </table>`;
    }

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
    const content = component.content || {};
    const showTotal = content.showTotal !== false;
    const showAverage = content.showAverage !== false;
    const showPoints = content.showPoints ?? content.showGPA !== false;
    const showPosition = content.showPosition !== false;

    const stat = (label: string, value: any, bg: string, color: string) =>
      `<div style="flex:1;min-width:80px;background:${bg};padding:8px;border-radius:4px;text-align:center;">
        <div style="font-size:18px;font-weight:bold;color:${color};">${value ?? ''}</div>
        <div style="font-size:9px;color:#666;">${label}</div>
      </div>`;

    const cards: string[] = [];
    if (showTotal) cards.push(stat('Total Marks', s.totalMarks, '#eff6ff', '#2563eb'));
    if (showAverage) cards.push(stat('Average', s.average, '#f0fdf4', '#16a34a'));
    if (showPoints) cards.push(stat('Points', s.totalPoints, '#fefce8', '#ca8a04'));
    if (showPosition) cards.push(stat('Position', s.positionInClass ? `${s.positionInClass}/${s.totalStudents || ''}` : '', '#f5f3ff', '#7c3aed'));

    if (!cards.length) return `<div style="${styleStr}"></div>`;
    return `<div style="${styleStr};display:flex;flex-wrap:wrap;gap:8px;">${cards.join('')}</div>`;
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
      // ── Digital Document Authenticity (Stamp Engine) tokens ──
      // Callers inject data.authenticity = VerificationService.buildAuthenticityPlaceholders()
      // when a document is finalized; unresolved tokens render empty (never broken markup).
      'digital_stamp': data?.authenticity?.digital_stamp || '',
      'digital_signature': data?.authenticity?.digital_signature || '',
      'document_serial': data?.authenticity?.document_serial || '',
      'verification_qr': data?.authenticity?.verification_qr || '',
      'document_hash': data?.authenticity?.document_hash || '',
      'issued_date': data?.authenticity?.issued_date ?? new Date().toLocaleDateString(),
      'issued_timestamp': data?.authenticity?.issued_timestamp ?? '',
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
    const lengthKeys = new Set([
      'width', 'height', 'left', 'right', 'top', 'bottom',
      'font-size', 'border-radius', 'border-width', 'gap',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    ]);
    const internalKeys = new Set(['headerBg', 'headerColor', 'altRowBg']);
    return Object.entries(styles)
      .filter(([k, v]) => v !== undefined && v !== null && v !== '' && !internalKeys.has(k))
      .map(([k, v]) => {
        const cssKey = map[k] || k.replace(/([A-Z])/g, '-$1').toLowerCase();
        if (lengthKeys.has(cssKey) && typeof v === 'number') return `${cssKey}:${v}px`;
        return `${cssKey}:${v}`;
      })
      .join(';');
  }

  async renderPreview(schoolId: string | undefined, templateId: string, data?: any): Promise<string> {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, ...(schoolId ? { schoolId } : {}) },
      include: {
        components: { orderBy: { sortOrder: 'asc' } },
        certificate: true,
      },
    });
    if (!template) throw new NotFoundException('Template not found');

    const school = schoolId ? await this.prisma.school.findUnique({ where: { id: schoolId } }) : null;

    this.registerHelpers();

    const defaultData = data || {
      student: { firstName: 'John', lastName: 'Doe', admissionNumber: '2024-001', photoUrl: '' },
      class: { name: 'Grade 10A' },
      term: { name: 'Term 1', academicYear: '2024' },
      examType: 'END_TERM',
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

    // Resolve a school-owned handwritten asset once, so SIGNATURE components
    // render the preserved artwork without exposing cross-school records.
    const hasSignatureComponent = template.components.some((component: any) => component.type === 'SIGNATURE');
    const requestedSignatureId = data?.signatureId;
    if (schoolId && (hasSignatureComponent || requestedSignatureId)) {
      const signature = await this.prisma.digitalSignature.findFirst({
        where: {
          schoolId,
          ...(requestedSignatureId ? { id: requestedSignatureId } : { isDefault: true }),
        },
        select: { imageUrl: true, signatureData: true, transparentImageUrl: true, processedImageUrl: true },
      });
      if (signature) {
        defaultData.signatureUrl = signature.transparentImageUrl || signature.processedImageUrl || signature.imageUrl || signature.signatureData || undefined;
      }
    }

    const templateMetadata = (template.metadata as any) || {};
    const fallbackCertificate = template.templateType === 'CERTIFICATE' && !template.certificate
      ? {
          certificateType: /service|staff|teacher|leadership|merit|award/i.test(template.name) ? 'MERIT_AWARD' : 'ACADEMIC_EXCELLENCE',
          borderStyle: 'classic',
          borderColor: template.primaryColor || '#1a365d',
          showQrCode: true,
          showBadge: true,
          badgeStyle: 'star',
          awardText: template.components?.find((component: any) => component.type === 'AWARD_TEXT')?.content?.text || 'This certificate is awarded to',
          signature1Label: 'Head Teacher',
          signature2Label: 'Director',
        }
      : null;
    const renderTemplate = fallbackCertificate ? { ...template, certificate: fallbackCertificate } : template;
    const resolvedComponents = await Promise.all(renderTemplate.components.map(async (component: any) => {
      if (component.type !== 'SIGNATURE' || !schoolId || !component.content?.signatureId) return component;
      const selected = await this.prisma.digitalSignature.findFirst({
        where: { id: component.content.signatureId, schoolId, status: 'ACTIVE' },
        select: { transparentImageUrl: true, processedImageUrl: true, imageUrl: true, signatureData: true },
      });
      return selected ? {
        ...component,
        content: {
          ...component.content,
          signatureUrl: selected.transparentImageUrl || selected.processedImageUrl || selected.imageUrl || selected.signatureData,
        },
      } : component;
    }));
    const isProfessionalHbs = !renderTemplate.certificate && (
      templateMetadata.enhancedProfessional ||
      templateMetadata.professionalHbs ||
      templateMetadata.source === 'system-seed' ||
      templateMetadata.source === 'marketplace-download'
    );
    if (isProfessionalHbs) {
      const html = this.renderProfessionalHbsPreview(renderTemplate, defaultData, school);
      return this.applyDefaultStamp(schoolId, html);
    }

    const pageSize = renderTemplate.pageSize || 'A4';
    const orientation = renderTemplate.orientation || 'portrait';
    const pageMargins = renderTemplate.certificate
      ? '0'
      : `${renderTemplate.marginTop || 15}mm ${renderTemplate.marginRight || 15}mm ${renderTemplate.marginBottom || 15}mm ${renderTemplate.marginLeft || 15}mm`;
    const isLandscape = orientation === 'landscape';
    const marginLeftMm = renderTemplate.certificate ? 0 : (renderTemplate.marginLeft ?? 15);
    const marginRightMm = renderTemplate.certificate ? 0 : (renderTemplate.marginRight ?? 15);
    const pageWidthPx = Math.round(((isLandscape ? 297 : 210) - marginLeftMm - marginRightMm) * 96 / 25.4);

    const isEnhancedTemplate = Boolean((renderTemplate.metadata as any)?.enhancedProfessional);
    const componentsHtml = this.renderComponentsToHtml(
      resolvedComponents,
      defaultData,
      school,
      pageWidthPx,
      isEnhancedTemplate,
    );

    let stampOverlay = '';
    let mainContent: string;

    if (renderTemplate.certificate) {
      try {
        const templateStamps = await this.digitalStampService.getTemplateStamps(schoolId, templateId).catch(() => []);
        const cert = renderTemplate.certificate;
        mainContent = await this.certificateRenderer.generateCertificateHtml({}, {
          schoolName: school?.name || '',
          studentName: `${defaultData.student.firstName} ${defaultData.student.lastName}`,
          className: defaultData.class.name,
           termName: defaultData.term.name,
           academicYear: defaultData.term.academicYear,
           examType: defaultData.examType || 'END_TERM',
           certificateNumber: defaultData.certificateNumber || 'ST-PREVIEW-00000000',
           certificateComment: defaultData.certificateComment || defaultData.teacherComment || '',
          verificationUrl: '',
          schoolLogo: school?.logoUrl || school?.logo || '',
          studentPhoto: defaultData.student.photoUrl || '',
          signature1Name: cert.signature1Name || '',
          signature1Label: cert.signature1Label || 'Head Teacher',
          signature2Name: cert.signature2Name || '',
          signature2Label: cert.signature2Label || 'Director',
          awardText: cert.awardText || 'This certificate is awarded to',
          borderStyle: cert.borderStyle || 'classic',
          borderColor: cert.borderColor || '#1a365d',
          showQrCode: cert.showQrCode || false,
          showBadge: cert.showBadge || false,
          badgeStyle: cert.badgeStyle || 'star',
          showWatermark: cert.showWatermark || false,
          watermarkText: cert.watermarkText || 'CERTIFICATE',
          orientation: template.orientation || 'portrait',
          pageSize: template.pageSize || 'A4',
           stamps: templateStamps,
        });
      } catch {
        mainContent = this.renderCertificateHtml(renderTemplate, defaultData, school);
        try {
          const templateStamps = await this.digitalStampService.getTemplateStamps(schoolId, templateId);
          if (templateStamps && templateStamps.length > 0) {
            stampOverlay = this.digitalStampService.getStampSvgOverlay(templateStamps);
          }
        } catch {}
      }
    } else {
      mainContent = componentsHtml;
      try {
        const templateStamps = await this.digitalStampService.getTemplateStamps(schoolId, templateId);
        if (templateStamps && templateStamps.length > 0) {
          stampOverlay = this.digitalStampService.getStampSvgOverlay(templateStamps);
        }
      } catch {
        // Stamps are optional; continue without overlay on error
      }
    }

    const pageWidth = isLandscape ? '297mm' : '210mm';
    const pageHeight = isLandscape ? '210mm' : '297mm';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${renderTemplate.name}</title>
  <style>
     @page { size: ${pageSize} ${orientation}; margin: ${pageMargins}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
     body { font-family: ${renderTemplate.fontFamily || 'Arial'}, sans-serif; font-size: ${renderTemplate.fontSize || 12}px; color: #111827; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow-x: hidden; }
    img { max-width: 100%; }
    table { page-break-inside: avoid; }
    @media print { body { margin: 0; padding: 0; } }
  </style>
</head>
<body>
  ${renderTemplate.headerText ? `<div style="text-align:center;margin-bottom:10px;font-size:12px;color:#374151;border-bottom:1px solid #9ca3af;padding-bottom:5px;">${renderTemplate.headerText}</div>` : ''}
  ${mainContent}
  ${stampOverlay ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;">${stampOverlay}</div>` : ''}
  ${renderTemplate.footerText ? `<div style="text-align:center;margin-top:10px;font-size:11px;color:#4b5563;border-top:1px solid #9ca3af;padding-top:5px;">${renderTemplate.footerText}</div>` : ''}
</body>
</html>`;
    return this.applyDefaultStamp(schoolId, html);
  }

  /** Apply the school's published default Stamp Designer template to every generated page. */
  async applyDefaultStamp(schoolId: string | undefined, html: string): Promise<string> {
    if (!schoolId) return html;
    try {
      const defaultTemplate = await this.stampTemplates.getDefault(schoolId);
      if (!defaultTemplate) return html;
      const template = await this.stampTemplates.getById(schoolId, defaultTemplate.id);
      const cfg = (template.configJson || {}) as any;

      const now = new Date();
      const tz = this.stampTimezone();
      const stampDate = this.formatStampDate(now, tz);
      const stampTime = this.formatStampTime(now, tz);

      const assetIds = (cfg.layers || [])
        .filter(l => l.type === 'image' && l.assetId)
        .map(l => l.assetId as string);
      const assetMap = await this.stampAssets.resolveAssetMap(schoolId, assetIds);

      const svg = this.stampRenderer.render(cfg, {
        serialNumber: this.formatReportSerial(),
        stampDate,
        stampTime,
        timezoneLabel: this.stampTimezoneLabel(tz),
        assets: assetMap,
      });
      const overlay = `<div style="position:fixed;right:18mm;bottom:18mm;width:42mm;height:42mm;z-index:9999;pointer-events:none;">${svg}</div>`;
      return html.includes('</body>') ? html.replace('</body>', `${overlay}</body>`) : `${html}${overlay}`;
    } catch {
      return html;
    }
  }

  private stampTimezone(): string {
    return process.env.STAMP_DEFAULT_TIMEZONE || 'Africa/Lusaka';
  }

  private formatStampDate(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).formatToParts(date);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '';
    return `${get('day')} ${get('month').toUpperCase()} ${get('year')}`;
  }

  private formatStampTime(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '';
    return `${get('hour')}:${get('minute')}:${get('second')}`;
  }

  private formatReportSerial(): string {
    const year = new Date().getUTCFullYear();
    const seq = crypto.randomInt(0x10000000).toString(16).toUpperCase().padStart(8, '0');
    return `STS-RPT-${year}-${seq}`;
  }

  private stampTimezoneLabel(tz: string): string {
    const labels: Record<string, string> = {
      'Africa/Lusaka': 'CAT',
      'Africa/Harare': 'CAT',
      'Africa/Johannesburg': 'SAST',
      'Africa/Nairobi': 'EAT',
      UTC: 'UTC',
    };
    return labels[tz] || '';
  }

  private renderProfessionalHbsPreview(template: any, data: any, school?: any): string {
    const variant = String(template.metadata?.hbsVariant || template.name || 'secondary-report')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const subjects = data.subjectBreakdown || (data.subjects || []).map((subject: any) => ({
      subjectName: subject.subject || subject.name,
      totalRawScore: subject.score,
      finalPercentage: subject.score,
      finalGrade: subject.grade,
      points: subject.points,
      finalRemark: subject.remark,
      subjectRank: null,
      performanceCategory: null,
    }));
    const summary = data.termSummary || data.summary || {};
    const reportTitle = variant.includes('assessment')
      ? (variant.includes('term') ? 'TERM ASSESSMENT SUMMARY' : 'CONTINUOUS ASSESSMENT REPORT')
      : variant.includes('selection') ? 'GRADE 7 SELECTION REPORT'
      : variant.includes('mock') ? 'GRADE 7 MOCK EXAMINATION REPORT'
      : variant.includes('ecz') ? 'GRADE 7 ECZ EXAMINATION REPORT'
      : variant.includes('transcript') ? (variant.includes('abridged') ? 'ABRIDGED ACADEMIC TRANSCRIPT' : 'OFFICIAL ACADEMIC TRANSCRIPT')
      : variant.includes('form-5') || variant.includes('form-6') ? 'ADVANCED SECONDARY REPORT CARD'
      : variant.includes('form-1') ? 'FORM 1 ACADEMIC REPORT CARD'
      : variant.includes('form-2') ? 'FORM 2 ACADEMIC REPORT CARD'
      : variant.includes('grade-10') ? 'GRADE 10 ACADEMIC REPORT CARD'
      : variant.includes('grade-11') ? 'GRADE 11 ACADEMIC REPORT CARD'
      : variant.includes('grade-12') ? 'GRADE 12 ACADEMIC REPORT CARD'
      : variant.includes('grade-1-6') ? 'GRADE 1-6 CONTINUOUS ASSESSMENT REPORT'
      : 'STUDENT REPORT CARD';
    const isPrimarySchool = template.metadata?.educationLevel === 'primary-school'
      || variant.includes('grade-1-6')
      || variant.includes('grade-7');
    const professionalData = {
      ...data,
      schoolName: school?.name || data.schoolName || '',
      schoolLogo: school?.logoUrl || school?.logo || data.schoolLogo,
      examType: data.examType || data.exam?.type || 'END_TERM',
      subjectBreakdown: subjects,
      bestSubjects: data.bestSubjects || subjects.filter((s: any) => s.finalPercentage != null).slice(0, 6),
      totalPoints: data.totalPoints ?? summary.totalPoints ?? 0,
      bestSubjectsAverage: data.bestSubjectsAverage ?? summary.average ?? null,
      termSummary: summary,
      attendance: data.attendance || { totalDays: 0, presentDays: 0, attendanceRate: null },
      gradingLegend: data.gradingLegend || [],
      primaryColor: template.primaryColor || '#1e3a8a',
      secondaryColor: template.secondaryColor || '#eff6ff',
      reportTitle,
      templateVariant: variant,
      isAssessmentVariant: variant.includes('assessment'),
      isSelectionVariant: variant.includes('selection'),
      isAdvancedVariant: ['form-5-report', 'form-6-report'].includes(variant),
      isExaminationVariant: ['grade-7-ecz', 'grade-7-mock'].includes(variant),
      isTranscriptVariant: variant.includes('transcript'),
      isPrimarySchool,
      isGrade7Ecz: variant.includes('grade-7'),
      grade7Result: null,
      isForm1Variant: variant.includes('form-1'),
      isForm2Variant: variant.includes('form-2'),
      isGrade10Variant: variant.includes('grade-10'),
      isGrade11Variant: variant.includes('grade-11'),
      isGrade12Variant: variant.includes('grade-12'),
      generatedAtFormatted: new Date().toLocaleString(),
    };
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'report-card-enhanced.hbs');
    return handlebars.compile(fs.readFileSync(templatePath, 'utf8'))(professionalData);
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
      victorian: `3px solid ${borderColor};box-shadow:0 0 0 6px ${borderColor}11,0 0 0 8px ${borderColor}`,
      parchment: `2px solid ${borderColor};background:#fef9ef`,
      gothic: `3px solid ${borderColor}`,
      academic: `2px solid ${borderColor};background:linear-gradient(135deg,${borderColor}05,${borderColor}10)`,
      university: `6px solid #0a1628;box-shadow:0 0 0 2px #1a365d`,
    };

    const borderCss = borderMap[borderStyle] || borderMap.classic;
    const sealImage = this.certificateRenderer.getSmartTechSealDataUrl();
    const fallbackSeal = this.certificateRenderer.generateSealSvg('#0f766e', 'SMART TECH');

    const s = data?.student || {};
    const studentName = `${s.firstName || ''} ${s.lastName || ''}`;

    return `<div style="position:relative;width:100%;min-height:${isLandscape ? '190' : '260'}mm;padding:30px;border:${borderCss};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:white;overflow:hidden;">
       <div style="position:absolute;right:40px;bottom:35px;width:70px;height:70px;z-index:1;overflow:hidden;">${sealImage ? `<img src="${sealImage}" alt="Smart Tech authenticated seal" style="display:block;width:70px;height:70px;max-width:70px;max-height:70px;object-fit:contain;" />` : `<div style="width:70px;height:70px;">${fallbackSeal}</div>`}</div>
      ${cert.showWatermark && cert.watermarkText ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)rotate(-30deg);font-size:80px;color:${borderColor};opacity:0.04;pointer-events:none;white-space:nowrap;font-weight:bold;">${cert.watermarkText}</div>` : ''}
      ${school?.logoUrl ? `<img src="${school.logoUrl}" style="height:60px;margin-bottom:10px;" />` : ''}
       <div style="font-size:34px;font-weight:800;color:${borderColor};margin-bottom:7px;">${school?.name || 'School Name'}</div>
       <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:3px;">${cert.borderStyle === 'university' ? 'Official University Document' : 'Official Academic Document'}</div>
      <hr style="width:160px;border:none;height:1px;background:linear-gradient(90deg,transparent,${borderColor},transparent);margin:10px auto;opacity:0.6;" />
       <div style="font-size:13px;font-weight:700;color:#1f2937;margin-bottom:7px;text-transform:uppercase;letter-spacing:5px;">${cert.certificateType === 'SPORTS_AWARD' ? 'Certificate of Athletic Achievement' : cert.certificateType === 'ATTENDANCE' ? 'Certificate of Attendance' : cert.certificateType === 'MERIT_AWARD' ? 'Certificate of Merit' : cert.certificateType === 'GRADUATION' ? 'Diploma of Graduation' : 'Certificate of Academic Excellence'}</div>
       <div style="font-size:17px;font-weight:600;color:#111827;margin:8px 0;font-style:italic;">${cert.awardText || 'This certificate is awarded to'}</div>
       <div style="font-size:40px;font-weight:800;color:${borderColor};margin:8px 0;font-family:'Georgia',serif;">${studentName}</div>
       <div style="font-size:14px;font-weight:600;color:#1f2937;margin:5px 0;line-height:1.6;">${cert.certificateType === 'SPORTS_AWARD' ? 'In recognition of outstanding athletic achievement and sportsmanship' : cert.certificateType === 'ATTENDANCE' ? 'In recognition of exemplary attendance and punctuality' : cert.certificateType === 'MERIT_AWARD' ? 'In recognition of outstanding merit, dedication, and service' : cert.certificateType === 'GRADUATION' ? 'In recognition of successful completion of academic requirements' : 'In recognition of outstanding academic performance and demonstrated excellence'}</div>
        <div style="font-size:13px;font-weight:600;color:#374151;margin:6px 0;">Class: ${data?.class?.name || ''} | Term: ${data?.term?.name || ''} ${data?.term?.academicYear || ''} | Exam: ${data?.examType || 'END_TERM'}</div>
       ${data?.certificateComment ? `<div style="max-width:620px;margin:12px auto 5px;padding:10px 18px;border-left:4px solid #0f766e;border-right:4px solid #0f766e;background:#f0fdfa;color:#134e4a;font-size:13px;font-weight:600;line-height:1.5;">${this.escapeHtml(String(data.certificateComment))}</div>` : ''}
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
       <div style="font-size:16px;color:#0f766e;font-weight:900;margin-top:16px;letter-spacing:2px;font-family:'Courier New',monospace;">Certificate No: ${data?.certificateNumber || 'ST-PREVIEW-00000000'}</div>
    </div>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] || character);
  }

  async renderPdf(schoolId: string, templateId: string, data?: any): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    // ── Authenticity pipeline (Phase 6 wiring) ──
    // When the template declares includeStamp/includeSignature, finalize a
    // DocumentVerification and inject authenticity placeholders BEFORE HTML
    // rendering. Fail-safe: any stamp-engine error renders the document
    // WITHOUT authenticity tokens (never a fake-authenticated document).
    const renderData = await this.maybeAttachAuthenticity(schoolId, templateId, data);
    const html = await this.renderPreview(schoolId, templateId, renderData);

    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, schoolId },
    });

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    // Hardened load: networkidle0 first (best fidelity); if unreachable remote
    // assets keep the network busy, fall back to domcontentloaded so rendering
    // degrades to embedded content instead of failing the whole document.
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' as any, timeout: 30000 });
    } catch {
      this.logger?.warn?.('setContent networkidle0 timed out — falling back to domcontentloaded');
      await page.setContent(html, { waitUntil: 'domcontentloaded' as any, timeout: 60000 });
    }

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
    const buffer = Buffer.from(pdf);
    try {
      const result = await this.cloudinary.uploadBuffer(buffer, {
        folder: `${FOLDERS.system}/render-templates`,
        publicId: `render-${templateId}-${Date.now()}`,
        resourceType: 'raw',
      });
      return { buffer, url: result.secureUrl, publicId: result.publicId };
    } catch {
      return { buffer, url: null, publicId: null };
    }
  }

  /**
   * Automatic authenticity workflow (marketplace-driven): if the ReportTemplate
   * opts in via includeStamp/includeSignature, run stamp-engine finalize
   * (serial → hash → QR → verification record) and expose the result to the
   * placeholder engine as data.authenticity. Teachers never touch crypto config.
   */
  private async maybeAttachAuthenticity(schoolId: string, templateId: string, data?: any): Promise<any> {
    try {
      const template = await this.prisma.reportTemplate.findFirst({
        where: { id: templateId, schoolId },
        select: { id: true, name: true, templateType: true, includeStamp: true, includeSignature: true },
      });
      if (!template?.includeStamp) return data;

      // Entitlement gate — missing PREMIUM feature ⇒ unauthenticated render.
      await this.verification.assertEntitlement(schoolId);

      const finalized = await this.verification.finalize({
        actor: { userId: 'report-pipeline', schoolId, roles: [], isSuperAdmin: true },
        schoolId,
        documentId: crypto.randomUUID(),
        documentType: template.templateType || 'REPORT',
        documentTitle: template.name,
        issuedToLabel: null,
        documentData: {
          templateId,
          payloadKeys: Object.keys(data || {}).sort(),
          renderedAt: new Date().toISOString(),
        },
        ipAddress: undefined,
        userAgent: 'report-pipeline',
      });

      return {
        ...(data || {}),
        authenticity: this.verification.buildAuthenticityPlaceholders(finalized),
      };
    } catch (e: any) {
      // Fail-safe per spec §Failure Handling: no serial/QR/stamp on the output.
      this.logger.warn(
        `Authenticity skipped for template ${templateId}: ${e?.message ?? e}`,
      );
      return data;
    }
  }

  /**
   * Finalize a canonical verification record for a report template that opts
   * in via includeStamp and return the data needed to render the authenticity
   * block on the generated document. Returns null when the template is not
   * opted in or when finalization fails (fail-safe: never a fake stamp).
   */
  async finalizeReportAuthenticity(
    schoolId: string,
    templateId: string,
  ): Promise<{
    placeholders: Record<string, string>;
    verificationCode: string;
    verificationUrl: string;
  } | null> {
    try {
      const template = await this.prisma.reportTemplate.findFirst({
        where: { id: templateId, schoolId },
        select: { id: true, name: true, templateType: true, includeStamp: true },
      });
      if (!template?.includeStamp) return null;

      await this.verification.assertEntitlement(schoolId);

      const finalized = await this.verification.finalize({
        actor: { userId: 'report-pipeline', schoolId, roles: [], isSuperAdmin: true },
        schoolId,
        documentId: crypto.randomUUID(),
        documentType: template.templateType || 'REPORT_CARD',
        documentTitle: template.name,
        documentData: {
          templateId: template.id,
          generatedAt: new Date().toISOString(),
        },
        ipAddress: undefined,
        userAgent: 'report-pipeline',
      });

      return {
        placeholders: this.verification.buildAuthenticityPlaceholders(finalized as any),
        verificationCode: finalized.verificationCode,
        verificationUrl: finalized.verificationUrl,
      };
    } catch (e: any) {
      this.logger.warn(
        `Report authenticity finalize skipped for template ${templateId}: ${e?.message ?? e}`,
      );
      return null;
    }
  }
}
