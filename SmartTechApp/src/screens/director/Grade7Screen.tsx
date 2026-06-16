import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
  Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../theme';
import { apiService } from '../../services/api';
import { HeaderBar } from '../../components';
import type {
  Grade7Class, Grade7MockExam, Grade7Result, Grade7DivisionBreakdown,
  SelectionPrediction, Grade7ComputedResults, Grade7ExamAttempt,
} from '../../types';

type TabId = 'overview' | 'mocks' | 'predictions';

export const Grade7Screen: React.FC<{ onToggleDrawer?: () => void }> = ({ onToggleDrawer }) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<Grade7Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [results, setResults] = useState<Grade7ComputedResults | null>(null);
  const [mockExams, setMockExams] = useState<Grade7MockExam[]>([]);
  const [examScores, setExamScores] = useState<Record<string, Grade7ExamAttempt[]>>({});
  const [predictions, setPredictions] = useState<SelectionPrediction[]>([]);

  // Score entry modal state
  const [scoreModal, setScoreModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Grade7MockExam | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [modalLoading, setModalLoading] = useState(false);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'mocks', label: 'Mock Exams' },
    { id: 'predictions', label: 'Predictions' },
  ];

  const fetchClasses = useCallback(async () => {
    try {
      const res = await apiService.getGrade7Classes();
      const data = Array.isArray(res) ? res : res?.data || [];
      setClasses(data);
      if (data.length > 0 && !selectedClassId) {
        setSelectedClassId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to load classes', e);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const res = await apiService.getGrade7ComputedResults(selectedClassId, selectedTermId);
      setResults(res);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedTermId]);

  const fetchMockExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getMockExams(selectedClassId || undefined);
      const data = Array.isArray(res) ? res : res?.data || [];
      setMockExams(data);
      const scores: Record<string, Grade7ExamAttempt[]> = {};
      for (const exam of data) {
        try {
          const sr = await apiService.getMockExamResults(exam.id);
          scores[exam.id] = Array.isArray(sr) ? sr : sr?.data || sr?.attempts || [];
        } catch {
          scores[exam.id] = [];
        }
      }
      setExamScores(scores);
    } catch (e) {
      console.error('Failed to load mock exams', e);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId]);

  const fetchPredictions = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const res = await apiService.getGrade7Prediction(selectedClassId, selectedTermId);
      const data = Array.isArray(res) ? res : res?.data || res?.predictions || [];
      setPredictions(data);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedTermId]);

  useEffect(() => { fetchClasses(); }, []);
  useEffect(() => {
    if (!selectedClassId) return;
    if (activeTab === 'overview') fetchResults();
    else if (activeTab === 'mocks') fetchMockExams();
    else if (activeTab === 'predictions') fetchPredictions();
  }, [activeTab, selectedClassId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'overview') await fetchResults();
    else if (activeTab === 'mocks') await fetchMockExams();
    else if (activeTab === 'predictions') await fetchPredictions();
    setRefreshing(false);
  }, [activeTab, fetchResults, fetchMockExams, fetchPredictions]);

  const openScoreModal = (exam: Grade7MockExam) => {
    setSelectedExam(exam);
    const existing = examScores[exam.id] || [];
    const inputs: Record<string, string> = {};
    existing.forEach((a) => { inputs[a.studentId] = String(a.score || ''); });
    setScoreInputs(inputs);
    setScoreModal(true);
  };

  const handleEnterScore = async (studentId: string, score: string) => {
    if (!selectedExam) return;
    setModalLoading(true);
    try {
      await apiService.enterGrade7Score({
        examId: selectedExam.id,
        studentId,
        score: parseFloat(score) || 0,
      });
    } catch (e) {
      console.error('Failed to enter score', e);
    } finally {
      setModalLoading(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (!selectedExam) return;
    setModalLoading(true);
    try {
      const scores = Object.entries(scoreInputs)
        .filter(([, s]) => s !== '')
        .map(([studentId, score]) => ({ studentId, score: parseFloat(score) || 0 }));
      await apiService.enterBulkGrade7Scores({ examId: selectedExam.id, scores });
      await fetchMockExams();
      setScoreModal(false);
    } catch (e) {
      console.error('Failed to submit scores', e);
    } finally {
      setModalLoading(false);
    }
  };

  const divisionColor = (div?: string) => {
    if (!div) return '#6B7280';
    if (div === 'DIV_1' || div === '1') return '#16A34A';
    if (div === 'DIV_2' || div === '2') return '#2563EB';
    if (div === 'DIV_3' || div === '3') return '#CA8A04';
    if (div === 'DIV_4' || div === '4') return '#DC2626';
    if (div === 'DIV_5' || div === '5') return '#6B7280';
    if (div === 'U' || div === 'UNG') return '#9CA3AF';
    return '#6B7280';
  };

  const divisionBg = (div?: string) => {
    if (!div) return '#F3F4F6';
    if (div === 'DIV_1' || div === '1') return '#F0FDF4';
    if (div === 'DIV_2' || div === '2') return '#EFF6FF';
    if (div === 'DIV_3' || div === '3') return '#FEFCE8';
    if (div === 'DIV_4' || div === '4') return '#FEF2F2';
    if (div === 'DIV_5' || div === '5') return '#F3F4F6';
    if (div === 'U' || div === 'UNG') return '#F9FAFB';
    return '#F3F4F6';
  };

  const renderOverview = () => {
    if (loading && !refreshing) {
      return <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />;
    }
    if (!results || !results.results || results.results.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Results Yet</Text>
          <Text style={styles.emptySubtitle}>Run batch computation from the web dashboard or wait for results to be synced.</Text>
          <TouchableOpacity style={styles.computeBtn} onPress={async () => {
            if (!selectedClassId) return;
            setLoading(true);
            try {
              await apiService.computeGrade7Results(selectedClassId, selectedTermId);
              await fetchResults();
            } catch (e) {
              console.error('Computation failed', e);
            } finally {
              setLoading(false);
            }
          }}>
            <Text style={styles.computeBtnText}>Compute Results</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const { breakdown, totalStudents } = results;

    return (
      <>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
            <Text style={[styles.statValue, { color: '#4F46E5' }]}>{totalStudents}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>
              {breakdown?.reduce((s, b) => s + b.percentage, 0).toFixed(0) || 0}%
            </Text>
            <Text style={styles.statLabel}>Computed</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Division Breakdown</Text>
          <View style={styles.divisionRow}>
            {(breakdown || []).map((b) => (
              <View key={b.division} style={[styles.divisionCard, { backgroundColor: divisionBg(b.division) }]}>
                <Text style={[styles.divisionCount, { color: divisionColor(b.division) }]}>{b.count}</Text>
                <Text style={[styles.divisionLabel, { color: divisionColor(b.division) }]}>{b.division.replace('DIV_', 'Div ')}</Text>
                <Text style={styles.divisionPct}>{b.percentage.toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Results</Text>
          {results.results.map((r, i) => (
            <View key={r.id || i} style={styles.studentRow}>
              <View style={[styles.rankBadge, { backgroundColor: divisionBg(r.division) }]}>
                <Text style={[styles.rankText, { color: divisionColor(r.division) }]}>{r.rank || i + 1}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>
                  {r.student?.firstName} {r.student?.lastName}
                </Text>
                <Text style={styles.studentScore}>
                  Score: {r.combinedScore ?? '-'} | SP1: {r.sp1Score ?? '-'} SP2: {r.sp2Score ?? '-'}
                </Text>
              </View>
              <TouchableOpacity style={[styles.divisionBadge, { backgroundColor: divisionBg(r.division) }]}>
                <Text style={[styles.divisionText, { color: divisionColor(r.division) }]}>
                  {r.division?.replace('DIV_', 'Div ') || '—'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </>
    );
  };

  const renderMockExams = () => {
    if (loading && !refreshing) {
      return <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />;
    }
    if (mockExams.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>No Mock Exams</Text>
          <Text style={styles.emptySubtitle}>Create SP1, SP2, or Mock exams from the web dashboard to see them here.</Text>
        </View>
      );
    }

    return (
      <>
        {mockExams.map((exam) => {
          const scores = examScores[exam.id] || [];
          const avgScore = scores.length > 0
            ? (scores.reduce((s, a) => s + (a.percentage || 0), 0) / scores.length).toFixed(1)
            : '—';
          return (
            <View key={exam.id} style={styles.examCard}>
              <View style={styles.examHeader}>
                <View style={styles.examTitleRow}>
                  <Text style={styles.examTitle}>{exam.title}</Text>
                  <View style={[styles.paperBadge, {
                    backgroundColor: exam.paperType === 'SP1' ? '#F0FDF4' :
                      exam.paperType === 'SP2' ? '#EFF6FF' : '#FEFCE8',
                  }]}>
                    <Text style={[styles.paperBadgeText, {
                      color: exam.paperType === 'SP1' ? '#16A34A' :
                        exam.paperType === 'SP2' ? '#2563EB' : '#CA8A04',
                    }]}>{exam.paperType}</Text>
                  </View>
                </View>
                <Text style={styles.examSubject}>{exam.subject?.name || '—'}</Text>
                <Text style={styles.examMeta}>
                  Total: {exam.totalScore} | Avg: {avgScore}% | Attempts: {scores.length}
                </Text>
              </View>

              {scores.length > 0 && (
                <View style={styles.scoresList}>
                  {scores.slice(0, 5).map((a) => (
                    <View key={a.id} style={styles.scoreRow}>
                      <Text style={styles.scoreStudentName}>
                        {a.student?.firstName} {a.student?.lastName}
                      </Text>
                      <Text style={styles.scoreValue}>{a.score}/{a.totalScore}</Text>
                    </View>
                  ))}
                  {scores.length > 5 && (
                    <Text style={styles.moreText}>+{scores.length - 5} more</Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.enterScoreBtn}
                onPress={() => openScoreModal(exam)}
              >
                <Text style={styles.enterScoreBtnText}>
                  {scores.length > 0 ? 'Edit Scores' : 'Enter Scores'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </>
    );
  };

  const renderPredictions = () => {
    if (loading && !refreshing) {
      return <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />;
    }
    if (predictions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔮</Text>
          <Text style={styles.emptyTitle}>No Predictions</Text>
          <Text style={styles.emptySubtitle}>Compute results first to generate selection predictions based on historical cutoffs.</Text>
        </View>
      );
    }

    return (
      <>
        <View style={[styles.statsRow, { backgroundColor: '#F0FDF4', padding: 16, borderRadius: borderRadius.lg, marginBottom: 16 }]}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#16A34A', flex: 1 }}>
            Based on {predictions.length} student predictions
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>
            Conf &ge; {Math.min(...predictions.map(p => p.confidence)).toFixed(0)}%
          </Text>
        </View>

        {predictions.map((p, i) => (
          <View key={p.studentId || i} style={styles.predictionCard}>
            <View style={styles.predictionHeader}>
              <Text style={styles.predictionName}>{p.studentName}</Text>
              <View style={[styles.divisionBadge, { backgroundColor: divisionBg(p.division) }]}>
                <Text style={[styles.divisionText, { color: divisionColor(p.division) }]}>
                  {p.division?.replace('DIV_', 'Div ') || '—'}
                </Text>
              </View>
            </View>
            <Text style={styles.predictionScore}>Score: {p.combinedScore} | Confidence: {p.confidence.toFixed(0)}%</Text>
            {p.predictedSchool && (
              <Text style={styles.predictedSchool}>Predicted: {p.predictedSchool} — {p.predictedProgram || ''}</Text>
            )}
            {p.cutoffScore && (
              <Text style={styles.cutoffText}>Cutoff: {p.cutoffScore}</Text>
            )}
          </View>
        ))}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Grade 7 ECZ" onToggleDrawer={onToggleDrawer} />

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'mocks' && renderMockExams()}
        {activeTab === 'predictions' && renderPredictions()}
      </ScrollView>

      <Modal visible={scoreModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedExam?.title || 'Enter Scores'}
              </Text>
              <TouchableOpacity onPress={() => setScoreModal(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedExam && (examScores[selectedExam.id]?.length > 0 ? (
                examScores[selectedExam.id].map((attempt) => (
                  <View key={attempt.id} style={styles.modalScoreRow}>
                    <Text style={styles.modalStudentName}>
                      {attempt.student?.firstName} {attempt.student?.lastName}
                    </Text>
                    <TextInput
                      style={styles.scoreInput}
                      keyboardType="numeric"
                      value={scoreInputs[attempt.studentId] ?? ''}
                      onChangeText={(v) => setScoreInputs((prev) => ({ ...prev, [attempt.studentId]: v }))}
                      placeholder="Score"
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity
                      style={styles.singleSubmitBtn}
                      onPress={() => handleEnterScore(attempt.studentId, scoreInputs[attempt.studentId] || '')}
                      disabled={modalLoading}
                    >
                      <Text style={styles.singleSubmitBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No students loaded. Enter scores from the web dashboard.</Text>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.bulkSubmitBtn, modalLoading && { opacity: 0.6 }]}
                onPress={handleBulkSubmit}
                disabled={modalLoading}
              >
                {modalLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.bulkSubmitBtnText}>Submit All Scores</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  activeTabText: { color: colors.primary, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  loader: { marginTop: 60 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  computeBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: borderRadius.md },
  computeBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, padding: 16, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  divisionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  divisionCard: { flex: 1, minWidth: 70, padding: 12, borderRadius: borderRadius.md, alignItems: 'center' },
  divisionCount: { fontSize: 22, fontWeight: '700' },
  divisionLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  divisionPct: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: borderRadius.md, marginBottom: 6, borderWidth: 1, borderColor: '#F3F4F6' },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankText: { fontSize: 14, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  studentScore: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  divisionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm },
  divisionText: { fontSize: 11, fontWeight: '700' },
  examCard: { backgroundColor: '#FFFFFF', borderRadius: borderRadius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  examHeader: { marginBottom: 12 },
  examTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  examTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  paperBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  paperBadgeText: { fontSize: 11, fontWeight: '700' },
  examSubject: { fontSize: 13, color: '#4B5563', marginBottom: 2 },
  examMeta: { fontSize: 12, color: '#6B7280' },
  scoresList: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8, marginBottom: 12 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  scoreStudentName: { fontSize: 13, color: '#374151' },
  scoreValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  moreText: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 4 },
  enterScoreBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 10, alignItems: 'center' },
  enterScoreBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  predictionCard: { backgroundColor: '#FFFFFF', borderRadius: borderRadius.lg, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  predictionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  predictionName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  predictionScore: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  predictedSchool: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  cutoffText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 20, paddingHorizontal: 20, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', flex: 1 },
  modalClose: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  modalBody: { padding: spacing.lg, maxHeight: 400 },
  modalScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  modalStudentName: { flex: 1, fontSize: 14, color: '#374151' },
  scoreInput: { width: 80, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: borderRadius.sm, padding: 8, fontSize: 14, color: '#1F2937', textAlign: 'center' },
  singleSubmitBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.sm },
  singleSubmitBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  modalFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  bulkSubmitBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: borderRadius.md, alignItems: 'center' },
  bulkSubmitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
