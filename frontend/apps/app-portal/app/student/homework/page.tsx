'use client';

import { useQuery } from '@tanstack/react-query';
import { homeworkApi, studentApi } from '@/lib/api';

export default function StudentHomework() {
  const { data: profileRes } = useQuery({
    queryKey: ['my-profile-homework'],
    queryFn: () => studentApi.getById('me').then(r => r.data),
    retry: false,
  });
  const studentId = profileRes?.data?.id || profileRes?.id || '';

  const { data: homework } = useQuery({
    queryKey: ['my-homework', studentId],
    queryFn: async () => {
      const res = await homeworkApi.getByStudent(String(studentId));
      return res.data?.data || res.data || [];
    },
    enabled: !!studentId,
  });

  const homeworkList = Array.isArray(homework) ? homework : [];

  const getStatus = (hw: any) => {
    if (hw.submitted) return { label: `Submitted ${hw.score != null ? `(${hw.score}/${hw.maxScore})` : ''}`, color: 'bg-green-100 text-green-800' };
    if (new Date(hw.dueDate) < new Date()) return { label: 'Overdue', color: 'bg-red-100 text-red-800' };
    const days = Math.ceil((new Date(hw.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return { label: days === 0 ? 'Due today' : `${days} days left`, color: days <= 2 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Homework</h1>
        <p className="text-gray-500">View assignments and track submissions</p>
      </div>

      {homeworkList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl">📚</span>
          <p className="text-gray-500 mt-4">No homework assigned</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {homeworkList.map((hw: any) => {
            const status = getStatus(hw);
            return (
              <div key={hw.id} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{hw.title}</h3>
                    <p className="text-sm text-gray-500">{hw.subject?.name || 'General'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>{status.label}</span>
                </div>
                {hw.description && <p className="text-sm text-gray-600 mb-4">{hw.description}</p>}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Due: {new Date(hw.dueDate).toLocaleDateString()}</span>
                  {hw.maxScore && <span className="text-gray-400">Max: {hw.maxScore} pts</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
