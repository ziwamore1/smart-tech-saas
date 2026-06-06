'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { attendanceApi } from '@/lib/api';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  PRESENT: '#059669', ABSENT: '#dc2626', LATE: '#ea580c', EXCUSED: '#2563eb',
  SICK: '#ca8a04', SUSPENDED: '#6b7280', ACTIVITY: '#7c3aed', PARTIAL_ATTENDANCE: '#0d9488',
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Present', ABSENT: 'Absent', LATE: 'Late', EXCUSED: 'Excused',
  SICK: 'Sick', SUSPENDED: 'Suspended', ACTIVITY: 'Activity', PARTIAL_ATTENDANCE: 'Partial',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthHeatmap(records: Array<{ date: string; status: string }>, year: number, month: number) {
  const days = getDaysInMonth(year, month);
  const map: Record<number, string> = {};
  for (const r of records) {
    const d = new Date(r.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      map[d.getDate()] = r.status;
    }
  }
  const weeks: Array<Array<{ day: number; status?: string }>> = [];
  const firstDay = new Date(year, month, 1).getDay();
  let week: Array<{ day: number; status?: string }> = [];
  for (let i = 0; i < firstDay; i++) week.push({ day: 0 });
  for (let day = 1; day <= days; day++) {
    week.push({ day, status: map[day] });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) weeks.push(week);
  return weeks;
}

