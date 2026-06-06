'use client';

import { useQuery } from '@tanstack/react-query';
import { studentApi, subjectApi } from '@/lib/api';
import Link from 'next/link';

export default function StudentSubjectsPage() {
  const { data: studentData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => studentApi.getById('me').then(res => res.data),
    retry: false,
  });

  const student = studentData?.data || studentData;

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(res => res.data),
  });

  const subjects = subjectsData?.data || subjectsData || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/student" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>My Subjects</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">My Subjects</h1>
          <p className="text-gray-600 mt-1">
            Subjects offered in {student?.class?.name || 'your class'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject: any) => (
            <div key={subject.id} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                  📚
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">{subject.name}</h3>
                  {subject.code && (
                    <p className="text-sm text-gray-500">Code: {subject.code}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {subjects.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center">
            <span className="text-6xl">📚</span>
            <h3 className="text-xl font-semibold mt-4">No Subjects Available</h3>
            <p className="text-gray-500 mt-2">
              Subjects will appear here once your school has configured them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
