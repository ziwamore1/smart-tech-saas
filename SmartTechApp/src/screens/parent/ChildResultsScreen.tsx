import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { Card, Loading } from '../../components';
import { colors, spacing, borderRadius } from '../../theme';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';
import { useRoute, RouteProp } from '@react-navigation/native';

export const ParentChildResultsScreen: React.FC = () => {
  const route = useRoute<RouteProp<any>>();
  const { dashboard } = useAppStore();
  const childId = route.params?.childId || dashboard?.children?.[0]?.id;
  const childName = route.params?.childName || dashboard?.children?.[0]?.name;
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (childId) loadResults();
    else setLoading(false);
  }, [childId]);

  const loadResults = async () => {
    try {
      const termId = dashboard?.currentTerm?.id;
      if (termId) {
        const res = await apiService.getParentChildResults(childId, termId);
        const data = res?.data || res;
        setResults(Array.isArray(data) ? data : data?.results || data?.subjects || []);
      }
    } catch (err) { console.error('Failed to load results'); }
    finally { setLoading(false); }
  };

  const generateResultsContent = (): string => {
    const date = new Date().toLocaleDateString();
    const term = dashboard?.currentTerm?.name || 'Current Term';
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
    const term = dashboard?.currentTerm?.name || 'Current Term';
    const school = dashboard?.school?.name || 'SmartTech School';
    const avg = results.length > 0
      ? (results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / results.length).toFixed(1)
      : '0.0';

    let rows = results.map((r: any) => {
      const score = r.score || 0;
      const bgColor = score >= 75 ? '#d1fae5' : score >= 50 ? '#fef3c7' : '#fee2e2';
      const textColor = score >= 75 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626';
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
      const termId = dashboard?.currentTerm?.id;
      if (!termId || !childId) {
        Alert.alert('Error', 'Missing term or student information');
        return;
      }
      const blob = await apiService.getParentReportCard(childId, termId) as Blob;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const fileUri = FileSystem.documentDirectory + `${childName || 'child'}_Report_Card.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, base64.split(',')[1], {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save ${childName || 'Child'}'s Report Card`,
          UTI: 'com.adobe.pdf',
        });
      };
      reader.readAsDataURL(blob);
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Download Unavailable', 'Report card PDF is not available yet. You can share the text results instead.');
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
      const html = generateHtmlReport();
      await Print.printAsync({ html });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to print report');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{childName || 'Child'}'s Results</Text>
        <Text style={styles.headerSub}>{dashboard?.currentTerm?.name}</Text>
        {results.length > 0 && (
          <View style={styles.actions}>
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                <View style={[styles.badge, { backgroundColor: (r.score || 0) >= 75 ? '#d1fae5' : (r.score || 0) >= 50 ? '#fef3c7' : '#fee2e2' }]}>
                  <Text style={[styles.score, { color: (r.score || 0) >= 75 ? '#059669' : (r.score || 0) >= 50 ? '#d97706' : '#dc2626' }]}>{r.score || 0}%</Text>
                </View>
              </View>
            </Card>
          ))
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
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
  actionBtnSecondary: { backgroundColor: colors.secondary },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  actionBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  actionBtnTextSecondary: { color: colors.white, fontSize: 13, fontWeight: '600' },
  actionBtnTextOutline: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: spacing.md, gap: spacing.sm },
  resultCard: { padding: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { flex: 1 },
  subject: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  score: { fontSize: 18, fontWeight: '700' },
});
