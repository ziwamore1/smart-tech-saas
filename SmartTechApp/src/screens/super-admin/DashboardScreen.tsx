import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useAuthStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface SuperAdminDashboardProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const SuperAdminDashboardScreen: React.FC<SuperAdminDashboardProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [mediaStats, setMediaStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [mediaStatsRes] = await Promise.all([
        apiService.getMediaStats(),
      ]);
      setMediaStats(mediaStatsRes);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleNavigate = (screen: string, params?: any) => {
    if (stackNavigation) {
      stackNavigation.navigate(screen as never, params as never);
    } else {
      navigation.navigate(screen as never, params as never);
    }
  };

  const totalFiles = mediaStats?.totalFiles ?? mediaStats?.total_count ?? 0;
  const storageUsed = mediaStats?.storageUsed ?? mediaStats?.storage_used ?? '0 MB';
  const redisStatus = mediaStats?.redis ?? mediaStats?.redis_status ?? 'connected';
  const cloudinaryStatus = mediaStats?.cloudinary ?? mediaStats?.cloudinary_status ?? 'connected';
  const apiStatus = mediaStats?.api ?? mediaStats?.api_status ?? 'healthy';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="SuperAdmin Dashboard"
        subtitle={user?.firstName ? `Welcome, ${user.firstName}` : 'System Overview'}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsRow}>
          <StatCard label="Total Schools" value={stats?.totalSchools ?? '—'} icon="🏫" color={colors.purple} bgColor={colors.purpleLight} />
          <StatCard label="Total Students" value={stats?.totalStudents ?? '—'} icon="👥" color={colors.success} bgColor={colors.successLight} />
          <StatCard label="Total Teachers" value={stats?.totalTeachers ?? '—'} icon="👨‍🏫" color={colors.warning} bgColor={colors.warningLight} />
          <StatCard label="Total Users" value={stats?.totalUsers ?? '—'} icon="👤" color={colors.info} bgColor={colors.infoLight} />
        </View>

        <WidgetCard title="System Health">
          <View style={styles.healthRow}>
            <View style={styles.healthItem}>
              <View style={[styles.statusDot, { backgroundColor: redisStatus === 'connected' ? colors.success : colors.error }]} />
              <View style={styles.healthInfo}>
                <Text style={styles.healthLabel}>Redis</Text>
                <Text style={styles.healthValue}>{redisStatus === 'connected' ? 'Connected' : 'Disconnected'}</Text>
              </View>
            </View>
            <View style={styles.healthItem}>
              <View style={[styles.statusDot, { backgroundColor: cloudinaryStatus === 'connected' ? colors.success : colors.error }]} />
              <View style={styles.healthInfo}>
                <Text style={styles.healthLabel}>Cloudinary</Text>
                <Text style={styles.healthValue}>{typeof storageUsed === 'string' ? storageUsed : `${storageUsed} used`}</Text>
              </View>
            </View>
            <View style={styles.healthItem}>
              <View style={[styles.statusDot, { backgroundColor: apiStatus === 'healthy' ? colors.success : colors.error }]} />
              <View style={styles.healthInfo}>
                <Text style={styles.healthLabel}>API</Text>
                <Text style={styles.healthValue}>{apiStatus === 'healthy' ? 'Healthy' : 'Degraded'}</Text>
              </View>
            </View>
          </View>
        </WidgetCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => handleNavigate('SuperAdminMedia')}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.purpleLight }]}>
              <Text style={styles.quickActionEmoji}>☁️</Text>
            </View>
            <Text style={styles.quickActionLabel}>Media Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => handleNavigate('SuperAdminMonitoring')}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.infoLight }]}>
              <Text style={styles.quickActionEmoji}>📊</Text>
            </View>
            <Text style={styles.quickActionLabel}>Monitoring</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => handleNavigate('SuperAdminSchools')}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.warningLight }]}>
              <Text style={styles.quickActionEmoji}>🏫</Text>
            </View>
            <Text style={styles.quickActionLabel}>Schools</Text>
          </TouchableOpacity>
        </View>

        <GradientCard
          title="Media Overview"
          subtitle={`${totalFiles} files stored in Cloudinary`}
          icon="☁️"
          gradient={colors.gradient.cardPurple}
          style={styles.mediaCard}
        >
          <View style={styles.mediaStatsRow}>
            <View style={styles.mediaStatItem}>
              <Text style={styles.mediaStatValue}>{totalFiles}</Text>
              <Text style={styles.mediaStatLabel}>Total Files</Text>
            </View>
            <View style={styles.mediaStatDivider} />
            <View style={styles.mediaStatItem}>
              <Text style={styles.mediaStatValue}>{typeof storageUsed === 'string' ? storageUsed.split(' ')[0] : storageUsed}</Text>
              <Text style={styles.mediaStatLabel}>Storage Used</Text>
            </View>
          </View>
        </GradientCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  healthRow: { gap: spacing.md },
  healthItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.md },
  healthInfo: { flex: 1 },
  healthLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  healthValue: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  quickActionsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  quickActionCard: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', ...shadows.card },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  quickActionEmoji: { fontSize: 20 },
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  mediaCard: { marginBottom: spacing.md },
  mediaStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.sm, marginTop: spacing.sm },
  mediaStatItem: { alignItems: 'center' },
  mediaStatValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  mediaStatLabel: { fontSize: 11, color: colors.textLight, marginTop: 2, textTransform: 'uppercase' },
  mediaStatDivider: { width: 1, height: 30, backgroundColor: colors.border },
});
