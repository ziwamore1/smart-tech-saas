import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';

interface AssessmentResult {
  id: string;
  subjectName?: string;
  subject?: { name: string };
  assessmentName?: string;
  rawScore?: number;
  maxScore?: number;
  percentage?: number;
  grade?: string;
  remark?: string;
  type?: string;
}

export const ParentAssessmentsScreen: React.FC = () => {
  const { dashboard } = useAppStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [results, setResults] = useState<AssessmentResult[]>([]);
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
    if (selectedChildId) loadAssessments();
  }, [selectedChildId]);

  const loadAssessments = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const termId = dashboard?.currentTerm?.id;
      const res = await apiService.getParentAssessmentResults(selectedChildId, termId);
      const data = Array.isArray(res) ? res : res?.data || res?.results || res?.assessments || [];
      setResults(data);
    } catch (err) {
      console.error('Failed to load assessments');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAssessments();
    setRefreshing(false);
  };

  const getScoreColor = (pct?: number) => {
    if (pct == null) return colors.textMuted;
    if (pct >= 75) return colors.success;
    if (pct >= 50) return colors.warning;
    return colors.error;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assessments</Text>
      </View>

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childStrip}>
          {children.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.childChip, selectedChildId === c.id && styles.childChipActive]}
              onPress={() => setSelectedChildId(c.id)}
            >
              <Text style={[styles.childChipText, selectedChildId === c.id && styles.childChipTextActive]}>
                {c.name || 'Child'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No assessments available</Text>
          </View>
        ) : (
          results.map((r, i) => {
            const subjectName = r.subjectName || r.subject?.name || 'Subject';
            const score = r.percentage ?? (r.rawScore != null && r.maxScore ? (r.rawScore / r.maxScore) * 100 : undefined);
            return (
              <View key={r.id || i} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.subject}>{subjectName}</Text>
                    {r.assessmentName ? <Text style={styles.assessmentName}>{r.assessmentName}</Text> : null}
                    {r.type ? <Text style={styles.type}>{r.type}</Text> : null}
                    <Text style={styles.meta}>
                      {r.rawScore != null && r.maxScore ? `${r.rawScore}/${r.maxScore}` : ''}
                      {r.grade ? `  Grade: ${r.grade}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(score) + '20' }]}>
                    <Text style={[styles.scoreText, { color: getScoreColor(score) }]}>
                      {score != null ? `${Math.round(score)}%` : '—'}
                    </Text>
                  </View>
                </View>
                {r.remark ? <Text style={styles.remark}>{r.remark}</Text> : null}
              </View>
            );
          })
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
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1 },
  subject: { fontSize: 15, fontWeight: '600', color: colors.text },
  assessmentName: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  type: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  meta: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  scoreBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  scoreText: { fontSize: 16, fontWeight: '700' },
  remark: { fontSize: 12, color: colors.textLight, marginTop: spacing.sm, fontStyle: 'italic' },
});
