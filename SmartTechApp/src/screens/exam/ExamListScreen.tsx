import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Card, Loading } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useExamStore } from '../../store/exam-store';
import { useAuthStore } from '../../store';

export const ExamListScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { exams, loading, fetchExams } = useExamStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  useFocusEffect(
    useCallback(() => {
      fetchExams();
    }, [])
  );

  const filtered = exams.filter((e) => {
    if (filter === 'published') return e.isPublished;
    if (filter === 'draft') return !e.isPublished;
    return true;
  });

  const isTeacher = user?.roles?.some((r: string) => r === 'Teacher' || r === 'Class Teacher' || r === 'Director');

  const getStatusBadge = (exam: any) => {
    const status = exam.isPublished ? 'Published' : exam.status || 'Draft';
    const bg = exam.isPublished ? '#d1fae5' : '#fef3c7';
    const color = exam.isPublished ? '#065f46' : '#92400e';
    return { status, bg, color };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Exams</Text>
        {isTeacher && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('ExamCreate')}
          >
            <Text style={styles.createBtnText}>+ New</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {(['all', 'published', 'draft'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchExams()} />}
      >
        {loading && exams.length === 0 ? (
          <Loading fullScreen message="Loading exams..." />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No exams found</Text>
          </View>
        ) : (
          filtered.map((exam) => {
            const badge = getStatusBadge(exam);
            return (
              <TouchableOpacity
                key={exam.id}
                style={styles.examCard}
                onPress={() => navigation.navigate('ExamDetail', { examId: exam.id })}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.examTitle}>{exam.title}</Text>
                    <Text style={styles.examMeta}>
                      {exam.subject?.name || ''} · {exam.class?.name || ''}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.status}</Text>
                  </View>
                </View>
                <View style={styles.cardStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{exam.duration}m</Text>
                    <Text style={styles.statLabel}>Duration</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{exam.totalScore}</Text>
                    <Text style={styles.statLabel}>Marks</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{exam._count?.questions || 0}</Text>
                    <Text style={styles.statLabel}>Questions</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{exam._count?.attempts || 0}</Text>
                    <Text style={styles.statLabel}>Attempts</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  createBtn: { backgroundColor: colors.secondary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  createBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  filterChipText: { fontSize: 13, color: colors.textLight, fontWeight: '500' },
  filterChipTextActive: { color: colors.white },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textLight },
  examCard: { backgroundColor: colors.white, borderRadius: 14, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  examTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  examMeta: { fontSize: 13, color: colors.textLight },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
});
