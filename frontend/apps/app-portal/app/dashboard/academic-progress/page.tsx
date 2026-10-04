'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { academicYearApi, classApi, progressApi, studentApi, subjectApi, termApi } from '@/lib/api';

type Tab = 'student' | 'class' | 'teacher';

function format(value: number | null | undefined) {
  return value === null || value === undefined ? 'Insufficient data' : `${value.toFixed(1)}%`;
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
  const [subjectId, setSubjectId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');

  const { data: students } = useQuery({ queryKey: ['progress-students'], queryFn: () => studentApi.getAll({ limit: 200 }).then(r => r.data?.data || r.data || []) });
  const { data: classes } = useQuery({ queryKey: ['progress-classes'], queryFn: () => classApi.getAll().then(r => r.data?.data || r.data || []) });
  const { data: subjects } = useQuery({ queryKey: ['progress-subjects'], queryFn: () => subjectApi.getAll().then(r => r.data?.data || r.data || []) });
  const { data: years } = useQuery({ queryKey: ['progress-years'], queryFn: () => academicYearApi.getAll().then(r => r.data?.data || r.data || []) });
  const { data: terms } = useQuery({ queryKey: ['progress-terms'], queryFn: () => termApi.getAll().then(r => r.data?.data || r.data || []) });
  const filters = Object.fromEntries(Object.entries({ academicYearId, termId, subjectId }).filter(([, value]) => value));
  const studentQuery = useQuery({ queryKey: ['progress-student', studentId, filters], queryFn: () => progressApi.student(studentId, filters).then(r => r.data?.data || r.data), enabled: tab === 'student' && !!studentId });
  const classQuery = useQuery({ queryKey: ['progress-class', classId, filters], queryFn: () => progressApi.class(classId, filters).then(r => r.data?.data || r.data), enabled: tab !== 'student' && !!classId });
  const studentName = (student: any) => `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || student.admissionNumber;

  return (
    <main className="space-y-6 pb-12">
      <header className="rounded-2xl bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-900 p-7 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">Longitudinal academic memory</p><h1 className="mt-2 text-3xl font-bold">Academic Progress</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Explore verified academic evidence across years, terms, classes and subjects. Progress analytics are separate from marksheet entry.</p></div><div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-right"><p className="text-xs text-violet-200">Data source</p><p className="mt-1 text-sm font-semibold">Verified results & assessments</p></div></div>
      </header>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {([['student', 'Student Progress'], ['class', 'Class Progress'], ['teacher', 'Teacher Subject Progress']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-violet-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
      </div>

      <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        {tab === 'student' ? <label className="text-xs font-semibold text-slate-600">Student<select value={studentId} onChange={e => setStudentId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Select student</option>{students?.map((student: any) => <option key={student.id} value={student.id}>{studentName(student)} · {student.admissionNumber}</option>)}</select></label> : <label className="text-xs font-semibold text-slate-600">Class<select value={classId} onChange={e => setClassId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Select class</option>{classes?.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className="text-xs font-semibold text-slate-600">Academic year<select value={academicYearId} onChange={e => setAcademicYearId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All years</option>{years?.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Term<select value={termId} onChange={e => setTermId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All terms</option>{terms?.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Subject<select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All subjects</option>{subjects?.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="flex items-end"><button className="w-full rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50" onClick={() => { setAcademicYearId(''); setTermId(''); setSubjectId(''); }}>Clear filters</button></div>
      </section>

      {tab === 'student' && <StudentView data={studentQuery.data} loading={studentQuery.isLoading} studentId={studentId} />}
      {tab !== 'student' && <ClassView data={classQuery.data} loading={classQuery.isLoading} teacherMode={tab === 'teacher'} />}
    </main>
  );
}

function StudentView({ data, loading, studentId }: { data: any; loading: boolean; studentId: string }) {
  if (!data && !loading) return <EmptyState title="Select a student" text="Choose a learner to view their complete academic journey." />;
  if (loading) return <LoadingState />;
  const points = (data.timeline || []).map((item: any) => ({ label: `${item.academicYear || ''} ${item.term || ''}`, value: item.averagePercentage }));
  const downloadReport = async () => { const response = await progressApi.studentReportPdf(studentId); const url = URL.createObjectURL(response.data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `progress-report-${studentId.slice(0, 8)}.pdf`; anchor.click(); URL.revokeObjectURL(url); };
  return <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-xl font-bold text-violet-700">{data.student.name.split(' ').map((part: string) => part[0]).slice(0, 2).join('')}</div><div><h2 className="text-xl font-bold text-slate-900">{data.student.name}</h2><p className="text-sm text-slate-500">{data.student.admissionNumber} · {data.student.className || 'Class not recorded'} · {data.student.grade || 'Grade not recorded'}</p></div><span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{data.student.status}</span></div><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Overall average" value={format(data.summary.average)} /><StatCard label="Median" value={format(data.summary.median)} tone="indigo" /><StatCard label="Trend" value={data.summary.trend.direction.replace('_', ' ')} tone="emerald" /><StatCard label="Evidence" value={`${data.evidence?.length || 0} records`} tone="amber" /></div></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Overall performance trend</h2><p className="text-sm text-slate-500">Term snapshots from verified academic evidence</p></div><button onClick={downloadReport} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">Generate Progress Report</button></div><TrendLine points={points} /></section><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Subject trajectories</h2><div className="mt-4 space-y-4">{data.subjectTrends?.map((item: any) => <div key={item.subject?.id}><div className="flex justify-between text-sm"><span className="font-semibold text-slate-700">{item.subject?.name || 'Subject'}</span><span className="font-semibold text-violet-700">{item.trend.direction.replace('_', ' ')}</span></div><TrendLine points={item.points.map((point: any) => ({ label: `${point.academicYear} ${point.term}`, value: point.percentage }))} /></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Academic journey</h2><div className="mt-4 space-y-3">{data.student.enrollments?.map((item: any, index: number) => <div key={`${item.academicYear}-${index}`} className="flex items-center gap-3"><div className="h-3 w-3 rounded-full bg-violet-500" /><div><p className="font-semibold text-slate-800">{item.academicYear}</p><p className="text-sm text-slate-500">{item.class} · {item.status}</p></div></div>)}</div></section></div><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Assessment evidence</h2><p className="mb-4 text-sm text-slate-500">Only recorded, verified assessments are shown. Missing assessments are not treated as zero.</p><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Assessment</th><th className="px-3 py-2">Score</th><th className="px-3 py-2">Percentage</th><th className="px-3 py-2">Grade</th></tr></thead><tbody>{data.evidence?.slice(0, 100).map((item: any) => <tr key={item.id} className="border-b border-slate-100"><td className="px-3 py-2">{item.assessmentId || 'Assessment'}</td><td className="px-3 py-2">{item.score ?? 'Not assessed'} / {item.maxScore ?? '-'}</td><td className="px-3 py-2 font-semibold">{format(item.percentage)}</td><td className="px-3 py-2">{item.grade || '-'}</td></tr>)}</tbody></table></div></section></div>;
}

function ClassView({ data, loading, teacherMode }: { data: any; loading: boolean; teacherMode: boolean }) {
  if (!data && !loading) return <EmptyState title={teacherMode ? 'Select a class for teacher subject analysis' : 'Select a class'} text="Class-level statistics are calculated on the server from materialized snapshots." />;
  if (loading) return <LoadingState />;
  return <div className="space-y-5"><section className="grid grid-cols-2 gap-3 md:grid-cols-5"><StatCard label="Students" value={`${data.count || 0}`} /><StatCard label="Mean" value={format(data.statistics?.mean)} /><StatCard label="Median" value={format(data.statistics?.median)} tone="indigo" /><StatCard label="Pass rate" value={format(data.statistics?.passRate)} tone="emerald" /><StatCard label="Trend" value={data.trend?.direction?.replace('_', ' ') || 'Insufficient data'} tone="amber" /></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">{teacherMode ? 'Teacher subject progress' : 'Class progress'} </h2><p className="text-sm text-slate-500">Population-level statistics, not individual report cards</p></div><button className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">Generate Progress Report</button></div><div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Period</th><th className="px-3 py-2">Average</th><th className="px-3 py-2">Observed</th></tr></thead><tbody>{data.periods?.map((period: any) => <tr key={`${period.academicYear}-${period.term}`} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{period.academicYear} · {period.term}</td><td className="px-3 py-3">{format(period.average)}</td><td className="px-3 py-3 text-slate-500">{period.count}</td></tr>)}</tbody></table></div></section></div>;
}

function LoadingState() { return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Calculating verified progress analytics...</div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><h2 className="text-lg font-bold text-slate-800">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p></div>; }
