import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

interface DepartmentTeachersProps {
  route?: any;
  stackNavigation?: any;
}

export const DepartmentTeachersScreen: React.FC<DepartmentTeachersProps> = ({ route, stackNavigation }) => {
  const departmentId = route?.params?.departmentId;
  const departmentName = route?.params?.departmentName || 'Department';
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTeachers = async () => {
    if (!departmentId) { setLoading(false); return; }
    try {
      const data = await apiService.getDepartmentTeachers(departmentId);
      setTeachers(Array.isArray(data) ? data : data?.teachers || []);
    } catch (err) {
      console.error('Failed to load department teachers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadTeachers(); }, [departmentId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTeachers();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title={departmentName}
        subtitle={`${loading ? '...' : `${teachers.length} teacher${teachers.length !== 1 ? 's' : ''}`}`}
        leftIcon={{ name: '←', onPress: () => stackNavigation?.goBack?.() }}
        rightIcon={{ name: '🔔', onPress: () => {} }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {teachers.length === 0 && (
            <Text style={styles.emptyText}>No teachers in this department.</Text>
          )}
          {teachers.map((t, i) => {
            const positions = t.positions || [];
            const primaryPosition = positions.find((p: any) => p.isPrimary);
            return (
              <View key={t.id || i} style={styles.teacherCard}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>
                    {t.user?.firstName?.[0]}{t.user?.lastName?.[0]}
                  </Text>
                </View>
                <View style={styles.teacherInfo}>
                  <Text style={styles.teacherName}>
                    {t.user?.firstName} {t.user?.lastName}
                  </Text>
                  <Text style={styles.teacherRole}>
                    {primaryPosition?.positionType?.replace(/_/g, ' ') || 'Teacher'}
                  </Text>
                  {t.employeeNo && <Text style={styles.teacherDetail}>Staff No: {t.employeeNo}</Text>}
                  {t.user?.email && <Text style={styles.teacherDetail}>{t.user.email}</Text>}
                </View>
                {positions.length > 0 && (
                  <View style={styles.positionChips}>
                    {positions.map((p: any, j: number) => (
                      <View key={j} style={[styles.chip, p.isPrimary && styles.primaryChip]}>
                        <Text style={[styles.chipText, p.isPrimary && styles.primaryChipText]}>
                          {p.positionType.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          {teachers.length > 0 && (
            <Text style={styles.countFooter}>
              Showing {teachers.length} teacher{teachers.length !== 1 ? 's' : ''}
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  emptyText: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xxl, fontSize: 15 },
  teacherCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarLargeText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  teacherInfo: { flex: 1 },
  teacherName: { fontSize: 15, fontWeight: '600', color: colors.text },
  teacherRole: { fontSize: 13, color: colors.primaryLight, marginTop: 2, fontWeight: '500' },
  teacherDetail: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  positionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.sm },
  chip: { backgroundColor: colors.borderLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  primaryChip: { backgroundColor: colors.successLight },
  chipText: { fontSize: 10, color: colors.textLight, fontWeight: '500' },
  primaryChipText: { color: colors.success, fontWeight: '600' },
  countFooter: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md, fontSize: 13 },
});
