import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Card, Loading } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';
import { socketService } from '../../services/socket';
import { getGradeTextColor, getGradeBgColor } from '../../utils/gradeColors';

export const StudentResultsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboard } = useAppStore();
  const [results, setResults] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const studentId = dashboard?.student?.id || user?.studentId || user?.id;

  const loadTerms = useCallback(async () => {
    let termList: any[] = [];
    try {
      const data = await apiService.getAllTerms();
      termList = Array.isArray(data) ? data : data?.data || data?.data?.data || [];
    } catch (err) {
      console.warn('Failed to load all terms:', err);
    }

    if (termList.length === 0) {
      const currentTerm = dashboard?.currentTerm;
      if (currentTerm?.id) {
        termList = [{ id: currentTerm.id, name: currentTerm.name, isCurrent: true }];
      }
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
  }, [dashboard?.currentTerm?.id]);

  const loadResults = useCallback(async (isRefresh = false) => {
    try {
      const termId = selectedTermId || dashboard?.currentTerm?.id;
      if (studentId && termId) {
        const res = await apiService.getStudentResults(studentId, termId);
        const data = res?.data || res;
        let resultsData: any[] = Array.isArray(data) ? data : data?.results || data?.subjects || [];

        // Merge composite subjects
        if (resultsData.length > 0 && user?.schoolId) {
          try {
            const compositeRaw = await apiService.getCompositeForStudent(
              studentId, termId, user.schoolId, '',
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
    } catch (err) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId, selectedTermId, user?.schoolId, dashboard?.currentTerm?.id]);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  useEffect(() => {
    loadResults();
  }, [selectedTermId, loadResults]);

  useEffect(() => {
    // Real-time: listen for results published
    const handleResultsPublished = (data: any) => {
      console.log('[Results] Results published, refreshing...', data);
      loadResults();
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
  }, [loadResults]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadResults(true);
  }, [loadResults]);

  const handleShareResults = async () => {
    if (results.length === 0) {
      Alert.alert('No Results', 'No results available to share');
      return;
    }
    try {
      const content = generateResultsContent();
      const fileUri = FileSystem.documentDirectory + 'My_Results.txt';
      await FileSystem.writeAsStringAsync(fileUri, content);
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/plain',
        dialogTitle: 'Share My Results',
        UTI: 'public.plain-text',
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to share results');
    }
  };

  const handleDownloadReportCard = async () => {
    const termId = selectedTermId || dashboard?.currentTerm?.id;
    if (!studentId || !termId) {
      Alert.alert('Unavailable', 'No term selected to download a report card.');
      return;
    }
    setDownloading(true);
    try {
      const { base64 } = await apiService.generateReportPdf({ type: 'REPORT_CARD', studentId, termId });
      const fileName = `Report_Card_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      Alert.alert(
        'Report Card Downloaded',
        'Your report card has been generated with the school template.',
        [
          {
            text: 'Share',
            onPress: async () => {
              try {
                await Sharing.shareAsync(fileUri, {
                  mimeType: 'application/pdf',
                  dialogTitle: 'Share Report Card',
                });
              } catch (shareErr: any) {
                if (shareErr?.message !== 'User did not share') {
                  Alert.alert('Error', 'Failed to share file.');
                }
              }
            },
          },
          { text: 'OK' },
        ]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to generate report card.';
      Alert.alert('Download Failed', msg);
    } finally {
      setDownloading(false);
    }
  };

  const generateResultsContent = (): string => {
    const date = new Date().toLocaleDateString();
    const term = terms.find((t: any) => t.id === selectedTermId)?.name || dashboard?.currentTerm?.name || 'Current Term';
    let content = `SmartTech School - My Results\nTerm: ${term}\nGenerated: ${date}\n${'='.repeat(40)}\n\n`;
    
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

  if (loading) return <Loading fullScreen message="Loading results..." />;

  const selectedTermName = terms.find((t: any) => t.id === selectedTermId)?.name || dashboard?.currentTerm?.name || 'Current Term';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Results</Text>
        <Text style={styles.headerSub}>{selectedTermName}</Text>
        {results.length > 0 && (
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareResults}>
            <Text style={styles.shareBtnText}>📤 Share</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {terms.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.termScroll}>
            {terms.map((term) => (
              <TouchableOpacity
                key={term.id}
                style={[styles.chip, selectedTermId === term.id && styles.chipActive]}
                onPress={() => setSelectedTermId(term.id)}
              >
                <Text style={[styles.chipText, selectedTermId === term.id && styles.chipTextActive]}>
                  {term.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {results.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={{ textAlign: 'center', color: colors.textLight, fontSize: 16 }}>
              No published results available for this term yet
            </Text>
          </Card>
        ) : (
          results.map((r: any, i: number) => (
            <Card key={r.id || i} variant="outlined" style={styles.resultCard}>
              <View style={styles.resultRow}>
                <View style={styles.resultInfo}>
                  <Text style={styles.subjectName}>{r.subject?.name || r.subject || 'Subject'}</Text>
                  <Text style={styles.resultMeta}>{r.grade ? `Grade: ${r.grade}` : ''} {r.remark ? `- ${r.remark}` : ''}</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: getGradeBgColor(r.grade) }]}>
                  <Text style={[styles.scoreText, { color: getGradeTextColor(r.grade) }]}>
                    {r.grade || `${r.score || 0}%`}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
        {studentId && (
          <TouchableOpacity
            style={[styles.downloadBtn, downloading && styles.downloadBtnDisabled]}
            onPress={handleDownloadReportCard}
            disabled={downloading}
          >
            {downloading ? (
              <View style={styles.downloadBtnInner}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.downloadBtnText}>Generating Report Card...</Text>
              </View>
            ) : (
              <View style={styles.downloadBtnInner}>
                <Text style={styles.downloadBtnIcon}>📄</Text>
                <Text style={styles.downloadBtnText}>Download Report Card (PDF)</Text>
              </View>
            )}
          </TouchableOpacity>
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
  shareBtn: { marginTop: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md, alignSelf: 'flex-start' },
  shareBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: spacing.md, gap: spacing.sm },
  termScroll: { marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.text },
  chipTextActive: { color: colors.white },
  emptyCard: { padding: spacing.xl },
  resultCard: { padding: spacing.md },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultInfo: { flex: 1 },
  subjectName: { fontSize: 16, fontWeight: '600', color: colors.text },
  resultMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  scoreBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  scoreText: { fontSize: 18, fontWeight: '700' },
  downloadBtn: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', ...shadows.md },
  downloadBtnDisabled: { backgroundColor: colors.textMuted, shadowOpacity: 0, elevation: 0 },
  downloadBtnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  downloadBtnIcon: { fontSize: 16 },
  downloadBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
