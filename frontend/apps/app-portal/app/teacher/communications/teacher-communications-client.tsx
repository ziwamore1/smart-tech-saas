'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { messagesApi, resultsSmsApi, teacherApi, termApi } from '@/lib/api';

const unwrap = (value: any) => value?.data?.data || value?.data || value || [];

export default function TeacherCommunicationsPage() {
  const { user, isClassTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [activeConversation, setActiveConversation] = useState('');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');

  const { data: teacher } = useQuery({ queryKey: ['my-teacher-profile'], queryFn: () => teacherApi.getById('me').then(r => unwrap(r)) });
  const { data: classes = [] } = useQuery({ queryKey: ['teacher-classes'], queryFn: () => teacherApi.getClasses().then(r => { const value = unwrap(r); return Array.isArray(value) ? value : value.classes || []; }) });
  const { data: terms = [] } = useQuery({ queryKey: ['terms'], queryFn: () => termApi.getAll().then(r => { const value = unwrap(r); return Array.isArray(value) ? value : value.terms || []; }) });
  const assignedClass = teacher?.classTeacherOf;
  const visibleClasses = isClassTeacher && assignedClass ? [assignedClass] : classes;
  const currentTerm = terms.find((term: any) => term.isCurrent);

  useEffect(() => { if (!classId && assignedClass?.id) setClassId(assignedClass.id); }, [assignedClass, classId]);
  useEffect(() => { if (!termId && currentTerm?.id) setTermId(currentTerm.id); }, [currentTerm, termId]);

  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ['teacher-result-delivery-preview', classId, termId],
    queryFn: () => resultsSmsApi.preview(classId, termId).then(r => unwrap(r)),
    enabled: !!classId && !!termId && isClassTeacher,
    refetchInterval: 20000,
  });
  const { data: conversations = [] } = useQuery({
    queryKey: ['teacher-messages'],
    queryFn: () => messagesApi.getConversations().then(r => unwrap(r)),
    refetchInterval: 20000,
  });
  const { data: thread } = useQuery({
    queryKey: ['teacher-message-thread', activeConversation],
    queryFn: () => messagesApi.getConversation(activeConversation).then(r => unwrap(r)),
    enabled: !!activeConversation,
  });
  const { data: failedLogs = [], refetch: refetchFailed } = useQuery({
    queryKey: ['teacher-result-delivery-failures', classId, termId],
    queryFn: () => resultsSmsApi.getFailedLogs(undefined, classId, termId).then(r => unwrap(r)),
    enabled: !!classId && !!termId && isClassTeacher,
  });

  const students = useMemo(() => {
    const grouped = new Map<string, any>();
    (preview?.recipients || []).forEach((row: any) => {
      if (!grouped.has(row.studentId)) grouped.set(row.studentId, { ...row, rows: [] });
      grouped.get(row.studentId).rows.push(row);
    });
    return Array.from(grouped.values());
  }, [preview]);
  const failed = students.filter((student: any) => student.rows.some((row: any) => row.phoneStatus !== 'VALID' || row.errorCode || row.status === 'FAILED')).length + failedLogs.length;
  const alreadySent = students.filter((student: any) => student.rows.some((row: any) => row.alreadySent));
  const eligible = students.filter((student: any) => student.rows.every((row: any) => !row.alreadySent && row.phoneStatus === 'VALID'));

  const send = async (studentIds?: string[]) => {
    try {
      await resultsSmsApi.send({ classId, termId, studentIds: studentIds || eligible.map((s: any) => s.studentId) });
      setNotice('Results queued. This page will keep the permanent delivery record updated.');
      setSelectedStudents([]);
      refetchPreview();
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'Results could not be queued. Resolve the listed issues and try again.');
    }
  };
  const sendMessage = async () => {
    if (!activeConversation || !draft.trim()) return;
    await messagesApi.sendMessage(activeConversation, draft.trim());
    setDraft('');
    queryClient.invalidateQueries({ queryKey: ['teacher-message-thread', activeConversation] });
    queryClient.invalidateQueries({ queryKey: ['teacher-messages'] });
  };

  if (!isClassTeacher) return <div className="max-w-3xl mx-auto px-4 py-16 text-center"><h1 className="text-2xl font-bold">Class teacher access required</h1><p className="text-gray-500 mt-2">Only the assigned class teacher can manage parent result delivery.</p></div>;

  return <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div><Link href="/teacher" className="text-sm text-blue-600">← Dashboard</Link><h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">Class Communications</h1><p className="text-gray-500 mt-1">Talk to parents and own the delivery record for your class.</p></div>
      <button onClick={() => refetchPreview()} className="px-3 py-2 rounded-lg border bg-white text-sm">Refresh records</button>
    </div>
    {notice && <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{notice}</div>}
    <section className="bg-white rounded-xl border shadow-sm p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm font-medium text-gray-700">Class<select value={classId} onChange={e => setClassId(e.target.value)} className="block mt-1 min-w-[180px] border rounded-lg px-3 py-2"><option value="">Select class</option>{visibleClasses.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Term<select value={termId} onChange={e => setTermId(e.target.value)} className="block mt-1 min-w-[180px] border rounded-lg px-3 py-2"><option value="">Select term</option>{terms.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button onClick={() => send()} disabled={!eligible.length || previewLoading} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">Send unresolved valid results ({eligible.length})</button>
      </div>
      <p className="text-xs text-gray-500 mt-3">Previously sent result versions are protected. Network interruptions do not create a duplicate send.</p>
    </section>
    {failedLogs.length > 0 && <section className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6"><h2 className="font-semibold text-red-900">Previously failed deliveries ({failedLogs.length})</h2><p className="text-sm text-red-800 mt-1">Resolve the stated action, then retry only the affected student.</p><div className="mt-3 space-y-2">{failedLogs.map((log: any) => <div key={log.id} className="bg-white rounded-lg border border-red-100 p-3 flex flex-wrap gap-2 items-center justify-between"><div><p className="font-medium text-sm">{log.studentName} · {log.parentName || 'Parent'}</p><p className="text-xs text-red-700 mt-1">{log.errorMessage || log.failureCode || 'Delivery failed.'}</p><p className="text-xs text-gray-600 mt-1"><strong>Action:</strong> {log.errorSuggestion || 'Correct the parent contact or provider setting, then retry.'}</p></div><button onClick={async () => { await resultsSmsApi.retry(log.id); setNotice(`Retry queued for ${log.studentName}.`); refetchPreview(); refetchFailed(); }} className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold">Retry affected student</button></div>)}</div></section>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {[['Class students', students.length, 'bg-slate-50'], ['Sent and recorded', alreadySent.length, 'bg-green-50'], ['Needs action', failed.length, 'bg-red-50'], ['Ready to send', eligible.length, 'bg-blue-50']].map(([label, value, color]) => <div key={String(label)} className={`${color} rounded-xl p-4 border`}><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div>)}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      <section className="xl:col-span-3 bg-white rounded-xl border shadow-sm overflow-hidden"><div className="p-4 border-b"><h2 className="font-semibold">Student delivery checklist</h2><p className="text-xs text-gray-500 mt-1">Only unresolved students can be selected for another send.</p></div>{previewLoading ? <p className="p-8 text-center text-gray-500">Loading delivery records...</p> : <div className="divide-y">{students.map((student: any) => { const rows = student.rows; const sent = rows.every((row: any) => row.alreadySent); const problem = rows.find((row: any) => row.phoneStatus !== 'VALID' || row.errorCode); const selected = selectedStudents.includes(student.studentId); return <div key={student.studentId} className={`p-4 ${problem ? 'bg-red-50/50' : sent ? 'bg-green-50/40' : ''}`}><div className="flex gap-3 items-start"><input type="checkbox" checked={selected} disabled={sent || !rows.some((row: any) => row.phoneStatus === 'VALID')} onChange={() => setSelectedStudents(old => selected ? old.filter(id => id !== student.studentId) : [...old, student.studentId])} className="mt-1"/><div className="min-w-0 flex-1"><p className="font-medium">{student.studentName} <span className="text-xs text-gray-400">{student.admissionNumber || ''}</span></p><p className="text-xs text-gray-500 mt-1">{sent ? `Sent ${rows[0].previousStatus || 'successfully'} and protected from duplicate sends` : problem ? (problem.errorMessage || problem.errorSuggestion || 'Delivery information is incomplete.') : 'Ready for delivery'}</p>{problem && <p className="text-xs text-red-700 mt-1"><strong>Action:</strong> {problem.errorSuggestion || (problem.errorCode === 'NO_PHONE_NUMBER' ? 'Add a parent phone number in Parent Management.' : 'Correct the parent contact details, then refresh this checklist.')}</p>}</div><span className={`shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${sent ? 'bg-green-100 text-green-700' : problem ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{sent ? 'Sent' : problem ? 'Blocked' : 'Ready'}</span></div>{problem && <Link href={`/teacher/class#parent-${student.studentId}`} className="inline-block ml-7 mt-2 text-xs font-semibold text-blue-700 underline">Fix student contact in My Class →</Link>}</div>; })}{!students.length && <p className="p-8 text-center text-gray-500">Select a class and term to load the delivery checklist.</p>}</div>}</section>
      <section className="xl:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col min-h-[420px]"><div className="p-4 border-b"><h2 className="font-semibold">Parent conversations</h2><p className="text-xs text-gray-500 mt-1">Questions about performance or behaviour stay in the platform.</p></div><div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 min-h-0"><div className="border-b sm:border-b-0 xl:border-b sm:border-r xl:border-r-0 divide-y overflow-y-auto max-h-72 sm:max-h-none xl:max-h-52">{conversations.map((conversation: any) => <button key={conversation.id} onClick={() => setActiveConversation(conversation.id)} className={`w-full text-left p-3 ${activeConversation === conversation.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}><p className="font-medium text-sm truncate">{(conversation.participantDetails || []).filter((p: any) => p.id !== user?.id).map((p: any) => p.name).join(', ') || 'Parent'}</p><p className="text-xs text-gray-500 truncate mt-1">{conversation.lastMessage || 'No messages yet'}</p></button>)}{!conversations.length && <p className="p-5 text-sm text-gray-500">Parent conversations will appear here.</p>}</div><div className="flex flex-col min-h-[220px]"><div className="flex-1 p-3 space-y-2 overflow-y-auto bg-gray-50">{thread?.messages?.map((message: any) => <div key={message.id} className={`max-w-[90%] rounded-lg p-2 text-sm ${message.senderId === user?.id ? 'ml-auto bg-blue-600 text-white' : 'bg-white border'}`}>{message.content}</div>)}{!activeConversation && <p className="text-sm text-gray-500">Select a parent conversation.</p>}</div><div className="p-3 border-t flex gap-2"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Reply to parent..." className="min-w-0 flex-1 border rounded-lg px-3 py-2 text-sm"/><button onClick={sendMessage} disabled={!activeConversation || !draft.trim()} className="px-3 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">Send</button></div></div></div></section>
    </div>
    {selectedStudents.length > 0 && <button onClick={() => send(selectedStudents)} className="fixed bottom-4 right-4 px-5 py-3 rounded-full bg-green-600 text-white font-semibold shadow-lg">Send selected ({selectedStudents.length})</button>}
  </div>;
}
