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
      setSummary(data?.summary || data?.stats || null);
    } catch (err) { console.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }, [user?.studentId, user?.id]);

  useEffect(() => {
    loadAttendance();
    const unsubscribe = navigation.addListener('focus', loadAttendance);
    return unsubscribe;
  }, [loadAttendance, navigation]);

  if (loading) return <Loading fullScreen message="Loading attendance..." />;

  const present = attendance.filter((a: any) => a.status === 'PRESENT').length;
  const total = attendance.length || 1;
  const rate = Math.round((present / total) * 100);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{rate}%</Text>
          <Text style={styles.summaryLabel}>Attendance Rate</Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${rate}%`, backgroundColor: rate >= 75 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444' }]} />
          </View>
          <View style={styles.summaryRow}>
            <View><Text style={styles.summaryNum}>{present}</Text><Text style={styles.summarySmall}>Present</Text></View>
            <View><Text style={styles.summaryNum}>{attendance.filter((a: any) => a.status === 'ABSENT').length}</Text><Text style={styles.summarySmall}>Absent</Text></View>
            <View><Text style={styles.summaryNum}>{attendance.filter((a: any) => a.status === 'LATE').length}</Text><Text style={styles.summarySmall}>Late</Text></View>
          </View>
        </Card>
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
});
