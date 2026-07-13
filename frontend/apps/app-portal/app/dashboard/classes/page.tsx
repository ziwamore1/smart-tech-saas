'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classApi, levelTypeApi, enrollmentApi, studentApi, subjectApi, classSubjectApi, gradingSystemApi, api, classTeacherAssignmentApi, academicYearApi } from '@/lib/api';
import { usePermissions } from '@/lib/permission-context';

type LevelCategory = 'FORM' | 'GRADE' | 'OTHER';

const STREAM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const PRESET_LEVELS: Record<LevelCategory, string[]> = {
  FORM: ['Form 1', 'Form 2', 'Form 3', 'Form 4'],
  GRADE: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  OTHER: ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'],
};

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManageClasses = can('classes.manage');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showLevelTypeModal, setShowLevelTypeModal] = useState(false);
  const [levelTypeForm, setLevelTypeForm] = useState({ name: '', order: 1 });
  const [selectedLevelCategory, setSelectedLevelCategory] = useState<LevelCategory>('GRADE');
  
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', capacity: '', gradingSystemId: '' });
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [showClassTeacherModal, setShowClassTeacherModal] = useState(false);
  const [classTeacherForm, setClassTeacherForm] = useState({ teacherId: '', academicYearId: '', isPrimary: true });

  const { data: classesResponse, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(res => res.data),
  });

  const { data: levelTypesResponse, refetch: refetchLevelTypes } = useQuery({
    queryKey: ['levelTypes'],
    queryFn: () => levelTypeApi.getAll().then(res => res.data),
  });

  const { data: teachersData } = useQuery({
    queryKey: ['teachers-for-class'],
    queryFn: async () => {
      const res = await api.get('/teacher');
      let data = res.data?.data || res.data?.teachers || res.data || [];
      return Array.isArray(data) ? data : [];
    },
  });

  const teachers = Array.isArray(teachersData) ? teachersData : [];

  const { data: gradingSystemsResponse } = useQuery({
    queryKey: ['grading-systems'],
    queryFn: () => gradingSystemApi.getAll().then((res: any) => {
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    }),
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

  const { data: classTeacherAssignments } = useQuery({
    queryKey: ['class-teacher-assignments'],
    queryFn: async () => {
      try {
        const res = await classTeacherAssignmentApi.findBySchool();
        let data = res.data?.data || res.data || [];
        return Array.isArray(data) ? data : [];
      } catch { return []; }
    },
  });

  const gradingSystems = Array.isArray(gradingSystemsResponse) ? gradingSystemsResponse : [];

  const setClassTeacherMutation = useMutation({
    mutationFn: ({ classId, teacherId }: { classId: string; teacherId: string | null }) =>
      classApi.setClassTeacher(classId, teacherId),
    onSuccess: (response) => {
      const updatedClass = response?.data?.data || response?.data;
      if (updatedClass?.id && selectedClass?.id === updatedClass.id) {
        setSelectedClass((prev: any) => ({ ...prev, classTeacher: updatedClass.classTeacher }));
      }
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setMessage({ type: 'success', text: 'Class teacher updated!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update class teacher.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const createClassTeacherAssignmentMutation = useMutation({
    mutationFn: (data: { teacherId: string; classId: string; academicYearId: string; isPrimary?: boolean }) =>
      classTeacherAssignmentApi.assign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-teacher-assignments'] });
      setShowClassTeacherModal(false);
      setClassTeacherForm({ teacherId: '', academicYearId: '', isPrimary: true });
      setMessage({ type: 'success', text: 'Class teacher assigned!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to assign class teacher.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const removeClassTeacherAssignmentMutation = useMutation({
    mutationFn: (id: string) => classTeacherAssignmentApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-teacher-assignments'] });
      setMessage({ type: 'success', text: 'Class teacher assignment removed!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to remove assignment.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const { data: subjectsResponse } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    },
  });

  const subjects = Array.isArray(subjectsResponse) ? subjectsResponse : [];

  const { data: classSubjectsData } = useQuery({
    queryKey: ['class-subjects', selectedClass?.id],
    queryFn: async () => {
      if (!selectedClass?.id) return [];
      const res = await classSubjectApi.getByClass(selectedClass.id);
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedClass?.id,
  });

  const { data: enrollmentsData, refetch: refetchEnrollments } = useQuery({
    queryKey: ['class-enrollments', selectedClass?.id],
    queryFn: async () => {
      if (!selectedClass?.id) return [];
      const res = await enrollmentApi.getByClass(selectedClass.id);
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedClass?.id,
  });

  const enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : [];

  const levelTypes = Array.isArray(levelTypesResponse) ? levelTypesResponse : 
                     levelTypesResponse?.data ? levelTypesResponse.data : [];

  const createLevelTypeMutation = useMutation({
    mutationFn: async (data: { name: string; order: number }) => {
      console.log('Creating level type:', data);
      return levelTypeApi.create(data);
    },
    onSuccess: () => {
      console.log('Level type created successfully!');
      refetchLevelTypes();
      setMessage({ type: 'success', text: 'Level type created successfully!' });
      setTimeout(() => setMessage(null), 3000);
      setLevelTypeForm({ name: '', order: levelTypeForm.order + 1 });
    },
    onError: (error: any) => {
      console.error('Failed to create level type:', error);
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to create level type' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deleteLevelTypeMutation = useMutation({
    mutationFn: (id: string) => levelTypeApi.delete(id),
    onSuccess: () => {
      refetchLevelTypes();
      setMessage({ type: 'success', text: 'Level type deleted!' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const [classForm, setClassForm] = useState({
    name: '',
    levelTypeId: '',
    capacity: '',
    levelNumber: '',
    streamLetter: 'A',
    gradingSystemId: '',
  });

  const createClassMutation = useMutation({
    mutationFn: (data: any) => classApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setShowAddModal(false);
      setMessage({ type: 'success', text: `Class "${data?.data?.name || classForm.name}" created successfully!` });
      setTimeout(() => setMessage(null), 3000);
      setClassForm({ name: '', levelTypeId: '', capacity: '', levelNumber: '', streamLetter: 'A', gradingSystemId: '' });
    },
    onError: (error: any) => {
      console.error('Failed to create class:', error);
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to create class. Please try again.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const updateClassMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => classApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setShowEditModal(false);
      setSelectedClass(null);
      setMessage({ type: 'success', text: `Class "${data?.data?.name || editForm.name}" updated successfully!` });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      console.error('Failed to update class:', error);
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update class.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id: string) => classApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['classes'] });
      const previousClasses = queryClient.getQueryData(['classes']);
      queryClient.setQueryData(['classes'], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: (old.data || []).filter((c: any) => c.id !== id) };
      });
      return { previousClasses };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setMessage({ type: 'success', text: 'Class deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any, _id, context) => {
      if (context?.previousClasses) {
        queryClient.setQueryData(['classes'], context.previousClasses);
      }
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to delete class.' });
      setTimeout(() => setMessage(null), 5000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const addSubjectToClassMutation = useMutation({
    mutationFn: (data: { classId: string; subjectId: string }) => classSubjectApi.add(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
      setMessage({ type: 'success', text: 'Subject added to class successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to add subject.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const removeSubjectFromClassMutation = useMutation({
    mutationFn: ({ classId, subjectId }: { classId: string; subjectId: string }) => 
      classSubjectApi.remove(classId, subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
      setMessage({ type: 'success', text: 'Subject removed from class successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to remove subject.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  let classesData = classesResponse;
  if (classesData?.data) classesData = classesData.data;
  if (classesData?.classes) classesData = classesData.classes;
  const classes = Array.isArray(classesData) ? classesData : [];
  const filteredClasses = classes.filter((cls: any) => {
    const matchesSearch = searchTerm === '' ||
      cls.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = filterLevel === '' || cls.levelTypeId === filterLevel;
    return matchesSearch && matchesLevel;
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
          <h1 className="text-3xl font-bold text-gray-900">Classes Management</h1>
          <p className="text-gray-600 mt-1">Manage Form, Grade, or other class types with streams</p>
        </div>
        <div className="flex gap-2">
          {canManageClasses && (
          <>
          <button
            onClick={() => setShowLevelTypeModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Manage Levels
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            disabled={levelTypes.length === 0}
            title={levelTypes.length === 0 ? 'Create level types first' : ''}
          >
            + Add Class
          </button>
          </>
          )}
        </div>
      </div>

      {levelTypes.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            <strong>Note:</strong> You need to create level types (like "Grade 1", "Grade 10") before creating classes. Click "Manage Levels" to get started.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search classes..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Level Filter</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Levels</option>
              {levelTypes.sort((a: any, b: any) => a.order - b.order).map((level: any) => (
                <option key={level.id} value={level.id}>{level.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              Total Classes: <span className="font-bold text-gray-900">{classes.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {classesLoading ? (
          <div className="col-span-full text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading classes...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-6xl mb-4">🏫</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Classes Found</h3>
            <p className="text-gray-500 mb-4">Create your first class to get started.</p>
            {levelTypes.length > 0 && (
              <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                + Add Class
              </button>
            )}
          </div>
        ) : (
          filteredClasses.map((cls: any, index: number) => {
            const colors = [
              { from: 'from-blue-500', to: 'to-blue-700', bg: 'bg-blue-100', text: 'text-blue-700' },
              { from: 'from-green-500', to: 'to-green-700', bg: 'bg-green-100', text: 'text-green-700' },
              { from: 'from-purple-500', to: 'to-purple-700', bg: 'bg-purple-100', text: 'text-purple-700' },
              { from: 'from-pink-500', to: 'to-pink-700', bg: 'bg-pink-100', text: 'text-pink-700' },
              { from: 'from-indigo-500', to: 'to-indigo-700', bg: 'bg-indigo-100', text: 'text-indigo-700' },
              { from: 'from-amber-500', to: 'to-amber-700', bg: 'bg-amber-100', text: 'text-amber-700' },
            ];
            const colorSet = colors[index % colors.length];
            
            return (
            <div key={cls.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all group">
              <div className={`h-2 bg-gradient-to-r ${colorSet.from} ${colorSet.to}`}></div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{cls.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${colorSet.bg} ${colorSet.text}`}>
                      {cls.levelType?.name || 'No level'}
                    </span>
                    {cls.gradingSystem && (
                      <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {cls.gradingSystem.name}
                      </span>
                    )}
                  </div>
                  <span className="text-3xl opacity-50 group-hover:opacity-100 transition-opacity">{cls.name?.[0] || '📚'}</span>
                </div>
                
                {cls.classTeacher && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                    <span>👨‍🏫</span>
                    <span className="font-medium">{cls.classTeacher.firstName} {cls.classTeacher.lastName}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{cls.totalStudents ?? cls._count?.enrollments ?? 0}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{cls.maleCount ?? 0}</div>
                    <div className="text-xs text-gray-500">Male</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-pink-600">{cls.femaleCount ?? 0}</div>
                    <div className="text-xs text-gray-500">Female</div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <button 
                    onClick={() => {
                      setSelectedClass(cls);
                      setShowStudentsModal(true);
                    }}
                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 text-xs font-medium transition-colors"
                  >
                    👥 Students
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedClass(cls);
                      setShowSubjectsModal(true);
                    }}
                    className="px-3 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 text-xs font-medium transition-colors"
                  >
                    📚
                  </button>
                  {canManageClasses && (
                  <button 
                    onClick={() => {
                      setSelectedClass(cls);
                      setClassTeacherForm({ teacherId: '', academicYearId: academicYearsData?.[0]?.id || '', isPrimary: true });
                      setShowClassTeacherModal(true);
                    }}
                    className="px-3 py-2 bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100 text-xs font-medium transition-colors"
                    title="Manage Class Teacher"
                  >
                    🏫
                  </button>
                  )}
                  {canManageClasses && (
                  <button 
                    onClick={() => {
                      setSelectedClass(cls);
                      setEditForm({ name: cls.name, capacity: cls.capacity?.toString() || '', gradingSystemId: cls.gradingSystem?.id || '' });
                      setShowEditModal(true);
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 text-xs font-medium transition-colors"
                  >
                    ✏️
                  </button>
                  )}
                  {canManageClasses && (
                  <button 
                    onClick={() => {
                      if (confirm(`Delete class "${cls.name}"? This cannot be undone.`)) {
                        deleteClassMutation.mutate(cls.id);
                      }
                    }}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 text-xs font-medium transition-colors"
                    title="Delete Class"
                  >
                    🗑️
                  </button>
                  )}
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Add New Class</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Level Type *
                  </label>
                  <select
                    value={classForm.levelTypeId}
                    onChange={(e) => {
                      const selectedLevel = levelTypes.find((lt: any) => lt.id === e.target.value);
                      setClassForm(prev => ({ 
                        ...prev, 
                        levelTypeId: e.target.value,
                        levelNumber: selectedLevel?.order?.toString() || ''
                      }));
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select Level</option>
                    {levelTypes.map((level: any) => (
                      <option key={level.id} value={level.id}>
                        {level.name} (Order: {level.order})
                      </option>
                    ))}
                  </select>
                  {levelTypes.length === 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      No level types found. Please create level types first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stream *
                  </label>
                  <select
                    value={classForm.streamLetter}
                    onChange={(e) => {
                      const selectedLevel = levelTypes.find((lt: any) => lt.id === classForm.levelTypeId);
                      const prefix = selectedLevel?.name?.replace(/\d+/g, '').trim() || '';
                      const num = selectedLevel?.order?.toString() || classForm.levelNumber;
                      const newName = `${prefix} ${num}${e.target.value}`.trim();
                      setClassForm(prev => ({ ...prev, streamLetter: e.target.value, name: newName }));
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                    disabled={!classForm.levelTypeId}
                  >
                    {STREAM_LETTERS.map((letter) => (
                      <option key={letter} value={letter}>{letter}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order (Display Order) *
                  </label>
                  <input
                    type="number"
                    value={classForm.levelNumber || ''}
                    onChange={(e) => {
                      const selectedLevel = levelTypes.find((lt: any) => lt.id === classForm.levelTypeId);
                      const prefix = selectedLevel?.name?.replace(/\d+/g, '').trim() || '';
                      const newName = `${prefix} ${e.target.value}${classForm.streamLetter}`.trim();
                      setClassForm(prev => ({ ...prev, levelNumber: e.target.value, name: newName }));
                    }}
                    placeholder="e.g., 1, 2, 10"
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class Name (Generated)
                  </label>
                  <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-800 h-[42px] flex items-center">
                    {classForm.name || '-'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grading System
                </label>
                <select
                  value={classForm.gradingSystemId}
                  onChange={(e) => setClassForm({ ...classForm, gradingSystemId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Use School Default</option>
                  {gradingSystems.map((gs: any) => (
                    <option key={gs.id} value={gs.id}>
                      {gs.name} {gs.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity
                </label>
                <input
                  type="number"
                  value={classForm.capacity}
                  onChange={(e) => setClassForm({ ...classForm, capacity: e.target.value })}
                  placeholder="e.g., 40"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!classForm.name || !classForm.levelTypeId || !classForm.levelNumber) {
                      setMessage({ type: 'error', text: 'Please fill in all required fields (Level Type, Order, and Stream).' });
                      setTimeout(() => setMessage(null), 3000);
                      return;
                    }
                    createClassMutation.mutate({
                      name: classForm.name,
                      levelTypeId: classForm.levelTypeId,
                      order: parseInt(classForm.levelNumber),
                      capacity: classForm.capacity ? parseInt(classForm.capacity) : undefined,
                      gradingSystemId: classForm.gradingSystemId || undefined,
                    });
                  }}
                  disabled={!classForm.name || !classForm.levelTypeId || createClassMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {createClassMutation.isPending ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLevelTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Manage Level Types</h2>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-3">Quick Add Preset Levels</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {(['GRADE', 'FORM', 'OTHER'] as LevelCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedLevelCategory(cat)}
                    className={`px-3 py-1 text-sm rounded-full border ${
                      selectedLevelCategory === cat 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_LEVELS[selectedLevelCategory].map((level) => {
                  const order = parseInt(level.match(/\d+/)?.[0] || '1');
                  const exists = levelTypes.some((lt: any) => lt.name === level);
                  return (
                  <button
                    key={level}
                    onClick={() => {
                      console.log('Preset button clicked:', level, order, 'exists:', exists);
                      if (!exists) {
                        createLevelTypeMutation.mutate({ name: level, order });
                      }
                    }}
                    disabled={exists || createLevelTypeMutation.isPending}
                    className={`px-3 py-1 text-sm rounded border ${
                      exists
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                    }`}
                  >
                    {level} {exists && '✓'}
                  </button>
                );
                })}
              </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-3">Create Custom Level</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={levelTypeForm.name}
                  onChange={(e) => setLevelTypeForm({ ...levelTypeForm, name: e.target.value })}
                  placeholder="e.g., Senior 1"
                  className="flex-1 px-3 py-2 border rounded-lg"
                />
                <input
                  type="number"
                  value={levelTypeForm.order}
                  onChange={(e) => setLevelTypeForm({ ...levelTypeForm, order: parseInt(e.target.value) || 1 })}
                  placeholder="Order"
                  className="w-24 px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={() => {
                    if (levelTypeForm.name) {
                      createLevelTypeMutation.mutate(levelTypeForm);
                      setLevelTypeForm({ name: '', order: levelTypeForm.order + 1 });
                    }
                  }}
                  disabled={!levelTypeForm.name || createLevelTypeMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Existing Level Types</h3>
              {levelTypes.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No level types created yet</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {levelTypes
                    .sort((a: any, b: any) => a.order - b.order)
                    .map((level: any) => (
                      <div key={level.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded border">
                        <span className="font-medium">{level.name}</span>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${level.name}"?`)) {
                              deleteLevelTypeMutation.mutate(level.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowLevelTypeModal(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showStudentsModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Students in {selectedClass.name}</h2>
              <button
                onClick={() => {
                  setShowStudentsModal(false);
                  setSelectedClass(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            {enrollments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No students enrolled in this class yet.
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-4">Name</th>
                      <th className="text-left py-2 px-4">Admission No</th>
                      <th className="text-left py-2 px-4">Gender</th>
                      <th className="text-left py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enrollment: any) => (
                      <tr key={enrollment.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4">
                          {enrollment.student?.firstName} {enrollment.student?.lastName}
                        </td>
                        <td className="py-2 px-4">{enrollment.student?.admissionNumber || '-'}</td>
                        <td className="py-2 px-4">{enrollment.student?.gender || '-'}</td>
                        <td className="py-2 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            enrollment.status === 'ACTIVE' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {enrollment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showEditModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Class</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedClass(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            {setClassTeacherMutation.isError && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
                {setClassTeacherMutation.error?.response?.data?.message || 'Failed to update class teacher.'}
              </div>
            )}
            {setClassTeacherMutation.isSuccess && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">
                Class teacher updated!
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class Name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class Teacher
                </label>
                <select
                  value={selectedClass.classTeacher?.id || ''}
                  onChange={(e) => {
                    const teacherId = e.target.value || null;
                    setClassTeacherMutation.mutate({ classId: selectedClass.id, teacherId });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grading System
                </label>
                <select
                  value={selectedClass.gradingSystem?.id || ''}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    updateClassMutation.mutate({
                      id: selectedClass.id,
                      data: { gradingSystemId: val },
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Use School Default</option>
                  {gradingSystems.map((gs: any) => (
                    <option key={gs.id} value={gs.id}>
                      {gs.name} {gs.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity
                </label>
                <input
                  type="number"
                  value={editForm.capacity}
                  onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., 40"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedClass(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!editForm.name) {
                      setMessage({ type: 'error', text: 'Class name is required' });
                      setTimeout(() => setMessage(null), 3000);
                      return;
                    }
                    updateClassMutation.mutate({
                      id: selectedClass.id,
                      data: {
                        name: editForm.name,
                        capacity: editForm.capacity ? parseInt(editForm.capacity) : null,
                      },
                    });
                  }}
                  disabled={updateClassMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {updateClassMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSubjectsModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Subjects for {selectedClass.name}</h2>
              <button
                onClick={() => {
                  setShowSubjectsModal(false);
                  setSelectedClass(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add Subject to Class
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg"
                >
                  <option value="">Select a subject</option>
                  {subjects.map((subject: any) => {
                    const assignedSubjects = classSubjectsData || [];
                    const isAssigned = Array.isArray(assignedSubjects) && assignedSubjects.some(
                      (cs: any) => cs.subjectId === subject.id
                    );
                    return (
                      <option key={subject.id} value={subject.id} disabled={isAssigned}>
                        {subject.name} {subject.code ? `(${subject.code})` : ''} {isAssigned ? '- Already assigned' : ''}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={() => {
                    if (selectedSubjectId) {
                      addSubjectToClassMutation.mutate({
                        classId: selectedClass.id,
                        subjectId: selectedSubjectId,
                      });
                      setSelectedSubjectId('');
                    }
                  }}
                  disabled={!selectedSubjectId || addSubjectToClassMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <h3 className="font-semibold mb-3">Assigned Subjects ({(classSubjectsData || []).length || 0})</h3>
              {!(classSubjectsData && classSubjectsData.length > 0) ? (
                <div className="text-center py-8 text-gray-500">
                  No subjects assigned to this class yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {(classSubjectsData || []).map((cs: any) => (
                    <div key={cs.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{cs.subject?.name}</span>
                        {cs.subject?.code && (
                          <span className="ml-2 text-sm text-gray-500">({cs.subject.code})</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${cs.subject?.name} from ${selectedClass.name}?`)) {
                            removeSubjectFromClassMutation.mutate({
                              classId: selectedClass.id,
                              subjectId: cs.subjectId,
                            });
                          }
                        }}
                        disabled={removeSubjectFromClassMutation.isPending}
                        className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4 pt-4 border-t">
              <button
                onClick={() => {
                  setShowSubjectsModal(false);
                  setSelectedClass(null);
                }}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showClassTeacherModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-2">Class Teacher — {selectedClass.name}</h2>
            <p className="text-gray-500 text-sm mb-4">Manage class teacher assignments for this class</p>

            {(classTeacherAssignments || []).filter((cta: any) => cta.classId === selectedClass.id).length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">Current Assignments</h3>
                <div className="space-y-2">
                  {(classTeacherAssignments || [])
                    .filter((cta: any) => cta.classId === selectedClass.id)
                    .map((cta: any) => (
                      <div key={cta.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{cta.teacher?.firstName} {cta.teacher?.lastName}</div>
                          <div className="text-sm text-gray-500">
                            {cta.academicYear?.name} · {cta.isPrimary ? '⭐ Primary' : '👤 Secondary'}
                            {cta.startDate && ` · Since ${new Date(cta.startDate).toLocaleDateString()}`}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${cta.teacher?.firstName} as class teacher?`)) {
                              removeClassTeacherAssignmentMutation.mutate(cta.id);
                            }
                          }}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-700 mb-3">Assign New Class Teacher</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teacher *</label>
                  <select value={classTeacherForm.teacherId} onChange={(e) => setClassTeacherForm({ ...classTeacherForm, teacherId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select Teacher</option>
                    {teachers.map((t: any) => (
                      <option key={t.id} value={t.user?.id || t.id}>{t.user?.firstName} {t.user?.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                  <select value={classTeacherForm.academicYearId} onChange={(e) => setClassTeacherForm({ ...classTeacherForm, academicYearId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select Academic Year</option>
                    {(academicYearsData || []).map((y: any) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="ctaIsPrimary" checked={classTeacherForm.isPrimary} onChange={(e) => setClassTeacherForm({ ...classTeacherForm, isPrimary: e.target.checked })} className="rounded border-gray-300" />
                  <label htmlFor="ctaIsPrimary" className="text-sm text-gray-700">Primary class teacher (homeroom)</label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t">
              <button onClick={() => { setShowClassTeacherModal(false); setSelectedClass(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => {
                  if (!classTeacherForm.teacherId || !classTeacherForm.academicYearId) {
                    alert('Please select a teacher and academic year');
                    return;
                  }
                  createClassTeacherAssignmentMutation.mutate({
                    teacherId: classTeacherForm.teacherId,
                    classId: selectedClass.id,
                    academicYearId: classTeacherForm.academicYearId,
                    isPrimary: classTeacherForm.isPrimary,
                  });
                }}
                disabled={createClassTeacherAssignmentMutation.isPending}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
              >
                {createClassTeacherAssignmentMutation.isPending ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
