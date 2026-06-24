import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, QuickActionItem, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: any;
}

export const ClassTeacherDashboardScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { user } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (dashboard?.stats?.pendingTasks) {
      setInsights([
        `${dashboard.stats.pendingTasks} task${dashboard.stats.pendingTasks > 1 ? 's' : ''} require${dashboard.stats.pendingTasks > 1 ? '' : 's'} your attention.`,
      ]);
    }
  }, [dashboard]);

  const stats = dashboard?.stats;

  const quickActions = [
    { icon: '📝', label: 'Grades', screen: 'TeacherMarks', gradient: ['#1E3A8A', '#3B82F6'] as const },
    { icon: '📋', label: 'Exams', screen: 'ExamList', gradient: ['#0D9488', '#14B8A6'] as const },
    { icon: '👥', label: 'Students', screen: 'CTStudents', gradient: ['#EA580C', '#F97316'] as const },
    { icon: '📊', label: 'Analytics', screen: 'CTAnalytics', gradient: ['#7C3AED', '#A78BFA'] as const },
    { icon: '💬', label: 'Messages', screen: 'CTCommunication', gradient: ['#D97706', '#F59E0B'] as const },
    { icon: '🤖', label: 'AI Tutor', screen: 'CTAiTutor', gradient: ['#0D9488', '#5EEAD4'] as const, params: { sourceScreen: 'class_teacher_dashboard' } },
    { icon: '📈', label: 'Reports', screen: 'Analytics', gradient: ['#8B5CF6', '#A78BFA'] as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title={user?.firstName ? `Hello, ${user.firstName}` : 'Dashboard'}
        subtitle={`Class Teacher • ${stats?.totalClasses || 0} Classes`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatCard label="Students" value={stats?.totalChildren || 0} icon="👥" color={colors.primary} bgColor={colors.infoLight} />
          <StatCard label="Attendance" value={stats?.attendanceRate ? `${stats.attendanceRate}%` : '—'} icon="✅" color={colors.success} bgColor={colors.successLight} />
          <StatCard label="Avg Perf" value={stats?.averageScore ? `${stats.averageScore}%` : '—'} icon="📊" color={colors.teal} bgColor={colors.tealLight} />
          <StatCard label="Alerts" value={stats?.activeAlerts ?? stats?.weakStudents ?? 0} icon="⚠️" color={colors.warning} bgColor={colors.warningLight} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsScroll}>
          {quickActions.map((a) => (
            <QuickActionItem key={a.label} icon={a.icon} label={a.label} gradient={a.gradient as any} onPress={() => onNavigate ? onNavigate(a.screen) : navigation.navigate(a.screen, (a as any).params)} />
          ))}
        </ScrollView>

        {insights.length > 0 && (
          <WidgetCard title="AI Insights" action={{ label: 'View All', onPress: () => onNavigate ? onNavigate('AiTutor') : navigation.navigate('AiTutor', { sourceScreen: 'class_teacher_dashboard' }) }}>
            {insights.map((insight, i) => (
              <View key={i} style={styles.insightRow}>
                <View style={styles.insightDot} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </WidgetCard>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Class Overview</Text>
        </View>

        {stats?.totalClasses ? (
          <GradientCard
            title="Grade Distribution"
            subtitle="Current term performance breakdown"
            icon="📊"
            gradient={['#EFF6FF', '#DBEAFE']}
            style={styles.overviewCard}
          >
            <View style={styles.gradeRow}>
              {['A', 'B', 'C', 'D', 'F'].map((grade) => (
                <View key={grade} style={styles.gradeItem}>
                  <View style={[styles.gradeBar, { height: grade === 'A' ? 40 : grade === 'B' ? 60 : grade === 'C' ? 80 : grade === 'D' ? 45 : 20, opacity: 0.5 }]} />
                  <Text style={styles.gradeLabel}>{grade}</Text>
                </View>
              ))}
            </View>
          </GradientCard>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No class data yet</Text>
            <Text style={styles.emptySubtext}>Assign classes and students to see grade distribution here.</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        {dashboard?.recentAnnouncements?.length > 0 ? (
          dashboard.recentAnnouncements.map((activity: any, i: number) => (
            <TouchableOpacity key={i} style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <Text>📢</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>{activity.title || activity.message}</Text>
                <Text style={styles.activityTime}>{activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : ''}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📢</Text>
            <Text style={styles.emptyText}>No recent activity</Text>
            <Text style={styles.emptySubtext}>Activity feed will appear here once you interact with the system.</Text>
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  sectionTitle: { ...typography.h4 },
  quickActionsScroll: { marginBottom: spacing.lg },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryLight, marginTop: 6, marginRight: spacing.sm, flexShrink: 0 },
  insightText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, flex: 1 },
  overviewCard: { marginBottom: spacing.md },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 100, marginTop: spacing.md },
  gradeItem: { alignItems: 'center', gap: spacing.xs },
  gradeBar: { width: 28, backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm },
  gradeLabel: { fontSize: 12, fontWeight: '600', color: colors.textLight },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  activityIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  activityContent: { flex: 1 },
  activityText: { fontSize: 14, fontWeight: '500', color: colors.text, lineHeight: 18 },
  activityTime: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textLight, marginLeft: spacing.sm },
  emptyCard: { alignItems: 'center', paddingVertical: 40, backgroundColor: colors.white, borderRadius: borderRadius.lg, marginBottom: spacing.sm, ...shadows.sm },
  emptyIcon: { fontSize: 36, marginBottom: spacing.sm, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textLight },
  emptySubtext: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing.lg },
});
