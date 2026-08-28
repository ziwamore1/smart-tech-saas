'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resultsSmsApi, classApi, termApi } from '@/lib/api';
import { PermissionGuard } from '@/components/permissions/PermissionGuard';

const statusStyles: Record<string, string> = {
  VALID: 'bg-emerald-50 text-emerald-700', MISSING: 'bg-amber-50 text-amber-700', INVALID: 'bg-rose-50 text-rose-700',
  SENT: 'bg-emerald-50 text-emerald-700', DELIVERED: 'bg-sky-50 text-sky-700', QUEUED: 'bg-amber-50 text-amber-700', PENDING: 'bg-amber-50 text-amber-700', FAILED: 'bg-rose-50 text-rose-700',
  PROVIDER_ERROR: 'bg-rose-50 text-rose-700', SKIPPED: 'bg-amber-50 text-amber-700',
};

export default function ResultsSmsPage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [tab, setTab] = useState<'compose' | 'history' | 'failed'>('compose');
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [allowResend, setAllowResend] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => classApi.getAll().then((r) => r.data) });
  const { data: terms } = useQuery({ queryKey: ['terms'], queryFn: () => termApi.getAll().then((r) => r.data) });
  const { data: dashboard } = useQuery({ queryKey: ['results-sms-dashboard'], queryFn: () => resultsSmsApi.getDashboard().then((r) => r.data) });
  const { data: settings } = useQuery({ queryKey: ['results-sms-settings'], queryFn: () => resultsSmsApi.getSettings().then((r) => r.data) });
  const { data: preview, isLoading, isError: previewFailed, error: previewError } = useQuery({
    queryKey: ['results-sms-preview', classId, termId],
    queryFn: () => resultsSmsApi.preview(classId, termId).then((r) => r.data), enabled: Boolean(classId && termId),
  });
  const { data: history } = useQuery({ queryKey: ['results-sms-history', classId, termId], queryFn: () => resultsSmsApi.getHistory(classId || undefined, termId || undefined).then((r) => r.data), enabled: tab === 'history' });
  const { data: failed } = useQuery({ queryKey: ['results-sms-failed'], queryFn: () => resultsSmsApi.getFailedLogs().then((r) => r.data), enabled: tab === 'failed' });
  const { data: activeBatchLogs } = useQuery({
    queryKey: ['results-sms-batch', activeBatchId],
    queryFn: () => resultsSmsApi.getBatchLogs(activeBatchId!).then((r) => r.data),
    enabled: Boolean(activeBatchId),
    refetchInterval: activeBatchId ? 2000 : false,
  });
  useEffect(() => {
    if (!activeBatchId || !activeBatchLogs?.length) return;
    const finished = activeBatchLogs.every((log: any) => ['SENT', 'DELIVERED', 'FAILED', 'REJECTED', 'INVALID_NUMBER', 'PROVIDER_ERROR', 'SKIPPED', 'INSUFFICIENT_BALANCE', 'OPTED_OUT'].includes(log.status));
    if (finished) {
      setActiveBatchId(null);
      queryClient.invalidateQueries({ queryKey: ['results-sms-history'] });
      queryClient.invalidateQueries({ queryKey: ['results-sms-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['results-sms-failed'] });
    }
  }, [activeBatchId, activeBatchLogs, queryClient]);
  const send = useMutation({
    mutationFn: () => resultsSmsApi.send({ classId, termId, studentIds: scope === 'selected' ? selectedStudents : undefined, allowResend }),
    onSuccess: (response: any) => { setConfirm(false); setAllowResend(false); setActiveBatchId(response.data?.batchId || null); queryClient.invalidateQueries({ queryKey: ['results-sms'] }); setTab('history'); },
  });
  const retry = useMutation({ mutationFn: (id: string) => resultsSmsApi.retry(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['results-sms'] }) });

  const students = useMemo(() => {
    const grouped = new Map<string, any>();
    (preview?.recipients || []).forEach((r: any) => { if (!grouped.has(r.studentId)) grouped.set(r.studentId, r); });
    return Array.from(grouped.values());
  }, [preview]);
  const target = (preview?.recipients || []).filter((r: any) => r.phoneStatus === 'VALID' && (scope === 'all' || selectedStudents.includes(r.studentId)));
  const alreadySent = target.filter((r: any) => r.alreadySent).length;
  const segments = target.reduce((sum: number, r: any) => sum + r.segments, 0);

  return <PermissionGuard permission="communications.view" fallback={<div className="p-8 text-slate-600">You do not have permission to view Results SMS.</div>}>
    <div className="min-h-full space-y-6 pb-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Communication / SMS</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Results SMS Hub</h1><p className="mt-1 text-sm text-slate-500">Preview verified results, confirm recipients, and monitor delivery.</p></div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">{[['compose', 'Create send'], ['history', 'Send history'], ['failed', 'Failed queue']].map(([key, label]) => <button key={key} onClick={() => setTab(key as any)} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}</div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[[dashboard?.balance?.balance ?? '—', 'Units available'], [dashboard?.usedUnits ?? 0, 'Used units'], [preview?.totalStudents ?? 0, 'Students with results'], [preview?.validRecipients ?? 0, 'Valid recipients'], [preview?.missingPhone ?? 0, 'Missing phone'], [dashboard?.sent ?? 0, 'Sent'], [dashboard?.failed ?? 0, 'Failed'], [`${dashboard?.deliveryRate ?? 0}%`, 'Delivery rate']].map(([value, label]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xl font-bold text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-500">{label}</div></div>)}
      </section>

      {tab === 'compose' && <>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-950">Create Results SMS</h2><p className="text-sm text-slate-500">Only published, verified academic results are used.</p></div><div className={`rounded-full px-3 py-1 text-xs font-semibold ${settings?.smsEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{settings?.smsEnabled ? `Provider online · ${settings.smsProvider || 'configured'}` : 'SMS disabled'}</div></div>
          <div className="grid gap-4 md:grid-cols-3"><Select label="Academic class" value={classId} onChange={(v: string) => { setClassId(v); setSelectedStudents([]); }} options={classes || []} placeholder="Select class" /><Select label="Term / assessment" value={termId} onChange={setTermId} options={terms || []} placeholder="Select assessment" /><div><label className="mb-2 block text-sm font-medium text-slate-700">Recipients</label><div className="flex rounded-xl border border-slate-200 p-1">{[['all', 'Entire class'], ['selected', 'Selected']].map(([key, label]) => <button key={key} onClick={() => setScope(key as any)} className={`flex-1 rounded-lg px-2 py-2 text-sm ${scope === key ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>{label}</button>)}</div></div></div>
        </section>

        {isLoading && <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Loading published results and validating parent contacts...</div>}
        {previewFailed && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><div className="font-semibold">Published results could not be loaded</div><div className="mt-1">{String((previewError as any)?.response?.data?.message || (previewError as any)?.message || 'The results service returned an unexpected error. Try again or contact an administrator.')}</div></div>}
        {preview && !isLoading && <>
          {preview.totalStudents === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">No published student results were found for this class and assessment.</div>}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold text-slate-950">Recipient validation</h2><p className="text-sm text-slate-500">{preview.class || 'Class'} · {preview.term || 'Assessment'} · {preview.totalStudents} students</p></div><div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{target.length} valid</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{preview.missingPhone} missing</span><span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">{preview.invalidPhone} invalid</span></div></div>
            <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400"><tr><th className="w-10 py-3">{scope === 'selected' && <input type="checkbox" checked={selectedStudents.length === students.length && students.length > 0} onChange={(e) => setSelectedStudents(e.target.checked ? students.map((s) => s.studentId) : [])} />}</th><th>Student</th><th>Parent / phone</th><th>Status</th><th>Message</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((r: any) => <tr key={r.studentId} className="hover:bg-slate-50"><td className="py-3">{scope === 'selected' && <input type="checkbox" checked={selectedStudents.includes(r.studentId)} onChange={() => setSelectedStudents((x) => x.includes(r.studentId) ? x.filter((id) => id !== r.studentId) : [...x, r.studentId])} />}</td><td className="py-3"><div className="font-medium text-slate-900">{r.studentName}</div><div className="text-xs text-slate-500">{r.admissionNumber || 'No admission number'}</div></td><td><div className="text-slate-700">{r.parentName}</div><div className="font-mono text-xs text-slate-500">{r.phoneNumber || 'No number'}</div></td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[r.phoneStatus]}`}>{r.phoneStatus === 'VALID' ? 'Ready' : r.errorCode === 'NO_PHONE_NUMBER' ? 'No phone' : 'Invalid'}</span>{r.alreadySent && <div className="mt-1 text-xs font-semibold text-amber-700">Already sent</div>}</td><td><button onClick={() => setOpenStudent(openStudent === r.studentId ? null : r.studentId)} className="text-indigo-600 hover:underline">{openStudent === r.studentId ? 'Hide preview' : 'Preview SMS'}</button></td></tr>)}{openStudent && <tr><td colSpan={5} className="bg-slate-50 p-4"><MessagePreview recipient={students.find((s: any) => s.studentId === openStudent)} /></td></tr>}</tbody></table></div>
          </section>
          <section className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 md:flex-row md:items-center md:justify-between"><div><div className="text-sm font-semibold text-indigo-950">Send summary</div><div className="mt-1 text-sm text-indigo-800">{scope === 'selected' ? selectedStudents.length : preview.totalStudents} students · {target.length} valid recipients · {segments} estimated units</div>{preview.multiSegment && <div className="mt-2 text-xs font-medium text-amber-800">Some messages exceed 160 characters and will use multiple billable segments.</div>}{alreadySent > 0 && <div className="mt-2 text-xs font-medium text-amber-800">{alreadySent} result notification(s) match a previously sent result version.</div>}</div><PermissionGuard permission="communications.send"><button disabled={!target.length || (scope === 'selected' && !selectedStudents.length) || !settings?.smsEnabled} onClick={() => setConfirm(true)} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">Review and confirm</button></PermissionGuard></section>
        </>}
      </>}

       {tab === 'history' && <>{activeBatchId && <BatchProgress batchId={activeBatchId} rows={activeBatchLogs || []} />}{!activeBatchId && <LogTable title="Send history" rows={history || []} batch />}</>}
      {tab === 'failed' && <LogTable title="Failed SMS diagnostics" rows={failed || []} onRetry={(id: string) => retry.mutate(id)} />}

      {confirm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold text-slate-950">Confirm Results SMS</h2><p className="mt-2 text-sm text-slate-600">Send the exact previews to <strong>{target.length} valid parent number(s)</strong> using approximately <strong>{segments} SMS unit(s)</strong>.</p>{alreadySent > 0 && <label className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={allowResend} onChange={(e) => setAllowResend(e.target.checked)} />Allow explicit resend of {alreadySent} already-sent result version(s).</label>}<div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirm(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button onClick={() => send.mutate()} disabled={send.isPending || (alreadySent > 0 && !allowResend)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{send.isPending ? 'Queuing...' : 'Send results SMS'}</button></div>{send.isError && <p className="mt-3 text-sm text-rose-600">{String((send.error as any)?.response?.data?.message || 'Unable to send. Review provider and balance settings.')}</p>}</div></div>}
    </div>
  </PermissionGuard>;
}

function Select({ label, value, onChange, options, placeholder }: any) { return <div><label className="mb-2 block text-sm font-medium text-slate-700">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"><option value="">{placeholder}</option>{(Array.isArray(options) ? options : []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>; }
function MessagePreview({ recipient }: { recipient: any }) { if (!recipient) return null; return <div><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Exact SMS preview</span><span>{recipient.characters} characters · {recipient.segments} segment(s) · {recipient.estimatedUnits} unit(s)</span></div><div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-slate-700">{recipient.message}</div><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">{recipient.result.subjects.map((s: any) => <span key={s.name} className="rounded bg-slate-100 px-2 py-1">{s.name}: {recipient.result.bestSix != null ? `Points ${s.points ?? '-'}` : s.absent ? 'Absent' : s.mark ?? '-'} {recipient.result.bestSix == null ? (s.grade || '') : ''}</span>)}</div></div>; }
function BatchProgress({ batchId, rows }: { batchId: string; rows: any[] }) {
  const sent = rows.filter((r) => ['SENT', 'DELIVERED'].includes(r.status)).length;
  const failed = rows.filter((r) => ['FAILED', 'REJECTED', 'INVALID_NUMBER', 'PROVIDER_ERROR', 'INSUFFICIENT_BALANCE'].includes(r.status)).length;
  const complete = sent + failed;
  const percent = rows.length ? Math.round((complete / rows.length) * 100) : 0;
  return <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-indigo-950">Sending results SMS</h2><p className="text-sm text-indigo-800">Batch {batchId} is being processed in the background.</p></div><span className="text-lg font-bold text-indigo-700">{percent}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} /></div><div className="mt-3 flex flex-wrap gap-3 text-sm"><span className="text-emerald-700">{sent} sent</span><span className="text-rose-700">{failed} failed</span><span className="text-amber-700">{Math.max(0, rows.length - complete)} pending</span></div>{failed > 0 && <p className="mt-3 text-xs text-rose-800">Failed messages include a specific recommendation in the Failed queue. Correct the phone number, balance, or provider configuration, then retry.</p>}</section>;
}

function LogTable({ title, rows, onRetry, batch }: any) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-950">{title}</h2>{!rows.length ? <div className="py-12 text-center text-sm text-slate-500">No records found.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-3">{batch ? 'Batch' : 'Student'}</th><th>{batch ? 'Created' : 'Phone / reason'}</th><th>Status</th><th>{batch ? 'Volume' : 'Action'}</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r: any) => <tr key={r.batchId || r.id}><td className="py-3 font-medium text-slate-800">{batch ? r.batchId : `${r.studentName} (${r.admissionNumber || 'N/A'})`}</td><td className="text-slate-500">{batch ? new Date(r.createdAt).toLocaleString() : <>{r.phoneNumber || 'No phone'}<div className="text-xs text-rose-600">{r.errorMessage || r.errorSuggestion || recommendation(r)}</div></>}</td><td>{batch ? <span className="text-xs text-slate-600">{r.sent} sent · {r.failed} failed · {r.delivered} delivered</span> : <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status}</span>}</td><td>{batch ? `${r.total} messages · ${r.units} units` : onRetry && <button onClick={() => onRetry(r.id)} className="text-sm font-semibold text-indigo-600 hover:underline">Retry</button>}</td></tr>)}</tbody></table></div>}</section>; }

function recommendation(row: any) { if (row.status === 'INVALID_NUMBER') return 'Update the parent phone number in Parent Management.'; if (row.status === 'INSUFFICIENT_BALANCE') return 'Top up SMS units in Communications Wallet.'; if (row.status === 'PROVIDER_ERROR') return 'Check provider settings and retry.'; return row.status === 'SKIPPED' ? 'Add a valid parent phone number, then send again.' : ''; }
