import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Loading, Button } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useExamStore } from '../../store/exam-store';
import { useAuthStore } from '../../store';

type ParamList = { ExamDetail: { examId: string } };

export const ExamDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<ParamList, 'ExamDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const { currentExam, loading, error, fetchExam } = useExamStore();

  const examId = route.params.examId;

  useEffect(() => {
    fetchExam(examId);
  }, [examId]);

  const isTeacher = user?.roles?.some((r: string) =>
    ['Teacher', 'Class Teacher', 'Director', 'Head Teacher', 'Deputy', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'].includes(r)
  );

  if (loading && !currentExam) return <Loading fullScreen message="Loading exam..." />;
  if (error) return <Loading fullScreen message={error} />;
  if (!currentExam) return <Loading fullScreen message="Exam not found" />;

  const exam = currentExam;
  const statusColor = exam.isPublished ? colors.success : colors.warning;
  const statusLabel = exam.isPublished ? 'Published' : 'Draft';
  const questionCount = exam._count?.questions || exam.questions?.length || 0;
  const attemptCount = exam._count?.attempts || 0;
  const formattedStart = exam.startsAt ? new Date(exam.startsAt).toLocaleString() : 'N/A';
  const formattedEnd = exam.endsAt ? new Date(exam.endsAt).toLocaleString() : 'N/A';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Exam Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.infoCard}>
          <View style={styles.titleRow}>
            <Text style={styles.examTitle}>{exam.title}</Text>
            <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {exam.description && (
            <Text style={styles.description}>{exam.description}</Text>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Subject</Text>
            <Text style={styles.metaValue}>{exam.subject?.name || 'N/A'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Class</Text>
            <Text style={styles.metaValue}>{exam.class?.name || 'N/A'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Duration</Text>
            <Text style={styles.metaValue}>{exam.duration} minutes</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Total Marks</Text>
            <Text style={styles.metaValue}>{exam.totalScore}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Passing Score</Text>
            <Text style={styles.metaValue}>{exam.passingScore}%</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Questions</Text>
            <Text style={styles.metaValue}>{questionCount}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Attempts</Text>
            <Text style={styles.metaValue}>{attemptCount}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Starts</Text>
            <Text style={styles.metaValue}>{formattedStart}</Text>
          </View>
          <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.metaLabel}>Ends</Text>
            <Text style={styles.metaValue}>{formattedEnd}</Text>
          </View>
        </Card>

        {exam.instructions && (
          <Card style={styles.instructionsCard}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <Text style={styles.instructionsText}>{exam.instructions}</Text>
          </Card>
        )}

        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{questionCount}</Text>
              <Text style={styles.statLabel}>Questions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{exam.totalScore}</Text>
              <Text style={styles.statLabel}>Total Marks</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{exam.duration}m</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{attemptCount}</Text>
              <Text style={styles.statLabel}>Attempts</Text>
            </View>
          </View>
        </Card>

        <View style={styles.actions}>
          {isTeacher ? (
            <>
              <Button
                title="View Results"
                onPress={() => navigation.navigate('ExamResults', { examId })}
                style={styles.actionBtn}
              />
              <Button
                title="View Analytics"
                onPress={() => navigation.navigate('ExamAnalytics', { examId })}
                style={styles.actionBtn}
              />
            </>
          ) : (
            <Button
              title="Take Exam"
              onPress={() => navigation.navigate('ExamTaking', { examId })}
              style={styles.actionBtn}
              size="large"
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { fontSize: 16, color: colors.secondary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  scrollContent: { padding: spacing.md, paddingBottom: 120 },
  infoCard: { padding: spacing.lg, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  examTitle: { fontSize: 20, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  description: { fontSize: 14, color: colors.textLight, marginBottom: spacing.md, lineHeight: 20 },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  metaLabel: { fontSize: 14, color: colors.textLight },
  metaValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  instructionsCard: { padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  instructionsText: { fontSize: 14, color: colors.textLight, lineHeight: 20 },
  statsCard: { padding: spacing.lg, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: colors.border },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { marginBottom: spacing.sm },
});
