'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classApi, teacherApi, studentApi, gradingSystemApi, api, classTeacherAssignmentApi, academicYearApi } from '@/lib/api';
import { usePermissions } from '@/lib/permission-context';

const PRIMARY_GRADES = [
  { grade: 'Pre', label: 'Pre-School (ECE)', ecxAlignment: 'Preparatory', color: '#f59e0b' },
  { grade: '1', label: 'Grade 1', ecxAlignment: 'Lower Primary', color: '#3b82f6' },
  { grade: '2', label: 'Grade 2', ecxAlignment: 'Lower Primary', color: '#10b981' },
  { grade: '3', label: 'Grade 3', ecxAlignment: 'Lower Primary', color: '#8b5cf6' },
  { grade: '4', label: 'Grade 4', ecxAlignment: 'Upper Primary', color: '#ec4899' },
  { grade: '5', label: 'Grade 5', ecxAlignment: 'Upper Primary', color: '#0891b2' },
  { grade: '6', label: 'Grade 6', ecxAlignment: 'Upper Primary', color: '#ea6645' },
  { grade: '7', label: 'Grade 7', ecxAlignment: 'ECZ Examination', color: '#7c3aed' },
];

export default function PrimaryClassesPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManageClasses = can('classes.manage');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    grade: '1',
    classTeacher: '',
    gradingSystemId: '',
  });
  const [editForm, setEditForm] = useState({ name: '', capacity: '', gradingSystemId: '' });

  const { data: classes, isLoading } = useQuery({
    queryKey: ['primary-classes'],
    queryFn: () => classApi.getAll().then(r => r.data?.data || r.data || []),
  });

  const { data: teachersData } = useQuery({
    queryKey: ['primary-teachers-all'],
    queryFn: () => api.get('/teacher').then(r => {
      let data = r.data?.data || r.data || [];
      return Array.isArray(data) ? data : [];
    }),
  });

  const teachers = Array.isArray(teachersData) ? teachersData : [];

  const { data: gradingSystems } = useQuery({
    queryKey: ['grading-systems'],
    queryFn: () => gradingSystemApi.getAll().then((r: any) => r.data?.data || r.data || []),
  });

  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      try {
        const res = await academicYearApi.getAll();
        let data = res.data?.data || res.data || [];
        return Array.isArray(data) ? data : [];
      } catch { return []; }
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => classApi.create(data),
    onSuccess: (response) => {
      const newClass = response?.data?.data || response?.data;
      if (newClass?.id) {
        queryClient.setQueryData(['primary-classes'], (old: any) => [newClass, ...(old || [])]);
      }
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setShowCreateForm(false);
      setMessage({ type: 'success', text: 'Class created successfully!' });
      setTimeout(() => setMessage(null), 3000);
      setFormData({ name: '', grade: '1', classTeacher: '', gradingSystemId: '' });
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to create class.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => classApi.update(id, data),
    onSuccess: (response) => {
      const updated = response?.data?.data || response?.data;
      if (updated?.id) {
        queryClient.setQueryData(['primary-classes'], (old: any) =>
          (old || []).map((c: any) => c.id === updated.id ? { ...c, ...updated } : c)
        );
      }
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setShowEditModal(false);
      setSelectedClass(null);
      setMessage({ type: 'success', text: 'Class updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update class.' });
      setTimeout(() => setMessage(null), 5000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['primary-classes'] });
    },
  });

  const setClassTeacherMutation = useMutation({
    mutationFn: ({ classId, teacherId }: { classId: string; teacherId: string | null }) =>
      classApi.setClassTeacher(classId, teacherId),
    onSuccess: (response) => {
      const updatedClass = response?.data?.data || response?.data;
      if (updatedClass?.id) {
        queryClient.setQueryData(['primary-classes'], (old: any) =>
          (old || []).map((c: any) => c.id === updatedClass.id ? { ...c, classTeacher: updatedClass.classTeacher } : c)
        );
        if (selectedClass?.id === updatedClass.id) {
          setSelectedClass((prev: any) => prev ? { ...prev, classTeacher: updatedClass.classTeacher } : prev);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setMessage({ type: 'success', text: 'Class teacher updated!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update class teacher.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['primary-classes'] });
      const previousClasses = queryClient.getQueryData(['primary-classes']);
      queryClient.setQueryData(['primary-classes'], (old: any) =>
        (old || []).filter((c: any) => c.id !== id)
      );
      return { previousClasses };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setMessage({ type: 'success', text: 'Class deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any, _id, context) => {
      if (context?.previousClasses) {
        queryClient.setQueryData(['primary-classes'], context.previousClasses);
      }
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to delete class.' });
      setTimeout(() => setMessage(null), 5000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['primary-classes'] });
    },
  });

  const getGradeFromClass = (cls: any): string => {
    const name = cls.name || cls.className || '';
    for (const g of PRIMARY_GRADES) {
      if (name.includes(`Grade ${g.grade}`) || name.includes(`grade ${g.grade}`) || name.includes(g.grade === 'Pre' ? 'Pre' : ` ${g.grade} `)) {
        return g.grade;
      }
    }
    return '—';
  };

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

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
          <p className="text-gray-500 text-sm mt-1">Grade 1–7 classes with ECZ alignment</p>
        </div>
        {canManageClasses && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
        >
          + Create Class
        </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {PRIMARY_GRADES.map(g => {
          const clsCount = (classes || []).filter((c: any) => getGradeFromClass(c) === g.grade).length;
          return (
            <div key={g.grade} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: g.color }}>{g.grade}</div>
              <p className="text-xs text-gray-500 mt-1">{g.label}</p>
              <p className="text-xs text-gray-400 mt-1">{clsCount} class{clsCount !== 1 ? 'es' : ''}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">All Classes</h2>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading classes...</div>
        ) : (classes || []).length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="text-4xl mb-3 text-gray-300">🏫</div>
            <p>No classes created yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Class Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ECZ Alignment</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Grading System</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Class Teacher</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(classes || []).map((cls: any) => {
                const grade = getGradeFromClass(cls);
                const gradeInfo = PRIMARY_GRADES.find(g => g.grade === grade);
                const classTeacherName = cls.classTeacher
                  ? `${cls.classTeacher.firstName || ''} ${cls.classTeacher.lastName || ''}`.trim()
                  : null;
                return (
                  <tr key={cls.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{cls.name || cls.className}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-medium" style={{
                        backgroundColor: `${gradeInfo?.color}15`,
                        color: gradeInfo?.color || '#6b7280',
                      }}>
                        Grade {grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{gradeInfo?.ecxAlignment || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {cls.gradingSystem?.name || 'Default'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {classTeacherName ? (
                        <span className="text-emerald-700 font-medium">👨‍🏫 {classTeacherName}</span>
                      ) : (
                        <span className="text-gray-400 italic">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canManageClasses && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setSelectedClass(cls);
                            setEditForm({
                              name: cls.name || '',
                              capacity: cls.capacity?.toString() || '',
                              gradingSystemId: cls.gradingSystem?.id || '',
                            });
                            setShowEditModal(true);
                          }}
                          className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete class "${cls.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(cls.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Create New Class</h2>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
                <input
                  type="text" value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g., Grade 5A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <select
                  value={formData.grade}
                  onChange={e => setFormData(p => ({ ...p, grade: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  {PRIMARY_GRADES.map(g => <option key={g.grade} value={g.grade}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Teacher</label>
                <select
                  value={formData.classTeacher}
                  onChange={e => setFormData(p => ({ ...p, classTeacher: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select teacher</option>
                  {teachers.map((t: any) => {
                    const user = t.user || {};
                    const name = user.firstName || user.lastName
                      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                      : `Staff (${t.employeeNo || 'Unknown'})`;
                    return (
                      <option key={t.id} value={user.id || t.id}>{name}</option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grading System</label>
                <select
                  value={formData.gradingSystemId}
                  onChange={e => setFormData(p => ({ ...p, gradingSystemId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Use School Default</option>
                  {(gradingSystems || []).map((gs: any) => (
                    <option key={gs.id} value={gs.id}>
                      {gs.name} {gs.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
              <button
                onClick={() => {
                  if (!formData.name) {
                    setMessage({ type: 'error', text: 'Class name is required.' });
                    setTimeout(() => setMessage(null), 3000);
                    return;
                  }
                  const createData: any = {
                    name: formData.name,
                    levelTypeId: '',
                    order: parseInt(formData.grade === 'Pre' ? '0' : formData.grade) || 1,
                    capacity: 40,
                  };
                  if (formData.gradingSystemId) createData.gradingSystemId = formData.gradingSystemId;
                  createMutation.mutate(createData);
                }}
                disabled={!formData.name || createMutation.isPending}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedClass && (
        <div className="fixed inset-0 bg-gray-600 z-50 flex items-center justify-center p-4" onClick={() => { setShowEditModal(false); setSelectedClass(null); }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Edit Class: {selectedClass.name}</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedClass(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
                <input
                  type="text" value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Teacher</label>
                <select
                  value={selectedClass.classTeacher?.id || ''}
                  onChange={(e) => {
                    const teacherId = e.target.value || null;
                    setClassTeacherMutation.mutate({ classId: selectedClass.id, teacherId });
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">— None —</option>
                  {teachers.map((t: any) => {
                    const user = t.user || {};
                    const displayName = user.firstName || user.lastName
                      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                      : `Staff (${t.employeeNo || 'Unknown'})`;
                    return (
                      <option key={t.id} value={user.id || t.id}>
                        {displayName} ({t.employeeNo || 'No ID'})
                      </option>
                    );
                  })}
                </select>
                {setClassTeacherMutation.isPending && (
                  <p className="text-xs text-blue-600 mt-1">Saving class teacher...</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                <input
                  type="number" value={editForm.capacity}
                  onChange={e => setEditForm(p => ({ ...p, capacity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g., 40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grading System</label>
                <select
                  value={editForm.gradingSystemId}
                  onChange={e => setEditForm(p => ({ ...p, gradingSystemId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Use School Default</option>
                  {(gradingSystems || []).map((gs: any) => (
                    <option key={gs.id} value={gs.id}>
                      {gs.name} {gs.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setShowEditModal(false); setSelectedClass(null); }} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
              <button
                onClick={() => {
                  if (!editForm.name) {
                    setMessage({ type: 'error', text: 'Class name is required.' });
                    setTimeout(() => setMessage(null), 3000);
                    return;
                  }
                  updateMutation.mutate({
                    id: selectedClass.id,
                    data: {
                      name: editForm.name,
                      capacity: editForm.capacity ? parseInt(editForm.capacity) : null,
                      gradingSystemId: editForm.gradingSystemId || null,
                    },
                  });
                }}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
