'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectApi, curriculumIntelligenceApi } from '@/lib/api';

export default function SbaTasksPage() {
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const [form, setForm] = useState({
    title: '', description: '', taskNumber: 1, maxMarks: 20, weight: 10,
    eocId: '', competencyId: '', dueDate: '',
  });

  const [editForm, setEditForm] = useState({
    title: '', description: '', taskNumber: 1, maxMarks: 20, weight: 10,
    eocId: '', competencyId: '', dueDate: '',
  });

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const { data: subjectsResponse } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      return res.data?.data || res.data || [];
    },
  });
  const subjects = Array.isArray(subjectsResponse?.data) ? subjectsResponse.data :
    Array.isArray(subjectsResponse) ? subjectsResponse : [];
  const selectedSubject = subjects.find((s: any) => s.id === selectedSubjectId);

  const { data: eocsResponse } = useQuery({
    queryKey: ['eocs', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return [];
      const res = await curriculumIntelligenceApi.getEocs(selectedSubjectId);
      const d = res.data?.data || res.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!selectedSubjectId,
  });
  const eocs = Array.isArray(eocsResponse) ? eocsResponse : [];

  const { data: tasksResponse, isLoading: loading } = useQuery({
    queryKey: ['sba-tasks', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return [];
      const res = await curriculumIntelligenceApi.getSbaTasks(selectedSubjectId);
      const d = res.data?.data || res.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!selectedSubjectId,
  });
  const tasks = Array.isArray(tasksResponse) ? tasksResponse : [];

  const filtered = tasks.filter((t: any) =>
    searchTerm === '' || t.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const eocMap = new Map(eocs.map((e: any) => [e.id, e]));

  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumIntelligenceApi.createSbaTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sba-tasks', selectedSubjectId] });
      setShowAddModal(false);
      setForm({ title: '', description: '', taskNumber: 1, maxMarks: 20, weight: 10, eocId: '', competencyId: '', dueDate: '' });
      showMsg('success', 'SBA task created successfully!');
    },
    onError: (error: any) => showMsg('error', error?.response?.data?.message || 'Failed to create.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => curriculumIntelligenceApi.updateSbaTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sba-tasks', selectedSubjectId] });
      setShowEditModal(false);
      setSelectedTask(null);
      showMsg('success', 'SBA task updated successfully!');
    },
    onError: (error: any) => showMsg('error', error?.response?.data?.message || 'Failed to update.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => curriculumIntelligenceApi.deleteSbaTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sba-tasks', selectedSubjectId] });
      showMsg('success', 'SBA task deleted successfully!');
    },
    onError: (error: any) => showMsg('error', error?.response?.data?.message || 'Failed to delete.'),
  });

  const generateTemplateMutation = useMutation({
    mutationFn: () => curriculumIntelligenceApi.generateSbaTemplate(selectedSubjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sba-tasks', selectedSubjectId] });
      showMsg('success', 'SBA template generated from curriculum!');
    },
    onError: (error: any) => showMsg('error', error?.response?.data?.message || 'Failed to generate template.'),
  });

  const totalWeight = filtered.reduce((sum: number, t: any) => sum + (t.weight || 0), 0);

  return (
    <div className="space-y-6">
      {message && (
        <div className={`px-4 py-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>{message.text}</div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">School-Based Assessment Tasks</h1>
          <p className="text-gray-600 mt-1">Manage SBA tasks, weights, and due dates per subject</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select value={selectedSubjectId}
              onChange={(e) => { setSelectedSubjectId(e.target.value); setSearchTerm(''); }}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select a subject...</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input type="text" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks..." disabled={!selectedSubjectId}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex items-end gap-2">
            {selectedSubjectId && (
              <>
                <button onClick={() => { setForm({ title: '', description: '', taskNumber: tasks.length + 1, maxMarks: 20, weight: 10, eocId: '', competencyId: '', dueDate: '' }); setShowAddModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  + Add Task
                </button>
                <button onClick={() => { if (confirm('Generate SBA template from curriculum topics?')) generateTemplateMutation.mutate(); }}
                  disabled={generateTemplateMutation.isPending}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm">
                  {generateTemplateMutation.isPending ? 'Generating...' : '🎯 Generate Template'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {!selectedSubjectId ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Subject</h3>
          <p className="text-gray-500">Choose a subject above to view its SBA tasks.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading SBA tasks...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No SBA Tasks</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'Try a different search.' : `No tasks defined for ${selectedSubject?.name}. Add one or generate a template.`}
          </p>
          {!searchTerm && (
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setForm({ title: '', description: '', taskNumber: 1, maxMarks: 20, weight: 10, eocId: '', competencyId: '', dueDate: '' }); setShowAddModal(true); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add Task</button>
              <button onClick={() => generateTemplateMutation.mutate()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">🎯 Generate Template</button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{selectedSubject?.name}</span> — {filtered.length} tasks
              <span className="ml-3">Total weight: <span className="font-bold">{totalWeight}%</span></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="text-center py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Max Marks</th>
                  <th className="text-center py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Weight</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">EoC</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((task: any) => (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="w-7 h-7 rounded-full bg-gray-100 text-xs font-bold flex items-center justify-center text-gray-600">
                        {task.taskNumber}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-900">{task.title}</div>
                      {task.description && <div className="text-xs text-gray-500 truncate max-w-xs">{task.description}</div>}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="font-mono text-sm font-semibold">{task.maxMarks || '-'}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-16 bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(task.weight || 0, 100)}%` }}></div>
                        </div>
                        <span className="ml-2 text-xs font-medium text-gray-600">{task.weight || 0}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {task.eocId && eocMap.has(task.eocId) ? (
                        <span className="text-xs text-purple-600">{eocMap.get(task.eocId).name}</span>
                      ) : task.eoc ? (
                        <span className="text-xs text-purple-600">{task.eoc.name}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {task.dueDate ? (
                        <span className="text-xs text-gray-600">
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => {
                          setSelectedTask(task);
                          setEditForm({
                            title: task.title || '', description: task.description || '',
                            taskNumber: task.taskNumber || 1, maxMarks: task.maxMarks || 20,
                            weight: task.weight || 10, eocId: task.eocId || '',
                            competencyId: task.competencyId || '', dueDate: task.dueDate?.split('T')[0] || '',
                          });
                          setShowEditModal(true);
                        }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100">✏️</button>
                        <button onClick={() => { if (confirm(`Delete task "${task.title}"?`)) deleteMutation.mutate(task.id); }}
                          disabled={deleteMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-2">Add SBA Task</h2>
            <p className="text-sm text-gray-500 mb-6">{selectedSubject?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <input type="text" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task #</label>
                  <input type="number" value={form.taskNumber}
                    onChange={(e) => setForm({ ...form, taskNumber: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Marks</label>
                  <input type="number" value={form.maxMarks}
                    onChange={(e) => setForm({ ...form, maxMarks: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Weight (%)</label>
                  <input type="number" value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Element of Construct</label>
                <select value={form.eocId}
                  onChange={(e) => setForm({ ...form, eocId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg">
                  <option value="">None</option>
                  {eocs.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input type="date" value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => createMutation.mutate({ ...form, subjectId: selectedSubjectId })}
                  disabled={!form.title || createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTask && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-2">Edit SBA Task</h2>
            <p className="text-sm text-gray-500 mb-6">{selectedSubject?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <input type="text" value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task #</label>
                  <input type="number" value={editForm.taskNumber}
                    onChange={(e) => setEditForm({ ...editForm, taskNumber: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Marks</label>
                  <input type="number" value={editForm.maxMarks}
                    onChange={(e) => setEditForm({ ...editForm, maxMarks: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Weight (%)</label>
                  <input type="number" value={editForm.weight}
                    onChange={(e) => setEditForm({ ...editForm, weight: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Element of Construct</label>
                <select value={editForm.eocId}
                  onChange={(e) => setEditForm({ ...editForm, eocId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg">
                  <option value="">None</option>
                  {eocs.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input type="date" value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => { setShowEditModal(false); setSelectedTask(null); }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => {
                  const cleanData = Object.fromEntries(Object.entries(editForm).filter(([_, v]) => v !== ''));
                  updateMutation.mutate({ id: selectedTask.id, data: cleanData });
                }}
                  disabled={!editForm.title || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
