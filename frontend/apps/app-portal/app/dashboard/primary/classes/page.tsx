'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classApi, teacherApi, studentApi } from '@/lib/api';

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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    grade: '1',
    classTeacher: '',
  });

  const { data: classes, isLoading } = useQuery({
    queryKey: ['primary-classes'],
    queryFn: () => classApi.getAll().then(r => r.data?.data || r.data || []),
  });

  const { data: teachers } = useQuery({
    queryKey: ['primary-teachers-all'],
    queryFn: () => teacherApi.getAll({}).then(r => r.data?.data || r.data || []),
  });

  const { data: students } = useQuery({
    queryKey: ['primary-students-count'],
    queryFn: () => studentApi.getAll({}).then(r => r.data?.data || r.data || []),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => classApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['primary-classes'] });
      setShowCreateForm(false);
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

  const studentsByClass: Record<string, number> = {};
  (students || []).forEach((s: any) => {
    const key = s.classId || s.className || s.class;
    studentsByClass[key] = (studentsByClass[key] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
          <p className="text-gray-500 text-sm mt-1">Grade 1–7 classes with ECZ alignment</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
        >
          <i className="fas fa-plus" />
          Create Class
        </button>
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
            <div className="text-4xl mb-3 text-gray-300"><i className="fas fa-school" /></div>
            <p>No classes created yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Class Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ECZ Alignment</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Class Teacher</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Pupils</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(classes || []).map((cls: any) => {
                const grade = getGradeFromClass(cls);
                const gradeInfo = PRIMARY_GRADES.find(g => g.grade === grade);
                const pupilCount = studentsByClass[cls.id || cls.name] || 0;
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
                    <td className="px-6 py-4 text-sm text-gray-600">{cls.classTeacherName || cls.classTeacher || 'Not assigned'}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{pupilCount}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                        <button className="text-emerald-600 hover:text-emerald-800 text-sm">Pupils</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Create New Class</h2>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
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
                  {(teachers || []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.role || 'Teacher'})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
              <button
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || createMutation.isPending}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
