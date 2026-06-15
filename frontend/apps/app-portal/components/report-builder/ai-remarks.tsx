'use client';

import { useState } from 'react';
import { academicTemplateApi } from '@/lib/api';

interface AiRemarksProps {
  onRemarkGenerated?: (remark: string, type: string) => void;
  studentName?: string;
  compact?: boolean;
}

export function AiRemarksGenerator({ onRemarkGenerated, studentName: initialName, compact }: AiRemarksProps) {
  const [type, setType] = useState('teacher');
  const [studentName, setStudentName] = useState(initialName || '');
  const [academicPerformance, setAcademicPerformance] = useState('');
  const [attendance, setAttendance] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [assessmentResults, setAssessmentResults] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const res = await academicTemplateApi.generateAiRemarks({
        type, studentName, academicPerformance, attendance, discipline, assessmentResults,
      });
      const data = res.data?.data || res.data;
      const remark = data.remark || '';
      setResult(remark);
      if (onRemarkGenerated) onRemarkGenerated(remark, type);
    } catch (err) {
      console.error('Failed to generate remark:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) navigator.clipboard.writeText(result);
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #d1d5db', fontSize: '13px', outline: 'none',
    background: '#fefcf9', boxSizing: 'border-box' as const,
  };

  const labelStyle = { fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' };

  return (
    <div style={{
      background: '#fefcf9',
      borderRadius: compact ? '12px' : '16px',
      border: '1px solid #f3f4f6',
      padding: compact ? '16px' : '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <div style={{
          width: '32px', height: '32px',
          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="fa fa-robot" style={{ fontSize: '16px', color: 'white' }}></i>
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937' }}>AI Remarks Generator</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Generate professional remarks instantly</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Remark Type</label>
          <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
            <option value="teacher">Teacher Remark</option>
            <option value="class_teacher">Class Teacher Remark</option>
            <option value="head_teacher">Head Teacher Remark</option>
            <option value="promotion">Promotion Remark</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Student Name</label>
          <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="e.g., John Doe" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Performance</label>
          <select value={academicPerformance} onChange={e => setAcademicPerformance(e.target.value)} style={inputStyle}>
            <option value="">Select...</option>
            <option value="Excellent">Excellent</option>
            <option value="Very Good">Very Good</option>
            <option value="Good">Good</option>
            <option value="Satisfactory">Satisfactory</option>
            <option value="Fair">Fair</option>
            <option value="Needs Improvement">Needs Improvement</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Attendance</label>
          <select value={attendance} onChange={e => setAttendance(e.target.value)} style={inputStyle}>
            <option value="">Select...</option>
            <option value="Excellent (95%+)">Excellent (95%+)</option>
            <option value="Good (85-94%)">Good (85-94%)</option>
            <option value="Satisfactory (75-84%)">Satisfactory (75-84%)</option>
            <option value="Poor (Below 75%)">Poor (Below 75%)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Discipline</label>
          <select value={discipline} onChange={e => setDiscipline(e.target.value)} style={inputStyle}>
            <option value="">Select...</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Satisfactory">Satisfactory</option>
            <option value="Needs Improvement">Needs Improvement</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Assessment Results</label>
          <input type="text" value={assessmentResults} onChange={e => setAssessmentResults(e.target.value)} placeholder="e.g., Avg score: 72%" style={inputStyle} />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: '10px 24px',
          background: loading ? '#9ca3af' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          color: 'white', border: 'none', borderRadius: '8px',
          fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px',
          transition: 'all 0.2s',
        }}
      >
        <i className={`fa ${loading ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>
        {loading ? 'Generating...' : 'Generate Remark'}
      </button>

      {result && (
        <div style={{ marginTop: '16px', padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <i className="fa fa-comment-dots" style={{ color: '#16a34a', fontSize: '14px' }}></i>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534', textTransform: 'capitalize' }}>
              {type.replace('_', ' ')} Remark
            </span>
          </div>
          <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 12px', lineHeight: 1.6 }}>{result}</p>
          <button onClick={handleCopy} style={{ padding: '6px 14px', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa fa-copy"></i> Copy
          </button>
        </div>
      )}
    </div>
  );
}
