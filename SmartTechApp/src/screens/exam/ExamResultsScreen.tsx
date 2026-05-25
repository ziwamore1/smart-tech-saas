import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Loading, Button } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useExamStore } from '../../store/exam-store';

type ParamList = { ExamResults: { attemptId: string } };

export const ExamResultsScreen: React.FC = () => {
  const route = useRoute<RouteProp<ParamList, 'ExamResults'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { currentAttempt, currentExam, loading, fetchAttempt, fetchExam } = useExamStore();
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadData();
    }
  }, []);

  const loadData = async () => {
    await fetchAttempt(route.params.attemptId);
  };

  if (loading && !currentAttempt) return <Loading fullScreen message="Loading results..." />;
  if (!currentAttempt) return <Loading fullScreen message="Loading..." />;

  const percentage = currentAttempt.percentage ?? 0;
  const passed = percentage >= (currentAttempt.exam?.passingScore || 50);
  const grade = currentAttempt.grade || (percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F');
  const totalQuestions = currentAttempt.answers?.length || 0;
  const correctCount = currentAttempt.answers?.filter((a: any) => a.isCorrect)?.length || 0;

  const formatDate = (d?: string) => d ? new Date(d).toLocaleString() : '-';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Exam Results</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.scoreCard}>
          <View style={[styles.scoreCircle, { borderColor: passed ? colors.success : colors.error }]}>
            <Text style={[styles.scorePercentage, { color: passed ? colors.success : colors.error }]}>
              {Math.round(percentage)}%
            </Text>
            <Text style={styles.scoreGrade}>{grade}</Text>
          </View>
          <Text style={styles.scoreLabel}>{passed ? 'PASSED' : 'FAILED'}</Text>
          <Text style={styles.scoreMeta}>
            {currentAttempt.score ?? 0} / {currentAttempt.totalScore ?? 0} marks
          </Text>
        </Card>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.statVal, { color: '#3b82f6' }]}>{correctCount}</Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#fef2f2' }]}>
            <Text style={[styles.statVal, { color: '#ef4444' }]}>{totalQuestions - correctCount}</Text>
            <Text style={styles.statLabel}>Wrong</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#f3e8ff' }]}>
            <Text style={[styles.statVal, { color: '#8b5cf6' }]}>{totalQuestions}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {currentAttempt.exam && (
          <Card style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Exam Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Exam</Text>
              <Text style={styles.detailValue}>{currentAttempt.exam.title}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Started</Text>
              <Text style={styles.detailValue}>{formatDate(currentAttempt.startedAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Submitted</Text>
              <Text style={styles.detailValue}>{formatDate(currentAttempt.submittedAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Time Spent</Text>
              <Text style={styles.detailValue}>
                {currentAttempt.timeSpent ? `${Math.floor(currentAttempt.timeSpent / 60)}m ${currentAttempt.timeSpent % 60}s` : '-'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Negative Score</Text>
              <Text style={[styles.detailValue, { color: currentAttempt.negativeScore > 0 ? colors.error : colors.text }]}>
                {currentAttempt.negativeScore}
              </Text>
            </View>
          </Card>
        )}

        {currentAttempt.answers && currentAttempt.answers.length > 0 && (
          <Card style={styles.answersCard}>
            <Text style={styles.sectionTitle}>Question Review</Text>
            {currentAttempt.answers.map((answer: any, idx: number) => {
              const q = answer.question;
              return (
                <View key={answer.id} style={[styles.answerItem, idx < (currentAttempt.answers?.length || 0) - 1 && styles.answerItemBorder]}>
                  <View style={styles.answerHeader}>
                    <Text style={styles.answerNumber}>Q{idx + 1}</Text>
                    <View style={[styles.answerBadge, { backgroundColor: answer.isCorrect ? '#d1fae5' : '#fee2e2' }]}>
                      <Text style={[styles.answerBadgeText, { color: answer.isCorrect ? '#065f46' : '#991b1b' }]}>
                        {answer.isCorrect ? 'Correct' : 'Incorrect'}
                      </Text>
                    </View>
                  </View>
                  {q && <Text style={styles.answerQuestion} numberOfLines={2}>{q.question}</Text>}
                  <View style={styles.answerMeta}>
                    <Text style={styles.answerMetaText}>Score: {answer.score ?? 0}/{answer.maxScore ?? 0}</Text>
                    {answer.feedback && <Text style={styles.feedbackText}>Feedback: {answer.feedback}</Text>}
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        <Button
          title="Back to Exams"
          onPress={() => {
            navigation.reset({ index: 0, routes: [{ name: 'ExamList' }] });
          }}
          variant="primary"
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  scoreCard: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.md },
  scoreCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  scorePercentage: { fontSize: 28, fontWeight: '700' },
  scoreGrade: { fontSize: 14, fontWeight: '600', color: colors.textLight },
  scoreLabel: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  scoreMeta: { fontSize: 14, color: colors.textLight },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: { flex: 1, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  detailCard: { marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { fontSize: 14, color: colors.textLight },
  detailValue: { fontSize: 14, color: colors.text, fontWeight: '500' },
  answersCard: { marginBottom: spacing.md },
  answerItem: { paddingVertical: spacing.md },
  answerItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  answerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  answerNumber: { fontSize: 12, fontWeight: '700', color: colors.textLight },
  answerBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 8 },
  answerBadgeText: { fontSize: 11, fontWeight: '600' },
  answerQuestion: { fontSize: 14, color: colors.text, marginBottom: spacing.xs },
  answerMeta: { flexDirection: 'row', gap: spacing.md },
  answerMetaText: { fontSize: 12, color: colors.textLight },
  feedbackText: { fontSize: 12, color: colors.secondary, flex: 1 },
});
