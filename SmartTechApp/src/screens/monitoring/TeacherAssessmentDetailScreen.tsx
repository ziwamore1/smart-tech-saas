import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius } from '../../theme';
import { apiService } from '../../services/api';

type RouteParams = {
  TeacherAssessmentDetail: {
    teacherId: string;
    teacherName: string;
  };
};

export const TeacherAssessmentDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'TeacherAssessmentDetail'>>();
  const { teacherId, teacherName } = route.params;

  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const pendingRes = await apiService.getPendingAssessments();
      const all = Array.isArray(pendingRes) ? pendingRes : pendingRes?.data || pendingRes?.pending || [];
      const filtered = (Array.isArray(all) ? all : []).filter(
        (p: any) => p.teacherId === teacherId || (p.teacherName || '').includes(teacherName)
      );
      setPendingItems(filtered);
    } catch (err) {
      console.error('Failed to load teacher assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  const completed = pendingItems.filter((p: any) => (p.completionRate || 0) >= 100).length;
  const pendingCount = pendingItems.filter((p: any) => p.missingCount > 0).length;
  const avgRate = pendingItems.length > 0
    ? Math.round(pendingItems.reduce((s: number, p: any) => s + (p.completionRate || 0), 0) / pendingItems.length)
    : 0;
  const rateColor = avgRate >= 80 ? colors.success : avgRate >= 50 ? colors.warning : colors.error;
  const rateBg = avgRate >= 80 ? colors.successLight : avgRate >= 50 ? colors.warningLight : colors.errorLight;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{teacherName}</Text>
          <Text style={styles.headerSub}>Pending Assessments</Text>
        </View>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{pendingItems.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
          <Text style={[styles.statValue, { color: colors.success }]}>{completed}</Text>
          <Text style={styles.statLabel}>Complete</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: rateBg }]}>
          <Text style={[styles.statValue, { color: rateColor }]}>{avgRate}%</Text>
          <Text style={styles.statLabel}>Rate</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading assessments...</Text>
        </View>
      ) : pendingItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptyText}>No pending assessments for this teacher.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {pendingItems.map((item, i) => {
            const isComplete = (item.completionRate || 0) >= 100;
            const missingCount = item.missingCount || (item.totalStudents - item.enteredCount) || 0;
            return (
              <View key={i} style={[styles.card, isComplete && styles.cardComplete]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.assessmentName}>
                    {item.assessmentName || item.assessmentDef?.name || 'Assessment'}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: isComplete ? colors.successLight : colors.warningLight }]}>
                    <Text style={[styles.badgeText, { color: isComplete ? colors.success : colors.warning }]}>
                      {isComplete ? '✓ Done' : `${item.completionRate || 0}%`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.subjectName}>{item.subjectName || item.subject?.name}</Text>
                {item.className && <Text style={styles.className}>Class: {item.className}</Text>}
                {!isComplete && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, {
                        width: `${Math.min(item.completionRate || 0, 100)}%`,
                        backgroundColor: (item.completionRate || 0) >= 80 ? colors.success : (item.completionRate || 0) >= 50 ? colors.warning : colors.error
                      }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {missingCount} of {item.totalStudents} students missing
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, backgroundColor: colors.white,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 24, color: colors.primary },
  headerInfo: { flex: 1, marginLeft: spacing.sm },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  refreshBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  refreshBtnText: { fontSize: 22, color: colors.primary },
  statsRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  statCard: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.sm, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 10, color: colors.textLight, marginTop: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.sm, color: colors.textLight, fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center' },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  cardComplete: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  assessmentName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  badgeText: { fontSize: 11, fontWeight: '700' },
  subjectName: { fontSize: 13, color: colors.textLight, marginTop: 4 },
  className: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  progressContainer: { marginTop: spacing.sm },
  progressBarBg: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
