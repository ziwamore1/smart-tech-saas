const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  'A+': { text: '#059669', bg: '#d1fae5' }, 'A': { text: '#059669', bg: '#d1fae5' }, 'A-': { text: '#059669', bg: '#d1fae5' },
  'B+': { text: '#2563eb', bg: '#dbeafe' }, 'B': { text: '#2563eb', bg: '#dbeafe' }, 'B-': { text: '#2563eb', bg: '#dbeafe' },
  'C+': { text: '#d97706', bg: '#fef3c7' }, 'C': { text: '#d97706', bg: '#fef3c7' }, 'C-': { text: '#d97706', bg: '#fef3c7' },
  'D+': { text: '#dc2626', bg: '#fee2e2' }, 'D': { text: '#dc2626', bg: '#fee2e2' }, 'D-': { text: '#dc2626', bg: '#fee2e2' },
  'E': { text: '#dc2626', bg: '#fee2e2' }, 'F': { text: '#dc2626', bg: '#fee2e2' },
  '1': { text: '#059669', bg: '#d1fae5' }, '2': { text: '#2563eb', bg: '#dbeafe' },
  '3': { text: '#d97706', bg: '#fef3c7' }, '4': { text: '#dc2626', bg: '#fee2e2' }, '5': { text: '#dc2626', bg: '#fee2e2' },
};

function getGradeColor(grade?: string | null): { text: string; bg: string } {
  if (!grade) return { text: '#9ca3af', bg: '#f3f4f6' };
  return GRADE_COLORS[grade.trim()] || { text: '#9ca3af', bg: '#f3f4f6' };
}

function scoreColor(pct: number | null): string {
  if (pct == null) return '#9ca3af';
  if (pct >= 75) return '#059669';
  if (pct >= 50) return '#3b82f6';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}

function scoreBg(pct: number | null): string {
  if (pct == null) return '#f3f4f6';
  if (pct >= 75) return '#d1fae5';
  if (pct >= 50) return '#dbeafe';
  if (pct >= 40) return '#fef3c7';
  return '#fee2e2';
}

const REPORT_STYLES = `
  @page { margin: 15mm; size: A4 landscape; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif; color: #1f2937; background: white; padding: 24px; line-height: 1.4; }
  .report-header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #5f4b3a; }
  .school-name { font-size: 22px; font-weight: 700; color: #5f4b3a; text-transform: uppercase; letter-spacing: 1px; }
  .school-sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .report-title { font-size: 16px; font-weight: 600; color: #1f2937; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .report-meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; font-size: 13px; color: #374151; }
  .report-meta strong { color: #1f2937; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #5f4b3a; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #7a6b5a; }
  td { padding: 6px 10px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #faf7f4; }
  tr:hover { background: #f5efe8; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .pass { color: #059669; }
  .fail { color: #dc2626; }
  .warn { color: #d97706; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .summary-card { background: #faf7f4; border: 1px solid #e8ddd0; border-radius: 8px; padding: 12px 16px; text-align: center; }
  .summary-value { font-size: 24px; font-weight: 700; color: #5f4b3a; }
  .summary-label { font-size: 11px; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .grade-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
  .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig { text-align: center; flex: 1; }
  .sig-line { width: 180px; border-top: 1px solid #1f2937; margin: 40px auto 0; padding-top: 6px; font-size: 11px; color: #6b7280; }
  .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; }
  .print-btn { position: fixed; top: 16px; right: 16px; padding: 10px 20px; background: #5f4b3a; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .print-btn:hover { background: #4a3a2d; }
  @media print { .print-btn { display: none; } body { padding: 0; } }
  .section-title { font-size: 14px; font-weight: 600; color: #5f4b3a; margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e8ddd0; }
  .chart-bar { height: 20px; border-radius: 4px; transition: width 0.3s; }
`;

