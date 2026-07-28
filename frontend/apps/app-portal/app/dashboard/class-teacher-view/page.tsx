'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { schoolApi, termApi, teacherApi } from '@/lib/api';
import { RoleGuard } from '@/lib/role-guard';

export default function ClassTeacherDashboardPage() {
  return (
    <RoleGuard requiredRoles={['Class Teacher', 'Teacher']}>
      <ClassTeacherDashboardContent />
    </RoleGuard>
  );
}

function ClassTeacherDashboardContent() {
  const { user } = useAuth();

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getCurrentSchool().then(r => r.data?.data || r.data),
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data?.data || r.data),
  });

  const { data: myClasses } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => teacherApi.getClasses().then(r => r.data?.data || r.data),
  });

  const formActions = [
    { name: 'Attendance Register', href: '/dashboard/attendance-register', icon: 'fa-clipboard-list', desc: 'Take class attendance daily', color: '#059669' },
    { name: 'Report Cards', href: '/dashboard/report-cards', icon: 'fa-file-text', desc: 'Generate and review report cards', color: '#0891b2' },
    { name: 'Results Management', href: '/dashboard/results-management', icon: 'fa-file-alt', desc: 'Manage class results', color: '#ea6645' },
    { name: 'Score Entry', href: '/dashboard/assessment-entry', icon: 'fa-edit', desc: 'Enter assessment scores', color: '#2563eb' },
    { name: 'Assessments', href: '/dashboard/assessments', icon: 'fa-clipboard-check', desc: 'View assessments', color: '#f97316' },
    { name: 'Online Exams', href: '/dashboard/exams', icon: 'fa-file-signature', desc: 'Class exams', color: '#dc2626' },
  ];

  const classManagementActions = [
    { name: 'My Class', href: '/teacher/class', icon: 'fa-school', desc: 'View your form class', color: '#8b5cf6' },
    { name: 'Students', href: '/dashboard/students', icon: 'fa-user-graduate', desc: 'Student records and profiles', color: '#3b82f6' },
    { name: 'Class List', href: '/dashboard/class-list', icon: 'fa-list-alt', desc: 'Class enrollment list', color: '#06b6d4' },
    { name: 'Timetable', href: '/timetable', icon: 'fa-calendar-alt', desc: 'Class timetable', color: '#ec4899' },
    { name: 'Lesson Plans', href: '/dashboard/lesson-plans', icon: 'fa-clipboard-list', desc: 'Lesson planning', color: '#f59e0b' },
    { name: 'Attendance Dashboard', href: '/dashboard/attendance/dashboard', icon: 'fa-chart-pie', desc: 'Attendance analytics', color: '#0d9488' },
    { name: 'Digital Stamps', href: '/dashboard/digital-stamps', icon: 'fa-stamp', desc: 'Digital stamps', color: '#7c3aed' },
    { name: 'Library', href: '/dashboard/library', icon: 'fa-book-open', desc: 'Library resources', color: '#0d9488' },
  ];

  const classCount = myClasses?.length || 0;

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        borderRadius: '12px', padding: '24px', marginBottom: '24px', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                <i className="fa fa-users"></i>
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  Class Teacher Dashboard
                </h1>
                <p style={{ fontSize: '14px', color: '#a7f3d0', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{user?.firstName} {user?.lastName}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                    {schoolProfile?.name || 'Secondary School'}
                  </span>
                </p>
              </div>
            </div>
            {currentTerm && (
              <p style={{ fontSize: '13px', color: '#a7f3d0', margin: '8px 0 0' }}>
                <i className="fa fa-calendar" style={{ marginRight: '6px' }} />
                Current Term: {currentTerm.name}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{classCount}</div>
            <div style={{ fontSize: '12px', color: '#a7f3d0' }}>Assigned Classes</div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          <i className="fa fa-clipboard mr-2" style={{ color: '#059669' }}></i>
          Form Class Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {formActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors text-sm">{action.name}</h3>
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
          <i className="fa fa-tools mr-2" style={{ color: '#10b981' }}></i>
          Class Tools & Resources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {classManagementActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors text-sm">{action.name}</h3>
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
