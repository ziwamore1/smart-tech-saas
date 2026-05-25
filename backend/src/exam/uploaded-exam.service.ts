import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadedExamService {
  constructor(private prisma: PrismaService) {}

  async getAll(schoolId: string) {
    return this.prisma.uploadedExam.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const exam = await this.prisma.uploadedExam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException('Uploaded exam not found');
    return exam;
  }

  async create(data: any) {
    return this.prisma.uploadedExam.create({ data });
  }

  async update(id: string, data: any) {
    await this.getById(id);
    return this.prisma.uploadedExam.update({ where: { id }, data });
  }

  async delete(id: string) {
    const exam = await this.getById(id);
    if (exam.fileUrl) {
      const filePath = exam.fileUrl.replace(/^https?:\/\/[^\/]+/, '');
      try { fs.unlinkSync(path.join(process.cwd(), filePath)); } catch {}
    }
    return this.prisma.uploadedExam.delete({ where: { id } });
  }

  async attachAnswerScript(id: string, scriptUrl: string) {
    await this.getById(id);
    return this.prisma.uploadedExam.update({
      where: { id },
      data: { answerScriptUrl: scriptUrl },
    });
  }

  async parseDocument(id: string) {
    const exam = await this.getById(id);
    const filePath = exam.fileUrl.replace(/^https?:\/\/[^\/]+/, '');
    const fullPath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('File not found on disk');
    }

    const ext = exam.fileType.toLowerCase();
    let parsedContent: any = { text: '', sections: [] };

    try {
      if (ext === 'docx') {
        parsedContent = await this.parseDocx(fullPath);
      } else if (ext === 'pdf') {
        parsedContent = await this.parsePdf(fullPath);
      }
    } catch (e: any) {
      parsedContent = { text: `[Parsing limited: ${e.message}]`, sections: [] };
    }

    return this.prisma.uploadedExam.update({
      where: { id },
      data: {
        parsedContent,
        previewHtml: this.generatePreviewHtml(parsedContent),
        status: 'PARSED',
      },
    });
  }

  private async parseDocx(filePath: string): Promise<any> {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.convertToHtml({ path: filePath });
      return { text: result.value, html: result.value, sections: this.extractSections(result.value) };
    } catch {
      return { text: '[DOCX parsing unavailable]', sections: [] };
    }
  }

  private async parsePdf(filePath: string): Promise<any> {
    return { text: `[PDF: ${path.basename(filePath)}]`, sections: [] };
  }

  private extractSections(html: string): any[] {
    const sections: any[] = [];
    const sectionRegex = /<h[12][^>]*>(.*?)<\/h[12]>/gi;
    let match;
    while ((match = sectionRegex.exec(html)) !== null) {
      sections.push({ title: match[1].replace(/<[^>]+>/g, ''), html: match[0] });
    }
    return sections;
  }

  private generatePreviewHtml(content: any): string {
    if (content.html) return content.html;
    return `<div class="exam-preview"><p>${content.text || 'No preview available'}</p></div>`;
  }

  async getPreview(id: string) {
    const exam = await this.getById(id);
    return {
      id: exam.id,
      title: exam.title,
      fileUrl: exam.fileUrl,
      fileName: exam.fileName,
      previewHtml: exam.previewHtml,
      parsedContent: exam.parsedContent,
      answerScriptUrl: exam.answerScriptUrl,
      status: exam.status,
    };
  }
}
