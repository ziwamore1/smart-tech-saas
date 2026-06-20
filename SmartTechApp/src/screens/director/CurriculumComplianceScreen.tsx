import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useAuthStore } from '../../store';

interface Props { onToggleDrawer?: () => void }

export const DirectorCurriculumScreen: React.FC<Props> = ({ onToggleDrawer }) => {
  const { user } = useAuthStore();
  const schoolId = user?.schoolId || user?.school?.id || '';
  const [compliance, setCompliance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    try {
      const res = await apiService.getCurriculumCompliance(schoolId);
      setCompliance(res);
    } catch (err) {
      console.error('Failed to load compliance:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ON_TRACK': return colors.success;
      case 'NEEDS_ATTENTION': return colors.warning;
      case 'BEHIND': return colors.error;
      default: return colors.textLight;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ON_TRACK': return '✅';
      case 'NEEDS_ATTENTION': return '⚠️';
      case 'BEHIND': return '❌';
      default: return '➖';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Curriculum Compliance"
        subtitle={compliance ? `${compliance.overallCoverage}% coverage` : 'Loading...'}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔄', onPress: onRefresh }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : !compliance ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>Unable to load compliance data</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
                <Text style={styles.statValue}>{compliance.onTrack ?? 0}</Text>
                <Text style={styles.statLabel}>On Track</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
                <Text style={styles.statValue}>{compliance.needsAttention ?? 0}</Text>
                <Text style={styles.statLabel}>Needs Attention</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.errorLight }]}>
                <Text style={styles.statValue}>{compliance.behind ?? 0}</Text>
                <Text style={styles.statLabel}>Behind</Text>
              </View>
            </View>

            <View style={styles.overallCard}>
              <Text style={styles.overallPercent}>{compliance.overallCoverage ?? 0}%</Text>
              <Text style={styles.overallLabel}>Overall Curriculum Coverage</Text>
              <View style={[styles.progressBar, { backgroundColor: colors.borderLight }]}>
                <View style={[styles.progressFill, { width: `${compliance.overallCoverage ?? 0}%`, backgroundColor: (compliance.overallCoverage ?? 0) >= 75 ? colors.success : (compliance.overallCoverage ?? 0) >= 50 ? colors.warning : colors.error }]} />
              </View>
            </View>

            <WidgetCard title="Subject & Class Breakdown">
              {compliance.details?.length === 0 ? (
                <Text style={styles.emptyText}>No data available</Text>
              ) : (
                compliance.details?.map((d: any, i: number) => (
                  <TouchableOpacity key={i} style={styles.detailRow}>
                    <View style={styles.detailInfo}>
                      <Text style={styles.detailClass}>{d.class}</Text>
                      <Text style={styles.detailSubject}>{d.subject}</Text>
                    </View>
                    <View style={styles.detailMeta}>
                      <Text style={[styles.detailPercent, { color: getStatusColor(d.status) }]}>{d.coveragePercent}%</Text>
                      <Text style={styles.detailStatus}>{getStatusIcon(d.status)}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </WidgetCard>
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 2, textTransform: 'uppercase' },
  overallCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, alignItems: 'center', ...shadows.card },
  overallPercent: { fontSize: 36, fontWeight: '800', color: colors.primary },
  overallLabel: { fontSize: 13, color: colors.textLight, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  progressBar: { width: '100%', height: 8, borderRadius: 4, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailInfo: { flex: 1 },
  detailClass: { fontSize: 14, fontWeight: '600', color: colors.text },
  detailSubject: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailPercent: { fontSize: 16, fontWeight: '700' },
  detailStatus: { fontSize: 16 },
});
