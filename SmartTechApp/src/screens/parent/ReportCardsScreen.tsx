import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';
import { getGradeTextColor, getGradeBgColor, getScoreTextColor, getScoreBgColor } from '../../utils/gradeColors';

export const ParentReportCardsScreen: React.FC = () => {
  const { dashboard } = useAppStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const kids = dashboard?.children || [];
    setChildren(kids);
    if (kids.length > 0 && !selectedChildId) {
      setSelectedChildId(kids[0].id);
    }
    loadTerms();
  }, [dashboard]);

  useEffect(() => {
    if (selectedChildId && selectedTermId) loadResults();
  }, [selectedChildId, selectedTermId]);

  const loadTerms = async () => {
    try {
      let termList: any[] = [];
      try {
        const allTermData = await apiService.getAllTerms();
        termList = Array.isArray(allTermData) ? allTermData : allTermData?.data || allTermData?.data?.data || [];
      } catch (err) {
        console.warn('Failed to load all terms:', err);
      }
      if (termList.length === 0 && dashboard?.currentTerm) {
        termList = [dashboard.currentTerm];
      }

      const seen = new Set<string>();
      termList = termList
        .filter((t: any) => {
          if (!t?.id || seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        })
        .sort((a: any, b: any) =>
          String(a.startDate || '').localeCompare(String(b.startDate || '')),
        );

      setTerms(termList);
      const currentTerm = termList.find((t: any) => t.isCurrent)
        || (dashboard?.currentTerm?.id
          ? termList.find((t: any) => t.id === dashboard?.currentTerm?.id)
          : undefined);
      if (currentTerm && !selectedTermId) {
        setSelectedTermId(currentTerm.id);
      }
    } catch {
      if (dashboard?.currentTerm) {
        setTerms([dashboard.currentTerm]);
        if (!selectedTermId) setSelectedTermId(dashboard.currentTerm.id);
      }
    }
  };

  const loadResults = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const termId = selectedTermId || dashboard?.currentTerm?.id;
      if (termId) {
        const [resultsRes, reportRes] = await Promise.allSettled([
          apiService.getParentChildResults(selectedChildId, termId),
          apiService.getReportCardData(selectedChildId, termId),
        ]);

        if (resultsRes.status === 'fulfilled') {
          const res = resultsRes.value;
          const data = Array.isArray(res) ? res : res?.data || res?.results || res?.subjects || [];
          setResults(data);
        }

        if (reportRes.status === 'fulfilled') {
          setReportData(reportRes.value);
        }
      }
    } catch (err) {
      console.error('Failed to load results');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadResults();
    setRefreshing(false);
  };

  const avg = results.length > 0 ? results.reduce((s: number, r: any) => s + (r.score || r.finalPercentage || 0), 0) / results.length : 0;
  const classAvg = reportData?.classAverage ?? reportData?.statistics?.average ?? 0;
  const position = reportData?.position ?? reportData?.rank ?? null;
  const totalStudents = reportData?.totalStudents ?? reportData?.studentCount ?? null;

  const selectedChild = children.find(c => c.id === selectedChildId);
  const childName = selectedChild ? (selectedChild.name || `${selectedChild.firstName || ''} ${selectedChild.lastName || ''}`.trim()) : 'Child';

  const handleDownloadPDF = async () => {
    if (results.length === 0) { Alert.alert('No Data', 'No results to generate report card'); return; }
    try {
      setActionLoading(true);
      const termId = selectedTermId || dashboard?.currentTerm?.id;
      if (!termId || !selectedChildId) { Alert.alert('Error', 'Missing term or student'); return; }

      const { base64 } = await apiService.getParentReportCard(selectedChildId, termId);
      const fileUri = FileSystem.documentDirectory + `${childName.replace(/\s+/g, '_')}_Report_Card.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: `Save ${childName}'s Report Card`, UTI: 'com.adobe.pdf' });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        const msg = e?.response?.data?.message || e?.message || 'Report card PDF is not available yet. Try printing instead.';
        Alert.alert('Unavailable', msg);
      }
    } finally { setActionLoading(false); }
  };

  const handlePrint = async () => {
    if (results.length === 0) { Alert.alert('No Data', 'No results to print'); return; }
    try {
      setActionLoading(true);
      const term = dashboard?.currentTerm?.name || 'Current Term';
      const school = dashboard?.school?.name || 'SmartTech School';

      const subjectRows = results.map((r: any) => {
        const score = r.score || r.finalPercentage || 0;
        const grade = r.grade || '-';
        const bgColor = grade !== '-' ? getGradeBgColor(grade) : getScoreBgColor(score);
        const textColor = grade !== '-' ? getGradeTextColor(grade) : getScoreTextColor(score);
        const prevScore = r.previousScore || r.midTermScore || null;
        const trendHtml = prevScore != null ? `<span style="color:${score > prevScore ? '#16a34a' : score < prevScore ? '#dc2626' : '#6b7280'};font-size:11px;margin-left:6px">${score > prevScore ? '▲' : score < prevScore ? '▼' : '→'} ${Math.abs(score - prevScore).toFixed(1)}</span>` : '';
        return `<tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:600">${r.subject?.name || r.subject || 'Subject'}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb"><span style="background:${bgColor};color:${textColor};padding:4px 12px;border-radius:8px;font-weight:700">${grade}</span></td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">${Math.round(score)}%${trendHtml}</td></tr>`;
      }).join('');

      const rankHtml = position && totalStudents ? `<p style="font-size:16px;font-weight:700;color:#1e40af">Position: #${position} of ${totalStudents} students</p>` : '';
      const classAvgHtml = classAvg > 0 ? `<p style="color:#6b7280">Class Average: ${Math.round(classAvg)}%</p>` : '';

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#333}h1{color:#1e40af;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e40af;color:#fff;padding:10px;text-align:left}</style></head><body><h1>${school}</h1><p style="color:#6b7280">Report Card - ${term}</p><p><strong>Student:</strong> ${childName}</p>${rankHtml}${classAvgHtml}<table><thead><tr><th>Subject</th><th>Grade</th><th>Score</th></tr></thead><tbody>${subjectRows}</tbody></table><p style="text-align:center;font-size:18px;font-weight:700;color:#1e40af;margin-top:16px">Overall Average: ${Math.round(avg)}%</p></body></html>`;
      await Print.printAsync({ html });
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('Error', 'Failed to print');
    } finally { setActionLoading(false); }
  };

  const selectedTerm = terms.find((t: any) => t.id === selectedTermId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report Cards</Text>
        <Text style={styles.headerSub}>{selectedTerm?.name || dashboard?.currentTerm?.name || 'Current Term'}</Text>
      </View>

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

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childStrip}>
          {children.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.childChip, selectedChildId === c.id && styles.childChipActive]}
              onPress={() => { setSelectedChildId(c.id); }}
            >
              <Text style={[styles.childChipText, selectedChildId === c.id && styles.childChipTextActive]}>{c.name || 'Child'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No report card data available</Text>
            <Text style={styles.emptyHint}>Results will appear once published by the school.</Text>
          </View>
        ) : (
          <>
            {/* Main Summary */}
            <View style={styles.avgCard}>
              <View style={styles.avgMain}>
                <Text style={styles.avgLabel}>Overall Average</Text>
                <Text style={[styles.avgValue, { color: avg >= 75 ? colors.success : avg >= 50 ? colors.warning : colors.error }]}>
                  {Math.round(avg)}%
                </Text>
                <Text style={styles.avgDesc}>{avg >= 75 ? 'Excellent' : avg >= 60 ? 'Good' : avg >= 50 ? 'Average' : 'Needs Improvement'}</Text>
              </View>
              <View style={styles.avgSide}>
                {position && totalStudents && (
                  <View style={styles.rankBox}>
                    <Text style={styles.rankNumber}>#{position}</Text>
                    <Text style={styles.rankOf}>of {totalStudents}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* You vs Class */}
            {classAvg > 0 && (
              <View style={styles.comparisonCard}>
                <Text style={styles.comparisonTitle}>Performance vs Class Average</Text>
                <View style={styles.compBars}>
                  <View style={styles.compBarItem}>
                    <Text style={[styles.compBarLabel, { color: colors.primary }]}>{childName.split(' ')[0]}</Text>
                    <View style={styles.compBarBg}>
                      <View style={[styles.compBarFill, { width: `${Math.min(avg, 100)}%`, backgroundColor: colors.primary }]} />
                    </View>
                    <Text style={styles.compBarValue}>{Math.round(avg)}%</Text>
                  </View>
                  <View style={styles.compBarItem}>
                    <Text style={[styles.compBarLabel, { color: colors.textLight }]}>Class Avg</Text>
                    <View style={styles.compBarBg}>
                      <View style={[styles.compBarFill, { width: `${Math.min(classAvg, 100)}%`, backgroundColor: colors.border }]} />
                    </View>
                    <Text style={styles.compBarValue}>{Math.round(classAvg)}%</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadPDF} disabled={actionLoading}>
                <Text style={styles.actionBtnIcon}>⬇️</Text>
                <Text style={styles.actionBtnText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handlePrint} disabled={actionLoading}>
                <Text style={styles.actionBtnIcon}>🖨️</Text>
                <Text style={styles.actionBtnText}>Print</Text>
              </TouchableOpacity>
            </View>

            {/* Subject Results */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Subject Results</Text>
              {results.map((r: any, i: number) => {
                const score = r.score || r.finalPercentage || 0;
                const grade = r.grade || '-';
                const prevScore = r.previousScore || r.midTermScore || null;
                const trend = prevScore != null ? score - prevScore : null;
                return (
                  <View key={r.id || i} style={[styles.resultCard, i > 0 && styles.resultBorder]}>
                    <View style={styles.resultMain}>
                      <Text style={styles.subjectName}>{r.subject?.name || r.subject || 'Subject'}</Text>
                      <Text style={styles.resultGrade}>
                        {grade !== '-' ? `Grade: ${grade}` : ''}
                        {r.remark ? ` - ${r.remark}` : ''}
                      </Text>
                    </View>
                    <View style={styles.resultRight}>
                      {trend != null && (
                        <Text style={[styles.trendBadge, { color: trend > 0 ? colors.success : trend < 0 ? colors.error : colors.textLight, backgroundColor: trend > 0 ? colors.successLight : trend < 0 ? colors.errorLight : colors.borderLight }]}>
                          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(1)}
                        </Text>
                      )}
                      <View style={[styles.scoreBadge, { backgroundColor: grade !== '-' ? getGradeBgColor(grade) : getScoreBgColor(score) }]}>
                        <Text style={[styles.scoreValue, { color: grade !== '-' ? getGradeTextColor(grade) : getScoreTextColor(score) }]}>
                          {grade !== '-' ? grade : `${Math.round(score)}%`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Performance Distribution */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Performance Breakdown</Text>
              <View style={styles.distRow}>
                {[
                  { label: 'Excellent', range: '80%+', color: colors.success, count: results.filter(r => (r.score || r.finalPercentage || 0) >= 80).length },
                  { label: 'Good', range: '60-79%', color: '#2563EB', count: results.filter(r => { const s = r.score || r.finalPercentage || 0; return s >= 60 && s < 80; }).length },
                  { label: 'Average', range: '50-59%', color: colors.accent, count: results.filter(r => { const s = r.score || r.finalPercentage || 0; return s >= 50 && s < 60; }).length },
                  { label: 'Weak', range: '<50%', color: colors.error, count: results.filter(r => (r.score || r.finalPercentage || 0) < 50).length },
                ].map((item) => (
                  <View key={item.label} style={styles.distItem}>
                    <View style={[styles.distBar, { height: Math.max((item.count / Math.max(results.length, 1)) * 80, 4), backgroundColor: item.color }]} />
                    <Text style={styles.distCount}>{item.count}</Text>
                    <Text style={styles.distLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 14, color: colors.textLight, marginTop: 2 },

  termScroll: { maxHeight: 48, marginTop: spacing.sm, marginHorizontal: spacing.md },
  termContent: { gap: spacing.sm },
  termChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  termChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  termChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  termChipTextActive: { color: colors.white },
  childStrip: { maxHeight: 44, marginHorizontal: spacing.md, marginTop: spacing.sm },
  childChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  childChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  childChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  childChipTextActive: { color: colors.white },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  loader: { marginTop: 40 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textLight },
  emptyHint: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },

  avgCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.md },
  avgMain: { flex: 1 },
  avgLabel: { fontSize: 13, color: colors.textLight },
  avgValue: { fontSize: 48, fontWeight: '800', marginVertical: spacing.xs },
  avgDesc: { fontSize: 14, fontWeight: '600', color: colors.textLight },
  avgSide: { alignItems: 'flex-end' },
  rankBox: { alignItems: 'center', backgroundColor: colors.infoLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  rankNumber: { fontSize: 22, fontWeight: '800', color: colors.primary },
  rankOf: { fontSize: 11, color: colors.textLight },

  comparisonCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  comparisonTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  compBars: { gap: spacing.md },
  compBarItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  compBarLabel: { fontSize: 12, fontWeight: '600', width: 60 },
  compBarBg: { flex: 1, height: 12, backgroundColor: colors.borderLight, borderRadius: 6, overflow: 'hidden' },
  compBarFill: { height: '100%', borderRadius: 6 },
  compBarValue: { fontSize: 13, fontWeight: '700', color: colors.text, width: 40, textAlign: 'right' },

  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  actionBtnSecondary: { backgroundColor: colors.secondary },
  actionBtnIcon: { fontSize: 16 },
  actionBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  sectionCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  resultCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  resultBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  resultMain: { flex: 1, marginRight: spacing.md },
  subjectName: { fontSize: 15, fontWeight: '600', color: colors.text },
  resultGrade: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  resultRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trendBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  scoreValue: { fontSize: 16, fontWeight: '700' },

  distRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120, paddingTop: spacing.md },
  distItem: { alignItems: 'center', flex: 1 },
  distBar: { width: 28, borderRadius: borderRadius.sm, minHeight: 4 },
  distCount: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  distLabel: { fontSize: 10, color: colors.textLight, marginTop: 2, textAlign: 'center' },
});
