'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { academicYearApi, businessCalendarApi, staffPositionApi, termApi } from '@/lib/api';

const fmt = (value?: string) =>
  value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'TBC';
const toInput = (value?: string) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-CA');
};

const INPUT_CLS = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-200';
const LABEL_CLS = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500';
const BTN = 'inline-flex items-center justify-center rounded-lg bg-[#123047] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0d2637] disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_GHOST = 'inline-flex items-center justify-center rounded-lg border border-white/40 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed';

const STATUS_STYLE: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-700 ring-slate-200',
  SCHEDULED: 'bg-blue-100 text-blue-800 ring-blue-200',
  IN_PROGRESS: 'bg-sky-100 text-sky-800 ring-sky-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  PARTIALLY_COMPLETED: 'bg-amber-100 text-amber-800 ring-amber-200',
  DELAYED: 'bg-orange-100 text-orange-800 ring-orange-200',
  POSTPONED: 'bg-violet-100 text-violet-800 ring-violet-200',
  CANCELLED: 'bg-rose-100 text-rose-700 ring-rose-200',
  NOT_COMPLETED: 'bg-rose-100 text-rose-800 ring-rose-200',
  RESCHEDULED: 'bg-amber-100 text-amber-700 ring-amber-200',
};
const CAT_COLORS = [
  'bg-cyan-100 text-cyan-800 ring-cyan-200',
  'bg-indigo-100 text-indigo-800 ring-indigo-200',
  'bg-amber-100 text-amber-800 ring-amber-200',
  'bg-emerald-100 text-emerald-800 ring-emerald-200',
  'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200',
];
const categoryColor = (name?: string) => {
  const value = (name || 'Other').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return CAT_COLORS[value % CAT_COLORS.length];
};
const ALL_STATUSES = ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PARTIALLY_COMPLETED', 'DELAYED', 'POSTPONED', 'CANCELLED', 'NOT_COMPLETED', 'RESCHEDULED'] as const;

