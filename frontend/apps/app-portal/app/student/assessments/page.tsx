'use client';

import { useQuery } from '@tanstack/react-query';
import { assessmentApi, termApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function StudentAssessments() {
  const { user } = useAuth();

  const { data: termRes } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });

  const termId = termRes?.data?.id;

  const { data: assessments, isLoading } = useQuery({
    queryKey: ['my-assessments', termId],
    queryFn: async () => {
      const res = await assessmentApi.getStudentAssessments(String(user?.id), termId || '');
      return res.data?.data || res.data || [];
    },
    enabled: !!user?.id && !!termId,
  });

  const assessmentList = Array.isArray(assessments) ? assessments : [];

  const getScoreColor = (pct: number | null | undefined) => {
    if (pct == null) return 'bg-gray-100 text-gray-600';
    if (pct >= 75) return 'bg-green-100 text-green-800';
    if (pct >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
        <p className="text-gray-500">Continuous assessment scores for the current term</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading assessments...</div>
      ) : assessmentList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl">📊</span>
          <p className="text-gray-500 mt-4">No assessment data available</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {assessmentList.map((item: any, i: number) => {
            const subjectName = item.subjectName || item.subject?.name || 'Subject';
            const pct = item.percentage ?? (item.rawScore != null && item.maxScore ? (item.rawScore / item.maxScore) * 100 : null);
            return (
              <div key={item.id || i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{subjectName}</h3>
                    <p className="text-sm text-gray-500">{item.assessmentName || item.type || 'Assessment'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(pct)}`}>
                      {pct != null ? `${Math.round(pct)}%` : '—'}
                    </span>
                    {item.grade && <p className="text-xs text-gray-400 mt-1">Grade: {item.grade}</p>}
                  </div>
                </div>
                {item.rawScore != null && item.maxScore && (
                  <p className="text-xs text-gray-400">Score: {item.rawScore}/{item.maxScore}</p>
                )}
                {item.remark && <p className="text-sm text-gray-500 mt-2 italic">{item.remark}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
