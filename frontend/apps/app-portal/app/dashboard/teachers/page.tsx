'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teacherApi, api, teachingAssignmentApi, classApi, subjectApi, academicYearApi, roleApi, enrollmentApi, schoolMembershipApi, classTeacherAssignmentApi, classSubjectApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permission-context';

export default function TeachersPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const isPrimary = user?.institutionType === 'PRIMARY_SCHOOL';
  const canManageStaff = can('staff.manage');
  const canViewStaff = can('staff.view');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [selectedTeacherForAssignment, setSelectedTeacherForAssignment] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStaffType, setFilterStaffType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({ classId: '', subjectId: '', academicYearId: '' });
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [showClassTeacherModal, setShowClassTeacherModal] = useState(false);
  const [classTeacherForm, setClassTeacherForm] = useState({ teacherId: '', classId: '', academicYearId: '', isPrimary: true });

  const { data: teachersData, isLoading: teachersLoading, error: teachersError } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      try {
        const res = await api.get('/teacher');
        console.log('Teachers API response:', res.data);
        let data = res.data;
        // Handle the nested data structure
        if (data?.data !== undefined && Array.isArray(data.data)) {
          data = data.data;
        } else if (data?.data !== undefined && data?.data?.data !== undefined && Array.isArray(data.data.data)) {
          data = data.data.data;
        } else if (data?.teachers !== undefined) {
          data = data.teachers;
        } else if (data?.result !== undefined && Array.isArray(data.result)) {
          data = data.result;
        } else if (data?.items !== undefined && Array.isArray(data.items)) {
          data = data.items;
        }
        
        if (!Array.isArray(data)) {
          console.warn('Teachers data is not an array:', data);
          data = [];
        }
        console.log('Processed teachers data:', data);
        return data;
      } catch (error: any) {
        console.error('Failed to fetch teachers:', error);
        console.error('Error response:', error.response?.data);
        if (error.response?.status === 403) {
          setMessage({ type: 'error', text: 'Access denied. You need Director role.' });
        } else if (error.response?.status === 401) {
          setMessage({ type: 'error', text: 'Please log in again.' });
        }
        return [];
      }
    },
  });

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['teaching-assignments'],
    queryFn: () => teachingAssignmentApi.getAll().then(res => {
      let data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    }),
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(res => {
      let data = res.data?.data || res.data?.classes || res.data || [];
      return Array.isArray(data) ? data : [];
    }),
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      try {
        const res = await subjectApi.getAll();
        let data = res.data?.data || res.data || [];
        return Array.isArray(data) ? data : [];
      } catch (error: any) {
        console.error('Failed to fetch subjects:', error);
        console.error('Subjects error response:', error.response?.data);
        return [];
      }
    },
  });

  const { data: classSubjectsData, isLoading: classSubjectsLoading } = useQuery({
    queryKey: ['class-subjects-for-assignment', assignmentForm.classId],
    queryFn: async () => {
      if (!assignmentForm.classId) return [];
      try {
        const res = await classSubjectApi.getByClass(assignmentForm.classId);
        let data = res.data?.data || res.data || [];
        return Array.isArray(data) ? data : [];
      } catch (error: any) {
        console.error('Failed to fetch class subjects:', error);
        return [];
      }
    },
    enabled: !!assignmentForm.classId,
  });

  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicYearApi.getAll().then(res => {
      let data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    }),
  });

  const { data: classTeacherAssignments, isLoading: ctaLoading } = useQuery({
    queryKey: ['class-teacher-assignments'],
    queryFn: async () => {
      try {
        const res = await classTeacherAssignmentApi.findBySchool();
        let data = res.data?.data || res.data || [];
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  // Fetch teaching staff from school-membership (includes Directors, SuperAdmins with teaching assignments)
  const { data: membershipTeachingStaff } = useQuery({
    queryKey: ['membership-teaching-staff'],
    queryFn: async () => {
      try {
        const res = await schoolMembershipApi.getTeachingStaff();
        let data = res.data?.data || res.data || [];
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  const teachers = Array.isArray(teachersData) ? teachersData : [];
  const totalTeachers = teachers.length;
  const maleTeachers = teachers.filter((t: any) => t.gender?.toUpperCase() === 'MALE').length;
  const femaleTeachers = teachers.filter((t: any) => t.gender?.toUpperCase() === 'FEMALE').length;

  const filteredTeachers = teachers.filter((teacher: any) => {
    const teacherUser = teacher.user || {};
    const matchesSearch = searchTerm === '' ||
      teacherUser.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacherUser.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.employeeNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacherUser.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = filterDepartment === '' || teacher.department === filterDepartment;
    const matchesStaffType = filterStaffType === '' || teacher.staffType === filterStaffType;
    const matchesStatus = filterStatus === '' || teacher.status === filterStatus;
    
    return matchesSearch && matchesDepartment && matchesStaffType && matchesStatus;
  });

  const departments = [...new Set(teachers.map((t: any) => t.department).filter(Boolean))] as string[];

  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    department: '',
    staffType: 'TEACHING',
    qualification: '',
    specialization: '',
    yearsOfExperience: '',
    employeeId: '',
    hireDate: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    role: '',
    classAssignment: '',
  });

  useEffect(() => {
    if (isPrimary && !teacherForm.role) {
      setTeacherForm(prev => ({ ...prev, role: 'Class Teacher' }));
    }
  }, [isPrimary]);

  const DEPARTMENTS = [
    // Primary School Departments
    'ECE (Early Childhood Education)',
    'Lower Primary (Grade 1-4)',
    'Upper Primary (Grade 5-7)',
    'Primary Special Education',
    'Primary Literacy & Numeracy',
    // Secondary School Departments
    'Mathematics',
    'Sciences (Natural Science)',
    'Languages (English Language)',
    'Social Science',
    'Computer Science',
    'Technical and Practical Subjects',
    'Business Studies',
    'Vocational/Technical Training',
    // Non-Teaching / Admin Departments
    'Administration',
    'Finance & Accounts',
    'Student Affairs',
    'Guidance & Counseling',
    'Library & Resource Center',
    'ICT & E-Learning',
    'Sports & Recreation',
    'Transport & Logistics',
  ];

  const STAFF_TYPES = [
    { value: 'TEACHING', label: 'Teaching Staff', icon: '👨‍🏫' },
    { value: 'NON_TEACHING', label: 'Non-Teaching Staff', icon: '👔' },
  ];

  const AVAILABLE_ROLES_FOR_STAFF = isPrimary ? [
    { name: 'Class Teacher', icon: '🏫' },
    { name: 'Head Teacher', icon: '🎓' },
    { name: 'Senior Teacher', icon: '🌟' },
    { name: 'Lower Primary Senior Teacher', icon: '📗' },
    { name: 'Upper Primary Senior Teacher', icon: '📘' },
    { name: 'Teacher', icon: '👨‍🏫' },
    { name: 'Deputy', icon: '⭐' },
    { name: 'Accountant', icon: '💰' },
    { name: 'Secretary', icon: '📋' },
  ] : [
    { name: 'Teacher', icon: '👨‍🏫' },
    { name: 'Class Teacher', icon: '🏫' },
    { name: 'Head Teacher', icon: '🎓' },
    { name: 'Deputy', icon: '⭐' },
    { name: 'Accountant', icon: '💰' },
    { name: 'Secretary', icon: '📋' },
  ];

  const createTeacherMutation = useMutation({
    mutationFn: async (data: any) => {
      const teacher = await teacherApi.create(data);
      if (data.role) {
        try {
          const newUserId = teacher.data?.data?.userId || teacher.data?.data?.id;
          if (newUserId) {
            await roleApi.assignRole(newUserId, data.role);
            if (data.role === 'Class Teacher' && data.classAssignment) {
              await classApi.setClassTeacher(data.classAssignment, newUserId);
            }
          }
        } catch (roleError) {
          console.error('Failed to assign role:', roleError);
        }
      }
      return teacher;
    },
    onSuccess: (response) => {
      const newTeacher = response?.data?.data;
      if (newTeacher?.id) {
        queryClient.setQueryData<any[]>(['teachers'], (old) => [newTeacher, ...(old || [])]);
      }
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      queryClient.invalidateQueries({ queryKey: ['school-users'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setShowAddModal(false);
      setMessage({ type: 'success', text: 'Teacher added with role assigned!' });
      setTimeout(() => setMessage(null), 3000);
      setTeacherForm({
        firstName: '', lastName: '', email: '', phone: '', gender: '',
        dateOfBirth: '', department: '', staffType: 'TEACHING', qualification: '', specialization: '',
        yearsOfExperience: '', employeeId: '', hireDate: '', address: '',
        emergencyContact: '', emergencyPhone: '', role: 'Teacher', classAssignment: '',
      });
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to add teacher.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: (id: string) => teacherApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['teachers'] });
      const previousTeachers = queryClient.getQueryData<any[]>(['teachers']);
      queryClient.setQueryData<any[]>(['teachers'], (old) =>
        (old || []).filter((t: any) => t.id !== id)
      );
      return { previousTeachers };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setMessage({ type: 'success', text: 'Teacher deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any, _id, context) => {
      if (context?.previousTeachers) {
        queryClient.setQueryData(['teachers'], context.previousTeachers);
      }
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to delete teacher.' });
      setTimeout(() => setMessage(null), 5000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });

  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', gender: '',
    dateOfBirth: '', department: '', staffType: 'TEACHING', qualification: '', specialization: '',
    yearsOfExperience: '', employeeId: '', hireDate: '', address: '',
    emergencyContact: '', emergencyPhone: '',
  });

  const updateTeacherMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => teacherApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['teachers'] });
      const previousTeachers = queryClient.getQueryData<any[]>(['teachers']);
      queryClient.setQueryData<any[]>(['teachers'], (old) =>
        (old || []).map((t: any) => {
          if (t.id !== id) return t;
          const updatedUser = data.user ? { ...t.user, ...data.user } : t.user;
          return { ...t, ...data, user: updatedUser, id: t.id, userId: t.userId, schoolId: t.schoolId };
        })
      );
      return { previousTeachers };
    },
    onSuccess: (response) => {
      const updated = response?.data?.data || response?.data;
      if (updated?.id) {
        queryClient.setQueryData<any[]>(['teachers'], (old) =>
          (old || []).map((t: any) => t.id === updated.id ? { ...t, ...updated } : t)
        );
      }
      setShowEditModal(false);
      setSelectedTeacher(null);
      setMessage({ type: 'success', text: 'Teacher updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousTeachers) {
        queryClient.setQueryData(['teachers'], context.previousTeachers);
      }
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update teacher.' });
      setTimeout(() => setMessage(null), 5000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isPrimary) {
        const teacherRecordId = selectedTeacherForAssignment?.id || data.teacherId;
        await classApi.setClassTeacher(data.classId, teacherRecordId);
        return { success: true };
      }
      // If editing, delete old assignment first
      if (editingAssignment?.id) {
        await teachingAssignmentApi.delete(editingAssignment.id);
      }
      return teachingAssignmentApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teaching-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setShowAssignmentModal(false);
      setSelectedTeacherForAssignment(null);
      setAssignmentForm({ classId: '', subjectId: '', academicYearId: '' });
      setEditingAssignment(null);
      setMessage({ type: 'success', text: editingAssignment ? 'Assignment updated successfully!' : 'Assignment created successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to save assignment.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id: string) => teachingAssignmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teaching-assignments'] });
      setMessage({ type: 'success', text: 'Assignment deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to delete assignment.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const createClassTeacherMutation = useMutation({
    mutationFn: async (data: { teacherId: string; classId: string; academicYearId: string; isPrimary?: boolean }) => {
      return classTeacherAssignmentApi.assign(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-teacher-assignments'] });
      setShowClassTeacherModal(false);
      setClassTeacherForm({ teacherId: '', classId: '', academicYearId: '', isPrimary: true });
      setMessage({ type: 'success', text: 'Class teacher assigned successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to assign class teacher.' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const removeClassTeacherMutation = useMutation({
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
          <h1 className="text-3xl font-bold text-gray-900">Staff Register</h1>
          <p className="text-gray-600 mt-1">Manage teacher profiles and staff information</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/dashboard/users"
            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
          >
            Manage Roles
          </a>
          {canManageStaff && (
          <>
          <button
            onClick={() => setShowAssignmentModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + {isPrimary ? 'Assign Classes' : 'Assign Subjects'}
          </button>
          <button
            onClick={() => setShowClassTeacherModal(true)}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            + Assign Class Teacher
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Add Teacher
          </button>
          </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-2xl font-bold text-blue-700">{totalTeachers}</div>
          <div className="text-sm text-blue-600">Total Staff</div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="text-2xl font-bold text-indigo-700">{maleTeachers}</div>
          <div className="text-sm text-indigo-600">Male</div>
        </div>
        <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
          <div className="text-2xl font-bold text-pink-700">{femaleTeachers}</div>
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
              placeholder="Search by name, employee ID, or email..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Departments</option>
              {departments.map((dept: string) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Staff Type</label>
            <select
              value={filterStaffType}
              onChange={(e) => setFilterStaffType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Staff</option>
              {STAFF_TYPES.map(st => (
                <option key={st.value} value={st.value}>{st.icon} {st.label}</option>
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
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>
          <div className="flex items-end gap-4">
            <div className="text-sm text-gray-600">
              Total: <span className="font-bold text-gray-900">{totalTeachers}</span>
            </div>
            <div className="text-sm text-blue-600">
              Male: <span className="font-bold">{maleTeachers}</span>
            </div>
            <div className="text-sm text-pink-600">
              Female: <span className="font-bold">{femaleTeachers}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {teachersLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading staff...</p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">👨‍🏫</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Staff Members Found</h3>
            <p className="text-gray-500 mb-4">Add your first teacher to get started.</p>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              + Add Teacher
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee ID</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Staff Type</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Qualification</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Experience</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTeachers.map((teacher: any, index: number) => {
                  const teacherUser = teacher.user || {};
                  return (
                  <tr key={teacher.id || index} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{teacher.employeeNo || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-sm">
                          {(teacherUser.firstName?.[0] || '?')}{(teacherUser.lastName?.[0] || '?')}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{teacherUser.firstName || '-'} {teacherUser.lastName || '-'}</div>
                          <div className="text-xs text-gray-500">{teacher.gender || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">{teacher.department || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      {teacher.staffType === 'NON_TEACHING' ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">👔 Non-Teaching</span>
                      ) : (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">👨‍🏫 Teaching</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900">{teacher.qualification || '-'}</div>
                        {teacher.specialization && <div className="text-gray-500 text-xs">{teacher.specialization}</div>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900">{teacherUser.email || '-'}</div>
                        <div className="text-gray-500">{teacherUser.phone || '-'}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm">{teacher.yearsOfExperience ? `${teacher.yearsOfExperience} years` : '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setSelectedTeacher(teacher); setShowProfileModal(true); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                          👁️ View
                        </button>
                        {canManageStaff && (
                        <>
                        <button onClick={() => {
                          setSelectedTeacher(teacher);
                          setEditForm({
                            firstName: teacherUser.firstName || '', lastName: teacherUser.lastName || '',
                            email: teacherUser.email || '', phone: teacherUser.phone || '',
                            gender: teacher.gender || '', dateOfBirth: teacher.dateOfBirth ? teacher.dateOfBirth.split('T')[0] : '',
                            department: teacher.department || '', staffType: teacher.staffType || 'TEACHING', qualification: teacher.qualification || '',
                            specialization: teacher.specialization || '', yearsOfExperience: teacher.yearsOfExperience || '',
                            employeeId: teacher.employeeNo || '', hireDate: teacher.hireDate ? teacher.hireDate.split('T')[0] : '',
                            address: teacher.address || '', emergencyContact: teacher.emergencyContact || '',
                            emergencyPhone: teacher.emergencyPhone || '',
                          });
                          setShowEditModal(true);
                        }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
                          ✏️ Edit
                        </button>
                        <button onClick={() => { if (confirm(`Delete ${teacherUser.firstName} ${teacherUser.lastName}?`)) { deleteTeacherMutation.mutate(teacher.id); } }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          🗑️ Delete
                        </button>
                        </>
                        )}
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

<div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-green-50 to-teal-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📋</span> Teaching Assignments
              </h2>
              <p className="text-sm text-gray-500">{assignmentsData?.length || 0} assignments</p>
            </div>
            <button
              onClick={() => setShowAssignmentModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl hover:from-green-600 hover:to-teal-700 transition-all shadow-sm text-sm font-medium flex items-center gap-2"
            >
              <span className="text-lg">+</span> {isPrimary ? 'Assign Classes' : 'Assign Subjects'}
            </button>
          </div>
        </div>
        
        {assignmentsLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading assignments...</p>
          </div>
        ) : !assignmentsData || assignmentsData.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Teaching Assignments</h3>
            <p className="text-gray-500 mb-4">Click "{isPrimary ? 'Assign Classes' : 'Assign Subjects'}" to create one.</p>
            <button onClick={() => setShowAssignmentModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              + {isPrimary ? 'Assign Classes' : 'Assign Subjects'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Teacher</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Class</th>
                  {!isPrimary && <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Subject</th>}
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Academic Year</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignmentsData.map((assignment: any, index: number) => {
                  const colors = [
                    { bg: 'bg-blue-100', text: 'text-blue-700' },
                    { bg: 'bg-green-100', text: 'text-green-700' },
                    { bg: 'bg-purple-100', text: 'text-purple-700' },
                    { bg: 'bg-pink-100', text: 'text-pink-700' },
                    { bg: 'bg-indigo-100', text: 'text-indigo-700' },
                  ];
                  const colorSet = colors[index % colors.length];
                  
                  return (
                  <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-sm ${colorSet.bg.replace('bg-', 'opacity-0 ')}`}>
                          {assignment.teacher?.firstName?.[0] || '?'}{assignment.teacher?.lastName?.[0] || '?'}
                        </div>
                        <span className="font-medium text-gray-900">
                          {assignment.teacher?.firstName || '-'} {assignment.teacher?.lastName || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorSet.bg} ${colorSet.text}`}>
                        {assignment.class?.name || '-'}
                      </span>
                    </td>
                    {!isPrimary && (
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-900">{assignment.subject?.name || '-'}</span>
                    </td>
                    )}
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-500">{assignment.academicYear?.name || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingAssignment(assignment);
                            setSelectedTeacherForAssignment(teachers.find((t: any) => (t.user?.id || t.userId || t.id) === assignment.teacherId) || null);
                            setAssignmentForm({
                              classId: assignment.classId || assignment.class?.id || '',
                              subjectId: assignment.subjectId || assignment.subject?.id || '',
                              academicYearId: assignment.academicYearId || assignment.academicYear?.id || '',
                            });
                            setShowAssignmentModal(true);
                          }} 
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          onClick={() => { if (confirm('Delete this assignment?')) { deleteAssignmentMutation.mutate(assignment.id); } }} 
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
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
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Add New Teacher</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input type="text" value={teacherForm.firstName} onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input type="text" value={teacherForm.lastName} onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID *</label>
                <input type="text" value={teacherForm.employeeId} onChange={(e) => setTeacherForm({ ...teacherForm, employeeId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input type="tel" value={teacherForm.phone} onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select value={teacherForm.gender} onChange={(e) => setTeacherForm({ ...teacherForm, gender: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hire Date</label>
                <input type="date" value={teacherForm.hireDate} onChange={(e) => setTeacherForm({ ...teacherForm, hireDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Staff Type *</label>
                <select value={teacherForm.staffType} onChange={(e) => setTeacherForm({ ...teacherForm, staffType: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                  {STAFF_TYPES.map(st => (
                    <option key={st.value} value={st.value}>{st.icon} {st.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                <select value={teacherForm.department} onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">Select Department</option>
                  <optgroup label="📚 Primary School">
                    {DEPARTMENTS.filter(d => d.includes('Primary') || d.includes('ECE') || d.includes('Literacy')).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📖 Secondary School">
                    {DEPARTMENTS.filter(d => !d.includes('Primary') && !d.includes('ECE') && !d.includes('Literacy') && !d.includes('Administration') && !d.includes('Finance') && !d.includes('Student Affairs') && !d.includes('Guidance') && !d.includes('Library') && !d.includes('ICT') && !d.includes('Sports') && !d.includes('Transport')).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🏢 Administration & Support">
                    {DEPARTMENTS.filter(d => d.includes('Administration') || d.includes('Finance') || d.includes('Student Affairs') || d.includes('Guidance') || d.includes('Library') || d.includes('ICT') || d.includes('Sports') || d.includes('Transport')).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
                <input type="number" value={teacherForm.yearsOfExperience} onChange={(e) => setTeacherForm({ ...teacherForm, yearsOfExperience: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Qualification *</label>
                <input type="text" value={teacherForm.qualification} onChange={(e) => setTeacherForm({ ...teacherForm, qualification: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., B.Ed, M.Sc" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
                <input type="text" value={teacherForm.specialization} onChange={(e) => setTeacherForm({ ...teacherForm, specialization: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Role *</label>
                <select value={teacherForm.role} onChange={(e) => setTeacherForm({ ...teacherForm, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">Select Role</option>
                  {AVAILABLE_ROLES_FOR_STAFF.map(r => (
                    <option key={r.name} value={r.name}>{r.icon} {r.name}</option>
                  ))}
                </select>
              </div>

              {teacherForm.role === 'Class Teacher' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Class *</label>
                  <select value={teacherForm.classAssignment} onChange={(e) => setTeacherForm({ ...teacherForm, classAssignment: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                    <option value="">Select Class</option>
                    {classesData?.map((cls: any) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                  {teacherForm.classAssignment && (
                    <p className="text-xs text-green-600 mt-1">✓ This teacher will be set as class teacher of the selected class</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => {
                if (!teacherForm.firstName || !teacherForm.lastName || !teacherForm.email || !teacherForm.department) {
                  alert('Please fill in all required fields');
                  return;
                }
                createTeacherMutation.mutate(teacherForm);
              }} disabled={createTeacherMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                {createTeacherMutation.isPending ? 'Creating...' : 'Add Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {classTeacherAssignments && classTeacherAssignments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-teal-50 to-emerald-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              🏫 Class Teacher Assignments
              <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs">{classTeacherAssignments.length}</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Academic Year</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Since</th>
                  {canManageStaff && <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {classTeacherAssignments.map((cta: any) => (
                  <tr key={cta.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-900">{cta.teacher?.firstName} {cta.teacher?.lastName}</div>
                      <div className="text-sm text-gray-500">{cta.teacher?.email}</div>
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900">{cta.class?.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{cta.academicYear?.name}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cta.isPrimary ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>
                        {cta.isPrimary ? '⭐ Primary' : '👤 Secondary'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{cta.startDate ? new Date(cta.startDate).toLocaleDateString() : '—'}</td>
                    {canManageStaff && (
                      <td className="px-6 py-3">
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${cta.teacher?.firstName} as class teacher for ${cta.class?.name}?`)) {
                              removeClassTeacherMutation.mutate(cta.id);
                            }
                          }}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showProfileModal && selectedTeacher && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold">Teacher Profile</h2>
              <button onClick={() => { setShowProfileModal(false); setSelectedTeacher(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-blue-600">
                {selectedTeacher.user?.firstName?.[0]}{selectedTeacher.user?.lastName?.[0]}
              </div>
              <div>
                <h3 className="text-xl font-bold">{selectedTeacher.user?.firstName || '-'} {selectedTeacher.user?.lastName || '-'}</h3>
                <p className="text-gray-600">Employee ID: {selectedTeacher.employeeNo || '-'}</p>
                <p className="text-gray-600">{selectedTeacher.department || '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 text-gray-900">Personal Information</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-600">Gender:</span> {selectedTeacher.gender || '-'}</div>
                  <div><span className="text-gray-600">Email:</span> {selectedTeacher.user?.email || '-'}</div>
                  <div><span className="text-gray-600">Phone:</span> {selectedTeacher.user?.phone || '-'}</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3 text-gray-900">Professional Information</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-600">Staff Type:</span> {selectedTeacher.staffType === 'NON_TEACHING' ? '👔 Non-Teaching' : '👨‍🏫 Teaching'}</div>
                  <div><span className="text-gray-600">Department:</span> {selectedTeacher.department || '-'}</div>
                  <div><span className="text-gray-600">Qualification:</span> {selectedTeacher.qualification || '-'}</div>
                  <div><span className="text-gray-600">Specialization:</span> {selectedTeacher.specialization || '-'}</div>
                  <div><span className="text-gray-600">Experience:</span> {selectedTeacher.yearsOfExperience ? `${selectedTeacher.yearsOfExperience} years` : '-'}</div>
                  <div><span className="text-gray-600">Hire Date:</span> {selectedTeacher.hireDate ? new Date(selectedTeacher.hireDate).toLocaleDateString() : '-'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedTeacher && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Edit Teacher: {selectedTeacher.user?.firstName} {selectedTeacher.user?.lastName}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input type="text" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input type="text" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                <input type="text" value={editForm.employeeId} onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hire Date</label>
                <input type="date" value={editForm.hireDate} onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Staff Type</label>
                <select value={editForm.staffType} onChange={(e) => setEditForm({ ...editForm, staffType: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  {STAFF_TYPES.map(st => (
                    <option key={st.value} value={st.value}>{st.icon} {st.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Select Department</option>
                  <optgroup label="📚 Primary School">
                    {DEPARTMENTS.filter(d => d.includes('Primary') || d.includes('ECE') || d.includes('Literacy')).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📖 Secondary School">
                    {DEPARTMENTS.filter(d => !d.includes('Primary') && !d.includes('ECE') && !d.includes('Literacy') && !d.includes('Administration') && !d.includes('Finance') && !d.includes('Student Affairs') && !d.includes('Guidance') && !d.includes('Library') && !d.includes('ICT') && !d.includes('Sports') && !d.includes('Transport')).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🏢 Administration & Support">
                    {DEPARTMENTS.filter(d => d.includes('Administration') || d.includes('Finance') || d.includes('Student Affairs') || d.includes('Guidance') || d.includes('Library') || d.includes('ICT') || d.includes('Sports') || d.includes('Transport')).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
                <input type="number" value={editForm.yearsOfExperience} onChange={(e) => setEditForm({ ...editForm, yearsOfExperience: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Qualification</label>
                <input type="text" value={editForm.qualification} onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
                <input type="text" value={editForm.specialization} onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-6">
              <button onClick={() => { setShowEditModal(false); setSelectedTeacher(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => {
                if (!editForm.firstName || !editForm.lastName) { alert('First and last name required'); return; }
                updateTeacherMutation.mutate({ id: selectedTeacher.id, data: { user: { firstName: editForm.firstName, lastName: editForm.lastName, email: editForm.email, phone: editForm.phone || null }, department: editForm.department, staffType: editForm.staffType, gender: editForm.gender, qualification: editForm.qualification, specialization: editForm.specialization, yearsOfExperience: editForm.yearsOfExperience ? parseInt(editForm.yearsOfExperience) : null, emergencyContact: editForm.emergencyContact || null, emergencyPhone: editForm.emergencyPhone || null, employeeNo: editForm.employeeId, hireDate: editForm.hireDate || null } });
              }} disabled={updateTeacherMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                {updateTeacherMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignmentModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">{editingAssignment ? 'Edit' : isPrimary ? 'Assign Teacher to Class' : 'Assign Teacher to Class & Subject'}</h2>
            {createAssignmentMutation.isError && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
                {createAssignmentMutation.error?.response?.data?.message || 'Failed to create assignment.'}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teacher *</label>
                <select value={selectedTeacherForAssignment?.id || ''} onChange={(e) => { console.log('Teacher selected, value:', e.target.value); const t = teachers.find((t: any) => t.id === e.target.value); console.log('Found teacher:', t); setSelectedTeacherForAssignment(t || null); }} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">Select Teacher</option>
                  {teachers.map((teacher: any) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.user?.firstName} {teacher.user?.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                <select value={assignmentForm.classId} onChange={(e) => { console.log('Class selected:', e.target.value); setAssignmentForm({ ...assignmentForm, classId: e.target.value, subjectId: '' }); }} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">Select Class</option>
                  {classesData?.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              {!isPrimary && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                {assignmentForm.classId ? (
                  classSubjectsLoading ? (
                    <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 text-sm">Loading subjects for this class...</div>
                  ) : classSubjectsData && classSubjectsData.length > 0 ? (
                    <select value={assignmentForm.subjectId} onChange={(e) => { console.log('Subject selected:', e.target.value); setAssignmentForm({ ...assignmentForm, subjectId: e.target.value }); }} className="w-full px-3 py-2 border rounded-lg" required>
                      <option value="">Select Subject</option>
                      {classSubjectsData.map((cs: any) => (
                        <option key={cs.subjectId || cs.subject?.id} value={cs.subjectId || cs.subject?.id}>{cs.subject?.name}{cs.subject?.code ? ` (${cs.subject.code})` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full px-3 py-3 border rounded-lg bg-amber-50 border-amber-200">
                      <p className="text-amber-700 text-sm font-medium">No subjects assigned to this class yet.</p>
                      <p className="text-amber-600 text-xs mt-1">Go to <a href="/dashboard/classes" className="underline font-semibold hover:text-amber-800">Classes</a> page and click the 📚 icon to add subjects to this class.</p>
                    </div>
                  )
                ) : (
                  <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-400 text-sm">Select a class first to see available subjects</div>
                )}
              </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year *</label>
                <select value={assignmentForm.academicYearId} onChange={(e) => { console.log('Academic year selected:', e.target.value); setAssignmentForm({ ...assignmentForm, academicYearId: e.target.value }); }} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">Select Academic Year</option>
                  {academicYearsData?.map((year: any) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-6">
              <button onClick={() => { setShowAssignmentModal(false); setSelectedTeacherForAssignment(null); setAssignmentForm({ classId: '', subjectId: '', academicYearId: '' }); setEditingAssignment(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => {
                if (!selectedTeacherForAssignment?.id || !assignmentForm.classId || (!isPrimary && !assignmentForm.subjectId) || !assignmentForm.academicYearId) {
                  alert('Please fill in all required fields');
                  return;
                }
                createAssignmentMutation.mutate({
                  teacherId: selectedTeacherForAssignment.user?.id || selectedTeacherForAssignment.userId || selectedTeacherForAssignment.id,
                  classId: assignmentForm.classId,
                  ...(isPrimary ? {} : { subjectId: assignmentForm.subjectId }),
                  academicYearId: assignmentForm.academicYearId,
                });
              }} disabled={createAssignmentMutation.isPending} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-all active:scale-95">
                {createAssignmentMutation.isPending ? (editingAssignment ? 'Updating...' : 'Creating...') : (editingAssignment ? 'Update Assignment' : 'Create Assignment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showClassTeacherModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-2">Assign Class Teacher</h2>
            <p className="text-gray-500 text-sm mb-6">Assign a teacher as the primary class teacher for a class</p>
            {createClassTeacherMutation.isError && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
                {createClassTeacherMutation.error?.response?.data?.message || 'Failed to assign class teacher.'}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teacher *</label>
                <select value={classTeacherForm.teacherId} onChange={(e) => setClassTeacherForm({ ...classTeacherForm, teacherId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">Select Teacher</option>
                  {teachers.map((teacher: any) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.user?.firstName} {teacher.user?.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                <select value={classTeacherForm.classId} onChange={(e) => setClassTeacherForm({ ...classTeacherForm, classId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">Select Class</option>
                  {classesData?.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year *</label>
                <select value={classTeacherForm.academicYearId} onChange={(e) => setClassTeacherForm({ ...classTeacherForm, academicYearId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">Select Academic Year</option>
                  {academicYearsData?.map((year: any) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPrimary" checked={classTeacherForm.isPrimary} onChange={(e) => setClassTeacherForm({ ...classTeacherForm, isPrimary: e.target.checked })} className="rounded border-gray-300" />
                <label htmlFor="isPrimary" className="text-sm text-gray-700">Primary class teacher (homeroom teacher)</label>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-6">
              <button onClick={() => { setShowClassTeacherModal(false); setClassTeacherForm({ teacherId: '', classId: '', academicYearId: '', isPrimary: true }); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => {
                if (!classTeacherForm.teacherId || !classTeacherForm.classId || !classTeacherForm.academicYearId) {
                  alert('Please fill in all required fields');
                  return;
                }
                createClassTeacherMutation.mutate(classTeacherForm);
              }} disabled={createClassTeacherMutation.isPending} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400">
                {createClassTeacherMutation.isPending ? 'Assigning...' : 'Assign Class Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
