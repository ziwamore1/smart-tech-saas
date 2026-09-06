'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { parentApi } from '@/lib/api';

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
  records: { id: string; date: string; status: string; remarks?: string | null }[];
}

const STATUS_STYLES: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800',
  LATE: 'bg-amber-100 text-amber-800',
  ABSENT: 'bg-red-100 text-red-800',
  EXCUSED: 'bg-purple-100 text-purple-800',
  SUSPENDED: 'bg-gray-100 text-gray-800',
};

const STATUS_COLORS: Record<string, string> = {
  PRESENT: '#10b981',
  LATE: '#f59e0b',
  ABSENT: '#ef4444',
  EXCUSED: '#8b5cf6',
  SUSPENDED: '#6b7280',
};

export default function ParentAttendance() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  const { data: childrenData } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
  });

  const childrenList: any[] = Array.isArray(childrenData) ? childrenData : [];
  const activeChildId = selectedChildId || childrenList[0]?.id || '';

  const { data: attendanceData, isLoading } = useQuery<AttendanceSummary>({
    queryKey: ['parent-attendance', activeChildId],
    queryFn: () => parentApi.getChildAttendance(activeChildId).then(r => {
      const d = r.data?.data || r.data;
      if (Array.isArray(d)) {
        const recs = d as any[];
        return {
          total: recs.length,
          present: recs.filter((x: any) => x.status === 'PRESENT').length,
          late: recs.filter((x: any) => x.status === 'LATE').length,
          absent: recs.filter((x: any) => x.status === 'ABSENT').length,
          excused: recs.filter((x: any) => x.status === 'EXCUSED').length,
          attendanceRate: recs.length > 0
            ? Math.round(((recs.filter((x: any) => x.status === 'PRESENT').length + recs.filter((x: any) => x.status === 'LATE').length) / recs.length) * 100)
            : 0,
          records: recs,
        };
      }
      return {
        total: d?.total || 0,
        present: d?.present || 0,
        absent: d?.absent || 0,
        late: d?.late || 0,
        excused: d?.excused || 0,
        attendanceRate: typeof d?.attendanceRate === 'number' ? d.attendanceRate : 0,
        records: Array.isArray(d?.records) ? d.records : [],
      };
    }),
    enabled: !!activeChildId,
  });

  const hasData = (attendanceData?.total ?? 0) > 0;
  const rate = hasData ? attendanceData!.attendanceRate : 0;
  const rateColor = rate >= 90 ? 'text-emerald-600' : rate >= 75 ? 'text-blue-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600';

  const donutData = hasData
    ? [
        { name: 'Present', value: attendanceData!.present },
        { name: 'Late', value: attendanceData!.late },
        { name: 'Absent', value: attendanceData!.absent },
        { name: 'Excused', value: attendanceData!.excused },
      ].filter(d => d.value > 0)
    : [];

  const donutOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} days ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    color: [STATUS_COLORS.PRESENT, STATUS_COLORS.LATE, STATUS_COLORS.ABSENT, STATUS_COLORS.EXCUSED],
    series: [{
      name: 'Attendance',
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['50%', '45%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { fontSize: 11, formatter: '{b}: {c}' },
      data: donutData,
    }],
  };

  return (
    <div className="px-4 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-gray-500">View attendance records for your children</p>
      </div>

      {childrenList.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <p className="text-sm font-medium text-gray-600 mb-3">Select a child</p>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto">
            {childrenList.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedChildId(c.id)}
                className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl text-left transition-all border-2 ${
                  activeChildId === c.id
                    ? 'bg-emerald-50 border-emerald-500'
                    : 'bg-gray-50 border-transparent hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                <p className={`font-semibold text-sm ${activeChildId === c.id ? 'text-emerald-700' : 'text-gray-800'}`}>
                  {c.firstName} {c.lastName}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{c.class || 'Not assigned'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-gray-500">Loading attendance...</div>
      ) : !activeChildId ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">👆</span>
          <p className="text-gray-500 mt-4">No children linked yet</p>
        </div>
      ) : !hasData ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">✅</span>
          <p className="text-gray-500 mt-4">No attendance recorded for this term yet</p>
          <p className="text-xs text-gray-400 mt-2">Attendance will appear here once the school records it.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
              <p className={`text-5xl font-bold ${rateColor}`}>{rate}%</p>
              <p className="text-gray-500 mt-1">Attendance Rate</p>
              <p className="text-xs text-gray-400 mt-1">{attendanceData!.total} days on record</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 col-span-1 lg:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-3">Breakdown</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{attendanceData!.present}</p>
                  <p className="text-xs text-emerald-800 mt-0.5">Present</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{attendanceData!.late}</p>
                  <p className="text-xs text-amber-800 mt-0.5">Late</p>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{attendanceData!.absent}</p>
                  <p className="text-xs text-red-800 mt-0.5">Absent</p>
                </div>
                <div className="rounded-xl bg-purple-50 border border-purple-100 p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{attendanceData!.excused}</p>
                  <p className="text-xs text-purple-800 mt-0.5">Excused</p>
                </div>
              </div>
              {donutData.length > 0 && (
                <ReactECharts option={donutOption} style={{ height: 260 }} notMerge lazyUpdate />
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Attendance Records</h3>
              <p className="text-sm text-gray-500">Recent attendance for {childrenList.find((c: any) => c.id === activeChildId)?.firstName} {childrenList.find((c: any) => c.id === activeChildId)?.lastName}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData!.records.slice(0, 100).map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] || 'bg-gray-100 text-gray-800'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-500">{r.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}