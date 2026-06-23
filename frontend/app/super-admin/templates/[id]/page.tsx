'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templateBuilderApi } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';
const gradRose = 'linear-gradient(135deg, #f43f5e, #e11d48)';
const gradAmber = 'linear-gradient(135deg, #f59e0b, #d97706)';
const gradIndigo = 'linear-gradient(135deg, #6366f1, #4f46e5)';
const gradCyan = 'linear-gradient(135deg, #06b6d4, #0891b2)';

type TemplateData = {
  id: string; name: string; description?: string; templateType: string; status: string;
  isDefault: boolean; schoolId?: string; pageSize?: string; orientation?: string;
  fontFamily?: string; fontSize?: number; primaryColor?: string; secondaryColor?: string;
  colorPalette?: any; layoutJson?: any; version: number; categoryId?: string;
  logoUrl?: string; headerText?: string; footerText?: string;
  marginTop?: number; marginBottom?: number; marginLeft?: number; marginRight?: number;
  includeLogo?: boolean; includeStamp?: boolean; includeSignature?: boolean;
  includeUniversity?: boolean; includeBestSix?: boolean; includeRankings?: boolean;
  includeComments?: boolean; includeGrading?: boolean;
  remarksEnabled?: boolean; customRemarks?: any; metadata?: any;
  directorName?: string; stampUrl?: string; signatureUrl?: string;
  category?: { id: string; name: string; slug: string; educationLevel?: string };
  components?: any[]; certificate?: any; createdAt: string; updatedAt: string;
};

function TemplateIcon({ type, size = 40 }: { type: string; size?: number }) {
  const icons: Record<string, string> = {
    REPORT_CARD: 'fa-file-alt', TRANSCRIPT: 'fa-scroll', CERTIFICATE: 'fa-award',
    PROGRESS_REPORT: 'fa-chart-line', ATTENDANCE_REPORT: 'fa-calendar-check',
    STUDENT_PROFILE: 'fa-user-graduate', ANALYTICS_SUMMARY: 'fa-chart-bar',
    SCHOOL_PERFORMANCE: 'fa-trophy', TESTIMONIAL: 'fa-star',
    RECOMMENDATION_LETTER: 'fa-envelope', MINISTRY_REPORT: 'fa-building',
    ID_CARD: 'fa-id-card', FEE_STATEMENT: 'fa-money-bill',
  };
  const colors: Record<string, string> = {
    REPORT_CARD: gradBlue, CERTIFICATE: gradAmber, TRANSCRIPT: gradPurple,
    PROGRESS_REPORT: gradGreen, ATTENDANCE_REPORT: gradTeal, STUDENT_PROFILE: gradIndigo,
  };
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '12px',
      background: colors[type] || gradOrange,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
      fontSize: `${size * 0.45}px`, flexShrink: 0,
    }}>
      <i className={`fa ${icons[type] || 'fa-file'}`}></i>
    </div>
  );
}

function PrimaryReportCardPreview({ template }: { template: TemplateData }) {
  const subjects = ['English', 'Mathematics', 'Science', 'Social Studies', 'Creative Arts', 'Physical Education'];
  const grades = ['A', 'A', 'B+', 'B', 'A', 'A-'];
  const scores = [85, 92, 78, 74, 88, 81];
  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #e8ddd0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'Comic Sans MS', 'Arial Rounded MT Bold', sans-serif",
    }}>
      <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '3px solid #f59e0b', paddingBottom: '16px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#ea6645' }}>🏫 Happy Kids Primary School</div>
        <div style={{ fontSize: '16px', color: '#6b7280', marginTop: '4px', fontWeight: 600 }}>End of Term Progress Report</div>
        <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>Grade 3 — Term 1, 2026</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '13px', color: '#374151' }}>
        <div><strong>Student:</strong> Mulenga Banda</div>
        <div style={{ textAlign: 'right' }}><strong>Admission No:</strong> P-2024-0037</div>
        <div><strong>Class Teacher:</strong> Mrs. Phiri</div>
        <div style={{ textAlign: 'right' }}><strong>Attendance:</strong> 42/48 days (87.5%)</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #fcd34d' }}>Subject</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #fcd34d' }}>Score</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #fcd34d' }}>Grade</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #fcd34d' }}>Remark</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => (
            <tr key={s} style={{ background: i % 2 === 0 ? '#fffbeb' : 'white' }}>
              <td style={{ padding: '8px 12px', border: '1px solid #fde68a', fontWeight: 500 }}>{s}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #fde68a' }}>{scores[i]}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #fde68a', fontWeight: 600, color: scores[i] >= 80 ? '#059669' : scores[i] >= 60 ? '#d97706' : '#dc2626' }}>{grades[i]}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #fde68a', color: '#6b7280' }}>{['Excellent', 'Outstanding', 'Good', 'Good', 'Excellent', 'Very Good'][i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#059669', marginBottom: '6px' }}>📝 Class Teacher's Comments</div>
        <div style={{ fontSize: '13px', color: '#374151', fontStyle: 'italic' }}>Mulenga has shown great improvement in Mathematics this term. She participates actively in class and completes her homework on time. Keep up the good work!</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', borderTop: '1px solid #e8ddd0', paddingTop: '12px' }}>
        <div><strong>Head Teacher:</strong> Mrs. Banda</div>
        <div><strong>Next Term Begins:</strong> 10 May 2026</div>
      </div>
    </div>
  );
}

