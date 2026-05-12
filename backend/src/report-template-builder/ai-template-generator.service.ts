import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiTemplateGeneratorService {
  constructor(private prisma: PrismaService) {}

  async generateLayout(templateType: string, schoolId: string, preferences?: {
    colorScheme?: string;
    style?: string;
    includeCharts?: boolean;
    includeRankings?: boolean;
  }): Promise<any> {
    const layoutPresets: Record<string, any> = {
      REPORT_CARD: {
        pageSize: 'A4', orientation: 'portrait',
        components: [
          { type: 'HEADER', label: 'Report Header', content: { text: 'ACADEMIC REPORT', fontSize: 16, color: '#1a365d' }, styles: { color: '#1a365d' }, position: { x: 30, y: 20 }, size: { width: 535, height: 30 } },
          { type: 'SCHOOL_LOGO', label: 'School Logo', content: {}, styles: {}, position: { x: 30, y: 55 }, size: { width: 60, height: 60 } },
          { type: 'SCHOOL_NAME', label: 'School Name', content: { fontSize: 18, color: '#1a365d' }, styles: { color: '#1a365d' }, position: { x: 100, y: 65 }, size: { width: 300, height: 20 } },
          { type: 'STUDENT_INFO', label: 'Student Info', content: { fontSize: 11 }, styles: { color: '#555' }, position: { x: 100, y: 90 }, size: { width: 300, height: 50 } },
          { type: 'STUDENT_PHOTO', label: 'Photo', content: {}, styles: {}, position: { x: 495, y: 55 }, size: { width: 70, height: 70 } },
          { type: 'TERM_INFO', label: 'Term', content: { fontSize: 11, color: '#666' }, styles: { color: '#666' }, position: { x: 30, y: 140 }, size: { width: 200, height: 20 } },
          { type: 'RESULTS_TABLE', label: 'Results', content: { showGrade: true, showPoints: true, showRemarks: true }, styles: { headerBg: '#1a365d', headerColor: '#ffffff' }, position: { x: 30, y: 170 }, size: { width: 535, height: 200 } },
          ...(preferences?.includeCharts !== false ? [{ type: 'PERFORMANCE_CHART', label: 'Performance Chart', content: {}, styles: {}, position: { x: 30, y: 380 }, size: { width: 250, height: 150 } }] : []),
          ...(preferences?.includeRankings !== false ? [{ type: 'RANKING_TABLE', label: 'Rankings', content: { showPosition: true }, styles: {}, position: { x: 300, y: 380 }, size: { width: 265, height: 150 } }] : []),
          { type: 'ANALYTICS_SUMMARY', label: 'Summary', content: {}, styles: {}, position: { x: 30, y: 540 }, size: { width: 535, height: 60 } },
          { type: 'TEACHER_REMARKS', label: 'Remarks', content: { text: '' }, styles: { color: '#555' }, position: { x: 30, y: 610 }, size: { width: 535, height: 50 } },
          { type: 'DIVIDER', label: 'Divider', content: {}, styles: { color: '#ccc' }, position: { x: 30, y: 670 }, size: { width: 535, height: 1 } },
          { type: 'SIGNATURE', label: 'Signature', content: {}, styles: {}, position: { x: 30, y: 685 }, size: { width: 150, height: 30 } },
          { type: 'STAMP', label: 'Stamp', content: {}, styles: {}, position: { x: 450, y: 680 }, size: { width: 60, height: 60 } },
          { type: 'FOOTER', label: 'Footer', content: { text: 'This is a computer-generated report' }, styles: { color: '#999' }, position: { x: 30, y: 780 }, size: { width: 535, height: 15 } },
          { type: 'PAGE_NUMBER', label: 'Page', content: {}, styles: { color: '#999' }, position: { x: 550, y: 780 }, size: { width: 30, height: 15 } },
        ],
      },
      CERTIFICATE: {
        pageSize: 'A4', orientation: 'landscape',
        components: [
          { type: 'WATERMARK', label: 'Watermark', content: { text: 'CERTIFICATE', color: '#1a365d', fontSize: 60 }, styles: { color: '#1a365d', opacity: 0.04 }, position: { x: 50, y: 150 }, size: { width: 500, height: 200 } },
          { type: 'HEADING', label: 'School Name', content: { text: 'School Name', fontSize: 24, color: '#1a365d' }, styles: { color: '#1a365d' }, position: { x: 150, y: 60 }, size: { width: 400, height: 30 } },
          { type: 'DIVIDER', label: 'Divider', content: {}, styles: { color: '#1a365d' }, position: { x: 200, y: 100 }, size: { width: 300, height: 1 } },
          { type: 'CUSTOM_TEXT', label: 'Certificate Title', content: { text: 'Certificate of Achievement', fontSize: 11, color: '#888' }, styles: { color: '#888' }, position: { x: 200, y: 110 }, size: { width: 300, height: 15 } },
          { type: 'AWARD_TEXT', label: 'Award Text', content: { text: 'This certificate is awarded to', fontSize: 14, color: '#666' }, styles: { color: '#666' }, position: { x: 200, y: 160 }, size: { width: 300, height: 20 } },
          { type: 'HEADING', label: 'Student Name', content: { text: 'Student Name', fontSize: 32, color: '#1a365d' }, styles: { color: '#1a365d' }, position: { x: 150, y: 190 }, size: { width: 400, height: 40 } },
          { type: 'CUSTOM_TEXT', label: 'Details', content: { text: 'Class: Grade 10A | Term 1 - 2024', fontSize: 12, color: '#777' }, styles: { color: '#777' }, position: { x: 200, y: 240 }, size: { width: 300, height: 15 } },
          { type: 'BADGE', label: 'Badge', content: {}, styles: { color: '#f59e0b' }, settings: { badgeStyle: 'star' }, position: { x: 335, y: 270 }, size: { width: 40, height: 40 } },
          { type: 'QR_CODE', label: 'QR Code', content: {}, styles: {}, position: { x: 560, y: 340 }, size: { width: 60, height: 60 } },
          { type: 'SIGNATURE', label: 'Sig 1', content: {}, styles: {}, position: { x: 100, y: 400 }, size: { width: 150, height: 30 } },
          { type: 'SIGNATURE', label: 'Sig 2', content: {}, styles: {}, position: { x: 350, y: 400 }, size: { width: 150, height: 30 } },
          { type: 'CUSTOM_TEXT', label: 'Cert Number', content: { text: 'Certificate No: XXXXXX', fontSize: 9, color: '#aaa' }, styles: { color: '#aaa' }, position: { x: 300, y: 450 }, size: { width: 150, height: 12 } },
        ],
      },
      TRANSCRIPT: {
        pageSize: 'A4', orientation: 'portrait',
        components: [
          { type: 'HEADER', label: 'Transcript Header', content: { text: 'OFFICIAL ACADEMIC TRANSCRIPT', fontSize: 16, color: '#1a365d' }, styles: { color: '#1a365d' }, position: { x: 30, y: 20 }, size: { width: 535, height: 25 } },
          { type: 'SCHOOL_NAME', label: 'School', content: { fontSize: 18 }, styles: { color: '#1a365d' }, position: { x: 30, y: 50 }, size: { width: 400, height: 22 } },
          { type: 'STUDENT_INFO', label: 'Student', content: { fontSize: 11 }, styles: { color: '#555' }, position: { x: 30, y: 80 }, size: { width: 400, height: 50 } },
          { type: 'RESULTS_TABLE', label: 'All Results', content: { showGrade: true, showPoints: true }, styles: { headerBg: '#1a365d', headerColor: '#ffffff' }, position: { x: 30, y: 150 }, size: { width: 535, height: 400 } },
          { type: 'SIGNATURE', label: 'Signature', content: {}, styles: {}, position: { x: 30, y: 600 }, size: { width: 150, height: 30 } },
          { type: 'STAMP', label: 'Stamp', content: {}, styles: {}, position: { x: 450, y: 595 }, size: { width: 60, height: 60 } },
        ],
      },
      PROGRESS_REPORT: {
        pageSize: 'A4', orientation: 'portrait',
        components: [
          { type: 'HEADER', label: 'Header', content: { text: 'PROGRESS REPORT', fontSize: 14, color: '#16a34a' }, styles: { color: '#16a34a' }, position: { x: 30, y: 20 }, size: { width: 535, height: 25 } },
          { type: 'STUDENT_PROFILE_CARD', label: 'Profile', content: {}, styles: {}, position: { x: 30, y: 55 }, size: { width: 535, height: 80 } },
          { type: 'RESULTS_TABLE', label: 'Subjects', content: { showGrade: true, showRemarks: true }, styles: { headerBg: '#16a34a', headerColor: '#ffffff' }, position: { x: 30, y: 150 }, size: { width: 535, height: 250 } },
          { type: 'LINE_CHART', label: 'Trend', content: {}, styles: {}, position: { x: 30, y: 410 }, size: { width: 250, height: 150 } },
          { type: 'STRENGTHS_WEAKNESSES', label: 'Strengths', content: { text: '' }, styles: {}, position: { x: 300, y: 410 }, size: { width: 265, height: 150 } },
          { type: 'RECOMMENDATIONS', label: 'Recommendations', content: { text: '' }, styles: { color: '#555' }, position: { x: 30, y: 570 }, size: { width: 535, height: 80 } },
          { type: 'TEACHER_REMARKS', label: 'Teacher Remarks', content: { text: '' }, styles: { color: '#555', bgColor: '#f0fdf4' }, position: { x: 30, y: 660 }, size: { width: 535, height: 50 } },
          { type: 'SIGNATURE', label: 'Signature', content: {}, styles: {}, position: { x: 30, y: 730 }, size: { width: 150, height: 30 } },
        ],
      },
    };

    const preset = layoutPresets[templateType] || layoutPresets.REPORT_CARD;
    if (preferences?.colorScheme === 'dark') {
      preset.components = preset.components.map((c: any) => ({
        ...c,
        styles: { ...c.styles, bgColor: '#1e293b', color: '#e2e8f0' },
        content: { ...c.content, color: '#e2e8f0' },
      }));
    }

    return preset;
  }

  async suggestTemplateFromStudentData(studentId: string, schoolId: string): Promise<any> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, include: { results: { take: 10, orderBy: { createdAt: 'desc' } } } });
    if (!student) return null;

    const avgScore = student.results.length > 0 ? student.results.reduce((s, r) => s + r.score, 0) / student.results.length : 0;
    const templateType = avgScore > 75 ? 'CERTIFICATE' : avgScore > 50 ? 'REPORT_CARD' : 'PROGRESS_REPORT';
    const includeCharts = student.results.length > 3;
    const colorScheme = avgScore > 75 ? '#16a34a' : avgScore > 50 ? '#2563eb' : '#dc2626';

    return {
      templateType,
      preferences: { includeCharts, style: 'modern', colorScheme },
      suggestion: `Based on ${student.firstName}'s average of ${avgScore.toFixed(1)}%, a ${templateType.toLowerCase().replace('_', ' ')} template is recommended`,
    };
  }

  async getAITemplateSuggestions() {
    return [
      { id: 'minimal-report', title: 'Minimal Report Card', description: 'Clean, modern report card with minimal design', type: 'REPORT_CARD', preview: '📋', popularity: 95 },
      { id: 'premium-cert', title: 'Premium Certificate', description: 'Gold-accented certificate with ornate borders', type: 'CERTIFICATE', preview: '📜', popularity: 88 },
      { id: 'analytics-dash', title: 'Analytics Dashboard Report', description: 'Data-rich report with charts, heatmaps, trends', type: 'SCHOOL_PERFORMANCE', preview: '📊', popularity: 82 },
      { id: 'progress-tracker', title: 'Student Progress Tracker', description: 'Progress report with trends and recommendations', type: 'PROGRESS_REPORT', preview: '📈', popularity: 79 },
      { id: 'transcript-official', title: 'Official Transcript', description: 'Formal academic transcript with seals', type: 'TRANSCRIPT', preview: '🎓', popularity: 91 },
      { id: 'attendance-summary', title: 'Attendance Summary', description: 'Visual attendance report with charts', type: 'ATTENDANCE_REPORT', preview: '✅', popularity: 75 },
      { id: 'merit-cert', title: 'Merit Award Certificate', description: 'Achievement certificate with badge', type: 'CERTIFICATE', preview: '⭐', popularity: 86 },
    ];
  }

  async saveSuggestion(schoolId: string, prompt: string, result: any, templateType?: string) {
    return this.prisma.aITemplateSuggestion.create({
      data: { schoolId, prompt, result: result as any, templateType },
    });
  }
}
