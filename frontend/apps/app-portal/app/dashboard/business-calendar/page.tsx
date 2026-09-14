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

const INPUT_CLS =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-200';
const LABEL_CLS = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500';
const BTN =
  'inline-flex items-center justify-center rounded-lg bg-[#123047] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0d2637] disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_GHOST =
  'inline-flex items-center justify-center rounded-lg border border-white/40 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed';

const STATUS_STYLE: Record<string, string> = {
  PLANNED: 'bg-blue-100 text-blue-800 ring-blue-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  CANCELLED: 'bg-rose-100 text-rose-700 ring-rose-200',
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

export default function BusinessCalendarPage() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [calendarId, setCalendarId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [showNewCalendar, setShowNewCalendar] = useState(false);
  const [importId, setImportId] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const emptyForm = { title: '', startDate: '', endDate: '', startTime: '', categoryId: '', departmentId: '', venue: '', notes: '' };
  const [form, setForm] = useState({ ...emptyForm });

  const calendars = useQuery({ queryKey: ['business-calendar'], queryFn: () => businessCalendarApi.list().then((r) => r.data) });
  const id = calendarId || calendars.data?.[0]?.id || '';
  const current = calendars.data?.find((item: any) => item.id === id);
  const activities = useQuery({ queryKey: ['business-calendar', id], queryFn: () => businessCalendarApi.activities(id).then((r) => r.data), enabled: Boolean(id) });
  const categories = useQuery({ queryKey: ['business-calendar-categories'], queryFn: () => businessCalendarApi.categories().then((r) => r.data) });
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => staffPositionApi.getDepartments().then((r) => r.data).catch(() => []) });
  const years = useQuery({ queryKey: ['academic-year'], queryFn: () => academicYearApi.getAll().then((r) => r.data) });
  const terms = useQuery({ queryKey: ['term'], queryFn: () => termApi.getAll().then((r) => r.data) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['business-calendar', id] });
    qc.invalidateQueries({ queryKey: ['business-calendar'] });
  };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm({ ...emptyForm }); };

  const create = useMutation({
    mutationFn: () => businessCalendarApi.createActivity(id, { ...form, endDate: form.endDate || form.startDate, allDay: !form.startTime, status: 'PLANNED', priority: 'NORMAL' }),
    onSuccess: () => { refresh(); closeForm(); },
  });
  const update = useMutation({
    mutationFn: () => businessCalendarApi.updateActivity(editing.id, form),
    onSuccess: () => { refresh(); closeForm(); },
  });
  const remove = useMutation({
    mutationFn: (activityId: string) => businessCalendarApi.deleteActivity(activityId),
    onSuccess: () => refresh(),
  });
  const publish = useMutation({
    mutationFn: () => (current?.status === 'PUBLISHED' ? businessCalendarApi.unpublish(id) : businessCalendarApi.publish(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-calendar'] }),
  });
  const validate = useMutation({
    mutationFn: (file: File) => businessCalendarApi.validateImport(id, file, 'UPDATE_EXISTING'),
    onSuccess: (response) => { setImportId(response.data.id); setSummary(response.data); },
  });
  const commit = useMutation({
    mutationFn: () => businessCalendarApi.commitImport(id, importId),
    onSuccess: () => { refresh(); setShowImport(false); setSummary(null); setImportId(''); },
  });
  const createCalendar = useMutation({
    mutationFn: () => businessCalendarApi.create(calForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['business-calendar'] }); setShowNewCalendar(false); setCalForm({ name: '', academicYearId: '', termId: '', startDate: '', endDate: '', timezone: 'Africa/Lusaka' }); },
  });
  const [calForm, setCalForm] = useState({ name: '', academicYearId: '', termId: '', startDate: '', endDate: '', timezone: 'Africa/Lusaka' });
  const download = async (kind: 'template' | 'export') => {
    if (!id) return;
    const response = kind === 'template' ? await businessCalendarApi.templateBlob(id) : await businessCalendarApi.exportBlob(id);
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `${current?.name || 'calendar'}-${kind === 'template' ? 'template' : 'export'}.xlsx`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };
  const rows = activities.data || [];
  const openAdd = () => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ title: row.title, startDate: toInput(row.startDate), endDate: toInput(row.endDate), startTime: row.startTime || '', categoryId: row.categoryId || '', departmentId: row.departmentId || '', venue: row.venue || '', notes: row.notes || '' });
    setShowForm(true);
  };
  const removeRow = (row: any) => { if (window.confirm(`Delete activity "${row.title}"? This cannot be undone.`)) remove.mutate(row.id); };

  return (
    <main className="min-h-screen bg-[#f4f7f9] p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-[#123047] via-[#0e2f4a] to-[#123047] p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-200">Institutional activity management</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">School Business Calendar Hub</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">The official live calendar for meetings, CPD, monitoring, assessments and deadlines. Excel is an input mechanism only.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN_GHOST} onClick={() => setShowNewCalendar(true)}>New calendar</button>
              <button type="button" className={BTN_GHOST} onClick={() => setShowImport(true)}>Import Excel</button>
              <button type="button" className={BTN_GHOST} onClick={() => download('template')} disabled={!id}>Blank template</button>
              <button type="button" className={BTN_GHOST} onClick={() => download('export')} disabled={!id}>Export current</button>
              <button type="button" className={BTN_GHOST} onClick={() => id && window.open(businessCalendarApi.reportHtmlUrl(id), '_blank')} disabled={!id} title="Open a clean printable sheet you can print or save as PDF">Printable sheet</button>
              <button type="button" className={BTN_GHOST} onClick={() => id && window.open(businessCalendarApi.reportPdfUrl(id), '_blank')} disabled={!id} title="Download a PDF of the sheet">Download PDF</button>
              <button type="button" className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-[#123047] shadow-md transition hover:bg-cyan-200" onClick={openAdd}>Add activity</button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Activities" value={rows.length} color="text-cyan-700" />
          <Metric label="Upcoming" value={rows.filter((r: any) => r.status === 'PLANNED').length} color="text-blue-700" />
          <Metric label="Meetings" value={rows.filter((r: any) => r.category?.name?.toLowerCase().includes('meeting')).length} color="text-indigo-700" />
          <Metric label="Completed" value={rows.filter((r: any) => r.status === 'COMPLETED').length} color="text-emerald-700" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-cyan-700">Authoritative term dataset</p>
              <h2 className="mt-1 text-xl font-black text-[#123047]">{current?.name || 'Select a calendar'}</h2>
              <p className="text-sm text-slate-500">{current?.academicYear?.name || ''}{current?.term?.name ? ` · ${current.term.name}` : ''} · Version {current?.version || '-'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200" value={id} onChange={(e) => setCalendarId(e.target.value)}>
                <option value="">Choose calendar</option>
                {(calendars.data || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {id && (
                <>
                  <button onClick={() => publish.mutate()} className="rounded-lg bg-[#123047] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#0d2637]" disabled={publish.isPending}>
                    {current?.status === 'PUBLISHED' ? 'Unpublish' : 'Publish calendar'}
                  </button>
                  <button onClick={() => window.open(businessCalendarApi.reportHtmlUrl(id), '_blank')} className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-cyan-800" title="Clean professional printable sheet">
                    Printable sheet
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-[#123047] to-[#0e7490] text-[11px] uppercase tracking-[.14em] text-white">
                  <th className="rounded-tl-2xl px-4 py-4 text-center">#</th>
                  <th className="px-4 py-4">Activity</th>
                  <th className="px-4 py-4">Category</th>
                  <th className="px-4 py-4">Date / time</th>
                  <th className="px-4 py-4">Department</th>
                  <th className="px-4 py-4">Venue</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="rounded-tr-2xl px-4 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row: any, index: number) => (
                  <tr key={row.id} className="transition hover:bg-cyan-50/50 odd:bg-white even:bg-slate-50/70">
                    <td className="px-4 py-4 text-center font-black text-slate-400">{String(index + 1).padStart(2, '0')}</td>
                    <td className="px-4 py-4">
                      <strong className="text-slate-800">{row.title}</strong>
                      <p className="mt-1 max-w-md text-xs text-slate-500">{row.notes || row.description || 'No additional notes'}</p>
                    </td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${categoryColor(row.category?.name)}`}>{row.category?.name || 'Other'}</span></td>
                    <td className="px-4 py-4 font-semibold text-slate-700">
                      <p>{fmt(row.startDate)}{row.endDate && row.endDate !== row.startDate ? ` - ${fmt(row.endDate)}` : ''}</p>
                      <p className="text-xs font-medium text-slate-500">{row.startTime || 'All day'}{row.endTime ? ` - ${row.endTime}` : ''}</p>
                    </td>
                    <td className="px-4 py-4">
                      {row.department ? <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800 ring-1 ring-inset ring-violet-200">{row.department.name}</span> : <span className="text-sm font-medium text-slate-500">All school</span>}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{row.venue || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLE[row.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{row.status || 'PLANNED'}</span></td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(row)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-[#123047] transition hover:bg-cyan-100" title="Edit activity">Edit</button>
                        <button onClick={() => removeRow(row)} className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100" disabled={remove.isPending} title="Delete activity">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="p-12 text-center text-sm text-slate-500">No activities yet. Add one or import the official workbook.</p>}
          </div>
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
              </select>
            </label>
            <label>
              <span className={LABEL_CLS}>Department</span>
              <select className={INPUT_CLS} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">All school (no department)</option>
                {(departments.data || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <Field label="Venue" value={form.venue} onChange={(v) => setForm({ ...form, venue: v })} wide />
            <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} wide />
            <button className={`${BTN} sm:col-span-2`} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Saving...' : editing ? 'Update activity' : 'Save activity'}
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

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black ${color}`}>{value}</p></div>;
}
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={close} className="text-2xl text-slate-400">×</button></div><div className="mt-5">{children}</div></div></div>;
}
function Field({ label, value, onChange, type = 'text', required = false, wide = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; wide?: boolean }) {
  return <label className={wide ? 'sm:col-span-2' : ''}><span className={LABEL_CLS}>{label}</span><input required={required} type={type} className={INPUT_CLS} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}