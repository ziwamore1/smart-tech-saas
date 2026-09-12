'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { businessCalendarApi } from '@/lib/api';

const fmt = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));

export default function BusinessCalendarPage() {
  const [calendarId, setCalendarId] = useState('');
  const calendars = useQuery({ queryKey: ['business-calendar'], queryFn: () => businessCalendarApi.list().then((r) => r.data) });
  const id = calendarId || calendars.data?.[0]?.id || '';
  const activities = useQuery({ queryKey: ['business-calendar', id], queryFn: () => businessCalendarApi.activities(id).then((r) => r.data), enabled: Boolean(id) });
  const current = calendars.data?.find((item: any) => item.id === id);
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8"><div className="mx-auto max-w-6xl space-y-5"><header className="rounded-2xl bg-[#123047] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Institutional activity management</p><h1 className="mt-2 text-3xl font-black">School Business Calendar Hub</h1><p className="mt-2 text-sm text-slate-200">The live staff calendar. Excel workbooks are input only; published CalendarActivity records remain authoritative.</p><div className="mt-5 flex flex-wrap gap-2"><select className="rounded-lg px-3 py-2 text-sm text-slate-900" value={id} onChange={(e) => setCalendarId(e.target.value)}><option value="">Select term calendar</option>{(calendars.data || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{id && <a className="rounded-lg border border-white/40 px-3 py-2 text-sm font-bold" href={businessCalendarApi.exportUrl(id)}>Export current calendar</a>}</div></header><section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-xl font-bold">{current?.name || 'Calendar activities'}</h2><p className="text-sm text-slate-500">{current?.academicYear?.name || ''} {current?.term?.name ? `· ${current.term.name}` : ''} · {activities.data?.length || 0} activities</p></div><div className="divide-y divide-slate-100">{(activities.data || []).map((item: any, index: number) => <article className="grid gap-3 p-5 sm:grid-cols-[48px_1fr_auto] sm:items-center" key={item.id}><span className="font-black text-slate-300">{String(index + 1).padStart(2, '0')}</span><div><h3 className="font-bold">{item.title}</h3><p className="mt-1 text-sm text-slate-500">{fmt(item.startDate)}{item.endDate !== item.startDate ? ` - ${fmt(item.endDate)}` : ''} · {item.startTime || 'All day'} · {item.venue || 'Venue TBC'}</p></div><span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">{item.status}</span></article>)}{!activities.data?.length && <p className="p-12 text-center text-sm text-slate-500">No published activities are available.</p>}</div></section></div></main>;
}
