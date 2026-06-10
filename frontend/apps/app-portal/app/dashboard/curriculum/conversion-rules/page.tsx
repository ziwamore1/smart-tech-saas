'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi, subjectApi } from '@/lib/api';

export default function ConversionRulesPage() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', subjectId: '', actualMaxScore: 100, standardizedMax: 150, conversionFormula: '', effectiveYear: new Date().getFullYear(), curriculumVersionId: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['conversion-rules'],
    queryFn: async () => { const res = await curriculumApi.getConversionRules(); return res.data?.data || res.data || []; },
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => { const res = await subjectApi.getAll(); return res.data?.data || res.data || []; },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createConversionRule(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['conversion-rules'] }); setShowModal(false); setForm({ name: '', subjectId: '', actualMaxScore: 100, standardizedMax: 150, conversionFormula: '', effectiveYear: new Date().getFullYear(), curriculumVersionId: '' }); setMessage({ type: 'success', text: 'Rule created' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => curriculumApi.deleteConversionRule(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['conversion-rules'] }); setMessage({ type: 'success', text: 'Deleted' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Conversion Rules</h1>
          <p className="text-gray-500 mt-1">ECZ Grade 7 raw-to-standardized score conversion rules per subject.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Rule</button>
      </div>

      {message && <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>}

      {isLoading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Subject</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Name</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Actual Max</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Std Max</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Formula</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Year</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(rules as any[])?.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-700">{r.subject?.name || r.subjectId}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{r.name}</td>
                  <td className="px-6 py-4 text-center font-mono text-sm">{r.actualMaxScore}</td>
                  <td className="px-6 py-4 text-center font-mono text-sm">{r.standardizedMax}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{r.conversionFormula || '-'}</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">{r.effectiveYear || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => deleteMutation.mutate(r.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </td>
                </tr>
              ))}
              {(!rules || (rules as any[]).length === 0) && <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No conversion rules configured.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Create Conversion Rule</h2>
            <div className="space-y-3">
              <input placeholder="Name (e.g. English Grade 7 Conversion)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Select Subject</option>
                {(subjects as any[])?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-gray-600 mb-1">Actual Max Score</label><input type="number" value={form.actualMaxScore} onChange={(e) => setForm({ ...form, actualMaxScore: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">Standardized Max</label><input type="number" value={form.standardizedMax} onChange={(e) => setForm({ ...form, standardizedMax: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
              <div><label className="block text-sm text-gray-600 mb-1">Conversion Formula <span className="text-gray-400">(use `actual` and `max`)</span></label>
                <input placeholder="(actual / max) * 100 + 50" value={form.conversionFormula} onChange={(e) => setForm({ ...form, conversionFormula: e.target.value })} className="w-full border rounded-lg px-3 py-2 font-mono text-sm" /></div>
              <input type="number" placeholder="Effective Year" value={form.effectiveYear} onChange={(e) => setForm({ ...form, effectiveYear: parseInt(e.target.value) || new Date().getFullYear() })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.subjectId} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
