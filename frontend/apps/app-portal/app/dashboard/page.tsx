'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { schoolApi, subscriptionApi, termApi, academicYearApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Icon3D from '@/components/Icon3D';
import { INSTITUTION_TYPE_LABELS, INSTITUTION_TYPE_FEATURES, InstitutionTypeCode } from '@/lib/institution-types';
import { accessApi } from '@/lib/api';
import { useSchoolSocket } from '@/lib/use-school-socket';

export default function DashboardPage() {
  const { user, allRoles, isSuperAdmin, isPureSuperAdmin, isDirector } = useAuth();
  const canViewLive = isDirector || allRoles.some((r: string) => ['Deputy Director', 'Head Teacher'].includes(r));
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [liveActivities, setLiveActivities] = useState<any[]>([]);

  const { data: schoolData, isLoading: schoolLoading, error: schoolError } = useQuery({
    queryKey: ['school', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      try {
        // Use /school/ endpoint which works correctly
        const res = await schoolApi.getAll();
        
        // Extract data from response: {statusCode, data: {data: schools[]}}
        const outerData = res.data?.data || res.data;
        const schools = outerData?.data || outerData;
        
        // Find the school by ID
        const school = Array.isArray(schools) 
          ? schools.find((s: any) => s.id === user.schoolId)
          : null;
        
        console.log('[Dashboard] School found:', school);
        return school;
      } catch (err: any) {
        console.error('[Dashboard] School API error:', err);
        return null;
      }
    },
    retry: false,
    enabled: !!user?.schoolId,
  });

  const { data: statsData } = useQuery({
    queryKey: ['school-stats'],
    queryFn: () => schoolApi.getStats().then(res => {
      const data = res.data?.data || res.data;
      return data;
    }),
    retry: false,
  });

  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.checkStatus().then(res => {
      const data = res.data?.data || res.data;
      return data;
    }),
    retry: false,
  });

  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await academicYearApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    retry: false,
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: async () => {
      const res = await termApi.getCurrent();
      const data = res.data?.data || res.data;
      return data;
    },
    retry: false,
  });

  const { isLoading: liveResultsLoading } = useQuery({
    queryKey: ['live-results', user?.schoolId, selectedTermId || currentTerm?.id],
    queryFn: async () => {
      const res = await accessApi.getLiveResults(selectedTermId || currentTerm?.id);
      const data = res.data?.data || res.data || [];
      const results = Array.isArray(data) ? data : [];
      setLiveActivities(results);
      return results;
    },
    enabled: !!canViewLive && !!user?.schoolId && !!currentTerm?.id,
    refetchInterval: 30000,
  });

  useSchoolSocket({
    'results:live': (activity) => {
      setLiveActivities((current) => [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, 30));
    },
  });

  const { data: allTerms } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    retry: false,
  });

  const school = schoolData;
  const stats = statsData;
  const subscription = subscriptionData;
  const academicYears = Array.isArray(academicYearsData) ? academicYearsData : [];
  const terms = Array.isArray(allTerms) ? allTerms : [];

  const currentAcademicYear = academicYears.find((y: any) => y.isCurrent);
  const currentYearId = selectedAcademicYearId || currentAcademicYear?.id;
  const currentYearTerms = terms.filter((t: any) => t.academicYearId === currentYearId);
  const selectedTerm = selectedTermId ? terms.find((t: any) => t.id === selectedTermId) : null;

  const statsCards = [
    { name: 'Students', value: stats?.totalStudents || 0, icon3d: 'students' },
    { name: 'Teachers', value: stats?.totalTeachers || 0, icon3d: 'teachers' },
    { name: 'Classes', value: stats?.totalClasses || 0, icon3d: 'classes' },
    { name: 'Subjects', value: stats?.totalSubjects || 0, icon3d: 'subjects' },
  ];

  const studentsByClass = stats?.studentsByClass || [];

  const quickActions = [
    { name: 'Students', href: '/dashboard/students', icon3d: 'students' },
    { name: 'Teachers', href: '/dashboard/teachers', icon3d: 'teachers' },
    { name: 'Timetable', href: '/timetable', icon3d: 'timetable' },
    { name: 'Results', href: '/dashboard/results', icon3d: 'results' },
    { name: 'Classes', href: '/dashboard/classes', icon3d: 'classes' },
    { name: 'Subjects', href: '/dashboard/subjects', icon3d: 'subjects' },
    { name: 'Result Entry', href: '/dashboard/results-management/result-entry', icon3d: 'assessments' },
    { name: 'Fees', href: '/dashboard/fees', icon3d: 'fees' },
  ];

  const intelligenceModules = [
    { name: 'AI Tutor', href: '/dashboard/ai-tutor', icon3d: 'ai', desc: 'Intelligent tutoring assistant' },
    { name: 'Benchmarking', href: '/dashboard/benchmarking', icon3d: 'results', desc: 'National comparisons' },
    { name: 'Psychometric', href: '/dashboard/psychometric', icon3d: 'analytics', desc: 'Exam reliability analysis' },
    { name: 'Adaptive Testing', href: '/dashboard/adaptive-testing', icon3d: 'exam', desc: 'IRT-based assessments' },
    { name: 'Learning Style', href: '/dashboard/learning-style', icon3d: 'intelligence', desc: 'VARK assessment' },
    { name: 'Exam Quality', href: '/dashboard/exam-quality', icon3d: 'assessments', desc: 'Quality & inflation detection' },
    { name: 'Analytics', href: '/dashboard/analytics', icon3d: 'analytics', desc: 'Standard analytics dashboard' },
    { name: 'Enhanced Analytics', href: '/dashboard/analytics-enhanced', icon3d: 'analytics', desc: 'Advanced ECharts visualizations' },
  ];

  return (
    <div>
      {/* School Header */}
      {school && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>{school.name}</h1>
            {school.institutionType && (
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 12px',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.3)'
              }}>
                {INSTITUTION_TYPE_LABELS[school.institutionType as InstitutionTypeCode] || school.institutionType}
              </span>
            )}
            {allRoles && allRoles.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {allRoles.filter((r, i, arr) => arr.indexOf(r) === i).map((role) => (
                  <span key={role} style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    background: role === 'SuperAdmin' ? 'rgba(239,68,68,0.3)' : role === 'Director' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.15)',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.25)'
                  }}>
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p style={{ fontSize: '14px', opacity: 0.9, margin: '0 0 8px' }}>
            {school.email && <span style={{ marginRight: '16px' }}><i className="fa fa-envelope" style={{ marginRight: '6px' }}></i>{school.email}</span>}
            {school.phone && <span><i className="fa fa-phone" style={{ marginRight: '6px' }}></i>{school.phone}</span>}
          </p>
          {school.institutionType && (
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', opacity: 0.85 }}>
              <span><i className="fa fa-layer-group" style={{ marginRight: '6px' }}></i>{INSTITUTION_TYPE_FEATURES[school.institutionType as InstitutionTypeCode]?.classStructure || ''}</span>
              <span><i className="fa fa-graduation-cap" style={{ marginRight: '6px' }}></i>{INSTITUTION_TYPE_FEATURES[school.institutionType as InstitutionTypeCode]?.gradingSystem || ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Alerts Section */}
      {academicYears.length === 0 && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <i className="fa fa-exclamation-triangle"></i>
            </div>
            <div>
              <p style={{ fontWeight: 600, color: '#92400e', margin: 0 }}>Setup Required</p>
              <p style={{ fontSize: '13px', color: '#b45309', margin: 0 }}>
                Create an academic year to get started
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/settings"
            style={{
              padding: '10px 20px',
              background: '#f59e0b',
              color: 'white',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa fa-cog"></i>
            Go to Settings
          </Link>
        </div>
      )}

      {subscription?.status === 'trial' && subscription.daysLeft !== undefined && (
        <div style={{
          background: '#fff5f3',
          border: '1px solid #ea6645',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#ea6645',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <i className="fa fa-clock"></i>
            </div>
            <div>
              <p style={{ fontWeight: 600, color: '#c2410c', margin: 0 }}>
                Trial Period - {subscription.daysLeft} days remaining
              </p>
              <p style={{ fontSize: '13px', color: '#ea580c', margin: 0 }}>
                Upgrade to access all premium features
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/subscription"
            style={{
              padding: '10px 20px',
              background: '#ea6645',
              color: 'white',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa fa-rocket"></i>
            Upgrade Now
          </Link>
        </div>
      )}

      {subscription?.status === 'expired' && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <i className="fa fa-exclamation-circle"></i>
            </div>
            <div>
              <p style={{ fontWeight: 600, color: '#991b1b', margin: 0 }}>Subscription Expired</p>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>
                Renew to continue using the system
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/subscription"
            style={{
              padding: '10px 20px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa fa-redo"></i>
            Renew Now
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {statsCards.map((card) => (
          <div
            key={card.name}
            style={{
              background: '#fefcf9',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s',
              border: '1px solid #e8ddd0'
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
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280', margin: 0 }}>
                {card.name}
              </p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: '8px 0 0' }}>
                {card.value}
              </p>
            </div>
            <div style={{
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon3D name={card.icon3d} size={52} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Academic Year Selector */}
        <div style={{
          background: '#fefcf9',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e8ddd0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
              <i className="fa fa-calendar-alt" style={{ color: '#ea6645', marginRight: '8px' }}></i>
              Academic Period
            </h3>
          </div>
           
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px', display: 'block' }}>
                Academic Year
              </label>
              <select
                value={currentYearId || ''}
                onChange={(e) => {
                  setSelectedAcademicYearId(e.target.value || null);
                  setSelectedTermId(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: '1px solid #e8ddd0',
                  borderRadius: '8px',
                  background: '#fefcf9',
                  cursor: 'pointer'
                }}
            >
              {academicYears.length === 0 ? (
                <option value="">No academic years</option>
              ) : (
                academicYears.map((year: any) => (
                  <option key={year.id} value={year.id}>
                    {year.name} {year.isCurrent ? '(Current)' : ''}
                  </option>
                ))
              )}
            </select>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px', display: 'block' }}>
                Term
              </label>
              <select
                value={selectedTermId || ''}
                onChange={(e) => setSelectedTermId(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: '1px solid #e8ddd0',
                  borderRadius: '8px',
                  background: '#fefcf9',
                  cursor: 'pointer'
                }}
                disabled={!currentYearId || currentYearTerms.length === 0}
              >
                <option value="">Select Term</option>
                {currentYearTerms.map((term: any) => (
                  <option key={term.id} value={term.id}>
                    {term.name} {term.isCurrent ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{
              background: '#f5efe8',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>Selected Term</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>
                  {selectedTerm?.name || currentTerm?.name || 'Not Set'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>Terms This Year</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>
                  {currentYearTerms.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Info */}
        <div style={{
          background: '#fefcf9',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e8ddd0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
              <i className="fa fa-credit-card" style={{ color: '#ea6645', marginRight: '8px' }}></i>
              Subscription
            </h3>
            <Link 
              href="/dashboard/subscription"
              style={{
                fontSize: '13px',
                color: '#ea6645',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Manage <i className="fa fa-arrow-right"></i>
            </Link>
          </div>
           
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              background: '#f5efe8',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: '18px',
                textTransform: 'uppercase'
              }}>
                {subscription?.tier?.[0] || 'B'}
              </div>
              <div>
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
                  {subscription?.tier || 'Basic'} Plan
                </p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                  {subscription?.status === 'active' ? 'Active' : subscription?.status === 'trial' ? 'Trial Period' : 'Inactive'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Status</span>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '9999px',
                background: subscription?.status === 'active' ? '#d1fae5' : subscription?.status === 'trial' ? '#fef3c7' : '#fee2e2',
                color: subscription?.status === 'active' ? '#059669' : subscription?.status === 'trial' ? '#d97706' : '#dc2626'
              }}>
                {subscription?.status || 'Unknown'}
              </span>
            </div>

            {subscription?.expiresAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>Expires</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>
                  {new Date(subscription.expiresAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Students by Class */}
      {studentsByClass.length > 0 && (
        <div style={{
          background: '#fefcf9',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e8ddd0',
          marginBottom: '32px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>
            <i className="fa fa-users" style={{ color: '#ea6645', marginRight: '8px' }}></i>
            Students by Class
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '12px'
          }}>
            {studentsByClass.map((cls: any) => (
              <Link
                key={cls.classId}
                href={`/dashboard/students?class=${cls.classId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: '#f2ebe3',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  border: '1px solid transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eff6ff';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f2ebe3';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>{cls.className}</span>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#3b82f6'
                }}>
                  {cls.count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Intelligence Modules - Admin only */}
      {(isPureSuperAdmin || isDirector) && (
      <div style={{
        background: '#fefcf9',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e8ddd0',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
            <i className="fa fa-brain" style={{ color: '#14b8a6', marginRight: '8px' }}></i>
            Intelligence & Analytics
          </h3>
          <Link
            href="/dashboard/analytics-enhanced"
            style={{
              fontSize: '13px', color: '#14b8a6', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500
            }}
          >
            View All <i className="fa fa-arrow-right" style={{ fontSize: '11px' }}></i>
          </Link>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          {intelligenceModules.map((mod) => (
            <Link
              key={mod.name}
              href={mod.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px',
                borderRadius: '10px',
                textDecoration: 'none',
                transition: 'all 0.2s',
                border: '1px solid #e8ddd0',
                background: '#fefcf9'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                e.currentTarget.style.borderColor = '#ea6645';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#e8ddd0';
              }}
            >
              <div style={{
                width: '42px', height: '42px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon3D name={mod.icon3d} size={40} />
              </div>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block' }}>
                  {mod.name}
                </span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{mod.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      )}

      {/* Institution Type Modules */}
      {school?.institutionType && (
        <div style={{
          background: '#fefcf9',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e8ddd0',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
            <i className="fa fa-layer-group" style={{ color: '#059669', marginRight: '8px' }}></i>
            {INSTITUTION_TYPE_LABELS[school.institutionType as InstitutionTypeCode]} Modules
          </h3>
          {(() => {
            const typeCode = typeof school.institutionType === 'string' ? school.institutionType : school.institutionType?.code || '';
            const typeColors: Record<string, { bg: string; text: string; border: string }> = {
              PRIMARY_SCHOOL: { bg: '#f0fdf4', text: '#16a34a', border: '#dcfce7' },
              SECONDARY_SCHOOL: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
              ADVANCED_SECONDARY: { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
              COLLEGE: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
              UNIVERSITY: { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8' },
            };
            const colors = typeColors[typeCode] || typeColors.PRIMARY_SCHOOL;
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {INSTITUTION_TYPE_FEATURES[typeCode as InstitutionTypeCode]?.keyModules.map((mod: string) => (
                  <span key={mod} style={{
                    fontSize: '12px', fontWeight: 500, padding: '6px 14px',
                    borderRadius: '20px', background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                  }}>
                    {mod}
                  </span>
                ))}
                <Link
                  href={`/dashboard/${typeCode.toLowerCase().replace(/_/g, '-')}`}
                  style={{
                    fontSize: '12px', fontWeight: 500, padding: '6px 14px',
                    borderRadius: '20px', background: '#fefcf9', color: colors.text,
                    border: `1px solid ${colors.text}`, textDecoration: 'none',
                  }}
                >
                  <i className="fa fa-external-link-alt" style={{ marginRight: '4px' }}></i>
                  Open {INSTITUTION_TYPE_LABELS[typeCode as InstitutionTypeCode]} Dashboard
                </Link>
              </div>
            );
          })()}
        </div>
      )}

      {/* Live Results Monitoring */}
      {canViewLive && (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', marginBottom: '24px', color: '#0f172a', boxShadow: '0 12px 30px rgba(15,23,42,0.10)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#059669', boxShadow: '0 0 0 5px rgba(5,150,105,0.16)' }} />
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Live Results Monitoring</h2>
              </div>
              <p style={{ margin: '8px 0 0', color: '#475569', fontSize: '13px' }}>See who is entering results, for which class and subject, as work happens.</p>
            </div>
            <span style={{ color: '#047857', background: '#ecfdf5', fontSize: '12px', fontWeight: 700, padding: '7px 10px', border: '1px solid #a7f3d0', borderRadius: '999px' }}>LIVE · AUTO-SYNC</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {[
              ['Entries tracked', liveActivities.length, '#bfdbfe'],
              ['Teachers active', new Set(liveActivities.map((item: any) => item.teacher?.id || item.teacherId || item.teacherName)).size, '#bbf7d0'],
              ['Classes covered', new Set(liveActivities.map((item: any) => item.class?.id || item.classId || item.className)).size, '#fde68a'],
              ['Subjects covered', new Set(liveActivities.map((item: any) => item.subject?.id || item.subjectId || item.subjectName)).size, '#fbcfe8'],
            ].map(([label, value, color]) => <div key={label as string} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}><div style={{ color: color === '#bfdbfe' ? '#1d4ed8' : color === '#bbf7d0' ? '#047857' : color === '#fde68a' ? '#b45309' : '#be185d', fontSize: '22px', fontWeight: 800 }}>{value}</div><div style={{ color: '#475569', fontSize: '11px', fontWeight: 600, marginTop: '3px' }}>{label}</div></div>)}
          </div>
          {liveResultsLoading && liveActivities.length === 0 ? <div style={{ padding: '28px 0', color: '#475569' }}>Loading recent activity...</div> : liveActivities.length === 0 ? <div style={{ padding: '28px 0', color: '#475569' }}>No result entries have been recorded for the current term yet.</div> : (
            <div style={{ display: 'grid', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
              {liveActivities.map((activity: any) => (
                <div key={`${activity.id}-${activity.timestamp}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', alignItems: 'center', gap: '14px', padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <div><div style={{ color: '#0f172a', fontWeight: 700, fontSize: '14px' }}>{activity.teacherName || `${activity.teacher?.firstName || ''} ${activity.teacher?.lastName || ''}`.trim() || 'Teacher'}</div><div style={{ color: '#475569', fontSize: '11px', marginTop: '3px' }}>entered a result</div></div>
                  <div><div style={{ color: '#1d4ed8', fontSize: '13px', fontWeight: 600 }}>{activity.className || activity.class?.name || 'Class'}</div><div style={{ color: '#475569', fontSize: '11px' }}>Class</div></div>
                  <div><div style={{ color: '#b45309', fontSize: '13px', fontWeight: 600 }}>{activity.subjectName || activity.subject?.name || 'Subject'}</div><div style={{ color: '#475569', fontSize: '11px' }}>Subject</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ color: '#047857', fontWeight: 700, fontSize: '15px' }}>{activity.score ?? '--'}%</div><div style={{ color: '#475569', fontSize: '11px' }}>{activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{
        background: '#fefcf9',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e8ddd0'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>
          <i className="fa fa-bolt" style={{ color: '#ea6645', marginRight: '8px' }}></i>
          Quick Actions
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '12px'
        }}>
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                padding: '20px 16px',
                background: '#fefcf9',
                borderRadius: '10px',
                textDecoration: 'none',
                transition: 'all 0.2s',
                border: '1px solid #e8ddd0'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = '#ea6645';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#e8ddd0';
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon3D name={action.icon3d} size={44} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151', textAlign: 'center' }}>
                {action.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
