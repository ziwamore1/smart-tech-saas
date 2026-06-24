import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';
import { colors, spacing } from '../../theme';
import { HeaderBar } from '../../components';

export const StudentHomeworkScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [homework, setHomework] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sid = user?.studentId || user?.id;
    if (sid) {
      apiService.getStudentHomework(sid)
        .then(r => {
          const data = r?.data || r || [];
          setHomework(Array.isArray(data) ? data : []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user?.studentId, user?.id]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Homework" subtitle="Your assignments" />
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : homework.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyText}>No homework assigned</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {homework.map((h: any) => (
            <View key={h.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{h.title}</Text>
                <View style={[styles.badge, { backgroundColor: new Date(h.dueDate) > new Date() ? colors.warningLight : colors.successLight }]}>
                  <Text style={[styles.badgeText, { color: new Date(h.dueDate) > new Date() ? colors.warning : colors.success }]}>
                    {new Date(h.dueDate) > new Date() ? 'Pending' : 'Due'}
                  </Text>
                </View>
              </View>
              {h.description && <Text style={styles.description}>{h.description}</Text>}
              <Text style={styles.meta}>Subject: {h.subject?.name || 'N/A'} | Due: {new Date(h.dueDate).toLocaleDateString()}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  description: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs },
  meta: { fontSize: 12, color: colors.textMuted },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyText: { fontSize: 16, color: colors.textMuted },
});
