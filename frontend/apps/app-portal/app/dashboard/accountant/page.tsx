'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { schoolApi, termApi } from '@/lib/api';
import { RoleGuard } from '@/lib/role-guard';

export default function AccountantDashboardPage() {
  return (
    <RoleGuard requiredRoles={['Accountant', 'Director']}>
      <AccountantDashboardContent />
    </RoleGuard>
  );
}

function AccountantDashboardContent() {
  const { user } = useAuth();

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getCurrentSchool().then(r => r.data?.data || r.data),
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data?.data || r.data),
  });

  const financeActions = [
    { name: 'Fees Management', href: '/dashboard/fees', icon: 'fa-money-bill-wave', desc: 'Fee collection and tracking', color: '#22c55e' },
    { name: 'Online Payments', href: '/dashboard/fees/online', icon: 'fa-credit-card', desc: 'Payment gateway management', color: '#10b981' },
    { name: 'Subscription', href: '/dashboard/subscription', icon: 'fa-crown', desc: 'School subscription plan', color: '#f59e0b' },
  ];

  const reportsActions = [
    { name: 'Reports', href: '/dashboard/reports', icon: 'fa-file-alt', desc: 'Financial reports', color: '#6366f1' },
    { name: 'Report Hub', href: '/dashboard/report-hub', icon: 'fa-print', desc: 'Print financial documents', color: '#3b82f6' },
    { name: 'Communications', href: '/dashboard/communications', icon: 'fa-comments', desc: 'Payment reminders', color: '#0ea5e9' },
  ];

  const adminActions = [
    { name: 'Staff Returns Hub', href: '/dashboard/staff-records', icon: 'fa-id-card', desc: 'Staff salary records', color: '#a855f7' },
    { name: 'Students', href: '/dashboard/students', icon: 'fa-user-graduate', desc: 'Student billing records', color: '#3b82f6' },
    { name: 'Teachers', href: '/dashboard/teachers', icon: 'fa-chalkboard-teacher', desc: 'Teacher records', color: '#10b981' },
    { name: 'Classes', href: '/dashboard/classes', icon: 'fa-school', desc: 'Class information', color: '#8b5cf6' },
    { name: 'Account Center', href: '/security/account-center', icon: 'fa-user-circle', desc: 'Account settings', color: '#6366f1' },
  ];

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)',
        borderRadius: '12px', padding: '24px', marginBottom: '24px', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                <i className="fa fa-calculator"></i>
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  Accountant Dashboard
                </h1>
                <p style={{ fontSize: '14px', color: '#bbf7d0', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{user?.firstName} {user?.lastName}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                    {schoolProfile?.name || 'Secondary School'}
                  </span>
                </p>
              </div>
            </div>
            {currentTerm && (
              <p style={{ fontSize: '13px', color: '#bbf7d0', margin: '8px 0 0' }}>
                <i className="fa fa-calendar" style={{ marginRight: '6px' }} />
                Current Term: {currentTerm.name}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          <i className="fa fa-coins mr-2" style={{ color: '#22c55e' }}></i>
          Finance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {financeActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: '18px' }}>
                    <i className={`fa ${action.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors text-sm">{action.name}</h3>
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
          <i className="fa fa-file-invoice mr-2" style={{ color: '#6366f1' }}></i>
          Financial Reports
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
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors text-sm">{action.name}</h3>
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
          <i className="fa fa-database mr-2" style={{ color: '#a855f7' }}></i>
          Records
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
                    <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors text-sm">{action.name}</h3>
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
