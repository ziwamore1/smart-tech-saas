'use client';

import { useEffect, useState } from 'react';
import { studentApi, studentAwardsApi } from '@/lib/api';
import { toast } from 'sonner';

const unwrap = (value: any) => value?.data?.data || value?.data || value;

export default function StudentAwardsPage() {
  const [catalog, setCatalog] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [sportCategory, setSportCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [appointmentId, setAppointmentId] = useState('');
  const [dutyId, setDutyId] = useState('');
  const [dutyTitle, setDutyTitle] = useState('');
  const [dutyPoints, setDutyPoints] = useState('10');
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [customRolePoints, setCustomRolePoints] = useState('10');

  useEffect(() => {
    Promise.all([studentAwardsApi.catalog(), studentApi.getAll({ limit: 500 })]).then(([catalogResponse, studentResponse]) => {
      const nextCatalog = unwrap(catalogResponse);
      const nextStudents = unwrap(studentResponse);
      setCatalog(nextCatalog);
      setStudents(Array.isArray(nextStudents) ? nextStudents : nextStudents?.students || []);
      setRoleCode(nextCatalog?.leadershipRoles?.[0]?.code || '');
      setSportCategory(nextCatalog?.sportsCategories?.[0] || '');
    }).catch(() => toast.error('Unable to load student award catalog'));
  }, []);

  const submitLeadership = async () => {
    if (!studentId || !roleCode || !startDate) return toast.error('Student, role, and start date are required');
    setBusy(true);
    try { const response = await studentAwardsApi.appointLeadership({ studentId, roleCode, startDate }); const appointment = unwrap(response); setAppointmentId(appointment.id); toast.success('Leadership appointment recorded'); } catch (error: any) { toast.error(error?.response?.data?.message || 'Could not record appointment'); } finally { setBusy(false); }
  };

  const addDuty = async () => {
    if (!appointmentId || !dutyTitle) return toast.error('Record an appointment and enter a duty title first');
    try { const response = await studentAwardsApi.addLeadershipDuty(appointmentId, { title: dutyTitle, pointsPossible: Number(dutyPoints) || 10 }); setDutyId(unwrap(response).id); setDutyTitle(''); toast.success('Duty assigned'); } catch (error: any) { toast.error(error?.response?.data?.message || 'Could not assign duty'); }
  };

  const verifyDuty = async () => {
    if (!dutyId) return toast.error('Assign a duty first');
    try { await studentAwardsApi.verifyLeadershipDuty(dutyId, { pointsAwarded: Number(dutyPoints) || 10, evidence: 'Verified by teaching staff' }); toast.success('Duty verified and points awarded'); setDutyId(''); } catch (error: any) { toast.error(error?.response?.data?.message || 'Could not verify duty'); }
  };

  const addCustomRole = async () => {
    if (!customRoleTitle.trim()) return toast.error('Enter a leadership role title');
    try { await studentAwardsApi.addLeadershipRole({ title: customRoleTitle, minimumPoints: Number(customRolePoints) || 10 }); toast.success('Custom leadership role added'); setCustomRoleTitle(''); const response = await studentAwardsApi.catalog(); setCatalog(unwrap(response)); } catch (error: any) { toast.error(error?.response?.data?.message || 'Could not add leadership role'); }
  };

  const submitSport = async () => {
    if (!studentId || !sportCategory || !startDate) return toast.error('Student, sport, and start date are required');
    setBusy(true);
    try { await studentAwardsApi.recommendSport({ studentId, sportCategory, startDate, recommendation: 'Recommended by teaching staff', pointsAwarded: 10 }); toast.success('Sports recommendation recorded'); } catch (error: any) { toast.error(error?.response?.data?.message || 'Could not record sports recommendation'); } finally { setBusy(false); }
  };

  return <main className="p-4 sm:p-6 max-w-6xl mx-auto">
    <h1 className="text-2xl font-bold text-slate-900">Student Awards Evidence</h1>
    <p className="mt-1 mb-6 text-sm text-slate-500">Record appointments, tenure, duties, and sports recommendations before issuing non-academic certificates.</p>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Leadership appointment</h2>
        <div className="space-y-3">
          <select value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full rounded-lg border p-2.5 text-sm"><option value="">Select student...</option>{students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>)}</select>
          <select value={roleCode} onChange={e => setRoleCode(e.target.value)} className="w-full rounded-lg border p-2.5 text-sm">{(catalog?.leadershipRoles || []).map((r: any) => <option key={r.code} value={r.code}>{r.title} ({r.minimumPoints} points required)</option>)}</select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-lg border p-2.5 text-sm" />
          <button disabled={busy} onClick={submitLeadership} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Record appointment</button>
          <div className="border-t pt-3 mt-3 space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duty evidence and points</p><input value={dutyTitle} onChange={e => setDutyTitle(e.target.value)} placeholder="Duty completed, e.g. organized assembly" className="w-full rounded-lg border p-2.5 text-sm" /><input type="number" min="1" value={dutyPoints} onChange={e => setDutyPoints(e.target.value)} placeholder="Points" className="w-full rounded-lg border p-2.5 text-sm" /><div className="flex gap-2"><button onClick={addDuty} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700">Assign duty</button><button onClick={verifyDuty} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white">Verify points</button></div></div>
          <div className="border-t pt-3 mt-3 space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add school-specific role</p><input value={customRoleTitle} onChange={e => setCustomRoleTitle(e.target.value)} placeholder="e.g. Environment Prefect" className="w-full rounded-lg border p-2.5 text-sm" /><input type="number" min="1" value={customRolePoints} onChange={e => setCustomRolePoints(e.target.value)} placeholder="Minimum points" className="w-full rounded-lg border p-2.5 text-sm" /><button onClick={addCustomRole} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800">Add role to catalog</button></div>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Sports recommendation</h2>
        <div className="space-y-3">
          <select value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full rounded-lg border p-2.5 text-sm"><option value="">Select student...</option>{students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>)}</select>
          <select value={sportCategory} onChange={e => setSportCategory(e.target.value)} className="w-full rounded-lg border p-2.5 text-sm">{(catalog?.sportsCategories || []).map((sport: string) => <option key={sport} value={sport}>{sport.replace(/_/g, ' ')}</option>)}</select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-lg border p-2.5 text-sm" />
          <button disabled={busy} onClick={submitSport} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Recommend participation</button>
        </div>
      </section>
    </div>
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Appointments still require verified duty records and points before a Leadership Award is eligible. Sports certificates require teacher recommendation, verified participation, and activity points.</div>
  </main>;
}
