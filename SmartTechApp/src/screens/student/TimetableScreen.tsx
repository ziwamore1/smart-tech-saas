import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Loading } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { apiService } from '../../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const StudentTimetableScreen: React.FC = () => {
  const [timetable, setTimetable] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTimetable(); }, []);

  const loadTimetable = async () => {
    try {
      const res = await apiService.getStudentTimetable();
      setTimetable(res?.data || res);
    } catch (err) { console.error('Failed to load timetable'); }
    finally { setLoading(false); }
  };

  if (loading) return <Loading fullScreen message="Loading timetable..." />;

  const slots = timetable?.timetable || [];
  const groupedByDay = DAYS.map((_, dayIdx) => slots.filter((s: any) => s.day === dayIdx));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Timetable</Text>
        <Text style={styles.headerSub}>{timetable?.className || ''}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {DAYS.map((day, dayIdx) => {
          const daySlots = groupedByDay[dayIdx];
          return (
            <Card key={day} variant="outlined" style={styles.dayCard}>
              <Text style={styles.dayTitle}>{day}</Text>
              {daySlots.length === 0 ? (
                <Text style={styles.noLessons}>No lessons</Text>
              ) : (
                daySlots.sort((a: any, b: any) => a.period - b.period).map((slot: any, i: number) => (
                  <View key={slot.id || i} style={styles.slotRow}>
                    <View style={[styles.periodBadge, { backgroundColor: COLORS[slot.period % COLORS.length] + '20' }]}>
                      <Text style={[styles.periodText, { color: COLORS[slot.period % COLORS.length] }]}>P{slot.period}</Text>
                    </View>
                    <View style={styles.slotInfo}>
                      <Text style={styles.subjectName}>{slot.subject?.name || 'Subject'}</Text>
                      <Text style={styles.teacherName}>{slot.teacher?.user?.firstName} {slot.teacher?.user?.lastName}</Text>
                    </View>
                  </View>
                ))
              )}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  scrollContent: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  dayCard: { padding: spacing.md },
  dayTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  noLessons: { fontSize: 13, color: colors.textLight, fontStyle: 'italic' },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  periodBadge: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  periodText: { fontSize: 12, fontWeight: '700' },
  slotInfo: { flex: 1 },
  subjectName: { fontSize: 14, fontWeight: '600', color: colors.text },
  teacherName: { fontSize: 12, color: colors.textLight },
});
