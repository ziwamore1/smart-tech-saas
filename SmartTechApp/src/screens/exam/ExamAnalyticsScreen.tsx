import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Loading } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useExamStore } from '../../store/exam-store';
import { VictoryBar, VictoryChart, VictoryTheme, VictoryAxis, VictoryTooltip, VictoryPie } from 'victory-native';

export const ExamAnalyticsScreen: React.FC = () => {
  const { examStats, loading, fetchExamStats, exams, fetchExams } = useExamStore();

  useEffect(() => {
    fetchExams();
  }, []);

  const loadStats = async (examId: string) => {
    await fetchExamStats(examId);
  };

  if (loading && !examStats && exams.length === 0) {
    return <Loading fullScreen message="Loading analytics..." />;
  }

  const publishedExams = exams.filter((e) => e.isPublished);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Exam Analytics</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!examStats && (
          <Card style={styles.selectCard}>
            <Text style={styles.sectionTitle}>Select an exam to view analytics</Text>
            {publishedExams.length === 0 ? (
              <Text style={styles.emptyText}>No published exams with data yet.</Text>
            ) : (
              publishedExams.slice(0, 10).map((exam) => (
                <View key={exam.id} style={styles.examSelectRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.examSelectTitle}>{exam.title}</Text>
                    <Text style={styles.examSelectMeta}>
                      {exam._count?.attempts || 0} attempts · {exam.totalScore} marks
                    </Text>
                  </View>
                  <Text
                    style={styles.viewBtn}
                    onPress={() => loadStats(exam.id)}
                  >
                    View Stats
                  </Text>
                </View>
              ))
            )}
          </Card>
        )}

        {examStats && (
          <>
            <Card style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{examStats.totalAttempts}</Text>
                  <Text style={styles.summaryLabel}>Attempts</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{examStats.averageScore?.toFixed(1)}</Text>
                  <Text style={styles.summaryLabel}>Avg Score</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{examStats.highestScore}</Text>
                  <Text style={styles.summaryLabel}>Highest</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{examStats.lowestScore}</Text>
                  <Text style={styles.summaryLabel}>Lowest</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{examStats.medianScore}</Text>
                  <Text style={styles.summaryLabel}>Median</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{examStats.passRate?.toFixed(1)}%</Text>
                  <Text style={styles.summaryLabel}>Pass Rate</Text>
                </View>
              </View>
            </Card>

            {examStats.gradeDistribution && examStats.gradeDistribution.length > 0 && (
              <Card style={styles.distributionCard}>
                <Text style={styles.sectionTitle}>Grade Distribution</Text>
                <VictoryChart theme={VictoryTheme.material} height={220} padding={{ top: 20, bottom: 40, left: 40, right: 20 }}>
                  <VictoryAxis style={{ axis: { stroke: colors.border }, tickLabels: { fill: colors.textLight, fontSize: 12 } }} />
                  <VictoryAxis dependentAxis style={{ axis: { stroke: colors.border }, tickLabels: { fill: colors.textLight, fontSize: 12 } }} />
                  <VictoryBar
                    data={examStats.gradeDistribution.map((g: any, i: number) => ({
                      x: g.grade,
                      y: g.count,
                      label: `${g.grade}: ${g.count}`,
                      fill:
                        g.grade === 'A' ? '#10b981' :
                        g.grade === 'B' ? '#3b82f6' :
                        g.grade === 'C' ? '#f59e0b' :
                        g.grade === 'D' ? '#f97316' : '#ef4444',
                    }))}
                    cornerRadius={{ top: 4 }}
                    barWidth={32}
                    labels={({ datum }) => datum.label}
                    labelComponent={<VictoryTooltip cornerRadius={4} />}
                    animate={{ duration: 500 }}
                  />
                </VictoryChart>
              </Card>
            )}

            {examStats.itemAnalysis && examStats.itemAnalysis.length > 0 && (
              <Card style={styles.analysisCard}>
                <Text style={styles.sectionTitle}>Item Analysis</Text>
                {examStats.itemAnalysis.map((item: any, i: number) => (
                  <View key={i} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemLabel}>Q{i + 1}</Text>
                      <View style={styles.itemStats}>
                        <View style={[styles.itemChip, { backgroundColor: item.difficulty > 0.7 ? '#d1fae5' : item.difficulty > 0.3 ? '#fef3c7' : '#fee2e2' }]}>
                          <Text style={[styles.itemChipText, { color: item.difficulty > 0.7 ? '#065f46' : item.difficulty > 0.3 ? '#92400e' : '#991b1b' }]}>
                            D: {item.difficulty?.toFixed(2)}
                          </Text>
                        </View>
                        <View style={[styles.itemChip, { backgroundColor: item.discrimination > 0.3 ? '#d1fae5' : item.discrimination > 0.1 ? '#fef3c7' : '#fee2e2' }]}>
                          <Text style={[styles.itemChipText, { color: item.discrimination > 0.3 ? '#065f46' : item.discrimination > 0.1 ? '#92400e' : '#991b1b' }]}>
                            Disc: {item.discrimination?.toFixed(2)}
                          </Text>
                        </View>
                        {item.flag && item.flag !== 'NORMAL' && (
                          <View style={[styles.itemChip, { backgroundColor: '#fef3c7' }]}>
                            <Text style={[styles.itemChipText, { color: '#92400e' }]}>{item.flag}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            <Text
              style={styles.backLink}
              onPress={() => useExamStore.setState({ examStats: null })}
            >
              ← Back to exam list
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  selectCard: { marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center', padding: spacing.lg },
  examSelectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  examSelectTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  examSelectMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  viewBtn: { color: colors.secondary, fontWeight: '600', fontSize: 14 },
  summaryCard: { marginBottom: spacing.md },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summaryItem: { width: '30%', alignItems: 'center', paddingVertical: spacing.sm },
  summaryValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  summaryLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  distributionCard: { marginBottom: spacing.md },
  gradeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  gradeLabel: { width: 30, fontSize: 14, fontWeight: '600', color: colors.text },
  gradeBarBg: { flex: 1, height: 20, backgroundColor: colors.border, borderRadius: 10 },
  gradeBarFill: { height: 20, borderRadius: 10 },
  gradeCount: { width: 30, fontSize: 12, color: colors.textLight, textAlign: 'right' },
  analysisCard: { marginBottom: spacing.md },
  itemRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  itemStats: { flexDirection: 'row', gap: spacing.xs },
  itemChip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6 },
  itemChipText: { fontSize: 11, fontWeight: '600' },
  backLink: { color: colors.secondary, fontWeight: '600', fontSize: 14, textAlign: 'center', padding: spacing.md },
});
