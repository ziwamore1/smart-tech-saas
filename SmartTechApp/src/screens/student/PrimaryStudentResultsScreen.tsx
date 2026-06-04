import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';

interface SubjectResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  score?: number;
  finalPercentage?: number;
  finalGrade?: string;
  finalRemark?: string;
  points?: number;
  performanceCategory?: { label: string; color: string };
  assessments?: { name: string; rawScore: number | null; maxScore: number; percentage: number | null }[];
}

export const PrimaryStudentResultsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboard } = useAppStore();
  const [subjects, setSubjects] = useState<SubjectResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<SubjectResult | null>(null);
  const [attendance, setAttendance] = useState({ rate: 0, present: 0, total: 0 });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const termId = dashboard?.currentTerm?.id;
      if (!user?.id || !termId) { setLoading(false); return; }

      const [resRaw, attRaw] = await Promise.allSettled([
        apiService.getStudentResults(user.id, termId),
        apiService.getStudentAttendance(user.id),
      ]);

      if (resRaw.status === 'fulfilled') {
        const r = resRaw.value?.data || resRaw.value;
        const data: SubjectResult[] = Array.isArray(r) ? r : r?.results || r?.subjects || [];
        setSubjects(data);
        if (data.length > 0) setSelectedSubject(data[0]);
      }

      if (attRaw.status === 'fulfilled') {
        const a = attRaw.value?.data || attRaw.value;
        const attData = Array.isArray(a) ? a : a?.records || [];
        const total = attData.length;
        const present = attData.filter((x: any) =>
          x.status === 'PRESENT' || x.status === 'LATE'
        ).length;
        setAttendance({ rate: total > 0 ? (present / total) * 100 : 0, present, total });
      }
    } catch (e) {
      console.error('Failed to load results', e);
    } finally { setLoading(false); }
  };

  const getScoreColor = (pct?: number | null) => {
    if (pct == null) return '#9CA3AF';
    if (pct >= 80) return '#10B981';
    if (pct >= 60) return '#3B82F6';
    if (pct >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreBg = (pct?: number | null) => {
    if (pct == null) return '#F3F4F6';
    if (pct >= 80) return '#ECFDF5';
    if (pct >= 60) return '#EFF6FF';
    if (pct >= 40) return '#FEFCE8';
    return '#FEF2F2';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const average = subjects.length > 0
    ? subjects.reduce((sum, s) => sum + (s.finalPercentage ?? s.score ?? 0), 0) / subjects.length
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hey {user?.firstName}! 👋</Text>
        <Text style={styles.headerSub}>{dashboard?.currentTerm?.name || 'This Term'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Stats */}
        <View style={styles.heroRow}>
          <View style={[styles.heroCard, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.heroValue, { color: '#059669' }]}>{subjects.length}</Text>
            <Text style={styles.heroLabel}>Subjects</Text>
          </View>
          <View style={[styles.heroCard, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.heroValue, { color: '#2563EB' }]}>{average.toFixed(1)}%</Text>
            <Text style={styles.heroLabel}>Average</Text>
          </View>
          <View style={[styles.heroCard, { backgroundColor: '#FEFCE8' }]}>
            <Text style={[styles.heroValue, { color: '#CA8A04' }]}>{attendance.rate.toFixed(0)}%</Text>
            <Text style={styles.heroLabel}>Attendance</Text>
          </View>
        </View>

        {/* Attendance bar */}
        <View style={styles.attSection}>
          <View style={styles.attBarBg}>
            <View style={[styles.attBarFill, {
              width: `${Math.min(attendance.rate, 100)}%`,
              backgroundColor: attendance.rate >= 80 ? '#10B981' :
                attendance.rate >= 60 ? '#3B82F6' : '#F59E0B',
            }]} />
          </View>
          <Text style={styles.attText}>{attendance.present}/{attendance.total} days present</Text>
        </View>

        {/* Subject Grid */}
        <Text style={styles.sectionTitle}>My Subjects</Text>
        <View style={styles.subjectGrid}>
          {subjects.map((s, i) => {
            const pct = s.finalPercentage ?? s.score;
            return (
              <TouchableOpacity
                key={s.subjectId || i}
                style={[styles.subjectCard, { borderLeftColor: getScoreColor(pct), borderLeftWidth: 4 }]}
                onPress={() => setSelectedSubject(selectedSubject?.subjectId === s.subjectId ? null : s)}
              >
                <View style={styles.subjectTop}>
                  <Text style={styles.subjectCode}>{s.subjectCode || s.subjectName?.slice(0, 3).toUpperCase()}</Text>
                  <View style={[styles.scorePill, { backgroundColor: getScoreBg(pct) }]}>
                    <Text style={[styles.scorePillText, { color: getScoreColor(pct) }]}>
                      {pct != null ? `${pct}%` : '—'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.subjectName} numberOfLines={1}>{s.subjectName}</Text>
                {s.finalGrade && <Text style={styles.subjectGrade}>Grade: {s.finalGrade}</Text>}
                {s.performanceCategory && (
                  <View style={[styles.perfBadge, { backgroundColor: (s.performanceCategory.color || '#E5E7EB') + '30' }]}>
                    <Text style={[styles.perfBadgeText, { color: s.performanceCategory.color || '#6B7280' }]}>
                      {s.performanceCategory.label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Subject Detail */}
        {selectedSubject && (selectedSubject.assessments?.length ?? 0) > 0 && (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>{selectedSubject.subjectName} — Assessments</Text>
            {selectedSubject.assessments?.map((a, i) => (
              <View key={i} style={styles.assessRow}>
                <Text style={styles.assessName}>{a.name}</Text>
                <View style={styles.assessScoreRow}>
                  <View style={[styles.assessScoreBadge, { backgroundColor: getScoreBg(a.percentage) }]}>
                    <Text style={[styles.assessScore, { color: getScoreColor(a.percentage) }]}>
                      {a.rawScore ?? '—'}/{a.maxScore}
                    </Text>
                  </View>
                  {a.percentage != null && (
                    <Text style={[styles.assessPct, { color: getScoreColor(a.percentage) }]}>
                      {a.percentage.toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {subjects.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyText}>No results yet{'\n'}Check back after your assessments!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textLight },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  scrollContent: { padding: spacing.md, paddingBottom: 40 },
  heroRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  heroCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center', ...shadows.sm },
  heroValue: { fontSize: 22, fontWeight: '700' },
  heroLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  attSection: { marginBottom: spacing.md, backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.lg, ...shadows.sm },
  attBarBg: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  attBarFill: { height: '100%', borderRadius: 4 },
  attText: { fontSize: 12, color: colors.textLight, marginTop: 6, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
  subjectGrid: { gap: 8, marginBottom: spacing.md },
  subjectCard: { backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.lg, ...shadows.sm },
  subjectTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  subjectCode: { fontSize: 12, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase' },
  scorePill: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12 },
  scorePillText: { fontSize: 14, fontWeight: '700' },
  subjectName: { fontSize: 16, fontWeight: '600', color: colors.text },
  subjectGrade: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  perfBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  perfBadgeText: { fontSize: 11, fontWeight: '600' },
  detailCard: { backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, ...shadows.sm },
  detailTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  assessRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  assessName: { fontSize: 14, fontWeight: '500', color: colors.text, flex: 1 },
  assessScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assessScoreBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  assessScore: { fontSize: 13, fontWeight: '600' },
  assessPct: { fontSize: 13, fontWeight: '700', minWidth: 48, textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textLight, textAlign: 'center', lineHeight: 22 },
});
