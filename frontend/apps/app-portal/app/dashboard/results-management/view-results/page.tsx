'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import {
  openMarkScheduleReport, openAnalysisReport, openRankingReport,
  ReportStudent, ReportMeta, AnalysisData, RankingStudent,
} from '@/lib/report-utils';

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#6b7280', label: 'Draft' },
  SUBMITTED: { bg: '#dbeafe', color: '#2563eb', label: 'Submitted' },
  VERIFIED: { bg: '#d1fae5', color: '#059669', label: 'Verified' },
  PUBLISHED: { bg: '#f3e8ff', color: '#7c3aed', label: 'Published' },
  LOCKED: { bg: '#fee2e2', color: '#dc2626', label: 'Locked' },
};

export default function ViewResultsPage() {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'summary'>('table');
  const [sortField, setSortField] = useState<'name' | 'average' | 'grade' | 'rank'>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

  const { data: sheetData, isLoading: sheetLoading } = useQuery({
    queryKey: ['view-results-sheet', selectedClass, selectedTerm, selectedExamType],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return null;
      const params: any = { classId: selectedClass, termId: selectedTerm };
      if (selectedExamType) params.examType = selectedExamType;
      const r = await api.get('/results-management/sheets', { params });
      const sheets = r.data?.data || r.data;
      const sheetArr = Array.isArray(sheets) ? sheets : [];
      return sheetArr.length > 0 ? sheetArr[0] : null;
    },
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['view-results-students', sheetData?.id],
    queryFn: async () => {
      if (!sheetData?.id) return [];
      const r = await api.get(`/results-management/sheets/${sheetData.id}/students`);
      let d = r.data?.data || r.data;
      if (d && !Array.isArray(d) && d.students) d = d.students;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!sheetData?.id,
  });

  const { data: analysisData } = useQuery({
    queryKey: ['view-results-analysis', sheetData?.id],
    queryFn: async () => {
      if (!sheetData?.id) return null;
      const r = await api.get(`/results-management/sheets/${sheetData.id}/analysis`);
      return r.data?.data || r.data;
    },
    enabled: !!sheetData?.id,
  });

  const { data: rankingData } = useQuery({
    queryKey: ['view-results-rankings', sheetData?.id],
    queryFn: async () => {
      if (!sheetData?.id) return null;
      const r = await api.get(`/results-management/sheets/${sheetData.id}/rankings`);
      return r.data?.data || r.data;
    },
    enabled: !!sheetData?.id,
  });

  const students = useMemo(() => {
    if (!Array.isArray(studentsData)) return [];
    return studentsData.map((s: any) => {
      const results = (s.results || []).map((r: any) => ({
        subject: r.subject?.name || r.subjectName || 'Subject',
        score: r.score ?? null,
        grade: r.grade || null,
        remark: r.remark || null,
        maxScore: r.maxScore || 100,
      }));
      const validScores = results.filter((r: any) => r.score != null);
      const avg = validScores.length > 0
        ? validScores.reduce((sum: number, r: any) => sum + r.score, 0) / validScores.length
        : null;
      return {
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNumber: s.admissionNumber,
        gender: s.gender,
        results,
        average: avg,
        grade: s.grade || s.ComputedResult?.finalGrade || null,
        rank: s.ComputedResult?.classRank || s.rank || null,
        totalPoints: s.ComputedResult?.totalPoints || null,
      };
    });
  }, [studentsData]);

  const subjects = useMemo(() => {
    if (students.length === 0) return [];
    const allSubjects = new Set<string>();
    students.forEach((s: ReportStudent) => s.results.forEach(r => allSubjects.add(r.subject)));
    return Array.from(allSubjects);
  }, [students]);

  const sortedStudents = useMemo(() => {
    const sorted = [...students];
    sorted.sort((a, b) => {
      if (sortField === 'name') return `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`);
      if (sortField === 'average') return (a.average || 0) - (b.average || 0);
      if (sortField === 'grade') return (a.grade || 'Z').localeCompare(b.grade || 'Z');
      return (a.rank || 999) - (b.rank || 999);
    });
    if (sortDir === 'desc') sorted.reverse();
    return sorted;
  }, [students, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = students.length;
    const withResults = students.filter(s => s.average != null);
    const avg = withResults.length > 0 ? withResults.reduce((sum, s) => sum + (s.average || 0), 0) / withResults.length : 0;
    const passCount = withResults.filter(s => (s.average || 0) >= 50).length;
    const passRate = total > 0 ? (passCount / total) * 100 : 0;
    const entered = students.reduce((sum, s) => sum + s.results.filter(r => r.score != null).length, 0);
    const totalPossible = students.length * subjects.length;
    return { total, avg, passRate, entered, totalPossible };
  }, [students, subjects]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const buildMeta = useCallback((): ReportMeta => {
    const cls = classes.find((c: any) => c.id === selectedClass);
    const term = terms.find((t: any) => t.id === selectedTerm);
    return {
      schoolName: user?.schoolName || (user as any)?.school?.name || 'Smart Tech School',
      className: cls?.name || 'Class',
      termName: term?.name || 'Term',
      academicYear: term?.academicYear?.name || '',
      examType: selectedExamType,
      classTeacher: cls?.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : undefined,
    };
  }, [selectedClass, selectedTerm, selectedExamType, classes, terms, user]);

  const examTypes = ['Exam', 'Mid-Term', 'CAT', 'Assignment', 'Project', 'Practical', 'Mock'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>View Results</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
            Review entered results, mark schedules, and generate professional reports
          </p>
        </div>
        {students.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => openMarkScheduleReport(students, buildMeta())}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, background: '#5f4b3a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa fa-table"></i> Mark Schedule
            </button>
            <button
              onClick={() => openAnalysisReport(analysisData, buildMeta())}
              disabled={!analysisData}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, background: analysisData ? '#ea6645' : '#d1d5db', color: 'white', border: 'none', borderRadius: '8px', cursor: analysisData ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa fa-chart-bar"></i> Analysis Report
            </button>
            <button
              onClick={() => openRankingReport(rankingData?.rankings || rankingData?.students || [], buildMeta())}
              disabled={!rankingData}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, background: rankingData ? '#059669' : '#d1d5db', color: 'white', border: 'none', borderRadius: '8px', cursor: rankingData ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa fa-trophy"></i> Rankings Report
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{
        background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
        padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end'
      }}>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Class *</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}>
            <option value="">Select Class</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Term *</label>
          <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}>
            <option value="">Select Term</option>
            {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Exam Type</label>
          <select value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}>
            <option value="">All Types</option>
            {examTypes.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setViewMode('table')} style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, background: viewMode === 'table' ? '#5f4b3a' : '#f5efe8', color: viewMode === 'table' ? 'white' : '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            <i className="fa fa-table" style={{ marginRight: '6px' }}></i>Table
          </button>
          <button onClick={() => setViewMode('summary')} style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, background: viewMode === 'summary' ? '#5f4b3a' : '#f5efe8', color: viewMode === 'summary' ? 'white' : '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            <i className="fa fa-chart-pie" style={{ marginRight: '6px' }}></i>Summary
          </button>
        </div>
      </div>

      {/* Sheet Status */}
      {sheetData && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
            background: STATUS_STYLES[sheetData.status]?.bg || '#f3f4f6',
            color: STATUS_STYLES[sheetData.status]?.color || '#6b7280'
          }}>
            {STATUS_STYLES[sheetData.status]?.label || sheetData.status}
          </span>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            {sheetData.title || `${sheetData.class?.name || ''} ${sheetData.examType || ''}`}
          </span>
        </div>
      )}

      {/* Stats Cards */}
      {students.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '18px' }}><i className="fa fa-users"></i></div>
            <div><p style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats.total}</p><p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Students</p></div>
          </div>
          <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontSize: '18px' }}><i className="fa fa-check-circle"></i></div>
            <div><p style={{ fontSize: '20px', fontWeight: 700, color: '#059669', margin: 0 }}>{stats.entered}</p><p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Results Entered</p></div>
          </div>
          <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea6645', fontSize: '18px' }}><i className="fa fa-chart-line"></i></div>
            <div><p style={{ fontSize: '20px', fontWeight: 700, color: '#ea6645', margin: 0 }}>{stats.avg.toFixed(1)}%</p><p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Class Average</p></div>
          </div>
          <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontSize: '18px' }}><i className="fa fa-percentage"></i></div>
            <div><p style={{ fontSize: '20px', fontWeight: 700, color: '#059669', margin: 0 }}>{stats.passRate.toFixed(1)}%</p><p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Pass Rate</p></div>
          </div>
          <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', fontSize: '18px' }}><i className="fa fa-edit"></i></div>
            <div><p style={{ fontSize: '20px', fontWeight: 700, color: '#d97706', margin: 0 }}>{stats.totalPossible}</p><p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Total Cells</p></div>
          </div>
        </div>
      )}

      {/* Loading */}
      {(sheetLoading || studentsLoading) && (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', color: '#ea6645' }}></i>
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Loading results...</p>
        </div>
      )}

      {/* No Selection */}
      {!sheetLoading && !studentsLoading && !selectedClass && (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <i className="fa fa-hand-pointer" style={{ fontSize: '40px', color: '#e8ddd0', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Select Class and Term</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Choose a class, term, and exam type to view results</p>
        </div>
      )}

      {/* No Sheet */}
      {!sheetLoading && !studentsLoading && selectedClass && selectedTerm && !sheetData && (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <i className="fa fa-file-alt" style={{ fontSize: '40px', color: '#e8ddd0', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>No Results Found</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 20px' }}>No result sheet exists for this selection. Enter results first.</p>
          <a href="/dashboard/results-management/result-entry" style={{ display: 'inline-block', padding: '12px 24px', background: '#ea6645', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
            <i className="fa fa-edit" style={{ marginRight: '8px' }}></i>Go to Result Entry
          </a>
        </div>
      )}

      {/* Students Loaded - Empty */}
      {!sheetLoading && !studentsLoading && students.length === 0 && sheetData && (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <i className="fa fa-user-graduate" style={{ fontSize: '40px', color: '#e8ddd0', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>No Students Found</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 20px' }}>No enrolled students found for this class.</p>
          <a href={`/dashboard/results-management/result-entry?sheetId=${sheetData.id}`} style={{ display: 'inline-block', padding: '12px 24px', background: '#ea6645', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
            <i className="fa fa-edit" style={{ marginRight: '8px' }}></i>Enter Results
          </a>
        </div>
      )}

      {/* Results Table */}
      {!sheetLoading && !studentsLoading && students.length > 0 && viewMode === 'table' && (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 420px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#5f4b3a', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ textAlign: 'center', padding: '10px 8px', color: 'white', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', minWidth: '40px' }}>#</th>
                  <th onClick={() => handleSort('name')} style={{ textAlign: 'left', padding: '10px 12px', color: 'white', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', minWidth: '160px' }}>
                    Student {sortField === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: 'white', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', minWidth: '100px' }}>Admission</th>
                  {subjects.map(subj => (
                    <th key={subj} style={{ textAlign: 'center', padding: '10px 8px', color: 'white', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', minWidth: '70px' }}>
                      {subj.length > 10 ? subj.slice(0, 8) + '..' : subj}
                    </th>
                  ))}
                  <th onClick={() => handleSort('average')} style={{ textAlign: 'center', padding: '10px 8px', color: 'white', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', minWidth: '70px', background: '#4a3a2d' }}>
                    Average {sortField === 'average' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('grade')} style={{ textAlign: 'center', padding: '10px 8px', color: 'white', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', minWidth: '50px', background: '#4a3a2d' }}>
                    Grade {sortField === 'grade' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('rank')} style={{ textAlign: 'center', padding: '10px 8px', color: 'white', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', minWidth: '50px', background: '#4a3a2d' }}>
                    Rank {sortField === 'rank' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student: ReportStudent, idx: number) => {
                  const gc = student.grade ? (getGradeColorLocal(student.grade)) : { text: '#9ca3af', bg: '#f3f4f6' };
                  return (
                    <tr key={student.admissionNumber || idx} style={{ background: idx % 2 === 0 ? '#fefcf9' : '#faf7f4', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f5efe8'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fefcf9' : '#faf7f4'}>
                      <td style={{ textAlign: 'center', padding: '8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #e8ddd0' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1f2937', borderBottom: '1px solid #e8ddd0' }}>{student.firstName} {student.lastName}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #e8ddd0' }}>{student.admissionNumber || '-'}</td>
                      {subjects.map(subj => {
                        const r = student.results.find(res => res.subject === subj);
                        const score = r?.score;
                        const grade = r?.grade;
                        const sc = getScoreColorLocal(score);
                        return (
                          <td key={subj} style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #e8ddd0', background: score != null && score < 50 ? '#fef2f2' : 'transparent' }}>
                            {score != null ? (
                              <div>
                                <span style={{ fontWeight: 600, fontSize: '13px', color: sc }}>{score.toFixed(1)}%</span>
                                {grade && <div style={{ fontSize: '10px', color: '#6b7280' }}>{grade}</div>}
                              </div>
                            ) : <span style={{ color: '#d1d5db' }}>-</span>}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', padding: '8px', fontWeight: 700, borderBottom: '1px solid #e8ddd0', background: '#f5efe8', color: getScoreColorLocal(student.average) }}>
                        {student.average != null ? `${student.average.toFixed(1)}%` : '-'}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #e8ddd0' }}>
                        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: gc.bg, color: gc.text }}>
                          {student.grade || '-'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px', fontWeight: 600, borderBottom: '1px solid #e8ddd0', background: '#f5efe8', color: student.rank != null && student.rank <= 3 ? '#d97706' : '#1f2937' }}>
                        {student.rank || idx + 1}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary View */}
      {!sheetLoading && !studentsLoading && students.length > 0 && viewMode === 'summary' && (
        <div>
          {/* Grade Distribution */}
          <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>
              <i className="fa fa-chart-bar" style={{ color: '#ea6645', marginRight: '8px' }}></i>Grade Distribution
            </h3>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', height: '160px' }}>
              {getGradeDistribution(students).map(g => {
                const gc = getGradeColorLocal(g.grade);
                const maxCount = Math.max(...getGradeDistribution(students).map(x => x.count), 1);
                const height = (g.count / maxCount) * 100;
                return (
                  <div key={g.grade} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>{g.count}</span>
                    <div style={{ width: '100%', maxWidth: '80px', height: `${Math.max(height, 8)}%`, background: gc.text, borderRadius: '8px 8px 0 0' }}></div>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: gc.text }}>{g.grade}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top & Bottom 5 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ddd0', background: '#d1fae5' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#059669', margin: 0 }}>
                  <i className="fa fa-trophy" style={{ marginRight: '8px' }}></i>Top 5 Performers
                </h3>
              </div>
              {students.filter(s => s.average != null).sort((a, b) => (b.average || 0) - (a.average || 0)).slice(0, 5).map((s, i) => (
                <div key={s.admissionNumber || i} style={{ padding: '12px 20px', borderBottom: '1px solid #e8ddd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', width: '24px' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>{s.firstName} {s.lastName}</span>
                  </div>
                  <span style={{ padding: '3px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>{s.average?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ddd0', background: '#fee2e2' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626', margin: 0 }}>
                  <i className="fa fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>At-Risk Students
                </h3>
              </div>
              {students.filter(s => s.average != null && s.average < 40).sort((a, b) => (a.average || 0) - (b.average || 0)).slice(0, 5).map((s, i) => (
                <div key={s.admissionNumber || i} style={{ padding: '12px 20px', borderBottom: '1px solid #e8ddd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af', width: '24px' }}>{i + 1}.</span>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>{s.firstName} {s.lastName}</span>
                  </div>
                  <span style={{ padding: '3px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>{s.average?.toFixed(1)}%</span>
                </div>
              ))}
              {students.filter(s => s.average != null && s.average < 40).length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#059669' }}>
                  <i className="fa fa-check-circle" style={{ fontSize: '24px', marginBottom: '8px', display: 'block' }}></i>
                  No at-risk students
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      {students.length > 0 && (
        <div style={{ marginTop: '24px', background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>Quick Actions:</span>
          <a href={`/dashboard/results-management/result-entry?sheetId=${sheetData?.id || ''}`} style={{ padding: '6px 14px', fontSize: '12px', color: '#3b82f6', background: '#eff6ff', border: 'none', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            <i className="fa fa-edit" style={{ marginRight: '4px' }}></i>Edit Results
          </a>
          <a href={`/dashboard/results-management/mark-schedules`} style={{ padding: '6px 14px', fontSize: '12px', color: '#059669', background: '#d1fae5', border: 'none', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            <i className="fa fa-print" style={{ marginRight: '4px' }}></i>Mark Schedules
          </a>
          <a href={`/dashboard/results-management/ranking?sheetId=${sheetData?.id || ''}`} style={{ padding: '6px 14px', fontSize: '12px', color: '#d97706', background: '#fef3c7', border: 'none', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            <i className="fa fa-trophy" style={{ marginRight: '4px' }}></i>Rankings
          </a>
          <a href={`/dashboard/results-management/analysis?sheetId=${sheetData?.id || ''}`} style={{ padding: '6px 14px', fontSize: '12px', color: '#7c3aed', background: '#f3e8ff', border: 'none', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            <i className="fa fa-chart-bar" style={{ marginRight: '4px' }}></i>Analysis
          </a>
        </div>
      )}
    </div>
  );
}

function getScoreColorLocal(pct: number | null): string {
  if (pct == null) return '#9ca3af';
  if (pct >= 75) return '#059669';
  if (pct >= 50) return '#3b82f6';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}

function getGradeColorLocal(grade: string): { text: string; bg: string } {
  const map: Record<string, { text: string; bg: string }> = {
    'A+': { text: '#059669', bg: '#d1fae5' }, 'A': { text: '#059669', bg: '#d1fae5' }, 'A-': { text: '#059669', bg: '#d1fae5' },
    'B+': { text: '#2563eb', bg: '#dbeafe' }, 'B': { text: '#2563eb', bg: '#dbeafe' }, 'B-': { text: '#2563eb', bg: '#dbeafe' },
    'C+': { text: '#d97706', bg: '#fef3c7' }, 'C': { text: '#d97706', bg: '#fef3c7' }, 'C-': { text: '#d97706', bg: '#fef3c7' },
    'D+': { text: '#dc2626', bg: '#fee2e2' }, 'D': { text: '#dc2626', bg: '#fee2e2' }, 'D-': { text: '#dc2626', bg: '#fee2e2' },
    'E': { text: '#dc2626', bg: '#fee2e2' }, 'F': { text: '#dc2626', bg: '#fee2e2' },
    '1': { text: '#059669', bg: '#d1fae5' }, '2': { text: '#2563eb', bg: '#dbeafe' },
    '3': { text: '#d97706', bg: '#fef3c7' }, '4': { text: '#dc2626', bg: '#fee2e2' }, '5': { text: '#dc2626', bg: '#fee2e2' },
  };
  return map[grade?.trim()] || { text: '#9ca3af', bg: '#f3f4f6' };
}

function getGradeDistribution(students: ReportStudent[]): { grade: string; count: number }[] {
  const dist: Record<string, number> = {};
  students.forEach(s => {
    const g = s.grade || '-';
    dist[g] = (dist[g] || 0) + 1;
  });
  return Object.entries(dist).map(([grade, count]) => ({ grade, count })).sort((a, b) => a.grade.localeCompare(b.grade));
}
