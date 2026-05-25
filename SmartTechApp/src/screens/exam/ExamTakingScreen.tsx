import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Loading, Button } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useExamStore } from '../../store/exam-store';
import { useAuthStore } from '../../store';
import { ExamQuestion } from '../../types';

type ParamList = { ExamTaking: { examId: string; attemptId?: string } };

export const ExamTakingScreen: React.FC = () => {
  const route = useRoute<RouteProp<ParamList, 'ExamTaking'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const {
    currentExam, currentAttempt, attemptAnswers, loading, error,
    fetchExam, startAttempt, fetchAttempt, submitAnswer, submitAttempt, clearAttempt, clearError,
  } = useExamStore();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [localAnswer, setLocalAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const answerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timePerQuestion = useRef<Record<string, number>>({});

  const examId = route.params.examId;

  useEffect(() => {
    loadExam();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (answerTimerRef.current) clearInterval(answerTimerRef.current);
    };
  }, []);

  const loadExam = async () => {
    await fetchExam(examId);
    if (route.params.attemptId) {
      await fetchAttempt(route.params.attemptId);
    } else {
      await startAttempt(examId, user?.id);
    }
  };

  useEffect(() => {
    if (currentAttempt && !currentAttempt.isSubmitted && currentAttempt.startedAt) {
      const started = new Date(currentAttempt.startedAt).getTime();
      const durationMs = (currentExam?.duration || 60) * 60 * 1000;
      const elapsed = Date.now() - started;
      const remaining = Math.max(0, Math.floor((durationMs - elapsed) / 1000));
      setTimeLeft(remaining);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      answerTimerRef.current = setInterval(() => {
        const q = questions[currentQuestionIndex];
        if (q) {
          timePerQuestion.current[q.id] = (timePerQuestion.current[q.id] || 0) + 1;
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (answerTimerRef.current) clearInterval(answerTimerRef.current);
    };
  }, [currentAttempt?.startedAt, currentExam?.duration]);

  useEffect(() => {
    if (currentAttempt && Object.keys(attemptAnswers).length > 0) {
      const q = questions[currentQuestionIndex];
      if (q) {
        setLocalAnswer(attemptAnswers[q.id] || '');
      }
    }
  }, [currentQuestionIndex, attemptAnswers, currentAttempt]);

  const questions: ExamQuestion[] = (currentExam?.questions || []).sort((a, b) => a.order - b.order);
  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswerChange = (text: string) => {
    setLocalAnswer(text);
    useExamStore.getState().setAnswer(currentQuestion?.id || '', text);
  };

  const handleOptionSelect = (option: string) => {
    setLocalAnswer(option);
    useExamStore.getState().setAnswer(currentQuestion?.id || '', option);
  };

  const navigateQuestion = (direction: 'prev' | 'next') => {
    if (currentQuestion) {
      const seconds = timePerQuestion.current[currentQuestion.id] || 0;
      submitAnswer(currentQuestion.id, localAnswer);
      useExamStore.getState().setTimeSpent(currentQuestion.id, seconds);
      timePerQuestion.current[currentQuestion.id] = 0;
    }
    if (direction === 'next' && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setLocalAnswer(attemptAnswers[questions[currentQuestionIndex + 1]?.id] || '');
    } else if (direction === 'prev' && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setLocalAnswer(attemptAnswers[questions[currentQuestionIndex - 1]?.id] || '');
    }
  };

  const handleAutoSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (currentQuestion) {
      const seconds = timePerQuestion.current[currentQuestion.id] || 0;
      await submitAnswer(currentQuestion.id, localAnswer);
      useExamStore.getState().setTimeSpent(currentQuestion.id, seconds);
    }
    await submitAttempt();
    Alert.alert('Time Up!', 'Your exam has been auto-submitted.');
    navigation.replace('ExamResults', { attemptId: currentAttempt?.id });
    setIsSubmitting(false);
  }, [currentQuestion, localAnswer, currentAttempt, isSubmitting]);

  const handleSubmit = async () => {
    Alert.alert('Submit Exam', 'Are you sure you want to submit? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit', style: 'destructive',
        onPress: async () => {
          setIsSubmitting(true);
          if (currentQuestion) {
            const seconds = timePerQuestion.current[currentQuestion.id] || 0;
            await submitAnswer(currentQuestion.id, localAnswer);
            useExamStore.getState().setTimeSpent(currentQuestion.id, seconds);
          }
          await submitAttempt();
          clearAttempt();
          navigation.replace('ExamResults', { attemptId: currentAttempt?.id });
          setIsSubmitting(false);
        },
      },
    ]);
  };

  if (loading && !currentExam) return <Loading fullScreen message="Loading exam..." />;
  if (!currentExam) return <Loading fullScreen message="Preparing exam..." />;
  if (!currentAttempt) return <Loading fullScreen message="Starting attempt..." />;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const isUrgent = timeLeft < 300;

  const answeredCount = Object.keys(attemptAnswers).length;
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  const renderQuestionInput = () => {
    if (!currentQuestion) return null;
    const type = currentQuestion.questionType;

    if (type === 'MULTIPLE_CHOICE') {
      const opts = (currentQuestion.options || []) as string[];
      return (
        <View style={styles.optionsContainer}>
          {opts.map((opt, i) => {
            const selected = attemptAnswers[currentQuestion.id] === opt;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.optionBtn, selected && styles.optionSelected]}
                onPress={() => handleOptionSelect(opt)}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (type === 'TRUE_FALSE') {
      return (
        <View style={styles.optionsContainer}>
          {['True', 'False'].map((opt) => {
            const selected = attemptAnswers[currentQuestion.id] === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.optionBtn, selected && styles.optionSelected]}
                onPress={() => handleOptionSelect(opt)}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    return (
      <TextInput
        style={styles.answerInput}
        value={localAnswer}
        onChangeText={handleAnswerChange}
        placeholder={type === 'ESSAY' || type === 'STRUCTURED' ? 'Write your answer here...' : 'Type your answer...'}
        multiline={type === 'ESSAY' || type === 'STRUCTURED'}
        numberOfLines={type === 'ESSAY' || type === 'STRUCTURED' ? 8 : 3}
        textAlignVertical="top"
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{currentExam.title}</Text>
        <Text style={[styles.timer, isUrgent && styles.timerUrgent]}>{formatTime(timeLeft)}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: isUrgent ? colors.error : colors.secondary }]} />
      </View>

      <View style={styles.progressInfo}>
        <Text style={styles.progressText}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </Text>
        <Text style={styles.progressText}>
          {answeredCount}/{questions.length} answered
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {currentQuestion && (
          <Card style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <View style={[styles.qTypeBadge, { backgroundColor: colors.secondary + '20' }]}>
                <Text style={[styles.qTypeText, { color: colors.secondary }]}>
                  {currentQuestion.questionType.replace(/_/g, ' ')}
                </Text>
              </View>
              <Text style={styles.questionScore}>{currentQuestion.score} marks</Text>
            </View>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            {renderQuestionInput()}
          </Card>
        )}

        <View style={styles.navRow}>
          <Button
            title="Previous"
            onPress={() => navigateQuestion('prev')}
            variant="outline"
            disabled={currentQuestionIndex === 0}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              title="Next"
              onPress={() => navigateQuestion('next')}
              variant="primary"
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              title="Submit"
              onPress={handleSubmit}
              variant="danger"
              loading={isSubmitting}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </ScrollView>

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}><Text style={styles.errorDismiss}>✕</Text></TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { fontSize: 16, color: colors.secondary, fontWeight: '600', marginRight: spacing.sm },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  timer: { fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: spacing.sm },
  timerUrgent: { color: colors.error },
  progressBar: { height: 4, backgroundColor: colors.border },
  progressFill: { height: 4, borderRadius: 2 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  progressText: { fontSize: 12, color: colors.textLight },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  questionCard: { marginBottom: spacing.md },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  qTypeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 8 },
  qTypeText: { fontSize: 11, fontWeight: '600' },
  questionScore: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  questionText: { fontSize: 16, fontWeight: '500', color: colors.text, marginBottom: spacing.lg, lineHeight: 24 },
  optionsContainer: { gap: spacing.sm },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  optionSelected: { borderColor: colors.secondary, backgroundColor: colors.secondary + '10' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  radioSelected: { borderColor: colors.secondary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.secondary },
  optionText: { fontSize: 15, color: colors.text, flex: 1 },
  optionTextSelected: { color: colors.secondary, fontWeight: '600' },
  answerInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md, fontSize: 15, color: colors.text, backgroundColor: colors.white, minHeight: 80 },
  navRow: { flexDirection: 'row', marginTop: spacing.md },
  errorBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.error + '20', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  errorText: { fontSize: 13, color: colors.error, flex: 1 },
  errorDismiss: { fontSize: 16, color: colors.error, marginLeft: spacing.sm },
});
