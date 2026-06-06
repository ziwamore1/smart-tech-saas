'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectApi } from '@/lib/api';

export default function SubjectsPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: subjectsResponse, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      return res.data?.data || res.data || [];
    },
  });

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    credits: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    credits: '',
  });

  const createSubjectMutation = useMutation({
    mutationFn: (data: any) => subjectApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setShowAddModal(false);
      setSubjectForm({ name: '', code: '', category: '', description: '', credits: '' });
      setMessage({ type: 'success', text: 'Subject created successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to create subject.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => subjectApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setShowEditModal(false);
      setSelectedSubject(null);
      setMessage({ type: 'success', text: 'Subject updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update subject.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: (id: string) => subjectApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setMessage({ type: 'success', text: 'Subject deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to delete subject.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const subjects = subjectsResponse?.data || subjectsResponse || [];
  const filteredSubjects = subjects.filter((subject: any) => {
    const matchesSearch = searchTerm === '' ||
      subject.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (subject.code && subject.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === '' || subject.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(subjects.map((s: any) => s.category).filter(Boolean))] as string[];

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
          <h1 className="text-3xl font-bold text-gray-900">Subjects Management</h1>
          <p className="text-gray-600 mt-1">Manage subjects and courses</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Subject
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or code..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              Total Subjects: <span className="font-bold text-gray-900">{subjects.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {subjectsLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading subjects...</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subjects Found</h3>
            <p className="text-gray-500 mb-4">Add your first subject to get started.</p>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              + Add Subject
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Subject Name</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Credits</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubjects.map((subject: any, index: number) => {
                  const colors = [
                    'from-blue-400 to-blue-600', 'from-green-400 to-green-600', 
                    'from-purple-400 to-purple-600', 'from-pink-400 to-pink-600',
                    'from-indigo-400 to-indigo-600', 'from-amber-400 to-amber-600',
                    'from-teal-400 to-teal-600', 'from-red-400 to-red-600',
                  ];
                  const colorClass = colors[index % colors.length];
                  
                  return (
                  <tr key={subject.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{subject.code || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                          {subject.name?.[0] || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{subject.name}</div>
                          {subject.description && <div className="text-xs text-gray-500 truncate max-w-xs">{subject.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{subject.category || 'Uncategorized'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm">{subject.credits || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
<button
                          onClick={() => {
                            setSelectedSubject(subject);
                            setEditForm({
                              name: subject.name || '',
                              code: subject.code || '',
                              category: subject.category || '',
                              description: subject.description || '',
                              credits: subject.credits || '',
                            });
                            setShowEditModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${subject.name}?`)) {
                              deleteSubjectMutation.mutate(subject.id);
                            }
                          }}
                          disabled={deleteSubjectMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          🗑️ Delete
                        </button>
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Add New Subject</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name *</label>
                <input
                  type="text"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Code *</label>
                <input
                  type="text"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  placeholder="e.g., MATH101"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={subjectForm.category}
                  onChange={(e) => setSubjectForm({ ...subjectForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Category</option>
                  <option value="Core">Core Subjects</option>
                  <option value="Science">Science</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Languages">Languages</option>
                  <option value="Humanities">Humanities</option>
                  <option value="Technical">Technical</option>
                  <option value="Arts">Arts</option>
                  <option value="Elective">Elective</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Credits</label>
                <input
                  type="number"
                  value={subjectForm.credits}
                  onChange={(e) => setSubjectForm({ ...subjectForm, credits: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
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
                  onClick={() => createSubjectMutation.mutate(subjectForm)}
                  disabled={!subjectForm.name || !subjectForm.code}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {createSubjectMutation.isPending ? 'Creating...' : 'Create Subject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">
              Edit Subject: {selectedSubject.name}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Code</label>
                <input
                  type="text"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  placeholder="e.g., MATH101"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Category</option>
                  <option value="Core">Core Subjects</option>
                  <option value="Science">Science</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Languages">Languages</option>
                  <option value="Humanities">Humanities</option>
                  <option value="Technical">Technical</option>
                  <option value="Arts">Arts</option>
                  <option value="Elective">Elective</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Credits</label>
                <input
                  type="number"
                  value={editForm.credits}
                  onChange={(e) => setEditForm({ ...editForm, credits: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
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
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedSubject(null);
                    setEditForm({ name: '', code: '', category: '', description: '', credits: '' });
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const cleanData = Object.fromEntries(
                      Object.entries(editForm).filter(([_, v]) => v !== '')
                    );
                    updateSubjectMutation.mutate({ id: selectedSubject.id, data: cleanData });
                  }}
                  disabled={!editForm.name || updateSubjectMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {updateSubjectMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
