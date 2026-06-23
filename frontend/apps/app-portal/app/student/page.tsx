'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { studentApi, resultApi, termApi, examApi, homeworkApi, assessmentApi, reportCardApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function StudentPortal() {
  const { user } = useAuth();

  const { data: studentData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => studentApi.getById('me').then(res => res.data),
    retry: false,
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(res => res.data),
    retry: false,
  });

  const { data: myResults, isLoading: resultsLoading } = useQuery({
    queryKey: ['my-results', currentTerm?.data?.id],
    queryFn: () => resultApi.getByStudent('me', currentTerm?.data?.id).then(res => res.data),
    enabled: !!currentTerm?.data?.id,
  });

  const student = studentData?.data || studentData;
  const results = myResults?.data || myResults || [];

  const getGradeColor = (score: number) => {
    if (score >= 75) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const calculateAverage = () => {
    if (results.length === 0) return 0;
    const total = results.reduce((sum: number, r: any) => sum + r.score, 0);
    return (total / results.length).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {student?.firstName || user?.firstName || 'Student'}!
          </h1>
          <p className="text-gray-600 mt-1">
            {currentTerm?.data?.name || 'Current Term'} - {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                👨‍🎓
              </div>
              <div>
                <p className="text-sm text-gray-500">Class</p>
                <p className="text-lg font-semibold">{student?.class?.name || 'Not assigned'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                📊
              </div>
              <div>
                <p className="text-sm text-gray-500">Average Score</p>
                <p className="text-lg font-semibold">{calculateAverage()}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">
                📚
              </div>
              <div>
                <p className="text-sm text-gray-500">Subjects</p>
                <p className="text-lg font-semibold">{results.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Quick Actions</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Link href="/student/timetable" className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                  <span className="text-3xl">📅</span>
                  <div>
                    <p className="font-medium text-gray-900">My Timetable</p>
                    <p className="text-sm text-gray-500">View class schedule</p>
                  </div>
                </Link>
                <Link href="/student/results" className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
                  <span className="text-3xl">📝</span>
                  <div>
                    <p className="font-medium text-gray-900">My Results</p>
                    <p className="text-sm text-gray-500">View published results</p>
                  </div>
                </Link>
                <Link href="/student/exams" className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
                  <span className="text-3xl">📋</span>
                  <div>
                    <p className="font-medium text-gray-900">Online Exams</p>
                    <p className="text-sm text-gray-500">Take exams & view results</p>
                  </div>
                </Link>
                <Link href="/student/homework" className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors">
                  <span className="text-3xl">📚</span>
                  <div>
                    <p className="font-medium text-gray-900">Homework</p>
                    <p className="text-sm text-gray-500">View assignments & submit</p>
                  </div>
                </Link>
                <Link href="/student/report-cards" className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-colors">
                  <span className="text-3xl">📄</span>
                  <div>
                    <p className="font-medium text-gray-900">Report Cards</p>
                    <p className="text-sm text-gray-500">Download & print reports</p>
                  </div>
                </Link>
                <Link href="/student/assessments" className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-pink-500 hover:bg-pink-50 transition-colors">
                  <span className="text-3xl">📊</span>
                  <div>
                    <p className="font-medium text-gray-900">Assessments</p>
                    <p className="text-sm text-gray-500">View assessment scores</p>
                  </div>
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Results</h2>
                <Link href="/student/results" className="text-blue-600 hover:underline text-sm">
                  View All
                </Link>
              </div>

              {resultsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : results.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-4xl">📋</span>
                  <p className="text-gray-500 mt-2">No results available yet.</p>
                  <p className="text-sm text-gray-400">Results will appear here when published.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.slice(0, 5).map((result: any) => (
                    <div key={result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{result.subject?.name || 'Subject'}</p>
                        <p className="text-sm text-gray-500">Term: {currentTerm?.data?.name || 'Current'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full font-semibold ${getGradeColor(result.score)}`}>
                          {result.score?.toFixed(1)}%
                        </span>
                        <p className="text-sm text-gray-500 mt-1">{result.grade || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <h2 className="text-xl font-semibold mb-4">Student Info</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium">{student?.firstName} {student?.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Admission No.</span>
                  <span className="font-medium">{student?.admissionNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Class</span>
                  <span className="font-medium">{student?.class?.name || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Term</span>
                  <span className="font-medium">{currentTerm?.data?.name || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Help & Support</h2>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Need help with your account or have questions?
                </p>
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Contact School
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
