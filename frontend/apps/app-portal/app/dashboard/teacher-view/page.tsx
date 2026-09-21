'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { schoolApi, termApi, teacherApi, teacherAnalyticsApi } from '@/lib/api';
import { RoleGuard } from '@/lib/role-guard';
import Icon3D from '@/components/Icon3D';

export default function TeacherDashboardPage() {
  return (
    <RoleGuard requiredRoles={['Teacher', 'Class Teacher']}>
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
  const { data: myClasses } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => teacherApi.getClasses().then(r => r.data?.data || r.data),
  });

  const { data: analyticsResponse } = useQuery({
    queryKey: ['my-teacher-overview', currentTerm?.id],
    queryFn: () => teacherAnalyticsApi.getOverview(currentTerm?.id ? { termId: currentTerm.id } : undefined)
      .then(r => r.data?.data || r.data),
    enabled: !!currentTerm?.id,
    retry: false,
  });

  const teacherOverview = analyticsResponse?.data || analyticsResponse;
  const teacherSummary = teacherOverview?.summary;
  const assignedAnalyticsClasses = Array.isArray(teacherOverview?.classes) ? teacherOverview.classes : [];
  const assignedAnalyticsSubjects = Array.isArray(teacherOverview?.subjects) ? teacherOverview.subjects : [];

  const teachingActions = [
    { name: 'Results', href: '/dashboard/results', icon: 'fa-chart-bar', desc: 'View and manage school results', color: '#2563eb' },
    { name: 'Result Entry', href: '/dashboard/results-management/result-entry', icon: 'fa-edit', desc: 'Enter assessment & final scores', color: '#059669' },
    { name: 'Attendance Register', href: '/dashboard/attendance-register', icon: 'fa-clipboard-list', desc: 'Take daily attendance', color: '#059669' },
    { name: 'Results Management', href: '/dashboard/results-management', icon: 'fa-file-alt', desc: 'Manage class results', color: '#ea6645' },
    { name: 'Report Cards', href: '/dashboard/report-cards', icon: 'fa-file-text', desc: 'Generate report cards', color: '#0891b2' },
    { name: 'Online Exams', href: '/dashboard/exams', icon: 'fa-file-signature', desc: 'Create and manage exams', color: '#dc2626' },
  ];

  const classroomActions = [
    { name: 'My Classes', href: '/teacher/class', icon: 'fa-school', desc: 'View your assigned classes', color: '#8b5cf6' },
    { name: 'Lesson Plans', href: '/dashboard/lesson-plans', icon: 'fa-clipboard-list', desc: 'Plan and manage lessons', color: '#f59e0b' },
    { name: 'Class List', href: '/dashboard/class-list', icon: 'fa-list-alt', desc: 'View student enrollment', color: '#06b6d4' },
    { name: 'SBA Tasks', href: '/dashboard/sba-tasks', icon: 'fa-tasks', desc: 'School-based assessment tasks', color: '#22c55e' },
    { name: 'Digital Stamps', href: '/dashboard/digital-stamps', icon: 'fa-stamp', desc: 'Digital stamps', color: '#7c3aed' },
    { name: 'Students', href: '/dashboard/students', icon: 'fa-user-graduate', desc: 'Student records', color: '#3b82f6' },
    { name: 'Library', href: '/dashboard/library', icon: 'fa-book-open', desc: 'Library resources', color: '#0d9488' },
  ];

  const classCount = teacherSummary?.classesCount ?? myClasses?.length ?? 0;
  const subjectCount = teacherSummary?.subjectsCount ?? assignedAnalyticsSubjects.length;
  const studentCount = teacherSummary?.totalStudentsTaught ?? totalStudents;

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
               <p className="text-2xl font-bold text-gray-900">{studentCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Icon3D name="teachers" size={40} />
            <div>
               <p className="text-sm text-gray-500">My Subjects</p>
               <p className="text-2xl font-bold text-gray-900">{subjectCount}</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
             {teacherSummary?.strongestSubject?.subjectName || 'Assigned teaching subjects'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Icon3D name="classes" size={40} />
            <div>
               <p className="text-sm text-gray-500">Average Result</p>
               <p className="text-2xl font-bold text-gray-900">{teacherSummary?.overallAverage != null ? `${Math.round(teacherSummary.overallAverage)}%` : '—'}</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
             {teacherSummary?.overallPassRate != null ? `${Math.round(teacherSummary.overallPassRate)}% pass rate` : 'Awaiting result data'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-lg">
              <i className="fa fa-clipboard-check" />
            </div>
            <div>
               <p className="text-sm text-gray-500">Learners At Risk</p>
              <p className="text-2xl font-bold text-gray-900">
                 {teacherSummary?.studentsAtRisk ?? '—'}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">My Assigned Classes</h2>
            <p className="text-sm text-gray-500">Classes and subjects are scoped to your current teaching assignments.</p>
          </div>
          <Link href="/dashboard/teacher-analysis" className="text-sm font-medium text-pink-600 hover:text-pink-700">Open teaching analysis</Link>
        </div>
        {assignedAnalyticsClasses.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">No published result data is available for your assignments yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {assignedAnalyticsClasses.map((cls: any) => (
              <div key={cls.classId || cls.className} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                <p className="font-semibold text-gray-900">{cls.className}</p>
                <p className="text-xs text-gray-500 mt-1">{(cls.subjects || []).join(', ') || 'Assigned subjects'}</p>
                <p className="text-sm text-gray-700 mt-3">
                  {cls.average != null ? `${Math.round(cls.average)}% average` : 'No average yet'}
                  {cls.passRate != null ? ` · ${Math.round(cls.passRate)}% pass` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
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
