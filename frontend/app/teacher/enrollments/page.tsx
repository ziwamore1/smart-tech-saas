'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { teacherApi, studentApi, termApi, enrollmentApi, academicYearApi } from '@/lib/api';
import { socket } from '@/lib/socket';

export default function EnrollmentsPage() {
  const { user, isClassTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'enroll' | 'transfer' | 'bulk'>('enroll');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewStudentForm, setShowNewStudentForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  const [enrollForm, setEnrollForm] = useState({
    admissionNumber: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    academicYearId: '',
  });

  const [transferForm, setTransferForm] = useState({
    studentId: '',
    fromClassId: '',
    toClassId: '',
    reason: '',
  });

  const { data: teacherData } = useQuery({
    queryKey: ['my-teacher-profile'],
    queryFn: () => teacherApi.getById('me').then(res => res.data),
    retry: false,
  });

  const { data: classesResponse } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: async () => {
      const res = await teacherApi.getClasses();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.classes) data = data.classes;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(res => res.data),
  });

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicYearApi.getAll().then(res => res.data),
  });

  const { data: existingStudents } = useQuery({
    queryKey: ['all-students'],
    queryFn: () => studentApi.getAll({ limit: 500 }).then(res => res.data),
  });

  const teacher = teacherData?.data || teacherData;
  const assignedClass = teacher?.classTeacherOf;
  const classes = Array.isArray(classesResponse) ? classesResponse : [];
  const currentTerm = terms?.find((t: any) => t.isCurrent);
  const currentAcademicYear = academicYears?.find((y: any) => y.isCurrent);
  const classId = selectedClassId || assignedClass?.id || '';
  const selectedClassObj = classes.find((c: any) => c.id === classId);

  useEffect(() => {
    if (!selectedClassId && assignedClass?.id) {
      setSelectedClassId(assignedClass.id);
    } else if (!selectedClassId && classes.length > 0 && !assignedClass?.id) {
      setSelectedClassId(classes[0].id);
    }
  }, [assignedClass, classes, selectedClassId]);

  useEffect(() => {
    const schoolId = user?.schoolId;
    if (!schoolId) return;
    const eventName = `enrollment:updated:${schoolId}`;
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['all-students'] });
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
    };
    socket.on(eventName, handler);
    return () => { socket.off(eventName, handler); };
  }, [user?.schoolId, queryClient]);

  const enrollExistingStudentMutation = useMutation({
    mutationFn: (studentId: string) => enrollmentApi.create({
      studentId,
      classId: classId!,
      academicYearId: currentAcademicYear?.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-students'] });
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
      setTransferForm({ ...transferForm, studentId: '' });
      setMessage({ type: 'success', text: 'Student enrolled successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to enroll student' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const createAndEnrollMutation = useMutation({
    mutationFn: (data: any) => studentApi.create(data),
    onSuccess: (response) => {
      const studentId = response.data?.id || response.data?.data?.id;
      if (studentId) {
        enrollmentApi.create({
          studentId,
          classId: classId!,
          academicYearId: currentAcademicYear?.id,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['all-students'] });
          queryClient.invalidateQueries({ queryKey: ['class-students'] });
          setShowNewStudentForm(false);
          setEnrollForm({
            admissionNumber: '',
            firstName: '',
            lastName: '',
            dateOfBirth: '',
            gender: '',
            email: '',
            phone: '',
            address: '',
            parentName: '',
            parentPhone: '',
            parentEmail: '',
            academicYearId: '',
          });
          setMessage({ type: 'success', text: 'New student created and enrolled successfully!' });
          setTimeout(() => setMessage(null), 3000);
        }).catch((error: any) => {
          setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to enroll student' });
          setTimeout(() => setMessage(null), 5000);
        });
      } else {
        throw new Error('Failed to get student ID');
      }
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create student' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const handleCreateAndEnroll = () => {
    if (!enrollForm.firstName || !enrollForm.lastName || !enrollForm.admissionNumber) {
      setMessage({ type: 'error', text: 'Please fill in required fields' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    createAndEnrollMutation.mutate(enrollForm);
  };

  if (!isClassTeacher) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-xl font-semibold mt-4">Not a Class Teacher</h2>
          <p className="text-gray-600 mt-2">
            Only class teachers can enroll students. Contact your school director.
          </p>
        </div>
      </div>
    );
  }

  const students = existingStudents?.data || existingStudents?.students || [];
  const enrolledStudentIds = new Set(
    students
      .filter((s: any) => s.enrollments?.some((e: any) => e.classId === classId && e.isActive))
      .map((s: any) => s.id)
  );
  const availableStudents = students.filter((s: any) => {
    if (enrolledStudentIds.has(s.id)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.firstName?.toLowerCase() || '').includes(q)
      || (s.lastName?.toLowerCase() || '').includes(q)
      || (s.admissionNumber?.toLowerCase() || '').includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/teacher" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Enrollments</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Student Enrollments</h1>
        <p className="text-gray-600 mt-1">
          Enroll students into {selectedClassObj?.name || 'your class'}
        </p>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Class to Enroll Into *</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full md:w-80 px-3 py-2 border rounded-lg"
          >
            <option value="">Select Class</option>
            {classes.map((cls: any) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}{cls.id === assignedClass?.id ? ' (Your Class)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4 border-b">
          <button
            onClick={() => setActiveTab('enroll')}
            className={`px-4 py-3 font-medium border-b-2 ${
              activeTab === 'enroll' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            Enroll Existing Student
          </button>
          <button
            onClick={() => { setShowNewStudentForm(true); setActiveTab('enroll'); }}
            className={`px-4 py-3 font-medium border-b-2 ${
              showNewStudentForm
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            + New Student & Enroll
          </button>
        </div>

        {activeTab === 'enroll' && !showNewStudentForm && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Select Existing Student to Enroll</h3>
            
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or admission number..."
                className="w-full md:w-80 px-4 py-2 border rounded-lg"
              />
            </div>

            {availableStudents.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl">✓</span>
                <p className="text-gray-500 mt-2">All students are already enrolled in your class.</p>
                <button
                  onClick={() => setShowNewStudentForm(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add New Student
                </button>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Admission #</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Gender</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableStudents.slice(0, 50).map((student: any) => (
                      <tr key={student.id} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-sm">{student.admissionNumber}</td>
                        <td className="py-3 px-4 font-medium">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="py-3 px-4">{student.gender || '-'}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => enrollExistingStudentMutation.mutate(student.id)}
                            disabled={enrollExistingStudentMutation.isPending}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            Enroll
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 text-center">
              <button
                onClick={() => setShowNewStudentForm(true)}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
              >
                + Add New Student Instead
              </button>
            </div>
          </div>
        )}

        {activeTab === 'enroll' && showNewStudentForm && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create New Student & Enroll</h3>
              <button
                onClick={() => setShowNewStudentForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back to existing students
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admission Number *
                  </label>
                  <input
                    type="text"
                    value={enrollForm.admissionNumber}
                    onChange={(e) => setEnrollForm({ ...enrollForm, admissionNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., STD001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={enrollForm.firstName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, firstName: e.target.value })}
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
                    value={enrollForm.lastName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, lastName: e.target.value })}
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
                    value={enrollForm.dateOfBirth}
                    onChange={(e) => setEnrollForm({ ...enrollForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={enrollForm.gender}
                    onChange={(e) => setEnrollForm({ ...enrollForm, gender: e.target.value })}
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
                    value={enrollForm.email}
                    onChange={(e) => setEnrollForm({ ...enrollForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={enrollForm.phone}
                    onChange={(e) => setEnrollForm({ ...enrollForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent/Guardian Name
                  </label>
                  <input
                    type="text"
                    value={enrollForm.parentName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, parentName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Phone
                  </label>
                  <input
                    type="tel"
                    value={enrollForm.parentPhone}
                    onChange={(e) => setEnrollForm({ ...enrollForm, parentPhone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={enrollForm.address}
                  onChange={(e) => setEnrollForm({ ...enrollForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Enrollment Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                    <input
                      type="text"
                      value={selectedClassObj?.name || 'Select a class above'}
                      disabled
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                    <input
                      type="text"
                      value={currentTerm?.name || 'Current Term'}
                      disabled
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setShowNewStudentForm(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAndEnroll}
                  disabled={createAndEnrollMutation.isPending || !enrollForm.firstName || !enrollForm.lastName}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {createAndEnrollMutation.isPending ? 'Creating...' : 'Create & Enroll Student'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Enrollment Information</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Students will be enrolled in: <strong>{selectedClassObj?.name || 'Select a class'}</strong></li>
          <li>• Current Academic Year: <strong>{currentAcademicYear?.name || 'Not set'}</strong></li>
          <li>• Current Term: <strong>{currentTerm?.name || 'Not set'}</strong></li>
          <li>• Enrolled students will appear in your class list immediately</li>
        </ul>
      </div>
    </div>
  );
}
