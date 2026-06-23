'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { examApi, termApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function StudentExams() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'available' | 'taken'>('available');

  const { data: termRes } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });

  const termId = termRes?.data?.id;

  const { data: exams, isLoading } = useQuery({
    queryKey: ['student-exams', termId],
    queryFn: async () => {
      const res = await examApi.getAll({ termId });
      return res.data?.data || res.data || [];
    },
    enabled: !!termId,
  });

  const { data: myResults } = useQuery({
    queryKey: ['student-exam-results'],
    queryFn: async () => {
      const res = await examApi.getStudentResults({ studentId: user?.id || '' });
      return res.data?.data || res.data || [];
    },
    enabled: !!user?.id,
  });

  const availableExams = Array.isArray(exams) ? exams.filter((e: any) => e.isPublished && e.status !== 'ARCHIVED') : [];
  const takenExamIds = new Set((Array.isArray(myResults) ? myResults : []).map((r: any) => r.examId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Online Exams</h1>
        <p className="text-gray-500">Take published exams and review your results</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button onClick={() => setActiveTab('available')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'available' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Available Exams</button>
        <button onClick={() => setActiveTab('taken')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'taken' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>My Results</button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading exams...</div>
      ) : activeTab === 'available' ? (
        availableExams.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <span className="text-5xl">📋</span>
            <p className="text-gray-500 mt-4">No exams available</p>
            <p className="text-sm text-gray-400">Check back when your teacher publishes an exam.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {availableExams.map((exam: any) => {
              const taken = takenExamIds.has(exam.id);
              return (
                <div key={exam.id} className="bg-white rounded-xl p-6 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">📝</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                      <p className="text-sm text-gray-500">{exam.subject?.name} • {exam.duration} min • {exam.totalScore} marks</p>
                      <p className="text-xs text-gray-400">Due: {new Date(exam.endsAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(`/student/exams/take/${exam.id}`, '_blank')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${taken ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    disabled={taken}
                  >
                    {taken ? 'Completed' : 'Start Exam'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid gap-4">
          {(!myResults || (Array.isArray(myResults) && myResults.length === 0)) ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
              <span className="text-5xl">📊</span>
              <p className="text-gray-500 mt-4">No exam results yet</p>
            </div>
          ) : (
            (Array.isArray(myResults) ? myResults : []).map((result: any) => (
              <div key={result.id || result.examId} className="bg-white rounded-xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{result.exam?.title || result.examTitle || 'Exam'}</h3>
                  <p className="text-sm text-gray-500">{result.subject?.name || 'Subject'} • {result.score != null ? `${result.score}/${result.totalScore || result.maxScore || 100}` : 'Pending review'}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${(result.percentage || 0) >= 75 ? 'bg-green-100 text-green-800' : (result.percentage || 0) >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {result.percentage != null ? `${Math.round(result.percentage)}%` : result.score != null ? `${result.score}/${result.totalScore || 100}` : '—'}
                  </span>
                  {result.grade && <p className="text-xs text-gray-400 mt-1">Grade: {result.grade}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
