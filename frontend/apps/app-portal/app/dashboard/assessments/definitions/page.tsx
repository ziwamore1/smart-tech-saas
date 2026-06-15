'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentEngineApi } from '@/lib/api';
import { toast } from 'sonner';

interface Definition {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string | null;
  defaultMaxScore: number;
  defaultWeight: number;
  contributesToFinal: boolean;
  termBased: boolean;
  active: boolean;
  sortOrder: number;
}

const CATEGORIES = ['continuous', 'midterm', 'end_of_term', 'project', 'practical', 'other'];

const defaultForm = {
  name: '',
  code: '',
  category: 'continuous',
  description: '',
  defaultMaxScore: 100,
  defaultWeight: 0,
  contributesToFinal: true,
  termBased: true,
  sortOrder: 0,
};

export default function AssessmentDefinitionsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Definition | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: defs, isLoading } = useQuery({
    queryKey: ['assessment-defs'],
    queryFn: () => assessmentEngineApi.definitions.list(false).then(r => r.data?.data || r.data || []),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => assessmentEngineApi.definitions.create(data).then(r => r.data?.data || r.data),
    onSuccess: () => {
      toast.success('Assessment definition created');
      queryClient.invalidateQueries({ queryKey: ['assessment-defs'] });
      setShowForm(false);
      setForm(defaultForm);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      assessmentEngineApi.definitions.update(id, data).then(r => r.data?.data || r.data),
    onSuccess: () => {
      toast.success('Assessment definition updated');
      queryClient.invalidateQueries({ queryKey: ['assessment-defs'] });
      setEditing(null);
      setShowForm(false);
      setForm(defaultForm);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assessmentEngineApi.definitions.delete(id),
    onSuccess: () => {
      toast.success('Assessment definition deleted');
      queryClient.invalidateQueries({ queryKey: ['assessment-defs'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const handleSubmit = () => {
    if (!form.name || !form.code) {
      toast.error('Name and code are required');
      return;
    }
    const payload = { ...form, description: form.description || undefined };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEdit = (def: Definition) => {
    setEditing(def);
    setForm({
      name: def.name,
      code: def.code,
      category: def.category,
      description: def.description || '',
      defaultMaxScore: def.defaultMaxScore,
      defaultWeight: def.defaultWeight,
      contributesToFinal: def.contributesToFinal,
      termBased: def.termBased,
      sortOrder: def.sortOrder,
    });
    setShowForm(true);
  };

  const definitions: Definition[] = Array.isArray(defs) ? defs : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessment Definitions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define assessment types (tests, exams, projects) used across your school.
            Then configure them per class/subject/term with weights.
          </p>
        </div>
        <button
          onClick={() => { setForm(defaultForm); setEditing(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <i className="fas fa-plus" /> New Definition
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800">
                {editing ? 'Edit' : 'Create'} Assessment Definition
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. Test 1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. TEST_1" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Max Score</label>
                  <input type="number" value={form.defaultMaxScore} onChange={e => setForm({ ...form, defaultMaxScore: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Weight (%)</label>
                  <input type="number" value={form.defaultWeight} onChange={e => setForm({ ...form, defaultWeight: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.contributesToFinal} onChange={e => setForm({ ...form, contributesToFinal: e.target.checked })} />
                  Contributes to final grade
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.termBased} onChange={e => setForm({ ...form, termBased: e.target.checked })} />
                  Term-based
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {createMutation.isPending || updateMutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Saving...</> : editing ? 'Update' : 'Create'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : definitions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-clipboard-list text-gray-400 text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Assessment Definitions</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Create assessment types like "Test 1", "Mid-Term Exam", "End of Term", or "Project".
            Once created, you can configure them per class/subject/term with specific weights.
          </p>
          <button onClick={() => { setForm(defaultForm); setEditing(null); setShowForm(true); }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <i className="fas fa-plus mr-2" /> Create First Definition
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Order</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Code</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Category</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Max Score</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Weight</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Final</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Active</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map(d => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-400">{d.sortOrder}</td>
                    <td className="py-3 px-4 font-medium text-gray-800">{d.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">{d.code}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 capitalize">{d.category.replace(/_/g, ' ')}</td>
                    <td className="py-3 px-4 text-right font-medium">{d.defaultMaxScore}</td>
                    <td className="py-3 px-4 text-right">{d.defaultWeight}%</td>
                    <td className="py-3 px-4 text-center">
                      {d.contributesToFinal ? <i className="fas fa-check text-emerald-500" /> : <i className="fas fa-times text-gray-300" />}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <i className="fas fa-edit text-sm" />
                        </button>
                        <button onClick={() => { if (confirm('Delete this definition?')) deleteMutation.mutate(d.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <i className="fas fa-trash text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
