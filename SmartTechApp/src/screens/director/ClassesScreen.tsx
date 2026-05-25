import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorClassesProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const DirectorClassesScreen: React.FC<DirectorClassesProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClasses = async () => {
    try {
      const data = await apiService.getClasses();
      setClasses(data || []);
    } catch (err) {
      console.error('Failed to load classes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadClasses(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadClasses();
  };

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Classes"
        subtitle={`${classes.length} Total Classes`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.statValue, { color: colors.primaryLight }]}>{classes.length}</Text>
            <Text style={styles.statLabel}>Total Classes</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{totalStudents}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>
        </View>

        <WidgetCard title="All Classes">
          {classes.map((cls) => (
            <TouchableOpacity key={cls.id} style={styles.classCard}>
              <View style={styles.classIcon}>
                <Text style={styles.classIconText}>🏫</Text>
              </View>
              <View style={styles.classInfo}>
                <Text style={styles.className}>{cls.name}</Text>
                <Text style={styles.classTeacher}>
                  {cls.teachers && cls.teachers.length > 0
                    ? cls.teachers.map((t: any) => t.name).join(', ')
                    : 'No teacher assigned'}
                </Text>
              </View>
              <View style={styles.classMeta}>
                <Text style={styles.classStudents}>{cls.studentCount} students</Text>
              </View>
            </TouchableOpacity>
          ))}
          {classes.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏫</Text>
              <Text style={styles.emptyText}>No classes found</Text>
            </View>
          )}
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  classCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  classIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.infoLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  classIconText: { fontSize: 20 },
  classInfo: { flex: 1 },
  className: { fontSize: 15, fontWeight: '600', color: colors.text },
  classTeacher: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  classMeta: { alignItems: 'flex-end' },
  classStudents: { fontSize: 14, fontWeight: '700', color: colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
});
