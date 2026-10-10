'use client';

import { useQuery } from '@tanstack/react-query';
import { schoolApi, termApi } from '@/lib/api';
import { SchoolLogo } from '@/components/SchoolLogo';
import SchoolPerformanceOverview from '@/components/dashboard/SchoolPerformanceOverview';
import TierActionGrid from '@/components/dashboard/TierActionGrid';
import { SubscriptionTier } from '@/types/subscription';

const tierActions = {
  BASIC: [
    { name: 'Programs', href: '/dashboard/classes', icon3d: 'classes', desc: 'Degree and diploma programs', featureKey: 'classes.view' },
    { name: 'Students', href: '/dashboard/students', icon3d: 'students', desc: 'Student enrollment and records', featureKey: 'students.view' },
    { name: 'Lecturers', href: '/dashboard/teachers', icon3d: 'teachers', desc: 'Faculty management', featureKey: 'teachers.view' },
    { name: 'Courses', href: '/dashboard/subjects', icon3d: 'subjects', desc: 'Course catalogue', featureKey: 'subjects.view' },
  ],
  STANDARD: [
    { name: 'Result Entry', href: '/dashboard/results-management/result-entry', icon3d: 'assessments', desc: 'Continuous assessment', featureKey: 'results.add' },
    { name: 'Transcripts', href: '/dashboard/report-cards', icon3d: 'reports', desc: 'Academic transcripts', featureKey: 'reports.generate' },
    { name: 'Enrollment', href: '/dashboard/enrollment', icon3d: 'students', desc: 'Semester enrollment', featureKey: 'students.manage' },
    { name: 'Fees', href: '/dashboard/fees', icon3d: 'fees', desc: 'Fee structures and collections', featureKey: 'fees.view' },
  ],
  PREMIUM: [
    { name: 'Enhanced Analytics', href: '/dashboard/analytics-enhanced', icon3d: 'analytics', desc: 'Advanced performance intelligence', featureKey: 'analytics.advanced' },
    { name: 'Research', href: '/dashboard/research', icon3d: 'intelligence', desc: 'Research management', featureKey: 'research.manage' },
    { name: 'Online Payments', href: '/dashboard/fees/online', icon3d: 'fees', desc: 'Payment gateway and reconciliation', featureKey: 'fees.onlinePayment' },
  ],
};

export default function CollegeDashboardPage() {
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
        background: 'linear-gradient(135deg, #0369a1 0%, #06b6d4 100%)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <SchoolLogo />
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
            {schoolProfile?.name || 'College'}
          </h1>
          <span style={{
            fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.2)',
            padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)'
          }}>
            College
          </span>
        </div>
        <p style={{ fontSize: '14px', opacity: 0.9, margin: '0 0 8px' }}>
          <i className="fa fa-graduation-cap" style={{ marginRight: '6px' }}></i>
          Year (1–4) — Semester GPA
        </p>
        {currentTerm && (
          <p style={{ fontSize: '13px', opacity: 0.8, margin: 0 }}>
            <i className="fa fa-calendar" style={{ marginRight: '6px' }}></i>
            Current Semester: {currentTerm.name}
          </p>
        )}
      </div>

      <SchoolPerformanceOverview termId={currentTerm?.id} accent="#0891b2" />
      <div style={{ height: 24 }} />

      <TierActionGrid currentTier={(schoolProfile?.subscriptionTier || 'BASIC').toUpperCase() as SubscriptionTier} actions={tierActions} />
    </div>
  );
}
