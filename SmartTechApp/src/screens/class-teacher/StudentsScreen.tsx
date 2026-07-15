import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';
import { getScoreTextColor, getScoreBgColor } from '../../utils/gradeColors';

const statusColors = {
  top: colors.success,
  good: colors.primaryLight,
  average: colors.warning,
  warning: colors.orange,
  danger: colors.error,
};

interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string;
  className?: string;
  score?: number;
  grade?: string;
  attendance?: number;
}

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: any;
}

export const ClassTeacherStudentsScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { dashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [filter, setFilter] = useState<string>('all');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await apiService.getTeacherClasses();
        const data = Array.isArray(res) ? res : res?.data || [];
        const flattened: StudentRecord[] = [];
        for (const cls of data) {
          if (cls.students) {
            for (const s of cls.students) {
              flattened.push({
                id: s.id,
                firstName: s.firstName || s.user?.firstName || '',
                lastName: s.lastName || s.user?.lastName || '',
                admissionNumber: s.admissionNumber,
                className: cls.name || cls.className,
                score: s.averageScore,
                grade: s.grade,
                attendance: s.attendanceRate,
              });
            }
          }
        }
        setStudents(flattened);
      } catch {
        try {
          const res = await apiService.getStudents();
          const data = Array.isArray(res) ? res : res?.data || [];
          setStudents(data.map((s: any) => ({
            id: s.id,
            firstName: s.firstName || s.user?.firstName || '',
            lastName: s.lastName || s.user?.lastName || '',
            admissionNumber: s.admissionNumber,
            className: s.className,
            score: s.averageScore,
            grade: s.grade,
            attendance: s.attendanceRate,
          })));
        } catch {
          setStudents([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const getStatus = (student: StudentRecord) => {
    if (student.score >= 80) return 'top';
    if (student.score >= 65) return 'good';
    if (student.score >= 50) return 'average';
    if (student.score >= 40) return 'warning';
    return 'danger';
  };

  const filtered = filter === 'all' ? students : students.filter(s => getStatus(s) === filter);

  const generateReportContent = (): string => {
    const date = new Date().toLocaleDateString();
    const term = dashboard?.currentTerm?.name || 'Current Term';
    const school = dashboard?.school?.name || 'SmartTech School';
    let content = `${school} - Class Performance Report\nTerm: ${term}\nGenerated: ${date}\nTotal Students: ${students.length}\n${'='.repeat(40)}\n\n`;

    const sorted = [...students].sort((a, b) => (b.score || 0) - (a.score || 0));
    sorted.forEach((s, i) => {
      content += `${i + 1}. ${s.firstName} ${s.lastName} (${s.className || '—'})\n   Score: ${s.score ?? '—'}% | Grade: ${s.grade || '—'} | Attendance: ${s.attendance ?? '—'}%\n\n`;
    });

    const withScores = students.filter(s => s.score != null);
    const avg = withScores.length > 0
      ? (withScores.reduce((sum, s) => sum + (s.score || 0), 0) / withScores.length).toFixed(1)
      : '—';
    content += `${'='.repeat(40)}\nClass Average: ${avg}%\n`;
    return content;
  };

  const generateHtmlReport = (): string => {
    const date = new Date().toLocaleDateString();
    const term = dashboard?.currentTerm?.name || 'Current Term';
    const school = dashboard?.school?.name || 'SmartTech School';

    const withScores = students.filter(s => s.score != null);
    const avg = withScores.length > 0
      ? (withScores.reduce((sum, s) => sum + (s.score || 0), 0) / withScores.length).toFixed(1)
      : '—';

    const sorted = [...students].sort((a, b) => (b.score || 0) - (a.score || 0));
    let rows = sorted.map((s) => {
      const score = s.score;
      const hasGrade = !!s.grade;
      const bgColor = score != null ? (hasGrade ? getScoreBgColor(score) : getScoreBgColor(score)) : '#f3f4f6';
      const textColor = score != null ? (hasGrade ? getScoreTextColor(score) : getScoreTextColor(score)) : '#9ca3af';
      return `<tr><td style="padding:10px;border-bottom:1px solid #e5e7eb">${s.firstName} ${s.lastName}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb">${s.admissionNumber || '—'}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb">${s.className || '—'}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center"><span style="background:${bgColor};color:${textColor};padding:3px 10px;border-radius:6px;font-weight:700">${score != null ? score + '%' : '—'}</span></td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center">${s.grade || '—'}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center">${s.attendance ?? '—'}%</td></tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#333}h1{color:#1e40af;margin:0 0 4px}.sub{color:#6b7280;font-size:14px}.header{display:flex;align-items:center;gap:12px;margin-bottom:20px}.logo{width:48px;height:48px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#1e40af;color:#fff;padding:10px;text-align:left;font-size:12px}tr:nth-child(even){background:#f9fafb}.footer{margin-top:24px;padding-top:16px;border-top:2px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280}.avg{text-align:center;font-size:18px;font-weight:700;color:#1e40af;margin-top:16px}.summary{display:flex;gap:12px;margin:16px 0}.summary-card{flex:1;background:#f9fafb;border-radius:8px;padding:12px;text-align:center}.summary-num{font-size:24px;font-weight:700;color:#1e40af}.summary-label{font-size:11px;color:#6b7280;margin-top:4px}@media print{body{padding:16px}.no-print{display:none}}</style></head><body><div class="header"><img class="logo" src="https://api.smarttechsaas.com/uploads/logo.png" alt="Logo" onerror="this.style.display='none'"/><div><h1>${school}</h1><p class="sub">Class Performance Report</p></div></div><p><strong>Term:</strong> ${term} | <strong>Date:</strong> ${date}</p><p><strong>Total Students:</strong> ${students.length}</p><div class="summary"><div class="summary-card"><div class="summary-num">${avg}%</div><div class="summary-label">Class Average</div></div><div class="summary-card"><div class="summary-num">${students.filter(s => s.score != null && s.score >= 80).length}</div><div class="summary-label">Top (80%+)</div></div><div class="summary-card"><div class="summary-num">${students.filter(s => s.score != null && s.score < 40).length}</div><div class="summary-label">At Risk (&lt;40%)</div></div></div><table><thead><tr><th>Student</th><th>Adm</th><th>Class</th><th>Score</th><th>Grade</th><th>Att</th></tr></thead><tbody>${rows}</tbody></table><p class="avg">Class Average Score: ${avg}%</p><div class="footer"><p>This is a computer-generated performance report.</p><p>SmartTech School Management System</p></div></body></html>`;
  };

  const handleShare = async () => {
    if (students.length === 0) { Alert.alert('No Data', 'No student data to share'); return; }
    try {
      setActionLoading(true);
      const uri = FileSystem.documentDirectory + 'Class_Performance_Report.txt';
      await FileSystem.writeAsStringAsync(uri, generateReportContent(), { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Share Class Performance', UTI: 'public.plain-text' });
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('Error', 'Failed to share');
    } finally { setActionLoading(false); }
  };

  const handleDownloadPdf = async () => {
    if (students.length === 0) { Alert.alert('No Data', 'No data to download'); return; }
    try {
      setActionLoading(true);
      const termId = dashboard?.currentTerm?.id;
      const classId = students[0]?.id; // best effort
      if (termId && classId) {
        const blob = await apiService.getReportCard(classId, termId) as Blob;
        const reader = new FileReader();
        reader.onload = async () => {
          const fileUri = FileSystem.documentDirectory + 'Class_Report.pdf';
          await FileSystem.writeAsStringAsync(fileUri, (reader.result as string).split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
          await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Save Report', UTI: 'com.adobe.pdf' });
        };
        reader.readAsDataURL(blob);
      } else {
        Alert.alert('Unavailable', 'Report PDF not available. Try sharing as text instead.');
      }
    } catch { Alert.alert('Unavailable', 'Report PDF not available yet.'); }
    finally { setActionLoading(false); }
  };

  const handlePrint = async () => {
    if (students.length === 0) { Alert.alert('No Data', 'No data to print'); return; }
    try {
      setActionLoading(true);
      await Print.printAsync({ html: generateHtmlReport() });
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('Error', 'Failed to print');
    } finally { setActionLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title="Students"
        subtitle={`${students.length} enrolled`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer }}
        rightIcon={{ name: '🔍', onPress: () => {} }}
      />

      {students.length > 0 && (
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} disabled={actionLoading}>
            <Text style={styles.actionBtnText}>📤 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleDownloadPdf} disabled={actionLoading}>
            <Text style={styles.actionBtnTextSecondary}>⬇ PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handlePrint} disabled={actionLoading}>
            <Text style={styles.actionBtnTextOutline}>🖨 Print</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[{ key: 'all', label: 'All' }, { key: 'top', label: 'Top' }, { key: 'good', label: 'Good' }, { key: 'average', label: 'Average' }, { key: 'warning', label: 'Warning' }, { key: 'danger', label: 'At Risk' }].map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <WidgetCard title="Performance Overview">
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 40 }} />
          ) : filtered.length === 0 ? (
            <Text style={{ textAlign: 'center', color: colors.textLight, paddingVertical: 40 }}>
              No student data available.
            </Text>
          ) : (
            filtered.map((student, i) => {
              const status = getStatus(student);
              return (
                <TouchableOpacity key={student.id || i} style={styles.studentRow}>
                  <View style={[styles.avatar, { backgroundColor: statusColors[status] + '20' }]}>
                    <Text style={[styles.avatarText, { color: statusColors[status] }]}>
                      {student.firstName?.[0]}{student.lastName?.[0]}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.firstName} {student.lastName}</Text>
                    <Text style={styles.studentMeta}>
                      {student.className ? `${student.className} • ` : ''}Attendance: {student.attendance ?? '—'}%
                    </Text>
                  </View>
                  <View style={styles.scoreArea}>
                    <Text style={[styles.score, { color: statusColors[status] }]}>
                      {student.score ?? '—'}%
                    </Text>
                    {student.grade && (
                      <Text style={[styles.gradeBadge, { backgroundColor: statusColors[status] + '20', color: statusColors[status] }]}>
                        {student.grade}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </WidgetCard>

        <WidgetCard title="Quick Actions">
          <View style={styles.actionGrid}>
            {[
              { icon: '📋', label: 'Mark Attendance', screen: 'ClassAttendance' },
              { icon: '📝', label: 'Enter Grades', screen: 'TeacherMarks' },
              { icon: '📊', label: 'View Reports', screen: 'StudentReports' },
              { icon: '💬', label: 'Message Parent', screen: 'ParentMessages' },
            ].map((a) => (
              <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => navigation.navigate(a.screen)}>
                <Text style={{ fontSize: 24 }}>{a.icon}</Text>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.white },
  actionBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
  actionBtnSecondary: { backgroundColor: colors.secondary },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  actionBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  actionBtnTextSecondary: { color: colors.white, fontSize: 13, fontWeight: '600' },
  actionBtnTextOutline: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  scroll: { padding: spacing.md },
  filterRow: { marginBottom: spacing.md },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, marginRight: spacing.sm, ...shadows.sm },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '500', color: colors.textLight },
  filterChipTextActive: { color: colors.white },
  studentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { fontSize: 14, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: colors.text },
  studentMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  scoreArea: { alignItems: 'flex-end' },
  score: { fontSize: 16, fontWeight: '700' },
  gradeBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, marginTop: 2, overflow: 'hidden' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionCard: { width: '47%', backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  actionLabel: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: spacing.sm, textAlign: 'center' },
});
