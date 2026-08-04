import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Card, Loading, ReportCardPdfViewer } from '../../components';
import { colors, spacing, borderRadius } from '../../theme';
import { useAppStore } from '../../store';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';
import { socketService } from '../../services/socket';
import { useRoute, RouteProp } from '@react-navigation/native';
import { getGradeTextColor, getGradeBgColor, getScoreTextColor, getScoreBgColor } from '../../utils/gradeColors';
import { generatePdfFromHtml } from '../../utils/pdfReport';

export const ParentChildResultsScreen: React.FC = () => {
  const route = useRoute<RouteProp<any>>();
  const { dashboard } = useAppStore();
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>(dashboard?.children || []);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(route.params?.childId || null);
  const [childName, setChildName] = useState<string>(route.params?.childName || '');
  const [results, setResults] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [reportHtml, setReportHtml] = useState('');
  const [loadingHtml, setLoadingHtml] = useState(false);

  useEffect(() => {
    const kids = dashboard?.children || [];
    if (kids.length > 0) {
      setChildren(kids);
      setSelectedChildId((prev) => (prev && kids.some((k) => k.id === prev) ? prev : kids[0].id));
    }
  }, [dashboard]);

  useEffect(() => {
    const kid = children.find((c) => c.id === selectedChildId);
    setChildName(kid?.name || `${kid?.firstName || ''} ${kid?.lastName || ''}`.trim() || route.params?.childName || 'Child');
  }, [selectedChildId, children]);

  const childId = selectedChildId ?? '';

  useEffect(() => {
    const loadTerms = async () => {
      let termList: any[] = [];
      try {
        const data = await apiService.getAllTerms();
        termList = Array.isArray(data) ? data : data?.data || data?.data?.data || [];
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
      setSelectedTermId(currentTerm?.id || termList[0]?.id || dashboard?.currentTerm?.id || '');
    };
    loadTerms();
  }, [dashboard?.currentTerm?.id]);

  const loadResults = useCallback(async (isRefresh = false) => {
    try {
      const termId = selectedTermId || dashboard?.currentTerm?.id;
      if (termId) {
        const res = await apiService.getParentChildResults(childId, termId);
        const data = res?.data || res;
        let resultsData: any[] = Array.isArray(data) ? data : data?.results || data?.subjects || [];

        // Merge composite subjects
        if (resultsData.length > 0 && user?.schoolId) {
          try {
            const compositeRaw = await apiService.getCompositeForStudent(
              childId, termId, user.schoolId, '',
            );
            const composites = Array.isArray(compositeRaw) ? compositeRaw : compositeRaw?.data || [];
            if (composites.length > 0) {
              const componentIds = new Set(composites.flatMap((c: any) =>
                (c.components || []).map((cc: any) => cc.subjectId),
              ));
              resultsData = resultsData.filter((s: any) => !componentIds.has(s.subjectId));
              for (const comp of composites) {
                resultsData.push({
                  id: comp.composite?.id,
                  subject: { name: comp.composite?.name, code: comp.composite?.code },
                  score: comp.finalPercentage,
                  grade: comp.finalGrade,
                  remark: null,
                  isComposite: true,
                });
              }
            }
          } catch { /* ok */ }
        }

        setResults(resultsData);
      }
    } catch (err) { console.error('Failed to load results:', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [childId, selectedTermId, user?.schoolId, dashboard?.currentTerm?.id]);

  useEffect(() => {
    if (childId) loadResults();
    else setLoading(false);

    // Real-time: listen for results published
    const handleResultsPublished = (data: any) => {
      console.log('[ParentResults] Results published, refreshing...', data);
      if (childId) loadResults();
    };

    socketService.connect();
    if (user?.schoolId) {
      socketService.joinSchool(user.schoolId);
    }
    socketService.on('results:published', handleResultsPublished);

    return () => {
      socketService.off('results:published', handleResultsPublished);
      if (user?.schoolId) {
        socketService.leaveSchool(user.schoolId);
      }
    };
  }, [childId, loadResults]);

  const generateResultsContent = (): string => {
    const date = new Date().toLocaleDateString();
    const term = terms.find((t: any) => t.id === selectedTermId)?.name || dashboard?.currentTerm?.name || 'Current Term';
    const school = dashboard?.school?.name || 'SmartTech School';
    let content = `${school} - Results Report\nChild: ${childName || 'Student'}\nTerm: ${term}\nGenerated: ${date}\n${'='.repeat(40)}\n\n`;

    results.forEach((r: any) => {
      const subject = r.subject?.name || r.subject || 'Subject';
      const score = r.score || 0;
      const grade = r.grade || '-';
      const remark = r.remark || '';
      content += `${subject}: ${score}% (Grade: ${grade}) ${remark}\n`;
    });

    const avg = results.length > 0
      ? (results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / results.length).toFixed(1)
      : 0;
    content += `\n${'='.repeat(40)}\nAverage: ${avg}%\n`;

    return content;
  };

  const generateHtmlReport = (): string => {
    const date = new Date().toLocaleDateString();
    const term = terms.find((t: any) => t.id === selectedTermId)?.name || dashboard?.currentTerm?.name || 'Current Term';
    const school = dashboard?.school?.name || 'SmartTech School';
    const avg = results.length > 0
      ? (results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / results.length).toFixed(1)
      : '0.0';

    let rows = results.map((r: any) => {
      const score = r.score || 0;
      const hasGrade = !!r.grade;
      const bgColor = hasGrade ? getGradeBgColor(r.grade) : getScoreBgColor(score);
      const textColor = hasGrade ? getGradeTextColor(r.grade) : getScoreTextColor(score);
      return `<tr><td style="padding:12px;border-bottom:1px solid #e5e7eb">${r.subject?.name || r.subject || 'Subject'}</td><td style="padding:12px;border-bottom:1px solid #e5e7eb">${r.grade || '-'}</td><td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center"><span style="background:${bgColor};color:${textColor};padding:4px 12px;border-radius:8px;font-weight:700">${score}%</span></td><td style="padding:12px;border-bottom:1px solid #e5e7eb">${r.remark || '-'}</td></tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#333}h1{color:#1e40af;margin:0 0 4px}.sub{color:#6b7280;font-size:14px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e40af;color:#fff;padding:12px;text-align:left;font-size:13px}tr:nth-child(even){background:#f9fafb}.footer{margin-top:24px;padding-top:16px;border-top:2px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280}.avg{text-align:center;font-size:18px;font-weight:700;color:#1e40af;margin-top:16px}.header{display:flex;align-items:center;gap:12px;margin-bottom:16px}.logo{width:48px;height:48px}</style></head><body><div class="header"><img class="logo" src="https://api.smarttechsaas.com/uploads/logo.png" alt="Logo" onerror="this.style.display='none'"/><div><h1>${school}</h1><p class="sub">Results Report Card</p></div></div><p style="margin:0"><strong>Student:</strong> ${childName || 'Student'}</p><p style="margin:4px 0"><strong>Term:</strong> ${term}</p><p style="margin:4px 0"><strong>Date:</strong> ${date}</p><table><thead><tr><th>Subject</th><th>Grade</th><th>Score</th><th>Remark</th></tr></thead><tbody>${rows}</tbody></table><p class="avg">Average Score: ${avg}%</p><div class="footer"><p>This is a computer-generated report. All scores are subject to verification.</p><p>SmartTech School Management System</p></div></body></html>`;
  };

  const handleShareResults = async () => {
    if (results.length === 0) {
      Alert.alert('No Results', 'No results available to share');
      return;
    }
    try {
      setActionLoading(true);
      const content = generateResultsContent();
      const fileUri = FileSystem.documentDirectory + `${childName || 'child'}_Results.txt`;
      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/plain',
        dialogTitle: `Share ${childName || 'Child'}'s Results`,
        UTI: 'public.plain-text',
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to share results');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadReportCard = async () => {
    if (results.length === 0) {
      Alert.alert('No Results', 'No results available to download');
      return;
    }
    try {
      setActionLoading(true);
      const termId = selectedTermId || dashboard?.currentTerm?.id;
      if (!termId || !childId) {
        Alert.alert('Error', 'Missing term or student information');
        return;
      }
      const { html } = await apiService.getReportCardHtml(childId, termId);
      if (!html) throw new Error('Report card is not available for this term yet.');
      const fileUri = await generatePdfFromHtml(html, `${childName || 'child'}_Report_Card.pdf`);
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Save ${childName || 'Child'}'s Report Card`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        const msg = e?.response?.data?.message || e?.message || 'Report card PDF is not available yet. You can share the text results instead.';
        Alert.alert('Download Unavailable', msg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintReport = async () => {
    if (results.length === 0) {
      Alert.alert('No Results', 'No results available to print');
      return;
    }
    try {
      setActionLoading(true);
      const termId = selectedTermId || dashboard?.currentTerm?.id;
      let html = generateHtmlReport();
      if (childId && termId) {
        try {
          const { html: professionalHtml } = await apiService.getReportCardHtml(childId, termId);
          if (professionalHtml) html = professionalHtml;
        } catch { /* keep fallback */ }
      }
      await Print.printAsync({ html });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to print report');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewReportCard = async () => {
    const termId = selectedTermId || dashboard?.currentTerm?.id;
    if (!childId || !termId) {
      Alert.alert('Error', 'Missing term or student information');
      return;
    }
    setLoadingHtml(true);
    try {
      const { html } = await apiService.getReportCardHtml(childId, termId);
      if (!html) throw new Error('Report card is not available for this term yet.');
      setReportHtml(html);
      setViewerVisible(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Report card preview is not available yet.';
      Alert.alert('Unavailable', msg);
    } finally {
      setLoadingHtml(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadResults(true);
  }, [loadResults]);

  if (loading) return <Loading fullScreen />;

  const selectedTermName = terms.find((t: any) => t.id === selectedTermId)?.name || dashboard?.currentTerm?.name;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{childName || 'Child'}'s Results</Text>
        <Text style={styles.headerSub}>{selectedTermName}</Text>
        {results.length > 0 && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleViewReportCard} disabled={actionLoading || loadingHtml}>
              <Text style={styles.actionBtnText}>{loadingHtml ? '...' : '👁 View'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShareResults} disabled={actionLoading}>
              <Text style={styles.actionBtnText}>📤 Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleDownloadReportCard} disabled={actionLoading}>
              <Text style={styles.actionBtnTextSecondary}>⬇ PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handlePrintReport} disabled={actionLoading}>
              <Text style={styles.actionBtnTextOutline}>🖨 Print</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childStrip}>
          {children.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.childChip, selectedChildId === c.id && styles.childChipActive]}
              onPress={() => { setSelectedChildId(c.id); setResults([]); setLoading(true); }}
            >
              <Text style={[styles.childChipText, selectedChildId === c.id && styles.childChipTextActive]}>{c.name || 'Child'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {terms.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.termScroll} contentContainerStyle={styles.termContent}>
          {terms.map((term: any) => (
            <TouchableOpacity
              key={term.id}
              style={[styles.termChip, selectedTermId === term.id && styles.termChipActive]}
              onPress={() => { setSelectedTermId(term.id); setResults([]); setLoading(true); }}
            >
              <Text style={[styles.termChipText, selectedTermId === term.id && styles.termChipTextActive]}>
                {term.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {results.length === 0 ? (
          <Card style={{ padding: spacing.xl }}>
            <Text style={{ textAlign: 'center', color: colors.textLight }}>No results available</Text>
          </Card>
        ) : (
          results.map((r: any, i: number) => (
            <Card key={r.id || i} variant="outlined" style={styles.resultCard}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.subject}>{r.subject?.name || r.subject || 'Subject'}</Text>
                  <Text style={styles.meta}>Grade: {r.grade || '-'} {r.remark ? `- ${r.remark}` : ''}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: getGradeBgColor(r.grade) }]}>
                  <Text style={[styles.score, { color: getGradeTextColor(r.grade) }]}>{r.grade || `${r.score || 0}%`}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {viewerVisible && (
        <ReportCardPdfViewer
          visible={viewerVisible}
          html={reportHtml}
          studentName={childName || 'Child'}
          termName={selectedTermName}
          onClose={() => setViewerVisible(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 14, color: colors.textLight, marginTop: 2 },
   actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
   actionBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md, minHeight: 36, justifyContent: 'center' },
  actionBtnSecondary: { backgroundColor: colors.secondary },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  actionBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  actionBtnTextSecondary: { color: colors.white, fontSize: 13, fontWeight: '600' },
  actionBtnTextOutline: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  childStrip: { maxHeight: 44, marginHorizontal: spacing.md, marginTop: spacing.sm },
  childChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  childChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  childChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  childChipTextActive: { color: colors.white },
  termScroll: { maxHeight: 48, marginTop: spacing.sm },
  termContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  termChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  termChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  termChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  termChipTextActive: { color: colors.white },
   scrollContent: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl + 140 },
  resultCard: { padding: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { flex: 1 },
  subject: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  score: { fontSize: 18, fontWeight: '700' },
});
