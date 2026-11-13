import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DiagramSpec, renderDiagramSvg } from './exam-diagram-renderer';

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
    if (type === 'SVG') {
      if (!definition?.svg) throw new BadRequestException('SVG diagrams require an svg definition');
      return String(definition.svg);
    }
    const spec = { ...definition, type } as DiagramSpec;
    const svg = renderDiagramSvg(spec);
    if (!svg) throw new BadRequestException('Diagram definition could not be rendered');
    return svg;
  }
}
