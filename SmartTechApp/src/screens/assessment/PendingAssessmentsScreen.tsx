import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Loading, Card } from '../../components';
import { colors, spacing, shadows, typography } from '../../theme';
import { useAssessmentStore } from '../../store/assessment-store';

interface PendingAssessment {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  termName: string;
  assessmentDefId: string;
  assessmentName: string;
  totalStudents: number;
  enteredCount: number;
  pendingCount: number;
  completionPercent: number;
}

export const PendingAssessmentsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { pendingAssessments, loading, fetchPendingAssessments } = useAssessmentStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPendingAssessments();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingAssessments();
    setRefreshing(false);
  };

  const handleOpenEntry = (item: PendingAssessment) => {
    navigation.navigate('AssessmentEntry', {
      classId: item.classId,
      className: item.className,
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      termId: item.termId,
      termName: item.termName,
    });
  };

  const handleOpenConfig = (item: PendingAssessment) => {
    navigation.navigate('AssessmentConfig', {
      classId: item.classId,
      subjectId: item.subjectId,
      termId: item.termId,
    });
  };

  const getProgressColor = (percent: number): string => {
    if (percent >= 80) return colors.success;
    if (percent >= 50) return colors.warning;
    return colors.error;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Pending Assessments</Text>
          <Text style={styles.headerSubtitle}>
            {pendingAssessments.length} assessments to complete
          </Text>
        </View>
      </View>

      {loading && pendingAssessments.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Loading size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
        >
          {pendingAssessments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptyText}>
                No pending assessments. Great job!
              </Text>
            </View>
          ) : (
            pendingAssessments.map((item, index) => (
              <Card key={index} style={styles.assessmentCard} variant="outlined">
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.className}>{item.className}</Text>
                    <Text style={styles.subjectName}>{item.subjectName}</Text>
                  </View>
                  <View style={styles.termBadge}>
                    <Text style={styles.termBadgeText}>{item.termName}</Text>
                  </View>
                </View>

                <View style={styles.assessmentRow}>
                  <Text style={styles.assessmentLabel}>Assessment:</Text>
                  <Text style={styles.assessmentName}>{item.assessmentName}</Text>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressInfo}>
                    <Text style={styles.progressText}>
                      {item.enteredCount}/{item.totalStudents} entered
                    </Text>
                    <Text style={[styles.progressPercent, { color: getProgressColor(item.completionPercent) }]}>
                      {item.completionPercent}%
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${item.completionPercent}%`,
                          backgroundColor: getProgressColor(item.completionPercent),
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.configButton}
                    onPress={() => handleOpenConfig(item)}
                  >
                    <Text style={styles.configButtonText}>⚙ Config</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.entryButton,
                      item.completionPercent >= 100 && styles.entryButtonComplete,
                    ]}
                    onPress={() => handleOpenEntry(item)}
                  >
                    <Text style={styles.entryButtonText}>
                      {item.completionPercent >= 100 ? '✓ Complete' : 'Enter Scores'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    color: colors.success,
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
  assessmentCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitleContainer: {
    flex: 1,
  },
  className: {
    ...typography.h4,
    color: colors.text,
  },
  subjectName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  termBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  termBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  assessmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  assessmentLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginRight: spacing.xs,
  },
  assessmentName: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '500',
  },
  progressContainer: {
    marginBottom: spacing.md,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  progressPercent: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  configButton: {
    flex: 1,
    backgroundColor: colors.borderLight,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  configButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  entryButton: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  entryButtonComplete: {
    backgroundColor: colors.success,
  },
  entryButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  bottomPadding: {
    height: 100,
  },
});
