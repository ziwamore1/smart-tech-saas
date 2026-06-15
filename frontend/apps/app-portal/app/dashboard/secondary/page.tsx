'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { schoolApi, termApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFeatureLock } from '@/lib/feature-lock-context';
import { TIER_ORDER, SubscriptionTier } from '@/types/subscription';
import Icon3D from '@/components/Icon3D';

const basicActions = [
  { name: 'Form Classes', href: '/dashboard/classes', icon3d: 'classes', desc: 'Manage Form 1–6 classes' },
  { name: 'Students', href: '/dashboard/students', icon3d: 'students', desc: 'Student admissions & records' },
  { name: 'Teachers', href: '/dashboard/teachers', icon3d: 'teachers', desc: 'Teaching staff management' },
  { name: 'Timetable', href: '/timetable', icon3d: 'timetable', desc: 'Lesson scheduling' },
  { name: 'Exams', href: '/dashboard/exams', icon3d: 'exam', desc: 'GCE & internal exams' },
  { name: 'Results', href: '/dashboard/results', icon3d: 'results', desc: 'GCE grading & analysis' },
  { name: 'Report Cards', href: '/dashboard/report-cards', icon3d: 'reports', desc: 'Cumulative reports' },
  { name: 'Analytics', href: '/dashboard/analytics', icon3d: 'analytics', desc: 'Performance analytics' },
];

const standardHighlightActions = [
  { name: 'AI Timetable', href: '/timetable/generator', icon3d: 'timetable', desc: 'Auto-generate schedule', featureKey: 'timetable.generate' },
  { name: 'Result Reports', href: '/dashboard/results/reports', icon3d: 'results', desc: 'Comprehensive reports', featureKey: 'results.reports' },
  { name: 'Custom Reports', href: '/dashboard/report-cards/custom', icon3d: 'reports', desc: 'Customized report layouts', featureKey: 'reports.custom' },
  { name: 'Bulk Messaging', href: '/dashboard/communications', icon3d: 'communications', desc: 'Bulk SMS & email', featureKey: 'communications.bulk' },
];

const premiumHighlightActions = [
  { name: 'Timetable Constraints', href: '/timetable/constraints', icon3d: 'timetable', desc: 'Advanced scheduling rules', featureKey: 'timetable.constraints' },
  { name: 'AI Analytics', href: '/dashboard/analytics/ai', icon3d: 'analytics', desc: 'AI-powered insights', featureKey: 'analytics.ai' },
  { name: 'WhatsApp Comms', href: '/dashboard/communications/whatsapp', icon3d: 'communications', desc: 'WhatsApp messaging', featureKey: 'communications.whatsapp' },
  { name: 'Online Payments', href: '/dashboard/fees/online', icon3d: 'fees', desc: 'Payment gateway', featureKey: 'fees.onlinePayment' },
];

const tierNames: Record<SubscriptionTier, string> = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' };
const PLAN_LIMITS: Record<SubscriptionTier, { label: string; students: number; teachers: number; classes: number }> = {
  BASIC: { label: 'Basic', students: 100, teachers: 20, classes: 10 },
  STANDARD: { label: 'Standard', students: 500, teachers: 100, classes: 30 },
  PREMIUM: { label: 'Premium', students: -1, teachers: -1, classes: -1 },
};

