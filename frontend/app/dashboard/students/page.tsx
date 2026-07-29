'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi, classApi, termApi, enrollmentApi, academicYearApi, parentApi, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradRed = 'linear-gradient(135deg, #ef4444, #dc2626)';
const gradBlueLight = 'linear-gradient(135deg, #dbeafe, #bfdbfe)';
const gradGreenLight = 'linear-gradient(135deg, #d1fae5, #a7f3d0)';
const gradPurpleLight = 'linear-gradient(135deg, #f3e8ff, #e9d5ff)';
const gradOrangeLight = 'linear-gradient(135deg, #ffedd5, #fed7aa)';

export default function StudentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showLinkParentModal, setShowLinkParentModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [linkParentSearch, setLinkParentSearch] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');

  const { data: parentsData } = useQuery({
    queryKey: ['parents-search', linkParentSearch],
    queryFn: async () => {
      const res = await parentApi.getAll({ search: linkParentSearch || undefined });
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    },
    enabled: showLinkParentModal,
  });

  const linkParentMutation = useMutation({
    mutationFn: ({ parentId, studentId }: { parentId: string; studentId: string }) =>
      parentApi.linkChild(parentId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setShowLinkParentModal(false);
      setSelectedParentId('');
      setLinkParentSearch('');
      setMessage({ type: 'success', text: 'Parent linked successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to link parent.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const unlinkParentMutation = useMutation({
    mutationFn: ({ parentId, studentId }: { parentId: string; studentId: string }) =>
      parentApi.unlinkChild(parentId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setMessage({ type: 'success', text: 'Parent unlinked successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to unlink parent.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const { data: studentsData, isLoading: studentsLoading, error: studentsError } = useQuery({
    queryKey: ['students'],
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 10000,
    placeholderData: (previousData: any) => previousData,
    queryFn: async () => {
      const res = await api.get('/student');
      console.log('Students API response:', res.data);
      console.log('Response status:', res.status);
      let data = res.data?.data || res.data?.students || res.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.result) data = data.result;
        if (data.items) data = data.items;
        if (data.students) data = data.students;
        if (data.total !== undefined && Array.isArray(data.data)) data = data.data;
      }
      if (!Array.isArray(data)) {
        console.warn('Students data is not an array:', data);
        data = [];
      }
      return data;
    },
  });

  const { data: classesResponse } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.classes) data = data.classes;
      if (data?.result) data = data.result;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: termsResponse } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.terms) data = data.terms;
      if (data?.result) data = data.result;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: academicYearsResponse } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await academicYearApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.academicYears) data = data.academicYears;
      return Array.isArray(data) ? data : [];
    },
  });

  const classes = Array.isArray(classesResponse) ? classesResponse : [];
  const terms = Array.isArray(termsResponse) ? termsResponse : [];
  const academicYears = Array.isArray(academicYearsResponse) ? academicYearsResponse : [];
  const currentAcademicYear = academicYears.find((y: any) => y.isCurrent);

  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    admissionNumber: '',
    dateOfBirth: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    academicYearId: currentAcademicYear?.id || '',
    classId: '',
    manualOverride: false,
  });

  const [admissionPreview, setAdmissionPreview] = useState('');

  useEffect(() => {
    if (showAddModal && currentAcademicYear) {
      const fetchPreview = async () => {
        try {
          const res = await api.get('/student/preview-admission', {
            params: { academicYearId: currentAcademicYear.id },
          });
          setAdmissionPreview(res.data?.admissionNumber || '');
        } catch {
          setAdmissionPreview('');
        }
      };
      fetchPreview();
    }
  }, [showAddModal, currentAcademicYear]);

  const [enrollmentForm, setEnrollmentForm] = useState({
    classId: '',
    termId: '',
    academicYearId: currentAcademicYear?.id || '',
  });

  const [editForm, setEditForm] = useState<any>({
    firstName: '',
    lastName: '',
    admissionNumber: '',
    dateOfBirth: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
  });

  const createStudentMutation = useMutation({
    mutationFn: (data: any) => studentApi.create(data),
    onSuccess: (res) => {
      const createdName = `${studentForm.firstName} ${studentForm.lastName}`;
      const credentialsInfo = res?.data?.credentials
        ? ` Username: ${res.data.credentials.username || ''}`
        : '';
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setShowAddModal(false);
      setMessage({ type: 'success', text: `${createdName} registered successfully! Login credentials have been sent.${credentialsInfo}` });
      setTimeout(() => setMessage(null), 6000);
      setStudentForm({
        firstName: '',
        lastName: '',
        admissionNumber: '',
        dateOfBirth: '',
        gender: '',
        email: '',
        phone: '',
        address: '',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        academicYearId: currentAcademicYear?.id || '',
        classId: '',
        manualOverride: false,
      });
      setAdmissionPreview('');
      setFormMessage(null);
    },
    onError: (error: any) => {
      console.error('Failed to create student:', error);
      setFormMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to register student. Please try again.' });
      setTimeout(() => setFormMessage(null), 6000);
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => studentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setShowEditModal(false);
      setMessage({ type: 'success', text: 'Student updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update student.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: (id: string) => studentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setMessage({ type: 'success', text: 'Student deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to delete student.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const enrollStudentMutation = useMutation({
    mutationFn: (data: any) => enrollmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setMessage({ type: 'success', text: 'Student enrolled successfully!' });
      setTimeout(() => setMessage(null), 3000);
      setShowEnrollmentModal(false);
      setSelectedStudent(null);
      setEnrollmentForm({ classId: '', termId: '', academicYearId: '' });
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to enroll student.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), message.type === 'success' ? 3000 : 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const students = Array.isArray(studentsData) ? studentsData : [];
  const totalStudents = students.length;
  const maleStudents = students.filter((s: any) => s.gender?.toUpperCase() === 'MALE').length;
  const femaleStudents = students.filter((s: any) => s.gender?.toUpperCase() === 'FEMALE').length;

  if (studentsError) {
    console.log('Students query error:', studentsError);
  }

  const filteredStudents = students.filter((student: any) => {
    if (filterClass) console.log('Student:', student.firstName, 'Enrollments:', JSON.stringify(student.enrollments));
    const matchesSearch = searchTerm === '' ||
      student.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = filterClass === '' || student.enrollments?.some((e: any) => e.classId === filterClass && e.status?.toUpperCase() === 'ACTIVE');
    const matchesStatus = filterStatus === '' || student.status === filterStatus;
    
    return matchesSearch && matchesClass && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {message && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[320px] ${
          message.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          <span className="text-lg font-bold">{message.type === 'success' ? '✓' : '✕'}</span>
          <span className="flex-1 text-sm">{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-white/80 hover:text-white font-bold text-lg leading-none">✕</button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Students Register</h1>
          <p className="text-gray-600 mt-1">Manage student records and enrollments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Student
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-2xl font-bold text-blue-700">{totalStudents}</div>
          <div className="text-sm text-blue-600">Total Students</div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="text-2xl font-bold text-indigo-700">{maleStudents}</div>
          <div className="text-sm text-indigo-600">Male</div>
        </div>
        <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
          <div className="text-2xl font-bold text-pink-700">{femaleStudents}</div>
          <div className="text-sm text-pink-600">Female</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or admission number..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Class</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Classes</option>
              {classes?.map((cls: any) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="GRADUATED">Graduated</option>
              <option value="WITHDRAWN">Withdrawn</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DECEASED">Deceased</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Include Inactive Students</span>
            </label>
          </div>

          <div className="flex items-end">
            <div className="flex items-end gap-4">
              <div className="text-sm text-gray-600">
                Total: <span className="font-bold text-gray-900">{totalStudents}</span>
              </div>
              <div className="text-sm text-blue-600">
                Male: <span className="font-bold">{maleStudents}</span>
              </div>
              <div className="text-sm text-pink-600">
                Female: <span className="font-bold">{femaleStudents}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {studentsLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading students...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">👨‍🎓</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {studentsError ? 'Failed to Load Students' : 'No Students Found'}
            </h3>
            <p className="text-gray-500 mb-4">
              {studentsError
                ? 'A network error occurred. Your data is safe — click retry to try again.'
                : searchTerm || filterClass || filterStatus 
                  ? 'Try adjusting your filters.' 
                  : 'Add your first student to get started.'}
            </p>
            {studentsError ? (
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Retry
              </button>
            ) : !searchTerm && !filterClass && !filterStatus ? (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                + Add Student
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Admission #</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Gender</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Date of Birth</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student: any, index: number) => (
                  <tr key={student.id || index} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{student.admissionNumber || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          {(student.firstName?.[0] || '?')}{(student.lastName?.[0] || '?')}
                        </div>
                        <div className="font-medium text-gray-900">{student.firstName} {student.lastName}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        student.gender === 'Male' ? 'bg-blue-100 text-blue-700' :
                        student.gender === 'Female' ? 'bg-pink-100 text-pink-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {student.gender || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900">{student.email || '-'}</div>
                        <div className="text-gray-500">{student.phone || '-'}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        student.status === 'ACTIVE' ? 'bg-green-100 text-green-700 border-green-200' :
                        student.status === 'INACTIVE' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                        student.status === 'TRANSFERRED' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        student.status === 'GRADUATED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        student.status === 'WITHDRAWN' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        student.status === 'SUSPENDED' ? 'bg-red-100 text-red-700 border-red-200' :
                        student.status === 'DECEASED' ? 'bg-gray-200 text-gray-800 border-gray-300' :
                        'bg-red-100 text-red-700 border-red-200'
                      }`}>
                        {student.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedStudent(student); setShowViewModal(true); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          👁️ View
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setEditForm({
                              firstName: student.firstName || '',
                              lastName: student.lastName || '',
                              admissionNumber: student.admissionNumber || '',
                              dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
                              gender: student.gender || '',
                              email: student.email || '',
                              phone: student.phone || '',
                              address: student.address || '',
                              parentName: student.parentName || '',
                              parentPhone: student.parentPhone || '',
                              parentEmail: student.parentEmail || '',
                            });
                            setShowEditModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowEnrollmentModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                        >
                          📚 Enroll
                        </button>
                        <button
                          onClick={() => { setSelectedStudent(student); setShowLinkParentModal(true); setSelectedParentId(''); setLinkParentSearch(''); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors"
                        >
                          👪 Parent
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${student.firstName} ${student.lastName}?`)) {
                              deleteStudentMutation.mutate(student.id);
                            }
                          }}
                          disabled={deleteStudentMutation.isPending}
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
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Add New Student</h2>

            {formMessage && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                formMessage.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {formMessage.text}
              </div>
            )}
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={studentForm.firstName}
                    onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={studentForm.lastName}
                    onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admission Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={studentForm.manualOverride ? studentForm.admissionNumber : admissionPreview}
                      onChange={(e) => setStudentForm({ ...studentForm, admissionNumber: e.target.value })}
                      readOnly={!studentForm.manualOverride}
                      className={`w-full px-3 py-2 border rounded-lg font-mono ${
                        studentForm.manualOverride ? 'bg-white' : 'bg-gray-50'
                      }`}
                      placeholder={admissionPreview || 'Auto-generated'}
                    />
                    {(user?.roles?.includes('Director') || user?.roles?.includes('SuperAdmin')) && (
                      <button
                        type="button"
                        onClick={() => setStudentForm({ ...studentForm, manualOverride: !studentForm.manualOverride, admissionNumber: '' })}
                        className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border ${
                          studentForm.manualOverride
                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                            : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {studentForm.manualOverride ? 'Auto' : 'Override'}
                      </button>
                    )}
                  </div>
                  {!studentForm.manualOverride && admissionPreview && (
                    <p className="text-xs text-green-600 mt-1">
                      Auto-generated: {admissionPreview}
                    </p>
                  )}
                  {studentForm.manualOverride && (
                    <p className="text-xs text-amber-600 mt-1">
                      Manual override: enter a unique admission number
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={studentForm.dateOfBirth}
                    onChange={(e) => setStudentForm({ ...studentForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    value={studentForm.address}
                    onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Enrollment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Academic Year
                    </label>
                    <select
                      value={studentForm.academicYearId}
                      onChange={(e) => setStudentForm({ ...studentForm, academicYearId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {academicYears.map((year: any) => (
                        <option key={year.id} value={year.id}>
                          {year.name} {year.isCurrent ? '(Current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Class
                    </label>
                    <select
                      value={studentForm.classId}
                      onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select Class (Optional)</option>
                      {(classes || []).map((cls: any) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Parent/Guardian Information <span className="text-sm font-normal text-gray-400">(optional &mdash; can be added later)</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent/Guardian Name
                    </label>
                    <input
                      type="text"
                      value={studentForm.parentName}
                      onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent Phone
                    </label>
                    <input
                      type="tel"
                      value={studentForm.parentPhone}
                      onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent Email
                    </label>
                    <input
                      type="email"
                      value={studentForm.parentEmail}
                      onChange={(e) => setStudentForm({ ...studentForm, parentEmail: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createStudentMutation.mutate(studentForm)}
                  disabled={!studentForm.firstName || !studentForm.lastName || (studentForm.manualOverride && !studentForm.admissionNumber)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {createStudentMutation.isPending ? 'Creating...' : 'Create Student'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEnrollmentModal && selectedStudent && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">
              Enroll Student: {selectedStudent.firstName} {selectedStudent.lastName}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Academic Year *
                </label>
                <select
                  value={enrollmentForm.academicYearId}
                  onChange={(e) => setEnrollmentForm({ ...enrollmentForm, academicYearId: e.target.value, termId: '' })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((year: any) => (
                    <option key={year.id} value={year.id}>
                      {year.name} {year.isCurrent ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Class *
                </label>
                <select
                  value={enrollmentForm.classId}
                  onChange={(e) => setEnrollmentForm({ ...enrollmentForm, classId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Class</option>
                  {(classes || []).map((cls: any) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Term
                </label>
                <select
                  value={enrollmentForm.termId}
                  onChange={(e) => setEnrollmentForm({ ...enrollmentForm, termId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Term (Optional)</option>
                  {terms
                    .filter((term: any) => term.academicYearId === enrollmentForm.academicYearId)
                    .map((term: any) => (
                      <option key={term.id} value={term.id}>{term.name}</option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => {
                    setShowEnrollmentModal(false);
                    setSelectedStudent(null);
                    setEnrollmentForm({ classId: '', termId: '', academicYearId: '' });
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!enrollmentForm.classId || !enrollmentForm.academicYearId) {
                      setMessage({ type: 'error', text: 'Please select a class and academic year' });
                      return;
                    }
                    enrollStudentMutation.mutate({
                      studentId: selectedStudent.id,
                      classId: enrollmentForm.classId,
                      academicYearId: enrollmentForm.academicYearId,
                      termId: enrollmentForm.termId || undefined,
                    });
                  }}
                  disabled={!enrollmentForm.classId || !enrollmentForm.academicYearId || enrollStudentMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {enrollStudentMutation.isPending ? 'Enrolling...' : 'Enroll Student'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedStudent && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold">
                Student Details
              </h2>
              <button
                onClick={() => { setShowViewModal(false); setSelectedStudent(null); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">First Name</label>
                  <p className="mt-1 font-medium">{selectedStudent.firstName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Last Name</label>
                  <p className="mt-1 font-medium">{selectedStudent.lastName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Admission Number</label>
                  <p className="mt-1 font-medium font-mono">{selectedStudent.admissionNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Gender</label>
                  <p className="mt-1 font-medium">{selectedStudent.gender || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Date of Birth</label>
                  <p className="mt-1 font-medium">
                    {selectedStudent.dateOfBirth ? new Date(selectedStudent.dateOfBirth).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1 font-medium">{selectedStudent.email || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Phone</label>
                  <p className="mt-1 font-medium">{selectedStudent.phone || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500">Address</label>
                  <p className="mt-1 font-medium">{selectedStudent.address || '-'}</p>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-3">Parent/Guardian Information</h3>
                {selectedStudent.parents?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedStudent.parents.map((sp: any) => (
                      <div key={sp.parentId} className="bg-pink-50 p-3 rounded-lg">
                        <p className="font-medium">{sp.parent?.firstName} {sp.parent?.lastName}</p>
                        <p className="text-sm text-gray-600">{sp.parent?.email}</p>
                        {sp.parent?.phone && <p className="text-sm text-gray-500">{sp.parent?.phone}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Name</label>
                      <p className="mt-1 font-medium">{selectedStudent.parentName || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Phone</label>
                      <p className="mt-1 font-medium">{selectedStudent.parentPhone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Email</label>
                      <p className="mt-1 font-medium">{selectedStudent.parentEmail || '-'}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedStudent.enrollments && selectedStudent.enrollments.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold mb-3">Enrollments</h3>
                  <div className="space-y-2">
                    {selectedStudent.enrollments.map((enrollment: any) => (
                      <div key={enrollment.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">{enrollment.class?.name}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            enrollment.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {enrollment.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{enrollment.academicYear?.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedStudent(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLinkParentModal && selectedStudent && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">Link Parent</h2>
                <p className="text-gray-600 text-sm mt-1">{selectedStudent.firstName} {selectedStudent.lastName}</p>
              </div>
              <button onClick={() => { setShowLinkParentModal(false); setSelectedParentId(''); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-4">
              {(selectedStudent as any).parents?.length > 0 && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <h4 className="font-semibold text-pink-800 mb-2">Currently Linked Parents</h4>
                  <div className="space-y-2">
                    {(selectedStudent as any).parents.map((sp: any) => (
                      <div key={sp.parentId} className="flex items-center justify-between bg-white p-2 rounded">
                        <span className="text-sm">{sp.parent?.firstName} {sp.parent?.lastName} ({sp.parent?.email})</span>
                        <button
                          onClick={() => { if (confirm('Unlink this parent?')) { unlinkParentMutation.mutate({ parentId: sp.parentId, studentId: selectedStudent.id }); } }}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Parent</label>
                <input
                  type="text"
                  value={linkParentSearch}
                  onChange={(e) => setLinkParentSearch(e.target.value)}
                  placeholder="Type parent name, email, or phone..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {(parentsData?.length ?? 0) > 0 ? (parentsData ?? [])
                  .filter((p: any) => !(selectedStudent as any).parents?.some((sp: any) => sp.parentId === p.id))
                  .map((parent: any) => (
                    <div
                      key={parent.id}
                      onClick={() => setSelectedParentId(parent.id)}
                      className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center gap-3 ${
                        selectedParentId === parent.id ? 'bg-pink-50 border-l-4 border-pink-500' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold text-xs">
                        {parent.firstName?.[0]}{parent.lastName?.[0]}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{parent.firstName} {parent.lastName}</div>
                        <div className="text-xs text-gray-500">{parent.email} {parent.phone && `• ${parent.phone}`}</div>
                      </div>
                      {selectedParentId === parent.id && <span className="text-pink-600 text-sm font-medium">Selected</span>}
                    </div>
                  )) : linkParentSearch ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    <p>No parents found matching "{linkParentSearch}"</p>
                    <p className="mt-1">Go to <a href="/dashboard/parents" className="text-pink-600 underline">Parents Management</a> to register a new parent.</p>
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    <p>Type a name, email, or phone to search for a parent.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-6">
              <button onClick={() => { setShowLinkParentModal(false); setSelectedParentId(''); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => {
                  if (!selectedParentId) { setMessage({ type: 'error', text: 'Select a parent' }); return; }
                  linkParentMutation.mutate({ parentId: selectedParentId, studentId: selectedStudent.id });
                }}
                disabled={!selectedParentId || linkParentMutation.isPending}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-400"
              >
                {linkParentMutation.isPending ? 'Linking...' : 'Link Parent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedStudent && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              Edit Student: {selectedStudent.firstName} {selectedStudent.lastName}
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admission Number *
                  </label>
                  <input
                    type="text"
                    value={editForm.admissionNumber}
                    onChange={(e) => setEditForm({ ...editForm, admissionNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Parent/Guardian Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent/Guardian Name
                    </label>
                    <input
                      type="text"
                      value={editForm.parentName}
                      onChange={(e) => setEditForm({ ...editForm, parentName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent Phone
                    </label>
                    <input
                      type="tel"
                      value={editForm.parentPhone}
                      onChange={(e) => setEditForm({ ...editForm, parentPhone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent Email
                    </label>
                    <input
                      type="email"
                      value={editForm.parentEmail}
                      onChange={(e) => setEditForm({ ...editForm, parentEmail: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStudent(null);
                    setEditForm({
                      firstName: '',
                      lastName: '',
                      admissionNumber: '',
                      dateOfBirth: '',
                      gender: '',
                      email: '',
                      phone: '',
                      address: '',
                      parentName: '',
                      parentPhone: '',
                      parentEmail: '',
                    });
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                            const cleanData = {
                              firstName: editForm.firstName,
                              lastName: editForm.lastName,
                              admissionNumber: editForm.admissionNumber,
                              dateOfBirth: editForm.dateOfBirth,
                              gender: editForm.gender,
                            };
                            updateStudentMutation.mutate({ id: selectedStudent.id, data: cleanData });
                          }}
                  disabled={!editForm.firstName || !editForm.lastName || !editForm.admissionNumber || updateStudentMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {updateStudentMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