function openReport(html: string, title: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.document.title = title;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

export interface ReportStudent {
  firstName: string;
  lastName: string;
  admissionNumber?: string;
  gender?: string;
  results: { subject: string; score: number | null; grade?: string | null; remark?: string | null; maxScore?: number }[];
  average?: number | null;
  grade?: string | null;
  rank?: number | number;
  totalPoints?: number;
}

export interface ReportMeta {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  className: string;
  termName: string;
  academicYear?: string;
  examType: string;
  date?: string;
  classTeacher?: string;
  director?: string;
}

function buildReportShell(meta: ReportMeta, title: string, content: string, extraStyles?: string): string {
  const date = meta.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title} - ${meta.schoolName}</title>
<style>${REPORT_STYLES}${extraStyles || ''}</style>
</head>
<body>
<button class="print-btn" onclick="window.print()"><i class="fa fa-print"></i> Print / Save as PDF</button>
<div class="report-header">
  <div class="school-name">${meta.schoolName}</div>
  ${meta.schoolAddress ? `<div class="school-sub">${meta.schoolAddress}</div>` : ''}
  ${meta.schoolPhone || meta.schoolEmail ? `<div class="school-sub">${meta.schoolPhone || ''} ${meta.schoolEmail || ''}</div>` : ''}
  <div class="report-title">${title}</div>
</div>
<div class="report-meta">
  <span><strong>Class:</strong> ${meta.className}</span>
  <span><strong>Term:</strong> ${meta.termName}</span>
  ${meta.academicYear ? `<span><strong>Year:</strong> ${meta.academicYear}</span>` : ''}
  <span><strong>Exam:</strong> ${meta.examType}</span>
  <span><strong>Date:</strong> ${date}</span>
</div>
${content}
<div class="footer">Smart Tech SaaS - Results Management System | Confidential</div>
</body></html>`;
}

export function generateMarkScheduleReport(students: ReportStudent[], meta: ReportMeta): string {
  const subjects = students.length > 0 ? students[0].results.map(r => r.subject) : [];

  const subjectHeaders = subjects.map(s => `<th class="text-center">${s}</th>`).join('');

  const rows = students.map((s, i) => {
    const cells = s.results.map(r => {
      const pct = r.score;
      const gc = getGradeColor(r.grade);
      if (pct == null) return `<td class="text-center" style="background:#fffbeb"><span style="color:#d1d5db">-</span></td>`;
      const color = scoreColor(pct);
      return `<td class="text-center" style="background:${pct < 50 ? '#fef2f2' : 'transparent'}">
        <div style="font-weight:600;font-size:12px;color:${color}">${pct.toFixed(1)}%</div>
        <div style="font-size:10px;color:#6b7280">${r.grade || '-'}${r.remark ? ` (${r.remark})` : ''}</div>
      </td>`;
    }).join('');

    const avg = s.average ?? (s.results.filter(r => r.score != null).reduce((sum, r) => sum + (r.score || 0), 0) / (s.results.filter(r => r.score != null).length || 1));
    const avgColor = scoreColor(avg);
    const gradeColor = getGradeColor(s.grade);

    return `<tr>
      <td class="text-center" style="color:#6b7280;width:30px">${i + 1}</td>
      <td style="font-weight:600">${s.firstName} ${s.lastName}</td>
      <td style="color:#6b7280;font-size:11px">${s.admissionNumber || '-'}</td>
      <td class="text-center" style="color:#6b7280">${s.gender || '-'}</td>
      ${cells}
      <td class="text-center font-bold" style="color:${avgColor}">${avg != null ? avg.toFixed(1) + '%' : '-'}</td>
      <td class="text-center">
        <span class="grade-badge" style="background:${gradeColor.bg};color:${gradeColor.text}">${s.grade || '-'}</span>
      </td>
      <td class="text-center font-semibold">${s.rank || i + 1}</td>
    </tr>`;
  }).join('');

  const content = `
    <table>
      <thead><tr>
        <th class="text-center" style="width:30px">#</th>
        <th style="min-width:150px">Student Name</th>
        <th style="min-width:90px">Admission No.</th>
        <th class="text-center" style="width:50px">Gender</th>
        ${subjectHeaders}
        <th class="text-center" style="min-width:60px">Average</th>
        <th class="text-center" style="width:50px">Grade</th>
        <th class="text-center" style="width:40px">Rank</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="signatures">
      <div class="sig"><div class="sig-line">Class Teacher: ${meta.classTeacher || '________________'}</div></div>
      <div class="sig"><div class="sig-line">Head of Department</div></div>
      <div class="sig"><div class="sig-line">Director / Principal: ${meta.director || '________________'}</div></div>
    </div>`;

  return buildReportShell(meta, `Mark Schedule - ${meta.examType}`, content);
}

export interface AnalysisData {
  totalStudents: number;
  passRate: number;
  averagePercentage: number;
  distinctionRate: number;
  atRiskCount: number;
  gradeDistribution: Record<string, number>;
  subjectAnalysis: { subjectName: string; average: number; highest: number; lowest: number; passRate: number; distinctionRate: number }[];
  students: { firstName: string; lastName: string; admissionNumber?: string; percentage: number; grade?: string }[];
}

export function generateAnalysisReport(analysis: AnalysisData, meta: ReportMeta): string {
  const distEntries = Object.entries(analysis.gradeDistribution || {});
  const maxCount = Math.max(...distEntries.map(([, c]) => c as number), 1);

  const distRows = distEntries.map(([grade, count]) => {
    const gc = getGradeColor(grade);
    const pct = analysis.totalStudents > 0 ? ((count as number) / analysis.totalStudents * 100).toFixed(1) : '0.0';
    const barWidth = ((count as number) / maxCount * 100).toFixed(0);
    return `<tr>
      <td class="text-center font-bold" style="color:${gc.text};font-size:14px">${grade}</td>
      <td class="text-center font-semibold">${count}</td>
      <td class="text-center">${pct}%</td>
      <td><div class="chart-bar" style="width:${barWidth}%;background:${gc.text}"></div></td>
    </tr>`;
  }).join('');

  const subjectRows = (analysis.subjectAnalysis || []).map((s, i) => {
    const avgColor = scoreColor(s.average);
    return `<tr>
      <td style="font-weight:600">${s.subjectName}</td>
      <td class="text-center font-semibold" style="color:${avgColor}">${s.average.toFixed(1)}%</td>
      <td class="text-center pass">${s.highest.toFixed(1)}</td>
      <td class="text-center fail">${s.lowest.toFixed(1)}</td>
      <td class="text-center">
        <span class="grade-badge" style="background:${s.passRate >= 70 ? '#d1fae5' : s.passRate >= 40 ? '#fef3c7' : '#fee2e2'};color:${s.passRate >= 70 ? '#059669' : s.passRate >= 40 ? '#d97706' : '#dc2626'}">${s.passRate.toFixed(1)}%</span>
      </td>
      <td class="text-center"><span class="grade-badge" style="background:#f3e8ff;color:#7c3aed">${s.distinctionRate.toFixed(1)}%</span></td>
    </tr>`;
  }).join('');

  const atRiskRows = (analysis.students || []).filter(s => s.percentage < 40).sort((a, b) => a.percentage - b.percentage).slice(0, 25).map((s, i) => `<tr>
    <td class="text-center" style="color:#6b7280">${i + 1}</td>
    <td style="font-weight:600">${s.firstName} ${s.lastName}</td>
    <td style="color:#6b7280;font-size:11px">${s.admissionNumber || '-'}</td>
    <td class="text-center font-bold fail">${s.percentage.toFixed(1)}%</td>
    <td class="text-center"><span class="grade-badge" style="background:#fee2e2;color:#dc2626">${s.grade || '-'}</span></td>
  </tr>`).join('');

  const content = `
    <div class="summary-grid">
      <div class="summary-card"><div class="summary-value">${analysis.totalStudents}</div><div class="summary-label">Total Students</div></div>
      <div class="summary-card"><div class="summary-value pass">${analysis.passRate.toFixed(1)}%</div><div class="summary-label">Pass Rate</div></div>
      <div class="summary-card"><div class="summary-value" style="color:#ea6645">${analysis.averagePercentage.toFixed(1)}%</div><div class="summary-label">Class Average</div></div>
      <div class="summary-card"><div class="summary-value" style="color:#7c3aed">${analysis.distinctionRate.toFixed(1)}%</div><div class="summary-label">Distinction Rate</div></div>
      <div class="summary-card"><div class="summary-value fail">${analysis.atRiskCount}</div><div class="summary-label">At Risk Students</div></div>
    </div>

    <div class="section-title">Grade Distribution</div>
    <table style="max-width:500px;margin-bottom:20px">
      <thead><tr><th class="text-center">Grade</th><th class="text-center">Count</th><th class="text-center">%</th><th>Distribution</th></tr></thead>
      <tbody>${distRows}</tbody>
    </table>

    ${subjectRows ? `
    <div class="section-title">Subject Performance Breakdown</div>
    <table>
      <thead><tr><th>Subject</th><th class="text-center">Class Average</th><th class="text-center">Highest</th><th class="text-center">Lowest</th><th class="text-center">Pass Rate</th><th class="text-center">Distinction</th></tr></thead>
      <tbody>${subjectRows}</tbody>
    </table>` : ''}

    ${atRiskRows ? `
    <div class="section-title">At-Risk Students (Below 40%)</div>
    <table>
      <thead><tr><th class="text-center">#</th><th>Student Name</th><th>Admission No.</th><th class="text-center">Score</th><th class="text-center">Grade</th></tr></thead>
      <tbody>${atRiskRows}</tbody>
    </table>` : ''}`;

  return buildReportShell(meta, `Results Analysis - ${meta.examType}`, content);
}

export interface RankingStudent {
  firstName: string;
  lastName: string;
  admissionNumber?: string;
  gender?: string;
  average: number;
  grade?: string;
  rank: number;
  totalPoints?: number;
}

export function generateRankingReport(rankings: RankingStudent[], meta: ReportMeta, title?: string): string {
  const rows = rankings.map((s, i) => {
    const avgColor = scoreColor(s.average);
    const gc = getGradeColor(s.grade);
    return `<tr>
      <td class="text-center font-bold" style="font-size:14px;color:${i < 3 ? '#d97706' : '#6b7280'}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : s.rank}</td>
      <td style="font-weight:600">${s.firstName} ${s.lastName}</td>
      <td style="color:#6b7280;font-size:11px">${s.admissionNumber || '-'}</td>
      <td class="text-center" style="color:#6b7280">${s.gender || '-'}</td>
      <td class="text-center font-bold" style="color:${avgColor}">${s.average.toFixed(1)}%</td>
      <td class="text-center"><span class="grade-badge" style="background:${gc.bg};color:${gc.text}">${s.grade || '-'}</span></td>
      <td class="text-center font-bold" style="color:${i < 3 ? '#d97706' : '#1f2937'}">${s.rank}</td>
      ${s.totalPoints != null ? `<td class="text-center font-semibold">${s.totalPoints}</td>` : ''}
    </tr>`;
  }).join('');

  const content = `
    <div class="summary-grid">
      <div class="summary-card"><div class="summary-value">${rankings.length}</div><div class="summary-label">Total Students</div></div>
      <div class="summary-card"><div class="summary-value">${rankings.length > 0 ? rankings[0].average.toFixed(1) + '%' : '-'}</div><div class="summary-label">Top Score</div></div>
      <div class="summary-card"><div class="summary-value">${rankings.length > 0 ? (rankings.reduce((sum, s) => sum + s.average, 0) / rankings.length).toFixed(1) + '%' : '-'}</div><div class="summary-label">Class Average</div></div>
    </div>
    <table>
      <thead><tr>
        <th class="text-center" style="width:50px">Rank</th>
        <th style="min-width:150px">Student Name</th>
        <th style="min-width:90px">Admission No.</th>
        <th class="text-center" style="width:50px">Gender</th>
        <th class="text-center" style="min-width:70px">Average</th>
        <th class="text-center" style="width:50px">Grade</th>
        <th class="text-center" style="width:40px">#</th>
        ${rankings[0]?.totalPoints != null ? '<th class="text-center" style="width:60px">Points</th>' : ''}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return buildReportShell(meta, title || `Class Rankings - ${meta.examType}`, content);
}

export function openMarkScheduleReport(students: ReportStudent[], meta: ReportMeta) {
  openReport(generateMarkScheduleReport(students, meta), `Mark Schedule - ${meta.className}`);
}

export function openAnalysisReport(analysis: AnalysisData, meta: ReportMeta) {
  openReport(generateAnalysisReport(analysis, meta), `Analysis - ${meta.className}`);
}

export function openRankingReport(rankings: RankingStudent[], meta: ReportMeta, title?: string) {
  openReport(generateRankingReport(rankings, meta, title), `Rankings - ${meta.className}`);
}
