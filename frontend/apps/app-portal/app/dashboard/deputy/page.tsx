'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { schoolApi, termApi, attendanceApi } from '@/lib/api';
import { useMemo, useState } from 'react';
import { RoleGuard } from '@/lib/role-guard';
import Icon3D from '@/components/Icon3D';

export default function DeputyDashboardPage() {
  return (
    <RoleGuard requiredRoles={['Deputy', 'Deputy Director', 'Deputy Head', 'Director', 'Head Teacher', 'HOD']}>
      <DeputyDashboardContent />
    </RoleGuard>
  );
}

function DeputyDashboardContent() {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getCurrentSchool().then(r => r.data?.data || r.data),
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data?.data || r.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['school-stats'],
    queryFn: () => schoolApi.getStats().then(r => r.data?.data || r.data),
  });

  const totalStudents = statsData?.totalStudents || 0;
  const totalTeachers = statsData?.totalTeachers || 0;
  const totalClasses = statsData?.totalClasses || 0;
  const studentsByClass: any[] = statsData?.studentsByClass || [];

  const { data: attendanceStats } = useQuery({
    queryKey: ['attendance-stats', currentTerm?.id],
    queryFn: () => attendanceApi.getStats({ termId: currentTerm?.id }).then(r => r.data?.data || r.data),
    enabled: !!currentTerm?.id,
  });

  const gradeEnrollment = useMemo(() => {
    if (!studentsByClass.length) return [];
    return studentsByClass.map((c: any) => ({
      grade: c.className || c.class || 'Unknown',
      count: (c.male || 0) + (c.female || 0),
    }));
  }, [studentsByClass]);

  const supervisionActions = [
    { name: 'Assessment Oversight', href: '/dashboard/assessment-oversight', icon: 'fa-eye', desc: 'Monitor assessment completion across classes', color: '#7c3aed' },
    { name: 'Teacher Performance', href: '/dashboard/teacher-performance', icon: 'fa-chart-bar', desc: 'Evaluate teaching staff performance', color: '#0891b2' },
    { name: 'Attendance Dashboard', href: '/dashboard/attendance/dashboard', icon: 'fa-chart-pie', desc: 'Attendance analytics and reports', color: '#0d9488' },
    { name: 'Results Analytics', href: '/dashboard/result-analytics', icon: 'fa-chart-line', desc: 'Academic performance trends', color: '#059669' },
    { name: 'Staff Returns Hub', href: '/dashboard/staff-records', icon: 'fa-id-card', desc: 'HR records and staff profiles', color: '#a855f7' },
    { name: 'Timetable', href: '/timetable', icon: 'fa-calendar-alt', desc: 'Lesson scheduling overview', color: '#ec4899' },
    { name: 'Analytics', href: '/dashboard/analytics', icon: 'fa-chart-bar', desc: 'School performance analytics', color: '#a855f7' },
    { name: 'Benchmarking', href: '/dashboard/benchmarking', icon: 'fa-trophy', desc: 'Compare with national standards', color: '#f59e0b' },
    { name: 'Exam Quality', href: '/dashboard/exam-quality', icon: 'fa-clipboard-check', desc: 'Exam quality & inflation detection', color: '#f97316' },
    { name: 'Results Management', href: '/dashboard/results-management', icon: 'fa-file-alt', desc: 'Verify and submit results', color: '#ea6645' },
    { name: 'Report Cards', href: '/dashboard/report-cards', icon: 'fa-file-text', desc: 'Review cumulative reports', color: '#0891b2' },
    { name: 'Class List', href: '/dashboard/class-list', icon: 'fa-list-alt', desc: 'View all classes and enrollment', color: '#06b6d4' },
  ];

  const managementActions = [
    { name: 'Staff Positions', href: '/dashboard/staff-positions', icon: 'fa-user-tag', desc: 'Departments and hierarchy', color: '#0891b2' },
    { name: 'Communications', href: '/dashboard/communications', icon: 'fa-comments', desc: 'Bulk SMS & email', color: '#0ea5e9' },
    { name: 'Curriculum', href: '/dashboard/curriculum', icon: 'fa-book-open', desc: 'Curriculum management', color: '#0891b2' },
    { name: 'School Members', href: '/dashboard/school-members', icon: 'fa-user-plus', desc: 'Manage school access', color: '#0891b2' },
  ];

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
        borderRadius: '12px', padding: '24px', marginBottom: '24px', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                <i className="fa fa-user-tie"></i>
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  Deputy Principal Dashboard
                </h1>
                <p style={{ fontSize: '14px', color: '#ccfbf1', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{user?.firstName} {user?.lastName}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                    {schoolProfile?.name || 'Secondary School'}
                  </span>
                </p>
              </div>
            </div>
            {currentTerm && (
              <p style={{ fontSize: '13px', color: '#ccfbf1', margin: '8px 0 0' }}>
                <i className="fa fa-calendar" style={{ marginRight: '6px' }} />
                Current Term: {currentTerm.name}
              </p>
            )}
          </div>
          <Link
            href="/dashboard/secondary"
            style={{ fontSize: '13px', color: '#ccfbf1', textDecoration: 'underline', textUnderlineOffset: '2px' }}
          >
            Main Dashboard →
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Icon3D name="students" size={40} />
            <div>
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Icon3D name="teachers" size={40} />
            <div>
              <p className="text-sm text-gray-500">Teachers</p>
              <p className="text-2xl font-bold text-gray-900">{totalTeachers}</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Ratio: {totalTeachers > 0 ? `${Math.round(totalStudents / totalTeachers)}:1` : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Icon3D name="classes" size={40} />
            <div>
              <p className="text-sm text-gray-500">Classes</p>
              <p className="text-2xl font-bold text-gray-900">{totalClasses}</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {gradeEnrollment.filter((g: any) => g.count > 0).map((g: any) => g.grade).join(', ') || '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600 text-lg">
              <i className="fa fa-clipboard-check" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Attendance Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {attendanceStats?.averageRate ? `${Math.round(attendanceStats.averageRate * 100)}%` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          <i className="fa fa-binoculars mr-2" style={{ color: '#0d9488' }}></i>
          Supervision & Oversight
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {supervisionActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors text-sm">{action.name}</h3>
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
          <i className="fa fa-cog mr-2" style={{ color: '#0891b2' }}></i>
          Administration
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {managementActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors text-sm">{action.name}</h3>
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
