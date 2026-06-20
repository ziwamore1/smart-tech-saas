import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface SuperAdminSchoolsProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

interface School {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  subscriptionStatus: string;
  institutionType?: { name: string };
  createdAt: string;
  trialEndsAt?: string;
}

export const SuperAdminSchoolsScreen: React.FC<SuperAdminSchoolsProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [schools, setSchools] = useState<School[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const [schoolsRes, statsRes] = await Promise.all([
        apiService.getSuperAdminSchools({ search: search || undefined, status: statusFilter || undefined, limit: 100 }),
        apiService.getSuperAdminStats().catch(() => null),
      ]);
      setSchools(schoolsRes?.schools || schoolsRes?.data || []);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load schools:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalSchools = stats?.totalSchools ?? stats?.schools_count ?? schools.length;
  const activeSchools = stats?.activeSchools ?? stats?.active_schools ?? schools.filter(s => s.status === 'ACTIVE').length;
  const trialSchools = stats?.trialSchools ?? stats?.trial_schools ?? schools.filter(s => s.subscriptionStatus === 'TRIAL').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return colors.success;
      case 'INACTIVE': case 'DEACTIVATED': return colors.error;
      case 'SUSPENDED': return colors.warning;
      default: return colors.textLight;
    }
  };

  const handleSchoolPress = (school: School) => {
    if (onNavigate) {
      navigation.navigate('SuperAdminSchoolDetail', { schoolId: school.id });
    }
  };

  const handleCreateSchool = () => {
    if (onNavigate) {
      navigation.navigate('SuperAdminCreateSchool');
    }
  };

  const filteredSchools = schools.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.code?.toLowerCase().includes(q) && !s.email?.toLowerCase().includes(q)) return false;
    }
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  const FILTERS = ['', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Schools"
        subtitle={`${schools.length} schools`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
      />

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search schools..."
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleCreateSchool}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
              {f || 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsRow}>
          <StatCard label="Total" value={totalSchools} icon="🏫" color={colors.purple} bgColor={colors.purpleLight} />
          <StatCard label="Active" value={activeSchools} icon="✅" color={colors.success} bgColor={colors.successLight} />
          <StatCard label="Trial" value={trialSchools} icon="🆓" color={colors.warning} bgColor={colors.warningLight} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {filteredSchools.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏫</Text>
                <Text style={styles.emptyTitle}>No schools found</Text>
                <Text style={styles.emptyDesc}>Tap + to register a new school</Text>
              </View>
            ) : (
              filteredSchools.map((school) => (
                <TouchableOpacity key={school.id} style={styles.schoolCard} onPress={() => handleSchoolPress(school)}>
                  <View style={styles.schoolHeader}>
                    <View style={styles.schoolAvatar}>
                      <Text style={styles.schoolAvatarText}>{(school.name || '?')[0]}</Text>
                    </View>
                    <View style={styles.schoolInfo}>
                      <Text style={styles.schoolName}>{school.name}</Text>
                      <Text style={styles.schoolCode}>{school.code || school.email}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(school.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(school.status) }]}>{school.status}</Text>
                    </View>
                  </View>
                  <View style={styles.schoolMeta}>
                    {school.institutionType && (
                      <Text style={styles.schoolMetaItem}>📋 {school.institutionType.name}</Text>
                    )}
                    <Text style={styles.schoolMetaItem}>📅 {new Date(school.createdAt).toLocaleDateString()}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  searchIcon: { fontSize: 18, position: 'absolute', left: spacing.md + 12, zIndex: 1 },
  searchInput: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingVertical: spacing.sm, paddingLeft: 40, paddingRight: spacing.md, fontSize: 14, color: colors.text, ...shadows.sm },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', ...shadows.sm },
  addBtnText: { fontSize: 22, color: colors.white, fontWeight: '600', marginTop: -2 },
  filterRow: { maxHeight: 44, marginBottom: spacing.xs },
  filterContent: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center' },
  filterChip: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  filterChipTextActive: { color: colors.white },
  scroll: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.md },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyDesc: { fontSize: 14, color: colors.textLight, textAlign: 'center' },
  schoolCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
  schoolHeader: { flexDirection: 'row', alignItems: 'center' },
  schoolAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  schoolAvatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  schoolInfo: { flex: 1 },
  schoolName: { fontSize: 16, fontWeight: '600', color: colors.text },
  schoolCode: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  statusText: { fontSize: 11, fontWeight: '700' },
  schoolMeta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  schoolMetaItem: { fontSize: 12, color: colors.textLight },
});
