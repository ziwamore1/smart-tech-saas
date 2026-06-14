import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HeaderBar, StatCard, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { apiService } from '../../services/api';

interface CommunicationsScreenProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const SuperAdminCommunicationsScreen: React.FC<CommunicationsScreenProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [dashboard, setDashboard] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dashboardRes, providersRes] = await Promise.all([
        apiService.getSystemCommunicationsDashboard().catch(() => null),
        apiService.getSystemProviders().catch(() => []),
      ]);
      if (dashboardRes) setDashboard(dashboardRes);
      if (Array.isArray(providersRes)) setProviders(providersRes);
    } catch (err) {
      console.error('Failed to load communications data:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const d = dashboard?.data || dashboard || {};
  const providerList = providers?.data || providers || [];

  const activeProviders = providerList.filter((p: any) => p.status === 'connected' || p.isActive).length;
  const totalTemplates = d.totalTemplates ?? d.templates ?? 0;
  const totalBroadcasts = d.totalBroadcasts ?? d.broadcasts ?? 0;
  const totalCampaigns = d.totalCampaigns ?? d.campaigns ?? 0;
  const totalSent = d.totalSent ?? d.sent ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Communications Hub"
        subtitle="System-wide messaging & providers"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsRow}>
          <StatCard label="Providers" value={providerList.length} icon="📡" color={colors.info} bgColor={colors.infoLight} />
          <StatCard label="Templates" value={totalTemplates} icon="📄" color={colors.purple} bgColor={colors.purpleLight} />
          <StatCard label="Campaigns" value={totalCampaigns} icon="📢" color={colors.warning} bgColor={colors.warningLight} />
          <StatCard label="Sent" value={totalSent} icon="✉️" color={colors.success} bgColor={colors.successLight} />
        </View>

        <WidgetCard title="Provider Status">
          {providerList.length === 0 ? (
            <Text style={styles.emptyText}>No providers configured yet.</Text>
          ) : (
            providerList.slice(0, 5).map((provider: any, i: number) => (
              <View key={provider.id || i} style={styles.providerRow}>
                <View style={[styles.statusDot, {
                  backgroundColor: provider.status === 'connected' || provider.isActive ? colors.success : colors.error
                }]} />
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.providerType}>{provider.type} {provider.isDefault ? '(Default)' : ''}</Text>
                </View>
                <Text style={[styles.providerStatus, {
                  color: provider.status === 'connected' || provider.isActive ? colors.success : colors.error
                }]}>
                  {provider.status === 'connected' || provider.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            ))
          )}
          {providerList.length > 5 && (
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => onNavigate?.('SuperAdminCommunications')}>
              <Text style={styles.viewAllText}>View all {providerList.length} providers</Text>
            </TouchableOpacity>
          )}
        </WidgetCard>

        <WidgetCard title="Quick Actions">
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate?.('SuperAdminCommunications')}>
              <View style={[styles.actionCircle, { backgroundColor: colors.infoLight }]}>
                <Text style={styles.actionEmoji}>📡</Text>
              </View>
              <Text style={styles.actionLabel}>Providers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate?.('SuperAdminCommunications')}>
              <View style={[styles.actionCircle, { backgroundColor: colors.purpleLight }]}>
                <Text style={styles.actionEmoji}>📄</Text>
              </View>
              <Text style={styles.actionLabel}>Templates</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate?.('SuperAdminCommunications')}>
              <View style={[styles.actionCircle, { backgroundColor: colors.warningLight }]}>
                <Text style={styles.actionEmoji}>📢</Text>
              </View>
              <Text style={styles.actionLabel}>Campaigns</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate?.('SuperAdminCommunications')}>
              <View style={[styles.actionCircle, { backgroundColor: colors.successLight }]}>
                <Text style={styles.actionEmoji}>📊</Text>
              </View>
              <Text style={styles.actionLabel}>Analytics</Text>
            </TouchableOpacity>
          </View>
        </WidgetCard>

        {totalBroadcasts > 0 && (
          <WidgetCard title="Recent Broadcasts" action={{ label: 'View All', onPress: () => onNavigate?.('SuperAdminCommunications') }}>
            <Text style={styles.broadcastCount}>{totalBroadcasts} broadcasts scheduled or sent</Text>
          </WidgetCard>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  providerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  providerType: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  providerStatus: { fontSize: 12, fontWeight: '600' },
  viewAllBtn: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  viewAllText: { fontSize: 13, fontWeight: '600', color: colors.primaryLight },
  actionsGrid: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  actionItem: { alignItems: 'center', width: 70 },
  actionCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  broadcastCount: { fontSize: 14, color: colors.textSecondary },
});
