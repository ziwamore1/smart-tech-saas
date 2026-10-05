'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { academicYearApi, classApi, progressApi, studentApi, subjectApi, termApi, teacherApi, teachingAssignmentApi } from '@/lib/api';

type Tab = 'student' | 'class' | 'teacher';

function format(value: number | null | undefined) {
  return value === null || value === undefined ? 'Insufficient data' : `${value.toFixed(1)}%`;
}

async function downloadPdf(request: Promise<any>, fileName: string) {
  const response = await request;
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TrendLine({ points }: { points: Array<{ label: string; value: number | null }> }) {
  const valid = points.filter(point => typeof point.value === 'number');
  if (valid.length < 2) return <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">Insufficient data for a trend.</div>;
  const width = 760;
  const height = 220;
  const x = (index: number) => 30 + (index * (width - 60)) / Math.max(1, points.length - 1);
  const y = (value: number) => height - 25 - (Math.max(0, Math.min(100, value)) / 100) * (height - 45);
  const path = points.map((point, index) => typeof point.value === 'number' ? `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}` : '').filter(Boolean).join(' ');
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[640px] w-full" role="img" aria-label="Academic performance trend">
        {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1="30" x2={width - 30} y1={y(value)} y2={y(value)} stroke="#e2e8f0" /><text x="2" y={y(value) + 4} fontSize="11" fill="#64748b">{value}</text></g>)}
        <path d={path} fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => typeof point.value === 'number' && <g key={`${point.label}-${index}`}><circle cx={x(index)} cy={y(point.value)} r="5" fill="#fff" stroke="#7c3aed" strokeWidth="3" /><text x={x(index)} y={height - 5} textAnchor="middle" fontSize="10" fill="#64748b">{point.label}</text></g>)}
      </svg>
    </div>
  );
}

function StatCard({ label, value, tone = 'violet' }: { label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    violet: 'border-violet-100 bg-violet-50 text-violet-600 text-violet-950',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-600 text-indigo-950',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-600 text-emerald-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-600 text-amber-950',
  };
  const [borderBackground, labelColor, valueColor] = (tones[tone] || tones.violet).split(' ');
  return <div className={`rounded-xl border p-4 ${borderBackground} ${labelColor} ${valueColor}`}><p className="text-xs font-semibold uppercase tracking-wide">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}

