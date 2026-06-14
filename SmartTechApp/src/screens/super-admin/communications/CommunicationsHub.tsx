import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HeaderBar } from '../../../components';
import { colors, spacing, borderRadius, shadows, typography } from '../../../theme';
import { apiService } from '../../../services/api';

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'providers', label: 'Providers', icon: '📡' },
  { key: 'campaigns', label: 'Campaigns', icon: '📢' },
  { key: 'broadcasts', label: 'Broadcasts', icon: '📯' },
  { key: 'templates', label: 'Templates', icon: '📄' },
  { key: 'analytics', label: 'Analytics', icon: '📈' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'delivery', label: 'Delivery', icon: '📨' },
  { key: 'scheduled', label: 'Scheduled', icon: '⏰' },
  { key: 'youtube', label: 'YouTube', icon: '🎬' },
];

interface CommunicationsHubProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const CommunicationsHub: React.FC<CommunicationsHubProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [dashboard, setDashboard] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [youtubeChannels, setYoutubeChannels] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, provRes, campRes, broadRes, templRes, anRes, notifRes, delRes, schedRes, ytRes] =
        await Promise.all([
          apiService.getSystemCommunicationsDashboard().catch(() => null),
          apiService.getSystemProviders().catch(() => ({ data: [] })),
          apiService.getSystemCampaigns().catch(() => ({ campaigns: [] })),
          apiService.getSystemBroadcasts().catch(() => ({ broadcasts: [] })),
          apiService.getSystemTemplates().catch(() => ({ data: [] })),
          apiService.getSystemAnalytics().catch(() => ({ channels: {}, trends: [] })),
          apiService.getSystemNotifications().catch(() => ({ notifications: [] })),
          apiService.getSystemDeliveryLogs().catch(() => ({ logs: [] })),
          apiService.getSystemScheduledMessages().catch(() => ({ data: [] })),
          apiService.getSystemYouTubeChannels().catch(() => ({ data: [] })),
        ]);

      if (dashRes) setDashboard(dashRes?.data || dashRes);
      setProviders(provRes?.data || provRes || []);
      setCampaigns(campRes?.campaigns || []);
      setBroadcasts(broadRes?.broadcasts || []);
      setTemplates(templRes?.data || templRes || []);
      setAnalytics(anRes);
      setNotifications(notifRes?.notifications || []);
      setDeliveryLogs(delRes?.logs || []);
      setScheduled(schedRes?.data || schedRes || []);
      setYoutubeChannels(ytRes?.data || ytRes || []);
    } catch (err) {
      console.error('Failed to load communications data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleTestProvider = async (id: string) => {
    try {
      await apiService.testSystemProviderConnection(id);
      loadAll();
    } catch (err) {
      console.error('Test provider failed:', err);
    }
  };

  const d = useMemo(() => {
    const raw = dashboard?.data || dashboard || {};
    return {
      providers: Array.isArray(providers) ? providers.length : 0,
      templates: raw.totalTemplates ?? raw.templates ?? templates.length ?? 0,
      campaigns: raw.totalCampaigns ?? raw.campaigns ?? campaigns.length ?? 0,
      broadcasts: raw.totalBroadcasts ?? raw.broadcasts ?? broadcasts.length ?? 0,
      sent: raw.totalSent ?? raw.sent ?? 0,
      delivered: raw.totalDelivered ?? raw.delivered ?? 0,
      failed: raw.totalFailed ?? raw.failed ?? 0,
    };
  }, [dashboard, providers, templates, campaigns, broadcasts]);

  const renderDashboard = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
          <Text style={styles.statEmoji}>📡</Text>
          <Text style={[styles.statValue, { color: colors.info }]}>{d.providers}</Text>
          <Text style={styles.statLabel}>Providers</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.purpleLight }]}>
          <Text style={styles.statEmoji}>📄</Text>
          <Text style={[styles.statValue, { color: colors.purple }]}>{d.templates}</Text>
          <Text style={styles.statLabel}>Templates</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
          <Text style={styles.statEmoji}>📢</Text>
          <Text style={[styles.statValue, { color: colors.warning }]}>{d.campaigns}</Text>
          <Text style={styles.statLabel}>Campaigns</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
          <Text style={styles.statEmoji}>✉️</Text>
          <Text style={[styles.statValue, { color: colors.success }]}>{d.sent}</Text>
          <Text style={styles.statLabel}>Sent</Text>
        </View>
      </View>

      <View style={styles.widget}>
        <Text style={styles.widgetTitle}>Provider Status</Text>
        {providers.length === 0 ? (
          <Text style={styles.emptyText}>No providers configured.</Text>
        ) : (
          providers.slice(0, 5).map((p: any) => (
            <View key={p.id} style={styles.providerRow}>
              <View style={[styles.statusDot, { backgroundColor: p.status === 'Connected' ? colors.success : colors.error }]} />
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{p.name}</Text>
                <Text style={styles.providerChannel}>{p.channel} {p.isDefault ? '(Default)' : ''}</Text>
              </View>
              <Text style={[styles.providerStatus, { color: p.status === 'Connected' ? colors.success : colors.error }]}>
                {p.status}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.widget}>
        <Text style={styles.widgetTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {SECTIONS.filter(s => s.key !== 'dashboard').map((section) => (
            <TouchableOpacity
              key={section.key}
              style={styles.actionItem}
              onPress={() => setActiveSection(section.key)}
            >
              <View style={[styles.actionCircle, { backgroundColor: colors.infoLight }]}>
                <Text style={styles.actionEmoji}>{section.icon}</Text>
              </View>
              <Text style={styles.actionLabel}>{section.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderProviders = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      {providers.map((p: any) => (
        <View key={p.id} style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={[styles.detailStatusDot, { backgroundColor: p.status === 'Connected' ? colors.success : colors.error }]} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailName}>{p.name}</Text>
              <Text style={styles.detailMeta}>{p.channel} • {p.type}</Text>
            </View>
            {p.isDefault && <View style={styles.defaultBadge}><Text style={styles.defaultText}>Default</Text></View>}
          </View>
          <View style={styles.detailBody}>
            {p.host && <Text style={styles.detailField}>Host: {p.host}</Text>}
            {p.port && <Text style={styles.detailField}>Port: {p.port}</Text>}
            {p.senderEmail && <Text style={styles.detailField}>Email: {p.senderEmail}</Text>}
            {p.senderName && <Text style={styles.detailField}>Sender: {p.senderName}</Text>}
            <Text style={styles.detailField}>Status: {p.status}</Text>
            {p.lastTestedAt && <Text style={styles.detailField}>Last tested: {new Date(p.lastTestedAt).toLocaleDateString()}</Text>}
          </View>
          <View style={styles.detailActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleTestProvider(p.id)}>
              <Text style={styles.actionBtnText}>Test Connection</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {providers.length === 0 && <Text style={styles.emptyText}>No providers configured.</Text>}
    </ScrollView>
  );

  const renderCampaigns = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      {campaigns.map((c: any) => (
        <View key={c.id} style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{c.name}</Text>
              <Text style={styles.detailMeta}>{c.channel} • {c.status}</Text>
            </View>
          </View>
          {c.description && <Text style={styles.detailField}>{c.description}</Text>}
          <View style={styles.detailBody}>
            <Text style={styles.detailField}>Sent: {c.sentCount || 0}</Text>
            <Text style={styles.detailField}>Delivered: {c.deliveredCount || 0}</Text>
            {c.scheduledAt && <Text style={styles.detailField}>Scheduled: {new Date(c.scheduledAt).toLocaleString()}</Text>}
          </View>
        </View>
      ))}
      {campaigns.length === 0 && <Text style={styles.emptyText}>No campaigns yet.</Text>}
    </ScrollView>
  );

  const renderBroadcasts = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      {broadcasts.map((b: any) => (
        <View key={b.id} style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{b.subject || b.name || 'Broadcast'}</Text>
              <Text style={styles.detailMeta}>{b.channel} • {b.status}</Text>
            </View>
          </View>
          <Text style={styles.detailField} numberOfLines={2}>{b.content || b.message}</Text>
          <View style={styles.detailBody}>
            <Text style={styles.detailField}>Recipients: {b.recipientCount || 0}</Text>
            <Text style={styles.detailField}>Sent: {b.sentCount || 0}</Text>
            {b.scheduledAt && <Text style={styles.detailField}>Scheduled: {new Date(b.scheduledAt).toLocaleString()}</Text>}
          </View>
        </View>
      ))}
      {broadcasts.length === 0 && <Text style={styles.emptyText}>No broadcasts yet.</Text>}
    </ScrollView>
  );

  const renderTemplates = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      {templates.map((t: any) => (
        <View key={t.id} style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{t.name}</Text>
              <Text style={styles.detailMeta}>{t.channel || t.type} • {t.category || 'General'} • {t.scope || 'System'}</Text>
            </View>
          </View>
          {t.subject && <Text style={styles.detailField}>Subject: {t.subject}</Text>}
          <Text style={styles.detailField} numberOfLines={2}>{t.content || t.body}</Text>
        </View>
      ))}
      {templates.length === 0 && <Text style={styles.emptyText}>No templates yet.</Text>}
    </ScrollView>
  );

  const renderAnalytics = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
          <Text style={styles.statEmoji}>✉️</Text>
          <Text style={[styles.statValue, { color: colors.info }]}>{analytics?.channels?.email?.sent || 0}</Text>
          <Text style={styles.statLabel}>Email Sent</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
          <Text style={styles.statEmoji}>✅</Text>
          <Text style={[styles.statValue, { color: colors.success }]}>{analytics?.channels?.email?.delivered || 0}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
          <Text style={styles.statEmoji}>💬</Text>
          <Text style={[styles.statValue, { color: colors.warning }]}>{analytics?.channels?.sms?.sent || 0}</Text>
          <Text style={styles.statLabel}>SMS Sent</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.errorLight }]}>
          <Text style={styles.statEmoji}>❌</Text>
          <Text style={[styles.statValue, { color: colors.error }]}>{analytics?.channels?.email?.failed || 0}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>
      {analytics?.channels?.push && (
        <View style={styles.widget}>
          <Text style={styles.widgetTitle}>Push Notifications</Text>
          <View style={styles.detailBody}>
            <Text style={styles.detailField}>Sent: {analytics.channels.push.sent || 0}</Text>
            <Text style={styles.detailField}>Opened: {analytics.channels.push.opened || 0}</Text>
          </View>
        </View>
      )}
      {analytics?.trends?.length > 0 && (
        <View style={styles.widget}>
          <Text style={styles.widgetTitle}>Recent Trends (last {analytics.trends.length} days)</Text>
          {analytics.trends.slice(-7).map((t: any, i: number) => (
            <View key={i} style={styles.trendRow}>
              <Text style={styles.detailField}>{t.date ? new Date(t.date).toLocaleDateString() : `Day ${i + 1}`}</Text>
              <Text style={styles.detailField}>{t.total || t.sent || 0} messages</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderNotifications = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      {notifications.map((n: any) => (
        <View key={n.id} style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{n.subject || n.title || 'Notification'}</Text>
              <Text style={styles.detailMeta}>{n.channel} • {n.status}</Text>
            </View>
          </View>
          <Text style={styles.detailField} numberOfLines={2}>{n.content || n.message || n.body}</Text>
          <View style={styles.detailBody}>
            <Text style={styles.detailField}>Recipients: {n.recipientCount || n.recipients?.length || 0}</Text>
            {n.sentAt && <Text style={styles.detailField}>Sent: {new Date(n.sentAt).toLocaleString()}</Text>}
          </View>
        </View>
      ))}
      {notifications.length === 0 && <Text style={styles.emptyText}>No notifications sent.</Text>}
    </ScrollView>
  );

  const renderDeliveryLogs = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      {deliveryLogs.map((log: any) => (
        <View key={log.id} style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{log.subject || log.recipient || 'Delivery'}</Text>
              <Text style={styles.detailMeta}>{log.channel} • {log.status}</Text>
            </View>
          </View>
          <View style={styles.detailBody}>
            <Text style={styles.detailField}>To: {log.recipient || log.to || '-'}</Text>
            <Text style={styles.detailField}>Provider: {log.provider || '-'}</Text>
            {log.errorMessage && <Text style={[styles.detailField, { color: colors.error }]}>Error: {log.errorMessage}</Text>}
            {log.sentAt && <Text style={styles.detailField}>Time: {new Date(log.sentAt).toLocaleString()}</Text>}
          </View>
        </View>
      ))}
      {deliveryLogs.length === 0 && <Text style={styles.emptyText}>No delivery logs.</Text>}
    </ScrollView>
  );

  const renderScheduled = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      {scheduled.map((s: any) => (
        <View key={s.id} style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{s.subject || s.name || 'Scheduled'}</Text>
              <Text style={styles.detailMeta}>{s.channel} • {s.status}</Text>
            </View>
          </View>
          <Text style={styles.detailField} numberOfLines={1}>{s.content || s.message}</Text>
          <View style={styles.detailBody}>
            {s.scheduledAt && <Text style={styles.detailField}>Scheduled: {new Date(s.scheduledAt).toLocaleString()}</Text>}
            {s.recipientCount && <Text style={styles.detailField}>Recipients: {s.recipientCount}</Text>}
          </View>
        </View>
      ))}
      {scheduled.length === 0 && <Text style={styles.emptyText}>No scheduled messages.</Text>}
    </ScrollView>
  );

  const renderYouTube = () => (
    <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      {youtubeChannels.map((ch: any) => (
        <View key={ch.id} style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailName}>{ch.name || ch.channelName || 'YouTube Channel'}</Text>
          </View>
          <View style={styles.detailBody}>
            <Text style={styles.detailField}>Channel ID: {ch.channelId || ch.youtubeChannelId || '-'}</Text>
            {ch.subscriberCount !== undefined && <Text style={styles.detailField}>Subscribers: {ch.subscriberCount}</Text>}
            {ch.lastVideoAt && <Text style={styles.detailField}>Last video: {new Date(ch.lastVideoAt).toLocaleDateString()}</Text>}
          </View>
        </View>
      ))}
      {youtubeChannels.length === 0 && <Text style={styles.emptyText}>No YouTube channels connected.</Text>}
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard': return renderDashboard();
      case 'providers': return renderProviders();
      case 'campaigns': return renderCampaigns();
      case 'broadcasts': return renderBroadcasts();
      case 'templates': return renderTemplates();
      case 'analytics': return renderAnalytics();
      case 'notifications': return renderNotifications();
      case 'delivery': return renderDeliveryLogs();
      case 'scheduled': return renderScheduled();
      case 'youtube': return renderYouTube();
      default: return renderDashboard();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title="Communications Hub"
        subtitle={SECTIONS.find(s => s.key === activeSection)?.label || ''}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔄', onPress: onRefresh }}
      />

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {SECTIONS.map((section) => (
            <TouchableOpacity
              key={section.key}
              style={[styles.tab, activeSection === section.key && styles.tabActive]}
              onPress={() => setActiveSection(section.key)}
            >
              <Text style={styles.tabIcon}>{section.icon}</Text>
              <Text style={[styles.tabLabel, activeSection === section.key && styles.tabLabelActive]}>
                {section.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabBar: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, ...shadows.sm },
  tabScroll: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginHorizontal: 2, borderRadius: borderRadius.md },
  tabActive: { backgroundColor: colors.infoLight },
  tabIcon: { fontSize: 14, marginRight: spacing.xs },
  tabLabel: { fontSize: 12, fontWeight: '600', color: colors.textLight },
  tabLabelActive: { color: colors.primary },
  content: { flex: 1 },
  sectionScroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: '45%', padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  statEmoji: { fontSize: 24, marginBottom: spacing.xs },
  statValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '500', color: colors.textLight, marginTop: 2, textTransform: 'uppercase' },
  widget: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
  widgetTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  providerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  providerChannel: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  providerStatus: { fontSize: 12, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionItem: { alignItems: 'center', width: '18%', minWidth: 60, marginBottom: spacing.sm },
  actionCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  actionEmoji: { fontSize: 18 },
  actionLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  detailCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  detailStatusDot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.md },
  detailInfo: { flex: 1 },
  detailName: { fontSize: 15, fontWeight: '600', color: colors.text },
  detailMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  defaultBadge: { backgroundColor: colors.successLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  defaultText: { fontSize: 10, fontWeight: '700', color: colors.success },
  detailBody: { marginTop: spacing.xs },
  detailField: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  detailActions: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  actionBtn: { backgroundColor: colors.infoLight, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
});
