"use client";

import { useQuery } from '@tanstack/react-query';
import { timetableApi } from '@/lib/api';

type Props = {
  termId: string;
  onClose: () => void;
};

type Conflict = {
  id: string;
  type: 'teacher' | 'room' | 'class';
  message: string;
  details: {
    teacher?: string;
    room?: string;
    class?: string;
    day?: number;
    period?: number;
  };
};

export default function ConflictsPanel({ termId, onClose }: Props) {
  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['timetable-jobs'],
    queryFn: () => timetableApi.getSchoolJobStatus().then(res => res.data),
  });

  const jobs = jobsData?.data || [];
  const conflicts: Conflict[] = [];

  jobs.forEach((job: any) => {
    if (job.status === 'failed') {
      conflicts.push({
        id: job.id,
        type: 'teacher',
        message: `Job failed: ${job.error || 'Unknown error'}`,
        details: {},
      });
    }
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h2 className="text-2xl font-bold">Conflicts & Warnings</h2>
                <p className="text-red-100 mt-1">Timetable generation issues</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading conflicts...</div>
          ) : conflicts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">✅</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Conflicts Found</h3>
              <p className="text-gray-500">
                Your timetable looks good! There are no conflicts or warnings.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="border border-red-200 bg-red-50 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {conflict.type === 'teacher' && '👨‍🏫'}
                      {conflict.type === 'room' && '🚪'}
                      {conflict.type === 'class' && '🏫'}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-red-900">{conflict.message}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        {conflict.details.teacher && (
                          <div>
                            <span className="text-red-700">Teacher:</span>{' '}
                            <span className="text-red-900">{conflict.details.teacher}</span>
                          </div>
                        )}
                        {conflict.details.room && (
                          <div>
                            <span className="text-red-700">Room:</span>{' '}
                            <span className="text-red-900">{conflict.details.room}</span>
                          </div>
                        )}
                        {conflict.details.class && (
                          <div>
                            <span className="text-red-700">Class:</span>{' '}
                            <span className="text-red-900">{conflict.details.class}</span>
                          </div>
                        )}
                        {conflict.details.day && conflict.details.period && (
                          <div>
                            <span className="text-red-700">Time:</span>{' '}
                            <span className="text-red-900">
                              Day {conflict.details.day}, Period {conflict.details.period}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Quick Tips</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Check teacher availability constraints</li>
              <li>• Verify room capacity for classes</li>
              <li>• Ensure sufficient periods for all subjects</li>
              <li>• Run the generator again after fixing issues</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 bg-gray-50 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
