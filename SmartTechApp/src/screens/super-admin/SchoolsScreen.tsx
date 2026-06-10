import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface SuperAdminSchoolsProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const SuperAdminSchoolsScreen: React.FC<SuperAdminSchoolsProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [mediaStats] = await Promise.all([
        apiService.getMediaStats(),
      ]);
      setStats(mediaStats);
    } catch (err) {
      console.error('Failed to load schools data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalSchools = stats?.totalSchools ?? stats?.schools_count ?? '—';
  const activeSchools = stats?.activeSchools ?? stats?.active_schools ?? '—';
  const trialSchools = stats?.trialSchools ?? stats?.trial_schools ?? '—';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Schools Overview"
        subtitle="System-wide school management"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔍', onPress: () => {} }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsRow}>
          <StatCard label="Total Schools" value={totalSchools} icon="🏫" color={colors.purple} bgColor={colors.purpleLight} />
          <StatCard label="Active Schools" value={activeSchools} icon="✅" color={colors.success} bgColor={colors.successLight} />
          <StatCard label="Trial Schools" value={trialSchools} icon="🆓" color={colors.warning} bgColor={colors.warningLight} />
        </View>

        <WidgetCard title="School Directory">
          <View style={styles.comingSoonContainer}>
            <Text style={styles.comingSoonIcon}>🏗️</Text>
            <Text style={styles.comingSoonTitle}>Coming Soon</Text>
            <Text style={styles.comingSoonDescription}>
              Detailed school management including per-school storage usage, user management, and configuration will be available in a future update.
            </Text>
          </View>
        </WidgetCard>

        <WidgetCard title="Storage Overview">
          <View style={styles.storageOverviewRow}>
            <View style={styles.storageOverviewItem}>
              <Text style={styles.storageOverviewValue}>{stats?.totalFiles ?? stats?.total_count ?? '—'}</Text>
              <Text style={styles.storageOverviewLabel}>Total Files</Text>
            </View>
            <View style={styles.storageOverviewItem}>
              <Text style={styles.storageOverviewValue}>
                {stats?.storageUsed
                  ? typeof stats.storageUsed === 'string'
                    ? stats.storageUsed.split(' ')[0]
                    : `${(stats.storageUsed / 1073741824).toFixed(1)} GB`
                  : '—'}
              </Text>
              <Text style={styles.storageOverviewLabel}>Storage Used</Text>
            </View>
          </View>
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  comingSoonContainer: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  comingSoonIcon: { fontSize: 48, marginBottom: spacing.md },
  comingSoonTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  comingSoonDescription: { fontSize: 13, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
  storageOverviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.md },
  storageOverviewItem: { alignItems: 'center' },
  storageOverviewValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  storageOverviewLabel: { fontSize: 11, color: colors.textLight, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
});
