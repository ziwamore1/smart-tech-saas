'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi } from '@/lib/api';

export default function PerformanceCategoriesPage() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', label: '', labelLocal: '', minScore: 0, maxScore: 100, description: '', color: '#6b7280', curriculumVersionId: '', sortOrder: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['performance-categories'],
    queryFn: async () => { const res = await curriculumApi.getPerformanceCategories(); return res.data?.data || res.data || []; },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createPerformanceCategory(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['performance-categories'] }); setShowModal(false); setForm({ name: '', label: '', labelLocal: '', minScore: 0, maxScore: 100, description: '', color: '#6b7280', curriculumVersionId: '', sortOrder: 0 }); setMessage({ type: 'success', text: 'Category created' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  const categoryColors: Record<string, string> = {
    EXCELLENT: '#059669', VERY_GOOD: '#0284c7', GOOD: '#ca8a04', SATISFACTORY: '#d97706',
    AVERAGE: '#6b7280', POOR: '#dc2626', FAIL: '#991b1b',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Categories</h1>
          <p className="text-gray-500 mt-1">Define performance labels, score ranges, and display colors.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Category</button>
      </div>

      {message && <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>}

      {isLoading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="grid gap-3">
          {(categories as any[])?.sort((a: any, b: any) => b.maxScore - a.maxScore).map((c: any) => (
            <div key={c.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: c.color || categoryColors[c.name] || '#6b7280' }} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{c.label || c.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{c.name}</span>
                    {c.labelLocal && <span className="text-xs text-gray-400">({c.labelLocal})</span>}
                  </div>
                  <div className="text-sm text-gray-500">Score: {c.minScore ?? 0} – {c.maxScore ?? '∞'}</div>
                </div>
              </div>
              <div className="text-sm text-gray-400">{c.description}</div>
            </div>
          ))}
          {(!categories || (categories as any[]).length === 0) && <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">No performance categories defined.</div>}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Performance Category</h2>
            <div className="space-y-3">
              <input placeholder="Name (e.g. EXCELLENT)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Label (e.g. Excellent)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Local Label (e.g. Bwino)" value={form.labelLocal} onChange={(e) => setForm({ ...form, labelLocal: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-gray-600 mb-1">Min Score</label><input type="number" value={form.minScore} onChange={(e) => setForm({ ...form, minScore: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">Max Score</label><input type="number" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
              <div className="flex items-center gap-3"><label className="text-sm text-gray-600">Color:</label><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" /></div>
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={2} />
              <input type="number" placeholder="Sort Order" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.label} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
