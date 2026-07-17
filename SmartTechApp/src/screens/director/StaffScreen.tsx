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

const POSITION_TYPES = ['All', 'Director', 'Deputy Director', 'HOD', 'Head Teacher', 'Class Teacher', 'Teacher', 'Support'];

const POSITION_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Director: { bg: '#FEE2E2', text: '#DC2626' },
  'Deputy Director': { bg: '#FCE7F3', text: '#DB2777' },
  HOD: { bg: '#D1FAE5', text: '#059669' },
  'Head Teacher': { bg: '#EDE9FE', text: '#7C3AED' },
  'Class Teacher': { bg: '#FEF3C7', text: '#D97706' },
  Teacher: { bg: '#DBEAFE', text: '#2563EB' },
  Support: { bg: '#F3F4F6', text: '#6B7280' },
};

export const DirectorStaffScreen: React.FC<DirectorStaffProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [staff, setStaff] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('All');
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
    (s) => (s.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.roles?.some((r: string) => r.toLowerCase().includes(searchQuery.toLowerCase())) ||
           (s.gender || '').toLowerCase().includes(searchQuery.toLowerCase())) &&
           (positionFilter === 'All' || s.roles?.some((r: string) => r === positionFilter))
  );

  const getPositionType = (roles: string[]): string => {
    if (!roles || roles.length === 0) return 'Support';
    if (roles.includes('Director')) return 'Director';
    if (roles.includes('Deputy Director')) return 'Deputy Director';
    if (roles.includes('HOD')) return 'HOD';
    if (roles.includes('Head Teacher')) return 'Head Teacher';
    if (roles.includes('Class Teacher')) return 'Class Teacher';
    if (roles.includes('Teacher') || roles.includes('Primary Teacher') || roles.includes('Lecturer')) return 'Teacher';
    return 'Support';
  };

  const activeCount = staff.filter((s) => s.isActive).length;
  const maleCount = staff.filter((s) => s.gender?.toLowerCase() === 'male').length;
  const femaleCount = staff.filter((s) => s.gender?.toLowerCase() === 'female').length;

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

        <View style={styles.statsRow}>
          <View style={[styles.statCardHalf, { backgroundColor: colors.tealLight }]}>
            <Text style={styles.genderLabel}>♂ Male</Text>
            <Text style={[styles.statValue, { color: colors.teal }]}>{maleCount}</Text>
          </View>
          <View style={[styles.statCardHalf, { backgroundColor: colors.purpleLight }]}>
            <Text style={styles.genderLabel}>♀ Female</Text>
            <Text style={[styles.statValue, { color: colors.purple }]}>{femaleCount}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.positionsLink} onPress={() => onNavigate?.('DirectorStaffPositions')}>
          <Text style={styles.positionsLinkText}>🏛️ Manage Staff Positions & Departments →</Text>
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {POSITION_TYPES.map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, positionFilter === type && styles.filterChipActive]}
              onPress={() => setPositionFilter(type)}
            >
              <Text style={[styles.filterChipText, positionFilter === type && styles.filterChipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <WidgetCard title="All Staff">
          {filtered.map((member) => {
            const posType = getPositionType(member.roles || []);
            const posColor = POSITION_TYPE_COLORS[posType] || POSITION_TYPE_COLORS.Support;
            return (
              <TouchableOpacity key={member.id} style={styles.staffCard}>
                <View style={styles.staffAvatar}>
                  <Text style={styles.staffAvatarText}>{member.firstName.charAt(0)}{member.lastName.charAt(0)}</Text>
                </View>
                <View style={styles.staffInfo}>
                  <View style={styles.staffNameRow}>
                    <Text style={styles.staffName}>{member.firstName} {member.lastName}</Text>
                    {member.gender && (
                      <Text style={[styles.genderBadge, member.gender.toLowerCase() === 'male' ? styles.genderMale : styles.genderFemale]}>
                        {member.gender.toLowerCase() === 'male' ? '♂' : '♀'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.positionTypeRow}>
                    <View style={[styles.positionTypeBadge, { backgroundColor: posColor.bg }]}>
                      <Text style={[styles.positionTypeText, { color: posColor.text }]}>{posType}</Text>
                    </View>
                  </View>
                  <Text style={styles.staffRole}>{member.roles?.join(', ') || 'Staff'}{member.employeeNo ? ` • ${member.employeeNo}` : ''}</Text>
                </View>
                <View style={[styles.statusDot, member.isActive ? styles.statusActive : styles.statusInactive]} />
              </TouchableOpacity>
            );
          })}
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
  statCardHalf: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  genderLabel: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
  staffCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  staffAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.teal, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  staffAvatarText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  staffInfo: { flex: 1 },
  staffNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  staffName: { fontSize: 15, fontWeight: '600', color: colors.text },
  genderBadge: { fontSize: 13, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: borderRadius.sm, overflow: 'hidden' },
  genderMale: { backgroundColor: colors.tealLight, color: colors.teal },
  genderFemale: { backgroundColor: colors.purpleLight, color: colors.purple },
  staffRole: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  filterRow: { marginBottom: spacing.md },
  filterContent: { gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: colors.white },
  positionTypeRow: { flexDirection: 'row', marginTop: 4 },
  positionTypeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm, alignSelf: 'flex-start' },
  positionTypeText: { fontSize: 11, fontWeight: '700' },
  positionsLink: { backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, alignItems: 'center' },
  positionsLinkText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusActive: { backgroundColor: colors.success },
  statusInactive: { backgroundColor: colors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
});
