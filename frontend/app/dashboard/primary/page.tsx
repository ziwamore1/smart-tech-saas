'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { schoolApi, attendanceApi, termApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFeatureLock } from '@/lib/feature-lock-context';
import { TIER_ORDER, SubscriptionTier } from '@/types/subscription';
import Icon3D from '@/components/Icon3D';

function UpgradePrompt({ feature, requiredTier, currentTier }: { feature: string; requiredTier: string; currentTier: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="text-lg font-semibold text-amber-800 mb-2">Upgrade Required</h3>
      <p className="text-amber-700 text-sm mb-1">
        <span className="font-medium">{feature}</span> requires <span className="font-bold uppercase">{requiredTier}</span> plan.
      </p>
      <p className="text-amber-600 text-xs">
        Your current plan: <span className="font-bold uppercase">{currentTier}</span>
      </p>
      <Link
        href="/dashboard/subscription"
        className="mt-4 inline-block px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
      >
        Upgrade Plan
      </Link>
    </div>
  );
}

function FeatureGate({ featureKey, requiredTier, currentTier, children }: { featureKey: string; requiredTier: SubscriptionTier; currentTier: SubscriptionTier; children: React.ReactNode }) {
  const { hasAccess } = useFeatureLock();
  const tierOk = TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];

  if (!tierOk || !hasAccess(featureKey)) {
    const featureNames: Record<string, string> = {
      'primary.reportCards': 'Curriculum Report Cards',
      'primary.curriculum': 'Curriculum Configuration',
      'primary.parents': 'Parent Portal',
      'primary.staff': 'Staff Management',
      'primary.analytics': 'Primary Analytics',
      'primary.ece': 'ECE Module',
      'primary.grade7': 'Grade 7 ECZ Management',
      'primary.benchmarking': 'Primary Benchmarking',
      'primary.aiReports': 'AI Report Comments',
    };
    return (
      <UpgradePrompt
        feature={featureNames[featureKey] || featureKey}
        requiredTier={requiredTier}
        currentTier={currentTier}
      />
    );
  }

  return <>{children}</>;
}

