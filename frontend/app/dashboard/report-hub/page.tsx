'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportEngineApi, classApi, termApi, studentApi } from '@/lib/api';
import { toast } from 'sonner';

const REPORT_TYPES = [
  { type: 'REPORT_CARD', label: 'Report Card', icon: 'fa-file-text', color: '#3b82f6', desc: 'Individual student report card with charts and analysis' },
  { type: 'CLASS_REPORT', label: 'Class Report Cards', icon: 'fa-clipboard-list', color: '#0d9488', desc: 'All report cards for a class as a combined PDF', bulk: true },
  { type: 'TRANSCRIPT', label: 'Academic Transcript', icon: 'fa-scroll', color: '#8b5cf6', desc: 'Full academic transcript for a student' },
  { type: 'CERTIFICATE', label: 'Certificate', icon: 'fa-award', color: '#f59e0b', desc: 'Achievement, merit, or graduation certificate' },
  { type: 'ATTENDANCE_REPORT', label: 'Attendance Report', icon: 'fa-calendar-check', color: '#10b981', desc: 'Attendance summary for a student or class', bulk: true },
  { type: 'ANALYTICS_SUMMARY', label: 'Analytics Summary', icon: 'fa-chart-pie', color: '#4f46e5', desc: 'Class or school performance analytics', bulk: true },
  { type: 'MARK_SCHEDULE', label: 'Mark Schedule', icon: 'fa-table', color: '#ea580c', desc: 'Subject-wise mark schedule for a class', bulk: true },
  { type: 'PERFORMANCE_REPORT', label: 'Performance Report', icon: 'fa-chart-line', color: '#ec4899', desc: 'Detailed student performance profile' },
];

export default function ReportHubPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFileName, setResultFileName] = useState('');

  const { data: types } = useQuery({
    queryKey: ['report-engine-types'],
    queryFn: () => reportEngineApi.getTypes().then(r => r.data?.data || r.data),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(r => r.data?.data || r.data?.classes || r.data),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data?.terms || r.data),
  });

  const { data: students } = useQuery({
    queryKey: ['students', selectedClass],
    queryFn: () => studentApi.getAll({ classId: selectedClass }).then(r => r.data?.data || r.data?.students || r.data),
    enabled: !!selectedClass,
  });

  const config = REPORT_TYPES.find(t => t.type === selectedType);
  const needsStudent = selectedType && ['REPORT_CARD', 'TRANSCRIPT', 'CERTIFICATE', 'PERFORMANCE_REPORT'].includes(selectedType);
  const needsClass = selectedType && ['CLASS_REPORT', 'MARK_SCHEDULE'].includes(selectedType);
  const needsTerm = selectedType && !['TRANSCRIPT'].includes(selectedType);

  const canGenerate = selectedType && (!needsStudent || selectedStudent) && (!needsClass || selectedClass) && (!needsTerm || selectedTerm);

  const handleGenerate = async () => {
    if (!selectedType) return;
    setGenerating(true);
    setResultUrl(null);
    try {
      const payload: any = { type: selectedType };
      if (selectedStudent) payload.studentId = selectedStudent;
      if (selectedClass) payload.classId = selectedClass;
      if (selectedTerm) payload.termId = selectedTerm;

      const res = await reportEngineApi.generatePdf(payload);
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const fileName = `${selectedType.toLowerCase()}-${Date.now()}.pdf`;
      setResultUrl(url);
      setResultFileName(fileName);
      toast.success('Report generated successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = resultFileName;
    a.click();
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a365d', margin: 0 }}>
          <i className="fas fa-print" style={{ marginRight: '10px', color: '#3b82f6' }} />
          Report Generation Hub
        </h1>
        <p style={{ color: '#64748b', marginTop: '6px', fontSize: '14px' }}>
          Generate any report type through the centralized report engine
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {REPORT_TYPES.map(rt => (
          <div
            key={rt.type}
            onClick={() => { setSelectedType(rt.type); setResultUrl(null); }}
            style={{
              padding: '20px',
              borderRadius: '12px',
              border: `2px solid ${selectedType === rt.type ? rt.color : '#e2e8f0'}`,
              background: selectedType === rt.type ? `${rt.color}08` : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: `${rt.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className={`fas ${rt.icon}`} style={{ color: rt.color, fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>{rt.label}</div>
                {rt.bulk && <span style={{ fontSize: '10px', color: rt.color, fontWeight: '600' }}>BULK</span>}
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>{rt.desc}</p>
          </div>
        ))}
      </div>

      {selectedType && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '24px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
            Configure: {config?.label}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {(needsClass || needsStudent) && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Class</label>
                <select
                  value={selectedClass}
                  onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                >
                  <option value="">Select class...</option>
                  {(Array.isArray(classes) ? classes : []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {needsTerm && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Term</label>
                <select
                  value={selectedTerm}
                  onChange={e => setSelectedTerm(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                >
                  <option value="">Select term...</option>
                  {(Array.isArray(terms) ? terms : []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {needsStudent && selectedClass && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Student</label>
                <select
                  value={selectedStudent}
                  onChange={e => setSelectedStudent(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                >
                  <option value="">Select student...</option>
                  {(Array.isArray(students) ? students : []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                background: canGenerate && !generating ? config?.color || '#3b82f6' : '#94a3b8',
                color: 'white', fontWeight: '600', fontSize: '14px', cursor: canGenerate && !generating ? 'pointer' : 'not-allowed',
              }}
            >
              {generating ? (
                <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }} /> Generating...</>
              ) : (
                <><i className="fas fa-file-pdf" style={{ marginRight: '8px' }} /> Generate PDF</>
              )}
            </button>

            {resultUrl && (
              <button
                onClick={handleDownload}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
                  background: 'white', color: '#374151', fontWeight: '500', fontSize: '14px', cursor: 'pointer',
                }}
              >
                <i className="fas fa-download" style={{ marginRight: '6px' }} /> Download
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
