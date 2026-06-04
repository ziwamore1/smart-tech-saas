import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';

export const ClassTeacherAnalyticsScreen: React.FC = () => {
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    const fetchClassData = async () => {
      try {
        const res = await apiService.getTeacherClasses();
        const data = Array.isArray(res) ? res : res?.data || [];
        setClassStudents(data);
      } catch {
        setClassStudents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchClassData();
  }, []);

  const stats = dashboard?.stats;
  const averageScore = stats?.averageScore;
  const attendanceRate = stats?.attendanceRate;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Class Analytics" subtitle="Performance & Insights" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.summaryRow}>
          <GradientCard
            title={averageScore ? `${averageScore}%` : '—'}
            subtitle="Class Average"
            icon="📊"
            gradient={['#EFF6FF', '#DBEAFE']}
            style={styles.summaryCard}
          />
          <GradientCard
            title={attendanceRate ? `${attendanceRate}%` : '—'}
            subtitle="Attendance Rate"
            icon="✅"
            gradient={['#CCFBF1', '#F0FDFA']}
            style={styles.summaryCard}
          />
        </View>

        {averageScore != null ? (
          <WidgetCard title="Subject Performance">
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, paddingVertical: spacing.sm }}>
              {stats?.classes?.length ? (
                stats.classes.map((cls: any, i: number) => (
                  <View key={cls.id || i} style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 2 }}>{stats.averageScore}%</Text>
                    <View style={{ width: 24, height: (stats.averageScore || 50) * 1.2, backgroundColor: colors.primaryLight, borderRadius: 4 }} />
                    <Text style={{ fontSize: 9, color: colors.textLight, marginTop: 4, textAlign: 'center' }}>{cls.name?.length > 8 ? cls.name.substring(0, 7) + '…' : cls.name}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.textLight, paddingVertical: 20 }}>No subject data</Text>
              )}
            </View>
          </WidgetCard>
        ) : (
          <WidgetCard title="Subject Performance">
            <Text style={{ textAlign: 'center', color: colors.textLight, paddingVertical: 20 }}>
              Performance data will appear once assessments are recorded.
            </Text>
          </WidgetCard>
        )}

        <WidgetCard title="Risk Indicators" action={{ label: 'View All', onPress: () => {} }}>
          <View style={styles.riskGrid}>
            {[
              { label: 'At Risk Students', value: stats?.weakStudents ?? '—', color: colors.error, bgColor: colors.errorLight },
              { label: 'Low Attendance', value: attendanceRate != null && attendanceRate < 80 ? '⚠' : '—', color: colors.warning, bgColor: colors.warningLight },
              { label: 'Top Performers', value: stats?.topPerformers ?? '—', color: colors.success, bgColor: colors.successLight },
              { label: 'Pending Tasks', value: stats?.pendingTasks ?? '—', color: colors.primaryLight, bgColor: colors.infoLight },
            ].map((risk) => (
              <View key={risk.label} style={[styles.riskCard, { backgroundColor: risk.bgColor }]}>
                <Text style={[styles.riskValue, { color: risk.color }]}>{String(risk.value)}</Text>
                <Text style={styles.riskLabel}>{risk.label}</Text>
              </View>
            ))}
          </View>
        </WidgetCard>

        <WidgetCard title="Competency Summary">
          {averageScore != null ? (
            [
              { skill: 'Overall Score', score: averageScore },
            ].map((comp) => (
              <View key={comp.skill} style={styles.competencyRow}>
                <Text style={styles.competencyLabel}>{comp.skill}</Text>
                <View style={styles.competencyBar}>
                  <View style={[styles.competencyFill, { width: `${Math.min(comp.score, 100)}%`, backgroundColor: comp.score >= 80 ? colors.success : comp.score >= 70 ? colors.primaryLight : colors.warning }]} />
                </View>
                <Text style={styles.competencyScore}>{comp.score}%</Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center', color: colors.textLight, paddingVertical: 16 }}>
              Competency data not yet available.
            </Text>
          )}
        </WidgetCard>

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
  competencyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  competencyLabel: { width: 110, fontSize: 13, fontWeight: '500', color: colors.text },
  competencyBar: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, marginHorizontal: spacing.sm },
  competencyFill: { height: 6, borderRadius: 3 },
  competencyScore: { fontSize: 13, fontWeight: '600', color: colors.text, width: 36, textAlign: 'right' },
});
