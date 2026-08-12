'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { schoolApi, attendanceApi, termApi, academicYearApi, accessApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFeatureLock } from '@/lib/feature-lock-context';
import { TIER_ORDER, SubscriptionTier } from '@/types/subscription';
import Icon3D from '@/components/Icon3D';
import { useSchoolSocket } from '@/lib/use-school-socket';

const GRADE_LABELS = ['Pre', '1', '2', '3', '4', '5', '6', '7'];
const GRADE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#0891b2', '#ea6645', '#7c3aed'];

export default function PrimaryDashboardPage() {
  const { user, isDirector } = useAuth();
  const [liveActivities, setLiveActivities] = useState<any[]>([]);
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

  const { isLoading: liveResultsLoading } = useQuery({
    queryKey: ['primary-live-results', user?.schoolId, currentTerm?.id],
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

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicYearApi.getAll().then(res => res.data?.data || res.data || []),
  });

  const currentAcademicYear = Array.isArray(academicYears) ? academicYears.find((y: any) => y.isCurrent) : null;

  const { data: attendanceStats } = useQuery({
    queryKey: ['attendance-stats', currentTerm?.id],
    queryFn: () => attendanceApi.getStats({ termId: currentTerm?.id }).then(res => res.data?.data || res.data),
    enabled: !!currentTerm?.id,
  });

  const stats = statsData;
  const studentsByClass = stats?.studentsByClass || [];

  const totalPupils = stats?.totalStudents || 0;
  const totalTeachers = stats?.totalTeachers || 0;
  const totalClasses = stats?.totalClasses || 0;
  const totalMale = stats?.totalMale || studentsByClass.reduce((s: number, c: any) => s + (c.male || 0), 0);
  const totalFemale = stats?.totalFemale || studentsByClass.reduce((s: number, c: any) => s + (c.female || 0), 0);
  const genderParity = totalFemale > 0 ? (totalMale / totalFemale).toFixed(2) : '—';

  const gradeEnrollment = GRADE_LABELS.map((label, i) => {
    const match = studentsByClass.find((c: any) => {
      const cn = (c.className || c.class || '').toString();
      return cn.includes(`Grade ${label}`) || cn.includes(`grade ${label}`);
    });
    return {
      grade: `Grade ${label}`,
      count: match?.count || match?.students || 0,
      color: GRADE_COLORS[i],
    };
  });

  const totalEnrolled = gradeEnrollment.reduce((s: number, g: any) => s + g.count, 0);

  const eceActive = hasAccess('primary.ece');
  const grade7Active = hasAccess('primary.grade7');

  const tierNames: Record<SubscriptionTier, string> = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' };

  const basicActions = [
    { key: 'primary.students', name: 'New Pupil Registration', href: '/dashboard/primary/students', icon: 'fa-user-plus', color: '#3b82f6', desc: 'Register new pupil (intake or transfer)' },
    { key: 'primary.classes', name: 'Assign Class Teacher', href: '/dashboard/primary/classes', icon: 'fa-chalkboard-teacher', color: '#10b981', desc: 'Assign teachers to Grade 1–7 classes' },
    { key: 'primary.attendance', name: 'Record Attendance', href: '/dashboard/attendance-register', icon: 'fa-clipboard-check', color: '#059669', desc: 'Mark daily class attendance' },
    { key: 'primary.results', name: 'Enter Scores', href: '/dashboard/results-management/result-entry', icon: 'fa-pencil-alt', color: '#d97706', desc: 'Assessment & final scores' },
    { key: 'primary.classes', name: 'Manage Subjects', href: '/dashboard/primary/subjects', icon: 'fa-book', color: '#f59e0b', desc: 'Primary subject allocation' },
    { key: 'primary.dashboard', name: 'School Settings', href: '/dashboard/settings', icon: 'fa-cog', color: '#64748b', desc: 'Academic years, terms & grading' },
  ];

  const standardActions = [
    { key: 'primary.staff', name: 'Staff Records', href: '/dashboard/staff-records', icon: 'fa-id-card', color: '#0891b2', desc: 'Teaching & non-teaching staff' },
    { key: 'primary.reportCards', name: 'Generate Reports', href: '/dashboard/report-cards', icon: 'fa-file-alt', color: '#ec4899', desc: 'Primary curriculum report cards' },
    { key: 'primary.analytics', name: 'View Analytics', href: '/dashboard/analytics', icon: 'fa-chart-bar', color: '#a855f7', desc: 'Pupil performance analytics' },
    { key: 'primary.curriculum', name: 'Manage Subjects', href: '/dashboard/primary/subjects', icon: 'fa-book', color: '#f59e0b', desc: 'Primary subject allocation' },
    { key: 'primary.curriculum', name: 'School Library', href: '/dashboard/library', icon: 'fa-book-open', color: '#0d9488', desc: 'Textbooks, syllabi & resources' },
    { key: 'primary.curriculum', name: 'Photo Gallery', href: '/dashboard/gallery', icon: 'fa-images', color: '#db2777', desc: 'School event photos & albums' },
    { key: 'primary.staff', name: 'Fees Management', href: '/dashboard/fees', icon: 'fa-money-bill-wave', color: '#22c55e', desc: 'Fee structures & collections' },
  ];

  const premiumActions = [
    { key: 'primary.grade7', name: 'Grade 7 ECZ', href: '/dashboard/primary/grade7', icon: 'fa-graduation-cap', color: '#7c3aed', desc: 'ECZ exam management & preparation' },
    { key: 'primary.benchmarking', name: 'Benchmarking', href: '/dashboard/benchmarking', icon: 'fa-trophy', color: '#f59e0b', desc: 'Compare performance against national averages' },
    { key: 'primary.aiReports', name: 'AI Report Comments', href: '/dashboard/template-personalization', icon: 'fa-robot', color: '#14b8a6', desc: 'AI-generated report card comments' },
  ];

  return (
    <div className="space-y-6">
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
              {schoolProfile?.name || 'Primary School'}
            </h1>
            <span style={{
              fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.2)',
              padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)'
            }}>
              Primary School
            </span>
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
              currentTier === 'PREMIUM' ? 'bg-purple-700/30 text-purple-100' :
              currentTier === 'STANDARD' ? 'bg-blue-700/30 text-blue-100' :
              'bg-gray-700/30 text-gray-100'
            }`}>
              {currentTier} Plan
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/subscription"
              className="px-3 py-1.5 bg-white/20 text-white rounded-lg text-xs font-medium hover:bg-white/30"
            >
              Manage Plan
            </Link>
          </div>
        </div>
        <p style={{ fontSize: '14px', opacity: 0.9, margin: '8px 0 0' }}>
          <i className="fa fa-child" style={{ marginRight: '6px' }}></i>
          Grade 1–7 — ECZ Grade 7 National Assessment
        </p>
        <div style={{ display: 'flex', gap: '20px', marginTop: '8px', flexWrap: 'wrap' }}>
          {currentTerm && (
            <p style={{ fontSize: '13px', opacity: 0.8, margin: 0 }}>
              <i className="fa fa-calendar" style={{ marginRight: '6px' }}></i>
              Current Term: {currentTerm.name} {currentAcademicYear ? `(${currentAcademicYear.name})` : ''}
            </p>
          )}
          <p style={{ fontSize: '13px', opacity: 0.8, margin: 0 }}>
            <i className="fa fa-user-graduate" style={{ marginRight: '6px' }}></i>
            {totalEnrolled} pupils enrolled
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Icon3D name="students" size={40} />
            <div>
              <p className="text-sm text-gray-500">Total Pupils</p>
              <p className="text-2xl font-bold text-gray-900">{totalPupils}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-3 text-xs text-gray-500">
            <span>♂ {totalMale}</span>
            <span>♀ {totalFemale}</span>
            <span className="text-emerald-600">Ratio {genderParity}</span>
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
            Pupil–teacher ratio: {totalTeachers > 0 ? Math.round(totalPupils / totalTeachers) : '—'}
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
            Grades {gradeEnrollment.filter(g => g.count > 0).map(g => g.grade.replace('Grade ', '')).join(', ') || 'None'}
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
                {attendanceStats?.averageRate ? `${Math.round(attendanceStats.averageRate * 100)}%` : '—'}
              </p>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {currentTerm ? `Current term` : 'No active term'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <i className="fas fa-calendar-alt text-emerald-600" />
            <span className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Academic Year:</span>{' '}
              {currentAcademicYear?.name || 'Not set'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <i className="fas fa-calendar-check text-emerald-600" />
            <span className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Current Term:</span>{' '}
              {currentTerm?.name || 'Not set'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <i className="fas fa-users text-emerald-600" />
            <span className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Pupil–Teacher Ratio:</span>{' '}
              {totalTeachers > 0 ? `${Math.round(totalPupils / totalTeachers)}:1` : '—'}
            </span>
          </div>
        </div>
        <Link
          href="/dashboard/settings"
          className="text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
        >
          <i className="fas fa-cog" />
          Manage Academic Year & Terms
        </Link>
      </div>

      <div className={`grid grid-cols-1 ${TIER_ORDER[currentTier] >= TIER_ORDER.STANDARD ? 'lg:grid-cols-3' : ''} gap-6`}>
        {TIER_ORDER[currentTier] >= TIER_ORDER.STANDARD ? (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Enrollment Pipeline</h2>
              <div className="flex items-end gap-2 h-48">
                {gradeEnrollment.map((g, i) => {
                  const maxCount = Math.max(...gradeEnrollment.map(x => x.count), 1);
                  const height = Math.max((g.count / maxCount) * 100, g.count > 0 ? 8 : 0);
                  return (
                    <div key={g.grade} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-500">{g.count}</span>
                      <div
                        className="w-full rounded-t-md transition-all duration-500 hover:opacity-80"
                        style={{
                          height: `${height}%`,
                          backgroundColor: g.color,
                          minHeight: g.count > 0 ? '8px' : '0',
                        }}
                        title={`${g.grade}: ${g.count} pupils`}
                      />
                      <span className="text-xs text-gray-600 font-medium">{g.grade.replace('Grade ', '')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 text-center">
            <i className="fas fa-chart-bar text-gray-300 text-3xl mb-2" />
            <p className="text-sm text-gray-400 font-medium">Enrollment Pipeline</p>
            <p className="text-xs text-gray-400 mt-1">Upgrade to Standard or enable Analytics to view enrollment trends.</p>
            <Link href="/dashboard/subscription" className="mt-3 inline-block text-xs text-blue-600 font-medium hover:text-blue-800">
              Upgrade Plan →
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {eceActive && TIER_ORDER[currentTier] >= TIER_ORDER.STANDARD && (
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border border-pink-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
                  <i className="fas fa-baby" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">ECE Module</h3>
                  <p className="text-xs text-gray-500">Early Childhood Education</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Pre-school learning areas, developmental milestones, and assessment tracking.
              </p>
              <Link href="/dashboard/primary/ece" className="text-sm text-pink-600 font-medium hover:text-pink-700">
                Open ECE Module →
              </Link>
            </div>
          )}

          {grade7Active && TIER_ORDER[currentTier] >= TIER_ORDER.PREMIUM && (
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                  <i className="fas fa-graduation-cap" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Grade 7 ECZ</h3>
                  <p className="text-xs text-gray-500">National Examination Preparation</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Mock exams, selection predictions, and exam readiness tracking.
              </p>
              <Link href="/dashboard/primary/grade7" className="text-sm text-purple-600 font-medium hover:text-purple-700">
                Open Grade 7 ECZ →
              </Link>
            </div>
          )}

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                <i className="fas fa-book-open" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Curriculum</h3>
                <p className="text-xs text-gray-500">Zambian Primary Syllabus</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Literacy, Numeracy, Science, Social Studies, and more across Grades 1–7.
            </p>
            <Link href="/dashboard/primary/curriculum" className="text-sm text-emerald-600 font-medium hover:text-emerald-700">
              View Curriculum →
            </Link>
          </div>
        </div>
      </div>

      <div>
        {isDirector && (
          <div className="bg-white rounded-2xl p-5 mb-6 text-slate-900 shadow-lg border border-slate-200">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.15)]" /><h2 className="text-xl font-bold text-slate-900">Live Results Monitoring</h2></div><p className="text-slate-600 text-sm mt-2">Monitor teachers entering scores across classes and subjects.</p></div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">LIVE · AUTO-SYNC</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">{[['Entries tracked', liveActivities.length], ['Teachers active', new Set(liveActivities.map((item: any) => item.teacher?.id || item.teacherId || item.teacherName)).size], ['Classes covered', new Set(liveActivities.map((item: any) => item.class?.id || item.classId || item.className)).size], ['Subjects covered', new Set(liveActivities.map((item: any) => item.subject?.id || item.subjectId || item.subjectName)).size]].map(([label, value]) => <div key={label as string} className="bg-slate-100 border border-slate-200 rounded-lg p-3"><div className="text-xl font-extrabold text-emerald-700">{value}</div><div className="text-[11px] font-semibold text-slate-600 mt-1">{label}</div></div>)}</div>
            {liveResultsLoading && liveActivities.length === 0 ? <div className="py-5 text-slate-600 text-sm">Loading recent activity...</div> : liveActivities.length === 0 ? <div className="py-5 text-slate-600 text-sm">No result entries have been recorded for the current term yet.</div> : <div className="grid gap-2">{liveActivities.slice(0, 6).map((activity: any) => <div key={`${activity.id}-${activity.timestamp}`} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl p-3"><div><div className="font-bold text-sm text-slate-900">{activity.teacherName || `${activity.teacher?.firstName || ''} ${activity.teacher?.lastName || ''}`.trim() || 'Teacher'}</div><div className="text-[11px] text-slate-600">entered a result</div></div><div><div className="text-sm font-semibold text-blue-700">{activity.className || activity.class?.name || 'Class'}</div><div className="text-[11px] text-slate-600">Class</div></div><div><div className="text-sm font-semibold text-amber-700">{activity.subjectName || activity.subject?.name || 'Subject'}</div><div className="text-[11px] text-slate-600">Subject</div></div><div className="sm:text-right"><div className="text-sm font-bold text-emerald-700">{activity.score ?? '--'}%</div><div className="text-[11px] text-slate-600">{activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}</div></div></div>)}</div>}
          </div>
        )}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>

        {TIER_ORDER[currentTier] >= TIER_ORDER.BASIC && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-green-700 bg-green-100 px-2 py-0.5 rounded">Basic</span>
              <span className="text-xs text-gray-400">— Available on all plans</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {basicActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0" style={{ backgroundColor: action.color }}>
                        <i className={`fas ${action.icon}`} />
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
        )}

        {TIER_ORDER[currentTier] >= TIER_ORDER.STANDARD ? (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Standard</span>
              <span className="text-xs text-gray-400">— Advanced features</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {standardActions.map((action) => {
                const locked = !hasAccess(action.key);
                return locked ? (
                  <div key={action.href} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-60 cursor-not-allowed h-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 text-lg shrink-0" style={{ backgroundColor: '#e5e7eb' }}>
                        <i className="fas fa-lock" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-400 text-sm">{action.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Upgrade or enable in settings</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link key={action.href} href={action.href}>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0" style={{ backgroundColor: action.color }}>
                          <i className={`fas ${action.icon}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{action.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Standard (Locked)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {standardActions.map((action) => (
                <div key={action.href} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-60 cursor-not-allowed h-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 text-lg shrink-0" style={{ backgroundColor: '#e5e7eb' }}>
                      <i className="fas fa-lock" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-400 text-sm">{action.name}</h3>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {premiumActions.map((action) => {
                const locked = !hasAccess(action.key);
                return locked ? (
                  <div key={action.href} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-60 cursor-not-allowed h-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 text-lg shrink-0" style={{ backgroundColor: '#e5e7eb' }}>
                        <i className="fas fa-lock" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-400 text-sm">{action.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Upgrade or enable in settings</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link key={action.href} href={action.href}>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group h-full">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0" style={{ backgroundColor: action.color }}>
                          <i className={`fas ${action.icon}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{action.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Premium (Locked)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {premiumActions.map((action) => (
                <div key={action.href} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-60 cursor-not-allowed h-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 text-lg shrink-0" style={{ backgroundColor: '#e5e7eb' }}>
                      <i className="fas fa-lock" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-400 text-sm">{action.name}</h3>
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

      {TIER_ORDER[currentTier] >= TIER_ORDER.STANDARD && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/dashboard/library">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all h-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 text-xl">
                  <i className="fas fa-book-open" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">School Library</h3>
                  <p className="text-xs text-gray-500">Textbooks, syllabi & resources</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Access digital textbooks, syllabus documents, teacher guides, past papers, and lesson notes for the Zambian Primary Curriculum.
              </p>
              <span className="mt-3 inline-block text-sm text-teal-600 font-medium">Browse Library →</span>
            </div>
          </Link>
          <Link href="/dashboard/gallery">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all h-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600 text-xl">
                  <i className="fas fa-images" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Photo Gallery</h3>
                  <p className="text-xs text-gray-500">School event photos & albums</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Upload and view photos from school events, sports days, graduation ceremonies, and classroom activities.
              </p>
              <span className="mt-3 inline-block text-sm text-pink-600 font-medium">Open Gallery →</span>
            </div>
          </Link>
        </div>
      )}

      {TIER_ORDER[currentTier] >= TIER_ORDER.STANDARD && hasAccess('primary.analytics') ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Classes Overview</h2>
            <Link href="/dashboard/primary/classes" className="text-sm text-emerald-600 font-medium hover:text-emerald-700">
              Manage Classes →
            </Link>
          </div>
          {studentsByClass.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Class</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Pupils</th>
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
                      <div className="flex gap-2 justify-end">
                        <Link href="/dashboard/attendance-register" className="text-blue-600 hover:text-blue-800 text-sm">
                          Attendance
                        </Link>
                        <Link href="/dashboard/results-management/result-entry" className="text-emerald-600 hover:text-emerald-800 text-sm">
                          Scores
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-500">No class data available.</div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
          <i className="fas fa-table text-gray-300 text-3xl mb-2" />
          <p className="text-sm text-gray-400 font-medium">Classes Overview</p>
          <p className="text-xs text-gray-400 mt-1">Upgrade to Standard or enable Analytics to view class performance data.</p>
          <Link href="/dashboard/subscription" className="mt-3 inline-block text-xs text-blue-600 font-medium hover:text-blue-800">
            Upgrade Plan →
          </Link>
        </div>
      )}
    </div>
  );
}
