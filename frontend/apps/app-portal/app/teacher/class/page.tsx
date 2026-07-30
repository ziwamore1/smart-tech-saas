'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { classApi, classTeacherAssignmentApi, studentApi } from '@/lib/api';
import { socket } from '@/lib/socket';

export default function MyClassPage() {
  const { user, isClassTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [editForm, setEditForm] = useState({
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
  });

  useEffect(() => {
    const schoolId = user?.schoolId;
    if (!schoolId) return;
    const eventName = `student:updated:${schoolId}`;
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
    };
    socket.on(eventName, handler);
    return () => { socket.off(eventName, handler); };
  }, [user?.schoolId, queryClient]);

  const { data: classesResponse } = useQuery({
    queryKey: ['my-class-teacher-classes', user?.id],
    queryFn: async () => {
      try {
        const res = await classTeacherAssignmentApi.findByTeacher(user!.id);
        let items = res.data?.data || res.data;
        if (!Array.isArray(items)) items = [];
        const mapped = items
          .filter((cta: any) => cta.class)
          .map((cta: any) => ({
            id: cta.class.id, classId: cta.class.id, _id: cta.class.id,
            name: cta.class.name, className: cta.class.name,
          }));
        if (mapped.length > 0) return mapped;
      } catch {}
      if (user?.classTeacherOf) {
        const res = await classApi.getById(user.classTeacherOf);
        const cls = res.data?.data || res.data;
        if (cls?.id) {
          return [{
            id: cls.id, classId: cls.id, _id: cls.id,
            name: cls.name, className: cls.name,
          }];
        }
      }
      return [];
    },
    enabled: !!user?.id,
  });

  const classes = Array.isArray(classesResponse) ? classesResponse : [];
  const assignedClassId = user?.classTeacherOf || '';
  const classId = selectedClassId || assignedClassId;
  const selectedClassObj = classes.find((c: any) => c.id === classId);

  useEffect(() => {
    if (!selectedClassId && assignedClassId) {
      setSelectedClassId(assignedClassId);
    } else if (!selectedClassId && classes.length > 0 && !assignedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [assignedClassId, classes, selectedClassId]);

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => studentApi.getAll({ classId, limit: 200 }).then(res => {
      const students = res.data?.data || res.data?.students || [];
      return Array.isArray(students) ? students : [];
    }),
    enabled: !!classId,
  });

  const updateStudentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => studentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
      setShowEditModal(false);
      setSelectedStudent(null);
      setMessage({ type: 'success', text: 'Student updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update student' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      studentApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
      setMessage({ type: 'success', text: 'Student status updated!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update status' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const students = studentsData || [];
  const filteredStudents = students.filter((student: any) => {
    return searchTerm === '' ||
      student.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const openEditModal = (student: any) => {
    setSelectedStudent(student);
    setEditForm({
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
      gender: student.gender || '',
      email: student.email || '',
      phone: student.phone || '',
      address: student.address || '',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      parentEmail: student.parentEmail || '',
    });
    setShowEditModal(true);
  };

  if (!isClassTeacher) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-xl font-semibold mt-4">Not a Class Teacher</h2>
          <p className="text-gray-600 mt-2">
            You are not a class teacher. Contact your school director.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/teacher" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>My Class</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">My Class</h1>
        <p className="text-gray-600 mt-1">
          Manage students in {selectedClassObj?.name || 'your class'}
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold">{selectedClassObj?.name || 'Select a class'}</h2>
            <p className="text-gray-500">{filteredStudents.length} students enrolled</p>
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">Select Class</option>
              {classes.map((cls: any) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}{cls.id === assignedClassId ? ' (Your Class)' : ''}
                </option>
              ))}
            </select>
            <Link
              href="/teacher/enrollments"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Enroll New Student
            </Link>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or admission number..."
            className="w-full md:w-80 px-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl">👥</span>
            <p className="text-gray-500 mt-2">No students found.</p>
            <Link href="/teacher/enrollments" className="text-blue-600 hover:underline mt-2 inline-block">
              Enroll your first student
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Admission #</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Gender</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Date of Birth</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Parent Contact</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student: any) => (
                  <tr key={student.id} className="border-t hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">{student.admissionNumber}</td>
                    <td className="py-3 px-4 font-medium">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="py-3 px-4">{student.gender || '-'}</td>
                    <td className="py-3 px-4">
                      {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <div>{student.parentPhone || student.parentName || '-'}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        student.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        student.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800' :
                        student.status === 'GRADUATED' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {student.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        {student.status === 'ACTIVE' ? (
                          <button
                            onClick={() => {
                              if (confirm(`Mark ${student.firstName} as inactive?`)) {
                                deactivateMutation.mutate({ id: student.id, status: 'INACTIVE' });
                              }
                            }}
                            className="text-yellow-600 hover:text-yellow-800 text-sm"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`Reactivate ${student.firstName}?`)) {
                                deactivateMutation.mutate({ id: student.id, status: 'ACTIVE' });
                              }
                            }}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditModal && selectedStudent && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              Edit Student: {selectedStudent.firstName} {selectedStudent.lastName}
            </h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Parent/Guardian Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Parent Name</label>
                    <input
                      type="text"
                      value={editForm.parentName}
                      onChange={(e) => setEditForm({ ...editForm, parentName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Parent Phone</label>
                    <input
                      type="tel"
                      value={editForm.parentPhone}
                      onChange={(e) => setEditForm({ ...editForm, parentPhone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Parent Email</label>
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
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateStudentMutation.mutate({ id: selectedStudent.id, data: editForm })}
                  disabled={updateStudentMutation.isPending}
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
