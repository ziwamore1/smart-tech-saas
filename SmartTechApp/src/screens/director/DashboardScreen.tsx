import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, QuickActionItem, WidgetCard, GradientCard } from '../../components';
import { colors, spacing } from '../../theme';
import { useAuthStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';

interface DirectorDashboardProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const DirectorDashboardScreen: React.FC<DirectorDashboardProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [signature, setSignature] = useState<any>(null);
  const [directorStats, setDirectorStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isPrimarySchool = user?.institutionType === 'PRIMARY_SCHOOL';

  const loadDirectorData = useCallback(async () => {
    try {
      const data = await apiService.getDirectorDashboard();
      setDirectorStats(data);
    } catch (err) {
      console.error('Failed to load director dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDirectorData(); }, [loadDirectorData]);

  useEffect(() => {
    const loadSignature = async () => {
      try {
        const res = await apiService.getSignatures();
        const sigs = Array.isArray(res) ? res : res?.data || [];
        const defaultSig = sigs.find((s: any) => s.isDefault) || sigs[0];
        setSignature(defaultSig || null);
      } catch { /* no signatures yet */ }
    };
    loadSignature();
  }, []);

  const stats = directorStats ? {
    totalClasses: directorStats.totalClasses ?? 0,
    totalChildren: directorStats.totalStudents ?? 0,
    totalTeachers: directorStats.totalTeachers ?? 0,
    todayLessons: 0,
    averageScore: directorStats.averageScore,
    attendanceRate: directorStats.attendanceRate,
  } : null;

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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDirectorData();
    setRefreshing(false);
  };

  const drawerScreens = ['DirectorReports', 'DirectorStaff', 'DirectorSettings', 'DirectorProfile', 'DirectorHome', 'DirectorClasses', 'DirectorStudents', 'DirectorLibrary', 'DirectorTimetable', 'DirectorCommunication', 'DirectorECE', 'DirectorPrimaryGrading', 'DirectorGrade7'];

  const handleNavigate = (screen: string, params?: any) => {
    if (drawerScreens.includes(screen)) {
      if (onNavigate) onNavigate(screen);
    } else if (stackNavigation) {
      stackNavigation.navigate(screen as never, params as never);
    } else {
      navigation.navigate(screen as never, params as never);
    }
  };

  const primaryActions = [
    { icon: '🎓', label: 'Grade 7 ECZ', screen: 'DirectorGrade7', gradient: ['#7C3AED', '#A78BFA'] as const },
    { icon: '🧸', label: 'ECE Module', screen: 'DirectorECE', gradient: ['#EC4899', '#F472B6'] as const },
    { icon: '📊', label: 'Primary Grading', screen: 'DirectorPrimaryGrading', gradient: ['#F59E0B', '#FBBF24'] as const },
    { icon: '👶', label: 'Pre Intake', screen: 'DirectorStudents', gradient: ['#10B981', '#34D399'] as const, params: { filter: 'pre-school' } },
  ];

  const quickActions = [
    ...(isPrimarySchool ? primaryActions : []),
    { icon: '📋', label: 'Exams', screen: 'ExamList', gradient: ['#1E3A8A', '#3B82F6'] as const },
    { icon: '📄', label: 'Templates', screen: 'TemplateMarketplace', gradient: ['#0D9488', '#14B8A6'] as const },
    { icon: '📊', label: 'Analytics', screen: 'Analytics', gradient: ['#7C3AED', '#A78BFA'] as const },
    { icon: '🤖', label: 'AI Tutor', screen: 'AiTutor', gradient: ['#D97706', '#F59E0B'] as const, params: { sourceScreen: 'director_dashboard' } },
    { icon: '📝', label: 'Reports', screen: 'DirectorReports', gradient: ['#EA580C', '#F97316'] as const },
    { icon: '👥', label: 'Staff', screen: 'DirectorStaff', gradient: ['#0D9488', '#5EEAD4'] as const },
    { icon: '🔑', label: 'Settings', screen: 'DirectorSettings', gradient: ['#8B5CF6', '#A78BFA'] as const },
    { icon: '✍️', label: 'My Signature', screen: 'DigitalStamps', gradient: ['#059669', '#34D399'] as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title={user?.firstName ? `Hello, ${user.firstName}` : 'Dashboard'}
        subtitle="Director Dashboard"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <View style={styles.statsRow}>
          <StatCard label="Classes" value={stats?.totalClasses || 0} icon="🏫" color={colors.primaryLight} bgColor={colors.infoLight} />
          <StatCard label="Students" value={stats?.totalChildren || 0} icon="👥" color={colors.success} bgColor={colors.successLight} />
          <StatCard label="Today" value={stats?.todayLessons || 0} icon="📅" color={colors.warning} bgColor={colors.warningLight} />
          <StatCard label="Staff" value={stats?.totalTeachers || 0} icon="👨‍🏫" color={colors.teal} bgColor={colors.tealLight} />
        </View>

        {stats?.pendingTasks != null && (
          <View style={styles.pendingRow}>
            <Text style={styles.pendingText}>
              {stats.pendingTasks > 0 ? `${stats.pendingTasks} pending task${stats.pendingTasks > 1 ? 's' : ''} requiring attention` : 'No pending tasks'}
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsScroll}>
          {quickActions.map((a) => (
            <QuickActionItem key={a.label} icon={a.icon} label={a.label} gradient={a.gradient as any} onPress={() => handleNavigate(a.screen, (a as any).params)} />
          ))}
        </ScrollView>

        <WidgetCard title="School Performance" action={{ label: 'View All', onPress: () => handleNavigate('DirectorReports') }}>
          <View style={styles.performanceRow}>
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>{stats?.averageScore ? `${stats.averageScore}%` : '—'}</Text>
              <Text style={styles.perfLabel}>Average Score</Text>
            </View>
            <View style={styles.perfDivider} />
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>{stats?.attendanceRate ? `${stats.attendanceRate}%` : '—'}</Text>
              <Text style={styles.perfLabel}>Attendance</Text>
            </View>
            <View style={styles.perfDivider} />
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>{stats?.totalClasses || 0}</Text>
              <Text style={styles.perfLabel}>Classes</Text>
            </View>
          </View>
        </WidgetCard>

        {signature && (
          <WidgetCard title="My Digital Signature" action={{ label: 'Manage', onPress: () => handleNavigate('DigitalStamps', { sourceScreen: 'director_dashboard' }) }}>
            <View style={styles.signatureCard}>
              {signature.imageUrl ? (
                <Image source={{ uri: signature.imageUrl }} style={styles.signatureImage} resizeMode="contain" />
              ) : signature.signatureData ? (
                <View style={styles.signatureSvgPlaceholder}>
                  <Text style={{ fontSize: 14, color: colors.textLight, fontStyle: 'italic' }}>{signature.name}</Text>
                </View>
              ) : (
                <View style={styles.signatureSvgPlaceholder}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>No signature image</Text>
                </View>
              )}
              <Text style={styles.signatureName}>{signature.name}</Text>
              {signature.title && <Text style={styles.signatureTitle}>{signature.title}</Text>}
            </View>
          </WidgetCard>
        )}

        {!signature && (
          <WidgetCard title="Digital Signature" action={{ label: 'Setup', onPress: () => handleNavigate('DigitalStamps', { sourceScreen: 'director_dashboard' }) }}>
            <TouchableOpacity style={styles.setupSignatureBtn} onPress={() => handleNavigate('DigitalStamps', { sourceScreen: 'director_dashboard' })}>
              <Text style={{ fontSize: 28, marginBottom: spacing.sm }}>✍️</Text>
              <Text style={styles.setupSignatureText}>Set Up Your Digital Signature</Text>
              <Text style={styles.setupSignatureSub}>Sign documents and certificates digitally</Text>
            </TouchableOpacity>
          </WidgetCard>
        )}

        {isPrimarySchool && (
          <>
            <WidgetCard title="Primary School Overview" action={{ label: 'Grade 7', onPress: () => handleNavigate('DirectorGrade7') }}>
              <View style={styles.primaryStatsRow}>
                <View style={styles.primaryStatItem}>
                  <Text style={styles.perfValue}>{stats?.totalChildren || 0}</Text>
                  <Text style={styles.perfLabel}>Pupils</Text>
                </View>
                <View style={styles.perfDivider} />
                <View style={styles.primaryStatItem}>
                  <Text style={styles.perfValue}>{stats?.totalClasses || 0}</Text>
                  <Text style={styles.perfLabel}>Classes</Text>
                </View>
                <View style={styles.perfDivider} />
                <View style={styles.primaryStatItem}>
                  <Text style={[styles.perfValue, { color: '#7C3AED' }]}>Gr 7</Text>
                  <Text style={styles.perfLabel}>ECZ Prep</Text>
                </View>
              </View>
            </WidgetCard>

            <WidgetCard title="Enrollment Pipeline" action={{ label: 'View All', onPress: () => handleNavigate('DirectorStudents') }}>
              <View style={styles.pipelineRow}>
                {['Pre', '1', '2', '3', '4', '5', '6', '7'].map((g) => (
                  <View key={g} style={styles.pipelineGrade}>
                    <Text style={styles.pipelineGradeLabel}>{g}</Text>
                    <Text style={styles.pipelineGradeBar}>—</Text>
                  </View>
                ))}
              </View>
            </WidgetCard>
          </>
        )}

        <GradientCard
          title="Recent Activity"
          subtitle="Latest school updates"
          icon="📢"
          gradient={['#EFF6FF', '#DBEAFE']}
          style={styles.activityCard}
        >
          {directorStats?.recentActivity && directorStats.recentActivity.length > 0 ? (
            directorStats.recentActivity.map((activity: any, i: number) => {
              const timeAgo = (() => {
                const diff = Date.now() - new Date(activity.timestamp).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 1) return 'Just now';
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                const days = Math.floor(hrs / 24);
                return `${days}d ago`;
              })();
              return (
                <View key={i} style={styles.activityRow}>
                  <View style={styles.activityIcon}>
                    <Text>{activity.icon}</Text>
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>{activity.title}</Text>
                    <Text style={styles.activityDetail} numberOfLines={1}>{activity.detail}</Text>
                    <Text style={styles.activityTime}>{timeAgo}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Text style={{ fontSize: 14, color: colors.textLight }}>No recent activity</Text>
            </View>
          )}
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
  activityDetail: { fontSize: 12, color: colors.textMuted || colors.textLight, marginTop: 1 },
  activityTime: { fontSize: 12, color: colors.textLight, marginTop: 2 },

  signatureCard: { alignItems: 'center', paddingVertical: spacing.md },
  signatureImage: { width: '100%', height: 80, marginBottom: spacing.sm },
  signatureSvgPlaceholder: { width: '100%', height: 60, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  signatureName: { fontSize: 16, fontWeight: '600', color: colors.text },
  signatureTitle: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  setupSignatureBtn: { alignItems: 'center', paddingVertical: spacing.lg, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  setupSignatureText: { fontSize: 15, fontWeight: '600', color: colors.primary, marginBottom: 4 },
  setupSignatureSub: { fontSize: 12, color: colors.textLight },
  primaryStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.md },
  primaryStatItem: { alignItems: 'center' },
  pipelineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  pipelineGrade: { alignItems: 'center', flex: 1 },
  pipelineGradeLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 4 },
  pipelineGradeBar: { fontSize: 10, color: '#D1D5DB' },
});
