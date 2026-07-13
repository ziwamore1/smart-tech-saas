'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi, subjectApi } from '@/lib/api';

interface ComponentRow {
  subjectId: string;
  weight: number;
}

interface FormData {
  name: string;
  code: string;
  curriculumId: string;
  calculationMethod: string;
  isActive: boolean;
  components: ComponentRow[];
}

const emptyForm = (): FormData => ({
  name: '',
  code: '',
  curriculumId: '',
  calculationMethod: 'WEIGHTED_AVERAGE',
  isActive: true,
  components: [],
});

export default function CompositeSubjectsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [schoolId, setSchoolId] = useState('');

  const { data: composites, isLoading } = useQuery({
    queryKey: ['composite-subjects'],
    queryFn: async () => {
      const res = await curriculumApi.getCompositeSubjects();
      return res.data?.data || res.data || [];
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      return res.data?.data || res.data || [];
    },
  });

  const { data: versions } = useQuery({
    queryKey: ['curriculum-versions'],
    queryFn: async () => {
      const res = await curriculumApi.getVersions();
      return res.data?.data || res.data || [];
    },
  });

  const showMsg = (t: 'success' | 'error', text: string) => {
    setMessage({ type: t, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createCompositeSubject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composite-subjects'] });
      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm());
      showMsg('success', 'Composite subject created');
    },
    onError: (err: any) => showMsg('error', err?.response?.data?.message || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => curriculumApi.updateCompositeSubject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composite-subjects'] });
      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm());
      showMsg('success', 'Composite subject updated');
    },
    onError: (err: any) => showMsg('error', err?.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => curriculumApi.deleteCompositeSubject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composite-subjects'] });
      showMsg('success', 'Composite subject deleted');
    },
    onError: (err: any) => showMsg('error', err?.response?.data?.message || 'Failed to delete'),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      code: c.code || '',
      curriculumId: c.curriculumId || '',
      calculationMethod: c.calculationMethod || 'WEIGHTED_AVERAGE',
      isActive: c.isActive !== false,
      components: (c.components || []).map((comp: any) => ({
        subjectId: comp.subjectId,
        weight: comp.weight,
      })),
    });
    setShowModal(true);
  };

  const addComponent = () => {
    setForm({ ...form, components: [...form.components, { subjectId: '', weight: 1 }] });
  };

  const removeComponent = (idx: number) => {
    const updated = form.components.filter((_, i) => i !== idx);
    setForm({ ...form, components: updated });
  };

  const updateComponent = (idx: number, field: keyof ComponentRow, value: any) => {
    const updated = [...form.components];
    (updated[idx] as any)[field] = value;
    setForm({ ...form, components: updated });
  };

  const totalWeight = form.components.reduce((s, c) => s + (c.weight || 0), 0);

  const handleSave = () => {
    const payload = {
      ...form,
      schoolId: schoolId || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const subjectMap = new Map((subjects as any[])?.map((s: any) => [s.id, s]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Composite Subjects</h1>
          <p className="text-gray-500 mt-1">Combine component subjects into a single computed result for report cards (Grades 10-12).</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Add Composite
        </button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : !composites || (composites as any[]).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">🧩</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Composite Subjects</h3>
          <p className="text-gray-500 mb-4 max-w-md mx-auto">
            Composite subjects let you combine scores from multiple subjects (e.g., English Language + Literature) into a single final result for report cards.
          </p>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Create Your First Composite
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {(composites as any[])?.map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 flex justify-between items-start border-b border-gray-100">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 text-lg">{c.name}</h3>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{c.code}</span>
                    {!c.isActive && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>Method: <span className="font-mono">{c.calculationMethod === 'WEIGHTED_AVERAGE' ? 'Weighted Avg' : 'Simple Avg'}</span></span>
                    <span>Components: <strong>{c.components?.length || 0}</strong></span>
                    {c.curriculum && <span>Curriculum: {c.curriculum.name}</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => openEdit(c)} className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">Edit</button>
                  <button
                    onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id); }}
                    className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {c.components && c.components.length > 0 && (
                <div className="px-4 py-3 bg-gray-50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1 pr-4 font-medium">Component Subject</th>
                        <th className="py-1 pr-4 font-medium">Weight</th>
                        <th className="py-1 pr-4 font-medium">Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.components.map((comp: any) => {
                        const sub = subjectMap.get(comp.subjectId);
                        const pct = totalWeight > 0 ? ((comp.weight / totalWeight) * 100).toFixed(0) : '0';
                        return (
                          <tr key={comp.id || comp.subjectId} className="border-t border-gray-100">
                            <td className="py-1.5 pr-4 text-gray-700">{sub?.name || comp.subjectId}</td>
                            <td className="py-1.5 pr-4 font-mono text-gray-600">{comp.weight}</td>
                            <td className="py-1.5 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Edit Composite Subject' : 'Create Composite Subject'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., English Composite"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., ENG_COMP"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Curriculum Version</label>
                <select
                  value={form.curriculumId}
                  onChange={(e) => setForm({ ...form, curriculumId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select Curriculum</option>
                  {(versions as any[])?.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calculation Method</label>
                  <select
                    value={form.calculationMethod}
                    onChange={(e) => setForm({ ...form, calculationMethod: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="WEIGHTED_AVERAGE">Weighted Average</option>
                    <option value="SIMPLE_AVERAGE">Simple Average</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Component Subjects</label>
                  <button
                    type="button"
                    onClick={addComponent}
                    className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                  >
                    + Add Component
                  </button>
                </div>
                {form.components.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                    No components added yet. Click &quot;+ Add Component&quot; to add subjects.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.components.map((comp, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex-1">
                          <select
                            value={comp.subjectId}
                            onChange={(e) => updateComponent(idx, 'subjectId', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="">Select Subject</option>
                            {(subjects as any[])?.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name} ({s.code || 'no code'})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={comp.weight}
                            onChange={(e) => updateComponent(idx, 'weight', parseFloat(e.target.value) || 0)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="Weight"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeComponent(idx)}
                          className="px-2 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="text-right text-sm text-gray-500">
                      Total weight: <span className="font-mono font-semibold">{totalWeight.toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => { setShowModal(false); setEditingId(null); setForm(emptyForm()); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name || !form.code || !form.curriculumId || form.components.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
