'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classApi, levelTypeApi, enrollmentApi, studentApi, subjectApi, classSubjectApi, api } from '@/lib/api';

type LevelCategory = 'FORM' | 'GRADE' | 'OTHER';

const STREAM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const PRESET_LEVELS: Record<LevelCategory, string[]> = {
  FORM: ['Form 1', 'Form 2', 'Form 3', 'Form 4'],
  GRADE: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  OTHER: ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'],
};

export default function ClassesPage() {
  const queryClient = useQueryClient();
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
  const [editForm, setEditForm] = useState({ name: '', capacity: '' });
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

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

  const setClassTeacherMutation = useMutation({
    mutationFn: ({ classId, teacherId }: { classId: string; teacherId: string | null }) =>
      classApi.setClassTeacher(classId, teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setMessage({ type: 'success', text: 'Class teacher updated!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update class teacher.' });
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
  });

  const createClassMutation = useMutation({
    mutationFn: (data: any) => classApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setShowAddModal(false);
      setMessage({ type: 'success', text: `Class "${data?.data?.name || classForm.name}" created successfully!` });
      setTimeout(() => setMessage(null), 3000);
      setClassForm({ name: '', levelTypeId: '', capacity: '', levelNumber: '', streamLetter: 'A' });
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
                  <button 
                    onClick={() => {
                      setSelectedClass(cls);
                      setEditForm({ name: cls.name, capacity: cls.capacity?.toString() || '' });
                      setShowEditModal(true);
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 text-xs font-medium transition-colors"
                  >
                    ✏️
                  </button>
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
                    return (
                      <option key={t.id} value={user.id}>
                        {user.firstName || ''} {user.lastName || ''} ({t.employeeNo || 'No ID'})
                      </option>
                    );
                  })}
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
    </div>
  );
}