function SecondaryReportCardPreview({ template }: { template: TemplateData }) {
  const subjects = ['English Language', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Geography', 'History', 'Civic Education'];
  const scores = [68, 72, 59, 45, 63, 71, 55, 80];
  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #e8ddd0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>
      <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #1e40af', paddingBottom: '16px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a5f' }}>GOVERNMENT SECONDARY SCHOOL</div>
        <div style={{ fontSize: '15px', color: '#374151', marginTop: '4px', fontWeight: 600 }}>Academic Report — Grade 11</div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Term 1 | March 2026</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px', marginBottom: '20px', fontSize: '12px', color: '#374151', borderBottom: '1px dashed #d1d5db', paddingBottom: '12px' }}>
        <div><strong>Name:</strong> Chanda Mwila</div>
        <div><strong>Form:</strong> 11A</div>
        <div style={{ textAlign: 'right' }}><strong>Admission:</strong> S-2022-0119</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#1e3a5f', color: 'white' }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #1e40af' }}>Subject</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #1e40af' }}>Score</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #1e40af' }}>Grade</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #1e40af' }}>Points</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #1e40af' }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => {
            const grade = scores[i] >= 75 ? '1' : scores[i] >= 70 ? '2' : scores[i] >= 65 ? '3' : scores[i] >= 60 ? '4' : scores[i] >= 55 ? '5' : scores[i] >= 50 ? '6' : scores[i] >= 45 ? '7' : scores[i] >= 40 ? '8' : '9';
            const remark = scores[i] >= 75 ? 'Distinction' : scores[i] >= 65 ? 'Merit' : scores[i] >= 50 ? 'Credit' : scores[i] >= 40 ? 'Satisfactory' : 'Unsatisfactory';
            const pts = parseInt(grade);
            return (
              <tr key={s} style={{ background: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb', fontWeight: 500 }}>{s}</td>
                <td style={{ padding: '7px 12px', textAlign: 'center', border: '1px solid #e5e7eb' }}>{scores[i]}</td>
                <td style={{ padding: '7px 12px', textAlign: 'center', border: '1px solid #e5e7eb', fontWeight: 700, fontSize: '14px', color: pts <= 3 ? '#059669' : pts <= 6 ? '#d97706' : '#dc2626' }}>{grade}</td>
                <td style={{ padding: '7px 12px', textAlign: 'center', border: '1px solid #e5e7eb' }}>{pts}</td>
                <td style={{ padding: '7px 12px', textAlign: 'center', border: '1px solid #e5e7eb', color: '#6b7280' }}>{remark}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: '#f0fdf4', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
        <div><strong>Total Points:</strong> 38</div>
        <div><strong>Best 6:</strong> 2+2+3+3+3+4 = 17</div>
        <div><strong>GPA:</strong> 3.2</div>
      </div>
      <div style={{ background: '#fef9ef', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#92400e', marginBottom: '6px' }}>Form Teacher's Remarks</div>
        <div style={{ fontSize: '12px', color: '#374151', fontStyle: 'italic' }}>Chanda is a diligent student with consistent performance across most subjects. Needs more focus on Chemistry. Encouraged to participate in science quiz competitions.</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
        <div><strong>Head Teacher:</strong> Mr. Zulu</div>
        <div><strong>Signature:</strong> _____________</div>
        <div><strong>Date:</strong> 25/03/2026</div>
      </div>
    </div>
  );
}

function CertificatePreview({ template }: { template: TemplateData }) {
  const certColors: Record<string, string[]> = {
    'Academic Excellence': ['#1a365d', '#f59e0b'],
    'Graduation': ['#065f46', '#10b981'],
    'Sports': ['#7c2d12', '#ea580c'],
    'default': ['#1e3a5f', '#b8860b'],
  };
  const c = certColors[template.name?.includes('Academic') ? 'Academic Excellence' : template.name?.includes('Graduation') ? 'Graduation' : template.name?.includes('Sports') ? 'Sports' : 'default'];
  return (
    <div style={{
      background: 'linear-gradient(135deg, #fefcf9, #fdf6e3)', borderRadius: '16px',
      padding: '40px', border: `3px solid ${c[1]}`, boxShadow: '0 4px 30px rgba(0,0,0,0.12)',
      fontFamily: "'Palatino Linotype', 'Georgia', serif", textAlign: 'center', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px', fontSize: '12px', color: '#9ca3af' }}>No. 001/2026</div>
      <div style={{
        width: '70px', height: '70px', margin: '0 auto 16px', borderRadius: '50%',
        background: `linear-gradient(135deg, ${c[0]}, ${c[1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className="fa fa-award" style={{ fontSize: '32px', color: 'white' }}></i>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: c[0], marginBottom: '8px', letterSpacing: '1px' }}>CERTIFICATE OF {template.name?.replace(' Certificate', '').toUpperCase() || 'ACHIEVEMENT'}</div>
      <div style={{ width: '120px', height: '3px', background: `linear-gradient(90deg, ${c[0]}, ${c[1]})`, margin: '0 auto 20px' }}></div>
      <div style={{ fontSize: '15px', color: '#6b7280', marginBottom: '8px', fontStyle: 'italic' }}>This certificate is proudly presented to</div>
      <div style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', marginBottom: '16px', fontFamily: "'Brush Script MT', cursive" }}>Mulenga Banda</div>
      <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.8', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
        In recognition of outstanding academic performance and demonstrated excellence in Grade 12 Final Examinations, securing a Division 1 with distinction.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', borderTop: '1px solid #e8ddd0', paddingTop: '20px' }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ width: '120px', height: '2px', background: '#d1d5db', margin: '0 auto 8px' }}></div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Head Teacher</div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>Mrs. Banda</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ width: '60px', height: '60px', margin: '0 auto 8px', borderRadius: '50%', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-qrcode" style={{ fontSize: '24px', color: '#6b7280' }}></i>
          </div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ width: '120px', height: '2px', background: '#d1d5db', margin: '0 auto 8px' }}></div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Director</div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>ECZ Representative</div>
        </div>
      </div>
    </div>
  );
}

function TranscriptPreview({ template }: { template: TemplateData }) {
  const isAbridged = template.name?.toLowerCase().includes('abridged');
  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #e8ddd0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'Courier New', monospace",
    }}>
      <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px double #374151', paddingBottom: '12px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>{isAbridged ? 'ABRIDGED ACADEMIC TRANSCRIPT' : 'OFFICIAL ACADEMIC TRANSCRIPT'}</div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Smart Tech Secondary School — Form 4 to Form 6</div>
      </div>
      <div style={{ fontSize: '11px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <div><strong>Student Name:</strong> Chanda Mwila</div>
          <div style={{ textAlign: 'right' }}><strong>Date of Birth:</strong> 15/03/2006</div>
          <div><strong>Admission No:</strong> S-2022-0119</div>
          <div style={{ textAlign: 'right' }}><strong>National ID:</strong> 256489/10/1</div>
        </div>
      </div>
      {!isAbridged && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#1f2937', color: 'white' }}>
              <th style={{ padding: '8px 10px', border: '1px solid #374151', textAlign: 'left' }}>Subject</th>
              <th style={{ padding: '8px 10px', border: '1px solid #374151', textAlign: 'center' }}>Form 4</th>
              <th style={{ padding: '8px 10px', border: '1px solid #374151', textAlign: 'center' }}>Form 5</th>
              <th style={{ padding: '8px 10px', border: '1px solid #374151', textAlign: 'center' }}>Form 6</th>
              <th style={{ padding: '8px 10px', border: '1px solid #374151', textAlign: 'center' }}>Final</th>
            </tr>
          </thead>
          <tbody>
            {['English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Geography'].map((s, i) => (
              <tr key={s} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white' }}>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', fontWeight: 500 }}>{s}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', textAlign: 'center' }}{...{}}>{['B', 'A', 'B+', 'C+', 'A-', 'B'][i]}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', textAlign: 'center' }}{...{}}>{['A-', 'A', 'B', 'B+', 'A', 'B+'][i]}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', textAlign: 'center' }}{...{}}>{['A', 'A', 'B+', 'B', 'A', 'A-'][i]}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 700, color: '#059669' }}>{['A', 'A', 'B+', 'B', 'A', 'B+'][i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isAbridged && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#1f2937', color: 'white' }}>
              <th style={{ padding: '8px 10px', border: '1px solid #374151', textAlign: 'left' }}>Subject</th>
              <th style={{ padding: '8px 10px', border: '1px solid #374151', textAlign: 'center' }}>Grade</th>
              <th style={{ padding: '8px 10px', border: '1px solid #374151', textAlign: 'center' }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {['English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Geography'].map((s, i) => (
              <tr key={s} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white' }}>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', fontWeight: 500 }}>{s}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600 }}>{['A', 'A', 'B+', 'B', 'A', 'B+'][i]}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{['1', '1', '2', '3', '1', '2'][i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '13px', background: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
        <div><strong>Cumulative GPA:</strong> 4.6 / 5.0</div>
        <div><strong>Total Credits:</strong> 72</div>
        <div><strong>Classification:</strong> Distinction</div>
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '10px', textAlign: 'center' }}>
        <i className="fa fa-certificate" style={{ marginRight: '4px' }}></i>
        This is a computer-generated document. Verification Code: ST-TRN-2026-00472
      </div>
    </div>
  );
}

function AssessmentReportPreview({ template }: { template: TemplateData }) {
  const isContinuous = template.name?.toLowerCase().includes('continuous');
  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #e8ddd0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'Segoe UI', 'Roboto', sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '3px solid #059669', paddingBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#065f46' }}>{isContinuous ? 'CONTINUOUS ASSESSMENT REPORT' : 'TERM ASSESSMENT SUMMARY'}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Competency-Based Progress Tracking</div>
        </div>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #059669, #065f46)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
        }}>
          <i className="fa fa-chart-line" style={{ fontSize: '22px' }}></i>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '13px', color: '#374151' }}>
        <div><strong>Student:</strong> Mulenga Banda</div>
        <div style={{ textAlign: 'right' }}><strong>Grade:</strong> Form 1A</div>
        <div><strong>Subject:</strong> Mathematics</div>
        <div style={{ textAlign: 'right' }}><strong>Period:</strong> Term 1, 2026</div>
      </div>
      {isContinuous ? (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #6ee7b7' }}>Assessment</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #6ee7b7' }}>Date</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #6ee7b7' }}>Score</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #6ee7b7' }}>Max</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #6ee7b7' }}>Level</th>
              </tr>
            </thead>
            <tbody>
              {[{ name: 'Quiz 1', date: '10/01', score: 18, max: 20 }, { name: 'Assignment 1', date: '25/01', score: 14, max: 15 }, { name: 'Mid-Term Test', date: '15/02', score: 38, max: 50 }, { name: 'Project', date: '28/02', score: 22, max: 25 }, { name: 'End of Term', date: '20/03', score: 72, max: 100 }].map((a, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#f0fdf4' : 'white' }}>
                  <td style={{ padding: '8px 12px', border: '1px solid #d1fae5', fontWeight: 500 }}>{a.name}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #d1fae5' }}>{a.date}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #d1fae5', fontWeight: 600 }}>{a.score}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #d1fae5' }}>{a.max}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #d1fae5' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: a.score / a.max >= 0.7 ? '#d1fae5' : a.score / a.max >= 0.5 ? '#fef3c7' : '#fee2e2', color: a.score / a.max >= 0.7 ? '#065f46' : a.score / a.max >= 0.5 ? '#92400e' : '#991b1b' }}>
                      {a.score / a.max >= 0.7 ? 'Proficient' : a.score / a.max >= 0.5 ? 'Developing' : 'Beginning'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center', padding: '12px 20px', background: '#f0fdf4', borderRadius: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669' }}>164</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Score</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 20px', background: '#f0fdf4', borderRadius: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669' }}>78.1%</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Weighted Average</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 20px', background: '#f0fdf4', borderRadius: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669' }}>2</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Competency Level</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #bfdbfe, #93c5fd)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #60a5fa' }}>Subject</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #60a5fa' }}>CA (70%)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #60a5fa' }}>Exam (30%)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #60a5fa' }}>Total</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #60a5fa' }}>Grade</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #60a5fa' }}>Competency</th>
              </tr>
            </thead>
            <tbody>
              {[
                { subj: 'English', ca: 58, exam: 22, total: 80 },
                { subj: 'Mathematics', ca: 52, exam: 18, total: 70 },
                { subj: 'Science', ca: 48, exam: 15, total: 63 },
                { subj: 'Social Studies', ca: 44, exam: 12, total: 56 },
              ].map((r, i) => {
                const lvl = r.total >= 70 ? 'Outstanding' : r.total >= 60 ? 'Advanced' : r.total >= 50 ? 'Basic' : 'Developing';
                const lvlColor = r.total >= 70 ? '#059669' : r.total >= 60 ? '#2563eb' : r.total >= 50 ? '#d97706' : '#dc2626';
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#eff6ff' : 'white' }}>
                    <td style={{ padding: '8px 12px', border: '1px solid #dbeafe', fontWeight: 500 }}>{r.subj}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #dbeafe' }}>{r.ca}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #dbeafe' }}>{r.exam}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #dbeafe', fontWeight: 700 }}>{r.total}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #dbeafe', fontWeight: 700 }}>{r.total >= 75 ? '1' : r.total >= 65 ? '2' : r.total >= 55 ? '3' : r.total >= 40 ? '4' : '5'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #dbeafe' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: `${lvlColor}15`, color: lvlColor }}>{lvl}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e40af', marginBottom: '6px' }}>📊 Overall Performance Summary</div>
            <div style={{ fontSize: '12px', color: '#374151' }}>Total Subjects: 10 | Average Score: 67.3% | Competency Level: Advanced (Level 2)</div>
          </div>
        </>
      )}
      <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
        Powered by Smart Tech — Competency-Based Assessment System v2.1
      </div>
    </div>
  );
}

function AdvancedSecondaryPreview({ template }: { template: TemplateData }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a, #1e293b)', borderRadius: '16px', padding: '32px',
      border: '1px solid #334155', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      fontFamily: "'Georgia', 'Times New Roman', serif", color: 'white',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #f59e0b', paddingBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: 300, letterSpacing: '3px', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '4px' }}>Advanced Secondary School</div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'white' }}>Academic Progress Report</div>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Form 5 — Science Track | Term 1, 2026</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#cbd5e1', marginBottom: '20px' }}>
        <div><strong style={{ color: '#f59e0b' }}>Student:</strong> Chanda Mwila</div>
        <div style={{ textAlign: 'right' }}><strong style={{ color: '#f59e0b' }}>Code:</strong> AS-2024-0017</div>
        <div><strong style={{ color: '#f59e0b' }}>Programme:</strong> Science & Technology</div>
        <div style={{ textAlign: 'right' }}><strong style={{ color: '#f59e0b' }}>Duration:</strong> 2 Years</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#1e293b' }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #334155', color: '#f59e0b' }}>Subject Code</th>
            <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #334155', color: '#f59e0b' }}>Subject</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #334155', color: '#f59e0b' }}>SBA</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #334155', color: '#f59e0b' }}>Exam</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #334155', color: '#f59e0b' }}>Total</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #334155', color: '#f59e0b' }}>Grade</th>
          </tr>
        </thead>
        <tbody>
          {[
            { code: '3017', name: 'Mathematics', sba: 42, exam: 48 },
            { code: '3018', name: 'Physics', sba: 38, exam: 42 },
            { code: '3019', name: 'Chemistry', sba: 40, exam: 38 },
            { code: '3020', name: 'Biology', sba: 35, exam: 44 },
            { code: '3021', name: 'Computer Science', sba: 44, exam: 46 },
          ].map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#1e293b' : '#0f172a' }}>
              <td style={{ padding: '8px 12px', border: '1px solid #334155', color: '#94a3b8' }}>{r.code}</td>
              <td style={{ padding: '8px 12px', border: '1px solid #334155', fontWeight: 500 }}>{r.name}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #334155' }}>{r.sba}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #334155' }}>{r.exam}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #334155', fontWeight: 700, color: '#f59e0b' }}>{r.sba + r.exam}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #334155', fontWeight: 700 }}>{['A', 'A-', 'B+', 'B+', 'A'][i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
        <div><strong style={{ color: '#f59e0b' }}>Aggregate:</strong> 14</div>
        <div><strong style={{ color: '#f59e0b' }}>GPA:</strong> 4.2/5.0</div>
        <div><strong style={{ color: '#f59e0b' }}>Classification:</strong> Distinction</div>
      </div>
      <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '14px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#f59e0b', marginBottom: '6px' }}>🏆 Dean's Remarks</div>
        <div style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic' }}>Chanda continues to demonstrate exceptional aptitude in the Sciences. Performance in Chemistry has improved markedly. Recommended for scholarship consideration.</div>
      </div>
    </div>
  );
}

function getCategoryLabel(type: string): { label: string; gradient: string; icon: string } {
  switch (type) {
    case 'REPORT_CARD': return { label: 'Report Card', gradient: gradBlue, icon: 'fa-file-alt' };
    case 'CERTIFICATE': return { label: 'Certificate', gradient: gradAmber, icon: 'fa-award' };
    case 'TRANSCRIPT': return { label: 'Transcript', gradient: gradPurple, icon: 'fa-scroll' };
    case 'PROGRESS_REPORT': return { label: 'Assessment Report', gradient: gradGreen, icon: 'fa-chart-line' };
    default: return { label: type || 'Template', gradient: gradOrange, icon: 'fa-file' };
  }
}

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'settings' | 'components'>('preview');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && params.id) {
      loadTemplate();
    }
  }, [isAuthenticated, params.id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await templateBuilderApi.getTemplate(params.id as string);
      const data = response.data?.data || response.data;
      setTemplate(data);
    } catch (err: any) {
      console.error('Failed to load template:', err);
      setError(err?.response?.data?.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!template) return;
    try {
      await templateBuilderApi.publishTemplate(template.id);
      loadTemplate();
    } catch (err) {
      console.error('Failed to publish:', err);
    }
  };

  const handleArchive = async () => {
    if (!template) return;
    try {
      await templateBuilderApi.archiveTemplate(template.id);
      loadTemplate();
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  const handleDuplicate = async () => {
    if (!template) return;
    try {
      const response = await templateBuilderApi.duplicateTemplate(template.id);
      const newTemplate = response.data?.data || response.data;
      router.push(`/super-admin/templates/${newTemplate.id}`);
    } catch (err) {
      console.error('Failed to duplicate:', err);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-file-alt" style={{ fontSize: '22px', color: 'white' }}></i>
          </div>
          <div style={{ width: '40px', height: '40px', margin: '0 auto', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (error || !template) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-exclamation-triangle" style={{ fontSize: '28px', color: '#dc2626' }}></i>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 8px' }}>Template Not Found</h2>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px' }}>{error || 'This template could not be found or has been deleted.'}</p>
          <button onClick={() => router.push('/super-admin/templates')} style={{ padding: '10px 24px', background: gradBlue, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
            <i className="fa fa-arrow-left" style={{ marginRight: '8px' }}></i>Back to Templates
          </button>
        </div>
      </div>
    );
  }

  const catInfo = getCategoryLabel(template.templateType);
  const isPrimary = template.templateType === 'REPORT_CARD' && (template.name?.toLowerCase().includes('grade 1') || template.name?.toLowerCase().includes('grade 7') || template.name?.toLowerCase().includes('primary') || template.name?.toLowerCase().includes('continuous'));
  const isSecondary = template.templateType === 'REPORT_CARD' && (template.name?.toLowerCase().includes('grade 10') || template.name?.toLowerCase().includes('grade 11') || template.name?.toLowerCase().includes('grade 12') || template.name?.toLowerCase().includes('form 1') || template.name?.toLowerCase().includes('form 2'));
  const isAdvancedSecondary = template.templateType === 'REPORT_CARD' && (template.name?.toLowerCase().includes('form 5') || template.name?.toLowerCase().includes('form 6'));
  const isCertificate = template.templateType === 'CERTIFICATE';
  const isTranscript = template.templateType === 'TRANSCRIPT';
  const isAssessment = template.templateType === 'PROGRESS_REPORT';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
        <button onClick={() => router.push('/super-admin/templates')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 0, fontSize: '13px' }}>Report Templates</button>
        <i className="fa fa-chevron-right" style={{ fontSize: '10px' }}></i>
        <span style={{ color: '#1f2937', fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</span>
      </div>

      {/* Header */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <TemplateIcon type={template.templateType} size={52} />
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>{template.name}</h1>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', background: catInfo.gradient, color: 'white' }}>
                  <i className={`fa ${catInfo.icon}`} style={{ marginRight: '4px', fontSize: '10px' }}></i>{catInfo.label}
                </span>
                <span style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', background: template.status === 'PUBLISHED' ? '#d1fae5' : template.status === 'DRAFT' ? '#fef3c7' : '#fee2e2', color: template.status === 'PUBLISHED' ? '#065f46' : template.status === 'DRAFT' ? '#92400e' : '#991b1b', textTransform: 'capitalize' }}>
                  {template.status?.toLowerCase()}
                </span>
                {template.category && (
                  <span style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px', background: '#f3f4f6', color: '#374151' }}>
                    {template.category.name}
                  </span>
                )}
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>v{template.version}</span>
              </div>
              {template.description && (
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '8px 0 0', maxWidth: '600px' }}>{template.description}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleDuplicate} style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, background: '#f3f4f6', color: '#374151', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa fa-copy"></i> Duplicate
            </button>
            {template.status !== 'PUBLISHED' && (
              <button onClick={handlePublish} style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, background: gradGreen, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa fa-check-circle"></i> Publish
              </button>
            )}
            {template.status === 'PUBLISHED' && (
              <button onClick={handleArchive} style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, background: gradAmber, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa fa-archive"></i> Archive
              </button>
            )}
            <button onClick={() => router.push('/super-admin/templates')} style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, background: 'white', color: '#6b7280', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa fa-times"></i> Close
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#fefcf9', borderRadius: '12px', border: '1px solid #f3f4f6', padding: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {(['preview', 'settings', 'components'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '10px 20px', fontSize: '13px', fontWeight: 600,
            background: activeTab === tab ? catInfo.gradient : 'transparent',
            color: activeTab === tab ? 'white' : '#6b7280', border: 'none', borderRadius: '8px',
            cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            <i className={`fa ${tab === 'preview' ? 'fa-eye' : tab === 'settings' ? 'fa-cog' : 'fa-puzzle-piece'}`} style={{ fontSize: '12px' }}></i>
            {tab}
            {tab === 'components' && template.components && (
              <span style={{ background: activeTab === tab ? 'rgba(255,255,255,0.3)' : '#f3f4f6', padding: '1px 7px', borderRadius: '10px', fontSize: '11px' }}>{template.components.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'preview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
          {/* Preview */}
          <div style={{ background: '#f5efe8', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', minHeight: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: 0 }}>
                <i className="fa fa-eye" style={{ marginRight: '8px', color: '#ea6645' }}></i>Preview
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', color: '#9ca3af' }}>
                <i className="fa fa-expand"></i> {template.pageSize || 'A4'} · {template.orientation || 'portrait'}
              </div>
            </div>
            <div style={{ maxHeight: '700px', overflowY: 'auto', borderRadius: '12px' }}>
              {(isPrimary || template.name?.toLowerCase().includes('grade 1') || template.name?.toLowerCase().includes('grade 7')) && template.templateType === 'REPORT_CARD' && <PrimaryReportCardPreview template={template} />}
              {(isSecondary || (!isPrimary && !isAdvancedSecondary)) && template.templateType === 'REPORT_CARD' && !template.name?.toLowerCase().includes('grade 1') && !template.name?.toLowerCase().includes('grade 7') && !template.name?.toLowerCase().includes('form 5') && !template.name?.toLowerCase().includes('form 6') && <SecondaryReportCardPreview template={template} />}
              {isAdvancedSecondary && template.templateType === 'REPORT_CARD' && <AdvancedSecondaryPreview template={template} />}
              {isCertificate && <CertificatePreview template={template} />}
              {isTranscript && <TranscriptPreview template={template} />}
              {isAssessment && <AssessmentReportPreview template={template} />}
              {!isPrimary && !isSecondary && !isAdvancedSecondary && !isCertificate && !isTranscript && !isAssessment && (
                <div style={{ background: 'white', borderRadius: '16px', padding: '60px', textAlign: 'center', border: '1px solid #e8ddd0' }}>
                  <i className="fa fa-file" style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '16px', display: 'block' }}></i>
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>Preview not available for this template type.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Template Info Card */}
            <div style={{ background: '#fefcf9', borderRadius: '12px', border: '1px solid #f3f4f6', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 12px' }}><i className="fa fa-info-circle" style={{ marginRight: '6px', color: '#3b82f6' }}></i>Template Info</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#6b7280' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Type</span><span style={{ fontWeight: 500, color: '#374151' }}>{catInfo.label}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Version</span><span style={{ fontWeight: 500, color: '#374151' }}>{template.version}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Status</span><span style={{ fontWeight: 500, color: template.status === 'PUBLISHED' ? '#059669' : template.status === 'DRAFT' ? '#d97706' : '#dc2626', textTransform: 'capitalize' }}>{template.status?.toLowerCase() || 'Draft'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Default</span><span style={{ fontWeight: 500, color: '#374151' }}>{template.isDefault ? 'Yes' : 'No'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Page Size</span><span style={{ fontWeight: 500, color: '#374151' }}>{template.pageSize || 'A4'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Orientation</span><span style={{ fontWeight: 500, color: '#374151' }}>{template.orientation || 'Portrait'}</span></div>
              </div>
            </div>

            {/* Metadata Card */}
            <div style={{ background: '#fefcf9', borderRadius: '12px', border: '1px solid #f3f4f6', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 12px' }}><i className="fa fa-calendar" style={{ marginRight: '6px', color: '#8b5cf6' }}></i>Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#6b7280' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Created</span><span style={{ fontWeight: 500, color: '#374151' }}>{template.createdAt ? new Date(template.createdAt).toLocaleDateString() : '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Updated</span><span style={{ fontWeight: 500, color: '#374151' }}>{template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : '-'}</span></div>
              </div>
            </div>

            {/* Display Features Card */}
            <div style={{ background: '#fefcf9', borderRadius: '12px', border: '1px solid #f3f4f6', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 12px' }}><i className="fa fa-palette" style={{ marginRight: '6px', color: '#f59e0b' }}></i>Features</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                {[{ key: 'includeLogo', label: 'School Logo' }, { key: 'includeStamp', label: 'Official Stamp' }, { key: 'includeSignature', label: 'Signature' }, { key: 'includeGrading', label: 'Grading Table' }, { key: 'includeComments', label: 'Comments' }, { key: 'includeRankings', label: 'Rankings' }, { key: 'includeBestSix', label: 'Best Six' }, { key: 'remarksEnabled', label: 'Remarks' }].map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className={`fa ${(template as any)[f.key] ? 'fa-check-circle' : 'fa-circle'}`} style={{ fontSize: '12px', color: (template as any)[f.key] ? '#059669' : '#d1d5db' }}></i>
                    <span style={{ color: (template as any)[f.key] ? '#374151' : '#9ca3af' }}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>
            <i className="fa fa-cog" style={{ marginRight: '8px', color: '#ea6645' }}></i>Template Settings
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            <SettingField label="Name" value={template.name} />
            <SettingField label="Template Type" value={catInfo.label} />
            <SettingField label="Status" value={template.status?.toLowerCase() || 'draft'} capitalize />
            <SettingField label="Page Size" value={template.pageSize || 'A4'} />
            <SettingField label="Orientation" value={template.orientation || 'portrait'} capitalize />
            <SettingField label="Font Family" value={template.fontFamily || 'Arial'} />
            <SettingField label="Font Size" value={`${template.fontSize || 11}px`} />
            <SettingField label="Version" value={`v${template.version}`} />
            <SettingField label="Director Name" value={template.directorName || '-'} />
            {template.customRemarks && Array.isArray(template.customRemarks) && template.customRemarks.length > 0 && (
              <SettingField label="Custom Remarks" value={`${template.customRemarks.length} preset(s)`} />
            )}
          </div>

          {(template.primaryColor || template.secondaryColor) && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>Color Scheme</h3>
              <div style={{ display: 'flex', gap: '16px' }}>
                {template.primaryColor && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: template.primaryColor, border: '1px solid #e8ddd0' }}></div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}><div style={{ fontWeight: 500, color: '#374151' }}>Primary</div>{template.primaryColor}</div>
                  </div>
                )}
                {template.secondaryColor && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: template.secondaryColor, border: '1px solid #e8ddd0' }}></div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}><div style={{ fontWeight: 500, color: '#374151' }}>Secondary</div>{template.secondaryColor}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(template.marginTop !== undefined) && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>Margins (mm)</h3>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#6b7280' }}>
                <div>Top: <strong>{template.marginTop}</strong></div>
                <div>Bottom: <strong>{template.marginBottom}</strong></div>
                <div>Left: <strong>{template.marginLeft}</strong></div>
                <div>Right: <strong>{template.marginRight}</strong></div>
              </div>
            </div>
          )}

          {/* Certificate-specific settings */}
          {isCertificate && template.certificate && (
            <div style={{ marginTop: '24px', padding: '20px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', margin: '0 0 12px' }}>
                <i className="fa fa-award" style={{ marginRight: '8px' }}></i>Certificate Settings
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                <div><strong style={{ color: '#92400e' }}>Type:</strong> {template.certificate.certificateType}</div>
                <div><strong style={{ color: '#92400e' }}>Border:</strong> {template.certificate.borderStyle} ({template.certificate.borderColor})</div>
                <div><strong style={{ color: '#92400e' }}>QR Code:</strong> {template.certificate.showQrCode ? 'Yes' : 'No'}</div>
                <div><strong style={{ color: '#92400e' }}>Badge:</strong> {template.certificate.showBadge ? template.certificate.badgeStyle : 'No'}</div>
                <div><strong style={{ color: '#92400e' }}>Watermark:</strong> {template.certificate.showWatermark ? 'Yes' : 'No'}</div>
                <div><strong style={{ color: '#92400e' }}>Auto Numbering:</strong> {template.certificate.autoNumbering ? 'Yes (next: ' + template.certificate.nextNumber + ')' : 'No'}</div>
                {template.certificate.awardText && <div style={{ gridColumn: '1/-1' }}><strong style={{ color: '#92400e' }}>Award Text:</strong> "{template.certificate.awardText}"</div>}
                {template.certificate.signature1Label && <div><strong style={{ color: '#92400e' }}>Signature 1:</strong> {template.certificate.signature1Label}{template.certificate.signature1Name ? ` — ${template.certificate.signature1Name}` : ''}</div>}
                {template.certificate.signature2Label && <div><strong style={{ color: '#92400e' }}>Signature 2:</strong> {template.certificate.signature2Label}{template.certificate.signature2Name ? ` — ${template.certificate.signature2Name}` : ''}</div>}
              </div>
            </div>
          )}

          {/* Header/Footer Text */}
          {(template.headerText || template.footerText) && (
            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {template.headerText && (
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Header Text</h4>
                  <div style={{ fontSize: '13px', color: '#6b7280', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>{template.headerText}</div>
                </div>
              )}
              {template.footerText && (
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Footer Text</h4>
                  <div style={{ fontSize: '13px', color: '#6b7280', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>{template.footerText}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'components' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
              <i className="fa fa-puzzle-piece" style={{ marginRight: '8px', color: '#8b5cf6' }}></i>Template Components
              <span style={{ fontSize: '13px', fontWeight: 400, color: '#6b7280', marginLeft: '8px' }}>({template.components?.length || 0} total)</span>
            </h2>
            <div style={{ display: 'flex', gap: '4px', fontSize: '11px', color: '#9ca3af' }}>
              <i className="fa fa-arrows-alt-v"></i> Drag to reorder
            </div>
          </div>

          {template.components && template.components.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {template.components.map((comp: any, idx: number) => (
                <div key={comp.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                  background: idx % 2 === 0 ? '#f9fafb' : 'white', borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>
                    {idx + 1}
                  </div>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: comp.type === 'HEADER' ? gradBlue : comp.type === 'SUBJECT_TABLE' || comp.type === 'RESULT_TABLE' ? gradGreen : comp.type === 'STUDENT_INFO' ? gradPurple : comp.type === 'TEACHER_REMARKS' ? gradAmber : comp.type === 'SIGNATURE' ? gradTeal : comp.type === 'SCHOOL_LOGO' ? gradOrange : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0,
                  }}>
                    <i className={`fa ${comp.type === 'HEADER' ? 'fa-heading' : comp.type === 'SUBJECT_TABLE' || comp.type === 'RESULT_TABLE' ? 'fa-table' : comp.type === 'STUDENT_INFO' ? 'fa-user' : comp.type === 'TEACHER_REMARKS' ? 'fa-comment' : comp.type === 'SIGNATURE' ? 'fa-pen' : comp.type === 'SCHOOL_LOGO' ? 'fa-image' : comp.type === 'DIVIDER' ? 'fa-minus' : comp.type === 'PERFORMANCE_CHART' ? 'fa-chart-bar' : comp.type === 'ATTENDANCE_TABLE' ? 'fa-calendar' : comp.type === 'QR_CODE' ? 'fa-qrcode' : comp.type === 'BADGE' ? 'fa-certificate' : comp.type === 'WATERMARK' ? 'fa-tint' : 'fa-cube'}`} style={{ fontSize: '16px' }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>{comp.label || comp.type}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '8px' }}>
                      <span>{comp.type}</span>
                      {comp.isRequired && <span style={{ color: '#dc2626' }}>Required</span>}
                      {comp.isLocked && <span style={{ color: '#6b7280' }}>Locked</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'right' }}>
                    {comp.children?.length > 0 && <div>{comp.children.length} children</div>}
                    <div>Order: {comp.sortOrder}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <i className="fa fa-cubes" style={{ fontSize: '36px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No components defined for this template.</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>Use the Template Builder to add components.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingField({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937', textTransform: capitalize ? 'capitalize' : 'none' }}>{value}</div>
    </div>
  );
}
