import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import MathJax from 'react-native-mathjax-svg';
import { colors, spacing, borderRadius } from '../../theme';
import { MobileMathGraph } from './MobileMathGraph';

interface MathExpression {
  latex: string;
  display?: 'block' | 'inline';
}

interface Step {
  number: number;
  title: string;
  content: string;
  math?: MathExpression[];
}

interface GraphSpec {
  type: string;
  function: string;
  xLabel?: string;
  yLabel?: string;
  showIntercepts?: boolean;
  showTurningPoint?: boolean;
  showAsymptotes?: boolean;
  domain?: [number, number];
  shadedRegion?: { start: number; end: number; color: string };
}

interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
}

interface DiagramSpec {
  type: string;
  params: Record<string, any>;
}

interface AnswerData {
  latex?: string;
  text?: string;
}

interface PracticeQuestion {
  question: string;
  math?: MathExpression[];
  difficulty?: string;
}

interface InteractiveOptions {
  whyThisMethod?: string;
  alternativeMethod?: string;
}

export interface StructuredTutorResponse {
  type: 'math_solution' | 'explanation' | 'practice' | 'general';
  explanation?: string;
  rendered_math?: MathExpression[];
  steps?: Step[];
  graphs?: GraphSpec[];
  tables?: TableData[];
  diagrams?: DiagramSpec[];
  answer?: AnswerData;
  practice_question?: PracticeQuestion;
  common_mistakes?: string[];
  interactive?: InteractiveOptions;
}

export function MobileMathRenderer({ latex, display = 'inline' }: { latex: string; display?: 'block' | 'inline' }) {
  if (!latex || latex.trim() === '') return null;
  // Block math renders centered with padding
  return (
    <View style={display === 'block' ? styles.mathBlock : styles.mathInline}>
      <MathJax color={colors.text} fontSize={display === 'block' ? 18 : 15}>
        {display === 'block' ? `\\[${latex}\\]` : `\\(${latex}\\)`}
      </MathJax>
    </View>
  );
}

export function MobileMathBlock({ expressions }: { expressions: MathExpression[] }) {
  if (!expressions || expressions.length === 0) return null;
  return (
    <View style={styles.mathBlockContainer}>
      {expressions.map((expr, i) => (
        <MobileMathRenderer key={i} latex={expr.latex} display={expr.display || 'block'} />
      ))}
    </View>
  );
}

