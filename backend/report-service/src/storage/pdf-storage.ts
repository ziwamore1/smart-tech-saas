import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { ReportResult } from '../types';

export class PdfStorage {
  private outputDir: string;

  constructor() {
    this.outputDir = config.storage.outputDir;
    this.ensureOutputDir();
  }

  private ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private getSchoolDir(schoolId: string): string {
    const dir = path.join(this.outputDir, schoolId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  savePdf(schoolId: string, jobId: string, buffer: Buffer): ReportResult {
    const dir = this.getSchoolDir(schoolId);
    const filename = `${jobId}.pdf`;
    const filepath = path.join(dir, filename);

    fs.writeFileSync(filepath, buffer);

    return {
      jobId,
      type: 'report-card',
      schoolId,
      status: 'completed',
      pdfPath: filepath,
      pdfSize: buffer.length,
      generatedAt: new Date().toISOString(),
    };
  }

  getPdfPath(schoolId: string, jobId: string): string | null {
    const filepath = path.join(this.getSchoolDir(schoolId), `${jobId}.pdf`);
    return fs.existsSync(filepath) ? filepath : null;
  }

  getPdfBuffer(schoolId: string, jobId: string): Buffer | null {
    const filepath = this.getPdfPath(schoolId, jobId);
    if (!filepath) return null;
    return fs.readFileSync(filepath);
  }

  deletePdf(schoolId: string, jobId: string): boolean {
    const filepath = this.getPdfPath(schoolId, jobId);
    if (filepath) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }

  getStorageInfo(): { totalFiles: number; totalSize: number } {
    let totalFiles = 0;
    let totalSize = 0;

    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith('.pdf')) {
          totalFiles++;
          totalSize += fs.statSync(fullPath).size;
        }
      }
    };

    if (fs.existsSync(this.outputDir)) {
      walkDir(this.outputDir);
    }

    return { totalFiles, totalSize };
  }
}
