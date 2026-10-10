'use client';

import { useQuery } from '@tanstack/react-query';
import { schoolApi, termApi } from '@/lib/api';
import { SchoolLogo } from '@/components/SchoolLogo';
import SchoolPerformanceOverview from '@/components/dashboard/SchoolPerformanceOverview';
import TierActionGrid from '@/components/dashboard/TierActionGrid';
import { SubscriptionTier } from '@/types/subscription';

const tierActions = {
  BASIC: [
    { name: 'Form Classes', href: '/dashboard/classes', icon3d: 'classes', desc: 'Advanced Level Form classes', featureKey: 'classes.view' },
    { name: 'Students', href: '/dashboard/students', icon3d: 'students', desc: 'Student records and admissions', featureKey: 'students.view' },
    { name: 'Teachers', href: '/dashboard/teachers', icon3d: 'teachers', desc: 'Teaching staff', featureKey: 'teachers.view' },
    { name: 'Subject Selection', href: '/dashboard/subjects', icon3d: 'subjects', desc: 'A-Level subject choices', featureKey: 'subjects.view' },
  ],
  STANDARD: [
    { name: 'Exams', href: '/dashboard/exams', icon3d: 'exam', desc: 'GCE Advanced Level exams', featureKey: 'exams.view' },
    { name: 'Results', href: '/dashboard/results', icon3d: 'results', desc: 'A-Level grading and analysis', featureKey: 'results.view' },
    { name: 'Report Cards', href: '/dashboard/report-cards', icon3d: 'reports', desc: 'Academic transcripts', featureKey: 'reports.generate' },
    { name: 'Fees', href: '/dashboard/fees', icon3d: 'fees', desc: 'Fee structures and collections', featureKey: 'fees.view' },
  ],
  PREMIUM: [
    { name: 'Enhanced Analytics', href: '/dashboard/analytics-enhanced', icon3d: 'analytics', desc: 'Advanced performance intelligence', featureKey: 'analytics.advanced' },
    { name: 'Benchmarking', href: '/dashboard/benchmarking', icon3d: 'results', desc: 'Compare results against benchmarks', featureKey: 'analytics.advanced' },
    { name: 'AI Analytics', href: '/dashboard/analytics/ai', icon3d: 'analytics', desc: 'AI-powered performance insights', featureKey: 'analytics.ai' },
  ],
};

export default function AdvancedSecondaryDashboardPage() {
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
        background: 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <SchoolLogo />
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
            {schoolProfile?.name || 'Advanced Secondary'}
          </h1>
          <span style={{
            fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.2)',
            padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)'
          }}>
            Advanced Secondary
          </span>
        </div>
        <p style={{ fontSize: '14px', opacity: 0.9, margin: '0 0 8px' }}>
          <i className="fa fa-graduation-cap" style={{ marginRight: '6px' }}></i>
          Form (1–6) — GCE Advanced Level
        </p>
        {currentTerm && (
          <p style={{ fontSize: '13px', opacity: 0.8, margin: 0 }}>
            <i className="fa fa-calendar" style={{ marginRight: '6px' }}></i>
            Current Term: {currentTerm.name}
          </p>
        )}
      </div>

      <SchoolPerformanceOverview termId={currentTerm?.id} accent="#7c3aed" />
      <div style={{ height: 24 }} />
      <TierActionGrid currentTier={(schoolProfile?.subscriptionTier || 'BASIC').toUpperCase() as SubscriptionTier} actions={tierActions} />
    </div>
  );
}
