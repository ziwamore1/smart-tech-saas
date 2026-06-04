import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, QuickActionItem, WidgetCard } from '../../components';
import { colors, spacing } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const StudentDashboardScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [intelligence, setIntelligence] = useState<any>(null);

  useEffect(() => {
    fetchDashboard();
    if (user?.id) {
      apiService.getMobileIntelligenceSummary(user.id).then(r => setIntelligence(r?.data || r)).catch(() => {});
    }
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

  if (isLoadingDashboard && !dashboard) return null;

  const quickActions = [
    { icon: '📝', label: 'Results', screen: 'StudentResults', gradient: ['#1E3A8A', '#3B82F6'] as const },
    { icon: '📅', label: 'Timetable', screen: 'StudentTimetable', gradient: ['#0D9488', '#14B8A6'] as const },
    { icon: '✅', label: 'Attendance', screen: 'StudentAttendance', gradient: ['#EA580C', '#F97316'] as const },
    { icon: '📋', label: 'Exams', screen: 'ExamList', gradient: ['#7C3AED', '#A78BFA'] as const },
    { icon: '🤖', label: 'AI Tutor', screen: 'AiTutor', gradient: ['#D97706', '#F59E0B'] as const, params: { sourceScreen: 'student_dashboard' } },
    { icon: '🧠', label: 'My Style', screen: 'LearningStyle', gradient: ['#8B5CF6', '#A78BFA'] as const },
    { icon: '📊', label: 'Analytics', screen: 'Analytics', gradient: ['#EC4899', '#F472B6'] as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title={user?.firstName ? `Hello, ${user.firstName}` : 'Dashboard'}
        subtitle={dashboard?.currentTerm?.name || 'No active term'}
        leftIcon={{ name: '🚪', onPress: handleLogout }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
                  <View style={[styles.barFill, { width: `${(intelligence.learningStyle[key] / 8) * 100}%` }]} />
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
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
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
