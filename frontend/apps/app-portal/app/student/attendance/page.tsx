'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { attendanceApi, studentApi, termApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const STATUS_META: Record<string, { label: string; color: string }> = {
  PRESENT: { label: 'Present', color: 'bg-green-100 text-green-800' },
  LATE: { label: 'Late', color: 'bg-yellow-100 text-yellow-800' },
  ABSENT: { label: 'Absent', color: 'bg-red-100 text-red-800' },
  EXCUSED: { label: 'Excused', color: 'bg-purple-100 text-purple-800' },
  SICK: { label: 'Sick', color: 'bg-indigo-100 text-indigo-800' },
  SUSPENDED: { label: 'Suspended', color: 'bg-gray-100 text-gray-800' },
  ACTIVITY: { label: 'Activity', color: 'bg-teal-100 text-teal-800' },
  PARTIAL_ATTENDANCE: { label: 'Partial', color: 'bg-orange-100 text-orange-800' },
};

export default function StudentAttendance() {
  const { user } = useAuth();

  const { data: studentRes } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => studentApi.getById('me').then((r: any) => r.data),
    retry: false,
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });

  const studentData = studentRes?.data || studentRes;
  const studentId = studentData?.id || user?.studentId || user?.id || 'me';
  const termId = currentTerm?.data?.id;

  const { data: raw, isLoading } = useQuery({
    queryKey: ['my-attendance', termId],
    queryFn: () => attendanceApi.getStudentSummary(studentId, { termId }).then(r => r.data),
    enabled: !!studentId,
    retry: false,
  });

  const data = raw?.data || raw;
  const summary = data && !Array.isArray(data) ? data : null;
  const records: any[] = summary?.records || (Array.isArray(data) ? data : []) || [];

  const rate = summary?.attendanceRate ?? (
    records.length > 0 ? Math.round((records.filter(r => r.status === 'PRESENT').length / records.length) * 100) : 0
  );
  const rateColor = rate >= 90 ? 'text-green-600' : rate >= 75 ? 'text-blue-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-600';

  const stat = (key: string, label: string, color: string) => (
    <div className="text-center">
      <p className={`text-lg font-bold text-gray-900`}>{summary?.[key] ?? records.filter(r => r.status === key).length}</p>
      <p className={`text-xs ${color}`}>{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/student" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>My Attendance</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">My Attendance</h1>
          <p className="text-gray-600 mt-1">
            Track your attendance record for {currentTerm?.data?.name || 'the current term'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm text-center mb-6">
          <p className={`text-5xl font-bold ${rateColor}`}>{rate}%</p>
          <p className="text-gray-500 mt-1">Attendance Rate</p>
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            {stat('present', 'Present', 'text-green-600')}
            {stat('late', 'Late', 'text-yellow-600')}
            {stat('absent', 'Absent', 'text-red-600')}
            {stat('excused', 'Excused', 'text-purple-600')}
            {stat('sick', 'Sick', 'text-indigo-600')}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-500">Loading attendance...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <span className="text-5xl">✅</span>
            <p className="text-gray-500 mt-4">No attendance records found</p>
            <p className="text-sm text-gray-400 mt-1">Attendance will appear here once recorded by your school.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Attendance Records</h2>
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
                  {records.slice(0, 100).map((r: any) => {
                    const meta = STATUS_META[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={r.id} className="border-t border-gray-100">
                        <td className="p-3 text-sm text-gray-700">{new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${meta.color}`}>{meta.label}</span>
                        </td>
                        <td className="p-3 text-sm text-gray-500">{r.remarks || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
