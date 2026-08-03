import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, QuickActionItem, WidgetCard } from '../../components';
import { colors, spacing } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService, resolveImageUrl } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: any;
}

export const StudentDashboardScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { user } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [intelligence, setIntelligence] = useState<any>(null);
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
    if (user?.id) {
      apiService.getMobileIntelligenceSummary(user.id).then(r => setIntelligence(r?.data || r)).catch(() => {});
    }
    const photoId = user?.studentId || user?.id;
    if (photoId) {
      apiService.getStudentPhoto(photoId).then(r => {
        const url = r?.imageUrl || r?.photoUrl;
        if (url) setStudentPhoto(resolveImageUrl(url) || url);
      }).catch(() => {});
    }
  }, []);

  if (isLoadingDashboard && !dashboard) return null;

  const quickActions = [
    { icon: '📝', label: 'Results', screen: 'StudentResults', gradient: ['#1E3A8A', '#3B82F6'] as const },
    { icon: '📅', label: 'Timetable', screen: 'StudentTimetable', gradient: ['#0D9488', '#14B8A6'] as const },
    { icon: '✅', label: 'Attendance', screen: 'StudentAttendance', gradient: ['#EA580C', '#F97316'] as const },
    { icon: '📋', label: 'Exams', screen: 'ExamList', gradient: ['#7C3AED', '#A78BFA'] as const },
    { icon: '🤖', label: 'AI Tutor', screen: 'AiTutor', gradient: ['#D97706', '#F59E0B'] as const, params: { sourceScreen: 'student_dashboard' } },
    { icon: '🧠', label: 'My Style', screen: 'LearningStyle', gradient: ['#8B5CF6', '#A78BFA'] as const },
    { icon: '📊', label: 'Analytics', screen: 'Analytics', gradient: ['#EC4899', '#F472B6'] as const },
    { icon: '📚', label: 'Homework', screen: 'StudentHomework', gradient: ['#D97706', '#F59E0B'] as const },
    { icon: '📄', label: 'Report Cards', screen: 'StudentReportCards', gradient: ['#0D9488', '#14B8A6'] as const },
    { icon: '📊', label: 'Assessments', screen: 'StudentAssessments', gradient: ['#7C3AED', '#A78BFA'] as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title={user?.firstName ? `Hello, ${user.firstName}` : 'Dashboard'}
        subtitle={dashboard?.currentTerm?.name || 'No active term'}
        leftIcon={{ name: '☰', onPress: onToggleDrawer }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileRow}>
          {studentPhoto ? (
            <Image source={{ uri: studentPhoto }} style={styles.profileAvatar} />
          ) : (
            <View style={styles.profileAvatarPlaceholder}>
              <Text style={styles.profileAvatarText}>{user?.firstName?.[0] || 'S'}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.firstName} {user?.lastName}</Text>
            <Text style={styles.profileRole}>Student</Text>
          </View>
        </View>
        {dashboard?.stats?.todayStatus && (
          <View style={[styles.todayBadge, {
            backgroundColor: dashboard.stats.todayStatus === 'PRESENT' ? '#D1FAE5' : dashboard.stats.todayStatus === 'LATE' ? '#FEF3C7' : dashboard.stats.todayStatus === 'ABSENT' ? '#FEE2E2' : '#F3F4F6',
          }]}>
            <Text style={[styles.todayBadgeText, {
              color: dashboard.stats.todayStatus === 'PRESENT' ? '#065F46' : dashboard.stats.todayStatus === 'LATE' ? '#92400E' : dashboard.stats.todayStatus === 'ABSENT' ? '#991B1B' : '#374151',
            }]}>
              Today: {dashboard.stats.todayStatus === 'PRESENT' ? 'Present ✅' : dashboard.stats.todayStatus === 'LATE' ? 'Late ⏰' : dashboard.stats.todayStatus === 'ABSENT' ? 'Absent ❌' : dashboard.stats.todayStatus}
            </Text>
          </View>
        )}
        <View style={styles.statsRow}>
          <StatCard label="Average" value={intelligence?.studentStats?.average || '-'} icon="📊" color={colors.primaryLight} bgColor={colors.infoLight} />
          <StatCard label="Grade" value={intelligence?.studentStats?.grade || '-'} icon="🎯" color={colors.success} bgColor={colors.successLight} />
          <StatCard label="Rank" value={`#${intelligence?.studentStats?.rank || '-'}`} icon="🏆" color={colors.warning} bgColor={colors.warningLight} />
          <StatCard label="Attendance" value={`${dashboard?.stats?.attendanceRate || 0}%`} icon="✅" color={colors.teal} bgColor={colors.tealLight} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsScroll}>
          {quickActions.map((a) => (
            <QuickActionItem key={a.label} icon={a.icon} label={a.label} gradient={a.gradient as any} onPress={() => navigation.navigate(a.screen, (a as any).params)} />
          ))}
        </ScrollView>

        {intelligence?.learningStyle && (
          <WidgetCard title="Learning Style" action={{ label: 'Details', onPress: () => navigation.navigate('LearningStyle') }}>
            <View style={styles.insightRow}>
              <Text style={styles.insightText}>
                Your dominant style is <Text style={{ fontWeight: '700', color: colors.secondary }}>{intelligence.learningStyle.dominantStyle}</Text>
              </Text>
            </View>
            {['visual', 'aural', 'readWrite', 'kinesthetic'].map((key) => (
              <View key={key} style={styles.barRow}>
                <Text style={styles.barLabel}>{key === 'readWrite' ? 'R/W' : key.slice(0, 2)}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${Math.min(Math.max(intelligence.learningStyle[key] ?? 0, 0), 100)}%` }]} />
                </View>
              </View>
            ))}
          </WidgetCard>
        )}

        {dashboard?.recentAnnouncements && dashboard.recentAnnouncements.length > 0 && (
          <WidgetCard title="Announcements">
            {dashboard.recentAnnouncements.slice(0, 3).map((a: any) => (
              <View key={a.id} style={styles.announcementItem}>
                <Text style={styles.announcementTitle}>{a.title}</Text>
                <Text style={styles.announcementDate}>{new Date(a.createdAt).toLocaleDateString()}</Text>
              </View>
            ))}
          </WidgetCard>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: spacing.md },
  profileAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.teal, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  profileAvatarText: { fontSize: 20, fontWeight: '700', color: colors.white },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.text },
  profileRole: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  todayBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 8, marginBottom: spacing.md },
  todayBadgeText: { fontSize: 15, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  quickActionsScroll: { marginBottom: spacing.lg },
  insightRow: { marginBottom: spacing.md },
  insightText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  barLabel: { width: 30, fontSize: 11, fontWeight: '600', color: colors.textLight, textTransform: 'uppercase' },
  barBg: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4 },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.primaryLight },
  announcementItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  announcementTitle: { fontSize: 14, fontWeight: '500', color: colors.text },
  announcementDate: { fontSize: 12, color: colors.textLight, marginTop: 2 },
});
