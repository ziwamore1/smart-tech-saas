'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { teacherApi, termApi, classApi } from '@/lib/api';

export default function TeacherDashboard() {
  const { user, isClassTeacher } = useAuth();

  const { data: teacherData } = useQuery({
    queryKey: ['my-teacher-profile'],
    queryFn: () => teacherApi.getById('me').then(res => res.data),
    retry: false,
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(res => res.data),
    retry: false,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(res => res.data),
  });

  const teacher = teacherData?.data || teacherData;
  const assignedClass = teacher?.classTeacherOf;
  const subjects = teacher?.subjects || [];

  const quickActions = [
    {
      href: '/teacher/class',
      icon: '👥',
      label: 'My Class',
      description: 'View and manage class students',
      color: 'blue',
    },
    {
      href: '/teacher/enrollments',
      icon: '📝',
      label: 'Enrollments',
      description: 'Enroll new students',
      color: 'green',
    },
    {
      href: '/teacher/results',
      icon: '📊',
      label: 'Results',
      description: 'Enter and manage results',
      color: 'purple',
    },
    {
      href: '/teacher/timetable',
      icon: '📅',
      label: 'Timetable',
      description: 'View teaching schedule',
      color: 'orange',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user?.firstName || teacher?.user?.firstName || 'Teacher'}!
        </h1>
        <p className="text-gray-600 mt-1">
          {currentTerm?.data?.name || 'Current Term'} - {new Date().toLocaleDateString()}
        </p>
      </div>

      {isClassTeacher && assignedClass && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⭐</span>
            <div>
              <p className="font-semibold text-green-800">You are a Class Teacher!</p>
              <p className="text-sm text-green-600">
                You have special privileges to manage students in {assignedClass.name || 'your class'}.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
              📚
            </div>
            <div>
              <p className="text-sm text-gray-500">Subjects</p>
              <p className="text-lg font-semibold">{subjects.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <p className="text-sm text-gray-500">Class Students</p>
              <p className="text-lg font-semibold">
                {assignedClass ? (assignedClass.students?.length || 'View in My Class') : 'Not Assigned'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">
              🏫
            </div>
            <div>
              <p className="text-sm text-gray-500">Classes Teaching</p>
              <p className="text-lg font-semibold">
                {teacher?.teachingClasses?.length || teacher?.classes?.length || '0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-${action.color}-500 hover:bg-${action.color}-50 transition-colors`}
            >
              <span className="text-3xl">{action.icon}</span>
              <div>
                <p className="font-medium text-gray-900">{action.label}</p>
                <p className="text-sm text-gray-500">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">My Subjects</h2>
          {subjects.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl">📚</span>
              <p className="text-gray-500 mt-2">No subjects assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map((subject: any) => (
                <div key={subject.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{subject.name}</p>
                    <p className="text-sm text-gray-500">{subject.code || 'No code'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Class Teacher Role</h2>
          {isClassTeacher && assignedClass ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="font-medium text-green-800">You are the class teacher for:</p>
                <p className="text-lg font-bold text-green-900 mt-1">{assignedClass.name}</p>
                <p className="text-sm text-green-600 mt-1">
                  {assignedClass.students?.length || 0} students enrolled
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Your responsibilities include:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <span>✓</span> Managing student enrollments
                  </li>
                  <li className="flex items-center gap-2">
                    <span>✓</span> Updating student records
                  </li>
                  <li className="flex items-center gap-2">
                    <span>✓</span> Entering and publishing results
                  </li>
                  <li className="flex items-center gap-2">
                    <span>✓</span> Communicating with parents
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl">👨‍🏫</span>
              <p className="text-gray-500 mt-2">You are not assigned as a class teacher.</p>
              <p className="text-sm text-gray-400 mt-1">Contact the director to be assigned a class.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
