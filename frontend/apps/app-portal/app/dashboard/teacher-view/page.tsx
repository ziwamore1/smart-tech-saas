'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { schoolApi, termApi, teacherApi, attendanceApi } from '@/lib/api';
import { useMemo } from 'react';
import { RoleGuard } from '@/lib/role-guard';
import Icon3D from '@/components/Icon3D';

export default function TeacherDashboardPage() {
  return (
    <RoleGuard requiredRoles={['Teacher']}>
      <TeacherDashboardContent />
    </RoleGuard>
  );
}

function TeacherDashboardContent() {
  const { user } = useAuth();

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

  const { data: myClasses } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => teacherApi.getClasses().then(r => r.data?.data || r.data),
  });

  const teachingActions = [
    { name: 'Score Entry', href: '/dashboard/assessment-entry', icon: 'fa-edit', desc: 'Enter assessment scores', color: '#2563eb' },
    { name: 'Assessments', href: '/dashboard/assessments', icon: 'fa-clipboard-check', desc: 'Manage assessments', color: '#f97316' },
    { name: 'Attendance Register', href: '/dashboard/attendance-register', icon: 'fa-clipboard-list', desc: 'Take daily attendance', color: '#059669' },
    { name: 'Results Management', href: '/dashboard/results-management', icon: 'fa-file-alt', desc: 'Manage class results', color: '#ea6645' },
    { name: 'Report Cards', href: '/dashboard/report-cards', icon: 'fa-file-text', desc: 'Generate report cards', color: '#0891b2' },
    { name: 'Online Exams', href: '/dashboard/exams', icon: 'fa-file-signature', desc: 'Create and manage exams', color: '#dc2626' },
  ];

  const classroomActions = [
    { name: 'My Classes', href: '/teacher/class', icon: 'fa-school', desc: 'View your assigned classes', color: '#8b5cf6' },
    { name: 'Timetable', href: '/timetable', icon: 'fa-calendar-alt', desc: 'Your lesson schedule', color: '#ec4899' },
    { name: 'Lesson Plans', href: '/dashboard/lesson-plans', icon: 'fa-clipboard-list', desc: 'Plan and manage lessons', color: '#f59e0b' },
    { name: 'Class List', href: '/dashboard/class-list', icon: 'fa-list-alt', desc: 'View student enrollment', color: '#06b6d4' },
    { name: 'SBA Tasks', href: '/dashboard/sba-tasks', icon: 'fa-tasks', desc: 'School-based assessment tasks', color: '#22c55e' },
    { name: 'Digital Stamps', href: '/dashboard/digital-stamps', icon: 'fa-stamp', desc: 'Digital stamps', color: '#7c3aed' },
    { name: 'Students', href: '/dashboard/students', icon: 'fa-user-graduate', desc: 'Student records', color: '#3b82f6' },
    { name: 'Library', href: '/dashboard/library', icon: 'fa-book-open', desc: 'Library resources', color: '#0d9488' },
  ];

  const classCount = myClasses?.length || 0;

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
        borderRadius: '12px', padding: '24px', marginBottom: '24px', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                <i className="fa fa-chalkboard-teacher"></i>
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  Teacher Dashboard
                </h1>
                <p style={{ fontSize: '14px', color: '#bfdbfe', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{user?.firstName} {user?.lastName}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                    {schoolProfile?.name || 'Secondary School'}
                  </span>
                </p>
              </div>
            </div>
            {currentTerm && (
              <p style={{ fontSize: '13px', color: '#bfdbfe', margin: '8px 0 0' }}>
                <i className="fa fa-calendar" style={{ marginRight: '6px' }} />
                Current Term: {currentTerm.name}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{classCount}</div>
            <div style={{ fontSize: '12px', color: '#bfdbfe' }}>Assigned Classes</div>
          </div>
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
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-lg">
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
          <i className="fa fa-tasks mr-2" style={{ color: '#2563eb' }}></i>
          Teaching & Assessment
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teachingActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{action.name}</h3>
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
          <i className="fa fa-door-open mr-2" style={{ color: '#8b5cf6' }}></i>
          Classroom Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {classroomActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{action.name}</h3>
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
