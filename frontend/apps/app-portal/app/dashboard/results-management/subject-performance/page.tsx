'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, classApi, classSubjectApi, termApi } from '@/lib/api';
import { EXAM_TYPE_OPTIONS, examTypeLabel } from '@/lib/exam-types';
import { openSubjectPerformanceReport, ReportMeta } from '@/lib/report-utils';

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response;

export default function SubjectPerformanceReportPage() {
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [examType, setExamType] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: classes = [] } = useQuery({ queryKey: ['subject-report-classes'], queryFn: async () => { const d = unwrap(await classApi.getAll()); return Array.isArray(d) ? d : []; } });
  const { data: terms = [] } = useQuery({ queryKey: ['subject-report-terms'], queryFn: async () => { const d = unwrap(await termApi.getAll()); return Array.isArray(d) ? d : []; } });
  const { data: classSubjects = [] } = useQuery({
    queryKey: ['subject-report-class-subjects', classId],
    queryFn: async () => { const d = unwrap(await classSubjectApi.getByClass(classId)); return Array.isArray(d) ? d : []; },
    enabled: !!classId,
  });
  const subjects = useMemo(() => classSubjects.map((row: any) => row.subject || row).filter((subject: any) => subject?.id), [classSubjects]);

  const loadReport = async () => {
    if (!classId || !termId || !subjectId) return;
    setLoading(true);
    try {
      const sheetsResponse = await api.get('/results-management/sheets', { params: { classId, termId, examType: examType || undefined } });
      const sheets = unwrap(sheetsResponse);
      const sheet = Array.isArray(sheets) ? sheets[0] : null;
      if (!sheet) throw new Error('No result sheet found for the selected class, term, and exam type.');
      const response = await api.get(`/results-management/sheets/${sheet.id}/top-performers`, { params: { category: 'SUBJECT_PERCENTAGE', subjectId, limit: 500 }, timeout: 120000 });
      const result = { ...unwrap(response), sheet };
      setReport(result);
      const meta: ReportMeta = {
        schoolName: 'Smart Tech School',
        className: selectedClass?.name || 'Class',
        termName: selectedTerm?.name || 'Term',
        academicYear: selectedTerm?.academicYear?.name || '',
        examType: examType ? examTypeLabel(examType) : 'Latest result sheet',
        department: result.department?.name || 'Department not assigned',
        subjectTeacher: result.assignedTeacher || 'Teacher not assigned',
      };
      openSubjectPerformanceReport(result, meta);
    } catch (error: any) {
      setReport({ error: error?.response?.data?.message || error?.message || 'Unable to load subject performance report' });
    } finally { setLoading(false); }
  };

  const selectedSubject = subjects.find((subject: any) => subject.id === subjectId);
  const selectedClass = classes.find((item: any) => item.id === classId);
  const selectedTerm = terms.find((item: any) => item.id === termId);
  const performers = report?.performers || [];

  return <main style={{ maxWidth: 1180, margin: '0 auto', padding: 24, color: '#1f2937' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
      <div><h1 style={{ margin: 0, fontSize: 26 }}>Subject-Based Performance Report</h1><p style={{ color: '#6b7280', marginTop: 6 }}>Review every learner&apos;s performance in one subject, ranked from highest to lowest.</p></div>
      {performers.length > 0 && <button onClick={() => openSubjectPerformanceReport(report, { schoolName: 'Smart Tech School', className: selectedClass?.name || 'Class', termName: selectedTerm?.name || 'Term', academicYear: selectedTerm?.academicYear?.name || '', examType: examType ? examTypeLabel(examType) : 'Latest result sheet', department: report?.department?.name || 'Department not assigned', subjectTeacher: report?.assignedTeacher || 'Teacher not assigned' })} style={{ background: '#0f766e', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}><i className="fa fa-print" /> Open HTML Report</button>}
    </div>
    <section className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, marginBottom: 24 }}>
      <label>Class<select value={classId} onChange={e => { setClassId(e.target.value); setSubjectId(''); setReport(null); }} style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, border: '1px solid #cbd5e1', borderRadius: 7 }}><option value="">Select class</option>{classes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Term<select value={termId} onChange={e => { setTermId(e.target.value); setReport(null); }} style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, border: '1px solid #cbd5e1', borderRadius: 7 }}><option value="">Select term</option>{terms.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Exam type<select value={examType} onChange={e => setExamType(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, border: '1px solid #cbd5e1', borderRadius: 7 }}><option value="">Latest result sheet</option>{EXAM_TYPE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Subject<select value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!classId} style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, border: '1px solid #cbd5e1', borderRadius: 7 }}><option value="">Select class subject</option>{subjects.map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}{subject.code ? ` (${subject.code})` : ''}</option>)}</select></label>
      <button className="no-print" onClick={loadReport} disabled={loading || !classId || !termId || !subjectId} style={{ alignSelf: 'end', padding: 11, border: 0, borderRadius: 7, background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: loading || !classId || !termId || !subjectId ? .5 : 1 }}>{loading ? 'Loading...' : 'Generate Report'}</button>
    </section>
    {report?.error && <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: 14 }}>{report.error}</div>}
    {performers.length > 0 && <section id="subject-performance-report"><div style={{ textAlign: 'center', marginBottom: 20 }}><h2 style={{ margin: 0 }}>Subject-Based Performance Report</h2><p style={{ margin: '6px 0', color: '#334155', fontWeight: 700 }}>Department: {report?.department?.name || 'Department not assigned'}</p><p style={{ margin: '6px 0', color: '#64748b' }}>{selectedClass?.name} · {selectedSubject?.name}{selectedSubject?.code ? ` (${selectedSubject.code})` : ''} · {selectedTerm?.name} · {examType ? examTypeLabel(examType) : 'Latest result sheet'}</p></div><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#0f172a', color: '#fff' }}>{['Rank', 'Student', 'Admission No.', 'Score', 'Grade'].map(label => <th key={label} style={{ padding: 11, textAlign: label === 'Student' ? 'left' : 'center' }}>{label}</th>)}</tr></thead><tbody>{performers.map((row: any, index: number) => <tr key={row.studentId || row.id || index} style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: 11, textAlign: 'center', fontWeight: 700 }}>{row.rank || index + 1}</td><td style={{ padding: 11 }}>{row.studentName || `${row.firstName || ''} ${row.lastName || ''}`.trim()}</td><td style={{ padding: 11, textAlign: 'center' }}>{row.admissionNumber || '-'}</td><td style={{ padding: 11, textAlign: 'center' }}>{Number(row.percentage ?? row.score ?? row.average ?? 0).toFixed(1)}%</td><td style={{ padding: 11, textAlign: 'center' }}>{row.grade || '-'}</td></tr>)}</tbody></table></section>}
    {!report && <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: 50 }}>Select a class, term, and class subject to generate the report.</p>}
    <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } #subject-performance-report { margin: 0; } }`}</style>
  </main>;
}
