import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Loading } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const TeacherDashboardScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => { fetchDashboard(); }, []);

  if (isLoadingDashboard && !dashboard) return <Loading fullScreen message="Loading..." />;

  const stats = dashboard?.stats;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.firstName}</Text>
          <Text style={styles.subtitle}>Teacher Dashboard</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats?.totalClasses || 0}</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>{stats?.todayLessons || 0}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{dashboard?.children?.length || 0}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { name: 'Classes', icon: '🏫', screen: 'TClasses' },
            { name: 'Marks', icon: '✏️', screen: 'TMarks' },
            { name: 'AI Tutor', icon: '🤖', screen: 'AiTutor' },
            { name: 'Analytics', icon: '📊', screen: 'Analytics' },
          ].map((a) => (
            <TouchableOpacity key={a.name} style={styles.actionCard} onPress={() => navigation.navigate(a.screen)}>
              <Text style={{ fontSize: 28 }}>{a.icon}</Text>
              <Text style={styles.actionName}>{a.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionCard: { width: '48%', backgroundColor: colors.white, borderRadius: 12, padding: spacing.lg, alignItems: 'center', ...shadows.sm },
  actionName: { fontSize: 13, fontWeight: '500', color: colors.text, marginTop: spacing.sm },
});
