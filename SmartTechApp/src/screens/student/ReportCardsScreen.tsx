import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';
import { colors, spacing } from '../../theme';
import { HeaderBar } from '../../components';

export const StudentReportCardsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sid = user?.studentId || user?.id;
    if (sid) {
      apiService.getStudentAssessmentResults(sid)
        .then(r => {
          const data = r?.data || r || [];
          setResults(Array.isArray(data) ? data : []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user?.studentId, user?.id]);

  const avg = results.length > 0 ? (results.reduce((s: number, r: any) => s + (r.score || r.finalPercentage || 0), 0) / results.length).toFixed(1) : '0.0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Report Cards" subtitle="Your academic performance" />
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📄</Text>
          <Text style={styles.emptyText}>No report card data yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Overall Average</Text>
            <Text style={styles.summaryValue}>{avg}%</Text>
          </View>
          {results.map((r: any) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.subjectName}>{r.subject?.name || 'Subject'}</Text>
                <Text style={[styles.score, { color: (r.score || r.finalPercentage || 0) >= 50 ? colors.success : colors.error }]}>
                  {r.score || r.finalPercentage || 0}%
                </Text>
              </View>
              <Text style={styles.grade}>Grade: {r.grade || r.finalGrade || 'N/A'}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md },
  summaryCard: { backgroundColor: colors.primary, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md, alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: colors.white, opacity: 0.9 },
  summaryValue: { fontSize: 36, fontWeight: '800', color: colors.white, marginTop: spacing.xs },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { fontSize: 15, fontWeight: '500', color: colors.text },
  score: { fontSize: 18, fontWeight: '700' },
  grade: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyText: { fontSize: 16, color: colors.textMuted },
});
