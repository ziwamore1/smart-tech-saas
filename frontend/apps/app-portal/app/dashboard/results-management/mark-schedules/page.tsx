'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { openMarkScheduleReport, ReportStudent, ReportMeta } from '@/lib/report-utils';

export default function MarkSchedulesPage() {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('Exam');
  const [schedule, setSchedule] = useState<any>(null);
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

  const examTypes = ['Exam', 'Mid-Term', 'CAT', 'Assignment', 'Project', 'Practical', 'Mock'];

  const generateSchedule = useCallback(async () => {
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
        toast.error('No result sheet found for this selection');
        setLoading(false);
        return;
      }
      const sheetId = sheetArr[sheetArr.length - 1].id;
      const sr = await api.get(`/results-management/sheets/${sheetId}/mark-schedule`);
      const schedData = sr.data?.data?.data || sr.data?.data || sr.data;
      setSchedule({
        ...schedData,
        sheet: sheetArr[sheetArr.length - 1],
        className: sheetArr[sheetArr.length - 1].class?.name || schedData.className || 'Class',
        termName: sheetArr[sheetArr.length - 1].term?.name || schedData.termName || 'Term',
        examType: selectedExamType,
      });
      toast.success('Schedule generated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate schedule');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedTerm, selectedExamType]);

  const handlePrint = () => {
    if (!schedule?.students?.length) {
      toast.error('No schedule data to print');
      return;
    }
    const students: ReportStudent[] = schedule.students.map((s: any) => {
      const results = (s.subjects || []).map((sr: any) => ({
        subject: sr.subjectName || sr.subjectCode || '',
        score: sr.finalPercentage ?? null,
        grade: sr.finalGrade || null,
        remark: sr.finalRemark || null,
      }));
      return {
        firstName: s.student?.firstName || s.firstName || '',
        lastName: s.student?.lastName || s.lastName || '',
        admissionNumber: s.student?.admissionNumber || s.admissionNumber || '',
        gender: s.student?.gender || s.gender || '',
        results,
        average: s.average ?? null,
        grade: getGrade(s.average ?? null),
        rank: s.rank ?? null,
        totalPoints: s.totalPoints ?? null,
      };
    });
    const meta: ReportMeta = {
      schoolName: schedule.schoolName || user?.schoolName || 'Smart Tech School',
      schoolAddress: schedule.schoolAddress || '',
      schoolPhone: schedule.schoolPhone || '',
      schoolEmail: schedule.schoolEmail || '',
      className: schedule.className || 'Class',
      termName: schedule.termName || 'Term',
      examType: schedule.examType || selectedExamType,
    };
    openMarkScheduleReport(students, meta);
  };

  const getGrade = (avg: number | null): string => {
    if (avg == null) return '-';
    if (avg >= 75) return 'A';
    if (avg >= 65) return 'B';
    if (avg >= 55) return 'C';
    if (avg >= 40) return 'D';
    return 'E';
  };

  const subjects = useMemo(() => {
    if (!schedule?.subjects?.length) return [];
    return schedule.subjects.map((s: any) => s.name || s.code || '');
  }, [schedule]);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Mark Schedules</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
          Generate and print professional mark schedules for exams
        </p>
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
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          >
            <option value="">Select Class</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Term *</label>
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          >
            <option value="">Select Term</option>
            {terms.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Exam Type</label>
          <select
            value={selectedExamType}
            onChange={e => setSelectedExamType(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          >
            {examTypes.map(et => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={generateSchedule}
            disabled={!selectedClass || !selectedTerm || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 24px', fontSize: '14px', fontWeight: 600, color: 'white',
              background: !selectedClass || !selectedTerm ? '#d1d5db' : '#ea6645',
              border: 'none', borderRadius: '8px',
              cursor: !selectedClass || !selectedTerm ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? <><i className="fa fa-spinner fa-spin"></i> Generating...</> : <><i className="fa fa-table"></i> Generate Schedule</>}
          </button>
          {schedule && (
            <>
              <button
                onClick={handlePrint}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', fontSize: '14px', fontWeight: 500, color: '#374151',
                  background: '#f5efe8', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer'
                }}
              >
                <i className="fa fa-print"></i> Print
              </button>
            </>
          )}
        </div>
      </div>

      {/* Schedule Content */}
      {schedule ? (
        <div ref={scheduleRef} style={{
          background: 'white', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}>
          {/* School Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px', borderBottom: '2px solid #1f2937', paddingBottom: '20px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', textTransform: 'uppercase' }}>
              {schedule.schoolName || 'School Name'}
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 2px' }}>
              {schedule.schoolAddress || 'School Address'}
            </p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 2px' }}>
              {schedule.schoolPhone || ''} {schedule.schoolEmail || ''}
            </p>
          </div>

          {/* Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#374151', margin: '2px 0' }}>
                <strong>Class:</strong> {schedule.className}
              </p>
              <p style={{ fontSize: '14px', color: '#374151', margin: '2px 0' }}>
                <strong>Term:</strong> {schedule.termName}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '14px', color: '#374151', margin: '2px 0' }}>
                <strong>Exam:</strong> {schedule.examType}
              </p>
              <p style={{ fontSize: '14px', color: '#374151', margin: '2px 0' }}>
                <strong>Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse', fontSize: '12px'
            }}>
              <thead>
                <tr style={{ background: '#1f2937', color: 'white' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #374151', width: '40px' }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #374151', minWidth: '120px' }}>Admission No</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #374151', minWidth: '180px' }}>Student Name</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #374151', width: '60px' }}>Gender</th>
                  {subjects.map((subj: string) => (
                    <th key={subj} style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #374151', minWidth: '70px' }}>
                      {subj.replace(/([A-Z])/g, ' $1').trim()}
                    </th>
                  ))}
                  <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #374151', width: '60px' }}>Total</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #374151', width: '60px' }}>Average</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #374151', width: '55px' }}>Points</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #374151', width: '50px' }}>Grade</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #374151', width: '50px' }}>Rank</th>
                </tr>
              </thead>
              <tbody>
                {schedule.students?.map((student: any, idx: number) => {
                  const pcts = (student.subjects || []).map((sr: any) => sr.finalPercentage);
                  const validPcts = pcts.filter((p: number | null) => p != null) as number[];
                  const total = validPcts.reduce((sum: number, p: number) => sum + p, 0);
                  const avg = validPcts.length > 0 ? total / validPcts.length : null;
                  const grade = getGrade(avg);
                  return (
                    <tr key={student.student?.id || student.studentId || idx} style={{
                      background: idx % 2 === 0 ? 'white' : '#f9fafb'
                    }}>
                      <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #e5e7eb', color: '#6b7280' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', color: '#374151' }}>
                        {student.student?.admissionNumber || student.admissionNumber || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 600, color: '#1f2937' }}>
                        {student.student?.firstName || student.firstName || ''} {student.student?.lastName || student.lastName || ''}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #e5e7eb', color: '#374151' }}>
                        {student.student?.gender || student.gender || '-'}
                      </td>
                      {subjects.map((subjName: string) => {
                        const sr = (student.subjects || []).find((s: any) => s.subjectName === subjName);
                        const pct = sr?.finalPercentage;
                        return (
                          <td key={subjName} style={{
                            padding: '8px 12px', textAlign: 'center', border: '1px solid #e5e7eb',
                            color: pct != null ? '#374151' : '#d1d5db',
                            fontWeight: pct != null ? 500 : 400
                          }}>
                            {pct != null ? pct : '-'}
                          </td>
                        );
                      })}
                      <td style={{
                        padding: '8px 12px', textAlign: 'center', border: '1px solid #e5e7eb',
                        fontWeight: 700, color: '#1f2937', background: '#f5efe8'
                      }}>
                        {validPcts.length > 0 ? total.toFixed(1) : '-'}
                      </td>
                      <td style={{
                        padding: '8px 12px', textAlign: 'center', border: '1px solid #e5e7eb',
                        fontWeight: 600, color: '#1f2937', background: '#f5efe8'
                      }}>
                        {avg ? avg.toFixed(1) : '-'}
                      </td>
                      <td style={{
                        padding: '8px 12px', textAlign: 'center', border: '1px solid #e5e7eb',
                        fontWeight: 700, color: '#059669', background: '#f0fdf4'
                      }}>
                        {student.totalPoints ?? '-'}
                      </td>
                      <td style={{
                        padding: '8px 12px', textAlign: 'center', border: '1px solid #e5e7eb',
                        fontWeight: 700,
                        color: grade === 'A' ? '#059669' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#d97706' : '#dc2626'
                      }}>
                        {grade}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #e5e7eb', fontWeight: 600, color: '#1f2937' }}>
                        {student.rank || idx + 1}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: '48px',
            paddingTop: '20px', borderTop: '1px solid #e5e7eb'
          }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ marginBottom: '48px' }}></div>
              <div style={{ borderTop: '1px solid #1f2937', width: '200px', margin: '0 auto', paddingTop: '8px' }}>
                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>Class Teacher</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Signature</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ marginBottom: '48px' }}></div>
              <div style={{ borderTop: '1px solid #1f2937', width: '200px', margin: '0 auto', paddingTop: '8px' }}>
                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>Head of Department</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Signature</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ marginBottom: '48px' }}></div>
              <div style={{ borderTop: '1px solid #1f2937', width: '200px', margin: '0 auto', paddingTop: '8px' }}>
                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>Director / Principal</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Signature</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '60px', textAlign: 'center'
        }}>
          <i className="fa fa-file-alt" style={{ fontSize: '48px', color: '#e8ddd0', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>No Schedule Generated</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            Select a class, term, and exam type, then click "Generate Schedule"
          </p>
        </div>
      )}

      <style>{`
        @media print {
          .desktop-sidebar, .mobile-header { display: none !important; }
        }
      `}</style>
    </div>
  );
}
