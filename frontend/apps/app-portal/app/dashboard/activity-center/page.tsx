'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useSchoolSocket } from '@/lib/use-school-socket';
import { activityApi, accessApi, schoolApi } from '@/lib/api';

type Tab = 'overview' | 'feed' | 'learning' | 'exams' | 'attendance' | 'presence' | 'alerts';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'fa-th-large' },
  { key: 'feed', label: 'Activity Feed', icon: 'fa-stream' },
  { key: 'learning', label: 'Learning Monitor', icon: 'fa-graduation-cap' },
  { key: 'exams', label: 'Online Exams', icon: 'fa-file-alt' },
  { key: 'attendance', label: 'Attendance', icon: 'fa-user-check' },
  { key: 'presence', label: 'Online Users', icon: 'fa-users' },
  { key: 'alerts', label: 'Alerts', icon: 'fa-bell' },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  RESULTS: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  ATTENDANCE: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  EXAMS: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  ASSIGNMENTS: { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8' },
  AI_TUTOR: { bg: '#f3e8ff', text: '#7c3aed', border: '#ddd6fe' },
  REPORTS: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  ENROLLMENT: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  ADMINISTRATION: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
  TIMETABLE: { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
  SYSTEM: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

const SEVERITY_STYLES: Record<string, { dot: string; label: string }> = {
  INFO: { dot: '#3b82f6', label: 'Info' },
  SUCCESS: { dot: '#10b981', label: 'Success' },
  WARNING: { dot: '#f59e0b', label: 'Warning' },
  ERROR: { dot: '#ef4444', label: 'Error' },
};

function formatTimeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function LiveStatsCards({ stats, statsLoading }: { stats: any; statsLoading: boolean }) {
  const cards = [
    { label: 'Users Online', value: stats?.usersOnline || 0, icon: 'fa-users', color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Teachers Active', value: stats?.teachersActiveNow || 0, icon: 'fa-chalkboard-teacher', color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Students Learning', value: stats?.studentsLearningNow || 0, icon: 'fa-book-reader', color: '#06b6d4', bg: '#ecfeff' },
    { label: 'Active Exams', value: stats?.activeExams || 0, icon: 'fa-file-alt', color: '#f59e0b', bg: '#fffbeb' },
    { label: 'AI Tutor Sessions', value: stats?.aiTutorSessions || 0, icon: 'fa-robot', color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Attendance Today', value: stats?.attendanceMarkedToday || 0, icon: 'fa-user-check', color: '#10b981', bg: '#ecfdf5' },
    { label: 'Results Entered', value: stats?.resultsEnteredToday || 0, icon: 'fa-chart-bar', color: '#2563eb', bg: '#eff6ff' },
    { label: 'Classes Active', value: stats?.classesWithActivity || 0, icon: 'fa-school', color: '#059669', bg: '#ecfdf5' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '12px', marginBottom: '24px' }}>
      {cards.map((card) => (
        <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}20`, borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${card.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fas ${card.icon}`} style={{ color: card.color, fontSize: '14px' }} />
            </div>
            {statsLoading && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />}
          </div>
          <div style={{ color: card.color, fontSize: '24px', fontWeight: 800, lineHeight: 1 }}>{card.value}</div>
          <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
        </div>
      ))}
    </div>
  );
}