export default function PrimaryDashboardPage() {
  const { user } = useAuth();
  const { hasAccess } = useFeatureLock();

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getCurrentSchool().then(res => res.data?.data || res.data),
  });

  const currentTier: SubscriptionTier = (schoolProfile?.subscriptionTier || 'BASIC').toUpperCase() as SubscriptionTier;

  const { data: statsData } = useQuery({
    queryKey: ['school-stats'],
    queryFn: () => schoolApi.getStats().then(res => res.data?.data || res.data),
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(res => res.data?.data || res.data),
  });

  const { data: attendanceStats } = useQuery({
    queryKey: ['attendance-stats', currentTerm?.id],
    queryFn: () => attendanceApi.getStats({ termId: currentTerm?.id }).then(res => res.data?.data || res.data),
    enabled: !!currentTerm?.id,
  });

  const stats = statsData;
  const studentsByClass = stats?.studentsByClass || [];

  const basicLinks = [
    { key: 'primary.attendance', href: '/dashboard/attendance-register', icon: 'fa-clipboard-check', color: '#059669', desc: 'Mark daily attendance by class', tier: 'BASIC' as SubscriptionTier },
    { key: 'primary.students', href: '/dashboard/students', icon: 'fa-user-graduate', color: '#3b82f6', desc: 'Manage pupil records', tier: 'BASIC' as SubscriptionTier },
    { key: 'primary.classes', href: '/dashboard/classes', icon: 'fa-school', color: '#8b5cf6', desc: 'View class lists and assignments', tier: 'BASIC' as SubscriptionTier },
    { key: 'primary.results', href: '/dashboard/assessments', icon: 'fa-pencil-alt', color: '#d97706', desc: 'Record continuous assessment scores', tier: 'BASIC' as SubscriptionTier },
  ];

  const standardLinks = [
    { key: 'primary.reportCards', href: '/dashboard/report-cards', icon: 'fa-file-alt', color: '#ec4899', desc: 'Generate curriculum report cards', tier: 'STANDARD' as SubscriptionTier },
    { key: 'primary.curriculum', href: '/dashboard/curriculum', icon: 'fa-book-open', color: '#0891b2', desc: 'Configure curriculum and scoring', tier: 'STANDARD' as SubscriptionTier },
    { key: 'primary.staff', href: '/dashboard/teachers', icon: 'fa-chalkboard-teacher', color: '#10b981', desc: 'Manage teaching & non-teaching staff', tier: 'STANDARD' as SubscriptionTier },
    { key: 'primary.parents', href: '/dashboard/parents', icon: 'fa-user-friends', color: '#ec4899', desc: 'Parent registration and linking', tier: 'STANDARD' as SubscriptionTier },
  ];

  const premiumLinks = [
    { key: 'primary.grade7', href: '/dashboard/curriculum/exam-structures', icon: 'fa-graduation-cap', color: '#7c3aed', desc: 'Grade 7 ECZ exam management', tier: 'PREMIUM' as SubscriptionTier },
    { key: 'primary.ece', href: '/dashboard/curriculum/education-levels', icon: 'fa-baby', color: '#f59e0b', desc: 'ECE-specific assessments and tracking', tier: 'STANDARD' as SubscriptionTier },
  ];

  const tierNames: Record<SubscriptionTier, string> = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Primary School Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {currentTerm ? `Current Term: ${currentTerm.name} — ${currentTerm.academicYear?.name || ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
            currentTier === 'PREMIUM' ? 'bg-purple-100 text-purple-700' :
            currentTier === 'STANDARD' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {tierNames[currentTier]} Plan
          </span>
          <Link
            href="/dashboard/subscription"
            className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"
          >
            Manage Plan
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Icon3D type="students" size={40} />
            <div>
              <p className="text-sm text-gray-500">Total Pupils</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalStudents || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Icon3D type="teachers" size={40} />
            <div>
              <p className="text-sm text-gray-500">Teachers</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalTeachers || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Icon3D type="classes" size={40} />
            <div>
              <p className="text-sm text-gray-500">Classes</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalClasses || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg">
              <i className="fas fa-clipboard-check" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Attendance Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {attendanceStats?.averageRate
                  ? `${Math.round(attendanceStats.averageRate * 100)}%`
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>

        {TIER_ORDER[currentTier] >= TIER_ORDER.BASIC && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-green-700 bg-green-100 px-2 py-0.5 rounded">Basic</span>
              <span className="text-xs text-gray-400">— Available on all plans</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {basicLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0" style={{ backgroundColor: link.color }}>
                        <i className={`fas ${link.icon}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{link.desc.split(' ')[0]} {link.desc.split(' ').slice(1).join(' ')}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{link.desc}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {TIER_ORDER[currentTier] >= TIER_ORDER.STANDARD ? (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Standard</span>
              <span className="text-xs text-gray-400">— Advanced features</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {standardLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0" style={{ backgroundColor: link.color }}>
                        <i className={`fas ${link.icon}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{link.desc.split(' ')[0]} {link.desc.split(' ').slice(1).join(' ')}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{link.desc}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Standard (Locked)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {standardLinks.map((link) => (
                <div key={link.href} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-60 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 text-lg shrink-0" style={{ backgroundColor: '#e5e7eb' }}>
                      <i className="fas fa-lock" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-400 text-sm">{link.desc.split(' ')[0]} {link.desc.split(' ').slice(1).join(' ')}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Upgrade to Standard</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {TIER_ORDER[currentTier] >= TIER_ORDER.PREMIUM ? (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded">Premium</span>
              <span className="text-xs text-gray-400">— Exclusive features</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {premiumLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0" style={{ backgroundColor: link.color }}>
                        <i className={`fas ${link.icon}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{link.desc.split(' ')[0]} {link.desc.split(' ').slice(1).join(' ')}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{link.desc}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Premium (Locked)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {premiumLinks.map((link) => (
                <div key={link.href} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-60 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 text-lg shrink-0" style={{ backgroundColor: '#e5e7eb' }}>
                      <i className="fas fa-lock" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-400 text-sm">{link.desc.split(' ')[0]} {link.desc.split(' ').slice(1).join(' ')}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Upgrade to Premium</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Current Plan: <span className="uppercase font-bold">{tierNames[currentTier]}</span>
              </p>
              <p className="text-xs text-amber-600">
                You have access to {currentTier === 'BASIC' ? 'basic' : currentTier === 'STANDARD' ? 'basic + standard' : 'all'} primary features.
                {currentTier !== 'PREMIUM' && ' Upgrade to unlock more.'}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/subscription"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
          >
            {currentTier === 'PREMIUM' ? 'Manage Subscription' : 'Upgrade Plan'}
          </Link>
        </div>
      </div>

      <FeatureGate featureKey="primary.analytics" requiredTier="STANDARD" currentTier={currentTier}>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Classes Overview</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            {studentsByClass.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Class</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Students</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Male</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Female</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {studentsByClass.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.className || item._id || item.class}</td>
                      <td className="px-6 py-4">{item.count || item.students || 0}</td>
                      <td className="px-6 py-4 text-gray-500">{item.male || 0}</td>
                      <td className="px-6 py-4 text-gray-500">{item.female || 0}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href="/dashboard/attendance-register" className="text-blue-600 hover:text-blue-800 text-sm">
                          Take Attendance
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-gray-500">No class data available.</div>
            )}
          </div>
        </div>
      </FeatureGate>
    </div>
  );
}
