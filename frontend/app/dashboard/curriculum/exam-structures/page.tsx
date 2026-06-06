'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi } from '@/lib/api';

export default function ExamStructuresPage() {
  const [showModal, setShowModal] = useState<'structure' | 'component' | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', academicStageId: '', curriculumVersionId: '', totalMarks: 0, passMark: 0, duration: 0 });
  const [compForm, setCompForm] = useState({ name: '', code: '', description: '', maxScore: 100, weight: 1, sortOrder: 0, isGroupComponent: false, groupId: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: structures, isLoading } = useQuery({
    queryKey: ['exam-structures'],
    queryFn: async () => { const res = await curriculumApi.getExamStructures(); return res.data?.data || res.data || []; },
  });

  const { data: stages } = useQuery({
    queryKey: ['academic-stages'],
    queryFn: async () => { const res = await curriculumApi.getStages(); return res.data?.data || res.data || []; },
  });

  const { data: components, refetch: refetchComponents } = useQuery({
    queryKey: ['exam-components', selectedStructure?.id],
    queryFn: async () => {
      if (!selectedStructure?.id) return [];
      const res = await curriculumApi.getExamComponents(selectedStructure.id);
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedStructure?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createExamStructure(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exam-structures'] }); setShowModal(null); setForm({ name: '', code: '', description: '', academicStageId: '', curriculumVersionId: '', totalMarks: 0, passMark: 0, duration: 0 }); setMessage({ type: 'success', text: 'Structure created' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  const createCompMutation = useMutation({
    mutationFn: (data: any) => curriculumApi.createExamComponent(data),
    onSuccess: () => { refetchComponents(); setShowModal(null); setCompForm({ name: '', code: '', description: '', maxScore: 100, weight: 1, sortOrder: 0, isGroupComponent: false, groupId: '' }); setMessage({ type: 'success', text: 'Component created' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  const deleteCompMutation = useMutation({
    mutationFn: (id: string) => curriculumApi.deleteExamComponent(id),
    onSuccess: () => { refetchComponents(); setMessage({ type: 'success', text: 'Component deleted' }); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exam Structures</h1>
          <p className="text-gray-500 mt-1">Configure exam structures, scoring components, and pass marks per stage.</p>
        </div>
        <button onClick={() => setShowModal('structure')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Structure</button>
      </div>

      {message && <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>}

      {isLoading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="grid gap-4">
          {(structures as any[])?.map((es: any) => (
            <div key={es.id} className="bg-white rounded-lg shadow border border-gray-100">
              <div className="p-4 flex justify-between items-center border-b cursor-pointer" onClick={() => setSelectedStructure(selectedStructure?.id === es.id ? null : es)}>
                <div className="flex items-center gap-3">
                  <i className={`fas fa-chevron-${selectedStructure?.id === es.id ? 'down' : 'right'} text-gray-400 text-sm`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{es.name}</h3>
                      <span className="px-2 py-0.5 bg-pink-100 text-pink-800 rounded text-xs font-mono">{es.code}</span>
                    </div>
                    <p className="text-sm text-gray-500">{es.academicStage?.name || es.academicStageId} · Total: {es.totalMarks || '-'} · Pass: {es.passMark || '-'} · Duration: {es.duration ? `${es.duration} min` : '-'}</p>
                  </div>
                </div>
              </div>

              {selectedStructure?.id === es.id && (
                <div className="px-4 pb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-600">Components</h4>
                    <button onClick={() => { setSelectedStructure(es); setShowModal('component'); }} className="text-sm text-pink-600 hover:text-pink-800">+ Add Component</button>
                  </div>
                  {components && (components as any[]).length > 0 ? (
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-gray-500 border-t"><th className="py-1.5 pr-4">Code</th><th className="py-1.5 pr-4">Name</th><th className="py-1.5 pr-4 text-center">Max Score</th><th className="py-1.5 pr-4 text-center">Weight</th><th className="py-1.5 text-right">Actions</th></tr></thead>
                      <tbody>
                        {(components as any[])?.map((comp: any) => (
                          <tr key={comp.id} className="border-t border-gray-50">
                            <td className="py-1.5 pr-4 font-mono text-xs text-gray-500">{comp.code}</td>
                            <td className="py-1.5 pr-4 text-gray-700">{comp.name}</td>
                            <td className="py-1.5 pr-4 text-center font-mono">{comp.maxScore}</td>
                            <td className="py-1.5 pr-4 text-center">{comp.weight || 1}</td>
                            <td className="py-1.5 text-right"><button onClick={() => deleteCompMutation.mutate(comp.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-400 py-2 text-center">No components. Click "+ Add Component" to add one.</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {(!structures || (structures as any[]).length === 0) && <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">No exam structures configured.</div>}
        </div>
      )}

      {showModal === 'structure' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Exam Structure</h2>
            <div className="space-y-3">
              <input placeholder="Code (e.g. ECZ_G7)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Name (e.g. ECZ Grade 7 Examination)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={2} />
              <select value={form.academicStageId} onChange={(e) => setForm({ ...form, academicStageId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Select Academic Stage</option>
                {(stages as any[])?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-sm text-gray-600 mb-1">Total Marks</label><input type="number" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">Pass Mark</label><input type="number" value={form.passMark} onChange={(e) => setForm({ ...form, passMark: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">Duration (min)</label><input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.code || !form.name || !form.academicStageId} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'component' && selectedStructure && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Component to {selectedStructure.name}</h2>
            <div className="space-y-3">
              <input placeholder="Code (e.g. ENG_P1)" value={compForm.code} onChange={(e) => setCompForm({ ...compForm, code: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <input placeholder="Name (e.g. English Paper 1)" value={compForm.name} onChange={(e) => setCompForm({ ...compForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              <textarea placeholder="Description" value={compForm.description} onChange={(e) => setCompForm({ ...compForm, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-gray-600 mb-1">Max Score</label><input type="number" value={compForm.maxScore} onChange={(e) => setCompForm({ ...compForm, maxScore: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">Weight</label><input type="number" step="0.1" value={compForm.weight} onChange={(e) => setCompForm({ ...compForm, weight: parseFloat(e.target.value) || 1 })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
              <input type="number" placeholder="Sort Order" value={compForm.sortOrder} onChange={(e) => setCompForm({ ...compForm, sortOrder: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => createCompMutation.mutate({ ...compForm, examStructureId: selectedStructure.id })} disabled={!compForm.code || !compForm.name} className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
