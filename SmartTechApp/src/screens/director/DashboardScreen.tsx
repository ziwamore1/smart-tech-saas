import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, QuickActionItem, WidgetCard, GradientCard } from '../../components';
import { colors, spacing } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorDashboardProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const DirectorDashboardScreen: React.FC<DirectorDashboardProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { user, logout } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => { fetchDashboard(); }, []);

  const stats = dashboard?.stats;

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

  const drawerScreens = ['DirectorReports', 'DirectorStaff', 'DirectorSettings', 'DirectorProfile', 'DirectorHome', 'DirectorClasses', 'DirectorStudents', 'DirectorLibrary', 'DirectorTimetable', 'DirectorCommunication'];

  const handleNavigate = (screen: string) => {
    if (drawerScreens.includes(screen)) {
      if (onNavigate) onNavigate(screen);
    } else if (stackNavigation) {
      stackNavigation.navigate(screen as never);
    } else {
      navigation.navigate(screen as never);
    }
  };

  const quickActions = [
    { icon: '📋', label: 'Exams', screen: 'ExamList', gradient: ['#1E3A8A', '#3B82F6'] as const },
    { icon: '📄', label: 'Templates', screen: 'TemplateMarketplace', gradient: ['#0D9488', '#14B8A6'] as const },
    { icon: '📊', label: 'Analytics', screen: 'Analytics', gradient: ['#7C3AED', '#A78BFA'] as const },
    { icon: '🤖', label: 'AI Tutor', screen: 'AiTutor', gradient: ['#D97706', '#F59E0B'] as const },
    { icon: '📝', label: 'Reports', screen: 'DirectorReports', gradient: ['#EA580C', '#F97316'] as const },
    { icon: '👥', label: 'Staff', screen: 'DirectorStaff', gradient: ['#0D9488', '#5EEAD4'] as const },
    { icon: '🔑', label: 'Settings', screen: 'DirectorSettings', gradient: ['#8B5CF6', '#A78BFA'] as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title={user?.firstName ? `Hello, ${user.firstName}` : 'Dashboard'}
        subtitle="Director Dashboard"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatCard label="Classes" value={stats?.totalClasses || 0} icon="🏫" color={colors.primaryLight} bgColor={colors.infoLight} />
          <StatCard label="Students" value={stats?.totalChildren || 0} icon="👥" color={colors.success} bgColor={colors.successLight} />
          <StatCard label="Today" value={stats?.todayLessons || 0} icon="📅" color={colors.warning} bgColor={colors.warningLight} />
          <StatCard label="Staff" value={stats?.totalClasses || 0} icon="👨‍🏫" color={colors.teal} bgColor={colors.tealLight} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsScroll}>
          {quickActions.map((a) => (
            <QuickActionItem key={a.label} icon={a.icon} label={a.label} gradient={a.gradient as any} onPress={() => handleNavigate(a.screen)} />
          ))}
        </ScrollView>

        <WidgetCard title="School Performance" action={{ label: 'View All', onPress: () => handleNavigate('DirectorReports') }}>
          <View style={styles.performanceRow}>
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>87%</Text>
              <Text style={styles.perfLabel}>Pass Rate</Text>
            </View>
            <View style={styles.perfDivider} />
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>92%</Text>
              <Text style={styles.perfLabel}>Attendance</Text>
            </View>
            <View style={styles.perfDivider} />
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>4.2</Text>
              <Text style={styles.perfLabel}>Avg Score</Text>
            </View>
          </View>
        </WidgetCard>

        <GradientCard
          title="Recent Activity"
          subtitle="Latest school updates"
          icon="📢"
          gradient={['#EFF6FF', '#DBEAFE']}
          style={styles.activityCard}
        >
          {[
            { text: 'Term 2 exams scheduled', time: '2 hours ago', icon: '📋' },
            { text: 'New staff member added', time: '1 day ago', icon: '👤' },
            { text: 'Parent meeting completed', time: '2 days ago', icon: '💬' },
          ].map((activity, i) => (
            <View key={i} style={styles.activityRow}>
              <View style={styles.activityIcon}>
                <Text>{activity.icon}</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>{activity.text}</Text>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
            </View>
          ))}
        </GradientCard>

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
  performanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.md },
  perfItem: { alignItems: 'center' },
  perfValue: { fontSize: 24, fontWeight: '700', color: colors.primary },
  perfLabel: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  perfDivider: { width: 1, height: 40, backgroundColor: colors.border },
  activityCard: { marginBottom: spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  activityIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  activityContent: { flex: 1 },
  activityText: { fontSize: 14, fontWeight: '500', color: colors.text },
  activityTime: { fontSize: 12, color: colors.textLight, marginTop: 2 },
});
