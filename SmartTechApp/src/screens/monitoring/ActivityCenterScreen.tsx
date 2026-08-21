import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { socketService } from '../../services/socket';
import { useAuthStore } from '../../store';

interface ActivityCenterProps {
  onToggleDrawer?: () => void;
  stackNavigation?: any;
}

type Tab = 'overview' | 'feed' | 'online' | 'alerts';

const CATEGORIES = ['RESULTS', 'ATTENDANCE', 'EXAMS', 'ASSIGNMENTS', 'AI_TUTOR', 'REPORTS', 'ENROLLMENT', 'ADMINISTRATION'];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  RESULTS: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  ATTENDANCE: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  EXAMS: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  ASSIGNMENTS: { bg: '#FCE7F3', text: '#BE185D', border: '#FBCFE8' },
  AI_TUTOR: { bg: '#F3E8FF', text: '#7C3AED', border: '#DDD6FE' },
  REPORTS: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  ENROLLMENT: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  ADMINISTRATION: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: '#3B82F6',
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  ERROR: '#EF4444',
};

function formatTimeAgo(date: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function normalizeRole(roles?: string[] | null): string {
  const raw = roles?.[0];
  if (!raw) return 'User';
  if (raw === 'HOD') return 'HOD';
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ActivityCenterScreen: React.FC<ActivityCenterProps> = ({ onToggleDrawer }) => {
  const user = useAuthStore((s) => s.user);
  const schoolId = user?.schoolId || '';
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [presence, setPresence] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(socketService.isConnected);

  // Refs hold latest data so socket callbacks always merge onto fresh state
  const statsRef = useRef<any>(null);
  const feedRef = useRef<any[]>([]);
  const presenceRef = useRef<any[]>([]);

  const loadStats = useCallback(async () => {
    if (!schoolId) return;
    try {
      const data = await apiService.getActivityStats(schoolId);
      statsRef.current = data;
      setStats(data);
    } catch { /* keep last known */ }
  }, [schoolId]);

  const loadFeed = useCallback(async () => {
    if (!schoolId) return;
    try {
      const data = await apiService.getActivityFeed(schoolId, { limit: 100 });
      const list = Array.isArray(data) ? data : [];
      feedRef.current = list;
      setFeed(list);
    } catch { /* keep last known */ }
  }, [schoolId]);

  const loadPresence = useCallback(async () => {
    if (!schoolId) return;
    try {
      const data = await apiService.getActivityPresence(schoolId);
      const list = Array.isArray(data) ? data : [];
      presenceRef.current = list;
      setPresence(list);
    } catch { /* keep last known */ }
  }, [schoolId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadStats(), loadFeed(), loadPresence()]);
  }, [loadStats, loadFeed, loadPresence]);

  // Initial load + polling fallbacks (same cadence as the web dashboard)
  useEffect(() => {
    if (!schoolId) return;
    loadAll().finally(() => setLoading(false));
    const intervals = [
      setInterval(loadStats, 15000),
      setInterval(loadFeed, 30000),
      setInterval(loadPresence, 10000),
    ];
    return () => intervals.forEach(clearInterval);
  }, [schoolId, loadAll]);

  // Real-time sync over the same /school socket namespace as the web dashboard
  useEffect(() => {
    if (!schoolId) return;

    socketService.connect();
    socketService.joinSchool(schoolId);

    const onActivityLive = (event: any) => {
      if (!event?.id) return;
      setFeed((prev) => {
        const next = [event, ...prev.filter((e) => e.id !== event.id)].slice(0, 200);
        feedRef.current = next;
        return next;
      });
    };
    const onActivityStats = (incoming: any) => {
      if (!incoming) return;
      statsRef.current = incoming;
      setStats(incoming);
    };
    const onPresenceUpdate = (data: any) => {
      if (Array.isArray(data)) {
        presenceRef.current = data;
        setPresence(data);
      }
    };
    const onConnect = () => {
      setConnected(true);
      socketService.joinSchool(schoolId);
      loadAll();
    };
    const onDisconnect = () => setConnected(false);

    socketService.on('activity:live', onActivityLive);
    socketService.on('activity:stats', onActivityStats);
    socketService.on('presence:update', onPresenceUpdate);

    socketService.on('connect', onConnect);
    socketService.on('disconnect', onDisconnect);

    return () => {
      socketService.off('activity:live', onActivityLive);
      socketService.off('activity:stats', onActivityStats);
      socketService.off('presence:update', onPresenceUpdate);
      socketService.off('connect', onConnect);
      socketService.off('disconnect', onDisconnect);
    };
  }, [schoolId, loadAll]);

  // Presence heartbeat so this device appears in "Users Online" on the web dashboard too
  useEffect(() => {
    if (!schoolId || !user?.id) return;
    const beat = () => {
      apiService
        .sendPresenceHeartbeat({
          schoolId,
          userId: user.id,
          userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
          userRole: normalizeRole(user.roles),
          page: 'activity-center (mobile)',
        })
        .catch(() => {});
    };
    beat();
    const interval = setInterval(beat, 30000);
    return () => clearInterval(interval);
  }, [schoolId, user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const statCards = [
    { label: 'Users Online', value: stats?.usersOnline ?? 0, color: colors.info, bg: colors.infoLight },
    { label: 'Teachers Active', value: stats?.teachersActiveNow ?? 0, color: colors.purple, bg: colors.purpleLight },
    { label: 'Students Learning', value: stats?.studentsLearningNow ?? 0, color: colors.teal, bg: colors.tealLight },
    { label: 'Active Exams', value: stats?.activeExams ?? 0, color: colors.warning, bg: colors.warningLight },
    { label: 'AI Tutor Sessions', value: stats?.aiTutorSessions ?? 0, color: colors.purple, bg: colors.purpleLight },
    { label: 'Attendance Today', value: stats?.attendanceMarkedToday ?? 0, color: colors.success, bg: colors.successLight },
    { label: 'Results Entered', value: stats?.resultsEnteredToday ?? 0, color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Classes Active', value: stats?.classesWithActivity ?? 0, color: colors.success, bg: colors.successLight },
  ];

  const buildAlerts = () => {
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
    return alerts;
  };

  const renderStatsGrid = () => (
    <View style={styles.statsGrid}>
      {statCards.map((card) => (
        <View key={card.label} style={[styles.statCard, { backgroundColor: card.bg, borderColor: `${card.color}33` }]}>
          <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
          <Text style={styles.statLabel}>{card.label.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );

  const renderEvent = (event: any, key: string | number) => {
    const catColors = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.ADMINISTRATION;
    const sevColor = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.INFO;
    return (
      <View key={key} style={[styles.eventRow, { borderColor: catColors.border }]}>
        <View style={[styles.eventDot, { backgroundColor: sevColor }]} />
        <View style={styles.eventContent}>
          <View style={styles.eventTitleRow}>
            <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: catColors.bg, borderColor: catColors.border }]}>
              <Text style={[styles.categoryBadgeText, { color: catColors.text }]}>
                {(event.category || '').replace('_', ' ')}
              </Text>
            </View>
          </View>
          {!!event.description && <Text style={styles.eventDescription}>{event.description}</Text>}
          <View style={styles.eventMetaRow}>
            {!!event.userName && <Text style={styles.eventMeta}>{event.userName}</Text>}
            {!!event.userRole && <Text style={[styles.eventMeta, styles.eventRole]}>{event.userRole}</Text>}
            <Text style={styles.eventMeta}>{formatTimeAgo(event.timestamp)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderOverviewTab = () => (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      {renderStatsGrid()}

      <Widget title="Recent Activity">
        {feed.slice(0, 15).map((event, i) => renderEvent(event, event.id || i))}
        {feed.length === 0 && !loading && <Empty text="No activity recorded yet" />}
        {loading && feed.length === 0 && <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.lg }} />}
      </Widget>

      <TouchableOpacity style={styles.linkCard} onPress={() => setActiveTab('alerts')}>
        <Text style={styles.linkCardIcon}>🔔</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.linkCardTitle}>System Alerts</Text>
          <Text style={styles.linkCardSubtitle}>{buildAlerts().length} active alert{buildAlerts().length !== 1 ? 's' : ''}</Text>
        </View>
        <Text style={styles.linkCardArrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const filteredFeed = categoryFilter ? feed.filter((e) => e.category === categoryFilter) : feed;

  const renderFeedTab = () => (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
        <Chip label="All" active={!categoryFilter} onPress={() => setCategoryFilter('')} />
        {CATEGORIES.map((cat) => {
          const c = CATEGORY_COLORS[cat];
          return (
            <Chip
              key={cat}
              label={cat.replace('_', ' ')}
              active={categoryFilter === cat}
              onPress={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
              activeBg={c.text}
              inactiveBg={c.bg}
              inactiveText={c.text}
            />
          );
        })}
      </ScrollView>
      {filteredFeed.map((event, i) => renderEvent(event, event.id || i))}
      {filteredFeed.length === 0 && !loading && <Empty text="No activity in this category" />}
      {loading && feed.length === 0 && <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />}
    </ScrollView>
  );

  const roles = [...new Set(presence.map((p) => p.userRole).filter(Boolean))];
  const grouped = roles.reduce((acc: Record<string, any[]>, role) => {
    acc[role] = presence.filter((p) => p.userRole === role);
    return acc;
  }, {});

  const renderOnlineTab = () => (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.sectionLabel}>Online Users ({presence.length})</Text>
      {roles.map((role) => (
        <Widget key={role} title={`${role} (${grouped[role].length})`}>
          {grouped[role].map((u: any) => (
            <View key={`${u.userId}`} style={styles.presenceRow}>
              <View style={styles.presenceDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.presenceName}>{u.userName}</Text>
                {!!u.page && <Text style={styles.presencePage} numberOfLines={1}>{u.page}</Text>}
              </View>
            </View>
          ))}
        </Widget>
      ))}
      {roles.length === 0 && !loading && <Empty text="No users currently online" />}
    </ScrollView>
  );

  const alerts = buildAlerts();

  const renderAlertsTab = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {alerts.length === 0 ? (
        <Widget>
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>✅</Text>
            <Text style={styles.allClearText}>All systems normal</Text>
          </View>
        </Widget>
      ) : (
        alerts.map((alert, i) => {
          const sevColor = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.INFO;
          return (
            <View key={i} style={[styles.alertRow, { borderColor: `${sevColor}55` }]}>
              <View style={[styles.eventDot, { backgroundColor: sevColor, marginTop: spacing.sm }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertDescription}>{alert.description}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Activity Center"
        subtitle="Real-time school operations"
        leftIcon={onToggleDrawer ? { name: '☰', onPress: onToggleDrawer } : { name: '←', onPress: () => {} }}
        rightIcon={
          connected
            ? { name: '●', onPress: () => {} }
            : { name: '○', onPress: handleRefresh }
        }
      />
      <View style={styles.liveBanner}>
        <View style={[styles.livePulse, { backgroundColor: connected ? colors.success : colors.error }]} />
        <Text style={styles.liveText}>{connected ? 'LIVE — real-time sync active' : 'OFFLINE — retrying connection'}</Text>
      </View>

      <View style={styles.tabBar}>
        {([
          { key: 'overview', label: 'Overview' },
          { key: 'feed', label: 'Feed' },
          { key: 'online', label: `Online${presence.length ? ` (${presence.length})` : ''}` },
          { key: 'alerts', label: `Alerts${alerts.length ? ` (${alerts.length})` : ''}` },
        ] as { key: Tab; label: string }[]).map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.activeTab]} onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'feed' && renderFeedTab()}
      {activeTab === 'online' && renderOnlineTab()}
      {activeTab === 'alerts' && renderAlertsTab()}
    </SafeAreaView>
  );
};

// Local lightweight card wrappers to keep this file self-contained
const Widget: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.widget}>
    {!!title && <Text style={styles.widgetTitle}>{title}</Text>}
    {children}
  </View>
);

const Chip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
  activeBg?: string;
  inactiveBg?: string;
  inactiveText?: string;
}> = ({ label, active, onPress, activeBg, inactiveBg, inactiveText }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.chip,
      { backgroundColor: active ? activeBg || colors.primary : inactiveBg || colors.background },
    ]}
  >
    <Text style={[styles.chipText, { color: active ? colors.white : inactiveText || colors.textLight }]}>{label}</Text>
  </TouchableOpacity>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <Text style={styles.emptyText}>{text}</Text>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  livePulse: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.sm },
  activeTab: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '500', color: colors.textLight },
  activeTabText: { color: colors.white, fontWeight: '600' },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flexGrow: 1, minWidth: '47%', borderRadius: borderRadius.md, borderWidth: 1, padding: spacing.md },
  statValue: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textLight, marginTop: 2, letterSpacing: 0.5 },
  widget: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  widgetTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  eventRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#FAFBFC',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  eventContent: { flex: 1 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  eventTitle: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
  categoryBadge: { paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 999, borderWidth: 1 },
  categoryBadgeText: { fontSize: 9, fontWeight: '700' },
  eventDescription: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  eventMeta: { fontSize: 11, color: colors.textMuted },
  eventRole: { backgroundColor: colors.background, paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden' },
  chipsScroll: { marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, marginRight: spacing.xs },
  chipText: { fontSize: 11, fontWeight: '600' },
  emptyText: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl, fontSize: 13 },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  presenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  presenceName: { fontSize: 14, fontWeight: '600', color: colors.text },
  presencePage: { fontSize: 11, color: colors.textMuted },
  alertRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  alertTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  alertDescription: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  allClearText: { fontSize: 14, fontWeight: '600', color: colors.success },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  linkCardIcon: { fontSize: 22 },
  linkCardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  linkCardSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  linkCardArrow: { fontSize: 24, color: colors.textMuted },
});

export default ActivityCenterScreen;
