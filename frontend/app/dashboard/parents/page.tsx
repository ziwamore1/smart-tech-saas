'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parentApi, studentApi, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function ParentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [parentForm, setParentForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '',
  });

  const [linkForm, setLinkForm] = useState({ studentId: '' });

  const { data: parentsData, isLoading } = useQuery({
    queryKey: ['parents', searchTerm],
    queryFn: async () => {
      const res = await parentApi.getAll({ search: searchTerm || undefined });
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ['parent-stats'],
    queryFn: async () => {
      const res = await parentApi.getStats();
      return res.data || { total: 0, withLinkedChildren: 0 };
    },
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await api.get('/student');
      let data = res.data?.data || res.data?.students || res.data;
      if (!Array.isArray(data)) data = [];
      return data;
    },
  });

  const createParentMutation = useMutation({
    mutationFn: (data: any) => parentApi.register(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: ['parent-stats'] });
      setShowAddModal(false);
      setMessage({ type: 'success', text: 'Parent registered successfully!' });
      setTimeout(() => setMessage(null), 3000);
      setParentForm({ firstName: '', lastName: '', email: '', phone: '', password: '' });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to register parent.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const linkChildMutation = useMutation({
    mutationFn: ({ parentId, studentId }: { parentId: string; studentId: string }) =>
      parentApi.linkChild(parentId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: ['parent-stats'] });
      setShowLinkModal(false);
      setLinkForm({ studentId: '' });
      setMessage({ type: 'success', text: 'Student linked to parent!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to link student.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const unlinkChildMutation = useMutation({
    mutationFn: ({ parentId, studentId }: { parentId: string; studentId: string }) =>
      parentApi.unlinkChild(parentId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      setMessage({ type: 'success', text: 'Student unlinked from parent.' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to unlink student.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const parents = Array.isArray(parentsData) ? parentsData : [];
  const students = Array.isArray(studentsData) ? studentsData : [];

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
          <h1 className="text-3xl font-bold text-gray-900">Parents Management</h1>
          <p className="text-gray-600 mt-1">Register and manage parent accounts</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
        >
          + Register Parent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-2xl font-bold text-gray-900">{statsData?.total || 0}</p>
          <p className="text-sm text-gray-500">Total Parents</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-2xl font-bold text-green-600">{statsData?.withLinkedChildren || 0}</p>
          <p className="text-sm text-gray-500">With Linked Children</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-2xl font-bold text-pink-600">{parents.length}</p>
          <p className="text-sm text-gray-500">Registered</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search parents..."
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading parents...</p>
          </div>
        ) : parents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">👪</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Parents Found</h3>
            <p className="text-gray-500 mb-4">Register parents to link them with students.</p>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700">
              + Register Parent
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase">Name</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase">Contact</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase">Linked Children</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parents.map((parent: any) => (
                  <tr key={parent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                          {parent.firstName?.[0]}{parent.lastName?.[0]}
                        </div>
                        <div className="font-medium text-gray-900">{parent.firstName} {parent.lastName}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900">{parent.email}</div>
                        {parent.phone && <div className="text-gray-500">{parent.phone}</div>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {parent.children?.length > 0 ? parent.children.map((pc: any) => (
                          <span key={pc.studentId} className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs font-medium">
                            {pc.student?.firstName} {pc.student?.lastName}
                          </span>
                        )) : <span className="text-gray-400 text-sm">No children linked</span>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedParent(parent); setShowDetailModal(true); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          👁️ View
                        </button>
                        <button
                          onClick={() => { setSelectedParent(parent); setShowLinkModal(true); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100"
                        >
                          🔗 Link Child
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Register Parent</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input type="text" value={parentForm.firstName}
                    onChange={(e) => setParentForm({ ...parentForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input type="text" value={parentForm.lastName}
                    onChange={(e) => setParentForm({ ...parentForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input type="email" value={parentForm.email}
                  onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input type="tel" value={parentForm.phone}
                  onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input type="password" value={parentForm.password}
                  onChange={(e) => setParentForm({ ...parentForm, password: e.target.value })}
                  placeholder="Leave blank for auto-generated"
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => {
                  if (!parentForm.firstName || !parentForm.lastName || !parentForm.email) {
                    setMessage({ type: 'error', text: 'First name, last name, and email are required' });
                    return;
                  }
                  createParentMutation.mutate(parentForm);
                }}
                disabled={createParentMutation.isPending}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-400"
              >
                {createParentMutation.isPending ? 'Registering...' : 'Register Parent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedParent && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold">Parent Details</h2>
              <button onClick={() => { setShowDetailModal(false); setSelectedParent(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-2xl font-bold text-pink-600">
                  {selectedParent.firstName?.[0]}{selectedParent.lastName?.[0]}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedParent.firstName} {selectedParent.lastName}</h3>
                  <p className="text-gray-600">{selectedParent.email}</p>
                  {selectedParent.phone && <p className="text-gray-500">{selectedParent.phone}</p>}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Linked Children ({selectedParent.children?.length || 0})</h4>
                {selectedParent.children?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedParent.children.map((pc: any) => (
                      <div key={pc.studentId} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div>
                          <span className="font-medium">{pc.student?.firstName} {pc.student?.lastName}</span>
                          <span className="text-gray-500 text-sm ml-2">({pc.student?.admissionNumber})</span>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm('Unlink this student from the parent?')) {
                              unlinkChildMutation.mutate({ parentId: selectedParent.id, studentId: pc.studentId });
                            }
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No children linked to this parent</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => { setSelectedParent(parents.find((p: any) => p.id === selectedParent.id) || selectedParent); setShowDetailModal(false); setShowLinkModal(true); }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  + Link Another Child
                </button>
                <button onClick={() => { setShowDetailModal(false); setSelectedParent(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && selectedParent && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-2">Link Child to Parent</h2>
            <p className="text-gray-600 mb-6">{selectedParent.firstName} {selectedParent.lastName}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Student *</label>
                <select
                  value={linkForm.studentId}
                  onChange={(e) => setLinkForm({ studentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Student</option>
                  {students
                    .filter((s: any) => !selectedParent.children?.some((pc: any) => pc.studentId === s.id))
                    .map((student: any) => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName} ({student.admissionNumber})
                      </option>
                    ))}
                </select>
                {students.filter((s: any) => !selectedParent.children?.some((pc: any) => pc.studentId === s.id)).length === 0 && (
                  <p className="text-sm text-amber-600 mt-2">All students are already linked to this parent.</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-6">
              <button onClick={() => { setShowLinkModal(false); setLinkForm({ studentId: '' }); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => {
                  if (!linkForm.studentId) { setMessage({ type: 'error', text: 'Select a student' }); return; }
                  linkChildMutation.mutate({ parentId: selectedParent.id, studentId: linkForm.studentId });
                }}
                disabled={!linkForm.studentId || linkChildMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {linkChildMutation.isPending ? 'Linking...' : 'Link Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
