import puppeteer, { Browser } from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { ChartRenderer } from './chart-renderer';
import {
  ReportCardData,
  TranscriptData,
  AnalyticsSummaryData,
  PerformanceProfileData,
  ReportType,
} from '../types';

export class ReportRenderer {
  private browser: Browser | null = null;
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private partials: Map<string, HandlebarsTemplateDelegate> = new Map();
  private chartRenderer: ChartRenderer;

  constructor() {
    this.chartRenderer = new ChartRenderer();
    this.registerPartials();
    this.registerHelpers();
  }

  private templatesDir(): string {
    return path.resolve(__dirname, 'templates');
  }

  private registerPartials() {
    const partialsDir = path.join(this.templatesDir(), 'partials');
    if (!fs.existsSync(partialsDir)) return;

    const files = fs.readdirSync(partialsDir);
    for (const file of files) {
      if (file.endsWith('.hbs')) {
        const name = path.basename(file, '.hbs');
        const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
        Handlebars.registerPartial(name, content);
      }
    }
  }

  private registerHelpers() {
    Handlebars.registerHelper('inc', (value: number) => value + 1);

    Handlebars.registerHelper('formatNumber', (num: number, decimals = 2) => {
      return typeof num === 'number' ? num.toFixed(decimals) : num;
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    Handlebars.registerHelper('and', (a: any, b: any) => a && b);
    Handlebars.registerHelper('or', (a: any, b: any) => a || b);
    Handlebars.registerHelper('not', (a: any) => !a);
    Handlebars.registerHelper('mul', (a: number, b: number) => a * b);
    Handlebars.registerHelper('sub', (a: number, b: number) => a - b);
    Handlebars.registerHelper('add', (a: number, b: number) => a + b);
    Handlebars.registerHelper('div', (a: number, b: number) => (b === 0 ? 0 : a / b));

    Handlebars.registerHelper('json', (context: any) => JSON.stringify(context));

    Handlebars.registerHelper('range', (start: number, end: number) => {
      const result: number[] = [];
      for (let i = start; i <= end; i++) result.push(i);
      return result;
    });

    Handlebars.registerHelper('ifCond', function (this: any, v1: any, operator: string, v2: any, options: any) {
      const operators: Record<string, (a: any, b: any) => boolean> = {
        '===': (a, b) => a === b,
        '!==': (a, b) => a !== b,
        '<': (a, b) => a < b,
        '<=': (a, b) => a <= b,
        '>': (a, b) => a > b,
        '>=': (a, b) => a >= b,
      };
      return operators[operator]?.(v1, v2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('chart_bar', (labels: string, data: string, options: any) => {
      const parsedLabels = JSON.parse(labels);
      const parsedData = JSON.parse(data);
      const hash = options.hash || {};
      const svg = new ChartRenderer().generateBarChartSvg(
        parsedLabels,
        parsedData,
        hash.width || 600,
        hash.height || 300,
        hash.color || '#1a56db',
      );
      return new Handlebars.SafeString(svg);
    });

    Handlebars.registerHelper('chart_trend', (dataPoints: string, options: any) => {
      const parsed = JSON.parse(dataPoints);
      const hash = options.hash || {};
      const svg = new ChartRenderer().generateTrendLineSvg(
        parsed,
        hash.width || 600,
        hash.height || 250,
        hash.color || '#1a56db',
      );
      return new Handlebars.SafeString(svg);
    });

    Handlebars.registerHelper('chart_radar', (labels: string, datasets: string, options: any) => {
      const parsedLabels = JSON.parse(labels);
      const parsedDatasets = JSON.parse(datasets);
      const hash = options.hash || {};
      const svg = new ChartRenderer().generateRadarChartSvg(
        parsedLabels,
        parsedDatasets,
        hash.width || 400,
        hash.height || 400,
      );
      return new Handlebars.SafeString(svg);
    });

    Handlebars.registerHelper('chart_heatmap', (data: string, options: any) => {
      const parsed = JSON.parse(data);
      const hash = options.hash || {};
      const svg = new ChartRenderer().generateHeatmapSvg(
        parsed,
        hash.width || 700,
        hash.height || 400,
      );
      return new Handlebars.SafeString(svg);
    });

    Handlebars.registerHelper('chart_distribution', (data: string, options: any) => {
      const parsed = JSON.parse(data);
      const hash = options.hash || {};
      const svg = new ChartRenderer().generateDistributionCurveSvg(
        parsed,
        hash.width || 600,
        hash.height || 250,
        hash.color || '#1a56db',
      );
      return new Handlebars.SafeString(svg);
    });
  }

  private loadTemplate(type: ReportType): HandlebarsTemplateDelegate {
    const key = type;
    if (this.templates.has(key)) {
      return this.templates.get(key)!;
    }

    const filename = `${type}.hbs`;
    const filepath = path.join(this.templatesDir(), filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(`Template not found: ${filepath}`);
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const template = Handlebars.compile(content);
    this.templates.set(key, template);
    return template;
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: config.puppeteer.headless,
        args: config.puppeteer.args,
        timeout: config.puppeteer.timeout,
      });
    }
    return this.browser;
  }

  async renderToHtml(type: ReportType, data: any): Promise<string> {
    const template = this.loadTemplate(type);
    return template(data);
  }

  async renderToPdf(type: ReportType, data: any): Promise<Buffer> {
    const html = await this.renderToHtml(type, data);

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#6b7280;text-align:center;padding:4px 15mm;border-top:1px solid #e5e7eb;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    await page.close();

    return Buffer.from(pdf);
  }

  async shutdown() {
    if (this.browser && this.browser.connected) {
      await this.browser.close();
      this.browser = null;
    }
  }

  renderReportCard(data: ReportCardData): Promise<Buffer> {
    return this.renderToPdf('report-card', data);
  }

  renderTranscript(data: TranscriptData): Promise<Buffer> {
    return this.renderToPdf('transcript', data);
  }

  renderAnalyticsSummary(data: AnalyticsSummaryData): Promise<Buffer> {
    return this.renderToPdf('analytics-summary', data);
  }

  renderPerformanceProfile(data: PerformanceProfileData): Promise<Buffer> {
    return this.renderToPdf('performance-profile', data);
  }

  async renderClassList(data: any): Promise<Buffer> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: config.puppeteer.headless,
        args: config.puppeteer.args,
        timeout: config.puppeteer.timeout,
      });
    }

    const template = this.loadTemplate('class-list');
    const html = template(data);

    const page = await this.browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#6b7280;text-align:center;padding:4px 15mm;border-top:1px solid #e5e7eb;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    await page.close();
    return Buffer.from(pdf);
  }

  async renderAttendanceRegister(data: any): Promise<Buffer> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: config.puppeteer.headless,
        args: config.puppeteer.args,
        timeout: config.puppeteer.timeout,
      });
    }

    const template = this.loadTemplate('attendance-register');
    const html = template(data);

    const page = await this.browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#6b7280;text-align:center;padding:4px 15mm;border-top:1px solid #e5e7eb;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    await page.close();
    return Buffer.from(pdf);
  }

  async renderStudentAttendance(data: any): Promise<Buffer> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: config.puppeteer.headless,
        args: config.puppeteer.args,
        timeout: config.puppeteer.timeout,
      });
    }

    const template = this.loadTemplate('student-attendance');
    const html = template(data);

    const page = await this.browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#6b7280;text-align:center;padding:4px 15mm;border-top:1px solid #e5e7eb;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    await page.close();
    return Buffer.from(pdf);
  }
}
