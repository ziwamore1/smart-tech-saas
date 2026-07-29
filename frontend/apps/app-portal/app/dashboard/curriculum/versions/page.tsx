'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi } from '@/lib/api';

export default function CurriculumVersionsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingVersion, setEditingVersion] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', educationLevelId: '', effectiveFrom: '', effectiveTo: '', isCurrent: false });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: versions, isLoading } = useQuery({
    queryKey: ['curriculum-versions'],
    queryFn: async () => { const res = await curriculumApi.getVersions(); return res.data?.data || res.data || []; },
  });

  const { data: levels } = useQuery({
    queryKey: ['education-levels'],
    queryFn: async () => { const res = await curriculumApi.getEducationLevels(); return res.data?.data || res.data || []; },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createVersion(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['curriculum-versions'] }); closeModal(); setMessage({ type: 'success', text: 'Version created' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to create' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => curriculumApi.updateVersion(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['curriculum-versions'] }); closeModal(); setMessage({ type: 'success', text: 'Version updated' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to update' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => curriculumApi.deleteVersion(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['curriculum-versions'] }); setMessage({ type: 'success', text: 'Version deleted' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to delete' }),
  });

  function openCreateModal() {
    setEditingVersion(null);
    setForm({ name: '', code: '', description: '', educationLevelId: '', effectiveFrom: '', effectiveTo: '', isCurrent: false });
    setShowModal(true);
  }

  function openEditModal(v: any) {
    setEditingVersion(v);
    setForm({
      name: v.name || '',
      code: v.code || '',
      description: v.description || '',
      educationLevelId: v.educationLevelId || '',
      effectiveFrom: v.effectiveFrom ? v.effectiveFrom.split('T')[0] : '',
      effectiveTo: v.effectiveTo ? v.effectiveTo.split('T')[0] : '',
      isCurrent: v.isCurrent || false,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingVersion(null);
    setForm({ name: '', code: '', description: '', educationLevelId: '', effectiveFrom: '', effectiveTo: '', isCurrent: false });
  }

  function handleSave() {
    if (!form.code || !form.name || !form.educationLevelId) return;
    if (editingVersion) {
      updateMutation.mutate({ id: editingVersion.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function toggleCurrent(v: any) {
    updateMutation.mutate({ id: v.id, data: { isCurrent: !v.isCurrent } });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Curriculum Versions</h1>
          <p className="text-gray-500 mt-1">Manage curriculum versions. Multiple versions can be active simultaneously during transition periods.</p>
        </div>
        <button onClick={openCreateModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Version</button>
      </div>

      {message && <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>}

      {isLoading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Code</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Level</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Effective</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(versions as any[])?.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-mono">{v.code}</span></td>
                  <td className="px-6 py-4 font-medium text-gray-900">{v.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{v.educationLevel?.name || v.educationLevelId}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{v.effectiveFrom ? new Date(v.effectiveFrom).toLocaleDateString() : '-'}{v.effectiveTo ? ` → ${new Date(v.effectiveTo).toLocaleDateString()}` : ''}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleCurrent(v)}
                      className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${v.isCurrent ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      title={v.isCurrent ? 'Deactivate' : 'Activate'}
                    >
                      {v.isCurrent ? 'ACTIVE' : 'inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={() => openEditModal(v)} className="text-amber-600 hover:text-amber-800 text-sm">Edit</button>
                    <button onClick={() => { if (confirm('Delete this curriculum version?')) deleteMutation.mutate(v.id); }} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </td>
                </tr>
              ))}
              {(!versions || (versions as any[]).length === 0) && <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No curriculum versions.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{editingVersion ? 'Edit' : 'Create'} Curriculum Version</h2>
            <div className="space-y-3">
              <input placeholder="Code (e.g. 2024-CURRICULUM)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Name (e.g. 2024 National Curriculum)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={2} />
              <select value={form.educationLevelId} onChange={(e) => setForm({ ...form, educationLevelId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Select Education Level</option>
                {(levels as any[])?.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-gray-600 mb-1">Effective From</label><input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">Effective To</label><input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })} className="rounded" /> Mark as active</label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleSave} disabled={(createMutation.isPending || updateMutation.isPending) || !form.code || !form.name || !form.educationLevelId} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : editingVersion ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}