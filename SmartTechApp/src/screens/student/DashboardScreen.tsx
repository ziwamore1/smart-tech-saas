import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Loading } from '../../components';
import { colors, spacing, typography, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';

export const StudentDashboardScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [intelligence, setIntelligence] = useState<any>(null);

  useEffect(() => {
    fetchDashboard();
    if (user?.id) {
      apiService.getMobileIntelligenceSummary(user.id).then(r => setIntelligence(r?.data || r)).catch(() => {});
    }
  }, []);

  if (isLoadingDashboard && !dashboard) return <Loading fullScreen message="Loading dashboard..." />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.firstName}</Text>
          <Text style={styles.subtitle}>{dashboard?.currentTerm?.name || 'No active term'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('SProfile')} style={styles.avatarSmall}>
          <Text style={styles.avatarText}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.statValue, { color: '#3b82f6' }]}>{intelligence?.studentStats?.average || '-'}</Text>
            <Text style={styles.statLabel}>Average</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>{intelligence?.studentStats?.grade || '-'}</Text>
            <Text style={styles.statLabel}>Grade</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>#{intelligence?.studentStats?.rank || '-'}</Text>
            <Text style={styles.statLabel}>Rank</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#f3e8ff' }]}>
            <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{dashboard?.stats?.attendanceRate || 0}%</Text>
            <Text style={styles.statLabel}>Attendance</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {[
            { name: 'Results', icon: '📝', screen: 'SResults', color: '#3b82f6' },
            { name: 'Timetable', icon: '📅', screen: 'STimetable', color: '#10b981' },
            { name: 'Attendance', icon: '✅', screen: 'SAttendance', color: '#f59e0b' },
            { name: 'AI Tutor', icon: '🤖', screen: 'AiTutor', color: '#14b8a6' },
            { name: 'My Style', icon: '🧠', screen: 'LearningStyle', color: '#8b5cf6' },
            { name: 'Analytics', icon: '📊', screen: 'Analytics', color: '#ec4899' },
          ].map((action) => (
            <TouchableOpacity key={action.name} style={styles.actionCard} onPress={() => navigation.navigate(action.screen)}>
              <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                <Text style={{ fontSize: 24 }}>{action.icon}</Text>
              </View>
              <Text style={styles.actionName}>{action.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {intelligence?.learningStyle && (
          <Card style={styles.insightCard}>
            <Text style={styles.sectionTitle}>Learning Style</Text>
            <Text style={styles.insightText}>
              Your dominant style is <Text style={{ fontWeight: '700', color: colors.secondary }}>{intelligence.learningStyle.dominantStyle}</Text>
            </Text>
            <View style={styles.barRow}>
              {['visual', 'aural', 'readWrite', 'kinesthetic'].map((key) => (
                <View key={key} style={styles.barContainer}>
                  <Text style={styles.barLabel}>{key === 'readWrite' ? 'R/W' : key.slice(0, 2)}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${(intelligence.learningStyle[key] / 8) * 100}%`, backgroundColor: key === 'visual' ? '#3b82f6' : key === 'aural' ? '#10b981' : key === 'readWrite' ? '#8b5cf6' : '#f59e0b' }]} />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {dashboard?.recentAnnouncements && dashboard.recentAnnouncements.length > 0 && (
          <Card style={styles.announcementCard}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            {dashboard.recentAnnouncements.slice(0, 3).map((a: any) => (
              <View key={a.id} style={styles.announcementItem}>
                <Text style={styles.announcementTitle}>{a.title}</Text>
                <Text style={styles.announcementDate}>{new Date(a.createdAt).toLocaleDateString()}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  avatarSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  actionCard: { width: '31%', backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  actionIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  actionName: { fontSize: 12, fontWeight: '500', color: colors.text },
  insightCard: { marginBottom: spacing.md },
  insightText: { fontSize: 14, color: colors.text, marginBottom: spacing.md },
  barRow: { gap: spacing.sm },
  barContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 32, fontSize: 11, fontWeight: '600', color: colors.textLight },
  barBg: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4 },
  barFill: { height: 8, borderRadius: 4 },
  announcementCard: { marginBottom: spacing.md },
  announcementItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  announcementTitle: { fontSize: 14, fontWeight: '500', color: colors.text },
  announcementDate: { fontSize: 12, color: colors.textLight, marginTop: 2 },
});
