import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface DiagramInput {
  name: string;
  diagramType: 'CARTESIAN_GRAPH' | 'VENN_3_SET' | 'TRIANGLE' | 'SVG';
  definition: any;
  questionId?: string;
}

@Injectable()
export class ExamDiagramService {
  constructor(private readonly prisma: PrismaService) {}

  async create(schoolId: string, versionId: string, input: DiagramInput) {
    const version = await this.prisma.examinationVersion.findFirst({ where: { id: versionId, schoolId }, include: { exam: true } });
    if (!version) throw new NotFoundException('Examination version not found');
    if (input.questionId) {
      const question = await this.prisma.examQuestion.findFirst({ where: { id: input.questionId, examId: version.examId } });
      if (!question) throw new BadRequestException('Question does not belong to this examination version');
    }
    const renderedSvg = this.render(input.diagramType, input.definition);
    return this.prisma.examinationDiagram.create({ data: { versionId, questionId: input.questionId, name: input.name, diagramType: input.diagramType, definition: input.definition, renderedSvg, contentHash: createHash('sha256').update(JSON.stringify(input.definition)).digest('hex'), isTechnicallyVerified: false } });
  }

  async update(schoolId: string, id: string, definition: any) {
    const diagram = await this.prisma.examinationDiagram.findUnique({ where: { id }, include: { version: { select: { schoolId: true } } } });
    if (!diagram || diagram.version?.schoolId !== schoolId) throw new NotFoundException('Diagram not found');
    const renderedSvg = this.render(diagram.diagramType as DiagramInput['diagramType'], definition);
    return this.prisma.examinationDiagram.update({ where: { id }, data: { definition, renderedSvg, contentHash: createHash('sha256').update(JSON.stringify(definition)).digest('hex'), isTechnicallyVerified: false } });
  }

  private render(type: DiagramInput['diagramType'], definition: any): string {
    if (type === 'CARTESIAN_GRAPH') return this.renderCartesian(definition);
    if (type === 'VENN_3_SET') return this.renderVenn(definition);
    if (type === 'TRIANGLE') return this.renderTriangle(definition);
    if (!definition?.svg) throw new BadRequestException('SVG diagrams require an svg definition');
    return String(definition.svg);
  }

  private renderCartesian(definition: any) {
    const width = Number(definition.width || 640); const height = Number(definition.height || 400); const xMin = Number(definition.xMin ?? 0); const xMax = Number(definition.xMax ?? 10); const yMin = Number(definition.yMin ?? 0); const yMax = Number(definition.yMax ?? 10);
    if (xMax <= xMin || yMax <= yMin) throw new BadRequestException('Cartesian graph bounds are invalid');
    const x = (value: number) => 48 + ((value - xMin) / (xMax - xMin)) * (width - 72); const y = (value: number) => height - 42 - ((value - yMin) / (yMax - yMin)) * (height - 66);
    const grid = []; for (let value = Math.ceil(xMin); value <= xMax; value++) grid.push(`<line x1="${x(value)}" y1="20" x2="${x(value)}" y2="${height - 42}"/>`); for (let value = Math.ceil(yMin); value <= yMax; value++) grid.push(`<line x1="48" y1="${y(value)}" x2="${width - 24}" y2="${y(value)}"/>`);
    const points = (definition.points || []).map((point: any) => `<circle cx="${x(Number(point.x))}" cy="${y(Number(point.y))}" r="4"/><text x="${x(Number(point.x)) + 6}" y="${y(Number(point.y)) - 6}">${this.escape(point.label || '')}</text>`).join('');
    const line = (definition.lines || []).map((lineItem: any) => `<polyline points="${(lineItem.points || []).map((point: any) => `${x(Number(point.x))},${y(Number(point.y))}`).join(' ')}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img"><style>line{stroke:#d1d5db;stroke-width:1}polyline{fill:none;stroke:#111827;stroke-width:2}circle{fill:#111827}text{font:12px Arial;fill:#111827}</style>${grid.join('')}<line x1="48" y1="${y(0)}" x2="${width - 24}" y2="${y(0)}" stroke="#111"/><line x1="${x(0)}" y1="20" x2="${x(0)}" y2="${height - 42}" stroke="#111"/>${line}${points}<text x="${width - 110}" y="${height - 12}">${this.escape(definition.xLabel || 'x')}</text><text x="10" y="30">${this.escape(definition.yLabel || 'y')}</text></svg>`;
  }

  private renderVenn(definition: any) {
    const labels = definition.labels || ['A', 'B', 'C']; const values = definition.regionValues || {}; const circles = [{ cx: 180, cy: 145, label: labels[0] }, { cx: 260, cy: 145, label: labels[1] }, { cx: 220, cy: 215, label: labels[2] }];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 360" role="img"><style>circle{fill:none;stroke:#111827;stroke-width:2}text{font:13px Arial;fill:#111827;text-anchor:middle}</style>${circles.map(circle => `<circle cx="${circle.cx}" cy="${circle.cy}" r="105"/>`).join('')}<text x="130" y="120">${this.escape(labels[0])}</text><text x="310" y="120">${this.escape(labels[1])}</text><text x="220" y="310">${this.escape(labels[2])}</text>${Object.entries(values).map(([key, value]: [string, any]) => `<text x="${key === 'onlyA' ? 145 : key === 'onlyB' ? 295 : key === 'onlyC' ? 220 : 220}" y="${key === 'onlyC' ? 255 : 165}">${this.escape(value)}</text>`).join('')}</svg>`;
  }

  private renderTriangle(definition: any) {
    const points = definition.points || { A: [80, 280], B: [360, 280], C: [220, 60] }; const labels = definition.labels || {};
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 340" role="img"><style>polygon{fill:none;stroke:#111827;stroke-width:2}line{stroke:#64748b;stroke-dasharray:5 4}text{font:13px Arial;fill:#111827}</style><polygon points="${points.A.join(',')} ${points.B.join(',')} ${points.C.join(',')}"/>${definition.height ? `<line x1="${points.C[0]}" y1="${points.C[1]}" x2="${points.C[0]}" y2="${points.A[1]}"/>` : ''}<text x="${points.A[0] - 16}" y="${points.A[1] + 18}">${this.escape(labels.A || 'A')}</text><text x="${points.B[0] + 8}" y="${points.B[1] + 18}">${this.escape(labels.B || 'B')}</text><text x="${points.C[0]}" y="${points.C[1] - 10}">${this.escape(labels.C || 'C')}</text></svg>`;
  }

  private escape(value: any) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)); }
}
