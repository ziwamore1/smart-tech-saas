import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: any;
}

export const ClassTeacherAnalyticsScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { dashboard, fetchDashboard } = useAppStore();
  const [classData, setClassData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const termId = dashboard?.currentTerm?.id;
      const res = await apiService.getTeacherClasses();
      const classes = Array.isArray(res) ? res : res?.data || [];
      setClassData(classes);

      if (classes.length > 0 && termId) {
        const firstClass = classes[0];
        const classId = firstClass.id || firstClass.classId;

        if (classId) {
          try {
            const analyticsRes = await apiService.getClassAnalytics(classId, termId);
            setAnalytics(analyticsRes?.data || analyticsRes);
          } catch { /* analytics not available */ }

          try {
            const atRiskRes = await apiService.getAtRiskStudents(classId, termId);
            setAtRiskStudents(Array.isArray(atRiskRes) ? atRiskRes : atRiskRes?.data || []);
          } catch { /* at-risk not available */ }
        }
      }
    } catch {
      setClassData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const classAverage = analytics?.classAverage ?? analytics?.averagePercentage ?? 0;
  const totalStudents = analytics?.totalStudents ?? 0;
  const subjectStats = analytics?.subjectStats || [];
  const gradeDistribution = analytics?.gradeDistribution || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Class Analytics" subtitle="Performance & Insights" leftIcon={{ name: '☰', onPress: onToggleDrawer }} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.summaryRow}>
          <GradientCard
            title={classAverage ? `${classAverage}%` : '—'}
            subtitle="Class Average"
            icon="📊"
            gradient={['#EFF6FF', '#DBEAFE']}
            style={styles.summaryCard}
          />
          <GradientCard
            title={totalStudents ? String(totalStudents) : '—'}
            subtitle="Total Students"
            icon="👥"
            gradient={['#CCFBF1', '#F0FDFA']}
            style={styles.summaryCard}
          />
        </View>

        {subjectStats.length > 0 ? (
          <WidgetCard title="Subject Performance">
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, paddingVertical: spacing.sm }}>
              {subjectStats.map((sub: any, i: number) => (
                <View key={sub.subjectId || i} style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 2 }}>{sub.average ?? 0}%</Text>
                  <View style={{ width: 24, height: Math.max((sub.average || 50) * 1.2, 8), backgroundColor: colors.primaryLight, borderRadius: 4 }} />
                  <Text style={{ fontSize: 9, color: colors.textLight, marginTop: 4, textAlign: 'center' }}>
                    {(sub.subjectName || 'Sub')?.length > 8 ? sub.subjectName.substring(0, 7) + '…' : sub.subjectName || 'Sub'}
                  </Text>
                </View>
              ))}
            </View>
          </WidgetCard>
        ) : (
          <WidgetCard title="Subject Performance">
            <Text style={{ textAlign: 'center', color: colors.textLight, paddingVertical: 20 }}>
              Performance data will appear once results are published.
            </Text>
          </WidgetCard>
        )}

        {Object.keys(gradeDistribution).length > 0 && (
          <WidgetCard title="Grade Distribution">
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140, paddingVertical: spacing.sm }}>
              {Object.entries(gradeDistribution).sort().map(([grade, count]) => (
                <View key={grade} style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text }}>{String(count)}</Text>
                  <View style={{ width: 24, height: Math.max(Number(count) * 8, 8), backgroundColor: grade === 'A' ? colors.success : grade === 'B' ? '#2563EB' : grade === 'C' ? colors.accent : grade === 'D' ? colors.orange : colors.error, borderRadius: 4 }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textLight, marginTop: 4 }}>{grade}</Text>
                </View>
              ))}
            </View>
          </WidgetCard>
        )}

        <WidgetCard title="Risk Indicators">
          <View style={styles.riskGrid}>
            {[
              { label: 'At Risk Students', value: atRiskStudents.length || '—', color: colors.error, bgColor: colors.errorLight },
              { label: 'Total Classes', value: classData.length || '—', color: colors.primaryLight, bgColor: colors.infoLight },
              { label: 'Total Students', value: totalStudents || '—', color: colors.success, bgColor: colors.successLight },
              { label: 'Pass Rate', value: analytics?.passRate ? `${analytics.passRate}%` : '—', color: colors.warning, bgColor: colors.warningLight },
            ].map((risk) => (
              <View key={risk.label} style={[styles.riskCard, { backgroundColor: risk.bgColor }]}>
                <Text style={[styles.riskValue, { color: risk.color }]}>{String(risk.value)}</Text>
                <Text style={styles.riskLabel}>{risk.label}</Text>
              </View>
            ))}
          </View>
        </WidgetCard>

        {subjectStats.length > 0 && (
          <WidgetCard title="Subject Details">
            {subjectStats.map((sub: any, idx: number) => (
              <View key={sub.subjectId || idx} style={[styles.subjectRow, idx > 0 && styles.subjectRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectName}>{sub.subjectName || 'Unknown'}</Text>
                  <Text style={styles.subjectMeta}>
                    Avg: {sub.average ?? 0}% | Pass: {sub.passRate ?? 0}%
                  </Text>
                </View>
                <View style={styles.subjectStats}>
                  <Text style={[styles.subjectStat, { color: colors.success }]}>H: {sub.max ?? '—'}</Text>
                  <Text style={[styles.subjectStat, { color: colors.error }]}>L: {sub.min ?? '—'}</Text>
                </View>
              </View>
            ))}
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
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1 },
  riskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  riskCard: { width: '47%', padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  riskValue: { fontSize: 28, fontWeight: '700' },
  riskLabel: { fontSize: 11, fontWeight: '500', color: colors.textLight, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  subjectRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  subjectName: { fontSize: 14, fontWeight: '600', color: colors.text },
  subjectMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  subjectStats: { flexDirection: 'row', gap: spacing.md },
  subjectStat: { fontSize: 12, fontWeight: '600' },
});
