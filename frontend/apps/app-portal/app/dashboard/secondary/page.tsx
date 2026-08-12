'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { schoolApi, termApi, accessApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFeatureLock } from '@/lib/feature-lock-context';
import { TIER_ORDER, SubscriptionTier } from '@/types/subscription';
import Icon3D from '@/components/Icon3D';
import { useSchoolSocket } from '@/lib/use-school-socket';

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
  const { user, isDirector } = useAuth();
  const { hasAccess } = useFeatureLock();
  const [liveActivities, setLiveActivities] = useState<any[]>([]);

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getCurrentSchool().then(res => res.data?.data || res.data),
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(res => res.data?.data || res.data),
  });

  const { data: completionData } = useQuery<any[]>({
    queryKey: ['secondary-results-completion', user?.schoolId, currentTerm?.id],
    queryFn: async () => { const res = await accessApi.getResultsCompletion(currentTerm?.id); return res.data?.data || res.data || []; },
    enabled: !!isDirector && !!user?.schoolId && !!currentTerm?.id,
    refetchInterval: 30000,
  });

  const { isLoading: liveResultsLoading } = useQuery({
    queryKey: ['secondary-live-results', user?.schoolId, currentTerm?.id],
    queryFn: async () => {
      const res = await accessApi.getLiveResults(currentTerm?.id);
      const data = res.data?.data || res.data || [];
      const results = Array.isArray(data) ? data : [];
      setLiveActivities(results);
      return results;
    },
    enabled: !!isDirector && !!user?.schoolId && !!currentTerm?.id,
    refetchInterval: 30000,
  });

  useSchoolSocket({
    'results:live': (activity) => setLiveActivities((current) => [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, 30)),
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
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
        borderRadius: '12px', padding: '24px', marginBottom: '24px', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{schoolProfile?.name || 'Secondary School'}</h1>
              <span style={{
                fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.2)',
                padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                Secondary School
              </span>
            </div>
            <p style={{ fontSize: '14px', color: '#bfdbfe', margin: '0 0 4px' }}>
              <i className="fa fa-graduation-cap" style={{ marginRight: '6px' }} />
              Form (1–6) — ECZ Form 5 + GCE
            </p>
            {currentTerm && (
              <p style={{ fontSize: '13px', color: '#93c5fd', margin: 0 }}>
                <i className="fa fa-calendar" style={{ marginRight: '6px' }} />
                Current Term: {currentTerm.name}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              display: 'inline-block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: '999px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              ...(currentTier === 'BASIC' ? { background: '#374151', color: 'white', border: '1px solid rgba(255,255,255,0.2)' } :
                 currentTier === 'STANDARD' ? { background: '#f59e0b', color: 'white', border: '1px solid rgba(255,255,255,0.2)' } :
                 { background: '#7e22ce', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }),
            }}>
              {tierNames[currentTier]} Plan
            </span>
            <div style={{ marginTop: '8px' }}>
              <Link
                href="/dashboard/subscription"
                style={{ fontSize: '13px', color: '#93c5fd', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#93c5fd'}
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
        {isDirector && (
          <div className="bg-white rounded-2xl p-5 mb-6 text-slate-900 shadow-lg border border-slate-200">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.15)]" /><h2 className="text-xl font-bold text-slate-900">Live Results Monitoring</h2></div><p className="text-slate-600 text-sm mt-2">Monitor teachers entering scores across forms and subjects.</p></div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">LIVE · AUTO-SYNC</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">{[['Entries tracked', liveActivities.length], ['Teachers active', new Set(liveActivities.map((item: any) => item.teacher?.id || item.teacherId || item.teacherName)).size], ['Classes covered', new Set(liveActivities.map((item: any) => item.class?.id || item.classId || item.className)).size], ['Subjects covered', new Set(liveActivities.map((item: any) => item.subject?.id || item.subjectId || item.subjectName)).size]].map(([label, value]) => <div key={label as string} className="bg-slate-100 border border-slate-200 rounded-lg p-3"><div className="text-xl font-extrabold text-emerald-700">{value}</div><div className="text-[11px] font-semibold text-slate-600 mt-1">{label}</div></div>)}</div>
            {liveResultsLoading && liveActivities.length === 0 ? <div className="py-5 text-slate-600 text-sm">Loading recent activity...</div> : liveActivities.length === 0 ? <div className="py-5 text-slate-600 text-sm">No result entries have been recorded for the current term yet.</div> : <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1">{liveActivities.map((activity: any) => <div key={`${activity.id}-${activity.timestamp}`} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl p-3"><div><div className="font-bold text-sm text-slate-900">{activity.teacherName || `${activity.teacher?.firstName || ''} ${activity.teacher?.lastName || ''}`.trim() || 'Teacher'}</div><div className="text-[11px] text-slate-600">entered a result</div></div><div><div className="text-sm font-semibold text-blue-700">{activity.className || activity.class?.name || 'Class'}</div><div className="text-[11px] text-slate-600">Class</div></div><div><div className="text-sm font-semibold text-amber-700">{activity.subjectName || activity.subject?.name || 'Subject'}</div><div className="text-[11px] text-slate-600">Subject</div></div><div className="sm:text-right"><div className="text-sm font-bold text-emerald-700">{activity.score ?? '--'}%</div><div className="text-[11px] text-slate-600">{activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}</div></div></div>)}</div>}
            {Array.isArray(completionData) && completionData.length > 0 && <div className="mt-5 border-t border-slate-200 pt-4"><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">Class Completion</h3><span className="text-xs text-slate-500">Subjects fully entered for all enrolled students</span></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase text-slate-500 border-b"><th className="py-2">Class</th><th className="py-2">Subjects complete</th><th className="py-2">Progress</th><th className="py-2 text-right">Status</th></tr></thead><tbody>{completionData.map((item: any) => <tr key={item.classId} className="border-b last:border-0"><td className="py-3 font-semibold text-slate-900">{item.className}</td><td className="py-3 text-slate-600">{item.completeSubjects}/{item.totalSubjects}</td><td className="py-3 min-w-[180px]"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full rounded-full ${item.complete ? 'bg-emerald-500' : item.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${item.completionRate}%` }} /></div><span className="text-xs font-bold text-slate-700">{item.completionRate}%</span></div></td><td className="py-3 text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.complete ? 'Complete' : 'In progress'}</span></td></tr>)}</tbody></table></div></div>}
          </div>
        )}
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