function ActivityFeedPanel({ feed, feedLoading }: { feed: any[]; feedLoading: boolean }) {
  const [filter, setFilter] = useState<string>('');
  const categories = ['RESULTS', 'ATTENDANCE', 'EXAMS', 'ASSIGNMENTS', 'AI_TUTOR', 'REPORTS', 'ENROLLMENT', 'ADMINISTRATION'];

  const filteredFeed = filter ? feed.filter(e => e.category === filter) : feed;

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          onClick={() => setFilter('')}
          style={{
            padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
            background: !filter ? '#1e293b' : '#f1f5f9', color: !filter ? 'white' : '#64748b',
          }}
        >All</button>
        {categories.map(cat => {
          const colors = CATEGORY_COLORS[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilter(filter === cat ? '' : cat)}
              style={{
                padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
                background: filter === cat ? colors.text : colors.bg,
                color: filter === cat ? 'white' : colors.text,
              }}
            >{cat.replace('_', ' ')}</button>
          );
        })}
      </div>
      {feedLoading && feed.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading activity feed...</div>
      ) : filteredFeed.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No activity recorded yet</div>
      ) : (
        <div style={{ display: 'grid', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
          {filteredFeed.map((event) => {
            const catColors = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.ADMINISTRATION;
            const sevStyle = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.INFO;
            return (
              <div key={event.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px',
                background: '#fafbfc', border: `1px solid ${catColors.border}`, borderRadius: '10px',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                  background: sevStyle.dot,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{event.title}</span>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px',
                      background: catColors.bg, color: catColors.text, border: `1px solid ${catColors.border}`,
                    }}>{event.category.replace('_', ' ')}</span>
                  </div>
                  <div style={{ color: '#475569', fontSize: '12px', marginTop: '3px' }}>{event.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                    {event.userName && (
                      <span style={{ color: '#64748b', fontSize: '11px' }}>
                        <i className="fas fa-user" style={{ marginRight: '4px' }} />{event.userName}
                      </span>
                    )}
                    {event.userRole && (
                      <span style={{ color: '#94a3b8', fontSize: '11px', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{event.userRole}</span>
                    )}
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>{formatTimeAgo(event.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OnlineUsersPanel({ presence }: { presence: any[] }) {
  const [roleFilter, setRoleFilter] = useState<string>('');
  const roles = [...new Set(presence.map(p => p.userRole).filter(Boolean))];
  const filtered = roleFilter ? presence.filter(p => p.userRole === roleFilter) : presence;

  const grouped = filtered.reduce((acc: Record<string, any[]>, p) => {
    const role = p.userRole || 'Unknown';
    if (!acc[role]) acc[role] = [];
    acc[role].push(p);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          onClick={() => setRoleFilter('')}
          style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', background: !roleFilter ? '#1e293b' : '#f1f5f9', color: !roleFilter ? 'white' : '#64748b' }}
        >All ({presence.length})</button>
        {roles.map(role => (
          <button
            key={role}
            onClick={() => setRoleFilter(roleFilter === role ? '' : role)}
            style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', background: roleFilter === role ? '#3b82f6' : '#eff6ff', color: roleFilter === role ? 'white' : '#1d4ed8' }}
          >{role} ({presence.filter(p => p.userRole === role).length})</button>
        ))}
      </div>
      {Object.entries(grouped).map(([role, users]) => (
        <div key={role} style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{role}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {users.map((user) => (
              <div key={user.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.userName}</div>
                  {user.page && <div style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.page}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No users currently online</div>
      )}
    </div>
  );
}

function ClassCompletionPanel() {
  const { user } = useAuth();
  const { data: completionData, isLoading } = useQuery({
    queryKey: ['results-completion', user?.schoolId],
    queryFn: async () => {
      const res = await accessApi.getResultsCompletion();
      return res.data?.data || res.data || {};
    },
    refetchInterval: 60000,
  });

  const classes = Array.isArray(completionData) ? completionData : (completionData?.classes || []);

  return (
    <div>
      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading class data...</div>
      ) : classes.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No class data available</div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {classes.map((cls: any) => {
            const pct = cls.completionPercent ?? cls.completionRate ?? 0;
            const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <div key={cls.classId || cls.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{cls.className || cls.name || 'Class'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{cls.completed ?? cls.completeSubjects ?? 0} / {cls.total ?? cls.totalSubjects ?? 0} subjects entered</div>
                </div>
                <div style={{ width: '120px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color }}>{pct}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertPanel({ stats }: { stats: any }) {
  const alerts: { severity: string; title: string; description: string }[] = [];

  if (stats && stats.attendancePendingToday > 0) {
    alerts.push({ severity: 'WARNING', title: 'Attendance pending', description: `${stats.attendancePendingToday} classes have not marked attendance today` });
  }
  if (stats && stats.activeExams > 5) {
    alerts.push({ severity: 'INFO', title: 'High exam activity', description: `${stats.activeExams} active exams running simultaneously` });
  }
  if (stats && stats.usersOnline === 0) {
    alerts.push({ severity: 'ERROR', title: 'No users online', description: 'No users are currently connected to the system' });
  }
  if (stats && stats.resultsEnteredToday === 0 && new Date().getHours() > 9) {
    alerts.push({ severity: 'WARNING', title: 'No results entered today', description: 'No results have been entered yet today. Is result entry active?' });
  }

  return (
    <div>
      {alerts.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#10b981' }}>
          <i className="fas fa-check-circle" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }} />
          All systems normal
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {alerts.map((alert, i) => {
            const colors = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', background: '#fafbfc', border: `1px solid ${colors.dot}30`, borderRadius: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors.dot, marginTop: '4px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{alert.title}</div>
                  <div style={{ color: '#475569', fontSize: '12px', marginTop: '3px' }}>{alert.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ActivityCenterPage() {
  const { user } = useAuth();
  const schoolId = (user as any)?.schoolId || '';
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [liveStats, setLiveStats] = useState<any>(null);
  const [liveFeed, setLiveFeed] = useState<any[]>([]);
  const [presence, setPresence] = useState<any[]>([]);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['activity-stats', schoolId],
    queryFn: async () => {
      const res = await activityApi.getStats(schoolId);
      return res.data?.data || res.data;
    },
    enabled: !!schoolId,
    refetchInterval: 15000,
  });

  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ['activity-feed', schoolId],
    queryFn: async () => {
      const res = await activityApi.getFeed(schoolId, { limit: 100 });
      return res.data?.data || res.data || [];
    },
    enabled: !!schoolId,
    refetchInterval: 30000,
  });

  const { data: presenceData } = useQuery({
    queryKey: ['activity-presence', schoolId],
    queryFn: async () => {
      const res = await activityApi.getPresence(schoolId);
      return res.data?.data || res.data || [];
    },
    enabled: !!schoolId,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (statsData) setLiveStats(statsData);
  }, [statsData]);

  useEffect(() => {
    if (feedData && Array.isArray(feedData)) setLiveFeed(feedData);
  }, [feedData]);

  useEffect(() => {
    if (presenceData && Array.isArray(presenceData)) setPresence(presenceData);
  }, [presenceData]);

  useSchoolSocket({
    'activity:live': (event: any) => {
      setLiveFeed((prev) => [event, ...prev].slice(0, 200));
    },
    'activity:stats': (stats: any) => {
      setLiveStats(stats);
    },
    'presence:update': (data: any) => {
      if (Array.isArray(data)) setPresence(data);
    },
    'results:live': () => {},
    'attendance:updated': () => {},
    'exam:published': () => {},
  });

  useEffect(() => {
    if (!schoolId || !user) return;
    const interval = setInterval(() => {
      activityApi.heartbeat({
        schoolId,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        userRole: (user as any).role || 'User',
        page: window.location.pathname,
      }).catch(() => {});
    }, 30000);

    activityApi.heartbeat({
      schoolId,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      userRole: (user as any).role || 'User',
      page: window.location.pathname,
    }).catch(() => {});

    return () => clearInterval(interval);
  }, [schoolId, user]);

  const displayStats = liveStats || statsData;
  const displayFeed = liveFeed.length > 0 ? liveFeed : (Array.isArray(feedData) ? feedData : []);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .activity-tab-active { background: #1e293b !important; color: white !important; }
        .activity-tab:hover { background: #e2e8f0 !important; }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: '16px', padding: '28px 32px', marginBottom: '24px', color: 'white',
        boxShadow: '0 20px 40px rgba(15,23,42,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="fas fa-bolt" style={{ fontSize: '18px' }} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>School Activity Center</h1>
                <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.7 }}>Real-time school operations intelligence</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.2)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '12px', fontWeight: 700 }}>LIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'activity-tab-active' : 'activity-tab'}
            style={{
              padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: activeTab === tab.key ? '#1e293b' : '#f1f5f9',
              color: activeTab === tab.key ? 'white' : '#64748b',
            }}
          >
            <i className={`fas ${tab.icon}`} style={{ marginRight: '6px' }} />
            {tab.label}
            {tab.key === 'presence' && presence.length > 0 && (
              <span style={{
                marginLeft: '6px', background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : '#10b981',
                color: 'white', fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '10px',
              }}>{presence.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ animation: 'slideIn 0.2s ease-out' }}>
        {activeTab === 'overview' && (
          <div>
            <LiveStatsCards stats={displayStats} statsLoading={statsLoading} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
                  <i className="fas fa-stream" style={{ color: '#3b82f6', marginRight: '8px' }} />
                  Recent Activity
                </h3>
                <ActivityFeedPanel feed={displayFeed.slice(0, 15)} feedLoading={feedLoading} />
              </div>
              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
                  <i className="fas fa-school" style={{ color: '#059669', marginRight: '8px' }} />
                  Class Completion
                </h3>
                <ClassCompletionPanel />
              </div>
            </div>
            <div style={{ marginTop: '20px', background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
                <i className="fas fa-bell" style={{ color: '#f59e0b', marginRight: '8px' }} />
                Alerts
              </h3>
              <AlertPanel stats={displayStats} />
            </div>
          </div>
        )}

        {activeTab === 'feed' && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>
              <i className="fas fa-stream" style={{ color: '#3b82f6', marginRight: '8px' }} />
              Complete Activity Feed
            </h3>
            <ActivityFeedPanel feed={displayFeed} feedLoading={feedLoading} />
          </div>
        )}

        {activeTab === 'learning' && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>
              <i className="fas fa-graduation-cap" style={{ color: '#8b5cf6', marginRight: '8px' }} />
              Learning Monitor
            </h3>
            <LiveStatsCards stats={displayStats} statsLoading={statsLoading} />
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#475569', margin: '0 0 12px' }}>Active AI Tutor Sessions</h4>
              {displayFeed.filter(e => e.category === 'AI_TUTOR').length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No active AI tutor sessions</div>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {displayFeed.filter(e => e.category === 'AI_TUTOR').slice(0, 10).map((e) => (
                    <div key={e.id} style={{ padding: '10px 14px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#7c3aed' }}>{e.title}</span>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>{e.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>
              <i className="fas fa-file-alt" style={{ color: '#f59e0b', marginRight: '8px' }} />
              Online Exams
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#b45309' }}>{displayStats?.activeExams || 0}</div>
                <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600, marginTop: '4px' }}>Active Exams</div>
              </div>
            </div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#475569', margin: '0 0 12px' }}>Exam Activity</h4>
            {displayFeed.filter(e => e.category === 'EXAMS').length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No exam activity recorded</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {displayFeed.filter(e => e.category === 'EXAMS').slice(0, 15).map((e) => (
                  <div key={e.id} style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#b45309' }}>{e.title}</span>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>{e.description}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatTimeAgo(e.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>
              <i className="fas fa-user-check" style={{ color: '#10b981', marginRight: '8px' }} />
              Attendance Activity
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#047857' }}>{displayStats?.attendanceMarkedToday || 0}</div>
                <div style={{ fontSize: '12px', color: '#065f46', fontWeight: 600, marginTop: '4px' }}>Records Marked Today</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>{displayStats?.attendancePendingToday || 0}</div>
                <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 600, marginTop: '4px' }}>Pending Today</div>
              </div>
            </div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#475569', margin: '0 0 12px' }}>Recent Attendance Activity</h4>
            {displayFeed.filter(e => e.category === 'ATTENDANCE').length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No attendance activity recorded today</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {displayFeed.filter(e => e.category === 'ATTENDANCE').slice(0, 15).map((e) => (
                  <div key={e.id} style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#047857' }}>{e.title}</span>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>{e.description}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatTimeAgo(e.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'presence' && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>
              <i className="fas fa-users" style={{ color: '#3b82f6', marginRight: '8px' }} />
              Online Users ({presence.length})
            </h3>
            <OnlineUsersPanel presence={presence} />
          </div>
        )}

        {activeTab === 'alerts' && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>
              <i className="fas fa-bell" style={{ color: '#f59e0b', marginRight: '8px' }} />
              System Alerts
            </h3>
            <AlertPanel stats={displayStats} />
          </div>
        )}
      </div>
    </div>
  );
}
