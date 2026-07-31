import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { HeaderBar } from '../../components';

export const StudentReportCardsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboard } = useAppStore();
  const [results, setResults] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  const studentId = user?.studentId || user?.id;

  useEffect(() => {
    loadTerms();
  }, []);

  useEffect(() => {
    if (studentId && selectedTermId) loadResults();
    else setLoading(false);
  }, [studentId, selectedTermId]);

  const loadTerms = async () => {
    try {
      let termList: any[] = [];
      const yearData = await apiService.getAcademicYears();
      const years = Array.isArray(yearData) ? yearData : yearData?.data || yearData?.data?.data || [];
      const currentYear = years.find((y: any) => y.isCurrent) || years[0];
      if (currentYear) {
        const termData = await apiService.getTerms(currentYear.id);
        termList = Array.isArray(termData) ? termData : termData?.data || termData?.data?.data || [];
      }
      if (termList.length === 0 && dashboard?.currentTerm) {
        termList = [dashboard.currentTerm];
      }
      setTerms(termList);
      const currentTerm = termList.find((t: any) => t.isCurrent) || termList[0] || dashboard?.currentTerm;
      if (currentTerm) {
        setSelectedTermId(currentTerm.id);
      } else {
        setLoading(false);
      }
    } catch {
      if (dashboard?.currentTerm) {
        setTerms([dashboard.currentTerm]);
        setSelectedTermId(dashboard.currentTerm.id);
      } else {
        setLoading(false);
      }
    }
  };

  const loadResults = async () => {
    if (!studentId || !selectedTermId) return;
    try {
      setLoading(true);
      const [resultsRes, reportRes] = await Promise.allSettled([
        apiService.getStudentAssessmentResults(studentId, selectedTermId),
        apiService.getReportCardData(studentId, selectedTermId),
      ]);

      let list: any[] = [];
      if (resultsRes.status === 'fulfilled') {
        const data = resultsRes.value?.data || resultsRes.value || [];
        list = Array.isArray(data) ? data : data?.results || data?.subjects || [];
      }

      if (reportRes.status === 'fulfilled') {
        const report = reportRes.value?.data || reportRes.value || {};
        setReportData(report);
        if (list.length === 0 && Array.isArray(report?.subjectBreakdown) && report.subjectBreakdown.length > 0) {
          list = report.subjectBreakdown.map((s: any) => ({
            subject: { name: s.subjectName, id: s.subjectId },
            score: s.finalPercentage ?? s.totalRawScore,
            grade: s.finalGrade,
            remark: s.finalRemark,
          }));
        }
      }

      setResults(list);
    } catch (err) {
      console.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadResults();
    setRefreshing(false);
  };

  const handleDownloadPdf = async () => {
    if (!studentId || !selectedTermId) {
      Alert.alert('Error', 'Missing student or term information');
      return;
    }
    setDownloading(true);
    try {
      const blob = await apiService.getReportCardPdf(studentId, selectedTermId) as Blob;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const fileUri = FileSystem.documentDirectory + 'My_Report_Card.pdf';
        await FileSystem.writeAsStringAsync(fileUri, base64.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Download Report Card' });
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Unavailable', 'Report card PDF is not available yet.');
      }
    } finally {
      setDownloading(false);
    }
  };

  const avg = results.length > 0
    ? (results.reduce((s: number, r: any) => s + (r.score || r.finalPercentage || 0), 0) / results.length)
    : 0;

  const classAvg = reportData?.classAverage ?? reportData?.statistics?.average ?? 0;
  const position = reportData?.position ?? reportData?.rank ?? null;
  const totalStudents = reportData?.totalStudents ?? reportData?.studentCount ?? null;

  const getGradeColor = (grade: string): string => {
    if (!grade) return colors.textLight;
    const g = grade.toUpperCase().trim();
    if (g.startsWith('A')) return colors.success;
    if (g.startsWith('B')) return '#2563EB';
    if (g.startsWith('C')) return colors.accent;
    if (g.startsWith('D')) return colors.orange;
    return colors.error;
  };

  const getPerformanceLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Very Good';
    if (score >= 60) return 'Good';
    if (score >= 50) return 'Average';
    if (score >= 40) return 'Below Average';
    return 'Needs Improvement';
  };

  const selectedTerm = terms.find((t: any) => t.id === selectedTermId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title="Report Cards"
        subtitle={selectedTerm?.name || dashboard?.currentTerm?.name || 'Current Term'}
        rightIcon={results.length > 0 ? { name: downloading ? '⏳' : '📄', onPress: handleDownloadPdf } : undefined}
      />

      {terms.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.termScroll} contentContainerStyle={styles.termContent}>
          {terms.map((term: any) => (
            <TouchableOpacity
              key={term.id}
              style={[styles.termChip, selectedTermId === term.id && styles.termChipActive]}
              onPress={() => { setSelectedTermId(term.id); setResults([]); setReportData(null); setLoading(true); }}
            >
              <Text style={[styles.termChipText, selectedTermId === term.id && styles.termChipTextActive]}>
                {term.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No Report Card Data</Text>
            <Text style={styles.emptyText}>Your results will appear once published by your school.</Text>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryMain}>
                  <Text style={styles.summaryLabel}>Overall Average</Text>
                  <Text style={[styles.summaryValue, { color: avg >= 70 ? colors.success : avg >= 50 ? colors.warning : colors.error }]}>
                    {avg.toFixed(1)}%
                  </Text>
                  <Text style={[styles.summaryPerf, { color: avg >= 70 ? colors.success : avg >= 50 ? colors.warning : colors.error }]}>
                    {getPerformanceLabel(avg)}
                  </Text>
                </View>
                <View style={styles.summarySide}>
                  {position && totalStudents && (
                    <View style={styles.rankContainer}>
                      <Text style={styles.rankValue}>#{position}</Text>
                      <Text style={styles.rankLabel}>of {totalStudents}</Text>
                    </View>
                  )}
                  {classAvg > 0 && (
                    <View style={styles.classAvgContainer}>
                      <Text style={styles.classAvgValue}>{classAvg.toFixed(1)}%</Text>
                      <Text style={styles.classAvgLabel}>Class Avg</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* You vs Class Average Bar */}
              {classAvg > 0 && (
                <View style={styles.comparisonContainer}>
                  <View style={styles.comparisonRow}>
                    <Text style={styles.comparisonLabel}>You: {avg.toFixed(1)}%</Text>
                    <Text style={styles.comparisonLabel}>Class: {classAvg.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.comparisonBarBg}>
                    <View style={[styles.comparisonBarClass, { width: `${Math.min(classAvg, 100)}%` }]} />
                    <View style={[styles.comparisonBarStudent, { width: `${Math.min(avg, 100)}%` }]} />
                  </View>
                  <View style={styles.comparisonLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                      <Text style={styles.legendText}>Your Score</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
                      <Text style={styles.legendText}>Class Average</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* PDF Download Button */}
            <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPdf} disabled={downloading}>
              <Text style={styles.downloadBtnText}>{downloading ? 'Generating PDF...' : '📄 Download Full Report Card (PDF)'}</Text>
            </TouchableOpacity>

            {/* Subject Results */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Subject Results</Text>
              {results.map((r: any, i: number) => {
                const score = r.score || r.finalPercentage || 0;
                const grade = r.grade || r.finalGrade || '—';
                const subjectName = r.subject?.name || r.subject || 'Subject';
                const previousScore = r.previousScore || r.midTermScore || null;
                const trend = previousScore != null ? score - previousScore : null;
                return (
                  <View key={r.id || i} style={[styles.subjectRow, i > 0 && styles.subjectRowBorder]}>
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectName} numberOfLines={1}>{subjectName}</Text>
                      {r.remark && <Text style={styles.subjectRemark}>{r.remark}</Text>}
                    </View>
                    <View style={styles.subjectScores}>
                      {trend != null && (
                        <Text style={[styles.trendText, { color: trend > 0 ? colors.success : trend < 0 ? colors.error : colors.textLight }]}>
                          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}{Math.abs(trend).toFixed(1)}
                        </Text>
                      )}
                      <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(grade) + '15' }]}>
                        <Text style={[styles.gradeBadgeText, { color: getGradeColor(grade) }]}>{grade}</Text>
                      </View>
                      <Text style={[styles.scoreText, { color: score >= 50 ? colors.success : colors.error }]}>
                        {score.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Performance Distribution */}
            {results.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Performance Breakdown</Text>
                <View style={styles.distRow}>
                  {[
                    { label: 'Excellent', range: '80-100%', color: colors.success, count: results.filter(r => (r.score || r.finalPercentage || 0) >= 80).length },
                    { label: 'Good', range: '60-79%', color: '#2563EB', count: results.filter(r => { const s = r.score || r.finalPercentage || 0; return s >= 60 && s < 80; }).length },
                    { label: 'Average', range: '50-59%', color: colors.accent, count: results.filter(r => { const s = r.score || r.finalPercentage || 0; return s >= 50 && s < 60; }).length },
                    { label: 'Weak', range: 'Below 50%', color: colors.error, count: results.filter(r => (r.score || r.finalPercentage || 0) < 50).length },
                  ].map((item) => (
                    <View key={item.label} style={styles.distItem}>
                      <View style={[styles.distBar, { height: Math.max((item.count / results.length) * 80, 4), backgroundColor: item.color }]} />
                      <Text style={styles.distCount}>{item.count}</Text>
                      <Text style={styles.distLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md },

  termScroll: { maxHeight: 48, marginTop: spacing.sm },
  termContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  termChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  termChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  termChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  termChipTextActive: { color: colors.white },

  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center', lineHeight: 20 },

  summaryCard: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryMain: { flex: 1 },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  summaryValue: { fontSize: 42, fontWeight: '800', marginTop: spacing.xs },
  summaryPerf: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  summarySide: { alignItems: 'flex-end', gap: spacing.md },
  rankContainer: { alignItems: 'center' },
  rankValue: { fontSize: 24, fontWeight: '800', color: colors.white },
  rankLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  classAvgContainer: { alignItems: 'center' },
  classAvgValue: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  classAvgLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  comparisonContainer: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  comparisonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  comparisonLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  comparisonBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden', position: 'relative' },
  comparisonBarClass: { position: 'absolute', top: 0, left: 0, height: '100%', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 4 },
  comparisonBarStudent: { position: 'absolute', top: 0, left: 0, height: '100%', backgroundColor: colors.white, borderRadius: 4 },
  comparisonLegend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  downloadBtn: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  downloadBtnText: { fontSize: 15, fontWeight: '700', color: colors.primary },

  sectionCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  subjectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  subjectRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  subjectInfo: { flex: 1, marginRight: spacing.md },
  subjectName: { fontSize: 15, fontWeight: '600', color: colors.text },
  subjectRemark: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  subjectScores: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trendText: { fontSize: 12, fontWeight: '700' },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  gradeBadgeText: { fontSize: 13, fontWeight: '700' },
  scoreText: { fontSize: 16, fontWeight: '700', minWidth: 45, textAlign: 'right' },

  distRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120, paddingTop: spacing.md },
  distItem: { alignItems: 'center', flex: 1 },
  distBar: { width: 28, borderRadius: borderRadius.sm, minHeight: 4 },
  distCount: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  distLabel: { fontSize: 10, color: colors.textLight, marginTop: 2, textAlign: 'center' },
});
