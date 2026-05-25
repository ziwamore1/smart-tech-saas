import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, QuickActionItem, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const ClassTeacherDashboardScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboard();
    setInsights([
      '3 students show declining Mathematics performance linked to attendance irregularities.',
      'Class Science competency average improved by 12% this month.',
      '2 parents have not responded to last week\'s progress report.',
    ]);
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (err) {
              console.error('Logout failed:', err);
            }
          },
        },
      ]
    );
  };

  const stats = dashboard?.stats;

  const quickActions = [
    { icon: '📝', label: 'Grades', screen: 'TeacherMarks', gradient: ['#1E3A8A', '#3B82F6'] as const },
    { icon: '📋', label: 'Exams', screen: 'ExamList', gradient: ['#0D9488', '#14B8A6'] as const },
    { icon: '👥', label: 'Students', screen: 'CTStudents', gradient: ['#EA580C', '#F97316'] as const },
    { icon: '📊', label: 'Analytics', screen: 'CTAnalytics', gradient: ['#7C3AED', '#A78BFA'] as const },
    { icon: '💬', label: 'Messages', screen: 'CTCommunication', gradient: ['#D97706', '#F59E0B'] as const },
    { icon: '🤖', label: 'AI Tutor', screen: 'CTAiTutor', gradient: ['#0D9488', '#5EEAD4'] as const },
    { icon: '📈', label: 'Reports', screen: 'Analytics', gradient: ['#8B5CF6', '#A78BFA'] as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title={user?.firstName ? `Hello, ${user.firstName}` : 'Dashboard'}
        subtitle={`Class Teacher • ${stats?.totalClasses || 0} Classes`}
        leftIcon={{ name: '🚪', onPress: handleLogout }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatCard label="Students" value={stats?.totalChildren || 0} icon="👥" color={colors.primary} bgColor={colors.infoLight} />
          <StatCard label="Attendance" value={stats?.attendanceRate || '94%'} icon="✅" color={colors.success} bgColor={colors.successLight} />
          <StatCard label="Avg Perf" value="78%" icon="📊" color={colors.teal} bgColor={colors.tealLight} />
          <StatCard label="Alerts" value={3} icon="⚠️" color={colors.warning} bgColor={colors.warningLight} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsScroll}>
          {quickActions.map((a) => (
            <QuickActionItem key={a.label} icon={a.icon} label={a.label} gradient={a.gradient as any} onPress={() => navigation.navigate(a.screen)} />
          ))}
        </ScrollView>

        <WidgetCard title="AI Insights" action={{ label: 'View All', onPress: () => navigation.navigate('AiTutor') }}>
          {insights.map((insight, i) => (
            <View key={i} style={styles.insightRow}>
              <View style={styles.insightDot} />
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </WidgetCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Class Overview</Text>
        </View>

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
                <View style={[styles.gradeBar, { height: grade === 'A' ? 40 : grade === 'B' ? 60 : grade === 'C' ? 80 : grade === 'D' ? 45 : 20 }]} />
                <Text style={styles.gradeLabel}>{grade}</Text>
              </View>
            ))}
          </View>
        </GradientCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        {[
          { text: 'John Doe submitted homework', time: '10 min ago', icon: '📝' },
          { text: 'Attendance marked for today', time: '1 hour ago', icon: '✅' },
          { text: 'New parent message from Mary', time: '2 hours ago', icon: '💬' },
          { text: 'Sarah Johns flagged - low performance', time: '3 hours ago', icon: '⚠️' },
        ].map((activity, i) => (
          <TouchableOpacity key={i} style={styles.activityCard}>
            <View style={styles.activityIcon}>
              <Text>{activity.icon}</Text>
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>{activity.text}</Text>
              <Text style={styles.activityTime}>{activity.time}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

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
  gradeBar: { width: 28, backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm, opacity: 0.7 },
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
});
