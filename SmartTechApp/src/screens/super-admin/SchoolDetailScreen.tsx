import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

export const SuperAdminSchoolDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const { schoolId } = route.params || {};
  const [school, setSchool] = useState<any>(null);
  const [directors, setDirectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [schoolRes, dirsRes] = await Promise.all([
        apiService.getSuperAdminSchoolById(schoolId),
        apiService.getSuperAdminSchoolDirectors(schoolId).catch(() => []),
      ]);
      setSchool(schoolRes?.school || schoolRes?.data || schoolRes);
      setDirectors(Array.isArray(dirsRes) ? dirsRes : dirsRes?.directors || dirsRes?.data || []);
    } catch (err) {
      console.error('Failed to load school:', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleActive = async () => {
    try {
      if (school.status === 'ACTIVE') {
        await apiService.deactivateSuperAdminSchool(schoolId);
      } else {
        await apiService.activateSuperAdminSchool(schoolId);
      }
      loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to update school status');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <HeaderBar title="School Details" leftIcon={{ name: '←', onPress: () => navigation.goBack() }} />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!school) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <HeaderBar title="School Details" leftIcon={{ name: '←', onPress: () => navigation.goBack() }} />
        <View style={styles.emptyState}><Text style={styles.emptyText}>School not found</Text></View>
      </SafeAreaView>
    );
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'ACTIVE': return colors.success;
      case 'INACTIVE': case 'DEACTIVATED': return colors.error;
      default: return colors.warning;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title={school.name || 'School Details'}
        subtitle={school.code || school.email}
        leftIcon={{ name: '←', onPress: () => navigation.goBack() }}
        rightIcon={{ name: '🔄', onPress: loadData }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: getStatusColor(school.status) + '20' }]}
            onPress={() => Alert.alert('Change Status', `Current: ${school.status}`, [
              { text: 'Cancel', style: 'cancel' },
              { text: school.status === 'ACTIVE' ? 'Deactivate' : 'Activate', onPress: handleToggleActive },
            ])}
          >
            <Text style={[styles.statusText, { color: getStatusColor(school.status) }]}>{school.status}</Text>
          </TouchableOpacity>
          {school.subscriptionStatus && (
            <View style={[styles.statusBadge, { backgroundColor: school.subscriptionStatus === 'ACTIVE' ? colors.successLight : colors.warningLight }]}>
              <Text style={[styles.statusText, { color: school.subscriptionStatus === 'ACTIVE' ? colors.success : colors.warning }]}>
                {school.subscriptionStatus}
              </Text>
            </View>
          )}
        </View>

        <WidgetCard title="School Information">
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Name</Text><Text style={styles.infoValue}>{school.name}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Code</Text><Text style={styles.infoValue}>{school.code || '-'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{school.email || '-'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoValue}>{school.phone || '-'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Address</Text><Text style={styles.infoValue}>{school.address || '-'}</Text></View>
          {school.institutionType && (
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Type</Text><Text style={styles.infoValue}>{school.institutionType.name || school.institutionType}</Text></View>
          )}
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Created</Text><Text style={styles.infoValue}>{new Date(school.createdAt).toLocaleDateString()}</Text></View>
          {school.trialEndsAt && (
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Trial Ends</Text><Text style={styles.infoValue}>{new Date(school.trialEndsAt).toLocaleDateString()}</Text></View>
          )}
        </WidgetCard>

        <WidgetCard title={`Directors (${directors.length})`}>
          {directors.length === 0 ? (
            <Text style={styles.emptyText}>No directors assigned</Text>
          ) : (
            directors.map((d: any) => (
              <View key={d.id} style={styles.directorRow}>
                <View style={styles.dirAvatar}>
                  <Text style={styles.dirAvatarText}>{(d.name || d.email || '?')[0]}</Text>
                </View>
                <View style={styles.dirInfo}>
                  <Text style={styles.dirName}>{d.name || 'Unknown'}</Text>
                  <Text style={styles.dirEmail}>{d.email}</Text>
                </View>
              </View>
            ))
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
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.lg },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full },
  statusText: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { fontSize: 13, color: colors.textLight, fontWeight: '500' },
  infoValue: { fontSize: 13, color: colors.text, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  directorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dirAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.infoLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  dirAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  dirInfo: { flex: 1 },
  dirName: { fontSize: 14, fontWeight: '600', color: colors.text },
  dirEmail: { fontSize: 12, color: colors.textLight, marginTop: 1 },
});
