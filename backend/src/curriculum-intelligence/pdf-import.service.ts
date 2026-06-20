import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfImportService {
  private readonly logger = new Logger(PdfImportService.name);

  constructor(private prisma: PrismaService) {}

  async importAssessmentSchemePdf(file: Express.Multer.File, options: { title?: string; educationLevelId?: string; academicStageId?: string }) {
    if (!file) throw new BadRequestException('No file uploaded');
    
    const title = options.title || file.originalname || 'Assessment Scheme';
    const uploadsDir = path.join(process.cwd(), 'uploads', 'curriculum');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const doc = await this.prisma.syllabusDocument.create({
      data: {
        title,
        documentType: 'ASSESSMENT_SCHEME',
        curriculum: 'ECZ',
        educationLevelId: options.educationLevelId,
        academicStageId: options.academicStageId,
        filePath,
        fileSize: file.size,
        fileType: file.mimetype,
        isProcessed: true,
      },
    });

    this.logger.log(`Assessment scheme imported: ${title} (${file.size} bytes)`);
    return doc;
  }

  async extractSubjectsFromText(text: string): Promise<{ code: string; name: string; construct: string; eocs: string[] }[]> {
    const subjects: { code: string; name: string; construct: string; eocs: string[] }[] = [];
    
    const chapterRegex = /Chapter\s+\d+:\s+(.+?)\s+[–-]\s+(\d+)/g;
    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
      const fullName = match[1].trim();
      const code = match[2].trim();
      
      const nameParts = fullName.split('–');
      const name = nameParts[0].trim();
      
      subjects.push({
        code,
        name,
        construct: '',
        eocs: [],
      });
    }

    return subjects;
  }

  async processTextImport(text: string, options: { documentId?: string; schoolId?: string }) {
    const subjects = await this.extractSubjectsFromText(text);
    const results: any[] = [];

    for (const subj of subjects) {
      const existingSubject = await this.prisma.subject.findFirst({
        where: { name: { contains: subj.name }, schoolId: options.schoolId || '00000000-0000-0000-0000-000000000000' },
      });

      if (existingSubject) {
        results.push({ code: subj.code, name: subj.name, status: 'skipped', reason: 'Already exists' });
      } else {
        results.push({ code: subj.code, name: subj.name, status: 'unmatched', reason: 'Subject not found in database' });
      }
    }

    return { total: subjects.length, matched: results.filter(r => r.status === 'skipped').length, results };
  }
}
