import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Card, Button, Loading, HeaderBar } from '../../components';
import { colors, spacing, borderRadius } from '../../theme';
import { apiService } from '../../services/api';
import { useAppStore } from '../../store';
import { getScoreTextColor, getScoreBgColor } from '../../utils/gradeColors';

interface TeacherMarksProps {
  onToggleDrawer?: () => void;
}

export const TeacherMarksScreen: React.FC<TeacherMarksProps> = ({ onToggleDrawer }) => {
  const { dashboard } = useAppStore();
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (!selectedClass?.id) return;
    apiService.getTeacherSubjects(selectedClass.id)
      .then((response) => {
        const data = response?.data || response;
        setSubjects(Array.isArray(data) ? data : data?.subjects || []);
      })
      .catch(() => setSubjects([]));
  }, [selectedClass?.id]);

  const loadData = async () => {
    try {
      const clsRes = await apiService.getTeacherClasses();
      const classData = clsRes?.data || clsRes;
      const availableClasses = Array.isArray(classData) ? classData : classData?.classes || [];
      setClasses(availableClasses);
    } catch (err) { console.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleClassChange = (cls: any) => {
    setSelectedClass(cls);
    setSubmitted(false);
    if (cls?.students) {
      setStudents(cls.students);
      const initial: Record<string, string> = {};
      cls.students.forEach((s: any) => { initial[s.id] = ''; });
      setScores(initial);
    }
  };

  const handleSubmit = async () => {
    const termId = dashboard?.currentTerm?.id;
    if (!selectedClass?.id || !selectedSubject?.id || !termId) {
      Alert.alert('Error', 'Select class, subject, and ensure a term is active');
      return;
    }
    const scoresArray = Object.entries(scores)
      .filter(([, score]) => score.trim() !== '')
      .map(([studentId, score]) => ({ studentId, score: parseFloat(score) }));

    if (scoresArray.length === 0) {
      Alert.alert('Error', 'Enter at least one score');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.enterMarks(selectedClass.id, selectedSubject.id, termId, scoresArray);
      Alert.alert('Success', 'Marks saved successfully');
      setSubmitted(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to save marks');
    }
    finally { setSubmitting(false); }
  };

  const generateResultsContent = (): string => {
    const date = new Date().toLocaleDateString();
    const term = dashboard?.currentTerm?.name || 'Current Term';
    const school = dashboard?.school?.name || 'SmartTech School';
    const className = selectedClass?.name || 'Class';
    const subjectName = selectedSubject?.name || 'Subject';
    let content = `${school} - Class Marks Report\nClass: ${className}\nSubject: ${subjectName}\nTerm: ${term}\nGenerated: ${date}\n${'='.repeat(40)}\n\n`;

    students.forEach((s: any) => {
      const score = scores[s.id] || '—';
      content += `${s.firstName} ${s.lastName}: ${score}%\n`;
    });

    const validScores = Object.entries(scores)
      .filter(([, v]) => v.trim() !== '')
      .map(([, v]) => parseFloat(v));
    const avg = validScores.length > 0
      ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
      : '—';
    content += `\n${'='.repeat(40)}\nAverage: ${avg}%\nTotal Students: ${students.length}\n`;
    return content;
  };

  const generateHtmlReport = (): string => {
    const date = new Date().toLocaleDateString();
    const term = dashboard?.currentTerm?.name || 'Current Term';
    const school = dashboard?.school?.name || 'SmartTech School';
    const className = selectedClass?.name || 'Class';
    const subjectName = selectedSubject?.name || 'Subject';

    const validScores = Object.entries(scores)
      .filter(([, v]) => v.trim() !== '')
      .map(([, v]) => parseFloat(v));
    const avg = validScores.length > 0
      ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
      : '—';

    let rows = students.map((s: any) => {
      const raw = scores[s.id];
      const score = raw ? parseFloat(raw) : null;
      const bgColor = score !== null ? getScoreBgColor(score) : '#f3f4f6';
      const textColor = score !== null ? getScoreTextColor(score) : '#9ca3af';
      return `<tr><td style="padding:12px;border-bottom:1px solid #e5e7eb">${s.firstName} ${s.lastName}</td><td style="padding:12px;border-bottom:1px solid #e5e7eb">${s.admissionNumber || '—'}</td><td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center"><span style="background:${bgColor};color:${textColor};padding:4px 12px;border-radius:8px;font-weight:700">${score !== null ? score + '%' : '—'}</span></td></tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#333}h1{color:#1e40af;margin:0 0 4px}.sub{color:#6b7280;font-size:14px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e40af;color:#fff;padding:12px;text-align:left;font-size:13px}tr:nth-child(even){background:#f9fafb}.footer{margin-top:24px;padding-top:16px;border-top:2px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280}.avg{text-align:center;font-size:18px;font-weight:700;color:#1e40af;margin-top:16px}.header{display:flex;align-items:center;gap:12px;margin-bottom:16px}.logo{width:48px;height:48px}</style></head><body><div class="header"><img class="logo" src="https://api.smarttechsaas.com/uploads/logo.png" alt="Logo" onerror="this.style.display='none'"/><div><h1>${school}</h1><p class="sub">Marks Report — ${className}</p></div></div><p style="margin:0"><strong>Subject:</strong> ${subjectName}</p><p style="margin:4px 0"><strong>Term:</strong> ${term}</p><p style="margin:4px 0"><strong>Date:</strong> ${date}</p><table><thead><tr><th>Student</th><th>Admission</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table><p class="avg">Class Average: ${avg}%</p><div class="footer"><p>This is a computer-generated report.</p><p>SmartTech School Management System</p></div></body></html>`;
  };

  const handleShareResults = async () => {
    if (students.length === 0) { Alert.alert('No Data', 'No student data to share'); return; }
    try {
      setActionLoading(true);
      const uri = FileSystem.documentDirectory + `${selectedClass?.name || 'Class'}_Marks.txt`;
      await FileSystem.writeAsStringAsync(uri, generateResultsContent(), { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Share Class Marks', UTI: 'public.plain-text' });
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('Error', 'Failed to share');
    } finally { setActionLoading(false); }
  };

  const handleDownloadPdf = async () => {
    if (students.length === 0) { Alert.alert('No Data', 'No data to download'); return; }
    try {
      setActionLoading(true);
      const termId = dashboard?.currentTerm?.id;
      if (termId && selectedClass?.id) {
        const { base64 } = await apiService.getReportCard(selectedClass.id, termId);
        const fileUri = FileSystem.documentDirectory + `${selectedClass?.name || 'Class'}_Report.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Save Report', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Unavailable', 'Report PDF not available. Try sharing as text instead.');
      }
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Unavailable', e?.response?.data?.message || e?.message || 'Report PDF not available yet.');
      }
    }
    finally { setActionLoading(false); }
  };

  const handlePrintReport = async () => {
    if (students.length === 0) { Alert.alert('No Data', 'No data to print'); return; }
    try {
      setActionLoading(true);
      await Print.printAsync({ html: generateHtmlReport() });
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('Error', 'Failed to print');
    } finally { setActionLoading(false); }
  };

  const resetEntry = () => {
    setSubmitted(false);
    const reset: Record<string, string> = {};
    students.forEach((s: any) => { reset[s.id] = ''; });
    setScores(reset);
  };

  if (loading) return <Loading fullScreen />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title={submitted ? 'Class Results' : 'Enter Marks'}
        subtitle={submitted && selectedClass ? `${selectedClass.name} — ${selectedSubject?.name}` : undefined}
        leftIcon={onToggleDrawer ? { name: '☰', onPress: onToggleDrawer } : undefined}
      />
      {students.length > 0 && submitted && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShareResults} disabled={actionLoading}>
            <Text style={styles.actionBtnText}>📤 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleDownloadPdf} disabled={actionLoading}>
            <Text style={styles.actionBtnTextSecondary}>⬇ PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handlePrintReport} disabled={actionLoading}>
            <Text style={styles.actionBtnTextOutline}>🖨 Print</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {!submitted && (
          <>
            <Card variant="outlined" style={{ padding: spacing.md, marginBottom: spacing.md }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm }}>Select Class</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {classes.map((cls: any) => (
                  <TouchableOpacity key={cls.id} onPress={() => handleClassChange(cls)} style={[styles.filterChip, selectedClass?.id === cls.id && { backgroundColor: colors.primary }]}>
                    <Text style={[styles.filterChipText, selectedClass?.id === cls.id && { color: colors.white }]}>{cls.name || cls.className || cls.class?.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm }}>Select Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {subjects.map((subj: any) => (
                  <TouchableOpacity key={subj.id} onPress={() => setSelectedSubject(subj)} style={[styles.filterChip, selectedSubject?.id === subj.id && { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.filterChipText, selectedSubject?.id === subj.id && { color: colors.white }]}>{subj.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Card>

            {students.length > 0 && (
              <>
                {students.map((student: any) => (
                  <Card key={student.id} variant="outlined" style={{ padding: spacing.md, marginBottom: spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{student.firstName} {student.lastName}</Text>
                        <Text style={{ fontSize: 12, color: colors.textLight }}>{student.admissionNumber || ''}</Text>
                      </View>
                      <TextInput
                        style={styles.scoreInput}
                        placeholder="Score"
                        placeholderTextColor={colors.textLight}
                        keyboardType="numeric"
                        value={scores[student.id] || ''}
                        onChangeText={(v) => setScores(prev => ({ ...prev, [student.id]: v }))}
                      />
                    </View>
                  </Card>
                ))}
                <Button title="Submit Marks" onPress={handleSubmit} loading={submitting} style={{ marginTop: spacing.md }} />
              </>
            )}
          </>
        )}

        {submitted && (
          <>
            {students.map((student: any) => {
              const raw = scores[student.id];
              const score = raw ? parseFloat(raw) : null;
              const bgColor = score !== null ? getScoreBgColor(score) : '#f3f4f6';
              const textColor = score !== null ? getScoreTextColor(score) : '#9ca3af';
              return (
                <Card key={student.id} variant="outlined" style={{ padding: spacing.md, marginBottom: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{student.firstName} {student.lastName}</Text>
                      <Text style={{ fontSize: 12, color: colors.textLight }}>{student.admissionNumber || ''}</Text>
                    </View>
                    <View style={[styles.scoreBadge, { backgroundColor: bgColor }]}>
                      <Text style={[styles.scoreBadgeText, { color: textColor }]}>{score !== null ? `${score}%` : '—'}</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
            <TouchableOpacity style={styles.backBtn} onPress={resetEntry}>
              <Text style={styles.backBtnText}>← Enter More Marks</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
  actionBtnSecondary: { backgroundColor: colors.secondary },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  actionBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  actionBtnTextSecondary: { color: colors.white, fontSize: 13, fontWeight: '600' },
  actionBtnTextOutline: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.border, borderRadius: 20, marginRight: spacing.sm },
  filterChipText: { fontSize: 13, fontWeight: '500', color: colors.text },
  scoreInput: { width: 80, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  scoreBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  scoreBadgeText: { fontSize: 18, fontWeight: '700' },
  backBtn: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  backBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
