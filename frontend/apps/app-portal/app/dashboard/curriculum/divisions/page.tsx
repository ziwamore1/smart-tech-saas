'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi } from '@/lib/api';

export default function DivisionRulesPage() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', division: '', minScore: 0, maxScore: 100, description: '', label: '', color: '#000000', curriculumVersionId: '', examStructureId: '', sortOrder: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['division-rules'],
    queryFn: async () => { const res = await curriculumApi.getDivisionRules(); return res.data?.data || res.data || []; },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createDivisionRule(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['division-rules'] }); setShowModal(false); setForm({ name: '', code: '', division: '', minScore: 0, maxScore: 100, description: '', label: '', color: '#000000', curriculumVersionId: '', examStructureId: '', sortOrder: 0 }); setMessage({ type: 'success', text: 'Division rule created' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Division Rules</h1>
          <p className="text-gray-500 mt-1">Configure per-subject and composite division cutoff rules.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Division</button>
      </div>

      {message && <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>}

      {isLoading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Code</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Division</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Label</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Score Range</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Color</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Exam Structure</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(rules as any[])?.sort((a: any, b: any) => b.maxScore - a.maxScore).map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded text-xs font-mono">{r.code}</span></td>
                  <td className="px-6 py-4 font-medium text-gray-900">{r.division}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{r.label || '-'}</td>
                  <td className="px-6 py-4 text-center font-mono text-sm">{r.minScore} – {r.maxScore}</td>
                  <td className="px-6 py-4 text-center">{r.color && <span className="inline-block w-5 h-5 rounded" style={{ backgroundColor: r.color }} />}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{r.examStructure?.name || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => {}} className="text-blue-500 hover:text-blue-700 text-sm">Edit</button>
                  </td>
                </tr>
              ))}
              {(!rules || (rules as any[]).length === 0) && <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No division rules configured.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Create Division Rule</h2>
            <div className="space-y-3">
              <input placeholder="Code (e.g. DIV_1)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Division (e.g. Division 1)" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Label (e.g. Excellent)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
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
              <button onClick={() => createMutation.mutate(form)} disabled={!form.code || !form.division} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
