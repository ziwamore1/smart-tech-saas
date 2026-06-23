'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '@/lib/api';

export default function ParentAttendance() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  const { data: children } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
  });

  const childrenList = Array.isArray(children) ? children : [];

  const { data: attendance } = useQuery({
    queryKey: ['parent-attendance', selectedChildId],
    queryFn: () => parentApi.getChildAttendance(selectedChildId).then(r => r.data?.data || r.data || []),
    enabled: !!selectedChildId,
  });

  const records = Array.isArray(attendance) ? attendance : [];
  const summary = records.reduce((acc: any, r: any) => {
    acc.total++;
    if (r.status === 'PRESENT') acc.present++;
    else if (r.status === 'LATE') acc.late++;
    else if (r.status === 'ABSENT') acc.absent++;
    else if (r.status === 'EXCUSED') acc.excused++;
    return acc;
  }, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });

  const rate = summary.total > 0 ? Math.round(((summary.present + summary.late) / summary.total) * 100) : 0;
  const rateColor = rate >= 90 ? 'text-green-600' : rate >= 75 ? 'text-blue-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-gray-500">View attendance records for your children</p>
      </div>

      {childrenList.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {childrenList.map((c: any) => (
            <button key={c.id} onClick={() => setSelectedChildId(c.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedChildId === c.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
              {c.firstName || c.name || 'Child'}
            </button>
          ))}
        </div>
      )}

      {!selectedChildId && childrenList.length > 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl">👆</span>
          <p className="text-gray-500 mt-4">Select a child to view attendance</p>
        </div>
      ) : (
        <>
          {summary.total > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <p className={`text-5xl font-bold ${rateColor}`}>{rate}%</p>
              <p className="text-gray-500 mt-1">Attendance Rate</p>
              <div className="flex justify-center gap-6 mt-4">
                <div><p className="text-lg font-bold text-green-600">{summary.present}</p><p className="text-xs text-gray-500">Present</p></div>
                <div><p className="text-lg font-bold text-yellow-600">{summary.late}</p><p className="text-xs text-gray-500">Late</p></div>
                <div><p className="text-lg font-bold text-red-600">{summary.absent}</p><p className="text-xs text-gray-500">Absent</p></div>
                <div><p className="text-lg font-bold text-purple-600">{summary.excused}</p><p className="text-xs text-gray-500">Excused</p></div>
              </div>
            </div>
          )}

          {records.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
              <span className="text-5xl">✅</span>
              <p className="text-gray-500 mt-4">No attendance records found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Check In</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Check Out</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 100).map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="p-3 text-sm text-gray-700">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          r.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                          r.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' :
                          r.status === 'ABSENT' ? 'bg-red-100 text-red-800' :
                          r.status === 'EXCUSED' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>{r.status}</span>
                      </td>
                      <td className="p-3 text-sm text-gray-500">{r.checkIn || '—'}</td>
                      <td className="p-3 text-sm text-gray-500">{r.checkOut || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