export default function SecondaryDashboardPage() {
  const { user } = useAuth();
  const { hasAccess } = useFeatureLock();

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getCurrentSchool().then(res => res.data?.data || res.data),
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(res => res.data?.data || res.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['school-stats'],
    queryFn: () => schoolApi.getStats().then(res => res.data?.data || res.data),
  });

  const currentTier: SubscriptionTier = (schoolProfile?.subscriptionTier || 'BASIC').toUpperCase() as SubscriptionTier;
  const planLimits = PLAN_LIMITS[currentTier];

  const totalStudents = statsData?.totalStudents || 0;
  const totalTeachers = statsData?.totalTeachers || 0;
  const totalClasses = statsData?.totalClasses || 0;

  const getLimitPercent = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
  };
  const getLimitColor = (pct: number) => pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div>
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold m-0">{schoolProfile?.name || 'Secondary School'}</h1>
              <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full border border-white/30">
                Secondary School
              </span>
            </div>
            <p className="text-sm text-blue-100 mb-1">
              <i className="fa fa-graduation-cap mr-1.5" />
              Form (1–6) — ECZ Form 5 + GCE
            </p>
            {currentTerm && (
              <p className="text-xs text-blue-200">
                <i className="fa fa-calendar mr-1.5" />
                Current Term: {currentTerm.name}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className={`inline-block text-xs font-bold uppercase px-3 py-1 rounded-full ${
              currentTier === 'BASIC' ? 'bg-gray-600 text-white' :
              currentTier === 'STANDARD' ? 'bg-blue-500 text-white' :
              'bg-purple-500 text-white'
            }`}>
              {tierNames[currentTier]} Plan
            </span>
            <div className="mt-2">
              <Link
                href="/dashboard/subscription"
                className="text-xs text-blue-200 hover:text-white underline underline-offset-2"
              >
                {currentTier === 'PREMIUM' ? 'Manage Subscription →' : 'Upgrade Plan →'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {planLimits.students !== -1 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-gray-500">Students</span>
              <span className="text-xs font-semibold text-gray-700">{totalStudents}/{planLimits.students}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${getLimitColor(getLimitPercent(totalStudents, planLimits.students))}`}
                style={{ width: `${getLimitPercent(totalStudents, planLimits.students)}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-gray-500">Teachers</span>
              <span className="text-xs font-semibold text-gray-700">{totalTeachers}/{planLimits.teachers}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${getLimitColor(getLimitPercent(totalTeachers, planLimits.teachers))}`}
                style={{ width: `${getLimitPercent(totalTeachers, planLimits.teachers)}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-gray-500">Classes</span>
              <span className="text-xs font-semibold text-gray-700">{totalClasses}/{planLimits.classes}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${getLimitColor(getLimitPercent(totalClasses, planLimits.classes))}`}
                style={{ width: `${getLimitPercent(totalClasses, planLimits.classes)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {basicActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                <div className="mb-2.5">
                  <Icon3D name={action.icon3d} size={36} />
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{action.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {TIER_ORDER[currentTier] >= TIER_ORDER.STANDARD && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Standard</span>
              <span className="text-xs text-gray-400">— Advanced features</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {standardHighlightActions.map((action) => {
                const locked = !hasAccess(action.featureKey);
                return locked ? (
                  <div key={action.name} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-60 cursor-not-allowed h-full">
                    <div className="mb-2.5 opacity-50"><Icon3D name={action.icon3d} size={36} /></div>
                    <h3 className="font-semibold text-gray-400 text-sm">{action.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Upgrade or enable in settings</p>
                  </div>
                ) : (
                  <Link key={action.name} href={action.href} className="block">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                      <div className="mb-2.5"><Icon3D name={action.icon3d} size={36} /></div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{action.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {TIER_ORDER[currentTier] >= TIER_ORDER.PREMIUM && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded">Premium</span>
              <span className="text-xs text-gray-400">— Exclusive features</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {premiumHighlightActions.map((action) => {
                const locked = !hasAccess(action.featureKey);
                return locked ? (
                  <div key={action.name} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-60 cursor-not-allowed h-full">
                    <div className="mb-2.5 opacity-50"><Icon3D name={action.icon3d} size={36} /></div>
                    <h3 className="font-semibold text-gray-400 text-sm">{action.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Upgrade or enable in settings</p>
                  </div>
                ) : (
                  <Link key={action.name} href={action.href} className="block">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                      <div className="mb-2.5"><Icon3D name={action.icon3d} size={36} /></div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{action.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                    </div>
                  </Link>
                );
              })}
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
                {currentTier === 'BASIC' ? 'Includes core features with student/teacher/class limits.' :
                 currentTier === 'STANDARD' ? 'All Basic features plus advanced analytics and reports.' :
                 'Unlimited everything with AI features and integrations.'}
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
    </div>
  );
}
