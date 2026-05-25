import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Loading, Card } from '../../components';
import { colors, spacing, shadows, typography } from '../../theme';
import { useAuthStore } from '../../store';
import { useAssessmentStore, AssessmentResult } from '../../store/assessment-store';
import { apiService } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StudentScoreEntry {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  rawScore: string;
  remarks: string;
  existing: boolean;
}

export const AssessmentEntryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const {
    configurations,
    results,
    loading,
    fetchConfigurations,
    fetchResults,
    submitScore,
    submitBulkScores,
  } = useAssessmentStore();

  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [entries, setEntries] = useState<StudentScoreEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});

  const config = configurations.find(c => c.assessmentDefId === selectedConfig);
  const maxScore = config?.maxScore || 100;

  useFocusEffect(
    useCallback(() => {
      const routeParams = navigation.getState()?.routes?.[navigation.getState().routes.length - 1]?.params as any;
      if (routeParams?.classId && routeParams?.subjectId && routeParams?.termId) {
        fetchConfigurations(routeParams.classId, routeParams.subjectId, routeParams.termId);
        fetchResults(routeParams.classId, routeParams.subjectId, routeParams.termId);
      }
    }, [])
  );

  useEffect(() => {
    if (results.length > 0 && selectedConfig) {
      const routeParams = navigation.getState()?.routes?.[navigation.getState().routes.length - 1]?.params as any;
      const students = routeParams?.students || [];

      const studentEntries: StudentScoreEntry[] = students.map((student: any) => {
        const existingResult = results.find(
          r => r.studentId === student.id && r.assessmentDefId === selectedConfig
        );
        return {
          studentId: student.id,
          firstName: student.firstName || '',
          lastName: student.lastName || '',
          admissionNumber: student.admissionNumber || '',
          rawScore: existingResult?.rawScore?.toString() || '',
          remarks: existingResult?.remarks || '',
          existing: !!existingResult,
        };
      });

      setEntries(studentEntries);
    }
  }, [results, selectedConfig]);

  const computeGrade = (percentage: number): string => {
    if (percentage >= 75) return '1';
    if (percentage >= 70) return '2';
    if (percentage >= 65) return '3';
    if (percentage >= 60) return '4';
    if (percentage >= 55) return '5';
    if (percentage >= 50) return '6';
    if (percentage >= 45) return '7';
    if (percentage >= 40) return '8';
    return '9';
  };

  const computeRemark = (percentage: number): string => {
    if (percentage >= 75) return 'Distinction';
    if (percentage >= 65) return 'Merit';
    if (percentage >= 55) return 'Credit';
    if (percentage >= 45) return 'Satisfactory';
    return 'Unsatisfactory';
  };

  const updateScore = (index: number, value: string) => {
    setEntries(prev => {
      const updated = [...prev];
      const entry = { ...updated[index] };

      if (value === '') {
        entry.rawScore = '';
      } else {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0 && num <= maxScore) {
          entry.rawScore = value;
        }
      }

      updated[index] = entry;
      return updated;
    });
  };

  const updateRemarks = (index: number, value: string) => {
    setEntries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], remarks: value };
      return updated;
    });
  };

  const handleSave = async () => {
    const routeParams = navigation.getState()?.routes?.[navigation.getState().routes.length - 1]?.params as any;
    if (!routeParams?.classId || !routeParams?.subjectId || !routeParams?.termId || !selectedConfig) {
      Alert.alert('Error', 'Please select an assessment type');
      return;
    }

    const scores = entries
      .filter(e => e.rawScore !== '')
      .map(e => ({
        studentId: e.studentId,
        rawScore: parseFloat(e.rawScore),
        remarks: e.remarks || undefined,
      }));

    if (scores.length === 0) {
      Alert.alert('No Scores', 'Please enter at least one score');
      return;
    }

    setSaving(true);

    try {
      await submitBulkScores({
        classId: routeParams.classId,
        subjectId: routeParams.subjectId,
        termId: routeParams.termId,
        assessmentDefId: selectedConfig,
        maxScore,
        scores,
      });

      setSavedCount(scores.length);
      Alert.alert('Success', `${scores.length} scores saved successfully`);

      fetchResults(routeParams.classId, routeParams.subjectId, routeParams.termId);
    } catch (error: any) {
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        const queueItem = {
          operationType: 'BATCH_CREATE',
          entityType: 'ASSESSMENT_RESULT',
          payload: {
            schoolId: user?.schoolId,
            classId: routeParams.classId,
            subjectId: routeParams.subjectId,
            termId: routeParams.termId,
            assessmentDefId: selectedConfig,
            maxScore,
            scores,
            enteredBy: user?.id,
          },
          priority: 1,
        };

        const existingQueue = JSON.parse(await AsyncStorage.getItem('sync_queue') || '[]');
        existingQueue.push(queueItem);
        await AsyncStorage.setItem('sync_queue', JSON.stringify(existingQueue));

        setOfflineQueue(prev => [...prev, queueItem]);
        Alert.alert('Saved Offline', 'Scores saved locally. Will sync when online.');
      } else {
        Alert.alert('Error', error.message || 'Failed to save scores');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleNextStudent = (currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < entries.length) {
      const nextEntry = entries[nextIndex];
      const ref = inputRefs.current[`${nextEntry.studentId}-score`];
      if (ref) {
        setTimeout(() => ref.focus(), 100);
      }
    }
  };

  const enteredCount = entries.filter(e => e.rawScore !== '').length;
  const totalCount = entries.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Score Entry</Text>
          <Text style={styles.headerSubtitle}>
            {config?.assessmentDef?.name || 'Select Assessment'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.maxScoreText}>Max: {maxScore}</Text>
        </View>
      </View>

      {configurations.length > 0 && (
        <View style={styles.configSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.configScroll}>
            {configurations.map(c => (
              <TouchableOpacity
                key={c.assessmentDefId}
                style={[
                  styles.configChip,
                  selectedConfig === c.assessmentDefId && styles.configChipActive,
                ]}
                onPress={() => setSelectedConfig(c.assessmentDefId)}
              >
                <Text
                  style={[
                    styles.configChipText,
                    selectedConfig === c.assessmentDefId && styles.configChipTextActive,
                  ]}
                >
                  {c.assessmentDef?.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {selectedConfig && (
        <View style={styles.statsBar}>
          <Text style={styles.statText}>
            <Text style={styles.statValue}>{enteredCount}</Text>/{totalCount} entered
          </Text>
          {savedCount > 0 && (
            <Text style={styles.savedText}>✓ {savedCount} saved</Text>
          )}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving || enteredCount === 0}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : `Save (${enteredCount})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <Loading size="large" color={colors.primary} />
        </View>
      ) : selectedConfig ? (
        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          extraHeight={100}
        >
          {entries.map((entry, index) => {
            const scoreNum = entry.rawScore ? parseFloat(entry.rawScore) : null;
            const percentage = scoreNum !== null ? (scoreNum / maxScore) * 100 : null;
            const grade = percentage !== null ? computeGrade(percentage) : null;
            const remark = percentage !== null ? computeRemark(percentage) : null;

            return (
              <Card key={entry.studentId} style={styles.studentCard} variant="outlined">
                <View style={styles.studentHeader}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {entry.firstName} {entry.lastName}
                    </Text>
                    <Text style={styles.studentAdm}>{entry.admissionNumber}</Text>
                  </View>
                  {entry.existing && (
                    <View style={styles.existingBadge}>
                      <Text style={styles.existingBadgeText}>Updated</Text>
                    </View>
                  )}
                </View>

                <View style={styles.scoreRow}>
                  <View style={styles.scoreInputContainer}>
                    <Text style={styles.scoreLabel}>Score</Text>
                    <TextInput
                      ref={ref => { inputRefs.current[`${entry.studentId}-score`] = ref; }}
                      style={styles.scoreInput}
                      value={entry.rawScore}
                      onChangeText={value => updateScore(index, value)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      onSubmitEditing={() => handleNextStudent(index)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                    />
                  </View>

                  {percentage !== null && (
                    <View style={styles.resultContainer}>
                      <View style={styles.resultItem}>
                        <Text style={styles.resultLabel}>%</Text>
                        <Text style={styles.resultValue}>{percentage.toFixed(1)}</Text>
                      </View>
                      <View style={styles.resultItem}>
                        <Text style={styles.resultLabel}>Grade</Text>
                        <Text style={[styles.resultValue, styles.gradeText]}>{grade}</Text>
                      </View>
                      <View style={styles.resultItem}>
                        <Text style={styles.resultLabel}>Remark</Text>
                        <Text style={[styles.resultValue, styles.remarkText]} numberOfLines={1}>
                          {remark}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <TextInput
                  ref={ref => { inputRefs.current[`${entry.studentId}-remarks`] = ref; }}
                  style={styles.remarksInput}
                  value={entry.remarks}
                  onChangeText={value => updateRemarks(index, value)}
                  placeholder="Remarks (optional)"
                  placeholderTextColor={colors.textMuted}
                />
              </Card>
            );
          })}

          <View style={styles.bottomPadding} />
        </KeyboardAwareScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>Select Assessment Type</Text>
          <Text style={styles.emptyText}>
            Choose an assessment type above to begin entering scores
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    ...shadows.header,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: colors.primary,
  },
  headerCenter: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textLight,
  },
  headerRight: {
    paddingHorizontal: spacing.sm,
  },
  maxScoreText: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '600',
  },
  configSelector: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  configScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  configChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
    marginRight: spacing.sm,
  },
  configChipActive: {
    backgroundColor: colors.primary,
  },
  configChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  configChipTextActive: {
    color: colors.white,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  statValue: {
    fontWeight: '700',
    color: colors.primary,
  },
  savedText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  studentCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  studentAdm: {
    ...typography.captionSmall,
    color: colors.textMuted,
  },
  existingBadge: {
    backgroundColor: colors.info + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  existingBadgeText: {
    ...typography.captionSmall,
    color: colors.info,
    fontWeight: '600',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  scoreInputContainer: {
    width: 80,
  },
  scoreLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: 4,
  },
  scoreInput: {
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    paddingVertical: 8,
  },
  resultItem: {
    alignItems: 'center',
  },
  resultLabel: {
    ...typography.captionSmall,
    color: colors.textMuted,
  },
  resultValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  gradeText: {
    color: colors.primary,
    fontSize: 18,
  },
  remarkText: {
    color: colors.success,
    fontSize: 12,
  },
  remarksInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  bottomPadding: {
    height: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
});
