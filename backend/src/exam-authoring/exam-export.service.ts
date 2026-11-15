import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import puppeteer from 'puppeteer';
import { ExamArtifactType } from '@prisma/client';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { renderExamPaperHtml } from './exam-paper-template';

@Injectable()
export class ExamExportService {
  constructor(private readonly prisma: PrismaService, private readonly cloudinary: CloudinaryService) {}

  async exportVersion(schoolId: string, versionId: string, type: ExamArtifactType) {
    const version = await this.prisma.examinationVersion.findFirst({ where: { id: versionId, schoolId }, include: { exam: { include: { subject: true, class: true, school: true, term: { include: { academicYear: true } } } } } });
    if (!version) throw new NotFoundException('Examination version not found');
    const examiner = type === ExamArtifactType.EXAMINER_PDF || type === ExamArtifactType.EXAMINER_DOCX || type === ExamArtifactType.COMBINED_PDF;
    const html = this.renderHtml(version, examiner);
    const isDocx = type === ExamArtifactType.CANDIDATE_DOCX || type === ExamArtifactType.EXAMINER_DOCX;
    const buffer = isDocx ? await this.createDocx(html) : await this.createPdf(html);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const extension = isDocx ? 'docx' : 'pdf';
    const filename = `${version.exam.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-v${version.version}-${type.toLowerCase()}.${extension}`;
    let storageKey = join('uploads', 'examinations', schoolId, filename);
    let downloadUrl: string | undefined;
    if (this.cloudinary.isConfigured) {
      const uploaded = await this.cloudinary.uploadBuffer(buffer, { folder: FOLDERS.examinations, publicId: `${version.examId}-v${version.version}-${type.toLowerCase()}`, fileName: filename, resourceType: isDocx ? 'raw' : 'raw' });
      storageKey = uploaded.publicId;
      downloadUrl = uploaded.secureUrl;
    } else {
      const directory = join(process.cwd(), 'uploads', 'examinations', schoolId);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(join(process.cwd(), storageKey), buffer);
    }
    return this.prisma.examinationArtifact.upsert({ where: { versionId_type: { versionId, type } }, update: { storageKey, downloadUrl, mimeType: isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf', byteSize: buffer.length, contentHash: hash }, create: { versionId, schoolId, type, storageKey, downloadUrl, mimeType: isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf', byteSize: buffer.length, contentHash: hash } });
  }

  async getArtifact(schoolId: string, artifactId: string) {
    const artifact = await this.prisma.examinationArtifact.findFirst({
      where: { id: artifactId, schoolId },
      include: { version: { select: { version: true, exam: { select: { title: true } } } } },
    });
    if (!artifact) throw new NotFoundException('Examination artifact not found');
    if (artifact.downloadUrl) {
      const remote = await fetch(artifact.downloadUrl);
      if (!remote.ok) throw new NotFoundException('Stored examination artifact could not be retrieved');
      return { artifact, buffer: Buffer.from(await remote.arrayBuffer()) };
    }
    return { artifact, buffer: await fs.readFile(join(process.cwd(), artifact.storageKey)) };
  }

  private renderHtml(version: any, includeAnswers: boolean) {
    const snapshot = version.snapshot as any;
    return renderExamPaperHtml({
      version: Number(version.version || 1),
      title: version.exam.title,
      subjectName: version.exam.subject?.name || snapshot.subject?.name || 'Examination',
      className: version.exam.class?.name || 'Class',
      termName: version.exam.term?.name,
      academicYearName: version.exam.term?.academicYear?.name,
      durationMinutes: Number(snapshot.durationMinutes || version.exam.duration || 0),
      totalMarks: Number(snapshot.totalMarks || version.exam.totalScore || 0),
      school: { ...version.exam.school, logoUrl: version.exam.school.logoUrl || version.exam.school.logo },
      snapshot,
      includeAnswers,
    });
  }

  private async createPdf(html: string) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
     try {
       const page = await browser.newPage();
       await page.setContent(html, { waitUntil: 'load' });
       return Buffer.from(await page.pdf({
         format: 'A4',
         printBackground: true,
         displayHeaderFooter: true,
         margin: { top: '20mm', bottom: '18mm', left: '16mm', right: '16mm' },
         headerTemplate: '<div></div>',
         footerTemplate: '<div style="width:100%;font-family:Arial,sans-serif;font-size:8px;color:#526174;text-align:center;border-top:1px solid #cbd5e1;padding-top:4px"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
       }));
     }
    finally { await browser.close(); }
  }

  private async createDocx(html: string): Promise<Buffer> {
    const text = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();
    const chunks: Buffer[] = [];
    const output = archiver('zip', { zlib: { level: 9 } });
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => { output.on('end', () => resolve(Buffer.concat(chunks))); output.on('error', reject); });
    output.append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>', { name: '[Content_Types].xml' });
    output.append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>', { name: '_rels/.rels' });
    output.append(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text.split('\n').map(line => `<w:p><w:r><w:t xml:space="preserve">${this.escapeXml(line)}</w:t></w:r></w:p>`).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`, { name: 'word/document.xml' });
    output.finalize();
    return done;
  }

  private escape(value: any) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)); }
  private escapeXml(value: any) { return this.escape(value); }
}
