import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';

interface ChildSummary {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  photoUrl?: string;
  className?: string;
  levelType?: string;
  attendanceRate?: number;
  subjects?: number;
  averageScore?: number;
  performanceCategory?: { label: string; color: string };
  eczEligible?: boolean;
  division?: { division: string; label: string; color: string };
}

export const ParentPrimaryDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const { dashboard, setDashboard } = useAppStore();
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChild, setSelectedChild] = useState<ChildSummary | null>(null);

  const loadChildren = useCallback(async () => {
    try {
      const res = await apiService.getParentChildren();
      const data = Array.isArray(res) ? res : res?.data || res?.children || [];
      const enriched: ChildSummary[] = [];

      for (const c of data) {
        const child: ChildSummary = {
          id: c.id || c._id || c.student?.id,
          firstName: c.firstName || c.student?.firstName,
          lastName: c.lastName || c.student?.lastName,
          admissionNumber: c.admissionNumber || c.student?.admissionNumber,
          photoUrl: c.photoUrl || c.student?.photoUrl || null,
          className: c.class?.name || c.className,
          levelType: c.levelType || c.class?.levelType?.name,
        };

        try {
          const termId = dashboard?.currentTerm?.id;
          if (termId) {
            const results = await apiService.getParentChildResults(child.id, termId);
            const r = Array.isArray(results) ? results : results?.data || results?.results || [];
            child.subjects = r.length;
            if (r.length > 0) {
              const scores = r.filter((s: any) => s.score != null);
              child.averageScore = scores.length > 0
                ? scores.reduce((a: number, s: any) => a + (s.score || s.finalPercentage || 0), 0) / scores.length
                : undefined;
            }
          }
        } catch (_) {}

        try {
          const att = await apiService.getStudentAttendance(child.id);
          const attData = Array.isArray(att) ? att : att?.data || att?.records || [];
          const total = attData.length;
          const present = attData.filter((a: any) =>
            a.status === 'PRESENT' || a.status === 'LATE'
          ).length;
          child.attendanceRate = total > 0 ? (present / total) * 100 : undefined;
        } catch (_) {}

        enriched.push(child);
      }

      setChildren(enriched);
      if (enriched.length > 0 && !selectedChild) setSelectedChild(enriched[0]);
    } catch (e) {
      console.error('Failed to load children', e);
    } finally {
      setLoading(false);
    }
  }, [dashboard?.currentTerm?.id]);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    setRefreshing(false);
  }, [loadChildren]);

  const getAttendanceColor = (rate?: number) => {
    if (rate == null) return '#9CA3AF';
    if (rate >= 90) return '#10B981';
    if (rate >= 75) return '#3B82F6';
    if (rate >= 50) return '#F59E0B';
    return '#EF4444';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading children data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Primary Dashboard</Text>
        <Text style={styles.headerSub}>Welcome, {user?.firstName}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Child Selector */}
        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childStrip}>
            {children.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.childChip, selectedChild?.id === c.id && styles.childChipActive]}
                onPress={() => setSelectedChild(c)}
              >
                <Text style={[styles.childChipText, selectedChild?.id === c.id && styles.childChipTextActive]}>
                  {c.firstName} {c.lastName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedChild && (
          <>
            {/* Hero Card */}
            <View style={styles.heroCard}>
              {selectedChild.photoUrl ? (
                <Image source={{ uri: selectedChild.photoUrl }} style={styles.heroAvatarImg} />
              ) : (
                <View style={styles.heroAvatar}>
                  <Text style={styles.heroAvatarText}>
                    {selectedChild.firstName[0]}{selectedChild.lastName[0]}
                  </Text>
                </View>
              )}
              <Text style={styles.heroName}>{selectedChild.firstName} {selectedChild.lastName}</Text>
              <Text style={styles.heroClass}>{selectedChild.className || 'Class not set'}</Text>
              {selectedChild.levelType && (
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>{selectedChild.levelType}</Text>
                </View>
              )}
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.statValue, { color: '#4F46E5' }]}>
                  {selectedChild.subjects ?? '—'}
                </Text>
                <Text style={styles.statLabel}>Subjects</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.statValue, { color: '#16A34A' }]}>
                  {selectedChild.averageScore != null ? `${Math.round(selectedChild.averageScore)}%` : '—'}
                </Text>
                <Text style={styles.statLabel}>Avg Score</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FEFCE8' }]}>
                <Text style={[styles.statValue, { color: getAttendanceColor(selectedChild.attendanceRate) }]}>
                  {selectedChild.attendanceRate != null ? `${Math.round(selectedChild.attendanceRate)}%` : '—'}
                </Text>
                <Text style={styles.statLabel}>Attendance</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
                <View style={[styles.attCircle, { borderColor: getAttendanceColor(selectedChild.attendanceRate) }]}>
                  <Text style={[styles.attCircleText, { color: getAttendanceColor(selectedChild.attendanceRate) }]}>
                    {selectedChild.attendanceRate != null ? `${Math.round(selectedChild.attendanceRate)}%` : '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Performance Section */}
            {selectedChild.averageScore != null && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance</Text>
                <View style={styles.performanceBar}>
                  <View style={[styles.performanceFill, {
                    width: `${Math.min(selectedChild.averageScore, 100)}%`,
                    backgroundColor: selectedChild.averageScore >= 75 ? '#10B981' :
                      selectedChild.averageScore >= 50 ? '#F59E0B' : '#EF4444',
                  }]} />
                </View>
                <Text style={styles.performanceLabel}>
                  {selectedChild.averageScore >= 75 ? 'Excellent' :
                    selectedChild.averageScore >= 60 ? 'Good' :
                    selectedChild.averageScore >= 50 ? 'Average' : 'Needs Improvement'}
                </Text>
              </View>
            )}

            {/* Grade 7 Section */}
            {selectedChild.levelType?.includes('Grade 7') && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 Grade 7 ECZ Preparation</Text>
                <View style={styles.gzCard}>
                  <View style={styles.gzInfo}>
                    <Text style={styles.gzTitle}>ECZ National Examinations</Text>
                    <Text style={styles.gzDesc}>
                      {selectedChild.subjects ? `${selectedChild.subjects} subjects enrolled` : 'Track your child\'s progress'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.gzBtn} onPress={() => Alert.alert('Coming Soon', 'Detailed ECZ preparation view')}>
                    <Text style={styles.gzBtnText}>View Prep →</Text>
                  </TouchableOpacity>
                </View>
                {selectedChild.averageScore != null && (
                  <View style={styles.gzBar}>
                    <View style={[styles.gzBarFill, {
                      width: `${Math.min(selectedChild.averageScore, 100)}%`,
                      backgroundColor: selectedChild.averageScore >= 75 ? '#10B981' : selectedChild.averageScore >= 50 ? '#F59E0B' : '#EF4444',
                    }]} />
                    <Text style={styles.gzBarLabel}>Overall: {Math.round(selectedChild.averageScore)}%</Text>
                  </View>
                )}
              </View>
            )}

            {/* ECE Section */}
            {(selectedChild.levelType?.includes('Pre') || selectedChild.levelType?.includes('ECE') || selectedChild.className?.toLowerCase().includes('pre')) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🧸 Early Childhood Education</Text>
                <View style={styles.eceCard}>
                  <View style={styles.eceRow}>
                    <Text style={styles.eceIcon}>📖</Text>
                    <Text style={styles.eceText}>Language & Literacy Development</Text>
                  </View>
                  <View style={styles.eceRow}>
                    <Text style={styles.eceIcon}>🔢</Text>
                    <Text style={styles.eceText}>Early Numeracy Skills</Text>
                  </View>
                  <View style={styles.eceRow}>
                    <Text style={styles.eceIcon}>🎨</Text>
                    <Text style={styles.eceText}>Creative & Psychomotor Development</Text>
                  </View>
                  <View style={styles.eceRow}>
                    <Text style={styles.eceIcon}>🤝</Text>
                    <Text style={styles.eceText}>Social & Emotional Growth</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => navigation.navigate('ParentChildResults', {
                    childId: selectedChild.id,
                    childName: `${selectedChild.firstName} ${selectedChild.lastName}`,
                  })}
                >
                  <Text style={styles.actionIcon}>📊</Text>
                  <Text style={styles.actionLabel}>Results</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ParentAttendance')}>
                  <Text style={styles.actionIcon}>✅</Text>
                  <Text style={styles.actionLabel}>Attendance</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ParentHomework')}>
                  <Text style={styles.actionIcon}>📚</Text>
                  <Text style={styles.actionLabel}>Homework</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ParentAssessments')}>
                  <Text style={styles.actionIcon}>📋</Text>
                  <Text style={styles.actionLabel}>Assessments</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ParentAnalytics')}>
                  <Text style={styles.actionIcon}>📊</Text>
                  <Text style={styles.actionLabel}>Analytics</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textLight },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  childStrip: { maxHeight: 44, marginBottom: spacing.md },
  childChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  childChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  childChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  childChipTextActive: { color: colors.white },
  heroCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.md },
  heroAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  heroAvatarImg: { width: 64, height: 64, borderRadius: 32, marginBottom: spacing.sm },
  heroAvatarText: { color: colors.white, fontSize: 22, fontWeight: '700' },
  heroName: { fontSize: 20, fontWeight: '700', color: colors.text },
  heroClass: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  levelBadge: { marginTop: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  levelBadgeText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, flexWrap: 'wrap' },
  statCard: { padding: 14, borderRadius: borderRadius.lg, flex: 1, minWidth: '45%', alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  attCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  attCircleText: { fontSize: 13, fontWeight: '700' },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  performanceBar: { height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden' },
  performanceFill: { height: '100%', borderRadius: 5 },
  performanceLabel: { fontSize: 13, fontWeight: '600', color: colors.textLight, marginTop: 6, textAlign: 'center' },
  gzCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#FFEDD5' },
  gzIcon: { fontSize: 28, marginRight: spacing.md },
  gzInfo: { flex: 1 },
  gzTitle: { fontSize: 15, fontWeight: '700', color: '#9A3412' },
  gzDesc: { fontSize: 12, color: '#C2410C', marginTop: 2 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionCard: { flex: 1, backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center', ...shadows.sm },
  actionIcon: { fontSize: 24, marginBottom: 6 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
  gzBar: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  gzBarFill: { height: 8, borderRadius: 4, flex: 1 },
  gzBarLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  gzBtn: { backgroundColor: '#EA580C', paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.md },
  gzBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  eceCard: { backgroundColor: '#FFF7ED', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#FFEDD5' },
  eceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  eceIcon: { fontSize: 18 },
  eceText: { fontSize: 14, fontWeight: '500', color: '#9A3412' },
});
