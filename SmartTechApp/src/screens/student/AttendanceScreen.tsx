import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Loading } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';

export const StudentAttendanceScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const loadAttendance = useCallback(async () => {
    const sid = user?.studentId || user?.id;
    if (!sid) { setLoading(false); return; }
    try {
      setLoading(true);
      const res = await apiService.getStudentAttendance(sid);
      const data = res?.data || res;
      setAttendance(Array.isArray(data) ? data : data?.records || data?.attendance || []);
      setSummary(data);
    } catch (err) { console.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }, [user?.studentId, user?.id]);

  useEffect(() => {
    loadAttendance();
    const unsubscribe = navigation.addListener('focus', loadAttendance);
    return unsubscribe;
  }, [loadAttendance, navigation]);

  if (loading) return <Loading fullScreen message="Loading attendance..." />;

  const rate = summary?.attendanceRate != null ? summary.attendanceRate : (attendance.length > 0 ? Math.round((attendance.filter((a: any) => a.status === 'PRESENT').length / attendance.length) * 100) : 0);
  const present = summary?.present ?? attendance.filter((a: any) => a.status === 'PRESENT').length;
  const absent = summary?.absent ?? attendance.filter((a: any) => a.status === 'ABSENT').length;
  const late = summary?.late ?? attendance.filter((a: any) => a.status === 'LATE').length;
  const excused = summary?.excused ?? attendance.filter((a: any) => a.status === 'EXCUSED').length;
  const sick = summary?.sick ?? attendance.filter((a: any) => a.status === 'SICK').length;

  const rateColor = rate >= 90 ? '#10b981' : rate >= 75 ? '#3b82f6' : rate >= 50 ? '#f59e0b' : '#ef4444';

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT': return '✅';
      case 'LATE': return '⏰';
      case 'ABSENT': return '❌';
      case 'EXCUSED': return '📄';
      case 'SICK': return '🤒';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return '#059669';
      case 'LATE': return '#D97706';
      case 'ABSENT': return '#DC2626';
      case 'EXCUSED': return '#7C3AED';
      case 'SICK': return '#6366F1';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: rateColor }]}>{rate}%</Text>
          <Text style={styles.summaryLabel}>Attendance Rate</Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${rate}%`, backgroundColor: rateColor }]} />
          </View>
          <View style={styles.summaryRow}>
            <View><Text style={styles.summaryNum}>{present}</Text><Text style={styles.summarySmall}>Present</Text></View>
            <View><Text style={[styles.summaryNum, { color: '#D97706' }]}>{late}</Text><Text style={styles.summarySmall}>Late</Text></View>
            <View><Text style={[styles.summaryNum, { color: '#DC2626' }]}>{absent}</Text><Text style={styles.summarySmall}>Absent</Text></View>
            <View><Text style={[styles.summaryNum, { color: '#7C3AED' }]}>{excused}</Text><Text style={styles.summarySmall}>Excused</Text></View>
            <View><Text style={[styles.summaryNum, { color: '#6366F1' }]}>{sick}</Text><Text style={styles.summarySmall}>Sick</Text></View>
          </View>
        </Card>

        {attendance.map((r) => (
          <View key={r.id} style={styles.recordCard}>
            <Text style={styles.statusIcon}>{getStatusIcon(r.status)}</Text>
            <View style={styles.recordInfo}>
              <Text style={styles.recordDate}>{new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              <Text style={[styles.recordStatus, { color: getStatusColor(r.status) }]}>
                {r.status === 'PRESENT' ? 'Present' : r.status === 'LATE' ? 'Late' : r.status === 'ABSENT' ? 'Absent' : r.status === 'EXCUSED' ? 'Excused' : r.status === 'SICK' ? 'Sick' : r.status}
              </Text>
            </View>
            {r.remarks ? <Text style={styles.recordRemarks}>{r.remarks}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  scrollContent: { padding: spacing.md },
  summaryCard: { padding: spacing.lg, alignItems: 'center' },
  summaryValue: { fontSize: 48, fontWeight: '700', color: colors.text },
  summaryLabel: { fontSize: 14, color: colors.textLight, marginBottom: spacing.md },
  progressBg: { width: '100%', height: 12, backgroundColor: colors.border, borderRadius: 6, marginBottom: spacing.lg },
  progressFill: { height: 12, borderRadius: 6 },
  summaryRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around' },
  summaryNum: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  summarySmall: { fontSize: 12, color: colors.textLight, textAlign: 'center' },
  recordCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: spacing.md, borderRadius: 8, marginBottom: spacing.xs, ...shadows.sm },
  statusIcon: { fontSize: 20, marginRight: spacing.md },
  recordInfo: { flex: 1 },
  recordDate: { fontSize: 14, fontWeight: '600', color: colors.text },
  recordStatus: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  recordRemarks: { fontSize: 11, color: colors.textLight, marginLeft: 'auto', maxWidth: 100 },
});
