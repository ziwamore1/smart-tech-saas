'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resultsSmsApi, classApi, termApi } from '@/lib/api';
import { PermissionGuard } from '@/components/permissions/PermissionGuard';

const statusStyles: Record<string, string> = {
  VALID: 'bg-emerald-50 text-emerald-700', MISSING: 'bg-amber-50 text-amber-700', INVALID: 'bg-rose-50 text-rose-700',
  SENT: 'bg-emerald-50 text-emerald-700', DELIVERED: 'bg-sky-50 text-sky-700', QUEUED: 'bg-amber-50 text-amber-700', PENDING: 'bg-amber-50 text-amber-700', SENDING: 'bg-indigo-50 text-indigo-700', RETRYING: 'bg-orange-50 text-orange-700', FAILED: 'bg-rose-50 text-rose-700',
  PROVIDER_ERROR: 'bg-rose-50 text-rose-700', SKIPPED: 'bg-slate-50 text-slate-600', CANCELLED: 'bg-slate-100 text-slate-600', INSUFFICIENT_BALANCE: 'bg-rose-50 text-rose-700', OPTED_OUT: 'bg-slate-50 text-slate-600',
};

const TERMINAL = ['COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED', 'CANCELLED'];

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
  const [openFailures, setOpenFailures] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => classApi.getAll().then((r) => r.data) });
  const { data: terms } = useQuery({ queryKey: ['terms'], queryFn: () => termApi.getAll().then((r) => r.data) });
  const { data: dashboard } = useQuery({ queryKey: ['results-sms-dashboard'], queryFn: () => resultsSmsApi.getDashboard().then((r) => r.data) });
  const { data: settings } = useQuery({ queryKey: ['results-sms-settings'], queryFn: () => resultsSmsApi.getSettings().then((r) => r.data) });
  const { data: preview, isLoading, isError: previewFailed, error: previewError } = useQuery({
    queryKey: ['results-sms-preview', classId, termId],
    queryFn: () => resultsSmsApi.preview(classId, termId).then((r) => r.data), enabled: Boolean(classId && termId),
  });

  // Live status of the currently focused batch. Polls while it is active and
  // stops once it reaches a terminal state (the completion card stays visible).
  const { data: batchStatus } = useQuery({
    queryKey: ['results-sms-batch-status', activeBatchId],
    queryFn: () => resultsSmsApi.getBatchStatus(activeBatchId!).then((r) => r.data),
    enabled: Boolean(activeBatchId),
    refetchInterval: (q: any) => (activeBatchId && !TERMINAL.includes(q.state.data?.status ?? '') ? 5000 : false),
  });

  // Recent batches keep a processing send visible across page refreshes.
  const { data: recentBatches } = useQuery({
    queryKey: ['results-sms-batches'],
    queryFn: () => resultsSmsApi.getBatches(25).then((r) => r.data),
    refetchInterval: 15000,
  });
  useEffect(() => {
    if (activeBatchId) return;
    const active = (recentBatches || []).find((b: any) => b.active);
    if (active) {
      setActiveBatchId(active.id);
      setShowCompletion(false);
      setTab('history');
    }
  }, [activeBatchId, recentBatches]);

  useEffect(() => {
    if (batchStatus && TERMINAL.includes(batchStatus.status)) {
      setShowCompletion(true);
      queryClient.invalidateQueries({ queryKey: ['results-sms'] });
    }
  }, [batchStatus, queryClient]);

  const failedLogs = useQuery({
    queryKey: ['results-sms-failed', openFailures],
    queryFn: () => resultsSmsApi.getFailedLogs(openFailures!).then((r) => r.data),
    enabled: Boolean(openFailures),
  });

  const { data: history } = useQuery({ queryKey: ['results-sms-history', classId, termId], queryFn: () => resultsSmsApi.getHistory(classId || undefined, termId || undefined).then((r) => r.data), enabled: tab === 'history' && !activeBatchId });
  const { data: failed } = useQuery({ queryKey: ['results-sms-failed-queue'], queryFn: () => resultsSmsApi.getFailedLogs().then((r) => r.data), enabled: tab === 'failed' });

  const send = useMutation({
    mutationFn: () => resultsSmsApi.send({ classId, termId, studentIds: scope === 'selected' ? selectedStudents : undefined, allowResend }),
    onSuccess: (response: any) => {
      setConfirm(false); setAllowResend(false); setShowCompletion(false);
      setActiveBatchId(response.data?.batchId || null);
      setTab('history');
      queryClient.invalidateQueries({ queryKey: ['results-sms'] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const batchId = err?.response?.data?.batchId;
      if (code === 'DUPLICATE_BATCH' && batchId) {
        setConfirm(false); setActiveBatchId(batchId); setShowCompletion(false); setTab('history');
      }
    },
  });
  const retry = useMutation({ mutationFn: (id: string) => resultsSmsApi.retry(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['results-sms'] }) });
  const retryBatch = useMutation({ mutationFn: () => resultsSmsApi.retryFailedBatch(activeBatchId!), onSuccess: (response: any) => { setActiveBatchId(response.data?.batchId || null); setOpenFailures(null); queryClient.invalidateQueries({ queryKey: ['results-sms'] }); } });
  const cancelBatch = useMutation({ mutationFn: () => resultsSmsApi.cancelBatch(activeBatchId!), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['results-sms'] }) });

  const students = useMemo(() => {
    const grouped = new Map<string, any>();
    (preview?.recipients || []).forEach((r: any) => { if (!grouped.has(r.studentId)) grouped.set(r.studentId, r); });
    return Array.from(grouped.values());
  }, [preview]);
  const target = (preview?.recipients || []).filter((r: any) => r.phoneStatus === 'VALID' && (scope === 'all' || selectedStudents.includes(r.studentId)));
  const alreadySent = target.filter((r: any) => r.alreadySent).length;
  const segments = target.reduce((sum: number, r: any) => sum + r.segments, 0);
  const activeForScope = (recentBatches || []).some((b: any) => b.active && classId && b.classId === classId && b.termId === termId);

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
            <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400"><tr><th className="w-10 py-3">{scope === 'selected' && <input type="checkbox" checked={selectedStudents.length === students.length && students.length > 0} onChange={(e) => setSelectedStudents(e.target.checked ? students.map((s) => s.studentId) : [])} />}</th><th>Student</th><th>Parent / phone</th><th>Status</th><th>Message</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((r: any) => <tr key={r.studentId} className="hover:bg-slate-50"><td className="py-3">{scope === 'selected' && <input type="checkbox" checked={selectedStudents.includes(r.studentId)} onChange={() => setSelectedStudents((x) => x.includes(r.studentId) ? x.filter((id) => id !== r.studentId) : [...x, r.studentId])} />}</td><td className="py-3"><div className="font-medium text-slate-900">{r.studentName}</div><div className="text-xs text-slate-500">{r.admissionNumber || 'No admission number'}</div></td><td><div className="text-slate-700">{r.parentName}</div><div className="font-mono text-xs text-slate-500">{r.phoneNumber ? maskPhone(r.phoneNumber) : 'No number'}</div></td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[r.phoneStatus]}`}>{r.phoneStatus === 'VALID' ? 'Ready' : r.errorCode === 'NO_PHONE_NUMBER' ? 'No phone' : 'Invalid'}</span>{r.alreadySent && <div className="mt-1 text-xs font-semibold text-amber-700">Already sent</div>}</td><td><button onClick={() => setOpenStudent(openStudent === r.studentId ? null : r.studentId)} className="text-indigo-600 hover:underline">{openStudent === r.studentId ? 'Hide preview' : 'Preview SMS'}</button></td></tr>)}{openStudent && <tr><td colSpan={5} className="bg-slate-50 p-4"><MessagePreview recipient={students.find((s: any) => s.studentId === openStudent)} /></td></tr>}</tbody></table></div>
          </section>
          <section className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 md:flex-row md:items-center md:justify-between"><div><div className="text-sm font-semibold text-indigo-950">Send summary</div><div className="mt-1 text-sm text-indigo-800">{scope === 'selected' ? selectedStudents.length : preview.totalStudents} students · {target.length} valid recipients · {segments} estimated units</div>{activeForScope && <div className="mt-2 text-xs font-medium text-amber-800">A send for this class/assessment is already processing — start another only after it finishes or was cancelled.</div>}{preview.multiSegment && <div className="mt-2 text-xs font-medium text-amber-800">Some messages exceed 160 characters and will use multiple billable segments.</div>}{alreadySent > 0 && <div className="mt-2 text-xs font-medium text-amber-800">{alreadySent} result notification(s) match a previously sent result version.</div>}</div><PermissionGuard permission="communications.send"><button disabled={!target.length || (scope === 'selected' && !selectedStudents.length) || !settings?.smsEnabled || activeForScope} onClick={() => setConfirm(true)} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">Review and confirm</button></PermissionGuard></section>
        </>}
      </>}

      {tab === 'history' && <>
        {activeBatchId && batchStatus && <BatchProgress status={batchStatus} onDismiss={() => setActiveBatchId(null)} onViewFailures={() => setOpenFailures(activeBatchId)} onRetryFailed={() => retryBatch.mutate()} onCancel={() => cancelBatch.mutate()} retryPending={retryBatch.isPending} cancelPending={cancelBatch.isPending} />}
        {showCompletion && activeBatchId && !batchStatus && <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading batch progress…</div>}
        {!activeBatchId && <LogTable title="Recent sends" rows={(recentBatches || []).filter((b: any) => !b.active)} batch />}
      </>}
      {tab === 'failed' && <LogTable title="Failed SMS diagnostics" rows={failed || []} onRetry={(id: string) => retry.mutate(id)} />}

      {confirm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold text-slate-950">Confirm Results SMS</h2><p className="mt-2 text-sm text-slate-600">Send the exact previews to <strong>{target.length} valid parent number(s)</strong> using approximately <strong>{segments} SMS unit(s)</strong>.</p>{alreadySent > 0 && <label className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={allowResend} onChange={(e) => setAllowResend(e.target.checked)} />Allow explicit resend of {alreadySent} already-sent result version(s).</label>}<div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirm(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button onClick={() => send.mutate()} disabled={send.isPending || (alreadySent > 0 && !allowResend)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{send.isPending ? 'Starting…' : 'Send results SMS'}</button></div>{send.isError && <p className="mt-3 text-sm text-rose-600">{String((send.error as any)?.response?.data?.message || 'Unable to send. Review provider and balance settings.')}</p>}</div></div>}
      {openFailures && <FailuresModal batchId={openFailures} rows={failedLogs.data || []} loading={failedLogs.isLoading} onClose={() => setOpenFailures(null)} onRetry={() => retryBatch.mutate()} retryPending={retryBatch.isPending} hasRetryable={Array.isArray(failedLogs.data) && failedLogs.data.some((l: any) => ['FAILED', 'REJECTED', 'INVALID_NUMBER', 'PROVIDER_ERROR', 'INSUFFICIENT_BALANCE'].includes(l.status))} />}
    </div>
  </PermissionGuard>;
}

