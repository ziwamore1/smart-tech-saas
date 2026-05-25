import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorStaffProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const DirectorStaffScreen: React.FC<DirectorStaffProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [staff, setStaff] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStaff = async () => {
    try {
      const data = await apiService.getStaff();
      setStaff(data || []);
    } catch (err) {
      console.error('Failed to load staff:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadStaff(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStaff();
  };

  const filtered = staff.filter(
    (s) => s.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.roles?.some((r: string) => r.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeCount = staff.filter((s) => s.isActive).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Staff"
        subtitle={`${staff.length} Total Staff`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{staff.length - activeCount}</Text>
            <Text style={styles.statLabel}>Inactive</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.statValue, { color: colors.primaryLight }]}>{staff.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <WidgetCard title="All Staff">
          {filtered.map((member) => (
            <TouchableOpacity key={member.id} style={styles.staffCard}>
              <View style={styles.staffAvatar}>
                <Text style={styles.staffAvatarText}>{member.firstName.charAt(0)}{member.lastName.charAt(0)}</Text>
              </View>
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{member.firstName} {member.lastName}</Text>
                <Text style={styles.staffRole}>{member.roles?.join(', ') || 'Staff'}{member.employeeNo ? ` • ${member.employeeNo}` : ''}</Text>
              </View>
              <View style={[styles.statusDot, member.isActive ? styles.statusActive : styles.statusInactive]} />
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No staff found</Text>
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
  staffCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  staffAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.teal, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  staffAvatarText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 15, fontWeight: '600', color: colors.text },
  staffRole: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusActive: { backgroundColor: colors.success },
  statusInactive: { backgroundColor: colors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
});
