import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, QuickActionItem, WidgetCard } from '../../components';
import { colors, spacing } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { refreshSchoolBranding } from '../../services/branding';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: any;
}

export const TeacherDashboardScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { user } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => { fetchDashboard(); }, []);
  useEffect(() => { refreshSchoolBranding().catch(() => {}); }, []);

  const stats = dashboard?.stats;
  const isHod = user?.roles?.some((r) => r === 'HOD' || r === 'HEAD_OF_DEPARTMENT');

  const quickActions = [
    { icon: '🏫', label: 'Classes', screen: 'TeacherClasses', gradient: ['#1E3A8A', '#3B82F6'] as const },
    { icon: '✏️', label: 'Marks', screen: 'TeacherMarks', gradient: ['#0D9488', '#14B8A6'] as const },
    ...(isHod ? [{ icon: '🏛️', label: 'My Department', screen: 'HODMonitoring', gradient: ['#8B5CF6', '#A78BFA'] as const }] : []),
    { icon: '📋', label: 'Exams', screen: 'ExamList', gradient: ['#EA580C', '#F97316'] as const },
    { icon: '🤖', label: 'AI Tutor', screen: 'AiTutor', gradient: ['#7C3AED', '#A78BFA'] as const, params: { sourceScreen: 'teacher_dashboard' } },
    { icon: '📊', label: 'Performance', screen: 'TeacherPerformance', gradient: ['#D97706', '#F59E0B'] as const },
    { icon: '📄', label: 'Templates', screen: 'TemplateMarketplace', gradient: ['#0D9488', '#5EEAD4'] as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title={user?.firstName ? `Hello, ${user.firstName}` : 'Dashboard'}
        subtitle="Teacher Dashboard"
        leftIcon={{ name: '☰', onPress: onToggleDrawer }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statsRow}>
          <StatCard label="Classes" value={stats?.totalClasses || 0} icon="🏫" color={colors.primaryLight} bgColor={colors.infoLight} />
          <StatCard label="Today" value={stats?.todayLessons || 0} icon="📅" color={colors.success} bgColor={colors.successLight} />
          <StatCard label="Students" value={stats?.totalStudents || 0} icon="👥" color={colors.warning} bgColor={colors.warningLight} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsScroll}>
          {quickActions.map((a) => (
            <QuickActionItem key={a.label} icon={a.icon} label={a.label} gradient={a.gradient as any} onPress={() => onNavigate ? onNavigate(a.screen) : navigation.navigate(a.screen, (a as any).params)} />
          ))}
        </ScrollView>

        <WidgetCard title="Recent Activity" action={{ label: 'View All', onPress: () => {} }}>
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Text style={{ fontSize: 14, color: colors.textLight }}>No recent activity</Text>
          </View>
        </WidgetCard>

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
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  quickActionsScroll: { marginBottom: spacing.lg },
});