function MobileStepSolution({ steps, interactive }: { steps: Step[]; interactive?: InteractiveOptions }) {
  const [visibleCount, setVisibleCount] = useState(1);
  const [showFull, setShowFull] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showAlt, setShowAlt] = useState(false);

  const displaySteps = showFull ? steps : steps.slice(0, visibleCount);
  const hasMore = visibleCount < steps.length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Step-by-Step Solution</Text>
      </View>
      <View style={styles.stepsContainer}>
        {displaySteps.map((step) => (
          <View key={step.number} style={styles.stepCard}>
            <View style={styles.stepNumberContainer}>
              <Text style={styles.stepNumber}>{step.number}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepText}>{step.content}</Text>
              {step.math && step.math.length > 0 && (
                <View style={styles.stepMathContainer}>
                  {step.math.map((expr, i) => (
                    <View key={i} style={styles.stepMathBox}>
                      <MobileMathRenderer latex={expr.latex} display={expr.display || 'block'} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
      {!showFull && hasMore && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setVisibleCount(prev => Math.min(prev + 1, steps.length))}
          >
            <Text style={styles.primaryButtonText}>Show Next Step</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => { setShowFull(true); setVisibleCount(steps.length); }}
          >
            <Text style={styles.secondaryButtonText}>Reveal Full Solution</Text>
          </TouchableOpacity>
        </View>
      )}
      {interactive?.whyThisMethod && (
        <View style={styles.interactiveSection}>
          <TouchableOpacity style={styles.whyButton} onPress={() => setShowWhy(!showWhy)}>
            <Text style={styles.whyButtonText}>💡 Why This Method? {showWhy ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showWhy && (
            <View style={styles.whyContent}>
              <Text style={styles.whyText}>{interactive.whyThisMethod}</Text>
            </View>
          )}
        </View>
      )}
      {interactive?.alternativeMethod && (
        <View style={styles.interactiveSection}>
          <TouchableOpacity style={styles.altButton} onPress={() => setShowAlt(!showAlt)}>
            <Text style={styles.altButtonText}>🔄 Alternative Method {showAlt ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showAlt && (
            <View style={styles.altContent}>
              <Text style={styles.altText}>{interactive.alternativeMethod}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function MobileAnswerBlock({ answer }: { answer: AnswerData }) {
  if (!answer || (!answer.latex && !answer.text)) return null;
  return (
    <View style={[styles.section, styles.answerSection]}>
      <View style={styles.answerHeader}>
        <Text style={styles.answerTitle}>✓ Final Answer</Text>
      </View>
      {answer.latex && <MobileMathRenderer latex={answer.latex} display="block" />}
      {answer.text && !answer.latex && (
        <Text style={styles.answerText}>{answer.text}</Text>
      )}
    </View>
  );
}

function MobileCommonMistakes({ mistakes }: { mistakes: string[] }) {
  const [visible, setVisible] = useState(false);
  if (!mistakes || mistakes.length === 0) return null;
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.mistakeToggle} onPress={() => setVisible(!visible)}>
        <Text style={styles.mistakeToggleText}>⚠ Common Mistakes ({mistakes.length}) {visible ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {visible && (
        <View style={styles.mistakeContainer}>
          {mistakes.map((m, i) => (
            <View key={i} style={styles.mistakeItem}>
              <Text style={styles.mistakeBullet}>!</Text>
              <Text style={styles.mistakeText}>{m}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function MobilePracticeQuestion({ pq }: { pq: PracticeQuestion }) {
  const [visible, setVisible] = useState(false);
  if (!pq) return null;
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.practiceToggle} onPress={() => setVisible(!visible)}>
        <Text style={styles.practiceToggleText}>✏ Practice Question {visible ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {visible && (
        <View style={styles.practiceContainer}>
          <Text style={styles.practiceText}>{pq.question}</Text>
          {pq.math && pq.math.length > 0 && <MobileMathBlock expressions={pq.math} />}
        </View>
      )}
    </View>
  );
}

export function MobileTutorResponse({
  content,
  structured,
}: {
  content: string;
  structured?: StructuredTutorResponse | null;
}) {
  const parsed = useMemo<StructuredTutorResponse | null>(() => {
    if (structured) return structured;
    try {
      const p = JSON.parse(content);
      if (p && typeof p === 'object' && p.type) return p as StructuredTutorResponse;
    } catch {}
    return null;
  }, [content, structured]);

  if (!parsed) {
    return <Text style={styles.plainText}>{content}</Text>;
  }

  const { explanation, rendered_math, steps, graphs, answer, common_mistakes, practice_question, interactive } = parsed;

  return (
    <View style={styles.container}>
      {explanation && (
        <Text style={styles.explanationText}>{explanation}</Text>
      )}
      {rendered_math && rendered_math.length > 0 && (
        <MobileMathBlock expressions={rendered_math} />
      )}
      {steps && steps.length > 0 && (
        <MobileStepSolution steps={steps} interactive={interactive} />
      )}
      {graphs && graphs.length > 0 && (
        <View style={styles.graphSection}>
          <Text style={styles.sectionTitle}>Graph</Text>
          {graphs.map((graph, i) => (
            <MobileMathGraph key={i} spec={graph} />
          ))}
        </View>
      )}
      {answer && <MobileAnswerBlock answer={answer} />}
      {common_mistakes && <MobileCommonMistakes mistakes={common_mistakes} />}
      {practice_question && <MobilePracticeQuestion pq={practice_question} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  graphSection: { gap: spacing.sm, marginTop: spacing.sm },
  plainText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  explanationText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  mathBlockContainer: { gap: spacing.xs },
  mathBlock: { backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginVertical: spacing.xs },
  mathInline: { marginHorizontal: 2 },
  section: { marginTop: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.orange, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepsContainer: { gap: spacing.sm },
  stepCard: { flexDirection: 'row', backgroundColor: colors.orangeLight, borderRadius: borderRadius.md, borderLeftWidth: 4, borderLeftColor: colors.orange, padding: spacing.md },
  stepNumberContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.orange, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm, marginTop: 2 },
  stepNumber: { fontSize: 12, fontWeight: '700', color: colors.white },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 11, fontWeight: '700', color: colors.orange, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepText: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 4 },
  stepMathContainer: { gap: spacing.xs, marginTop: spacing.sm },
  stepMathBox: { backgroundColor: colors.white, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.orangeLight, padding: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: { flex: 1, backgroundColor: colors.orange, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  secondaryButton: { flex: 1, backgroundColor: colors.border, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  interactiveSection: { marginTop: spacing.sm },
  whyButton: { backgroundColor: colors.purpleLight, padding: spacing.sm, borderRadius: borderRadius.md },
  whyButtonText: { color: colors.purple, fontSize: 13, fontWeight: '600' },
  whyContent: { backgroundColor: colors.purpleLight, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.xs },
  whyText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  altButton: { backgroundColor: colors.tealLight, padding: spacing.sm, borderRadius: borderRadius.md },
  altButtonText: { color: colors.teal, fontSize: 13, fontWeight: '600' },
  altContent: { backgroundColor: colors.tealLight, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.xs },
  altText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  answerSection: { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success, padding: spacing.md, borderRadius: borderRadius.md },
  answerHeader: { marginBottom: spacing.sm },
  answerTitle: { fontSize: 14, fontWeight: '700', color: colors.success },
  answerText: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  mistakeToggle: { backgroundColor: colors.errorLight, padding: spacing.sm, borderRadius: borderRadius.md },
  mistakeToggleText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  mistakeContainer: { gap: spacing.xs, marginTop: spacing.xs },
  mistakeItem: { flexDirection: 'row', backgroundColor: colors.errorLight, padding: spacing.sm, borderRadius: borderRadius.sm, gap: spacing.sm },
  mistakeBullet: { color: colors.error, fontWeight: '700' },
  mistakeText: { fontSize: 13, color: colors.text, flex: 1 },
  practiceToggle: { backgroundColor: colors.infoLight, padding: spacing.sm, borderRadius: borderRadius.md },
  practiceToggleText: { color: colors.info, fontSize: 13, fontWeight: '600' },
  practiceContainer: { backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.xs },
  practiceText: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
