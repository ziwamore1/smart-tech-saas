import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';

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

export const ClassTeacherStudentsScreen: React.FC = () => {
  const { dashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [filter, setFilter] = useState<string>('all');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title="Students"
        subtitle={`${students.length} enrolled`}
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
