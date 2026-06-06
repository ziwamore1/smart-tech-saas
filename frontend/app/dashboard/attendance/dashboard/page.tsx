'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi, classApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const STATUS_COLORS: Record<string, string> = {
  PRESENT: '#059669',
  ABSENT: '#dc2626',
  LATE: '#ea580c',
  EXCUSED: '#2563eb',
  SICK: '#ca8a04',
  SUSPENDED: '#6b7280',
  ACTIVITY: '#7c3aed',
  PARTIAL_ATTENDANCE: '#0d9488',
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  EXCUSED: 'Excused',
  SICK: 'Sick',
  SUSPENDED: 'Suspended',
  ACTIVITY: 'Activity',
  PARTIAL_ATTENDANCE: 'Partial',
};

export default function AttendanceDashboardPage() {
  const { user } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.classes) data = data.classes;
      if (data?.result) data = data.result;
      return Array.isArray(data) ? data : [];
    },
  });

  const classes = useMemo(() => {
    return Array.isArray(classesData) ? classesData : [];
  }, [classesData]);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['attendance-stats-dash', selectedClassId, startDate, endDate],
    queryFn: async () => {
      const res = await attendanceApi.getStats({ classId: selectedClassId || undefined, startDate, endDate });
      return res.data?.data || res.data || {};
    },
  });

  const { data: calendarData } = useQuery({
    queryKey: ['attendance-calendar-dash', startDate, endDate, selectedClassId],
    queryFn: async () => {
      const res = await attendanceApi.getCalendar({ startDate, endDate, classId: selectedClassId || undefined });
      return res.data?.data || res.data || [];
    },
  });

  const { data: heatmapData } = useQuery({
    queryKey: ['attendance-heatmap-dash', selectedClassId, startDate, endDate],
    queryFn: async () => {
      if (!selectedClassId) return [];
      const res = await attendanceApi.getAttendanceHeatmap(selectedClassId, startDate, endDate);
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedClassId,
  });

  const { data: chronicData } = useQuery({
    queryKey: ['chronic-absenteeism-dash', 80],
    queryFn: async () => {
      const res = await attendanceApi.getChronicAbsenteeismReport({ threshold: 80 });
      return res.data?.data || res.data || {};
    },
  });

  const calendarSummary = useMemo(() => {
    if (!calendarData || !Array.isArray(calendarData)) return [];
    const byDate: Record<string, { total: number; present: number; absent: number; late: number }> = {};
    const records = calendarData as Array<{ date: string; status: string; count: number }>;
    for (const r of records) {
      const d = new Date(r.date).toISOString().split('T')[0];
      if (!byDate[d]) byDate[d] = { total: 0, present: 0, absent: 0, late: 0 };
      byDate[d].total += r.count;
      if (r.status === 'PRESENT') byDate[d].present += r.count;
      else if (r.status === 'ABSENT') byDate[d].absent += r.count;
      else if (r.status === 'LATE') byDate[d].late += r.count;
    }
    return Object.entries(byDate)
      .map(([date, data]) => ({ date, ...data, rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [calendarData]);

  const stats = statsData as Record<string, any>;

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingBottom: 40 }}>
      <style>{`
        .card-hover { transition: all 0.2s ease; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.08); }
        .progress-bar { transition: width 0.8s ease; }
        .dash-table { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
        .dash-table th { border-bottom: 2px solid #d1d5db; background: #f3f4f6; color: #374151; }
        .dash-table td, .dash-table th { border-right: 1px solid #e8ddd0; padding: 8px 12px; }
        .dash-table td:last-child, .dash-table th:last-child { border-right: none; }
        .dash-table tr { border-bottom: 1px solid #e8ddd0; }
        .dash-table tr:last-child { border-bottom: none; }
      `}</style>

      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1f2937', margin: 0 }}>Attendance Dashboard</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '4px 0 0' }}>Analytics and insights</p>
        </div>
      </div>

      <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ minWidth: 200, flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Class</label>
            <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fefcf9' }}
            >
              <option value="">All Classes</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}{c.stream ? ` - ${c.stream}` : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
            />
          </div>
        </div>
      </div>

      {statsLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading analytics...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Overall Attendance', value: `${stats?.attendanceRate || 0}%`, color: '#059669', sub: `${stats?.present || 0} present out of ${stats?.total || 0}` },
              { label: 'Total Records', value: stats?.total || 0, color: '#3b82f6', sub: 'Attendance entries' },
              { label: 'Absences', value: stats?.absent || 0, color: '#dc2626', sub: `${stats?.totalAbsent || 0} total absent records` },
              { label: 'Late Arrivals', value: stats?.late || 0, color: '#ea580c', sub: `${stats?.totalLate || 0} total late records` },
              { label: 'Sick / Excused', value: (stats?.sick || 0) + (stats?.excused || 0), color: '#ca8a04', sub: `${stats?.sick || 0} sick, ${stats?.excused || 0} excused` },
              { label: 'Chronic Absenteeism', value: chronicData?.totalAtRisk || 0, color: '#7c3aed', sub: `${chronicData?.atRiskPercentage || 0}% of enrolled students` },
            ].map(card => (
              <div key={card.label} className="card-hover" style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: '20px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 8px' }}>{card.label}</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: card.color, margin: 0 }}>{card.value}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>{card.sub}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Status Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(STATUS_COLORS).map(([status, color]) => {
                  const count = stats?.[status.toLowerCase()] || 0;
                  const total = stats?.total || 1;
                  const pct = Math.round((count / total) * 100);
                  if (count === 0) return null;
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, color: '#374151' }}>{STATUS_LABELS[status]}</span>
                        <span style={{ fontWeight: 600, color }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div className="progress-bar" style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Daily Attendance Trend</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                {calendarSummary.slice(-30).map((day: any) => (
                  <div key={day.date} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ minWidth: 60, color: '#6b7280', fontWeight: 500 }}>{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ height: '100%', width: `${day.rate}%`, background: '#059669', minWidth: day.present > 0 ? 2 : 0 }} title={`Present: ${day.present}`} />
                      {day.late > 0 && <div style={{ height: '100%', width: `${Math.round((day.late / day.total) * 100)}%`, background: '#ea580c', minWidth: 2 }} title={`Late: ${day.late}`} />}
                      {day.absent > 0 && <div style={{ height: '100%', width: `${Math.round((day.absent / day.total) * 100)}%`, background: '#dc2626', minWidth: 2 }} title={`Absent: ${day.absent}`} />}
                    </div>
                    <span style={{ minWidth: 30, textAlign: 'right', fontWeight: 600, color: day.rate >= 90 ? '#059669' : day.rate >= 75 ? '#ea580c' : '#dc2626' }}>{day.rate}%</span>
                  </div>
                ))}
                {calendarSummary.length === 0 && (
                  <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>No attendance data for this period</p>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Student Attendance Heatmap</h3>
              {heatmapData && heatmapData.length > 0 ? (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table className="dash-table" style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Student</th>
                        <th style={{ textAlign: 'center', color: '#059669' }} title="Present">P</th>
                        <th style={{ textAlign: 'center', color: '#dc2626' }} title="Absent">A</th>
                        <th style={{ textAlign: 'center', color: '#ea580c' }} title="Late">L</th>
                        <th style={{ textAlign: 'center', color: '#2563eb' }} title="Excused">E</th>
                        <th style={{ textAlign: 'center', color: '#ca8a04' }} title="Sick">S</th>
                        <th style={{ textAlign: 'center', color: '#7c3aed' }} title="Activity">Act</th>
                        <th style={{ textAlign: 'center', color: '#0d9488' }} title="Partial">Part</th>
                        <th style={{ textAlign: 'center', color: '#6b7280' }} title="Suspended">Sus</th>
                        <th style={{ textAlign: 'center' }}>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(heatmapData as Array<{ student: any; attendance: Record<string, number> }>).map((entry: any) => {
                        const att = entry.attendance || {};
                        const total = Object.values(att).reduce((s: number, v: any) => s + v, 0);
                        const present = att.PRESENT || 0;
                        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                        return (
                          <tr key={entry.student?.id}>
                            <td style={{ fontWeight: 500, color: '#374151', whiteSpace: 'nowrap' }}>
                              {entry.student?.firstName} {entry.student?.lastName}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#059669' }}>{att.PRESENT || 0}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#dc2626' }}>{att.ABSENT || 0}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#ea580c' }}>{att.LATE || 0}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#2563eb' }}>{att.EXCUSED || 0}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#ca8a04' }}>{att.SICK || 0}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#7c3aed' }}>{att.ACTIVITY || 0}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#0d9488' }}>{att.PARTIAL_ATTENDANCE || 0}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>{att.SUSPENDED || 0}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                                color: rate >= 90 ? '#059669' : rate >= 75 ? '#ea580c' : '#dc2626',
                                background: rate >= 90 ? '#f0fdf4' : rate >= 75 ? '#fff7ed' : '#fef2f2',
                              }}>{rate}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
                  {selectedClassId ? 'No data available' : 'Select a class to view heatmap'}
                </p>
              )}
            </div>

            <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Chronic Absenteeism</h3>
              {chronicData?.students && chronicData.students.length > 0 ? (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table className="dash-table" style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Student</th>
                        <th style={{ textAlign: 'left' }}>Class</th>
                        <th style={{ textAlign: 'center' }}>Rate</th>
                        <th style={{ textAlign: 'center' }}>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(chronicData.students as Array<any>).slice(0, 50).map((s: any) => (
                        <tr key={s.studentId}>
                          <td style={{ fontWeight: 500, color: '#374151' }}>{s.studentName}</td>
                          <td style={{ color: '#6b7280' }}>{s.className}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: s.attendanceRate < 60 ? '#dc2626' : s.attendanceRate < 75 ? '#ea580c' : '#ca8a04' }}>{s.attendanceRate}%</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                              color: s.riskLevel === 'CRITICAL' ? '#dc2626' : s.riskLevel === 'HIGH' ? '#ea580c' : '#ca8a04',
                              background: s.riskLevel === 'CRITICAL' ? '#fef2f2' : s.riskLevel === 'HIGH' ? '#fff7ed' : '#fefce8',
                            }}>{s.riskLevel}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
                  {chronicData?.totalAtRisk === 0 ? 'No students below 80% attendance threshold' : 'Loading...'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
