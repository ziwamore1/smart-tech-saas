'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { schoolApi, termApi } from '@/lib/api';
import { RoleGuard } from '@/lib/role-guard';

export default function SecretaryDashboardPage() {
  return (
    <RoleGuard requiredRoles={['Secretary', 'Director']}>
      <SecretaryDashboardContent />
    </RoleGuard>
  );
}

function SecretaryDashboardContent() {
  const { user } = useAuth();

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getCurrentSchool().then(r => r.data?.data || r.data),
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data?.data || r.data),
  });

  const commsActions = [
    { name: 'Communications', href: '/dashboard/communications', icon: 'fa-comments', desc: 'Bulk SMS, email & WhatsApp', color: '#0ea5e9' },
    { name: 'Results SMS', href: '/dashboard/communications/results-sms', icon: 'fa-sms', desc: 'Send results via SMS', color: '#06b6d4' },
  ];

  const adminActions = [
    { name: 'Staff Returns Hub', href: '/dashboard/staff-records', icon: 'fa-id-card', desc: 'Staff records and profiles', color: '#a855f7' },
    { name: 'Staff Positions', href: '/dashboard/staff-positions', icon: 'fa-user-tag', desc: 'Departments and positions', color: '#0891b2' },
    { name: 'School Members', href: '/dashboard/school-members', icon: 'fa-user-plus', desc: 'Manage school access', color: '#0891b2' },
    { name: 'Users', href: '/dashboard/users', icon: 'fa-users', desc: 'User accounts', color: '#059669' },
    { name: 'Students', href: '/dashboard/students', icon: 'fa-user-graduate', desc: 'Student admissions & records', color: '#3b82f6' },
    { name: 'Teachers', href: '/dashboard/teachers', icon: 'fa-chalkboard-teacher', desc: 'Teaching staff records', color: '#10b981' },
    { name: 'Classes', href: '/dashboard/classes', icon: 'fa-school', desc: 'Class information', color: '#8b5cf6' },
    { name: 'Timetable', href: '/timetable', icon: 'fa-calendar-alt', desc: 'School timetable', color: '#ec4899' },
    { name: 'Photo Gallery', href: '/dashboard/gallery', icon: 'fa-images', desc: 'School photo gallery', color: '#db2777' },
    { name: 'Digital Stamps', href: '/dashboard/digital-stamps', icon: 'fa-stamp', desc: 'Digital stamps', color: '#7c3aed' },
  ];

  const reportsActions = [
    { name: 'Reports', href: '/dashboard/reports', icon: 'fa-file-alt', desc: 'School reports', color: '#6366f1' },
    { name: 'Report Hub', href: '/dashboard/report-hub', icon: 'fa-print', desc: 'Print documents', color: '#3b82f6' },
    { name: 'Report Manager', href: '/dashboard/report-manager', icon: 'fa-folder-open', desc: 'Manage report documents', color: '#6366f1' },
  ];

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)',
        borderRadius: '12px', padding: '24px', marginBottom: '24px', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                <i className="fa fa-phone-alt"></i>
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  Secretary Dashboard
                </h1>
                <p style={{ fontSize: '14px', color: '#bae6fd', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{user?.firstName} {user?.lastName}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                    {schoolProfile?.name || 'Secondary School'}
                  </span>
                </p>
              </div>
            </div>
            {currentTerm && (
              <p style={{ fontSize: '13px', color: '#bae6fd', margin: '8px 0 0' }}>
                <i className="fa fa-calendar" style={{ marginRight: '6px' }} />
                Current Term: {currentTerm.name}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          <i className="fa fa-bullhorn mr-2" style={{ color: '#0ea5e9' }}></i>
          Communications
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          {commsActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-sky-600 transition-colors text-sm">{action.name}</h3>
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
          <i className="fa fa-building mr-2" style={{ color: '#0891b2' }}></i>
          Administration
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {adminActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-sky-600 transition-colors text-sm">{action.name}</h3>
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
          <i className="fa fa-print mr-2" style={{ color: '#6366f1' }}></i>
          Documents & Reports
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reportsActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-sky-600 transition-colors text-sm">{action.name}</h3>
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
