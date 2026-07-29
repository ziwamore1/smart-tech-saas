'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { schoolApi, termApi } from '@/lib/api';
import { RoleGuard } from '@/lib/role-guard';

export default function HODDashboardPage() {
  return (
    <RoleGuard requiredRoles={['HOD', 'Director', 'Deputy Director', 'Head Teacher', 'Deputy Head']}>
      <HODDashboardContent />
    </RoleGuard>
  );
}

function HODDashboardContent() {
  const { user } = useAuth();

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getCurrentSchool().then(r => r.data?.data || r.data),
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data?.data || r.data),
  });

  const departmentActions = [
    { name: 'Subjects', href: '/dashboard/subjects', icon: 'fa-book', desc: 'Manage department subjects', color: '#f59e0b' },
    { name: 'Curriculum', href: '/dashboard/curriculum', icon: 'fa-book-open', desc: 'Curriculum and syllabus tracking', color: '#0891b2' },
    { name: 'Lesson Plans', href: '/dashboard/lesson-plans', icon: 'fa-clipboard-list', desc: 'Review and approve lesson plans', color: '#f59e0b' },
    { name: 'SBA Tasks', href: '/dashboard/sba-tasks', icon: 'fa-tasks', desc: 'School-based assessment tasks', color: '#22c55e' },
    { name: 'Topics & Subtopics', href: '/dashboard/topics', icon: 'fa-sitemap', desc: 'Topic coverage tracking', color: '#06b6d4' },
    { name: 'Elements of Construct', href: '/dashboard/elements-of-construct', icon: 'fa-puzzle-piece', desc: 'Assessment blueprint', color: '#8b5cf6' },
  ];

  const oversightActions = [
    { name: 'Assessment Oversight', href: '/dashboard/assessment-oversight', icon: 'fa-eye', desc: 'Monitor assessment completion', color: '#7c3aed' },
    { name: 'Teacher Performance', href: '/dashboard/teacher-performance', icon: 'fa-chart-bar', desc: 'Department teacher evaluations', color: '#0891b2' },
    { name: 'Results Analytics', href: '/dashboard/result-analytics', icon: 'fa-chart-line', desc: 'Subject performance analytics', color: '#059669' },
    { name: 'Exam Quality', href: '/dashboard/exam-quality', icon: 'fa-clipboard-check', desc: 'Exam quality analysis', color: '#f97316' },
    { name: 'Results Management', href: '/dashboard/results-management', icon: 'fa-file-alt', desc: 'Verify department results', color: '#ea6645' },
    { name: 'Score Entry', href: '/dashboard/assessment-entry', icon: 'fa-edit', desc: 'Enter assessment scores', color: '#2563eb' },
    { name: 'Assessments', href: '/dashboard/assessments', icon: 'fa-clipboard-check', desc: 'Manage assessments', color: '#f97316' },
    { name: 'Report Cards', href: '/dashboard/report-cards', icon: 'fa-file-text', desc: 'Review report cards', color: '#0891b2' },
  ];

  const classActions = [
    { name: 'Classes', href: '/dashboard/classes', icon: 'fa-school', desc: 'Manage classes', color: '#8b5cf6' },
    { name: 'Class List', href: '/dashboard/class-list', icon: 'fa-list-alt', desc: 'Student enrollment by class', color: '#06b6d4' },
    { name: 'Timetable', href: '/timetable', icon: 'fa-calendar-alt', desc: 'Department timetable', color: '#ec4899' },
    { name: 'Digital Stamps', href: '/dashboard/digital-stamps', icon: 'fa-stamp', desc: 'Digital stamps and verification', color: '#7c3aed' },
  ];

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        borderRadius: '12px', padding: '24px', marginBottom: '24px', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                <i className="fa fa-users-cog"></i>
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  Head of Department Dashboard
                </h1>
                <p style={{ fontSize: '14px', color: '#e9d5ff', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{user?.firstName} {user?.lastName}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                    {schoolProfile?.name || 'Secondary School'}
                  </span>
                </p>
              </div>
            </div>
            {currentTerm && (
              <p style={{ fontSize: '13px', color: '#e9d5ff', margin: '8px 0 0' }}>
                <i className="fa fa-calendar" style={{ marginRight: '6px' }} />
                Current Term: {currentTerm.name}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          <i className="fa fa-layer-group mr-2" style={{ color: '#7c3aed' }}></i>
          Department Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {departmentActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors text-sm">{action.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          <i className="fa fa-eye mr-2" style={{ color: '#7c3aed' }}></i>
          Teaching & Assessment Oversight
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {oversightActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors text-sm">{action.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          <i className="fa fa-school mr-2" style={{ color: '#8b5cf6' }}></i>
          Classes & Scheduling
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {classActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors text-sm">{action.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
