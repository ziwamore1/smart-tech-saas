'use client';

import { useEffect } from 'react';

export default function TeacherDetailDialog({
  teacher,
  onClose,
}: {
  teacher: {
    id: string;
    name: string;
    role: string;
    department: string;
    completionRate: number;
    totalAssessments: number;
    completedAssessments: number;
    pendingCount: number;
    pendingItems: any[];
  };
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 animate-fadeIn" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto shadow-2xl animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  teacher.completionRate >= 80
                    ? 'bg-green-50 text-green-600'
                    : teacher.completionRate >= 50
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {teacher.name?.charAt(0) || '?'}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{teacher.name || 'Unknown Teacher'}</h3>
                <p className="text-sm text-gray-500">{teacher.role} — {teacher.department}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Total', value: teacher.totalAssessments, color: 'text-gray-900' },
              { label: 'Completed', value: teacher.completedAssessments, color: 'text-green-600' },
              { label: 'Pending', value: teacher.pendingCount, color: 'text-amber-600' },
              { label: 'Rate', value: `${teacher.completionRate}%`, color: teacher.completionRate >= 80 ? 'text-green-600' : teacher.completionRate >= 50 ? 'text-amber-600' : 'text-red-600' },
            ].map((stat) => (
              <div key={stat.label} className="text-center bg-gray-50 rounded-lg p-2">
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                teacher.completionRate >= 80 ? 'bg-green-500' : teacher.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(teacher.completionRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="p-6">
          <h4 className="font-semibold text-gray-900 mb-3">
            Assigned Assessment Progress {teacher.pendingItems.length > 0 && <span className="text-gray-400 font-normal">({teacher.pendingItems.length})</span>}
          </h4>

          {teacher.pendingItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-500 text-sm">All assessments completed!</p>
              <p className="text-xs text-gray-400 mt-1">No pending items for this teacher.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {teacher.pendingItems.map((item: any, i: number) => {
                const complete = item.completed || item.missingCount === 0;
                return <div key={i} className={`flex items-center justify-between ${complete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'} border rounded-lg p-3 transition-colors`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.assessmentName || item.assessmentDef?.name || 'Assessment'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.subjectName || item.subject?.name}
                      {item.className ? ` — ${item.className}` : ''}
                    </p>
                  </div>
                   <div className="ml-3 text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${complete ? 'text-green-700' : 'text-amber-700'}`}>{complete ? `${item.totalStudents} of ${item.totalStudents}` : `${item.enteredCount} of ${item.totalStudents}`}</p>
                    <p className={`text-xs ${complete ? 'text-green-600' : 'text-amber-600'}`}>{complete ? 'completed' : `${item.missingCount} missing`}</p>
                  </div>
                </div>;
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          {teacher.pendingCount > 0 && (
            <a
              href="/dashboard/results-management/result-entry"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Enter Scores
            </a>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.15s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