export default function BusinessCalendarPage() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [calendarId, setCalendarId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [showNewCalendar, setShowNewCalendar] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [importId, setImportId] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'OVERDUE'>('ALL');
  const [customCategory, setCustomCategory] = useState('');
  const [tab, setTab] = useState<'overview' | 'departments' | 'overdue' | 'upcoming' | 'goals'>('overview');
  const emptyForm = { title: '', startDate: '', endDate: '', startTime: '', categoryId: '', departmentId: '', venue: '', notes: '', status: 'PLANNED', completionPercentage: 0, target: '', targetUnit: '', expectedOutcome: '', actualOutcome: '', delayReason: '', failureReason: '', remarks: '' };
  const [form, setForm] = useState({ ...emptyForm });
  const emptyGoal = { title: '', description: '', targetPercentage: 90, category: 'OVERALL', departmentId: '', deadline: '' };
  const [goalForm, setGoalForm] = useState({ ...emptyGoal });

  const calendars = useQuery({ queryKey: ['business-calendar'], queryFn: () => businessCalendarApi.list().then((r) => r.data) });
  const id = calendarId || calendars.data?.[0]?.id || '';
  const current = calendars.data?.find((item: any) => item.id === id);
  const activities = useQuery({ queryKey: ['business-calendar', id], queryFn: () => businessCalendarApi.activities(id).then((r) => r.data), enabled: Boolean(id) });
  const analytics = useQuery({ queryKey: ['business-calendar-analytics', id], queryFn: () => businessCalendarApi.analytics(id).then((r) => r.data), enabled: Boolean(id) });
  const categories = useQuery({ queryKey: ['business-calendar-categories'], queryFn: () => businessCalendarApi.categories().then((r) => r.data) });
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => staffPositionApi.getDepartments().then((r) => r.data).catch(() => []) });
  const years = useQuery({ queryKey: ['academic-year'], queryFn: () => academicYearApi.getAll().then((r) => r.data) });
  const terms = useQuery({ queryKey: ['term'], queryFn: () => termApi.getAll().then((r) => r.data) });
  const goals = useQuery({ queryKey: ['business-calendar-goals', id], queryFn: () => businessCalendarApi.goals(id).then((r) => r.data), enabled: Boolean(id) });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['business-calendar', id] }); qc.invalidateQueries({ queryKey: ['business-calendar-analytics', id] }); qc.invalidateQueries({ queryKey: ['business-calendar-goals', id] }); };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm({ ...emptyForm }); };
  const closeGoalForm = () => { setShowGoalForm(false); setEditingGoal(null); setGoalForm({ ...emptyGoal }); };

  const create = useMutation({
    mutationFn: () => businessCalendarApi.createActivity(id, { ...form, endDate: form.endDate || form.startDate, allDay: !form.startTime, priority: 'NORMAL', target: form.target ? Number(form.target) : undefined, completionPercentage: Number(form.completionPercentage) }),
    onSuccess: () => { refresh(); closeForm(); },
  });
  const update = useMutation({
    mutationFn: () => businessCalendarApi.updateActivity(editing.id, { ...form, target: form.target ? Number(form.target) : null, completionPercentage: Number(form.completionPercentage) }),
    onSuccess: () => { refresh(); closeForm(); },
  });
  const createCategory = useMutation({
    mutationFn: () => businessCalendarApi.createCategory({ name: customCategory, calendarId: id }),
    onSuccess: (response) => { qc.invalidateQueries({ queryKey: ['business-calendar-categories'] }); setForm({ ...form, categoryId: response.data.id }); setCustomCategory(''); },
  });
  const remove = useMutation({ mutationFn: (activityId: string) => businessCalendarApi.deleteActivity(activityId), onSuccess: () => refresh() });
  const publish = useMutation({ mutationFn: () => (current?.status === 'PUBLISHED' ? businessCalendarApi.unpublish(id) : businessCalendarApi.publish(id)), onSuccess: () => qc.invalidateQueries({ queryKey: ['business-calendar'] }) });
  const validate = useMutation({ mutationFn: (file: File) => businessCalendarApi.validateImport(id, file, 'UPDATE_EXISTING'), onSuccess: (response) => { setImportId(response.data.id); setSummary(response.data); } });
  const commit = useMutation({ mutationFn: () => businessCalendarApi.commitImport(id, importId), onSuccess: () => { refresh(); setShowImport(false); setSummary(null); setImportId(''); } });
  const createCalendar = useMutation({ mutationFn: () => businessCalendarApi.create(calForm), onSuccess: () => { qc.invalidateQueries({ queryKey: ['business-calendar'] }); setShowNewCalendar(false); setCalForm({ name: '', academicYearId: '', termId: '', startDate: '', endDate: '', timezone: 'Africa/Lusaka' }); } });
  const [calForm, setCalForm] = useState({ name: '', academicYearId: '', termId: '', startDate: '', endDate: '', timezone: 'Africa/Lusaka' });
  const createGoal = useMutation({ mutationFn: () => businessCalendarApi.createGoal(id, { ...goalForm, targetPercentage: Number(goalForm.targetPercentage) }), onSuccess: () => { refresh(); closeGoalForm(); } });
  const updateGoal = useMutation({ mutationFn: () => businessCalendarApi.updateGoal(editingGoal.id, { ...goalForm, targetPercentage: Number(goalForm.targetPercentage) }), onSuccess: () => { refresh(); closeGoalForm(); } });
  const deleteGoal = useMutation({ mutationFn: (goalId: string) => businessCalendarApi.removeGoal(goalId), onSuccess: () => refresh() });

  const download = async (kind: 'template' | 'export' | 'analytics') => {
    if (!id) return;
    const response = kind === 'analytics' ? await businessCalendarApi.exportAnalyticsBlob(id) : kind === 'template' ? await businessCalendarApi.templateBlob(id) : await businessCalendarApi.exportBlob(id);
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `${current?.name || 'calendar'}-${kind === 'template' ? 'template' : kind === 'analytics' ? 'analytics' : 'export'}.xlsx`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };
  const downloadPdf = async () => { if (!id) return; try { const response = await businessCalendarApi.exportAnalyticsBlob(id); const url = URL.createObjectURL(response.data); window.open(`${businessCalendarApi.reportPdfViewUrl(id)}`, '_blank'); } catch { window.open(businessCalendarApi.reportPdfUrl(id), '_blank'); } };

  const rows = activities.data || [];
  const a = analytics.data;
  const visibleRows = statusFilter === 'ALL' ? rows : statusFilter === 'COMPLETED' ? rows.filter((r: any) => r.status === 'COMPLETED') : statusFilter === 'UPCOMING' ? (a?.upcoming?.today || []).concat(a?.upcoming?.within7 || [], a?.upcoming?.within14 || []) : (a?.overdue || []);

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ title: row.title, startDate: toInput(row.startDate), endDate: toInput(row.endDate), startTime: row.startTime || '', categoryId: row.departmentId || '', departmentId: row.departmentId || '', venue: row.venue || '', notes: row.notes || '', status: row.status || 'PLANNED', completionPercentage: row.completionPercentage || 0, target: row.target?.toString() || '', targetUnit: row.targetUnit || '', expectedOutcome: row.expectedOutcome || '', actualOutcome: row.actualOutcome || '', delayReason: row.delayReason || '', failureReason: row.failureReason || '', remarks: row.remarks || '' });
    setShowForm(true);
  };
  const openAddGoal = () => { setEditingGoal(null); setGoalForm({ ...emptyGoal }); setShowGoalForm(true); };
  const openEditGoal = (g: any) => { setEditingGoal(g); setGoalForm({ title: g.title, description: g.description || '', targetPercentage: g.targetPercentage, category: g.category || 'OVERALL', departmentId: g.departmentId || '', deadline: g.deadline ? toInput(g.deadline) : '' }); setShowGoalForm(true); };

  return (
    <main className="min-h-screen bg-[#f4f7f9] p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-[#123047] via-[#0e2f4a] to-[#123047] p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-200">Planning &middot; Monitoring &middot; Performance Intelligence</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">School Business Calendar Hub</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">The official live calendar for meetings, CPD, monitoring, assessments and deadlines. Track targets, measure performance and download intelligence reports.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN_GHOST} onClick={() => setShowNewCalendar(true)}>New calendar</button>
              <button type="button" className={BTN_GHOST} onClick={() => setShowImport(true)}>Import Excel</button>
              <button type="button" className={BTN_GHOST} onClick={() => download('template')} disabled={!id}>Blank template</button>
              <button type="button" className={BTN_GHOST} onClick={() => download('export')} disabled={!id}>Export current</button>
              <button type="button" className={BTN_GHOST} onClick={() => download('analytics')} disabled={!id}>Analytics Excel</button>
              <button type="button" className={BTN_GHOST} onClick={() => id && window.open(businessCalendarApi.reportHtmlUrl(id), '_blank')} disabled={!id}>Print sheet</button>
              <button type="button" className={BTN_GHOST} onClick={() => id && window.open(businessCalendarApi.reportPdfViewUrl(id), '_blank')} disabled={!id}>View PDF</button>
              <button type="button" className={BTN_GHOST} onClick={() => downloadPdf()} disabled={!id}>Download PDF</button>
              <button type="button" className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-[#123047] shadow-md transition hover:bg-cyan-200" onClick={openAdd}>Add activity</button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric label="Total" value={a?.metrics?.total ?? rows.length} color="text-cyan-700" />
          <Metric label="Completed" value={a?.metrics?.completed ?? rows.filter((r: any) => r.status === 'COMPLETED').length} color="text-emerald-700" />
          <Metric label="In Progress" value={a?.metrics?.inProgress ?? 0} color="text-sky-700" />
          <Metric label="Overdue" value={a?.metrics?.overdue ?? 0} color="text-rose-700" />
          <Metric label="Completion Rate" value={`${a?.metrics?.completionRate ?? 0}%`} color="text-indigo-700" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-cyan-700">Intelligence dashboard</p>
              <h2 className="mt-1 text-xl font-black text-[#123047]">{current?.name || 'Select a calendar'}</h2>
              <p className="text-sm text-slate-500">{current?.academicYear?.name || ''}{current?.term?.name ? ` · ${current.term.name}` : ''} · Version {current?.version || '-'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-slate-300 p-1 text-sm">
                {(['ALL', 'UPCOMING', 'COMPLETED', 'OVERDUE'] as const).map((f) => <button key={f} onClick={() => setStatusFilter(f)} className={`rounded px-3 py-1.5 font-semibold ${statusFilter === f ? 'bg-[#123047] text-white' : 'text-slate-600'}`}>{f === 'ALL' ? 'All' : f === 'UPCOMING' ? 'Due Soon' : f}</button>)}
              </div>
              <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200" value={id} onChange={(e) => setCalendarId(e.target.value)}>
                <option value="">Choose calendar</option>
                {(calendars.data || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {id && <button onClick={() => publish.mutate()} className="rounded-lg bg-[#123047] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#0d2637]" disabled={publish.isPending}>{current?.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</button>}
            </div>
          </div>

          <div className="flex gap-2 border-b border-slate-100 px-5 pt-4">
            {([['overview', 'Overview'], ['departments', 'Departments'], ['overdue', 'Overdue'], ['upcoming', 'Due Soon'], ['goals', 'Goals']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key as any)} className={`rounded-t-lg px-4 py-2 text-sm font-bold ${tab === key ? 'bg-[#123047] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
          </div>

          {tab === 'overview' && (
            <div className="p-5 space-y-5">
              {a?.aiInsights?.length ? (
                <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-4 space-y-2">
                  {a.aiInsights.map((ins: string, i: number) => <p key={i} className="text-sm text-slate-700">{ins}</p>)}
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-4">
                <MiniMetric label="On-Time Rate" value={`${a?.metrics?.onTimeCompletionRate ?? 0}%`} />
                <MiniMetric label="Target Achievement" value={`${a?.metrics?.targetAchievementRate ?? '—'}%`} />
                <MiniMetric label="Weighted Score" value={`${a?.metrics?.weightedCompletionScore ?? 0}%`} />
                <MiniMetric label="Avg Completion" value={`${a?.metrics?.averageCompletionPercentage ?? 0}%`} />
                <MiniMetric label="Due Today" value={String(a?.metrics?.dueToday ?? 0)} />
                <MiniMetric label="Due ≤7 days" value={String(a?.metrics?.dueSoon7 ?? 0)} />
                <MiniMetric label="Due ≤14 days" value={String(a?.metrics?.dueSoon14 ?? 0)} />
                <MiniMetric label="Partial / Failure" value={`${a?.metrics?.partialCompletionRate ?? 0}% / ${a?.metrics?.failureRate ?? 0}%`} />
              </div>
              {a?.statusBreakdown ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Status Distribution</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(a.statusBreakdown).filter(([, count]) => (count as number) > 0).map(([status, count]) => <span key={status} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{status.replace(/_/g, ' ')}<span className="text-[10px] opacity-70">({count as number})</span></span>)}
                  </div>
                </div>
              ) : null}
              {a?.aiRecommendations?.length ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700">AI Recommendations</h3>
                  {a.aiRecommendations.map((rec: string, i: number) => <p key={i} className="text-sm text-slate-700">{rec}</p>)}
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead><tr className="bg-gradient-to-r from-[#123047] to-[#0e7490] text-[10px] uppercase tracking-wider text-white"><th className="px-3 py-2">#</th><th className="px-3 py-2">Activity</th><th className="px-3 py-2">Dept</th><th className="px-3 py-2">Dates</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-center">%</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Outcome</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {(visibleRows.length ? visibleRows : rows.slice(0, 15)).map((row: any, i: number) => (
                      <tr key={row.id} className="odd:bg-white even:bg-slate-50/60 hover:bg-cyan-50/50 transition cursor-pointer" onClick={() => openEdit(row)}>
                        <td className="px-3 py-2 text-center font-black text-slate-400">{String(i + 1).padStart(2, '0')}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">{row.title}</td>
                        <td className="px-3 py-2">{row.department?.name ? <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${categoryColor(row.department.name)}`}>{row.department.name}</span> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-2 text-slate-600">{fmt(row.startDate)} → {fmt(row.endDate)}</td>
                        <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLE[row.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{row.status?.replace(/_/g, ' ') || 'PLANNED'}</span></td>
                        <td className="px-3 py-2 text-center font-black">{row.completionPercentage ?? 0}%</td>
                        <td className="px-3 py-2 text-slate-600">{row.target ? `${row.target} ${row.targetUnit || ''}` : '—'}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{row.actualOutcome || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!rows.length && <p className="p-8 text-center text-sm text-slate-500">No activities yet. Add one or import the official workbook.</p>}
              </div>
            </div>
          )}

          {tab === 'departments' && (
            <div className="p-5 space-y-5">
              {a?.departments?.length ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead><tr className="bg-gradient-to-r from-[#123047] to-[#0e7490] text-[10px] uppercase tracking-wider text-white"><th className="px-3 py-2">#</th><th className="px-3 py-2">Department</th><th className="px-3 py-2 text-center">Planned</th><th className="px-3 py-2 text-center">Completed</th><th className="px-3 py-2 text-center">Rate</th><th className="px-3 py-2 text-center">Delayed</th><th className="px-3 py-2 text-center">Not Done</th><th className="px-3 py-2 text-center">Overdue</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {a.departments.map((d: any, i: number) => <tr key={d.departmentId || i} className="odd:bg-white even:bg-slate-50/60"><td className="px-3 py-2 text-center font-black text-slate-400">{i + 1}</td><td className="px-3 py-2 font-bold text-slate-800">{d.departmentName}</td><td className="px-3 py-2 text-center">{d.planned}</td><td className="px-3 py-2 text-center">{d.completed}</td><td className="px-3 py-2 text-center font-bold">{d.completionRate}%</td><td className="px-3 py-2 text-center text-orange-700">{d.delayed}</td><td className="px-3 py-2 text-center text-rose-700">{d.notCompleted}</td><td className="px-3 py-2 text-center text-rose-700">{d.overdue}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              ) : <p className="p-8 text-center text-sm text-slate-500">No departmental data available.</p>}
            </div>
          )}

          {tab === 'overdue' && (
            <div className="p-5">
              {a?.overdue?.length ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead><tr className="bg-gradient-to-r from-[#123047] to-[#0e7490] text-[10px] uppercase tracking-wider text-white"><th className="px-3 py-2">#</th><th className="px-3 py-2">Activity</th><th className="px-3 py-2">Dept</th><th className="px-3 py-2">Officer</th><th className="px-3 py-2">Due</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">%</th><th className="px-3 py-2">Days</th><th className="px-3 py-2">Action</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {a.overdue.map((r: any, i: number) => <tr key={r.id} className="odd:bg-white even:bg-rose-50/30 hover:bg-rose-50/60 transition cursor-pointer" onClick={() => openEdit(rows.find((row: any) => row.id === r.id) || r)}><td className="px-3 py-2 text-center font-black text-slate-400">{i + 1}</td><td className="px-3 py-2 font-bold text-slate-800">{r.title}</td><td className="px-3 py-2">{r.departmentName || '—'}</td><td className="px-3 py-2">{r.officerName || '—'}</td><td className="px-3 py-2">{fmt(r.plannedDate)}</td><td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{r.status}</span></td><td className="px-3 py-2 text-center">{r.completionPercentage}%</td><td className="px-3 py-2 text-center font-bold text-rose-700">{r.daysOverdue}d</td><td className="px-3 py-2 text-[10px] max-w-[250px] truncate">{r.recommendedAction}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              ) : <div className="p-8 text-center text-sm text-emerald-700 font-semibold bg-emerald-50 rounded-lg">No overdue activities. All current items are on track.</div>}
            </div>
          )}

          {tab === 'upcoming' && (
            <div className="p-5 space-y-4">
              {[
                { title: 'Due Today', items: a?.upcoming?.today || [], color: 'rose' },
                { title: 'Due Within 7 Days', items: a?.upcoming?.within7 || [], color: 'amber' },
                { title: 'Due Within 14 Days', items: a?.upcoming?.within14 || [], color: 'sky' },
              ].map((bucket) => bucket.items.length > 0 && (
                <div key={bucket.title}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{bucket.title} ({bucket.items.length})</h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs"><thead><tr className="bg-gradient-to-r from-[#123047] to-[#0e7490] text-[10px] uppercase tracking-wider text-white"><th className="px-3 py-2">#</th><th className="px-3 py-2">Activity</th><th className="px-3 py-2">Dept</th><th className="px-3 py-2">Officer</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Priority</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {bucket.items.map((r: any, i: number) => <tr key={r.id} className="odd:bg-white even:bg-slate-50/60 hover:bg-cyan-50/50 transition cursor-pointer" onClick={() => openEdit(rows.find((row: any) => row.id === r.id) || r)}><td className="px-3 py-2 text-center font-black text-slate-400">{i + 1}</td><td className="px-3 py-2 font-bold text-slate-800">{r.title}</td><td className="px-3 py-2">{r.departmentName || '—'}</td><td className="px-3 py-2">{r.officerName || '—'}</td><td className="px-3 py-2">{fmt(r.plannedDate)}</td><td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{r.status?.replace(/_/g, ' ')}</span></td><td className="px-3 py-2">{r.priority}</td></tr>)}
                    </tbody></table>
                  </div>
                </div>
              ))}
              {(!a?.upcoming?.today?.length && !a?.upcoming?.within7?.length && !a?.upcoming?.within14?.length) && <p className="p-8 text-center text-sm text-slate-500">No upcoming activities within the next 14 days.</p>}
            </div>
          )}

          {tab === 'goals' && (
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Term Goals</h3>
                <button onClick={openAddGoal} className="rounded-lg bg-[#123047] px-3 py-2 text-xs font-bold text-white">Add Goal</button>
              </div>
              {goals.data?.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {goals.data.map((g: any) => (
                    <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-800">{g.title}</h4>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${STATUS_STYLE[g.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{g.status?.replace(/_/g, ' ')}</span>
                      </div>
                      {g.description && <p className="text-xs text-slate-500 mb-2">{g.description}</p>}
                      <div className="flex gap-4 text-[11px] font-semibold text-slate-600">
                        <span>Progress: {g.currentProgress}%</span>
                        <span>Target: {g.targetPercentage}%</span>
                        <span>Gap: {g.gap}pts</span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(g.currentProgress || 0, 100)}%`, background: g.status === 'ACHIEVED' ? '#059669' : g.status === 'ON_TRACK' ? '#0284c7' : g.status === 'AT_RISK' ? '#d97706' : '#dc2626' }} />
                      </div>
                      {g.department && <p className="mt-2 text-[10px] text-slate-500">Dept: {g.department.name}</p>}
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => openEditGoal(g)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-[#123047] hover:bg-cyan-100">Edit</button>
                        <button onClick={() => deleteGoal.mutate(g.id)} className="rounded-lg bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100" disabled={deleteGoal.isPending}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="p-8 text-center text-sm text-slate-500">No term goals set. Add goals to track strategic progress.</p>}
            </div>
          )}
        </section>
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit activity' : 'Add activity'} close={() => (create.isPending || update.isPending ? null : closeForm())}>
          <form onSubmit={(e) => { e.preventDefault(); editing ? update.mutate() : create.mutate(); }} className="grid gap-4 sm:grid-cols-2">
            <Field label="Activity name" required wide value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <Field label="Start date" type="date" required value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
            <Field label="End date" type="date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
            <Field label="Start time" type="time" value={form.startTime} onChange={(v) => setForm({ ...form, startTime: v })} />
            <label>
              <span className={LABEL_CLS}>Category</span>
              <select required className={INPUT_CLS} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Choose category</option>
                {(categories.data || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
                <option value="__custom">Add custom category...</option>
              </select>
              {form.categoryId === '__custom' && <div className="mt-2 flex gap-2"><input className={INPUT_CLS.replace('mt-1 ', '')} placeholder="Category name" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} /><button type="button" className="rounded-lg bg-slate-700 px-3 text-xs font-bold text-white disabled:opacity-40" disabled={!customCategory.trim() || createCategory.isPending} onClick={() => createCategory.mutate()}>Add</button></div>}
            </label>
            <label>
              <span className={LABEL_CLS}>Department</span>
              <select className={INPUT_CLS} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">All school (no department)</option>
                {(departments.data || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span className={LABEL_CLS}>Status</span>
              <select className={INPUT_CLS} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <div>
              <span className={LABEL_CLS}>Completion % ({form.completionPercentage})</span>
              <input type="range" min={0} max={100} step={5} className="mt-2 w-full" value={form.completionPercentage} onChange={(e) => setForm({ ...form, completionPercentage: Number(e.target.value) })} />
            </div>
            <Field label="Target value" type="number" value={form.target} onChange={(v) => setForm({ ...form, target: v })} placeholder="e.g. 500" />
            <Field label="Target unit" value={form.targetUnit} onChange={(v) => setForm({ ...form, targetUnit: v })} placeholder="e.g. students, attendees" />
            <Field label="Expected outcome" value={form.expectedOutcome} onChange={(v) => setForm({ ...form, expectedOutcome: v })} wide />
            <Field label="Actual outcome" value={form.actualOutcome} onChange={(v) => setForm({ ...form, actualOutcome: v })} wide />
            <Field label="Venue" value={form.venue} onChange={(v) => setForm({ ...form, venue: v })} wide />
            <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} wide />
            {(form.status === 'DELAYED') && <Field label="Delay reason" value={form.delayReason} onChange={(v) => setForm({ ...form, delayReason: v })} wide />}
            {(form.status === 'NOT_COMPLETED' || form.status === 'PARTIALLY_COMPLETED') && <Field label="Failure reason" value={form.failureReason} onChange={(v) => setForm({ ...form, failureReason: v })} wide />}
            <Field label="Remarks" value={form.remarks} onChange={(v) => setForm({ ...form, remarks: v })} wide />
            <button className={`${BTN} sm:col-span-2`} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Saving...' : editing ? 'Update activity' : 'Save activity'}
            </button>
          </form>
        </Modal>
      )}

      {showGoalForm && (
        <Modal title={editingGoal ? 'Edit goal' : 'Add term goal'} close={() => (createGoal.isPending || updateGoal.isPending ? null : closeGoalForm())}>
          <form onSubmit={(e) => { e.preventDefault(); editingGoal ? updateGoal.mutate() : createGoal.mutate(); }} className="grid gap-4 sm:grid-cols-2">
            <Field label="Goal title" required wide value={goalForm.title} onChange={(v) => setGoalForm({ ...goalForm, title: v })} />
            <Field label="Description" value={goalForm.description} onChange={(v) => setGoalForm({ ...goalForm, description: v })} wide />
            <Field label="Target %" type="number" required value={goalForm.targetPercentage.toString()} onChange={(v) => setGoalForm({ ...goalForm, targetPercentage: Number(v) || 90 })} />
            <Field label="Deadline" type="date" value={goalForm.deadline} onChange={(v) => setGoalForm({ ...goalForm, deadline: v })} />
            <label className="sm:col-span-2">
              <span className={LABEL_CLS}>Category</span>
              <select className={INPUT_CLS} value={goalForm.category} onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}>
                {['OVERALL', 'ACADEMIC', 'FINANCE', 'STAFFING', 'EVENTS', 'INFRASTRUCTURE'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <button className={`${BTN} sm:col-span-2`} disabled={createGoal.isPending || updateGoal.isPending}>
              {createGoal.isPending || updateGoal.isPending ? 'Saving...' : editingGoal ? 'Update goal' : 'Save goal'}
            </button>
          </form>
        </Modal>
      )}

      {showImport && (
        <Modal title="Import official Excel workbook" close={() => setShowImport(false)}>
          <p className="text-sm text-slate-600">Upload is validated and staged first. Live CalendarActivity records change only after explicit confirmation.</p>
          <input ref={input} type="file" accept=".xlsx" className="mt-5 block w-full rounded-lg border border-slate-300 p-3 text-sm" onChange={(e) => e.target.files?.[0] && validate.mutate(e.target.files[0])} />
          {summary && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-bold">Validation {summary.status}</p>
              <p className="mt-1">Rows: {summary.totalRows} · Valid: {summary.validRows} · Warnings: {summary.warningRows} · Errors: {summary.errorRows}</p>
              {importId && summary.errorRows === 0 && <button onClick={() => commit.mutate()} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white">Confirm and update calendar</button>}
            </div>
          )}
        </Modal>
      )}

      {showNewCalendar && (
        <Modal title="Create business calendar" close={() => setShowNewCalendar(false)}>
          <form onSubmit={(e) => { e.preventDefault(); createCalendar.mutate(); }} className="grid gap-4 sm:grid-cols-2">
            <Field label="Calendar name (e.g. 2026 Term 3)" required wide value={calForm.name} onChange={(v) => setCalForm({ ...calForm, name: v })} />
            <label>
              <span className={LABEL_CLS}>Academic year</span>
              <select required className={INPUT_CLS} value={calForm.academicYearId} onChange={(e) => setCalForm({ ...calForm, academicYearId: e.target.value, termId: '' })}>
                <option value="">Select academic year</option>
                {(years.data || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span className={LABEL_CLS}>Term</span>
              <select className={INPUT_CLS} value={calForm.termId} onChange={(e) => setCalForm({ ...calForm, termId: e.target.value })}>
                <option value="">No term (whole year)</option>
                {(terms.data || []).filter((item: any) => !calForm.academicYearId || item.academicYearId === calForm.academicYearId).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <Field label="Start date" type="date" required value={calForm.startDate} onChange={(v) => setCalForm({ ...calForm, startDate: v })} />
            <Field label="End date" type="date" required value={calForm.endDate} onChange={(v) => setCalForm({ ...calForm, endDate: v })} />
            <Field label="Timezone" value={calForm.timezone} onChange={(v) => setCalForm({ ...calForm, timezone: v })} wide />
            <button className={`${BTN} sm:col-span-2`} disabled={createCalendar.isPending}>{createCalendar.isPending ? 'Creating...' : 'Create calendar'}</button>
          </form>
        </Modal>
      )}
    </main>
  );
}

function Metric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black ${color}`}>{value}</p></div>;
}
function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-[#123047]">{value}</p></div>;
}
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"><div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto overflow-x-hidden rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={close} className="text-2xl text-slate-400">×</button></div><div className="mt-5">{children}</div></div></div>;
}
function Field({ label, value, onChange, type = 'text', required = false, wide = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; wide?: boolean; placeholder?: string }) {
  return <label className={wide ? 'sm:col-span-2' : ''}><span className={LABEL_CLS}>{label}</span><input required={required} type={type} className={INPUT_CLS} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}
