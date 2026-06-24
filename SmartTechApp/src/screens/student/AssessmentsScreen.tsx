import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';
import { colors, spacing } from '../../theme';
import { HeaderBar } from '../../components';

export const StudentAssessmentsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sid = user?.studentId || user?.id;
    if (sid) {
      apiService.getStudentAssessmentResults(sid)
        .then(r => {
          const data = r?.data || r || [];
          setAssessments(Array.isArray(data) ? data : []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user?.studentId, user?.id]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Assessments" subtitle="Continuous assessment scores" />
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : assessments.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No assessment data yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {assessments.map((a: any) => (
            <View key={a.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.subjectName}>{a.subject?.name || 'Subject'}</Text>
                <View style={[styles.badge, { backgroundColor: (a.score || 0) >= 50 ? colors.successLight : colors.error + '20' }]}>
                  <Text style={[styles.badgeText, { color: (a.score || 0) >= 50 ? colors.success : colors.error }]}>
                    {a.score || 0}%
                  </Text>
                </View>
              </View>
              {a.assessmentDef?.name && <Text style={styles.assessmentName}>{a.assessmentDef.name}</Text>}
              <Text style={styles.meta}>{a.term?.name || ''}</Text>
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
  card: { backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { fontSize: 15, fontWeight: '500', color: colors.text, flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  assessmentName: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyText: { fontSize: 16, color: colors.textMuted },
});
