import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  remarks?: string;
}

export const ParentAttendanceScreen: React.FC = () => {
  const { dashboard } = useAppStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, excused: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const kids = dashboard?.children || [];
    setChildren(kids);
    if (kids.length > 0 && !selectedChildId) {
      setSelectedChildId(kids[0].id);
    }
  }, [dashboard]);

  useEffect(() => {
    if (selectedChildId) loadAttendance();
  }, [selectedChildId]);

  const loadAttendance = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const res = await apiService.getParentAttendance(selectedChildId);
      const data = Array.isArray(res) ? res : res?.data || res?.records || res?.attendance || [];
      setRecords(data);
      const s = { present: 0, absent: 0, late: 0, excused: 0, total: data.length };
      data.forEach((r: AttendanceRecord) => {
        if (r.status === 'PRESENT') s.present++;
        else if (r.status === 'ABSENT') s.absent++;
        else if (r.status === 'LATE') s.late++;
        else if (r.status === 'EXCUSED') s.excused++;
      });
      setSummary(s);
    } catch (err) {
      console.error('Failed to load attendance');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAttendance();
    setRefreshing(false);
  };

  const attendanceRate = summary.total > 0 ? ((summary.present + summary.late) / summary.total) * 100 : 0;
  const rateColor = attendanceRate >= 90 ? colors.success : attendanceRate >= 75 ? colors.info : attendanceRate >= 50 ? colors.warning : colors.error;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT': return '✅';
      case 'LATE': return '⏰';
      case 'ABSENT': return '❌';
      case 'EXCUSED': return '📄';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return '#059669';
      case 'LATE': return '#D97706';
      case 'ABSENT': return '#DC2626';
      case 'EXCUSED': return '#7C3AED';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
      </View>

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childStrip}>
          {children.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.childChip, selectedChildId === c.id && styles.childChipActive]}
              onPress={() => setSelectedChildId(c.id)}
            >
              <Text style={[styles.childChipText, selectedChildId === c.id && styles.childChipTextActive]}>
                {c.name || 'Child'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.rateCircle}>
                <Text style={[styles.rateText, { color: rateColor }]}>{Math.round(attendanceRate)}%</Text>
                <Text style={styles.rateLabel}>Attendance</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}><Text style={styles.statValue}>{summary.present}</Text><Text style={styles.statLabel}>Present</Text></View>
                <View style={styles.statItem}><Text style={[styles.statValue, { color: colors.warning }]}>{summary.late}</Text><Text style={styles.statLabel}>Late</Text></View>
                <View style={styles.statItem}><Text style={[styles.statValue, { color: colors.error }]}>{summary.absent}</Text><Text style={styles.statLabel}>Absent</Text></View>
                <View style={styles.statItem}><Text style={[styles.statValue, { color: colors.purple }]}>{summary.excused}</Text><Text style={styles.statLabel}>Excused</Text></View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${attendanceRate}%`, backgroundColor: rateColor }]} />
              </View>
            </View>

            {records.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>No attendance records</Text>
              </View>
            ) : (
              records.slice(0, 50).map((r) => (
                <View key={r.id} style={styles.recordCard}>
                  <Text style={styles.statusIcon}>{getStatusIcon(r.status)}</Text>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordDate}>{new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    <Text style={[styles.recordStatus, { color: getStatusColor(r.status) }]}>
                      {r.status === 'PRESENT' ? 'Present' : r.status === 'LATE' ? 'Late' : r.status === 'ABSENT' ? 'Absent' : r.status === 'EXCUSED' ? 'Excused' : r.status}
                    </Text>
                  </View>
                  <View style={styles.recordTimes}>
                    {r.checkIn ? <Text style={styles.timeText}>In: {r.checkIn}</Text> : null}
                    {r.checkOut ? <Text style={styles.timeText}>Out: {r.checkOut}</Text> : null}
                  </View>
                </View>
              ))
            )}
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
  summaryCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.md },
  rateCircle: { alignItems: 'center', marginBottom: spacing.md },
  rateText: { fontSize: 42, fontWeight: '800' },
  rateLabel: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  progressBar: { height: 8, backgroundColor: colors.border, borderRadius: 4, width: '100%', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  recordCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.xs, ...shadows.sm },
  statusIcon: { fontSize: 20, marginRight: spacing.md },
  recordInfo: { flex: 1 },
  recordDate: { fontSize: 14, fontWeight: '600', color: colors.text },
  recordStatus: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  recordTimes: { alignItems: 'flex-end' },
  timeText: { fontSize: 11, color: colors.textLight },
});
