'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { schoolApi, termApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Icon3D from '@/components/Icon3D';
import { SchoolLogo } from '@/components/SchoolLogo';

const quickActions = [
  { name: 'Form Classes', href: '/dashboard/classes', icon3d: 'classes', desc: 'Manage Form 1–6 classes' },
  { name: 'Students', href: '/dashboard/students', icon3d: 'students', desc: 'Student admissions & records' },
  { name: 'Teachers', href: '/dashboard/teachers', icon3d: 'teachers', desc: 'Teaching staff management' },
  { name: 'Timetable', href: '/timetable', icon3d: 'timetable', desc: 'Lesson scheduling' },
  { name: 'Exams', href: '/dashboard/exams', icon3d: 'exam', desc: 'GCE & internal exams' },
  { name: 'Results', href: '/dashboard/results', icon3d: 'results', desc: 'GCE grading & analysis' },
  { name: 'Report Cards', href: '/dashboard/report-cards', icon3d: 'reports', desc: 'Cumulative reports' },
  { name: 'Analytics', href: '/dashboard/analytics', icon3d: 'analytics', desc: 'Performance analytics' },
];

export default function SecondaryDashboardPage() {
  const { user } = useAuth();

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getCurrentSchool().then(res => res.data?.data || res.data),
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(res => res.data?.data || res.data),
  });

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <SchoolLogo />
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
            {schoolProfile?.name || 'Secondary School'}
          </h1>
          <span style={{
            fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.2)',
            padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)'
          }}>
            Secondary School
          </span>
        </div>
        <p style={{ fontSize: '14px', opacity: 0.9, margin: '0 0 8px' }}>
          <i className="fa fa-graduation-cap" style={{ marginRight: '6px' }}></i>
          Form (1–6) — ECZ Form 5 + GCE
        </p>
        {currentTerm && (
          <p style={{ fontSize: '13px', opacity: 0.8, margin: 0 }}>
            <i className="fa fa-calendar" style={{ marginRight: '6px' }}></i>
            Current Term: {currentTerm.name}
          </p>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        {quickActions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            style={{
              background: '#fefcf9',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e8ddd0',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <Icon3D name={action.icon3d} size={40} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>{action.name}</h3>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{action.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
