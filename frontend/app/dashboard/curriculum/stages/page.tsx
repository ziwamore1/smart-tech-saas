'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi } from '@/lib/api';

export default function AcademicStagesPage() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', sortOrder: 0, educationLevelId: '', curriculumVersionId: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: stages, isLoading } = useQuery({
    queryKey: ['academic-stages'],
    queryFn: async () => { const res = await curriculumApi.getStages(); return res.data?.data || res.data || []; },
  });

  const { data: levels } = useQuery({
    queryKey: ['education-levels'],
    queryFn: async () => { const res = await curriculumApi.getEducationLevels(); return res.data?.data || res.data || []; },
  });

  const { data: versions } = useQuery({
    queryKey: ['curriculum-versions'],
    queryFn: async () => { const res = await curriculumApi.getVersions(); return res.data?.data || res.data || []; },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createStage(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-stages'] }); setShowModal(false); setForm({ name: '', code: '', sortOrder: 0, educationLevelId: '', curriculumVersionId: '' }); setMessage({ type: 'success', text: 'Stage created' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => curriculumApi.deleteStage(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['academic-stages'] }); setMessage({ type: 'success', text: 'Deleted' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Academic Stages</h1>
          <p className="text-gray-500 mt-1">Define grades, forms, and stages within each education level.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Stage</button>
      </div>

      {message && <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>}

      {isLoading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Order</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Code</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Education Level</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(stages as any[])?.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{s.sortOrder}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-violet-100 text-violet-800 rounded text-xs font-mono">{s.code}</span></td>
                  <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{s.educationLevel?.name || s.educationLevelId}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => deleteMutation.mutate(s.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </td>
                </tr>
              ))}
              {(!stages || (stages as any[]).length === 0) && <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No academic stages.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Academic Stage</h2>
            <div className="space-y-3">
              <input placeholder="Code (e.g. G1, F1)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Name (e.g. Grade 1, Form 1)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input type="number" placeholder="Sort Order" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" />
              <select value={form.educationLevelId} onChange={(e) => setForm({ ...form, educationLevelId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Select Education Level</option>
                {(levels as any[])?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select value={form.curriculumVersionId} onChange={(e) => setForm({ ...form, curriculumVersionId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Select Curriculum Version (optional)</option>
                {(versions as any[])?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.code || !form.name || !form.educationLevelId} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
