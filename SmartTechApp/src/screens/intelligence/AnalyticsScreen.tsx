import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Loading } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';


export const AnalyticsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboard } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [trajectory, setTrajectory] = useState<any>(null);
  const [weaknesses, setWeaknesses] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (!user?.id) return;
      const termId = dashboard?.currentTerm?.id;
      const [statsRes, trajRes, weakRes] = await Promise.allSettled([
        apiService.getStudentStats(user.id),
        apiService.getStudentGrowthTrajectory(user.id),
        termId ? apiService.getCompetencyDiagnosis(user.id, termId) : Promise.reject('no term'),
      ]);
      if (statsRes.status === 'fulfilled') {
        const raw = statsRes.value?.data || statsRes.value;
        if (raw?.descriptiveStats || raw?.comparativeStats) {
          setStats({
            mean: raw.descriptiveStats?.mean,
            median: raw.descriptiveStats?.median,
            stdDev: raw.descriptiveStats?.stdDev,
            variance: raw.descriptiveStats?.variance,
            mode: raw.descriptiveStats?.mode,
            min: raw.descriptiveStats?.min,
            max: raw.descriptiveStats?.max,
            count: raw.descriptiveStats?.count,
            percentile: raw.comparativeStats?.percentile,
            zScore: raw.comparativeStats?.zScore,
            schoolMean: raw.comparativeStats?.schoolMean,
            interpretation: raw.comparativeStats?.interpretation,
            subjectBreakdown: raw.subjectBreakdown,
          });
        } else {
          setStats(raw);
        }
      }
      if (trajRes.status === 'fulfilled') setTrajectory(trajRes.value?.data || trajRes.value);
      if (weakRes.status === 'fulfilled') setWeaknesses(weakRes.value?.data || weakRes.value);
    } catch (err) { console.error('Analytics load error'); }
    finally { setLoading(false); }
  };

  if (loading) return <Loading fullScreen message="Loading analytics..." />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Analytics</Text>
        <Text style={styles.headerSub}>Performance insights</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {stats && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.mean?.toFixed(1) || '-'}</Text>
                <Text style={styles.statLabel}>Mean</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.median?.toFixed(1) || '-'}</Text>
                <Text style={styles.statLabel}>Median</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.stdDev?.toFixed(2) || '-'}</Text>
                <Text style={styles.statLabel}>Std Dev</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.percentile?.toFixed(0) || '-'}</Text>
                <Text style={styles.statLabel}>Percentile</Text>
              </View>
            </View>
          </Card>
        )}

        {trajectory?.history && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Growth Trajectory</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, paddingVertical: spacing.sm }}>
              {trajectory.history.map((h: any, i: number) => {
                const val = h.average || h.score || 0;
                const dotColor = h.trend === 'up' ? '#10b981' : h.trend === 'down' ? '#ef4444' : '#f59e0b';
                return (
                  <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: dotColor, marginBottom: 2 }}>{val}%</Text>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, marginBottom: 2 }} />
                    <View style={{ width: 24, height: val * 1.4, backgroundColor: colors.primaryLight, borderRadius: 3, opacity: 0.3 }} />
                    <Text style={{ fontSize: 9, color: colors.textLight, marginTop: 4 }}>{h.term || `T${i + 1}`}</Text>
                  </View>
                );
              })}
            </View>
            {trajectory.prediction && (
              <View style={[styles.trajectoryRow, { opacity: 0.6, marginTop: spacing.sm }]}>
                <View style={[styles.trajectoryDot, { backgroundColor: '#8b5cf6' }]} />
                <Text style={styles.trajectoryLabel}>Predicted Next</Text>
                <Text style={styles.trajectoryValue}>{trajectory.prediction}%</Text>
              </View>
            )}
          </Card>
        )}

        {weaknesses?.weaknesses && weaknesses.weaknesses.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Areas to Improve</Text>
            {weaknesses.weaknesses.map((w: any, i: number) => (
              <View key={i} style={styles.weaknessRow}>
                <Text style={styles.weaknessSubject}>{w.subject || w.name || w.area}</Text>
                <View style={styles.weaknessScoreRow}>
                  <View style={styles.weaknessBar}>
                    <View style={[styles.weaknessFill, { width: `${Math.min(w.score || w.proficiency || 0, 100)}%`, backgroundColor: (w.score || 0) >= 75 ? '#10b981' : (w.score || 0) >= 50 ? '#f59e0b' : '#ef4444' }]} />
                  </View>
                  <Text style={styles.weaknessScore}>{w.score || w.proficiency || 0}%</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {!stats && !trajectory && !weaknesses && (
          <Card style={{ padding: spacing.xl }}>
            <Text style={{ textAlign: 'center', color: colors.textLight, fontSize: 16 }}>No analytics data available yet</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  sectionCard: { padding: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  trajectoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  trajectoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  trajectoryLabel: { flex: 1, fontSize: 14, color: colors.text },
  trajectoryValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  weaknessRow: { marginBottom: spacing.sm },
  weaknessSubject: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  weaknessScoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weaknessBar: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4 },
  weaknessFill: { height: 8, borderRadius: 4 },
  weaknessScore: { fontSize: 13, fontWeight: '700', color: colors.text, width: 40, textAlign: 'right' },
});
