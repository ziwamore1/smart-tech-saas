'use client';

import { useQuery } from '@tanstack/react-query';
import { assessmentApi, termApi, studentApi } from '@/lib/api';

export default function StudentAssessments() {
  const { data: profileRes } = useQuery({
    queryKey: ['my-profile-assessments'],
    queryFn: () => studentApi.getById('me').then(r => r.data),
    retry: false,
  });
  const studentId = profileRes?.data?.id || profileRes?.id || '';

  const { data: termRes } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });

  const termId = termRes?.data?.id;

  const { data: assessments, isLoading } = useQuery({
    queryKey: ['my-assessments', studentId, termId],
    queryFn: async () => {
      const res = await assessmentApi.getStudentAssessments(String(studentId), termId || '');
      return res.data?.data || res.data || [];
    },
    enabled: !!studentId && !!termId,
  });

  const assessmentList = Array.isArray(assessments) ? assessments : [];

  const getScoreColor = (pct: number | null | undefined) => {
    if (pct == null) return 'bg-gray-100 text-gray-600';
    if (pct >= 75) return 'bg-green-100 text-green-800';
    if (pct >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const groupBySubject = () => {
    const groups = new Map<string, any[]>();
    assessmentList.forEach((a: any) => {
      const at = a.assessmentType || {};
      const key = at.name || 'Assessment';
      const arr = groups.get(key) || [];
      arr.push({ score: a.score, at });
      groups.set(key, arr);
    });
    return Array.from(groups.entries());
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
          {groupBySubject().map(([name, items]: [string, any[]], i: number) => {
            const at = items[0]?.at;
            const maxScore = at?.maxScore;
            const pct = maxScore ? (items.reduce((s, it) => s + (it.score || 0), 0) / (maxScore * items.length)) * 100 : null;
            const best = items.reduce((b, it) => Math.max(b, it.score || 0), 0);
            return (
              <div key={`${name}-${i}`} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{name}</h3>
                    <p className="text-sm text-gray-500">{items.length} scored assessment{items.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(pct)}`}>
                      {pct != null ? `${Math.round(pct)}%` : '—'}
                    </span>
                    {at?.weight != null && <p className="text-xs text-gray-400 mt-1">Weight: {at.weight}%</p>}
                  </div>
                </div>
                {maxScore != null && (
                  <p className="text-xs text-gray-400">Best score: {best}/{maxScore}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
