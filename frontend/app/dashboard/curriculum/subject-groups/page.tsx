'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi, subjectApi } from '@/lib/api';

export default function SubjectGroupsPage() {
  const [showModal, setShowModal] = useState<'group' | 'assign' | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', category: 'CORE', curriculumVersionId: '', minSelection: 0, maxSelection: 0 });
  const [assignForm, setAssignForm] = useState({ subjectId: '', isCompulsory: false, sortOrder: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['subject-groups'],
    queryFn: async () => { const res = await curriculumApi.getSubjectGroups(); return res.data?.data || res.data || []; },
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => { const res = await subjectApi.getAll(); return res.data?.data || res.data || []; },
  });

  const { data: versions } = useQuery({
    queryKey: ['curriculum-versions'],
    queryFn: async () => { const res = await curriculumApi.getVersions(); return res.data?.data || res.data || []; },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createSubjectGroup(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subject-groups'] }); setShowModal(null); setForm({ name: '', code: '', description: '', category: 'CORE', curriculumVersionId: '', minSelection: 0, maxSelection: 0 }); setMessage({ type: 'success', text: 'Group created' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ groupId, subjectId, data }: any) => curriculumApi.assignSubjectToGroup(groupId, subjectId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subject-groups'] }); setShowModal(null); setAssignForm({ subjectId: '', isCompulsory: false, sortOrder: 0 }); setMessage({ type: 'success', text: 'Subject assigned' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  const removeSubjectMutation = useMutation({
    mutationFn: ({ groupId, subjectId }: any) => curriculumApi.removeSubjectFromGroup(groupId, subjectId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subject-groups'] }); setMessage({ type: 'success', text: 'Subject removed' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subject Groups</h1>
          <p className="text-gray-500 mt-1">Organise subjects into core, elective, and optional groups.</p>
        </div>
        <button onClick={() => setShowModal('group')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Group</button>
      </div>

      {message && <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>}

      {isLoading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="grid gap-4">
          {(groups as any[])?.map((g: any) => (
            <div key={g.id} className="bg-white rounded-lg shadow border border-gray-100">
              <div className="p-4 flex justify-between items-center border-b">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{g.name}</h3>
                    <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: g.category === 'CORE' ? '#dbeafe' : g.category === 'ELECTIVE' ? '#fef3c7' : '#f3e8ff', color: g.category === 'CORE' ? '#1d4ed8' : g.category === 'ELECTIVE' ? '#b45309' : '#6b21a8' }}>{g.category}</span>
                    <span className="text-xs text-gray-400 font-mono">{g.code}</span>
                  </div>
                  {g.description && <p className="text-sm text-gray-500 mt-0.5">{g.description}</p>}
                  {(g.minSelection || g.maxSelection) && <p className="text-xs text-gray-400 mt-0.5">Selection: {g.minSelection || 0} – {g.maxSelection || '∞'} subjects</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedGroup(g); setShowModal('assign'); }} className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">Assign Subject</button>
                </div>
              </div>
              {g.subjects && g.subjects.length > 0 && (
                <div className="px-4 py-2 bg-gray-50">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500"><th className="py-1 pr-4">Subject</th><th className="py-1 pr-4">Compulsory</th><th className="py-1 pr-4">Order</th><th className="py-1 text-right">Actions</th></tr></thead>
                    <tbody>
                      {g.subjects.map((gs: any) => (
                        <tr key={`${g.id}-${gs.subjectId}`} className="border-t border-gray-100">
                          <td className="py-1.5 pr-4 text-gray-700">{gs.subject?.name || gs.subjectId}</td>
                          <td className="py-1.5 pr-4">{gs.isCompulsory ? <span className="text-green-600 text-xs font-semibold">YES</span> : <span className="text-gray-400 text-xs">no</span>}</td>
                          <td className="py-1.5 pr-4 text-gray-500">{gs.sortOrder || '-'}</td>
                          <td className="py-1.5 text-right"><button onClick={() => removeSubjectMutation.mutate({ groupId: g.id, subjectId: gs.subjectId })} className="text-red-500 hover:text-red-700 text-xs">Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {(!groups || (groups as any[]).length === 0) && <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">No subject groups configured.</div>}
        </div>
      )}

      {showModal === 'group' && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Subject Group</h2>
            <div className="space-y-3">
              <input placeholder="Code (e.g. CORE, ELECTIVE_1)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Name (e.g. Core Subjects)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={2} />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="CORE">Core</option>
                <option value="ELECTIVE">Elective</option>
                <option value="OPTIONAL">Optional</option>
                <option value="SPECIAL">Special</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Min Selection" value={form.minSelection} onChange={(e) => setForm({ ...form, minSelection: parseInt(e.target.value) || 0 })} className="border rounded-lg px-3 py-2" />
                <input type="number" placeholder="Max Selection" value={form.maxSelection} onChange={(e) => setForm({ ...form, maxSelection: parseInt(e.target.value) || 0 })} className="border rounded-lg px-3 py-2" />
              </div>
              <select value={form.curriculumVersionId} onChange={(e) => setForm({ ...form, curriculumVersionId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Curriculum Version (optional)</option>
                {(versions as any[])?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.code || !form.name} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{createMutation.isPending && <svg className="animate-spin h-4 w-4 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}{createMutation.isPending ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'assign' && selectedGroup && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Assign Subject to {selectedGroup.name}</h2>
            <div className="space-y-3">
              <select value={assignForm.subjectId} onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Select Subject</option>
                {(subjects as any[])?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label className="flex items-center gap-2"><input type="checkbox" checked={assignForm.isCompulsory} onChange={(e) => setAssignForm({ ...assignForm, isCompulsory: e.target.checked })} className="rounded" /> Compulsory</label>
              <input type="number" placeholder="Sort Order" value={assignForm.sortOrder} onChange={(e) => setAssignForm({ ...assignForm, sortOrder: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => assignMutation.mutate({ groupId: selectedGroup.id, subjectId: assignForm.subjectId, data: { isCompulsory: assignForm.isCompulsory, sortOrder: assignForm.sortOrder } })} disabled={assignMutation.isPending || !assignForm.subjectId} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">{assignMutation.isPending && <svg className="animate-spin h-4 w-4 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}{assignMutation.isPending ? 'Assigning...' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
