'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectApi, curriculumIntelligenceApi } from '@/lib/api';

export default function ElementsOfConstructPage() {
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEoc, setSelectedEoc] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: subjectsResponse } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      return res.data?.data || res.data || [];
    },
  });

  const subjects = Array.isArray(subjectsResponse?.data) ? subjectsResponse.data :
    Array.isArray(subjectsResponse) ? subjectsResponse : [];

  const { data: eocsResponse, isLoading: eocsLoading } = useQuery({
    queryKey: ['eocs', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return [];
      const res = await curriculumIntelligenceApi.getEocs(selectedSubjectId);
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedSubjectId,
  });

  const eocs = Array.isArray(eocsResponse) ? eocsResponse : [];

  const selectedSubject = subjects.find((s: any) => s.id === selectedSubjectId);

  const [eocForm, setEocForm] = useState({
    name: '',
    code: '',
    description: '',
    construct: '',
    sortOrder: 0,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    description: '',
    construct: '',
    sortOrder: 0,
  });

  const createEocMutation = useMutation({
    mutationFn: (data: any) => curriculumIntelligenceApi.createEoc(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eocs', selectedSubjectId] });
      setShowAddModal(false);
      setEocForm({ name: '', code: '', description: '', construct: '', sortOrder: 0 });
      setMessage({ type: 'success', text: 'Element of Construct created successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to create element of construct.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const updateEocMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => curriculumIntelligenceApi.updateEoc(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eocs', selectedSubjectId] });
      setShowEditModal(false);
      setSelectedEoc(null);
      setMessage({ type: 'success', text: 'Element of Construct updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update element of construct.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deleteEocMutation = useMutation({
    mutationFn: (id: string) => curriculumIntelligenceApi.deleteEoc(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eocs', selectedSubjectId] });
      setMessage({ type: 'success', text: 'Element of Construct deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to delete element of construct.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const filteredEocs = eocs.filter((eoc: any) => {
    return searchTerm === '' ||
      eoc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (eoc.construct && eoc.construct.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      {message && (
        <div className={`px-4 py-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Elements of Construct</h1>
          <p className="text-gray-600 mt-1">Manage ECZ assessment constructs per subject</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => { setSelectedSubjectId(e.target.value); setSearchTerm(''); }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select a subject...</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or construct..."
              className="w-full px-3 py-2 border rounded-lg"
              disabled={!selectedSubjectId}
            />
          </div>

          <div className="flex items-end justify-end">
            {selectedSubjectId && (
              <button
                onClick={() => {
                  setEocForm({ name: '', code: '', description: '', construct: '', sortOrder: filteredEocs.length + 1 });
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Element of Construct
              </button>
            )}
          </div>
        </div>
      </div>

      {!selectedSubjectId ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Subject</h3>
          <p className="text-gray-500">Choose a subject above to view its Elements of Construct.</p>
        </div>
      ) : eocsLoading ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading elements of construct...</p>
        </div>
      ) : filteredEocs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Elements of Construct Found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'Try a different search term.' : `No EoCs defined for ${selectedSubject?.name}. Add one to get started.`}
          </p>
          {!searchTerm && (
            <button
              onClick={() => { setEocForm({ name: '', code: '', description: '', construct: '', sortOrder: 1 }); setShowAddModal(true); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              + Add First Element of Construct
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{selectedSubject?.name}</span> — {eocs.length} Elements of Construct
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Construct</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEocs.map((eoc: any, index: number) => (
                  <tr key={eoc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-500">{eoc.sortOrder || index + 1}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium text-gray-900">{eoc.name}</div>
                        {eoc.description && (
                          <div className="text-xs text-gray-500 truncate max-w-sm">{eoc.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {eoc.construct || 'General'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {eoc.code ? (
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{eoc.code}</span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        eoc.isActive !== false
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {eoc.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedEoc(eoc);
                            setEditForm({
                              name: eoc.name || '',
                              code: eoc.code || '',
                              description: eoc.description || '',
                              construct: eoc.construct || '',
                              sortOrder: eoc.sortOrder || 0,
                            });
                            setShowEditModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${eoc.name}"?`)) {
                              deleteEocMutation.mutate(eoc.id);
                            }
                          }}
                          disabled={deleteEocMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          🗑️ Delete
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

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-2">Add Element of Construct</h2>
            <p className="text-sm text-gray-500 mb-6">For subject: {selectedSubject?.name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={eocForm.name}
                  onChange={(e) => setEocForm({ ...eocForm, name: e.target.value })}
                  placeholder="e.g., Interprets and understands spoken information"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Construct</label>
                <input
                  type="text"
                  value={eocForm.construct}
                  onChange={(e) => setEocForm({ ...eocForm, construct: e.target.value })}
                  placeholder="e.g., Listening comprehension"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                  <input
                    type="text"
                    value={eocForm.code}
                    onChange={(e) => setEocForm({ ...eocForm, code: e.target.value })}
                    placeholder="e.g., ENG-LC-01"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
                  <input
                    type="number"
                    value={eocForm.sortOrder}
                    onChange={(e) => setEocForm({ ...eocForm, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={eocForm.description}
                  onChange={(e) => setEocForm({ ...eocForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Describe what this element measures..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createEocMutation.mutate({ ...eocForm, subjectId: selectedSubjectId })}
                  disabled={!eocForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {createEocMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedEoc && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-2">Edit Element of Construct</h2>
            <p className="text-sm text-gray-500 mb-6">{selectedSubject?.name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Construct</label>
                <input
                  type="text"
                  value={editForm.construct}
                  onChange={(e) => setEditForm({ ...editForm, construct: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                  <input
                    type="text"
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
                  <input
                    type="number"
                    value={editForm.sortOrder}
                    onChange={(e) => setEditForm({ ...editForm, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => { setShowEditModal(false); setSelectedEoc(null); }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const cleanData = Object.fromEntries(
                      Object.entries(editForm).filter(([_, v]) => v !== '')
                    );
                    updateEocMutation.mutate({ id: selectedEoc.id, data: cleanData });
                  }}
                  disabled={!editForm.name || updateEocMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {updateEocMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
