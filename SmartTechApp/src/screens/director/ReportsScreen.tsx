import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';

interface DirectorReportsProps {
  onToggleDrawer?: () => void;
}

export const DirectorReportsScreen: React.FC<DirectorReportsProps> = ({ onToggleDrawer }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const stats = dashboard?.stats;

  const handleShareReport = async (reportName: string) => {
    try {
      const reportContent = `SmartTech School - ${reportName}\nGenerated: ${new Date().toLocaleDateString()}\n${'='.repeat(40)}\n\nKey Metrics:\n- Average Score: ${stats?.averageScore || '—'}%\n- Attendance: ${stats?.attendanceRate || '—'}%\n- Total Students: ${stats?.totalChildren || '—'}\n- Total Classes: ${stats?.totalClasses || '—'}\n- Today's Lessons: ${stats?.todayLessons || '—'}`;
      const fileUri = FileSystem.documentDirectory + `${reportName.replace(/\s+/g, '_')}.txt`;
      await FileSystem.writeAsStringAsync(fileUri, reportContent);
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/plain',
        dialogTitle: `Share ${reportName}`,
        UTI: 'public.plain-text',
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to share report');
    }
  };

  const reportCategories = [
    {
      title: 'Academic Reports',
      icon: '📚',
      reports: [
        { name: 'Term Performance Summary', icon: '📊', description: 'Overall student performance by term' },
        { name: 'Subject Analysis', icon: '📈', description: 'Performance breakdown by subject' },
        { name: 'Grade Distribution', icon: '📋', description: 'Student grades across all classes' },
      ],
    },
    {
      title: 'Attendance Reports',
      icon: '✅',
      reports: [
        { name: 'Daily Attendance', icon: '📅', description: 'Daily attendance tracking' },
        { name: 'Monthly Summary', icon: '📆', description: 'Monthly attendance trends' },
        { name: 'Absenteeism Analysis', icon: '⚠️', description: 'Students with high absence rates' },
      ],
    },
    {
      title: 'Staff Reports',
      icon: '👨‍🏫',
      reports: [
        { name: 'Teacher Performance', icon: '📊', description: 'Teacher effectiveness metrics' },
        { name: 'Staff Attendance', icon: '📅', description: 'Staff attendance records' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Reports"
        subtitle="School analytics & insights"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GradientCard
          title="Key Metrics"
          subtitle="Current term overview"
          icon="📊"
          gradient={['#EFF6FF', '#DBEAFE']}
          style={styles.metricsCard}
        >
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{stats?.averageScore ? `${stats.averageScore}%` : '—'}</Text>
              <Text style={styles.metricLabel}>Avg Score</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{stats?.attendanceRate ? `${stats.attendanceRate}%` : '—'}</Text>
              <Text style={styles.metricLabel}>Attendance</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{stats?.totalChildren || 0}</Text>
              <Text style={styles.metricLabel}>Students</Text>
            </View>
          </View>
        </GradientCard>

        <WidgetCard title="Performance Overview">
          {stats ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, paddingVertical: spacing.md }}>
              {[
                { label: 'Avg Score', value: Math.min(stats.averageScore || 0, 100), color: colors.success },
                { label: 'Attendance', value: Math.min(stats.attendanceRate || 0, 100), color: colors.primaryLight },
                { label: 'Classes', value: Math.min((stats.totalClasses || 0) * 10, 100), color: colors.purple },
              ].map((bar) => (
                <View key={bar.label} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: bar.color, marginBottom: 4 }}>{stats.averageScore ? `${bar.value}%` : '—'}</Text>
                  <View style={{ width: 40, height: Math.max(bar.value * 1.4, 10), backgroundColor: bar.color, borderRadius: 4, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
                  <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 6 }}>{bar.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: colors.textLight, paddingVertical: 20 }}>
              Performance data will appear once the school has registered data.
            </Text>
          )}
        </WidgetCard>

        {reportCategories.map((category, idx) => (
          <WidgetCard key={idx} title={`${category.icon} ${category.title}`}>
            {category.reports.map((report, rIdx) => (
              <TouchableOpacity key={rIdx} style={styles.reportItem} onPress={() => handleShareReport(report.name)}>
                <View style={styles.reportIcon}>
                  <Text>{report.icon}</Text>
                </View>
                <View style={styles.reportInfo}>
                  <Text style={styles.reportName}>{report.name}</Text>
                  <Text style={styles.reportDesc}>{report.description}</Text>
                </View>
                <Text style={styles.shareIcon}>📤</Text>
              </TouchableOpacity>
            ))}
          </WidgetCard>
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  metricsCard: { marginBottom: spacing.lg },
  metricsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.md },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 24, fontWeight: '700', color: colors.primary },
  metricLabel: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  metricDivider: { width: 1, height: 40, backgroundColor: colors.border },
  reportItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reportIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  reportInfo: { flex: 1 },
  reportName: { fontSize: 15, fontWeight: '600', color: colors.text },
  reportDesc: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  shareIcon: { fontSize: 18 },
});
