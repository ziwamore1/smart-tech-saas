import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';

interface ChildAnalytics {
  id: string;
  name: string;
  stats?: {
    average?: number;
    grade?: string;
    rank?: number;
    totalStudents?: number;
    subjectsCount?: number;
    attendanceRate?: number;
  };
  trend?: {
    direction: 'up' | 'down' | 'stable';
    change: number;
    periods: { label: string; average: number }[];
  };
  performanceCategory?: { label: string; color: string };
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
}

export const ParentAnalyticsScreen: React.FC = () => {
  const { dashboard } = useAppStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<ChildAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const kids = dashboard?.children || [];
    setChildren(kids);
    if (kids.length > 0 && !selectedChildId) {
      setSelectedChildId(kids[0].id);
    }
  }, [dashboard]);

  useEffect(() => {
    if (selectedChildId) loadAnalytics();
  }, [selectedChildId]);

  const loadAnalytics = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const childData = children.find(c => c.id === selectedChildId);
      const childName = childData?.name || `${childData?.firstName || ''} ${childData?.lastName || ''}`.trim() || 'Child';
      const termId = dashboard?.currentTerm?.id;

      const [statsRes, trendRes, recRes, compRes] = await Promise.allSettled([
        apiService.getParentStudentStats(selectedChildId),
        termId ? apiService.getParentAnalytics(selectedChildId) : Promise.reject('no term'),
        termId ? apiService.getParentRecommendations(selectedChildId, termId) : Promise.reject('no term'),
        termId ? apiService.getParentCompetencyDiagnosis(selectedChildId, termId) : Promise.reject('no term'),
      ]);

      const stats = statsRes.status === 'fulfilled' ? statsRes.value?.data || statsRes.value : undefined;
      const trend = trendRes.status === 'fulfilled' ? trendRes.value?.data || trendRes.value : undefined;
      const recs = recRes.status === 'fulfilled' ? recRes.value?.data || recRes.value : undefined;
      const comp = compRes.status === 'fulfilled' ? compRes.value?.data || compRes.value : undefined;

      const childAnalytics: ChildAnalytics = {
        id: selectedChildId,
        name: childName,
        stats: {
          average: stats?.average || stats?.avgScore,
          grade: stats?.grade || stats?.overallGrade,
          rank: stats?.rank,
          totalStudents: stats?.totalStudents,
          subjectsCount: stats?.subjectsCount,
          attendanceRate: stats?.attendanceRate,
        },
        trend: trend ? {
          direction: trend.direction || 'stable',
          change: trend.change || 0,
          periods: trend.periods || trend.trend || [],
        } : undefined,
        performanceCategory: stats?.performanceCategory,
        strengths: comp?.strengths || stats?.strengths || [],
        weaknesses: comp?.weaknesses || stats?.weaknesses || [],
        recommendations: recs?.recommendations || recs || [],
      };

      setAnalytics(childAnalytics);
    } catch (err) {
      console.error('Failed to load analytics', err);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const getDirectionIcon = (dir?: string) => {
    if (dir === 'up') return '📈';
    if (dir === 'down') return '📉';
    return '📊';
  };

  const getDirectionColor = (dir?: string) => {
    if (dir === 'up') return colors.success;
    if (dir === 'down') return colors.error;
    return colors.textLight;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Performance Analytics</Text>
      </View>

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childStrip}>
          {children.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.childChip, selectedChildId === c.id && styles.childChipActive]}
              onPress={() => setSelectedChildId(c.id)}
            >
              <Text style={[styles.childChipText, selectedChildId === c.id && styles.childChipTextActive]}>{c.name || 'Child'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : !analytics ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>Analytics not yet available</Text>
          </View>
        ) : (
          <>
            {/* Hero Stats */}
            <View style={styles.heroCard}>
              <Text style={styles.heroName}>{analytics.name}</Text>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: analytics.stats?.average != null ? (analytics.stats.average >= 75 ? colors.success : analytics.stats.average >= 50 ? colors.warning : colors.error) : colors.textLight }]}>
                    {analytics.stats?.average != null ? `${Math.round(analytics.stats.average)}%` : '—'}
                  </Text>
                  <Text style={styles.heroStatLabel}>Average</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{analytics.stats?.grade || '—'}</Text>
                  <Text style={styles.heroStatLabel}>Grade</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{analytics.stats?.rank ? `#${analytics.stats.rank}` : '—'}</Text>
                  <Text style={styles.heroStatLabel}>Rank</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{analytics.stats?.subjectsCount ?? '—'}</Text>
                  <Text style={styles.heroStatLabel}>Subjects</Text>
                </View>
              </View>
            </View>

            {/* Trend Card */}
            {analytics.trend && (
              <View style={styles.trendCard}>
                <View style={styles.trendHeader}>
                  <Text style={styles.trendIcon}>{getDirectionIcon(analytics.trend.direction)}</Text>
                  <View style={styles.trendInfo}>
                    <Text style={styles.trendTitle}>Performance Trend</Text>
                    <Text style={[styles.trendChange, { color: getDirectionColor(analytics.trend.direction) }]}>
                      {analytics.trend.direction === 'up' ? 'Improving' : analytics.trend.direction === 'down' ? 'Declining' : 'Stable'}
                      {analytics.trend.change ? ` (${analytics.trend.change > 0 ? '+' : ''}${Math.round(analytics.trend.change)}%)` : ''}
                    </Text>
                  </View>
                </View>
                {analytics.trend.periods.length > 0 && (
                  <View style={styles.trendBars}>
                    {analytics.trend.periods.map((p, i) => (
                      <View key={i} style={styles.trendBarItem}>
                        <View style={[styles.trendBar, { height: `${Math.min(p.average || 0, 100)}%`, backgroundColor: (p.average || 0) >= 75 ? colors.success : (p.average || 0) >= 50 ? colors.warning : colors.error }]} />
                        <Text style={styles.trendBarLabel}>{p.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Performance Category */}
            {analytics.performanceCategory && (
              <View style={[styles.categoryCard, { borderLeftColor: analytics.performanceCategory.color || colors.primary }]}>
                <Text style={styles.categoryTitle}>Performance Category</Text>
                <Text style={[styles.categoryValue, { color: analytics.performanceCategory.color || colors.primary }]}>
                  {analytics.performanceCategory.label}
                </Text>
              </View>
            )}

            {/* Strengths */}
            {analytics.strengths && analytics.strengths.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💪 Strengths</Text>
                {analytics.strengths.map((s, i) => (
                  <View key={i} style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Weaknesses */}
            {analytics.weaknesses && analytics.weaknesses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 Areas for Improvement</Text>
                {analytics.weaknesses.map((w, i) => (
                  <View key={i} style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{w}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recommendations */}
            {analytics.recommendations && analytics.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📌 Recommendations</Text>
                {Array.isArray(analytics.recommendations) ? analytics.recommendations.map((r, i) => (
                  <View key={i} style={styles.recCard}>
                    <Text style={styles.recIcon}>💡</Text>
                    <Text style={styles.recText}>{typeof r === 'string' ? r : r?.recommendation || r?.message || JSON.stringify(r)}</Text>
                  </View>
                )) : typeof analytics.recommendations === 'string' ? (
                  <View style={styles.recCard}>
                    <Text style={styles.recIcon}>💡</Text>
                    <Text style={styles.recText}>{analytics.recommendations}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  childStrip: { maxHeight: 44, marginHorizontal: spacing.md, marginTop: spacing.sm },
  childChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  childChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  childChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  childChipTextActive: { color: colors.white },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  loader: { marginTop: 40 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textLight },
  heroCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.md },
  heroName: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  heroStatsRow: { flexDirection: 'row', gap: spacing.sm },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  heroStatLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  trendCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.md },
  trendHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  trendIcon: { fontSize: 32, marginRight: spacing.md },
  trendInfo: { flex: 1 },
  trendTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  trendChange: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  trendBars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 80 },
  trendBarItem: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  trendBar: { width: 24, borderRadius: 6, marginBottom: 4 },
  trendBarLabel: { fontSize: 10, color: colors.textLight },
  categoryCard: { backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, borderLeftWidth: 4, marginBottom: spacing.md, ...shadows.sm },
  categoryTitle: { fontSize: 12, color: colors.textLight },
  categoryValue: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  bulletItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  bullet: { fontSize: 16, color: colors.primary, marginRight: spacing.sm, lineHeight: 20 },
  bulletText: { fontSize: 14, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  recCard: { flexDirection: 'row', backgroundColor: '#EFF6FF', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.xs },
  recIcon: { fontSize: 16, marginRight: spacing.sm },
  recText: { fontSize: 13, color: colors.text, flex: 1, lineHeight: 18 },
});
