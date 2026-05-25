import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const MOCK_STUDENTS = [
  { name: 'Alice Kamau', grade: 'A', score: 92, attendance: 98, status: 'top' as const },
  { name: 'Bob Ochieng', grade: 'B+', score: 85, attendance: 95, status: 'good' as const },
  { name: 'Carol Wanjiku', grade: 'C', score: 70, attendance: 88, status: 'average' as const },
  { name: 'David Mwangi', grade: 'D+', score: 55, attendance: 72, status: 'warning' as const },
  { name: 'Eve Nyambura', grade: 'F', score: 38, attendance: 60, status: 'danger' as const },
  { name: 'Frank Otieno', grade: 'B', score: 78, attendance: 90, status: 'good' as const },
  { name: 'Grace Akinyi', grade: 'A-', score: 88, attendance: 96, status: 'top' as const },
  { name: 'Henry Kiprop', grade: 'C+', score: 65, attendance: 82, status: 'average' as const },
];

const statusColors = {
  top: colors.success,
  good: colors.primaryLight,
  average: colors.warning,
  warning: colors.orange,
  danger: colors.error,
};

export const ClassTeacherStudentsScreen: React.FC = () => {
  const { dashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? MOCK_STUDENTS : MOCK_STUDENTS.filter(s => s.status === filter);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title="Students"
        subtitle={`${MOCK_STUDENTS.length} enrolled`}
        rightIcon={{ name: '🔍', onPress: () => {} }}
      />

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
          {filtered.map((student, i) => (
            <TouchableOpacity key={i} style={styles.studentRow}>
              <View style={[styles.avatar, { backgroundColor: statusColors[student.status] + '20' }]}>
                <Text style={[styles.avatarText, { color: statusColors[student.status] }]}>{student.name.split(' ').map(n => n[0]).join('')}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentMeta}>Attendance: {student.attendance}%</Text>
              </View>
              <View style={styles.scoreArea}>
                <Text style={[styles.score, { color: statusColors[student.status] }]}>{student.score}%</Text>
                <Text style={[styles.gradeBadge, { backgroundColor: statusColors[student.status] + '20', color: statusColors[student.status] }]}>{student.grade}</Text>
              </View>
            </TouchableOpacity>
          ))}
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
