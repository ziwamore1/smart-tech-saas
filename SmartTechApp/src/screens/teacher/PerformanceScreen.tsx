import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const TeacherPerformanceScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const { dashboard } = useAppStore();

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classAnalytics, setClassAnalytics] = useState<any>(null);
  const [subjectPerf, setSubjectPerf] = useState<any[]>([]);
  const [atRisk, setAtRisk] = useState<any[]>([]);
  const [gradeDist, setGradeDist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const termId = dashboard?.currentTerm?.id;

  useEffect(() => {
    loadTeacherData();
  }, []);

  useEffect(() => {
    if (selectedClassId && termId) loadClassAnalytics();
  }, [selectedClassId, termId]);

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      const classData = await apiService.getTeacherClasses();
      const classList = Array.isArray(classData) ? classData : classData?.data || [];
      setClasses(classList);
      if (classList.length > 0) setSelectedClassId(classList[0].classId || classList[0].id);
    } catch (err) {
      console.error('Failed to load teacher data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadClassAnalytics = async () => {
    if (!selectedClassId || !termId) return;
    setLoadingAnalytics(true);
    try {
      const [analyticsRes, subjectRes, atRiskRes, distRes] = await Promise.allSettled([
        apiService.getClassAnalytics(selectedClassId, termId),
        apiService.getSubjectPerformance(selectedClassId, termId),
        apiService.getAtRiskStudents(selectedClassId, termId),
        apiService.getGradeDistribution(selectedClassId, termId),
      ]);

      if (analyticsRes.status === 'fulfilled') setClassAnalytics(analyticsRes.value);
      if (subjectRes.status === 'fulfilled') {
        const data = subjectRes.value;
        setSubjectPerf(Array.isArray(data) ? data : data?.data || data?.subjects || []);
      }
      if (atRiskRes.status === 'fulfilled') {
        const data = atRiskRes.value;
        setAtRisk(Array.isArray(data) ? data : data?.data || data?.students || []);
      }
      if (distRes.status === 'fulfilled') setGradeDist(distRes.value);
    } catch (err) {
      console.error('Failed to load class analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadClassAnalytics();
    setRefreshing(false);
  }, [selectedClassId, termId]);

  const classAvg = classAnalytics?.averageScore ?? classAnalytics?.average ?? classAnalytics?.classAverage ?? 0;
  const passRate = classAnalytics?.passRate ?? classAnalytics?.passPercentage ?? 0;
  const totalStudents = classAnalytics?.totalStudents ?? classAnalytics?.studentCount ?? 0;
  const topPerformers = classAnalytics?.topPerformers ?? classAnalytics?.topStudents ?? [];

  const getGradeColor = (grade: string): string => {
    if (!grade) return colors.textLight;
    const g = grade.toUpperCase().trim();
    if (g.startsWith('A')) return colors.success;
    if (g.startsWith('B')) return '#2563EB';
    if (g.startsWith('C')) return colors.accent;
    if (g.startsWith('D')) return colors.orange;
    return colors.error;
  };

  const distKeys = gradeDist ? Object.keys(gradeDist).filter(k => k !== 'total' && k !== 'count').sort() : [];
  const maxDistCount = distKeys.length > 0 ? Math.max(...distKeys.map(k => Number(gradeDist[k]) || 0), 1) : 1;

  const selectedClass = classes.find(c => (c.classId || c.id) === selectedClassId);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="My Performance"
        subtitle="Teaching analytics & insights"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Class Selector */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorLabel}>MY CLASSES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {classes.map((cls) => {
              const classId = cls.classId || cls.id;
              return (
                <TouchableOpacity
                  key={classId}
                  style={[styles.chip, selectedClassId === classId && styles.chipActive]}
                  onPress={() => { setSelectedClassId(classId); setClassAnalytics(null); setSubjectPerf([]); setAtRisk([]); setGradeDist(null); }}
                >
                  <Text style={[styles.chipText, selectedClassId === classId && styles.chipTextActive]}>
                    {cls.className || cls.name || 'Class'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {classes.length === 0 && <Text style={styles.noDataText}>No classes assigned</Text>}
          </ScrollView>
        </View>

        {loadingAnalytics ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : !classAnalytics && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Select a Class</Text>
            <Text style={styles.emptyDesc}>Choose a class above to view performance analytics</Text>
          </View>
        ) : classAnalytics ? (
          <>
            {/* Summary Stats */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{totalStudents || 0}</Text>
                <Text style={styles.statLabel}>Students</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
                <Text style={[styles.statValue, { color: colors.success }]}>{classAvg ? `${Number(classAvg).toFixed(1)}%` : '—'}</Text>
                <Text style={styles.statLabel}>Class Average</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.purpleLight }]}>
                <Text style={[styles.statValue, { color: colors.purple }]}>{passRate ? `${Number(passRate).toFixed(1)}%` : '—'}</Text>
                <Text style={styles.statLabel}>Pass Rate</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.statValue, { color: colors.accent }]}>{atRisk.length}</Text>
                <Text style={styles.statLabel}>At Risk</Text>
              </View>
            </View>

            {/* Subject Performance */}
            {subjectPerf.length > 0 && (
              <WidgetCard title="Subject Performance">
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { flex: 2 }]}>Subject</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Avg</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>High</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Low</Text>
                </View>
                {subjectPerf.map((sub: any, idx: number) => (
                  <View key={sub.subjectId || sub.id || idx} style={[styles.tableRow, idx > 0 && styles.tableRowBorder]}>
                    <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{sub.subjectName || sub.name || 'Subject'}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '600' }]}>
                      {sub.average != null ? `${Number(sub.average).toFixed(1)}%` : '—'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', color: colors.success }]}>
                      {sub.highest != null ? `${Number(sub.highest).toFixed(1)}%` : '—'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', color: colors.error }]}>
                      {sub.lowest != null ? `${Number(sub.lowest).toFixed(1)}%` : '—'}
                    </Text>
                  </View>
                ))}

                {/* Subject Bar Chart */}
                <View style={styles.barChart}>
                  {subjectPerf.map((sub: any, idx: number) => {
                    const avg = sub.average ?? 0;
                    const barHeight = Math.max((avg / 100) * 100, 4);
                    return (
                      <View key={idx} style={styles.barColumn}>
                        <Text style={styles.barValue}>{avg ? `${Number(avg).toFixed(0)}` : '—'}</Text>
                        <View style={[styles.bar, { height: barHeight, backgroundColor: avg >= 70 ? colors.success : avg >= 50 ? colors.accent : colors.error }]} />
                        <Text style={styles.barLabel} numberOfLines={1}>{(sub.subjectName || sub.name || 'S').substring(0, 6)}</Text>
                      </View>
                    );
                  })}
                </View>
              </WidgetCard>
            )}

            {/* Grade Distribution */}
            {distKeys.length > 0 && (
              <WidgetCard title="Grade Distribution">
                <View style={styles.chartContainer}>
                  {distKeys.map((g) => {
                    const count = Number(gradeDist[g]) || 0;
                    const barHeight = Math.max((count / maxDistCount) * 120, 8);
                    return (
                      <View key={g} style={styles.chartBar}>
                        <Text style={styles.chartCount}>{count}</Text>
                        <View style={[styles.chartBarFill, { height: barHeight, backgroundColor: getGradeColor(g) }]} />
                        <Text style={styles.chartLabel}>{g}</Text>
                      </View>
                    );
                  })}
                </View>
              </WidgetCard>
            )}

            {/* At-Risk Students */}
            {atRisk.length > 0 && (
              <WidgetCard title={`At-Risk Students (${atRisk.length})`}>
                {atRisk.map((student: any, idx: number) => {
                  const name = student.name || student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown';
                  const avg = student.average ?? student.percentage ?? student.avg;
                  const grade = student.grade || student.computedGrade || '—';
                  return (
                    <View key={student.id || idx} style={[styles.atRiskRow, idx > 0 && styles.atRiskBorder]}>
                      <View style={styles.atRiskAvatar}>
                        <Text style={styles.atRiskInitial}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.atRiskInfo}>
                        <Text style={styles.atRiskName} numberOfLines={1}>{name}</Text>
                        <Text style={styles.atRiskDetail}>
                          Average: {avg != null ? `${Number(avg).toFixed(1)}%` : '—'}
                        </Text>
                      </View>
                      <View style={[styles.atRiskGrade, { backgroundColor: getGradeColor(grade) + '15' }]}>
                        <Text style={[styles.atRiskGradeText, { color: getGradeColor(grade) }]}>{grade}</Text>
                      </View>
                    </View>
                  );
                })}
              </WidgetCard>
            )}

            {/* Top Performers */}
            {topPerformers.length > 0 && (
              <WidgetCard title="Top Performers">
                {topPerformers.slice(0, 5).map((student: any, idx: number) => {
                  const name = student.name || student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown';
                  const avg = student.average ?? student.percentage ?? student.avg ?? student.totalPercentage;
                  return (
                    <View key={student.id || idx} style={[styles.topRow, idx > 0 && styles.atRiskBorder]}>
                      <View style={[styles.rankBadge, idx === 0 && styles.rankGold, idx === 1 && styles.rankSilver, idx === 2 && styles.rankBronze]}>
                        <Text style={styles.rankText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.topName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.topScore}>{avg ? `${Number(avg).toFixed(1)}%` : '—'}</Text>
                    </View>
                  );
                })}
              </WidgetCard>
            )}
          </>
        ) : null}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },

  selectorContainer: { marginBottom: spacing.md },
  selectorLabel: { fontSize: 11, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase', marginBottom: spacing.xs, letterSpacing: 0.3 },
  chipScroll: { flexDirection: 'row' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.text },
  chipTextActive: { color: colors.white },
  noDataText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },

  loadingContainer: { alignItems: 'center', paddingVertical: spacing.xxl },
  loadingText: { fontSize: 14, color: colors.textLight, marginTop: spacing.md },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyDesc: { fontSize: 13, color: colors.textLight, textAlign: 'center' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { width: '48%', flexGrow: 1, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 4, fontWeight: '600' },

  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.border, paddingBottom: spacing.sm, marginBottom: spacing.sm },
  tableHeaderText: { fontSize: 11, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  tableCell: { fontSize: 13, color: colors.text },

  barChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140, marginTop: spacing.md, paddingTop: spacing.sm },
  barColumn: { alignItems: 'center', flex: 1 },
  bar: { width: 24, borderRadius: borderRadius.sm, minHeight: 4 },
  barValue: { fontSize: 10, fontWeight: '700', color: colors.text, marginBottom: 4 },
  barLabel: { fontSize: 10, color: colors.textLight, marginTop: 4, textAlign: 'center' },

  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 180, paddingTop: spacing.md },
  chartBar: { alignItems: 'center', flex: 1 },
  chartBarFill: { width: 28, borderRadius: borderRadius.sm, minHeight: 8 },
  chartCount: { fontSize: 11, fontWeight: '700', color: colors.text, marginBottom: 4 },
  chartLabel: { fontSize: 12, fontWeight: '600', color: colors.textLight, marginTop: 6 },

  atRiskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  atRiskBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  atRiskAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  atRiskInitial: { fontSize: 14, fontWeight: '700', color: colors.error },
  atRiskInfo: { flex: 1 },
  atRiskName: { fontSize: 14, fontWeight: '600', color: colors.text },
  atRiskDetail: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  atRiskGrade: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  atRiskGradeText: { fontSize: 13, fontWeight: '700' },

  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  rankGold: { backgroundColor: '#FCD34D' },
  rankSilver: { backgroundColor: '#D1D5DB' },
  rankBronze: { backgroundColor: '#FDBA74' },
  rankText: { fontSize: 12, fontWeight: '700', color: colors.text },
  topName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  topScore: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
