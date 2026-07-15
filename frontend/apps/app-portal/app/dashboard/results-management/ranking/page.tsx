'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { openRankingReport, RankingStudent, ReportMeta } from '@/lib/report-utils';

type RankingType = 'class' | 'subject' | 'gender';

export default function RankingPage() {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('Exam');
  const [rankingType, setRankingType] = useState<RankingType>('class');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [showLimit, setShowLimit] = useState<'all' | 'top10' | 'bottom10'>('all');
  const [searchStudent, setSearchStudent] = useState('');
  const [rankings, setRankings] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const r = await classApi.getAll();
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const classes = useMemo(() => Array.isArray(classesData) ? classesData : [], [classesData]);

  const { data: termsData } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const r = await termApi.getAll();
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const terms = useMemo(() => Array.isArray(termsData) ? termsData : [], [termsData]);

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const r = await api.get('/subject');
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const subjects = useMemo(() => Array.isArray(subjectsData) ? subjectsData : [], [subjectsData]);

  const examTypes = ['Exam', 'Mid-Term', 'CAT', 'Assignment', 'Project', 'Practical', 'Mock'];

  const computeRankings = useCallback(async () => {
    if (!selectedClass || !selectedTerm) {
      toast.error('Please select class and term');
      return;
    }
    setLoading(true);
    try {
      const r = await api.get('/results-management/sheets', {
        params: { classId: selectedClass, termId: selectedTerm, examType: selectedExamType }
      });
      const sheets = r.data?.data || r.data;
      const sheetArr = Array.isArray(sheets) ? sheets : [];
      if (sheetArr.length === 0) {
        toast.error('No result sheet found');
        setLoading(false);
        return;
      }
      const sheetId = sheetArr[sheetArr.length - 1].id;
      const rr = await api.get(`/results-management/sheets/${sheetId}/rankings`, {
        params: { type: rankingType }
      });
      const rankData = rr.data?.data || rr.data;
      setRankings(rankData);
      toast.success('Rankings computed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to compute rankings');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedTerm, selectedExamType, rankingType]);

  const filteredRankings = useMemo(() => {
    if (!rankings?.students && !rankings?.rankings) return [];
    const list = rankings.students || rankings.rankings || [];
    let filtered = [...list];

    if (searchStudent) {
      const q = searchStudent.toLowerCase();
      filtered = filtered.filter((s: any) =>
        (s.firstName?.toLowerCase() || '').includes(q) ||
        (s.lastName?.toLowerCase() || '').includes(q) ||
        (s.admissionNumber?.toLowerCase() || '').includes(q) ||
        (s.name?.toLowerCase() || '').includes(q)
      );
    }

    if (showLimit === 'top10') {
      filtered = filtered.slice(0, 10);
    } else if (showLimit === 'bottom10') {
      filtered = filtered.slice(Math.max(0, filtered.length - 10));
    }

    return filtered;
  }, [rankings, searchStudent, showLimit]);

  const getGradeColor = (pct: number) => {
    if (pct >= 75) return '#059669';
    if (pct >= 65) return '#3b82f6';
    if (pct >= 50) return '#d97706';
    if (pct >= 40) return '#ea580c';
    return '#dc2626';
  };

  const getGrade = (item: any) => {
    if (item?.grade) return item.grade;
    const pct = typeof item === 'number' ? item : (item?.percentage || 0);
    if (pct >= 75) return 'A';
    if (pct >= 65) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'E';
  };

  const gradeDistribution = useMemo(() => {
    if (!filteredRankings.length) return [];
    const dist: Record<string, number> = {};
    filteredRankings.forEach((s: any) => {
      const g = getGrade(s);
      dist[g] = (dist[g] || 0) + 1;
    });
    return Object.entries(dist).map(([grade, count]) => ({ grade, count }));
  }, [filteredRankings]);

  const maxGradeCount = useMemo(() =>
    Math.max(...gradeDistribution.map(g => g.count), 1),
  [gradeDistribution]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Rankings</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
            View student rankings by class, subject, or gender
          </p>
        </div>
        {filteredRankings.length > 0 && (
          <button
            onClick={() => {
              const cls = classes.find((c: any) => c.id === selectedClass);
              const term = terms.find((t: any) => t.id === selectedTerm);
              const meta: ReportMeta = {
                schoolName: user?.schoolName || (user as any)?.school?.name || 'Smart Tech School',
                className: cls?.name || 'Class',
                termName: term?.name || 'Term',
                academicYear: term?.academicYear?.name || '',
                examType: selectedExamType,
              };
              const rankStudents: RankingStudent[] = filteredRankings.map((s: any, i: number) => ({
                firstName: s.firstName || s.name?.split(' ')[0] || '',
                lastName: s.lastName || s.name?.split(' ').slice(1).join(' ') || '',
                admissionNumber: s.admissionNumber || '',
                gender: s.gender || '',
                average: s.percentage || s.average || s.totalPercentage || 0,
                grade: s.grade || null,
                rank: s.rank || i + 1,
                totalPoints: s.totalPoints || undefined,
              }));
              openRankingReport(rankStudents, meta, `Rankings - ${rankingType.charAt(0).toUpperCase() + rankingType.slice(1)}`);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', fontSize: '14px', fontWeight: 600, color: 'white',
              background: '#5f4b3a', border: 'none', borderRadius: '8px', cursor: 'pointer'
            }}
          >
            <i className="fa fa-print"></i> Print Report
          </button>
        )}
      </div>

      {/* Controls */}
      <div style={{
        background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
        padding: '20px', marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginBottom: '16px' }}>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Class *</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
            >
              <option value="">Select</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Term *</label>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
            >
              <option value="">Select</option>
              {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '1', minWidth: '120px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Exam Type</label>
            <select
              value={selectedExamType}
              onChange={e => setSelectedExamType(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
            >
              {examTypes.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
          </div>
          <div>
            <button
              onClick={computeRankings}
              disabled={!selectedClass || !selectedTerm || loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 24px', fontSize: '14px', fontWeight: 600, color: 'white',
                background: !selectedClass || !selectedTerm ? '#d1d5db' : '#ea6645',
                border: 'none', borderRadius: '8px', cursor: !selectedClass || !selectedTerm ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? <><i className="fa fa-spinner fa-spin"></i> Computing...</> : <><i className="fa fa-trophy"></i> Compute Rankings</>}
            </button>
          </div>
        </div>

        {/* Ranking type tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {([
            { key: 'class' as RankingType, label: 'Class Ranking', icon: 'fa-users' },
            { key: 'subject' as RankingType, label: 'Subject Ranking', icon: 'fa-book' },
            { key: 'gender' as RankingType, label: 'Gender Ranking', icon: 'fa-venus-mars' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setRankingType(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                borderRadius: '8px', border: rankingType === tab.key ? '2px solid #ea6645' : '1px solid #e8ddd0',
                background: rankingType === tab.key ? '#fff5f3' : '#fefcf9',
                color: rankingType === tab.key ? '#ea6645' : '#6b7280', cursor: 'pointer'
              }}
            >
              <i className={`fa ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {rankingType === 'subject' && (
          <div style={{ marginTop: '12px' }}>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              style={{ width: '100%', maxWidth: '300px', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
            >
              <option value="">Select Subject</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Results */}
      {rankings && (
        <>
          {/* View toggles */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['all', 'top10', 'bottom10'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setShowLimit(opt)}
                  style={{
                    padding: '6px 16px', fontSize: '13px', fontWeight: 500,
                    borderRadius: '20px', border: showLimit === opt ? '2px solid #ea6645' : '1px solid #e8ddd0',
                    background: showLimit === opt ? '#fff5f3' : '#fefcf9',
                    color: showLimit === opt ? '#ea6645' : '#6b7280', cursor: 'pointer'
                  }}
                >
                  {opt === 'all' ? 'All Students' : opt === 'top10' ? 'Top 10' : 'Bottom 10'}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <i className="fa fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}></i>
              <input
                value={searchStudent}
                onChange={e => setSearchStudent(e.target.value)}
                placeholder="Search student..."
                style={{
                  padding: '8px 14px 8px 36px', fontSize: '13px', border: '1px solid #e8ddd0',
                  borderRadius: '8px', background: '#fefcf9', width: '220px'
                }}
              />
            </div>
          </div>

          {/* Grade distribution bar chart */}
          {filteredRankings.length > 0 && (
            <div style={{
              background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
              padding: '20px', marginBottom: '20px'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 16px' }}>
                <i className="fa fa-chart-bar" style={{ marginRight: '8px', color: '#ea6645' }}></i>
                Grade Distribution
              </h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '120px' }}>
                {gradeDistribution.map(g => {
                  const height = (g.count / maxGradeCount) * 100;
                  const barColor = g.grade === 'A' ? '#059669' : g.grade === 'B' ? '#3b82f6' : g.grade === 'C' ? '#d97706' : g.grade === 'D' ? '#ea580c' : '#dc2626';
                  return (
                    <div key={g.grade} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{g.count}</span>
                      <div style={{
                        width: '100%', maxWidth: '60px', height: `${Math.max(height, 4)}%`,
                        background: barColor, borderRadius: '6px 6px 0 0',
                        transition: 'height 0.5s', minHeight: '8px'
                      }}></div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: barColor }}>{g.grade}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ranking table */}
          <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#5f4b3a', color: 'white' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>#</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Admission No</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Student Name</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Total</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>%</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Grade</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Prev Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRankings.map((student: any, idx: number) => {
                    const prevRank = student.previousRank || student.prevRank;
                    const rankChange = prevRank ? (student.rank || idx + 1) - prevRank : null;
                    return (
                      <tr key={student.id || student.studentId || idx} style={{
                        borderBottom: '1px solid #e8ddd0',
                        background: student.isCurrentUser || (searchStudent && (
                          `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchStudent.toLowerCase())
                        )) ? '#fffbeb' : idx % 2 === 0 ? '#fefcf9' : '#faf7f4'
                      }}>
                        <td style={{
                          padding: '12px 16px', textAlign: 'center', fontWeight: 700,
                          color: (student.rank || idx + 1) <= 3 ? '#ea6645' : '#374151'
                        }}>
                          {student.rank || idx + 1}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }}>
                          {student.admissionNumber || student.admissionNo || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1f2937' }}>
                          {student.firstName} {student.lastName}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>
                          {student.total || student.totalScore || 0}
                        </td>
                        <td style={{
                          padding: '12px 16px', textAlign: 'center', fontWeight: 700,
                          color: getGradeColor(student.percentage || student.totalPercentage || 0)
                        }}>
                          {(student.percentage || student.totalPercentage || 0).toFixed(1)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 700,
                            color: 'white',
                            background: getGradeColor(student.percentage || student.totalPercentage || 0)
                          }}>
                            {getGrade(student)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {prevRank ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px',
                              color: rankChange && rankChange < 0 ? '#059669' : rankChange && rankChange > 0 ? '#dc2626' : '#6b7280'
                            }}>
                              {prevRank}
                              {rankChange !== null && rankChange !== 0 && (
                                <i className={`fa fa-chevron-${rankChange < 0 ? 'up' : 'down'}`} style={{ fontSize: '11px' }}></i>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: '#d1d5db' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRankings.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                        {searchStudent ? 'No students match your search' : 'No ranking data available'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!rankings && !loading && (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '60px', textAlign: 'center'
        }}>
          <i className="fa fa-trophy" style={{ fontSize: '48px', color: '#e8ddd0', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>No Rankings Yet</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            Select a class and term, then click "Compute Rankings"
          </p>
        </div>
      )}
    </div>
  );
}
