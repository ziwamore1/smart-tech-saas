'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';

type Props = { termId?: string; accent?: string };

export default function SchoolPerformanceOverview({ termId, accent = '#ea6645' }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['school-performance-overview', termId],
    queryFn: () => analyticsApi.getSchoolPerformanceOverview(termId).then((response) => response.data?.data || response.data),
    enabled: !!termId,
  });

  const classes = Array.isArray(data?.classes) ? data.classes : [];
  const history = Array.isArray(data?.history) ? data.history.filter((item: any) => item.average != null) : [];
  const rankedClasses = [...classes].sort((a: any, b: any) => (b.classAverage || 0) - (a.classAverage || 0));
  const maxAverage = Math.max(...rankedClasses.map((item: any) => Number(item.classAverage || 0)), 100);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Evidence-led overview</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">School performance</h2>
          <p className="mt-1 text-sm text-slate-500">Current class comparison and previous-term movement from published results.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
          {data?.term?.name || 'Select a term'}
        </span>
      </div>

      {isLoading && <div className="grid gap-3 md:grid-cols-2"><div className="h-36 animate-pulse rounded-xl bg-slate-100" /><div className="h-36 animate-pulse rounded-xl bg-slate-100" /></div>}
      {isError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Performance data is temporarily unavailable. No estimates are shown.</div>}
      {!isLoading && !isError && !classes.length && !history.length && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Published results will appear here once a term has been finalized.</div>
      )}

      {!isLoading && !isError && (classes.length > 0 || history.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Class averages</h3><span className="text-xs text-slate-400">{classes.length} classes with results</span></div>
            {classes.length ? <div className="space-y-3">{rankedClasses.slice(0, 8).map((item: any) => {
              const average = Number(item.classAverage || 0);
              return <div key={item.classId}><div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{item.className}</span><span className="font-bold text-slate-900">{average.toFixed(1)}% <span className="font-normal text-slate-400">· {Number(item.passRate || 0).toFixed(1)}% pass</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.min((average / maxAverage) * 100, 100)}%`, background: accent }} /></div></div>;
            })}</div> : <p className="text-sm text-slate-500">No class-level results are available for this term.</p>}
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Term movement</h3><span className="text-xs text-slate-400">Average score</span></div>
            {history.length ? <div className="flex h-40 items-end gap-2 border-b border-slate-200 px-1 pb-1">{history.map((item: any) => { const value = Number(item.average || 0); return <div key={item.termId} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${item.termName}: ${value.toFixed(1)}%`}><span className="text-[10px] font-bold text-slate-600">{value.toFixed(0)}%</span><div className="w-full max-w-10 rounded-t-md transition-all group-hover:opacity-80" style={{ height: `${Math.max((value / 100) * 112, 4)}px`, background: accent }} /><span className="max-w-14 truncate text-[10px] text-slate-400">{item.termName}</span></div>; })}</div> : <p className="text-sm text-slate-500">Previous-term comparisons will appear after results are published.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
