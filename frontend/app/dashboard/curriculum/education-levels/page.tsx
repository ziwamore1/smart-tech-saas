'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi } from '@/lib/api';

export default function EducationLevelsPage() {
  const [showModal, setShowModal] = useState<'create' | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: levels, isLoading } = useQuery({
    queryKey: ['education-levels'],
    queryFn: async () => {
      const res = await curriculumApi.getEducationLevels();
      return res.data?.data || res.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createEducationLevel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education-levels'] });
      setShowModal(null); setForm({ name: '', code: '', description: '' });
      setMessage({ type: 'success', text: 'Education level created' });
    },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => curriculumApi.deleteEducationLevel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['education-levels'] }); setMessage({ type: 'success', text: 'Deleted' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Education Levels</h1>
          <p className="text-gray-500 mt-1">Define the education structure for your institution.</p>
        </div>
        <button onClick={() => setShowModal('create')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Level</button>
      </div>

      {message && <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Code</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Description</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(levels as any[])?.map((level: any) => (
                <tr key={level.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-mono">{level.code}</span></td>
                  <td className="px-6 py-4 font-medium text-gray-900">{level.name}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{level.description || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => deleteMutation.mutate(level.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </td>
                </tr>
              ))}
              {(!levels || (levels as any[]).length === 0) && <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No education levels configured.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal === 'create' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Education Level</h2>
            <div className="space-y-3">
              <input placeholder="Code (e.g. PRIMARY)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Name (e.g. Primary Education)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={3} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.code || !form.name} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