function Select({ label, value, onChange, options, placeholder }: any) { return <div><label className="mb-2 block text-sm font-medium text-slate-700">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"><option value="">{placeholder}</option>{(Array.isArray(options) ? options : []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>; }
function MessagePreview({ recipient }: { recipient: any }) { if (!recipient) return null; return <div><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Exact SMS preview</span><span>{recipient.characters} characters · {recipient.segments} segment(s) · {recipient.estimatedUnits} unit(s)</span></div><div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-slate-700">{recipient.message}</div><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">{recipient.result.subjects.map((s: any) => <span key={s.name} className="rounded bg-slate-100 px-2 py-1">{s.name}: {recipient.result.bestSix != null ? `Points ${s.points ?? '-'}` : s.absent ? 'Absent' : s.mark ?? '-'} {recipient.result.bestSix == null ? (s.grade || '') : ''}</span>)}</div></div>; }

function maskPhone(p: string) { if (!p) return 'n/a'; return p.length > 7 ? `${p.slice(0, 5)}••••${p.slice(-3)}` : '••' + p.slice(-3); }

function activityLabel(s: any) {
  if (s.stalled) return `No processing activity detected for ${s.lastActivitySecondsAgo}s. The batch may be stuck.`;
  if (s.status === 'QUEUED') return 'Waiting for the SMS worker to start…';
  if (s.status === 'STARTING') return 'Starting the SMS worker…';
  if (s.status === 'PROCESSING') {
    if (s.sending > 0) return `Sending ${s.sending} message(s) now…`;
    if (s.retrying > 0) return `Waiting for scheduled retries${s.sent || s.failed ? ' — the batch is still progressing' : '…'}`;
    if (s.queued > 0) return 'Waiting for the SMS provider…';
    if (s.sent + s.failed > 0) return `Sending results — ${s.sent} sent, ${s.failed} failed…`;
    return 'Waiting for the SMS worker to start…';
  }
  return '';
}

function statusPill(status: string) {
  const map: Record<string, string> = {
    QUEUED: 'bg-amber-100 text-amber-800', STARTING: 'bg-indigo-100 text-indigo-800', PROCESSING: 'bg-sky-100 text-sky-800',
    COMPLETED: 'bg-emerald-100 text-emerald-800', COMPLETED_WITH_FAILURES: 'bg-amber-100 text-amber-800', FAILED: 'bg-rose-100 text-rose-800', CANCELLED: 'bg-slate-200 text-slate-700',
  };
  return map[status] || 'bg-slate-100 text-slate-700';
}

function BatchProgress({ status: s, onDismiss, onViewFailures, onRetryFailed, onCancel, retryPending, cancelPending }: any) {
  const terminal = TERMINAL.includes(s.status);
  const failed = terminal ? (s.failed || 0) : (s.failed + s.retrying + (s.sending || 0));
  const elapsed = useElapsed(s.startedAt || s.queuedAt);
  return <section className={`rounded-2xl border p-5 shadow-sm ${terminal ? (s.failed > 0 && s.status !== 'COMPLETED' ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60') : 'border-indigo-100 bg-indigo-50/60'}`}>
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {terminal ? <h2 className="text-lg font-bold text-slate-950">Results SMS {(s.status === 'COMPLETED' ? 'completed' : s.status === 'COMPLETED_WITH_FAILURES' ? 'completed with failures' : s.status === 'FAILED' ? 'failed' : 'cancelled')}</h2>
            : <h2 className="text-lg font-bold text-slate-950">Sending results to parents</h2>}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusPill(s.status)}`}>{s.status.replace(/_/g, ' ').toLowerCase()}</span>
        </div>
        <p className="font-mono text-xs text-slate-500">Batch {s.batchId}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-slate-950">{s.progress}%</span>
        <span className="text-xs text-slate-500">complete</span>
      </div>
    </div>
    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-indigo-100"><div className={`h-full rounded-full transition-all ${terminal ? (s.failed > 0 && s.status !== 'COMPLETED' ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-indigo-600'}`} style={{ width: `${s.progress}%` }} /></div>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
      <span className="text-slate-900"><strong>{s.total}</strong> total</span>
      <span className="text-emerald-700"><strong>{s.sent}</strong> sent</span>
      <span className="text-rose-700"><strong>{s.failed}</strong> failed</span>
      <span className="text-orange-600"><strong>{s.retrying ?? 0}</strong> retrying</span>
      <span className="text-indigo-700"><strong>{s.sending ?? 0}</strong> sending</span>
      <span className="text-slate-400"><strong>{s.skipped ?? 0}</strong> skipped</span>
      <span className="text-amber-700"><strong>{s.pending ?? 0}</strong> pending</span>
      <span className="text-slate-500"><strong>{s.estimatedUnits}</strong> units</span>
    </div>
    {!terminal && <div className="mt-4 space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" /><span>{activityLabel(s)}</span></div>
      <div className="text-xs text-slate-500">Last activity: <span className="font-semibold">{s.lastActivitySecondsAgo}s ago</span> · Elapsed: {formatElapsed(elapsed)}</div>
      {s.stalled && <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><strong>This batch has not made progress for a while.</strong> The system is automatically recovering it: any queued messages will be retried in-process, and in-flight messages are classified rather than resent to avoid duplicates. If it does not recover on its own, check that the SMS provider is configured and online.</div>}
    </div>}
    {terminal && <div className="mt-4 rounded-xl bg-white/70 p-3 text-sm text-slate-700">
      <p><strong>{s.sent}</strong> sent{s.sent === s.total - (s.skipped ?? 0) ? ' — every valid phone was reached.' : ''}</p>
      {s.failed > 0 && <p className="mt-1 text-rose-700"><strong>{s.failed} messages failed</strong>{s.errorMessage ? ` · ${s.errorMessage}` : ''}{s.errorSuggestion ? ` — ${s.errorSuggestion}` : ''}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {s.failed > 0 && <button onClick={onViewFailures} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">View failures</button>}
        {s.failed > 0 && <button onClick={onRetryFailed} disabled={retryPending} className="rounded-lg border border-indigo-600 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{retryPending ? 'Retrying…' : 'Retry failed'}</button>}
        {s.status === 'PROCESSING' || s.status === 'QUEUED' || s.status === 'STARTING' ? <button onClick={onCancel} disabled={cancelPending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">{cancelPending ? 'Cancelling…' : 'Cancel batch'}</button> : null}
        <button onClick={onDismiss} className="ml-auto rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-white">Dismiss</button>
      </div>
    </div>}
  </section>;
}

function useElapsed(from?: string) {
  const [, tick] = useState(0);
  useEffect(() => { if (!from) return; const t = setInterval(() => tick((v) => v + 1), 1000); return () => clearInterval(t); }, [from]);
  if (!from) return '—';
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 1000));
}
function formatElapsed(seconds: number) { const s = Math.floor(seconds); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`; }

function FailuresModal({ batchId, rows, loading, onClose, onRetry, retryPending, hasRetryable }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-lg font-bold text-slate-950">Failed messages · {batchId}</h2><p className="text-sm text-slate-500">{loading ? 'Loading…' : `${rows.length} failed / skipped message(s)`}</p></div><button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Close</button></div><div className="flex-1 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-3 pl-5 pr-3">Student</th><th className="px-3 py-3">Phone</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Reason</th><th className="py-3 pl-3 pr-5">Attempts</th></tr></thead><tbody className="divide-y divide-slate-100">{(rows || []).map((r: any) => <tr key={r.id}><td className="py-3 pl-5 pr-3"><div className="font-medium text-slate-900">{r.studentName}</div><div className="text-xs text-slate-500">{r.admissionNumber || ''}</div></td><td className="px-3 py-3 font-mono text-xs text-slate-600">{maskPhone(r.phoneNumber)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status}</span></td><td className="px-3 py-3 text-xs text-slate-600"><div>{r.errorMessage || recommendation(r)}</div>{r.errorSuggestion && !r.errorMessage && <div className="text-rose-600">{r.errorSuggestion}</div>}</td><td className="py-3 pl-3 pr-5 text-slate-600">{r.retryCount || 0}{r.failedAt ? <div className="text-xs text-slate-400">{new Date(r.failedAt).toLocaleString()}</div> : null}</td></tr>)}</tbody></table></div>{hasRetryable && <div className="flex items-center justify-between border-t border-slate-100 p-4"><p className="text-sm text-slate-600">Re-validates parent numbers and queues a fresh send for the failed students only.</p><button onClick={onRetry} disabled={retryPending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{retryPending ? 'Retrying…' : 'Retry failed'}</button></div>}</div></div>;
}

function LogTable({ title, rows, onRetry, batch }: any) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-950">{title}</h2>{!rows.length ? <div className="py-12 text-center text-sm text-slate-500">No records found.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-3">{batch ? 'Batch' : 'Student'}</th><th className="py-3">{batch ? 'Created' : 'Phone / reason'}</th><th>Status</th><th className="py-3">{batch ? 'Volume' : 'Action'}</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r: any) => <tr key={(r.batchId || r.id) + '-' + (r.createdAt || r.status || '')}><td className="py-3 font-medium text-slate-800">{batch ? r.batchId : `${r.studentName} (${r.admissionNumber || 'N/A'})`}</td><td className="py-3 text-slate-500">{batch ? new Date(r.createdAt || r.queuedAt).toLocaleString() : <>{r.phoneNumber || 'No phone'}<div className="text-xs text-rose-600">{r.errorMessage || r.errorSuggestion || recommendation(r)}</div></>}</td><td>{batch ? <span className="text-xs text-slate-600">{r.sent} sent · {r.failed} failed · {r.skipped} skipped{r.active && ' · processing'}</span> : <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status}</span>}</td><td>{batch ? `${r.total} messages · ${r.units ?? r.estimatedUnits ?? 0} units` : onRetry && <button onClick={() => onRetry(r.id)} className="text-sm font-semibold text-indigo-600 hover:underline">Retry</button>}</td></tr>)}</tbody></table></div>}</section>; }

function recommendation(row: any) { if (row.status === 'INVALID_NUMBER') return 'Update the parent phone number in Parent Management.'; if (row.status === 'INSUFFICIENT_BALANCE') return 'Top up SMS units in Communications Wallet.'; if (row.status === 'PROVIDER_ERROR') return 'Check provider settings and retry.'; return row.status === 'SKIPPED' ? 'Add a valid parent phone number, then send again.' : ''; }