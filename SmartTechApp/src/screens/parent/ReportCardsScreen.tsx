import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const kids = dashboard?.children || [];
    setChildren(kids);
    if (kids.length > 0 && !selectedChildId) {
      setSelectedChildId(kids[0].id);
    }
    if (dashboard?.currentTerm) {
      setTerms([dashboard.currentTerm]);
      setSelectedTermId(dashboard.currentTerm.id);
    }
  }, [dashboard]);

  useEffect(() => {
    if (selectedChildId) loadResults();
  }, [selectedChildId]);

  const loadResults = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const termId = selectedTermId || dashboard?.currentTerm?.id;
      if (termId) {
        const res = await apiService.getParentChildResults(selectedChildId, termId);
        const data = Array.isArray(res) ? res : res?.data || res?.results || res?.subjects || [];
        setResults(data);
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

  const selectedChild = children.find(c => c.id === selectedChildId);
  const childName = selectedChild ? (selectedChild.name || `${selectedChild.firstName || ''} ${selectedChild.lastName || ''}`.trim()) : 'Child';

  const handleDownloadPDF = async () => {
    if (results.length === 0) { Alert.alert('No Data', 'No results to generate report card'); return; }
    try {
      setActionLoading(true);
      const termId = selectedTermId || dashboard?.currentTerm?.id;
      if (!termId || !selectedChildId) { Alert.alert('Error', 'Missing term or student'); return; }

      const blob = await apiService.getParentReportCard(selectedChildId, termId) as Blob;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const fileUri = FileSystem.documentDirectory + `${childName.replace(/\s+/g, '_')}_Report_Card.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, base64.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: `Save ${childName}'s Report Card`, UTI: 'com.adobe.pdf' });
      };
      reader.readAsDataURL(blob);
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Unavailable', 'Report card PDF is not available yet. Try printing instead.');
      }
    } finally { setActionLoading(false); }
  };

  const handlePrint = async () => {
    if (results.length === 0) { Alert.alert('No Data', 'No results to print'); return; }
    try {
      setActionLoading(true);
      const term = dashboard?.currentTerm?.name || 'Current Term';
      const school = dashboard?.school?.name || 'SmartTech School';
      const rows = results.map((r: any) => {
        const score = r.score || r.finalPercentage || 0;
        const hasGrade = !!r.grade;
        const bgColor = hasGrade ? getGradeBgColor(r.grade) : getScoreBgColor(score);
        const textColor = hasGrade ? getGradeTextColor(r.grade) : getScoreTextColor(score);
        return `<tr><td style="padding:10px;border-bottom:1px solid #e5e7eb">${r.subject?.name || r.subject || 'Subject'}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb">${r.grade || '-'}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center"><span style="background:${bgColor};color:${textColor};padding:4px 12px;border-radius:8px;font-weight:700">${Math.round(score)}%</span></td></tr>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#333}h1{color:#1e40af;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e40af;color:#fff;padding:10px;text-align:left}</style></head><body><h1>${school}</h1><p style="color:#6b7280">Report Card</p><p><strong>Student:</strong> ${childName}</p><p><strong>Term:</strong> ${term}</p><table><thead><tr><th>Subject</th><th>Grade</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:center;font-size:18px;font-weight:700;color:#1e40af;margin-top:16px">Average: ${Math.round(avg)}%</p></body></html>`;
      await Print.printAsync({ html });
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('Error', 'Failed to print');
    } finally { setActionLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report Cards</Text>
      </View>

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

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No report card data available</Text>
          </View>
        ) : (
          <>
            <View style={styles.avgCard}>
              <Text style={styles.avgLabel}>Overall Average</Text>
              <Text style={[styles.avgValue, { color: avg >= 75 ? colors.success : avg >= 50 ? colors.warning : colors.error }]}>
                {Math.round(avg)}%
              </Text>
              <Text style={styles.avgDesc}>{avg >= 75 ? 'Excellent' : avg >= 60 ? 'Good' : avg >= 50 ? 'Average' : 'Needs Improvement'}</Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadPDF} disabled={actionLoading}>
                <Text style={styles.actionBtnText}>⬇ PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handlePrint} disabled={actionLoading}>
                <Text style={styles.actionBtnText}>🖨 Print</Text>
              </TouchableOpacity>
            </View>

            {results.map((r: any, i: number) => {
              const score = r.score || r.finalPercentage || 0;
              return (
                <View key={r.id || i} style={styles.resultCard}>
                  <View style={styles.resultRow}>
                    <Text style={styles.subjectName}>{r.subject?.name || r.subject || 'Subject'}</Text>
                    <View style={[styles.scoreBadge, { backgroundColor: getGradeBgColor(r.grade) }]}>
                      <Text style={[styles.scoreValue, { color: getGradeTextColor(r.grade) }]}>{r.grade || `${Math.round(score)}%`}</Text>
                    </View>
                  </View>
                  <Text style={styles.gradeText}>Grade: {r.grade || '-'} {r.remark ? `- ${r.remark}` : ''}</Text>
                </View>
              );
            })}
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
  avgCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.md },
  avgLabel: { fontSize: 13, color: colors.textLight },
  avgValue: { fontSize: 48, fontWeight: '800', marginVertical: spacing.xs },
  avgDesc: { fontSize: 14, fontWeight: '600', color: colors.textLight },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  actionBtnSecondary: { backgroundColor: colors.secondary },
  actionBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  resultCard: { backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.xs, ...shadows.sm },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  scoreValue: { fontSize: 16, fontWeight: '700' },
  gradeText: { fontSize: 12, color: colors.textLight, marginTop: 4 },
});
