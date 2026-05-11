import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';

const QUESTIONS = [
  { q: 'When learning, I prefer to:', v: 'Watch videos/diagrams', a: 'Listen to explanations', r: 'Read textbooks', k: 'Try hands-on' },
  { q: 'To remember directions:', v: 'Look at a map', a: 'Listen to instructions', r: 'Write steps down', k: 'Walk the route' },
  { q: 'I learn best when:', v: 'Charts are used', a: 'We discuss', r: 'I take notes', k: 'I do activities' },
  { q: 'When studying, I:', v: 'Use color-coded notes', a: 'Record explanations', r: 'Rewrite notes', k: 'Use flashcards' },
  { q: 'I prefer instructions:', v: 'With pictures', a: 'Explained verbally', r: 'In a manual', k: 'Shown via demo' },
];

export const LearningStyleScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState({ visual: 0, aural: 0, readWrite: 0, kinesthetic: 0 });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const handleAnswer = (dim: keyof typeof scores) => {
    const newScores = { ...scores, [dim]: scores[dim] + 1 };
    setScores(newScores);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      submitAssessment(newScores);
    }
  };

  const submitAssessment = async (finalScores: typeof scores) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await apiService.assessLearningStyle(
        user.id, finalScores.visual, finalScores.aural, finalScores.readWrite, finalScores.kinesthetic,
      );
      setResult(res?.data || res);
    } catch (err) {
      const dominant = Object.entries(finalScores).sort((a, b) => b[1] - a[1])[0][0];
      setResult({ dominantStyle: dominant, ...finalScores });
    }
    finally { setLoading(false); }
  };

  if (!started) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}><Text style={styles.headerTitle}>Learning Style</Text></View>
        <View style={styles.centerContent}>
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🧠</Text>
          <Text style={styles.title}>VARK Assessment</Text>
          <Text style={styles.desc}>Discover your preferred learning style: Visual, Aural, Read/Write, or Kinesthetic</Text>
          <Button title="Start Assessment" onPress={() => setStarted(true)} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (result) {
    const dominant = result.dominantStyle || Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}><Text style={styles.headerTitle}>Your Results</Text></View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🎉</Text>
            <Text style={styles.resultTitle}>Your Dominant Style</Text>
            <View style={styles.dominantBadge}>
              <Text style={styles.dominantText}>
                {dominant === 'visual' ? 'Visual' : dominant === 'aural' ? 'Aural' : dominant === 'readWrite' ? 'Read/Write' : 'Kinesthetic'}
              </Text>
            </View>
            <Text style={styles.resultDesc}>
              {dominant === 'visual' ? 'You learn best through images, diagrams, and visual representations.' :
               dominant === 'aural' ? 'You learn best through listening, discussions, and verbal explanations.' :
               dominant === 'readWrite' ? 'You learn best through reading texts, writing notes, and lists.' :
               'You learn best through hands-on activities and real-world examples.'}
            </Text>
          </Card>
          <Card style={{ padding: spacing.md }}>
            {(['visual', 'aural', 'readWrite', 'kinesthetic'] as const).map((key) => (
              <View key={key} style={styles.resultBarRow}>
                <Text style={styles.resultBarLabel}>{key === 'readWrite' ? 'Read/Write' : key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                <View style={styles.resultBarBg}>
                  <View style={[styles.resultBarFill, {
                    width: `${((result[key] ?? scores[key]) / QUESTIONS.length) * 100}%`,
                    backgroundColor: key === 'visual' ? '#3b82f6' : key === 'aural' ? '#10b981' : key === 'readWrite' ? '#8b5cf6' : '#f59e0b',
                  }]} />
                </View>
                <Text style={styles.resultBarScore}>{result[key] ?? scores[key]}/{QUESTIONS.length}</Text>
              </View>
            ))}
          </Card>
          <Button title="Retake Assessment" onPress={() => { setStarted(false); setStep(0); setScores({ visual: 0, aural: 0, readWrite: 0, kinesthetic: 0 }); setResult(null); }} variant="outline" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Question {step + 1} of {QUESTIONS.length}</Text>
        <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${((step + 1) / QUESTIONS.length) * 100}%` }]} /></View>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={{ padding: spacing.lg }}>
          <Text style={styles.question}>{QUESTIONS[step].q}</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            {([
              { label: 'Visual', key: 'visual' as const, desc: QUESTIONS[step].v, color: '#3b82f6' },
              { label: 'Aural', key: 'aural' as const, desc: QUESTIONS[step].a, color: '#10b981' },
              { label: 'Read/Write', key: 'readWrite' as const, desc: QUESTIONS[step].r, color: '#8b5cf6' },
              { label: 'Kinesthetic', key: 'kinesthetic' as const, desc: QUESTIONS[step].k, color: '#f59e0b' },
            ]).map((opt) => (
              <TouchableOpacity key={opt.key} style={styles.optionCard} onPress={() => handleAnswer(opt.key)}>
                <View style={[styles.optionDot, { backgroundColor: opt.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionDesc}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  progressBar: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: spacing.sm },
  progressFill: { height: 4, backgroundColor: colors.secondary, borderRadius: 2 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  desc: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  question: { fontSize: 18, fontWeight: '600', color: colors.text, lineHeight: 26 },
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.background, borderRadius: 12, gap: spacing.md },
  optionDot: { width: 12, height: 12, borderRadius: 6 },
  optionLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  optionDesc: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  resultTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  dominantBadge: { backgroundColor: colors.secondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20, marginBottom: spacing.md },
  dominantText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  resultDesc: { fontSize: 14, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
  resultBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  resultBarLabel: { width: 80, fontSize: 12, fontWeight: '600', color: colors.textLight },
  resultBarBg: { flex: 1, height: 10, backgroundColor: colors.border, borderRadius: 5 },
  resultBarFill: { height: 10, borderRadius: 5 },
  resultBarScore: { width: 40, fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'right' },
});
