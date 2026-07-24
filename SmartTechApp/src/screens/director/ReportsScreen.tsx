import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const DirectorReportsScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [directorStats, setDirectorStats] = useState<any>(null);
  const [teacherPerf, setTeacherPerf] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClassId && selectedTermId) {
      loadAnalytics();
    }
  }, [selectedClassId, selectedTermId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const classData = await apiService.getClasses();
      const classList = Array.isArray(classData) ? classData : classData?.data || [];
      setClasses(classList);

      const yearData = await apiService.getAcademicYears();
      const years = Array.isArray(yearData) ? yearData : yearData?.data || [];
      const currentYear = years.find((y: any) => y.isCurrent) || years[0];
      if (currentYear) {
        const termData = await apiService.getTerms(currentYear.id);
        const termList = Array.isArray(termData) ? termData : termData?.data || [];
        setTerms(termList);
        const currentTerm = termList.find((t: any) => t.isCurrent) || termList[0];
        if (currentTerm) setSelectedTermId(currentTerm.id);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!selectedTermId) return;
    try {
      const [stats, tp] = await Promise.allSettled([
        apiService.getDirectorDashboardStats(selectedClassId || undefined, selectedTermId),
        apiService.getTeacherPerformance(selectedTermId),
      ]);
      if (stats.status === 'fulfilled') setDirectorStats(stats.value);
      if (tp.status === 'fulfilled') {
        const data = tp.value;
        setTeacherPerf(Array.isArray(data) ? data : data?.data || data?.teachers || []);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  }, [selectedClassId, selectedTermId]);

  const handleDownloadPdf = async (type: string, label: string) => {
    if (!selectedClassId || !selectedTermId) {
      Alert.alert('Select Class & Term', 'Please select both a class and term first.');
      return;
    }
    setGenerating(type);
    try {
      let blob: Blob;
      let filename: string;
      if (type === 'class-report') {
        blob = await apiService.getClassReportCardsPdf(selectedClassId, selectedTermId) as Blob;
        filename = `class-report-cards-${selectedClassId}.pdf`;
      } else if (type === 'student-report') {
        Alert.alert('Individual Report', 'Select a student from the Students screen to download their individual report card.');
        setGenerating(null);
        return;
      } else if (type === 'transcript') {
        Alert.alert('Transcript', 'Select a student from the Students screen to download their transcript.');
        setGenerating(null);
        return;
      } else {
        setGenerating(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, base64.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: `Download ${label}` });
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Error', `Failed to generate ${label}. Make sure results are published.`);
      }
    } finally {
      setGenerating(null);
    }
  };

  const reportTypes = [
    {
      id: 'class-report',
      title: 'Class Report Cards',
      icon: '📄',
      description: 'Download all report cards for the selected class as a PDF',
      color: colors.primary,
    },
    {
      id: 'student-report',
      title: 'Individual Report Card',
      icon: '👨‍🎓',
      description: 'Download a single student\'s enhanced report card',
      color: colors.success,
    },
    {
      id: 'transcript',
      title: 'Student Transcript',
      icon: '📜',
      description: 'Download a student\'s full academic transcript',
      color: colors.purple,
    },
  ];

  const avg = directorStats?.averageScore ?? directorStats?.average ?? 0;
  const attendance = directorStats?.attendanceRate ?? directorStats?.attendance ?? 0;
  const totalStudents = directorStats?.totalStudents ?? directorStats?.totalChildren ?? 0;
  const passRate = directorStats?.passRate ?? directorStats?.passPercentage ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Reports"
        subtitle="Generate & download school reports"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Class & Term Selectors */}
        <View style={styles.selectorsRow}>
          <View style={styles.selectorContainer}>
            <Text style={styles.selectorLabel}>CLASS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.chip, selectedClassId === cls.id && styles.chipActive]}
                  onPress={() => setSelectedClassId(cls.id)}
                >
                  <Text style={[styles.chipText, selectedClassId === cls.id && styles.chipTextActive]}>{cls.name}</Text>
                </TouchableOpacity>
              ))}
              {classes.length === 0 && <Text style={styles.noDataText}>No classes</Text>}
            </ScrollView>
          </View>
          <View style={styles.selectorContainer}>
            <Text style={styles.selectorLabel}>TERM</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {terms.map((term) => (
                <TouchableOpacity
                  key={term.id}
                  style={[styles.chip, selectedTermId === term.id && styles.chipActive]}
                  onPress={() => setSelectedTermId(term.id)}
                >
                  <Text style={[styles.chipText, selectedTermId === term.id && styles.chipTextActive]}>{term.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Key Metrics */}
        {directorStats && (
          <GradientCard title="School Overview" subtitle="Current term metrics" icon="📊" gradient={['#EFF6FF', '#DBEAFE']} style={styles.metricsCard}>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: colors.primary }]}>{totalStudents || 0}</Text>
                <Text style={styles.metricLabel}>Students</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: colors.success }]}>{avg ? `${Number(avg).toFixed(1)}%` : '—'}</Text>
                <Text style={styles.metricLabel}>Avg Score</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: colors.purple }]}>{attendance ? `${Number(attendance).toFixed(1)}%` : '—'}</Text>
                <Text style={styles.metricLabel}>Attendance</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: colors.accent }]}>{passRate ? `${Number(passRate).toFixed(1)}%` : '—'}</Text>
                <Text style={styles.metricLabel}>Pass Rate</Text>
              </View>
            </View>
          </GradientCard>
        )}

        {/* Report Downloads */}
        <WidgetCard title="Generate Reports">
          {!selectedClassId || !selectedTermId ? (
            <View style={styles.hintContainer}>
              <Text style={styles.hintIcon}>👆</Text>
              <Text style={styles.hintText}>Select a class and term above to generate reports</Text>
            </View>
          ) : (
            reportTypes.map((report) => (
              <TouchableOpacity
                key={report.id}
                style={styles.reportItem}
                onPress={() => handleDownloadPdf(report.id, report.title)}
                disabled={generating !== null}
              >
                <View style={[styles.reportIcon, { backgroundColor: report.color + '15' }]}>
                  <Text style={styles.reportEmoji}>{report.icon}</Text>
                </View>
                <View style={styles.reportInfo}>
                  <Text style={styles.reportName}>{report.title}</Text>
                  <Text style={styles.reportDesc}>{report.description}</Text>
                </View>
                {generating === report.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.downloadIcon}>⬇️</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </WidgetCard>

        {/* Teacher Performance Summary */}
        {teacherPerf.length > 0 && (
          <WidgetCard title="Teacher Performance Overview">
            {teacherPerf.slice(0, 5).map((teacher: any, idx: number) => {
              const name = teacher.teacherName || teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Unknown';
              const avg = teacher.averageScore ?? teacher.average ?? teacher.avgScore ?? 0;
              const classes = teacher.classCount ?? teacher.classes ?? 0;
              const subjects = teacher.subjectCount ?? teacher.subjects ?? 0;
              return (
                <View key={teacher.teacherId || teacher.id || idx} style={[styles.teacherRow, idx > 0 && styles.teacherRowBorder]}>
                  <View style={styles.teacherAvatar}>
                    <Text style={styles.teacherAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.teacherInfo}>
                    <Text style={styles.teacherName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.teacherMeta}>{classes} class{classes !== 1 ? 'es' : ''} • {subjects} subject{subjects !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={[styles.teacherScoreBadge, { backgroundColor: avg >= 70 ? colors.successLight : avg >= 50 ? colors.warningLight : colors.errorLight }]}>
                    <Text style={[styles.teacherScore, { color: avg >= 70 ? colors.success : avg >= 50 ? colors.warning : colors.error }]}>
                      {avg ? `${Number(avg).toFixed(1)}%` : '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
            {teacherPerf.length > 5 && (
              <Text style={styles.moreText}>+{teacherPerf.length - 5} more teachers</Text>
            )}
          </WidgetCard>
        )}

        {/* Quick Links */}
        <WidgetCard title="Quick Actions">
          {onNavigate && (
            <>
              <TouchableOpacity style={styles.quickLink} onPress={() => onNavigate('DirectorResultsMgmt')}>
                <Text style={styles.quickLinkIcon}>📊</Text>
                <Text style={styles.quickLinkText}>Results Management</Text>
                <Text style={styles.quickLinkArrow}>→</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickLink} onPress={() => onNavigate('DirectorStudents')}>
                <Text style={styles.quickLinkIcon}>👨‍🎓</Text>
                <Text style={styles.quickLinkText}>View All Students</Text>
                <Text style={styles.quickLinkArrow}>→</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickLink} onPress={() => onNavigate('DirectorGradingSystems')}>
                <Text style={styles.quickLinkIcon}>⚖️</Text>
                <Text style={styles.quickLinkText}>Grading Systems</Text>
                <Text style={styles.quickLinkArrow}>→</Text>
              </TouchableOpacity>
            </>
          )}
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },

  // Selectors
  selectorsRow: { gap: spacing.sm, marginBottom: spacing.md },
  selectorContainer: { marginBottom: 2 },
  selectorLabel: { fontSize: 11, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase', marginBottom: spacing.xs, letterSpacing: 0.3 },
  chipScroll: { flexDirection: 'row' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.text },
  chipTextActive: { color: colors.white },
  noDataText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },

  // Metrics
  metricsCard: { marginBottom: spacing.lg },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  metricItem: { flex: 1, minWidth: '45%', alignItems: 'center', paddingVertical: spacing.sm },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 11, color: colors.textLight, marginTop: 2, fontWeight: '600' },

  // Hint
  hintContainer: { alignItems: 'center', paddingVertical: spacing.lg },
  hintIcon: { fontSize: 32, marginBottom: spacing.sm },
  hintText: { fontSize: 14, color: colors.textLight, textAlign: 'center' },

  // Report items
  reportItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reportIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  reportEmoji: { fontSize: 20 },
  reportInfo: { flex: 1 },
  reportName: { fontSize: 15, fontWeight: '600', color: colors.text },
  reportDesc: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  downloadIcon: { fontSize: 18 },

  // Teacher rows
  teacherRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  teacherRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  teacherAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  teacherAvatarText: { fontSize: 14, fontWeight: '700', color: colors.white },
  teacherInfo: { flex: 1 },
  teacherName: { fontSize: 14, fontWeight: '600', color: colors.text },
  teacherMeta: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  teacherScoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  teacherScore: { fontSize: 13, fontWeight: '700' },
  moreText: { textAlign: 'center', color: colors.textLight, fontSize: 13, paddingVertical: spacing.sm },

  // Quick links
  quickLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  quickLinkIcon: { fontSize: 20, marginRight: spacing.md },
  quickLinkText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  quickLinkArrow: { fontSize: 16, color: colors.textLight },
});
