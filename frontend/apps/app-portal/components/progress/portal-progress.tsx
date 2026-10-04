'use client';

import { useQuery } from '@tanstack/react-query';
import { progressApi } from '@/lib/api';

const percent = (value: number | null | undefined) => value == null ? 'Insufficient data' : `${value.toFixed(1)}%`;

export function PortalProgress({ studentId, parent = false }: { studentId?: string; parent?: boolean }) {
  const query = useQuery({
    queryKey: ['portal-progress', parent, studentId],
    queryFn: () => (parent ? progressApi.child(studentId || '') : progressApi.me()).then(response => response.data?.data || response.data),
    enabled: !parent || Boolean(studentId),
  });
  if (query.isLoading) return <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Loading longitudinal academic history...</div>;
  if (query.error || !query.data) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Academic progress is not available yet.</div>;
  const data = query.data;
  return <div className="space-y-5"><section className="rounded-2xl bg-gradient-to-br from-indigo-950 to-violet-900 p-6 text-white"><p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Longitudinal academic history</p><h1 className="mt-2 text-2xl font-bold">{data.student.name}</h1><p className="mt-1 text-sm text-indigo-200">{data.student.admissionNumber} · {data.student.className || 'Class not recorded'}</p><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><div><p className="text-xs text-indigo-200">Overall average</p><p className="text-xl font-bold">{percent(data.summary.average)}</p></div><div><p className="text-xs text-indigo-200">Median</p><p className="text-xl font-bold">{percent(data.summary.median)}</p></div><div><p className="text-xs text-indigo-200">Trend</p><p className="text-xl font-bold">{data.summary.trend.direction.replace('_', ' ')}</p></div><div><p className="text-xs text-indigo-200">Evidence</p><p className="text-xl font-bold">{data.evidence.length}</p></div></div></section><section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Academic journey</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{data.student.enrollments?.map((item: any, index: number) => <div key={`${item.academicYear}-${index}`} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">{item.academicYear}</p><p className="text-sm text-slate-500">{item.class} · {item.status}</p></div>)}</div></section><section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Subject progression</h2><p className="mt-1 text-sm text-slate-500">Only verified academic snapshots are included.</p><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Periods</th><th className="px-3 py-2">Trend</th></tr></thead><tbody>{data.subjectTrends?.map((item: any) => <tr key={item.subject?.id} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{item.subject?.name}</td><td className="px-3 py-3">{item.points?.map((point: any) => `${point.academicYear} ${point.term}: ${percent(point.percentage)}`).join(' · ')}</td><td className="px-3 py-3 font-semibold text-violet-700">{item.trend.direction.replace('_', ' ')}</td></tr>)}</tbody></table></div></section></div>;
}