export default function StudentAttendanceProfilePage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['student-attendance-summary', studentId],
    queryFn: async () => {
      const res = await attendanceApi.getStudentSummary(studentId);
      return res.data?.data || res.data || {};
    },
    enabled: !!studentId,
  });

  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['student-attendance-records', studentId],
    queryFn: async () => {
      const res = await attendanceApi.getByStudent(studentId);
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!studentId,
  });

  const { data: longitudinalData, isLoading: longitudinalLoading } = useQuery({
    queryKey: ['student-longitudinal', studentId],
    queryFn: async () => {
      const res = await attendanceApi.getStudentLongitudinalAnalysis(studentId);
      return res.data?.data || res.data || {};
    },
    enabled: !!studentId,
  });

  const summary = summaryData as Record<string, any>;
  const longitudinal = longitudinalData as Record<string, any>;
  const records = (recordsData as Array<any>) || [];

  const monthHeatmap = useMemo(() => {
    return getMonthHeatmap(records, currentYear, currentMonth);
  }, [records, currentYear, currentMonth]);

  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records]);

  const monthlyTimeline = useMemo(() => {
    const byMonth: Record<string, { total: number; present: number; absent: number; late: number; excused: number; sick: number }> = {};
    for (const r of records) {
      const key = new Date(r.date).toISOString().slice(0, 7);
      if (!byMonth[key]) byMonth[key] = { total: 0, present: 0, absent: 0, late: 0, excused: 0, sick: 0 };
      byMonth[key].total++;
      if (r.status === 'PRESENT') byMonth[key].present++;
      else if (r.status === 'ABSENT') byMonth[key].absent++;
      else if (r.status === 'LATE') byMonth[key].late++;
      else if (r.status === 'EXCUSED') byMonth[key].excused++;
      else if (r.status === 'SICK') byMonth[key].sick++;
    }
    return Object.entries(byMonth)
      .map(([month, data]) => ({ month, ...data, rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0 }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [records]);

  const lateRecords = useMemo(() => {
    return records.filter(r => r.status === 'LATE').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records]);

  if (summaryLoading || recordsLoading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading student attendance profile...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingBottom: 40 }}>
      <style>{`
        .card-hover { transition: all 0.2s ease; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.08); }
        .heatmap-cell { transition: all 0.15s ease; cursor: pointer; }
        .heatmap-cell:hover { transform: scale(1.2); opacity: 0.8; }
        .insight-item { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        .profile-table { border: 1px solid #d1d5db; }
        .profile-table th { border-bottom: 2px solid #d1d5db; background: #f3f4f6; color: #374151; font-size: 11px; text-transform: uppercase; }
        .profile-table td, .profile-table th { border-right: 1px solid #e8ddd0; padding: 10px 12px; }
        .profile-table td:last-child, .profile-table th:last-child { border-right: none; }
        .profile-table tr { border-bottom: 1px solid #e8ddd0; }
        .profile-table tr:last-child { border-bottom: none; }
      `}</style>

      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Link href="/dashboard/attendance/dashboard" style={{ fontSize: 13, color: '#ea6645', textDecoration: 'none' }}>Attendance</Link>
            <span style={{ color: '#9ca3af' }}>/</span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Student Profile</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1f2937', margin: 0 }}>Student Attendance Profile</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card-hover" style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 8px' }}>Attendance Rate</p>
          <p style={{
            fontSize: 48, fontWeight: 700, margin: 0,
            color: (summary?.attendanceRate || 0) >= 90 ? '#059669' : (summary?.attendanceRate || 0) >= 75 ? '#ea580c' : '#dc2626',
          }}>{summary?.attendanceRate || 0}%</p>
        </div>
        {[
          { label: 'Present', value: summary?.present || 0, color: '#059669' },
          { label: 'Absent', value: summary?.absent || 0, color: '#dc2626' },
          { label: 'Late', value: summary?.late || 0, color: '#ea580c' },
          { label: 'Excused', value: summary?.excused || 0, color: '#2563eb' },
          { label: 'Sick', value: summary?.sick || 0, color: '#ca8a04' },
          { label: 'Suspended', value: summary?.suspended || 0, color: '#6b7280' },
          { label: 'Activity', value: summary?.activity || 0, color: '#7c3aed' },
          { label: 'Partial', value: summary?.partial || 0, color: '#0d9488' },
        ].map(s => (
          <div key={s.label} className="card-hover" style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 4px' }}>{s.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Monthly Attendance Calendar</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); }}
              style={{ padding: '6px 12px', background: '#f3f4f6', border: '1px solid #e8ddd0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>&larr; Prev</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{monthName}</span>
            <button onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); }}
              style={{ padding: '6px 12px', background: '#f3f4f6', border: '1px solid #e8ddd0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Next &rarr;</button>
          </div>
          <table className="profile-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <th key={d} style={{ padding: '6px 4px', fontSize: 11, textAlign: 'center' }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthHeatmap.map((week, wi) => (
                <tr key={wi}>
                  {week.map((cell, ci) => (
                    <td key={ci} style={{ padding: 4, textAlign: 'center' }}>
                      {cell.day > 0 ? (
                        <div className="heatmap-cell" style={{
                          width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 600,
                          background: !cell.status ? '#f3f4f6' : STATUS_COLORS[cell.status] || '#f3f4f6',
                          color: cell.status ? 'white' : '#9ca3af',
                          opacity: cell.status === 'PRESENT' ? 0.85 : 1,
                        }} title={STATUS_LABELS[cell.status || ''] || 'No record'}>
                          {cell.day}
                        </div>
                      ) : <div style={{ width: 32, height: 32 }} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <span key={status} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
                {STATUS_LABELS[status]}
              </span>
            ))}
          </div>
        </div>

        <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Monthly Attendance Trend</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {monthlyTimeline.map((month: any) => (
              <div key={month.month}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, color: '#374151' }}>
                    {new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{ fontWeight: 600, color: month.rate >= 90 ? '#059669' : month.rate >= 75 ? '#ea580c' : '#dc2626' }}>{month.rate}%</span>
                </div>
                <div style={{ height: 20, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  {month.present > 0 && <div style={{ height: '100%', width: `${(month.present / month.total) * 100}%`, background: '#059669', minWidth: 2 }} />}
                  {month.late > 0 && <div style={{ height: '100%', width: `${(month.late / month.total) * 100}%`, background: '#ea580c', minWidth: 2 }} />}
                  {month.sick > 0 && <div style={{ height: '100%', width: `${(month.sick / month.total) * 100}%`, background: '#ca8a04', minWidth: 2 }} />}
                  {month.excused > 0 && <div style={{ height: '100%', width: `${(month.excused / month.total) * 100}%`, background: '#2563eb', minWidth: 2 }} />}
                  {month.absent > 0 && <div style={{ height: '100%', width: `${(month.absent / month.total) * 100}%`, background: '#dc2626', minWidth: 2 }} />}
                </div>
              </div>
            ))}
            {monthlyTimeline.length === 0 && (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>No records yet</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>AI Insights</h3>
          {longitudinalLoading ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>Analyzing patterns...</p>
          ) : longitudinal?.insights && longitudinal.insights.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: 20 }}>📊</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', margin: 0 }}>Overall Rate</p>
                  <p style={{ fontSize: 12, color: '#15803d', margin: 0 }}>{longitudinal.attendanceRate}% attendance rate across {longitudinal.totalRecords} records</p>
                </div>
              </div>
              {(longitudinal.insights as string[]).map((insight, i) => {
                const isPositive = insight.toLowerCase().includes('excellent') || insight.toLowerCase().includes('improved');
                const isWarning = insight.toLowerCase().includes('critical') || insight.toLowerCase().includes('drop') || insight.toLowerCase().includes('concern');
                const bg = isPositive ? '#f0fdf4' : isWarning ? '#fef2f2' : '#fffbeb';
                const border = isPositive ? '#bbf7d0' : isWarning ? '#fecaca' : '#fde68a';
                const textColor = isPositive ? '#166534' : isWarning ? '#991b1b' : '#92400e';
                return (
                  <div key={i} className="insight-item" style={{ padding: '10px 14px', background: bg, borderRadius: 8, border: `1px solid ${border}` }}>
                    <p style={{ fontSize: 13, color: textColor, margin: 0 }}>{insight}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: 20 }}>📊</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', margin: 0 }}>Summary</p>
                  <p style={{ fontSize: 12, color: '#15803d', margin: 0 }}>Total: {summary?.total || 0} records, Rate: {summary?.attendanceRate || 0}%</p>
                </div>
              </div>
            </div>
          )}
          {longitudinal?.trend && longitudinal.trend.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Monthly Trend</p>
              <div style={{ display: 'flex', gap: 2, alignItems: 'end', height: 60 }}>
                {(longitudinal.trend as Array<{ month: string; rate: number }>).map((t, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{
                      width: '100%', height: `${t.rate}%`, minHeight: 4,
                      background: t.rate >= 90 ? '#059669' : t.rate >= 75 ? '#ea580c' : '#dc2626',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.5s ease',
                    }} />
                    <span style={{ fontSize: 9, color: '#9ca3af', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                      {new Date(t.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Punctuality Analysis</h3>
          {lateRecords.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>Total Late Arrivals</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: '#ea580c', margin: 0 }}>{lateRecords.length}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>Late % of Total</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: '#374151', margin: 0 }}>
                    {summary?.total > 0 ? Math.round((lateRecords.length / summary.total) * 100) : 0}%
                  </p>
                </div>
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table className="profile-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Date</th>
                      <th style={{ textAlign: 'left' }}>Subject</th>
                      <th style={{ textAlign: 'center' }}>Late (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lateRecords.slice(0, 20).map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ color: '#374151' }}>{new Date(r.date).toLocaleDateString()}</td>
                        <td style={{ color: '#6b7280' }}>{r.slot?.subject?.name || '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#ea580c' }}>{r.lateMinutes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: 36, margin: '0 0 8px' }}>🕐</p>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>No late arrivals recorded</p>
              <p style={{ color: '#d1d5db', fontSize: 12 }}>Perfect punctuality record</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Recent Attendance Records</h3>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table className="profile-table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Date</th>
                <th style={{ textAlign: 'left' }}>Subject</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'left' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.slice(0, 50).map((r: any) => (
                <tr key={r.id}>
                  <td style={{ color: '#374151' }}>{new Date(r.date).toLocaleDateString()}</td>
                  <td style={{ color: '#6b7280' }}>{r.slot?.subject?.name || 'General'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      color: STATUS_COLORS[r.status] ? 'white' : '#6b7280',
                      background: STATUS_COLORS[r.status] || '#f3f4f6',
                    }}>{STATUS_LABELS[r.status] || r.status}</span>
                  </td>
                  <td style={{ color: '#9ca3af', fontSize: 12 }}>{r.remarks || '-'}</td>
                </tr>
              ))}
              {sortedRecords.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No attendance records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
