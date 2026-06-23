import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';

interface Homework {
  id: string;
  title: string;
  description?: string;
  subject?: { name: string };
  dueDate: string;
  maxScore?: number;
  submitted?: boolean;
  score?: number;
}

export const ParentHomeworkScreen: React.FC = () => {
  const { dashboard } = useAppStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
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
    if (selectedChildId) loadHomework();
  }, [selectedChildId]);

  const loadHomework = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const res = await apiService.getParentHomework(selectedChildId);
      const data = Array.isArray(res) ? res : res?.data || res?.homeworks || [];
      setHomeworks(data);
    } catch (err) {
      console.error('Failed to load homework');
      setHomeworks([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomework();
    setRefreshing(false);
  };

  const getStatusColor = (hw: Homework) => {
    if (hw.submitted) return colors.success;
    if (new Date(hw.dueDate) < new Date()) return colors.error;
    return colors.warning;
  };

  const getStatusLabel = (hw: Homework) => {
    if (hw.submitted) return `Submitted ${hw.score != null ? `- ${hw.score}/${hw.maxScore || '?'}` : ''}`;
    if (new Date(hw.dueDate) < new Date()) return 'Overdue';
    const days = Math.ceil((new Date(hw.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days === 0 ? 'Due today' : `${days} days left`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Homework</Text>
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
        ) : homeworks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyText}>No homework assignments</Text>
          </View>
        ) : (
          homeworks.map((hw) => (
            <View key={hw.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.subject}>{hw.subject?.name || 'General'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(hw) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(hw) }]}>{getStatusLabel(hw)}</Text>
                </View>
              </View>
              <Text style={styles.title}>{hw.title}</Text>
              {hw.description ? <Text style={styles.desc} numberOfLines={3}>{hw.description}</Text> : null}
              <View style={styles.cardFooter}>
                <Text style={styles.due}>Due: {new Date(hw.dueDate).toLocaleDateString()}</Text>
                {hw.maxScore ? <Text style={styles.maxScore}>Max: {hw.maxScore}</Text> : null}
              </View>
            </View>
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
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  subject: { fontSize: 13, fontWeight: '600', color: colors.primary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  desc: { fontSize: 13, color: colors.textLight, lineHeight: 18, marginBottom: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  due: { fontSize: 12, color: colors.textMuted },
  maxScore: { fontSize: 12, color: colors.textMuted },
});
