import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Loading } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';

export const StudentResultsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboard } = useAppStore();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      const termId = dashboard?.currentTerm?.id;
      if (user?.id && termId) {
        const res = await apiService.getStudentResults(user.id, termId);
        const data = res?.data || res;
        setResults(Array.isArray(data) ? data : data?.results || data?.subjects || []);
      }
    } catch (err) {
      console.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading fullScreen message="Loading results..." />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Results</Text>
        <Text style={styles.headerSub}>{dashboard?.currentTerm?.name || 'Current Term'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {results.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={{ textAlign: 'center', color: colors.textLight, fontSize: 16 }}>No results available yet</Text>
          </Card>
        ) : (
          results.map((r: any, i: number) => (
            <Card key={r.id || i} variant="outlined" style={styles.resultCard}>
              <View style={styles.resultRow}>
                <View style={styles.resultInfo}>
                  <Text style={styles.subjectName}>{r.subject?.name || r.subject || 'Subject'}</Text>
                  <Text style={styles.resultMeta}>{r.grade ? `Grade: ${r.grade}` : ''} {r.remark ? `- ${r.remark}` : ''}</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: (r.score || 0) >= 75 ? '#d1fae5' : (r.score || 0) >= 50 ? '#fef3c7' : '#fee2e2' }]}>
                  <Text style={[styles.scoreText, { color: (r.score || 0) >= 75 ? '#059669' : (r.score || 0) >= 50 ? '#d97706' : '#dc2626' }]}>
                    {r.score || 0}%
                  </Text>
                </View>
              </View>
            </Card>
          ))
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
  scrollContent: { padding: spacing.md, gap: spacing.sm },
  emptyCard: { padding: spacing.xl },
  resultCard: { padding: spacing.md },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultInfo: { flex: 1 },
  subjectName: { fontSize: 16, fontWeight: '600', color: colors.text },
  resultMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  scoreBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  scoreText: { fontSize: 18, fontWeight: '700' },
});