export default function AcademicProgressPage() {
  const [tab, setTab] = useState<Tab>('student');
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [backfillState, setBackfillState] = useState<string | null>(null);

  const { data: students } = useQuery({ queryKey: ['progress-students'], queryFn: () => studentApi.getAll({ limit: 200 }).then(r => r.data?.data || r.data || []) });
  const { data: classes } = useQuery({ queryKey: ['progress-classes'], queryFn: () => classApi.getAll().then(r => r.data?.data || r.data || []) });
  const { data: subjects } = useQuery({ queryKey: ['progress-subjects'], queryFn: () => subjectApi.getAll().then(r => r.data?.data || r.data || []) });
  const { data: years } = useQuery({ queryKey: ['progress-years'], queryFn: () => academicYearApi.getAll().then(r => r.data?.data || r.data || []) });
  const { data: terms } = useQuery({ queryKey: ['progress-terms'], queryFn: () => termApi.getAll().then(r => r.data?.data || r.data || []) });
  const { data: teachers } = useQuery({ queryKey: ['progress-teachers'], queryFn: () => teacherApi.getAll({ limit: 200 }).then(r => r.data?.data || r.data || []) });
  const { data: teacherAssignments = [] } = useQuery({ queryKey: ['progress-teacher-assignments', teacherId], queryFn: () => teachingAssignmentApi.getByTeacher(teacherId).then(r => r.data?.data || r.data || []), enabled: tab === 'teacher' && !!teacherId });
  const assignedSubjects = [...new Map((teacherAssignments as any[]).map(item => [item.subjectId, item.subject])).values()];
  const assignedClasses = [...new Map((teacherAssignments as any[]).filter(item => !subjectId || item.subjectId === subjectId).map(item => [item.classId, item.class])).values()];
  const filters = Object.fromEntries(Object.entries({ academicYearId, termId, subjectId }).filter(([, value]) => value));
  const teacherFilters = Object.fromEntries(Object.entries({ academicYearId, termId, subjectId, classId }).filter(([, value]) => value));
  useEffect(() => {
    if (tab !== 'teacher') return;
    if (subjectId && assignedSubjects.some((item: any) => item?.id === subjectId)) return;
    setSubjectId(assignedSubjects[0]?.id || '');
  }, [tab, teacherId, teacherAssignments, subjectId]);
  useEffect(() => {
    if (tab !== 'teacher' || !subjectId) {
      if (classId) setClassId('');
      return;
    }
    if (!assignedClasses.some((item: any) => item?.id === classId)) setClassId(assignedClasses[0]?.id || '');
  }, [tab, subjectId, classId, assignedClasses]);
  const studentQuery = useQuery({ queryKey: ['progress-student', studentId, filters], queryFn: () => progressApi.student(studentId, filters).then(r => r.data?.data || r.data), enabled: tab === 'student' && !!studentId });
  const classQuery = useQuery({ queryKey: ['progress-class', classId, filters], queryFn: () => progressApi.class(classId, filters).then(r => r.data?.data || r.data), enabled: tab === 'class' && !!classId });
  const teacherSubjectQuery = useQuery({ queryKey: ['progress-teacher-subject', teacherId, subjectId, teacherFilters], queryFn: () => progressApi.teacherSubject(teacherId, subjectId, teacherFilters).then(r => r.data?.data || r.data), enabled: tab === 'teacher' && !!teacherId && !!subjectId });
  const studentName = (student: any) => `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || student.admissionNumber;
  const teacherName = (teacher: any) => `${teacher.firstName || teacher.user?.firstName || ''} ${teacher.lastName || teacher.user?.lastName || ''}`.trim() || teacher.user?.email || teacher.email || teacher.employeeNo || 'Unnamed teacher';
  const runBackfill = async () => {
    setBackfillState('Backfill running...');
    try {
      const response = await progressApi.recalculateSchool();
      const result = response.data?.data || response.data;
      const poll = async (jobId: string): Promise<void> => {
        const statusResponse = await progressApi.backfillStatus(jobId);
        const status = statusResponse.data?.data || statusResponse.data;
        if (status?.status === 'COMPLETED') {
          setBackfillState(`Backfill complete: ${status.processed || 0} students, ${status.snapshots || 0} snapshots.`);
        } else if (status?.status === 'FAILED') {
          setBackfillState(status.errorMessage || 'Backfill failed.');
        } else {
          setBackfillState(`Backfill ${status?.status?.toLowerCase() || 'running'}: ${status?.processed || 0}/${status?.total || 0} students.`);
          window.setTimeout(() => { void poll(jobId); }, 2000);
        }
      };
      if (result?.id) await poll(result.id);
      else setBackfillState('Backfill could not be started.');
    } catch (error: any) {
      setBackfillState(error?.response?.data?.message || error?.message || 'Backfill failed. Check your permissions.');
    }
  };

  return (
    <main className="space-y-6 pb-12">
      <header className="rounded-2xl bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-900 p-7 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">Longitudinal academic memory</p><h1 className="mt-2 text-3xl font-bold">Academic Progress</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Explore verified academic evidence across years, terms, classes and subjects. Progress analytics are separate from marksheet entry.</p></div><div className="flex flex-col items-end gap-2"><div className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-right shadow-sm"><p className="text-xs font-semibold text-violet-700">Data source</p><p className="mt-1 text-sm font-semibold text-slate-900">Verified results &amp; assessments</p></div><button onClick={runBackfill} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-50">Backfill Progress Data</button>{backfillState && <p className="max-w-xs text-right text-xs text-violet-100">{backfillState}</p>}</div></div>
      </header>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {([['student', 'Student Progress'], ['class', 'Class Progress'], ['teacher', 'Teacher Subject Progress']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-violet-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
      </div>

       <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
         {tab === 'student' ? <label className="text-xs font-semibold text-slate-600">Student<select value={studentId} onChange={e => setStudentId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">Select student</option>{students?.map((student: any) => <option key={student.id} value={student.id}>{studentName(student)} · {student.admissionNumber}</option>)}</select></label> : tab === 'teacher' ? <label className="text-xs font-semibold text-slate-600">Teacher<select value={teacherId} onChange={e => { setTeacherId(e.target.value); setSubjectId(''); setClassId(''); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">Select teacher</option>{teachers?.map((teacher: any) => <option key={teacher.userId || teacher.id} value={teacher.userId || teacher.id}>{teacherName(teacher)}</option>)}</select></label> : <label className="text-xs font-semibold text-slate-600">Class<select value={classId} onChange={e => setClassId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">Select class</option>{classes?.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          {tab === 'teacher' && <label className="text-xs font-semibold text-slate-600">Class<select value={classId} onChange={e => setClassId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">Select one assigned class</option>{assignedClasses.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
         <label className="text-xs font-semibold text-slate-600">Academic year<select value={academicYearId} onChange={e => setAcademicYearId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">All years</option>{years?.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
         <label className="text-xs font-semibold text-slate-600">Term<select value={termId} onChange={e => setTermId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">All terms</option>{terms?.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Subject<select value={subjectId} onChange={e => { setSubjectId(e.target.value); if (tab === 'teacher') setClassId(''); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">{tab === 'teacher' ? 'Select assigned subject' : 'All subjects'}</option>{(tab === 'teacher' ? assignedSubjects : subjects)?.map((item: any) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ''}</option>)}</select></label>
        <div className="flex items-end"><button className="w-full rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50" onClick={() => { setAcademicYearId(''); setTermId(''); setSubjectId(''); }}>Clear filters</button></div>
      </section>

      {tab === 'student' && <StudentView data={studentQuery.data} loading={studentQuery.isLoading} studentId={studentId} />}
       {tab === 'class' && <ClassView data={classQuery.data} loading={classQuery.isLoading} teacherMode={false} classId={classId} filters={filters} />}
       {tab === 'teacher' && <TeacherSubjectView data={teacherSubjectQuery.data} loading={teacherSubjectQuery.isLoading} teacherId={teacherId} subjectId={subjectId} filters={teacherFilters} />}
    </main>
  );
}

function StudentView({ data, loading, studentId }: { data: any; loading: boolean; studentId: string }) {
  if (!data && !loading) return <EmptyState title="Select a student" text="Choose a learner to view their complete academic journey." />;
  if (loading) return <LoadingState />;
  const points = (data.timeline || []).map((item: any) => ({ label: `${item.academicYear || ''} ${item.term || ''}`, value: item.averagePercentage }));
  const reportRequest = () => progressApi.studentReportPdf(studentId);
  const downloadReport = () => downloadPdf(reportRequest(), `progress-report-${studentId.slice(0, 8)}.pdf`);
  return <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-xl font-bold text-violet-700">{data.student.name.split(' ').map((part: string) => part[0]).slice(0, 2).join('')}</div><div><h2 className="text-xl font-bold text-slate-900">{data.student.name}</h2><p className="text-sm text-slate-500">{data.student.admissionNumber} · {data.student.className || 'Class not recorded'} · {data.student.grade || 'Grade not recorded'}</p></div><span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{data.student.status}</span></div><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Overall average" value={format(data.summary.average)} /><StatCard label="Median" value={format(data.summary.median)} tone="indigo" /><StatCard label="Trend" value={data.summary.trend.direction.replace('_', ' ')} tone="emerald" /><StatCard label="Evidence" value={`${data.evidence?.length || 0} records`} tone="amber" /></div></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Overall performance trend</h2><p className="text-sm text-slate-500">Term snapshots from verified academic evidence</p></div><button onClick={downloadReport} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">Generate Progress Report</button></div><TrendLine points={points} /></section><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Subject trajectories</h2><div className="mt-4 space-y-4">{data.subjectTrends?.map((item: any) => <div key={item.subject?.id}><div className="flex justify-between text-sm"><span className="font-semibold text-slate-700">{item.subject?.name || 'Subject'}</span><span className="font-semibold text-violet-700">{item.trend.direction.replace('_', ' ')}</span></div><TrendLine points={item.points.map((point: any) => ({ label: `${point.academicYear} ${point.term}`, value: point.percentage }))} /></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Academic journey</h2><div className="mt-4 space-y-3">{data.student.enrollments?.map((item: any, index: number) => <div key={`${item.academicYear}-${index}`} className="flex items-center gap-3"><div className="h-3 w-3 rounded-full bg-violet-500" /><div><p className="font-semibold text-slate-800">{item.academicYear}</p><p className="text-sm text-slate-500">{item.class} · {item.status}</p></div></div>)}</div></section></div><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Assessment evidence</h2><p className="mb-4 text-sm text-slate-500">Only recorded, verified assessments are shown. Missing assessments are not treated as zero.</p><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Assessment</th><th className="px-3 py-2">Score</th><th className="px-3 py-2">Percentage</th><th className="px-3 py-2">Grade</th></tr></thead><tbody>{data.evidence?.slice(0, 100).map((item: any) => <tr key={item.id} className="border-b border-slate-100"><td className="px-3 py-2">{item.assessmentId || 'Assessment'}</td><td className="px-3 py-2">{item.score ?? 'Not assessed'} / {item.maxScore ?? '-'}</td><td className="px-3 py-2 font-semibold">{format(item.percentage)}</td><td className="px-3 py-2">{item.grade || '-'}</td></tr>)}</tbody></table></div></section></div>;
}

function ClassView({ data, loading, teacherMode, classId, filters }: { data: any; loading: boolean; teacherMode: boolean; classId: string; filters: Record<string, string> }) {
  if (!data && !loading) return <EmptyState title="Select a class" text="Class-level statistics are calculated on the server from materialized snapshots." />;
  if (loading) return <LoadingState />;
  const reportRequest = () => progressApi.classReportPdf(classId, filters);
  return <div className="space-y-5"><section className="grid grid-cols-2 gap-3 md:grid-cols-5"><StatCard label="Students" value={`${data.count || 0}`} /><StatCard label="Mean" value={format(data.statistics?.mean)} /><StatCard label="Median" value={format(data.statistics?.median)} tone="indigo" /><StatCard label="Pass rate" value={format(data.statistics?.passRate)} tone="emerald" /><StatCard label="Trend" value={data.trend?.direction?.replace('_', ' ') || 'Insufficient data'} tone="amber" /></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Class progress</h2><p className="text-sm text-slate-500">Population-level statistics, not individual report cards</p></div><ReportActions request={reportRequest} fileName={`class-progress-${classId.slice(0, 8)}.pdf`} /></div><div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Period</th><th className="px-3 py-2">Average</th><th className="px-3 py-2">Observed</th></tr></thead><tbody>{data.periods?.map((period: any) => <tr key={`${period.academicYear}-${period.term}`} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{period.academicYear} · {period.term}</td><td className="px-3 py-3">{format(period.average)}</td><td className="px-3 py-3 text-slate-500">{period.count}</td></tr>)}</tbody></table></div></section></div>;
}

function TeacherSubjectView({ data, loading, teacherId, subjectId, filters }: { data: any; loading: boolean; teacherId: string; subjectId: string; filters: Record<string, string> }) {
  if (!data && !loading) return <EmptyState title="Select a teacher and assigned subject" text="Progress is grouped by the teacher-subject assignment and remains tied to its historical class and academic year." />;
  if (loading) return <LoadingState />;
  const reportRequest = () => progressApi.teacherSubjectReportPdf(teacherId, subjectId, filters);
  return <div className="space-y-5"><section className="grid grid-cols-2 gap-3 md:grid-cols-5"><StatCard label="Students" value={`${data.count || 0}`} /><StatCard label="Mean" value={format(data.statistics?.mean)} /><StatCard label="Median" value={format(data.statistics?.median)} tone="indigo" /><StatCard label="Pass rate" value={format(data.statistics?.passRate)} tone="emerald" /><StatCard label="Trend" value={data.trend?.direction?.replace('_', ' ') || 'Insufficient data'} tone="amber" /></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Teacher subject progress</h2><p className="text-sm text-slate-500">Historical evidence for the selected teacher, subject, and class.</p></div><ReportActions request={reportRequest} fileName={`teacher-subject-progress-${subjectId.slice(0, 8)}.pdf`} disabled={!filters.classId} /></div><div className="mt-4 flex flex-wrap gap-2">{data.assignments?.filter((assignment: any) => !filters.classId || assignment.classId === filters.classId).map((assignment: any) => <span key={`${assignment.classId}-${assignment.academicYearId}`} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{assignment.class.name} · {assignment.academicYear.name}</span>)}</div><div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Period</th><th className="px-3 py-2">Average</th><th className="px-3 py-2">Assessed</th></tr></thead><tbody>{data.periods?.map((period: any) => <tr key={`${period.academicYear}-${period.term}`} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{period.academicYear} · {period.term}</td><td className="px-3 py-3">{format(period.average)}</td><td className="px-3 py-3 text-slate-500">{period.assessed}</td></tr>)}</tbody></table></div></section></div>;
}

function LoadingState() { return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Calculating verified progress analytics...</div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><h2 className="text-lg font-bold text-slate-800">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p></div>; }
function ReportActions({ request, fileName, disabled = false }: { request: () => Promise<any>; fileName: string; disabled?: boolean }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await request();
      const contentType = response.headers?.['content-type'] || response.headers?.get?.('content-type') || '';
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: contentType || 'application/pdf' });
      if (!contentType.includes('pdf') && blob.type && !blob.type.includes('pdf')) {
        const message = await blob.text();
        throw new Error(message || 'The server did not return a PDF report.');
      }
      setPdfUrl(URL.createObjectURL(blob));
    } catch (requestError: any) {
      const responseMessage = requestError?.response?.data?.message || requestError?.response?.data?.error;
      setError(responseMessage || requestError?.message || 'Unable to open the report.');
    } finally {
      setLoading(false);
    }
  };

  const closeReport = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  return <>
    <div className="flex flex-wrap items-center gap-2"><button onClick={() => void viewReport()} disabled={disabled || loading} className="rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50">{loading ? 'Loading...' : 'View Report'}</button><button onClick={() => void downloadPdf(request(), fileName)} disabled={disabled} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">Download Report</button>{error && <span className="text-xs font-semibold text-red-600">{error}</span>}</div>
    {pdfUrl && <div className="fixed inset-0 z-50 flex flex-col bg-slate-900"><div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3"><p className="text-sm font-semibold text-white">Progress Report</p><button onClick={closeReport} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600">Close</button></div><iframe src={pdfUrl} title="Progress report preview" className="h-full w-full bg-white" /></div>}
  </>;
}
