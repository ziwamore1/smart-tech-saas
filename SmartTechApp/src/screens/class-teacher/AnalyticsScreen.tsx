import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { VictoryBar, VictoryChart, VictoryTheme, VictoryAxis, VictoryPie, VictoryLabel } from 'victory-native';

export const ClassTeacherAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const subjectPerformance = [
    { name: 'Mathematics', avg: 72, trend: 'up', color: colors.success },
    { name: 'English', avg: 78, trend: 'up', color: colors.success },
    { name: 'Science', avg: 81, trend: 'up', color: colors.success },
    { name: 'Social Studies', avg: 65, trend: 'down', color: colors.error },
    { name: 'Kiswahili', avg: 70, trend: 'stable', color: colors.warning },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Class Analytics" subtitle="Performance & Insights" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.summaryRow}>
          <GradientCard
            title="74.2%"
            subtitle="Class Average"
            icon="📊"
            gradient={['#EFF6FF', '#DBEAFE']}
            style={styles.summaryCard}
          />
          <GradientCard
            title="94%"
            subtitle="Attendance Rate"
            icon="✅"
            gradient={['#CCFBF1', '#F0FDFA']}
            style={styles.summaryCard}
          />
        </View>

        <WidgetCard title="Subject Performance">
          <VictoryChart theme={VictoryTheme.material} height={200} padding={{ top: 20, bottom: 60, left: 50, right: 20 }}>
            <VictoryAxis style={{ axis: { stroke: colors.border }, tickLabels: { fill: colors.textLight, fontSize: 10 } }} tickFormat={(t) => t.length > 8 ? t.substring(0, 7) + '…' : t} />
            <VictoryAxis dependentAxis domain={[0, 100]} style={{ axis: { stroke: colors.border }, tickLabels: { fill: colors.textLight, fontSize: 10 } }} />
            <VictoryBar
              data={subjectPerformance.map((subj) => ({
                x: subj.name,
                y: subj.avg,
                fill: subj.color,
              }))}
              cornerRadius={{ top: 4 }}
              barWidth={24}
              animate={{ duration: 500 }}
            />
          </VictoryChart>
        </WidgetCard>

        <WidgetCard title="Risk Indicators" action={{ label: 'View All', onPress: () => {} }}>
          <View style={styles.riskGrid}>
            {[
              { label: 'At Risk Students', value: '3', color: colors.error, bgColor: colors.errorLight },
              { label: 'Low Attendance', value: '5', color: colors.warning, bgColor: colors.warningLight },
              { label: 'Declining Trend', value: '2', color: colors.orange, bgColor: colors.orangeLight },
              { label: 'Interventions', value: '4', color: colors.primaryLight, bgColor: colors.infoLight },
            ].map((risk) => (
              <View key={risk.label} style={[styles.riskCard, { backgroundColor: risk.bgColor }]}>
                <Text style={[styles.riskValue, { color: risk.color }]}>{risk.value}</Text>
                <Text style={styles.riskLabel}>{risk.label}</Text>
              </View>
            ))}
          </View>
        </WidgetCard>

        <WidgetCard title="Competency Summary">
          {[
            { skill: 'Critical Thinking', score: 78 },
            { skill: 'Problem Solving', score: 72 },
            { skill: 'Communication', score: 85 },
            { skill: 'Collaboration', score: 80 },
            { skill: 'Creativity', score: 68 },
          ].map((comp) => (
            <View key={comp.skill} style={styles.competencyRow}>
              <Text style={styles.competencyLabel}>{comp.skill}</Text>
              <View style={styles.competencyBar}>
                <View style={[styles.competencyFill, { width: `${comp.score}%`, backgroundColor: comp.score >= 80 ? colors.success : comp.score >= 70 ? colors.primaryLight : colors.warning }]} />
              </View>
              <Text style={styles.competencyScore}>{comp.score}%</Text>
            </View>
          ))}
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
  subjectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  subjectInfo: { width: 110 },
  subjectName: { fontSize: 14, fontWeight: '600', color: colors.text },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  trendArrow: { fontSize: 12, fontWeight: '700', marginRight: 2 },
  trendLabel: { fontSize: 11, fontWeight: '600' },
  progressBg: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, marginHorizontal: spacing.sm },
  progressFill: { height: 8, borderRadius: 4 },
  subjectAvg: { fontSize: 14, fontWeight: '700', color: colors.text, width: 36, textAlign: 'right' },
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
