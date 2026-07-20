'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { openAnalysisReport, AnalysisData, ReportMeta } from '@/lib/report-utils';

export default function AnalysisPage() {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [sheetInfo, setSheetInfo] = useState<any>(null);
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

  const { data: allTerms } = useQuery({
    queryKey: ['all-terms'],
    queryFn: async () => {
      const r = await termApi.getAll();
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const examTypes = ['Exam', 'Mid-Term', 'CAT', 'Assignment', 'Project', 'Practical', 'Mock'];

  const loadAnalysis = useCallback(async () => {
    if (!selectedClass || !selectedTerm) {
      toast.error('Please select class and term');
      return;
    }
    setLoading(true);
    try {
      const params: any = { classId: selectedClass, termId: selectedTerm };
      if (selectedExamType) params.examType = selectedExamType;
      const r = await api.get('/results-management/sheets', { params });
      const sheets = r.data?.data || r.data;
      const sheetArr = Array.isArray(sheets) ? sheets : [];
      if (sheetArr.length === 0) {
        toast.error('No result sheet found for this selection');
        setLoading(false);
        return;
      }
      const sheetId = sheetArr[sheetArr.length - 1].id;
      const ar = await api.get(`/results-management/sheets/${sheetId}/analysis`);
      const analysisData = ar.data?.data || ar.data;
      setAnalysis(analysisData);
      setSheetInfo(sheetArr[sheetArr.length - 1]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedTerm, selectedExamType]);

  const getGradeColor = (pct: number) => {
    if (pct >= 75) return '#059669';
    if (pct >= 65) return '#3b82f6';
    if (pct >= 50) return '#d97706';
    if (pct >= 40) return '#ea580c';
    return '#dc2626';
  };

  const gradeDistribution = useMemo(() => {
    if (analysis?.gradeDistribution && Object.keys(analysis.gradeDistribution).length > 0) {
      return Object.entries(analysis.gradeDistribution).map(([grade, count]) => ({ grade, count: count as number }));
    }
    if (!analysis?.students) return [];
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    analysis.students.forEach((s: any) => {
      if (s.grade) {
        dist[s.grade] = (dist[s.grade] || 0) + 1;
        return;
      }
      const pct = s.percentage || s.totalPercentage || 0;
      if (pct >= 75) dist.A++;
      else if (pct >= 65) dist.B++;
      else if (pct >= 50) dist.C++;
      else if (pct >= 40) dist.D++;
      else dist.E++;
    });
    return Object.entries(dist).map(([grade, count]) => ({ grade, count }));
  }, [analysis]);

  const maxGradeCount = useMemo(() => Math.max(...gradeDistribution.map(g => g.count), 1), [gradeDistribution]);

  const atRiskStudents = useMemo(() => {
    if (!analysis?.students) return [];
    return analysis.students
      .filter((s: any) => (s.percentage || s.totalPercentage || s.avgPercentage || 0) < 40)
      .sort((a: any, b: any) => (a.percentage || a.totalPercentage || a.avgPercentage || 0) - (b.percentage || b.totalPercentage || b.avgPercentage || 0));
  }, [analysis]);

  const subjectBreakdown = useMemo(() => {
    if (!analysis?.subjectAnalysis && !analysis?.subjects && !analysis?.subjectStats) return [];
    return analysis.subjectAnalysis || analysis.subjects || analysis.subjectStats || [];
  }, [analysis]);

  const summaryCards = useMemo(() => {
    if (!analysis) return [];
    return [
      { label: 'Total Students', value: analysis.totalStudents || analysis.studentCount || 0, icon: 'fa-users', color: '#3b82f6', bg: '#eff6ff' },
      { label: 'Pass Rate', value: analysis.passRate != null ? `${analysis.passRate.toFixed(1)}%` : '0%', icon: 'fa-check-circle', color: '#059669', bg: '#d1fae5' },
      { label: 'Average %', value: analysis.averagePercentage != null ? `${analysis.averagePercentage.toFixed(1)}%` : '0%', icon: 'fa-chart-line', color: '#ea6645', bg: '#fff5f3' },
      { label: 'Distinction Rate', value: analysis.distinctionRate != null ? `${analysis.distinctionRate.toFixed(1)}%` : '0%', icon: 'fa-star', color: '#7c3aed', bg: '#f3e8ff' },
      { label: 'At Risk', value: analysis.atRiskCount || atRiskStudents.length, icon: 'fa-exclamation-triangle', color: '#dc2626', bg: '#fee2e2' },
    ];
  }, [analysis, atRiskStudents]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Analysis</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
            Performance analytics and insights for class results
          </p>
        </div>
        {analysis && (
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
              openAnalysisReport(analysis as AnalysisData, meta);
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
        padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end'
      }}>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Class *</label>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
          >
            <option value="">Select Class</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Term *</label>
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
          >
            <option value="">Select Term</option>
            {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '140px' }}>
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
            onClick={loadAnalysis}
            disabled={!selectedClass || !selectedTerm || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 24px', fontSize: '14px', fontWeight: 600, color: 'white',
              background: !selectedClass || !selectedTerm ? '#d1d5db' : '#ea6645',
              border: 'none', borderRadius: '8px', cursor: !selectedClass || !selectedTerm ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? <><i className="fa fa-spinner fa-spin"></i> Loading...</> : <><i className="fa fa-chart-bar"></i> Load Analysis</>}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', color: '#ea6645' }}></i>
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Computing analysis...</p>
        </div>
      ) : analysis ? (
        <div>
          {/* Summary Cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px', marginBottom: '24px'
          }}>
            {summaryCards.map(card => (
              <div key={card.label} style={{
                background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
                padding: '20px', display: 'flex', alignItems: 'center', gap: '14px'
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: card.color, fontSize: '20px', flexShrink: 0
                }}>
                  <i className={`fa ${card.icon}`}></i>
                </div>
                <div>
                  <p style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{card.value}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Grade Distribution Chart */}
          <div style={{
            background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
            padding: '24px', marginBottom: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>
              <i className="fa fa-chart-bar" style={{ color: '#ea6645', marginRight: '8px' }}></i>
              Grade Distribution
            </h3>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', height: '160px' }}>
              {gradeDistribution.map(g => {
                const height = (g.count / maxGradeCount) * 100;
                const barColor = g.grade === 'A' ? '#059669' : g.grade === 'B' ? '#3b82f6' : g.grade === 'C' ? '#d97706' : g.grade === 'D' ? '#ea580c' : '#dc2626';
                return (
                  <div key={g.grade} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>{g.count}</span>
                    <div style={{
                      width: '100%', maxWidth: '80px', height: `${Math.max(height, 8)}%`,
                      background: `linear-gradient(to top, ${barColor}, ${barColor}dd)`,
                      borderRadius: '8px 8px 0 0', transition: 'height 0.5s',
                      boxShadow: `0 2px 8px ${barColor}44`
                    }}></div>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: barColor }}>{g.grade}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subject Breakdown */}
          {subjectBreakdown.length > 0 && (
            <div style={{
              background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
              overflow: 'hidden', marginBottom: '24px'
            }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e8ddd0' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                  <i className="fa fa-book" style={{ color: '#ea6645', marginRight: '8px' }}></i>
                  Subject Breakdown
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5efe8' }}>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Subject</th>
                      <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Class Avg</th>
                      <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Highest</th>
                      <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Lowest</th>
                      <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Pass Rate</th>
                      <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Distinction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectBreakdown.map((subj: any, idx: number) => (
                      <tr key={subj.subjectId || subj.subjectName || idx} style={{
                        borderBottom: '1px solid #e8ddd0',
                        background: idx % 2 === 0 ? '#fefcf9' : '#faf7f4'
                      }}>
                        <td style={{ padding: '12px 20px', fontWeight: 600, color: '#1f2937' }}>
                          {subj.subjectName || subj.subject?.name || 'Subject'}
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 600, color: getGradeColor(subj.average || subj.classAverage || 0) }}>
                          {(subj.average || subj.classAverage || 0).toFixed(1)}
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 600, color: '#059669' }}>
                          {(subj.highest || subj.max || subj.maxScore || 0).toFixed ? (subj.highest || subj.max || subj.maxScore || 0).toFixed(1) : (subj.highest || subj.max || subj.maxScore || 0)}
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 600, color: '#dc2626' }}>
                          {(subj.lowest || subj.min || subj.minScore || 0).toFixed ? (subj.lowest || subj.min || subj.minScore || 0).toFixed(1) : (subj.lowest || subj.min || subj.minScore || 0)}
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                            background: (subj.passRate || 0) >= 70 ? '#d1fae5' : (subj.passRate || 0) >= 40 ? '#fef3c7' : '#fee2e2',
                            color: (subj.passRate || 0) >= 70 ? '#059669' : (subj.passRate || 0) >= 40 ? '#d97706' : '#dc2626'
                          }}>
                            {(subj.passRate || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                            background: '#f3e8ff', color: '#7c3aed'
                          }}>
                            {(subj.distinctionRate || 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* At-Risk Students */}
          {atRiskStudents.length > 0 && (
            <div style={{
              background: '#fff5f3', border: '1px solid #fecaca', borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa fa-exclamation-triangle" style={{ color: '#dc2626', fontSize: '18px' }}></i>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#dc2626', margin: 0 }}>
                  At-Risk Students ({atRiskStudents.length})
                </h3>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  Students scoring below 40%
                </span>
              </div>
              <div style={{ padding: '16px 24px' }}>
                {atRiskStudents.slice(0, 20).map((student: any, idx: number) => (
                  <div key={student.studentId || student.id || idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: idx < Math.min(atRiskStudents.length, 20) - 1 ? '1px solid #fecaca' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13px', color: '#9ca3af', width: '24px' }}>{idx + 1}.</span>
                      <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '14px' }}>
                        {student.firstName} {student.lastName}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        ({student.admissionNumber || student.admissionNo || 'N/A'})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
                        background: '#fee2e2', color: '#dc2626'
                      }}>
                        {(student.percentage || student.totalPercentage || student.avgPercentage || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
                {atRiskStudents.length > 20 && (
                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '12px' }}>
                    +{atRiskStudents.length - 20} more at-risk students
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '60px', textAlign: 'center'
        }}>
          <i className="fa fa-chart-pie" style={{ fontSize: '48px', color: '#e8ddd0', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>No Analysis Data</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            Select a class and term, then click "Load Analysis"
          </p>
        </div>
      )}
    </div>
  );
}
